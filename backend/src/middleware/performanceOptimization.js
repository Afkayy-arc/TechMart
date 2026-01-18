const NodeCache = require('node-cache');

// In-memory cache with TTL
const cache = new NodeCache({
  stdTTL: 300, // Default 5 minutes
  checkperiod: 60,
  useClones: false
});

// Cache statistics
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0
};

// Rate limiting storage
const rateLimitStore = new Map();

// Cache middleware factory
const cacheMiddleware = (ttlSeconds = 300, keyPrefix = '') => {
  return (req, res, next) => {
    // Generate cache key from request
    const key = `${keyPrefix}:${req.originalUrl}`;

    // Check cache
    const cachedResponse = cache.get(key);
    if (cachedResponse) {
      cacheStats.hits++;
      res.set('X-Cache', 'HIT');
      res.set('X-Cache-TTL', cache.getTtl(key) - Date.now());
      return res.json(cachedResponse);
    }

    cacheStats.misses++;
    res.set('X-Cache', 'MISS');

    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json to cache response
    res.json = (data) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, data, ttlSeconds);
        cacheStats.sets++;
      }
      return originalJson(data);
    };

    next();
  };
};

// Rate limiting middleware
const rateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000, // 1 minute window
    maxRequests = 100,     // Max requests per window
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip || req.connection.remoteAddress
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs
      };
    }

    entry.count++;
    rateLimitStore.set(key, entry);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - entry.count));
    res.set('X-RateLimit-Reset', entry.resetTime);

    if (entry.count > maxRequests) {
      res.set('Retry-After', Math.ceil((entry.resetTime - now) / 1000));
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((entry.resetTime - now) / 1000)
      });
    }

    next();
  };
};

// Request timing middleware
const requestTimer = () => {
  return (req, res, next) => {
    const start = process.hrtime();

    // Store original end method
    const originalEnd = res.end.bind(res);

    res.end = function(...args) {
      const [seconds, nanoseconds] = process.hrtime(start);
      const duration = seconds * 1000 + nanoseconds / 1000000;

      // Only set header if not already sent
      if (!res.headersSent) {
        res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      }

      // Log slow queries
      if (duration > 1000) {
        console.warn(`Slow request: ${req.method} ${req.originalUrl} took ${duration.toFixed(2)}ms`);
      }

      return originalEnd(...args);
    };

    next();
  };
};

// Compression recommendation based on response size
const compressionAdvisor = () => {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);

    res.json = (data) => {
      const size = JSON.stringify(data).length;
      if (size > 10000) {
        res.set('X-Compression-Advised', 'true');
        res.set('X-Response-Size', size);
      }
      return originalJson(data);
    };

    next();
  };
};

// Query optimization helper
const queryOptimizer = {
  // Add indexes suggestion based on query patterns
  suggestIndexes: (queryLog) => {
    const patterns = {};
    queryLog.forEach(q => {
      if (q.where) {
        Object.keys(q.where).forEach(field => {
          patterns[field] = (patterns[field] || 0) + 1;
        });
      }
    });
    return Object.entries(patterns)
      .filter(([_, count]) => count > 10)
      .map(([field]) => field);
  },

  // Batch query helper
  batchQueries: async (queries) => {
    return Promise.all(queries);
  }
};

// Cache management functions
const cacheManager = {
  get: (key) => cache.get(key),
  set: (key, value, ttl) => {
    cache.set(key, value, ttl);
    cacheStats.sets++;
  },
  del: (key) => cache.del(key),
  flush: () => cache.flushAll(),
  keys: () => cache.keys(),
  stats: () => ({
    ...cache.getStats(),
    ...cacheStats,
    hitRate: cacheStats.hits / (cacheStats.hits + cacheStats.misses) || 0
  }),
  invalidatePattern: (pattern) => {
    const keys = cache.keys();
    const regex = new RegExp(pattern);
    let deleted = 0;
    keys.forEach(key => {
      if (regex.test(key)) {
        cache.del(key);
        deleted++;
      }
    });
    return deleted;
  }
};

// Clean up rate limit store periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

module.exports = {
  cacheMiddleware,
  rateLimiter,
  requestTimer,
  compressionAdvisor,
  queryOptimizer,
  cacheManager
};
