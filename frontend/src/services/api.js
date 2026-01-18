import axios from 'axios';

// Force API URL to backend server - environment variables don't work reliably in production builds
const API_BASE_URL = 'http://localhost:3001/api';
console.log('API Base URL:', API_BASE_URL);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error.response?.data || error);
  }
);

// Dashboard endpoints
export const dashboardAPI = {
  getOverview: () => api.get('/dashboard/overview'),
  getSalesByCategory: () => api.get('/dashboard/sales-by-category'),
  getRecentTransactions: (limit = 20) => api.get(`/dashboard/recent-transactions?limit=${limit}`),
  getTopProducts: (limit = 10) => api.get(`/dashboard/top-products?limit=${limit}`),
};

// Transactions endpoints
export const transactionsAPI = {
  getAll: (params = {}) => api.get('/transactions', { params }),
  create: (data) => api.post('/transactions', data),
  getSuspicious: (params = {}) => api.get('/transactions/suspicious', { params }),
  getById: (id) => api.get(`/transactions/${id}`),
};

// Inventory endpoints
export const inventoryAPI = {
  getAll: (params = {}) => api.get('/inventory', { params }),
  getLowStock: (threshold = 10) => api.get(`/inventory/low-stock?threshold=${threshold}`),
  getCategories: () => api.get('/inventory/categories'),
  getById: (id) => api.get(`/inventory/${id}`),
  // Challenge B: Advanced Inventory Management
  predictStock: (id, days = 14) => api.get(`/inventory/predict/${id}?days=${days}`),
  optimizeSupplier: (id, quantity = 100) => api.get(`/inventory/optimize-supplier/${id}?quantity=${quantity}`),
  getReorderSuggestions: () => api.get('/inventory/reorder-suggestions'),
  getSeasonalPatterns: (id) => api.get(`/inventory/seasonal/${id}`),
};

// Challenge C: Customer Analytics endpoints
export const customersAPI = {
  getAll: (params = {}) => api.get('/customers', { params }),
  getById: (id) => api.get(`/customers/${id}`),
  getRFMAnalysis: () => api.get('/customers/rfm-analysis'),
  getChurnRisk: () => api.get('/customers/churn-risk'),
  getTiers: () => api.get('/customers/tiers'),
  getRecommendations: (id, limit = 10) => api.get(`/customers/${id}/recommendations?limit=${limit}`),
  getCLV: (id) => api.get(`/customers/${id}/clv`),
};

// Challenge D: Cache Management endpoints
export const cacheAPI = {
  getStats: () => api.get('/cache/stats'),
  flush: () => api.delete('/cache/flush'),
  invalidatePattern: (pattern) => api.delete(`/cache/pattern/${pattern}`),
};

// Analytics endpoints
export const analyticsAPI = {
  getHourlySales: (hours = 24) => api.get(`/analytics/hourly-sales?hours=${hours}`),
  getDailySales: (days = 30) => api.get(`/analytics/daily-sales?days=${days}`),
  getPaymentMethods: () => api.get('/analytics/payment-methods'),
  getCustomerSegments: () => api.get('/analytics/customer-segments'),
  getFraudTrends: (days = 7) => api.get(`/analytics/fraud-trends?days=${days}`),
  exportData: (type, format = 'json') => api.get(`/analytics/export?type=${type}&format=${format}`),
};

// Alerts endpoints
export const alertsAPI = {
  getAll: (params = {}) => api.get('/alerts', { params }),
  create: (data) => api.post('/alerts', data),
  markRead: (id) => api.put(`/alerts/${id}/read`),
  resolve: (id) => api.put(`/alerts/${id}/resolve`),
  markAllRead: () => api.put('/alerts/mark-all-read'),
  getSummary: () => api.get('/alerts/summary'),
  delete: (id) => api.delete(`/alerts/${id}`),
};

export default api;
