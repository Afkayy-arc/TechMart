const express = require('express');
const router = express.Router();
const { Transaction, Product, Customer } = require('../models');
const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/database');

// GET /api/analytics/hourly-sales - Hourly sales data for charts
router.get('/hourly-sales', async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    // Round start time down to the beginning of the hour
    const now = new Date();
    const startTime = new Date(now.getTime() - hours * 60 * 60 * 1000);
    startTime.setMinutes(0, 0, 0);

    // SQLite date formatting
    const sales = await Transaction.findAll({
      attributes: [
        [fn('strftime', '%Y-%m-%d %H:00', col('timestamp')), 'hour'],
        [fn('SUM', col('total_amount')), 'revenue'],
        [fn('COUNT', col('id')), 'transactions']
      ],
      where: {
        timestamp: { [Op.gte]: startTime },
        status: 'completed'
      },
      group: [fn('strftime', '%Y-%m-%d %H:00', col('timestamp'))],
      order: [[fn('strftime', '%Y-%m-%d %H:00', col('timestamp')), 'ASC']],
      raw: true
    });

    // Fill in missing hours with zero values (include current hour, so hours + 1)
    const hourlyData = [];
    for (let i = 0; i <= hours; i++) {
      const hourDate = new Date(startTime.getTime() + i * 60 * 60 * 1000);
      // Format to match SQLite strftime output: YYYY-MM-DD HH:00
      const year = hourDate.getUTCFullYear();
      const month = String(hourDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(hourDate.getUTCDate()).padStart(2, '0');
      const hour = String(hourDate.getUTCHours()).padStart(2, '0');
      const hourKey = `${year}-${month}-${day} ${hour}:00`;

      const existing = sales.find(s => s.hour === hourKey);

      hourlyData.push({
        hour: hourKey,
        label: hourDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        revenue: existing ? parseFloat(existing.revenue) : 0,
        transactions: existing ? parseInt(existing.transactions) : 0
      });
    }

    res.json({ success: true, data: hourlyData });
  } catch (error) {
    console.error('Hourly sales error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics/daily-sales - Daily sales data
router.get('/daily-sales', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const sales = await Transaction.findAll({
      attributes: [
        [fn('DATE', col('timestamp')), 'date'],
        [fn('SUM', col('total_amount')), 'revenue'],
        [fn('COUNT', col('id')), 'transactions'],
        [fn('AVG', col('total_amount')), 'avgOrderValue']
      ],
      where: {
        timestamp: { [Op.gte]: startDate },
        status: 'completed'
      },
      group: [fn('DATE', col('timestamp'))],
      order: [[fn('DATE', col('timestamp')), 'ASC']],
      raw: true
    });

    const formattedSales = sales.map(s => ({
      date: s.date,
      revenue: parseFloat(s.revenue || 0),
      transactions: parseInt(s.transactions || 0),
      avgOrderValue: parseFloat(s.avgOrderValue || 0).toFixed(2)
    }));

    res.json({ success: true, data: formattedSales });
  } catch (error) {
    console.error('Daily sales error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics/payment-methods - Payment method breakdown
router.get('/payment-methods', async (req, res) => {
  try {
    const methods = await Transaction.findAll({
      attributes: [
        'payment_method',
        [fn('COUNT', col('id')), 'count'],
        [fn('SUM', col('total_amount')), 'total']
      ],
      where: { status: 'completed' },
      group: ['payment_method'],
      order: [[fn('COUNT', col('id')), 'DESC']],
      raw: true
    });

    const total = methods.reduce((sum, m) => sum + parseInt(m.count), 0);
    const formattedMethods = methods.map(m => ({
      method: m.payment_method,
      count: parseInt(m.count),
      total: parseFloat(m.total || 0),
      percentage: ((parseInt(m.count) / total) * 100).toFixed(1)
    }));

    res.json({ success: true, data: formattedMethods });
  } catch (error) {
    console.error('Payment methods error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics/customer-segments - Customer segmentation
router.get('/customer-segments', async (req, res) => {
  try {
    const segments = await Customer.findAll({
      attributes: [
        'loyalty_tier',
        [fn('COUNT', col('id')), 'count'],
        [fn('AVG', col('total_spent')), 'avgSpent'],
        [fn('AVG', col('risk_score')), 'avgRiskScore']
      ],
      group: ['loyalty_tier'],
      raw: true
    });

    const formattedSegments = segments.map(s => ({
      tier: s.loyalty_tier || 'none',
      count: parseInt(s.count),
      avgSpent: parseFloat(s.avgSpent || 0).toFixed(2),
      avgRiskScore: parseFloat(s.avgRiskScore || 0).toFixed(3)
    }));

    res.json({ success: true, data: formattedSegments });
  } catch (error) {
    console.error('Customer segments error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics/fraud-trends - Fraud detection trends
router.get('/fraud-trends', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const trends = await Transaction.findAll({
      attributes: [
        [fn('DATE', col('timestamp')), 'date'],
        [fn('COUNT', col('id')), 'totalTransactions'],
        [fn('SUM', literal("CASE WHEN fraud_score >= 0.5 THEN 1 ELSE 0 END")), 'suspiciousCount'],
        [fn('AVG', col('fraud_score')), 'avgFraudScore']
      ],
      where: {
        timestamp: { [Op.gte]: startDate }
      },
      group: [fn('DATE', col('timestamp'))],
      order: [[fn('DATE', col('timestamp')), 'ASC']],
      raw: true
    });

    const formattedTrends = trends.map(t => ({
      date: t.date,
      totalTransactions: parseInt(t.totalTransactions || 0),
      suspiciousCount: parseInt(t.suspiciousCount || 0),
      avgFraudScore: parseFloat(t.avgFraudScore || 0).toFixed(3),
      suspiciousRate: ((parseInt(t.suspiciousCount || 0) / parseInt(t.totalTransactions || 1)) * 100).toFixed(1)
    }));

    res.json({ success: true, data: formattedTrends });
  } catch (error) {
    console.error('Fraud trends error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/analytics/export - Export data as CSV
router.get('/export', async (req, res) => {
  try {
    const { type, startDate, endDate, format } = req.query;

    let data;
    let filename;

    const where = {};
    if (startDate && endDate) {
      where.timestamp = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    switch (type) {
      case 'transactions':
        data = await Transaction.findAll({
          where,
          include: [
            { model: Customer, attributes: ['email', 'first_name', 'last_name'] },
            { model: Product, attributes: ['name', 'category'] }
          ],
          order: [['timestamp', 'DESC']],
          raw: true,
          nest: true
        });
        filename = 'transactions';
        break;

      case 'products':
        data = await Product.findAll({ raw: true });
        filename = 'products';
        break;

      case 'customers':
        data = await Customer.findAll({
          attributes: { exclude: ['address', 'phone'] },
          raw: true
        });
        filename = 'customers';
        break;

      default:
        return res.status(400).json({ success: false, error: 'Invalid export type' });
    }

    if (format === 'csv') {
      const headers = Object.keys(data[0] || {}).join(',');
      const rows = data.map(row => Object.values(row).map(v =>
        typeof v === 'string' && v.includes(',') ? `"${v}"` : v
      ).join(','));
      const csv = [headers, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}_${Date.now()}.csv`);
      return res.send(csv);
    }

    res.json({ success: true, data });
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
