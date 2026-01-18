const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

const { sequelize } = require('./models');
const fraudDetection = require('./services/fraudDetection');
const { rateLimiter, requestTimer, cacheMiddleware, cacheManager } = require('./middleware/performanceOptimization');

// Import routes
const dashboardRoutes = require('./routes/dashboard');
const transactionRoutes = require('./routes/transactions');
const inventoryRoutes = require('./routes/inventory');
const analyticsRoutes = require('./routes/analytics');
const alertRoutes = require('./routes/alerts');
const customerRoutes = require('./routes/customers');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Challenge D: Performance Optimization Middleware
app.use(requestTimer()); // Track response times
app.use(rateLimiter({ windowMs: 60000, maxRequests: 100 })); // Rate limiting

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} | ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use('/api/dashboard', cacheMiddleware(60, 'dashboard'), dashboardRoutes); // Cache dashboard 1 min
app.use('/api/transactions', transactionRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/analytics', cacheMiddleware(120, 'analytics'), analyticsRoutes); // Cache analytics 2 min
app.use('/api/alerts', alertRoutes);
app.use('/api/customers', customerRoutes); // Challenge C: Customer Analytics

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Challenge D: Cache management endpoints
app.get('/api/cache/stats', (req, res) => {
  res.json({ success: true, data: cacheManager.stats() });
});

app.delete('/api/cache/flush', (req, res) => {
  cacheManager.flush();
  res.json({ success: true, message: 'Cache flushed' });
});

app.delete('/api/cache/pattern/:pattern', (req, res) => {
  const deleted = cacheManager.invalidatePattern(req.params.pattern);
  res.json({ success: true, deleted });
});

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'TechMart Analytics API',
    version: '2.0.0',
    features: [
      'Challenge A: Real-Time Fraud Detection',
      'Challenge B: Advanced Inventory Management',
      'Challenge C: Customer Behavior Analytics',
      'Challenge D: Performance Optimization'
    ],
    endpoints: {
      dashboard: {
        'GET /api/dashboard/overview': 'Summary statistics for last 24h',
        'GET /api/dashboard/sales-by-category': 'Sales breakdown by category',
        'GET /api/dashboard/recent-transactions': 'Recent transactions list',
        'GET /api/dashboard/top-products': 'Top selling products'
      },
      transactions: {
        'GET /api/transactions': 'List transactions with pagination/filtering',
        'POST /api/transactions': 'Create new transaction with fraud detection',
        'GET /api/transactions/suspicious': 'Get potentially fraudulent transactions',
        'GET /api/transactions/:id': 'Get single transaction details'
      },
      inventory: {
        'GET /api/inventory': 'List all products with stock info',
        'GET /api/inventory/low-stock': 'Products below reorder threshold',
        'GET /api/inventory/categories': 'Product categories summary',
        'GET /api/inventory/reorder-suggestions': 'Challenge B: Automated reorder suggestions',
        'GET /api/inventory/predict/:id': 'Challenge B: Predict future stock levels',
        'GET /api/inventory/optimize-supplier/:id': 'Challenge B: Find optimal supplier',
        'GET /api/inventory/seasonal/:id': 'Challenge B: Seasonal demand patterns',
        'GET /api/inventory/:id': 'Get single product details'
      },
      customers: {
        'GET /api/customers': 'List all customers',
        'GET /api/customers/rfm-analysis': 'Challenge C: RFM Segmentation Analysis',
        'GET /api/customers/churn-risk': 'Challenge C: Identify at-risk customers',
        'GET /api/customers/tiers': 'Customer tier breakdown',
        'GET /api/customers/:id': 'Get customer details',
        'GET /api/customers/:id/recommendations': 'Challenge C: Product recommendations',
        'GET /api/customers/:id/clv': 'Challenge C: Customer Lifetime Value prediction'
      },
      analytics: {
        'GET /api/analytics/hourly-sales': 'Hourly sales data for charts',
        'GET /api/analytics/daily-sales': 'Daily sales data',
        'GET /api/analytics/payment-methods': 'Payment method breakdown',
        'GET /api/analytics/customer-segments': 'Customer segmentation',
        'GET /api/analytics/fraud-trends': 'Fraud detection trends',
        'GET /api/analytics/export': 'Export data (CSV/JSON)'
      },
      alerts: {
        'GET /api/alerts': 'List all alerts',
        'POST /api/alerts': 'Create custom business alert',
        'PUT /api/alerts/:id/read': 'Mark alert as read',
        'PUT /api/alerts/:id/resolve': 'Resolve alert',
        'GET /api/alerts/summary': 'Alerts summary'
      },
      cache: {
        'GET /api/cache/stats': 'Challenge D: Cache statistics',
        'DELETE /api/cache/flush': 'Challenge D: Flush all cache',
        'DELETE /api/cache/pattern/:pattern': 'Challenge D: Invalidate by pattern'
      }
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Create HTTP server
const server = http.createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocket.Server({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('WebSocket message:', data);

      // Handle different message types
      if (data.type === 'SUBSCRIBE') {
        ws.subscriptions = data.channels || [];
      }
    } catch (err) {
      console.error('WebSocket message error:', err);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'CONNECTED',
    message: 'Connected to TechMart real-time updates'
  }));
});

// Set WebSocket server for fraud detection service
fraudDetection.setWsServer(wss);

// Broadcast function for real-time updates
const broadcast = (type, data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type, data, timestamp: new Date().toISOString() }));
    }
  });
};

// Make broadcast available globally
app.locals.broadcast = broadcast;

// Initialize database and start server
async function startServer() {
  try {
    // Sync database
    await sequelize.sync();
    console.log('Database synchronized');

    // Start server
    server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════════╗
║         TechMart Analytics Dashboard API                  ║
╠═══════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                ║
║  WebSocket at:      ws://localhost:${PORT}/ws               ║
║  API docs at:       http://localhost:${PORT}/api            ║
╚═══════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, server, wss, broadcast };
