const express = require('express');
const router = express.Router();
const { Customer, Transaction, Product } = require('../models');
const { Op, fn, col } = require('sequelize');
const customerAnalytics = require('../services/customerAnalytics');

// === CHALLENGE C: Customer Behavior Analytics ===

// GET /api/customers - List all customers
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { search, tier, sortBy, sortOrder } = req.query;

    const where = {};
    if (tier) where.loyalty_tier = tier;
    if (search) {
      where[Op.or] = [
        { first_name: { [Op.like]: `%${search}%` } },
        { last_name: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } }
      ];
    }

    const order = sortBy
      ? [[sortBy, sortOrder === 'asc' ? 'ASC' : 'DESC']]
      : [['created_at', 'DESC']];

    const { count, rows } = await Customer.findAndCountAll({
      where,
      order,
      limit,
      offset
    });

    res.json({
      success: true,
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/rfm-analysis - RFM Segmentation Analysis
router.get('/rfm-analysis', async (req, res) => {
  try {
    const rfmData = await customerAnalytics.performRFMAnalysis();
    res.json({ success: true, data: rfmData });
  } catch (error) {
    console.error('RFM analysis error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/churn-risk - Identify at-risk customers
router.get('/churn-risk', async (req, res) => {
  try {
    const churnData = await customerAnalytics.identifyChurnRisk();
    res.json({ success: true, data: churnData });
  } catch (error) {
    console.error('Churn risk error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/tiers - Customer tier breakdown
router.get('/tiers', async (req, res) => {
  try {
    const tiers = await Customer.findAll({
      attributes: [
        'loyalty_tier',
        [fn('COUNT', col('id')), 'customerCount']
      ],
      group: ['loyalty_tier'],
      raw: true
    });

    // Calculate tier statistics
    const tierStats = await Promise.all(tiers.map(async (tier) => {
      const customers = await Customer.findAll({
        where: { loyalty_tier: tier.loyalty_tier },
        include: [{
          model: Transaction,
          where: { status: 'completed' },
          required: false
        }]
      });

      let totalRevenue = 0;
      let totalTransactions = 0;

      customers.forEach(c => {
        const transactions = c.Transactions || [];
        totalTransactions += transactions.length;
        totalRevenue += transactions.reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
      });

      return {
        tier: tier.loyalty_tier,
        customerCount: parseInt(tier.customerCount),
        totalRevenue: totalRevenue.toFixed(2),
        totalTransactions,
        avgRevenuePerCustomer: (totalRevenue / parseInt(tier.customerCount)).toFixed(2)
      };
    }));

    res.json({ success: true, data: tierStats });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/:id - Get customer details
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [{
        model: Transaction,
        include: [{ model: Product, attributes: ['id', 'name', 'category'] }],
        order: [['timestamp', 'DESC']],
        limit: 20
      }]
    });

    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/:id/recommendations - Product recommendations
router.get('/:id/recommendations', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recommendations = await customerAnalytics.getRecommendations(req.params.id, limit);

    if (!recommendations) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: recommendations });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/customers/:id/clv - Customer Lifetime Value prediction
router.get('/:id/clv', async (req, res) => {
  try {
    const clvData = await customerAnalytics.predictCustomerLifetimeValue(req.params.id);

    if (!clvData) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    res.json({ success: true, data: clvData });
  } catch (error) {
    console.error('CLV prediction error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
