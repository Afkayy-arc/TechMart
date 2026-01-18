const express = require('express');
const router = express.Router();
const { Product, Supplier, Transaction } = require('../models');
const { Op, fn, col } = require('sequelize');
const inventoryManagement = require('../services/inventoryManagement');

// GET /api/inventory - List all products with stock info
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { category, search, sortBy, sortOrder } = req.query;

    const where = {};
    if (category) where.category = category;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { sku: { [Op.like]: `%${search}%` } }
      ];
    }

    const order = sortBy
      ? [[sortBy, sortOrder === 'asc' ? 'ASC' : 'DESC']]
      : [['stock_quantity', 'ASC']];

    const { count, rows } = await Product.findAndCountAll({
      where,
      include: [{
        model: Supplier,
        attributes: ['id', 'name', 'reliability_score', 'average_delivery_days']
      }],
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
    console.error('Get inventory error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory/low-stock - Products below reorder threshold
router.get('/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 10;

    const products = await Product.findAll({
      where: {
        stock_quantity: { [Op.lte]: threshold }
      },
      include: [{
        model: Supplier,
        attributes: ['id', 'name', 'contact_email', 'reliability_score', 'average_delivery_days']
      }],
      order: [['stock_quantity', 'ASC']]
    });

    if (products.length === 0) {
      return res.json({
        success: true,
        data: [],
        summary: { total: 0, critical: 0, high: 0, medium: 0 }
      });
    }

    // Batch query: Get sales data for ALL products in one query
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const productIds = products.map(p => p.id);

    const salesDataBatch = await Transaction.findAll({
      attributes: [
        'product_id',
        [fn('SUM', col('quantity')), 'totalSold']
      ],
      where: {
        product_id: { [Op.in]: productIds },
        timestamp: { [Op.gte]: thirtyDaysAgo },
        status: 'completed'
      },
      group: ['product_id'],
      raw: true
    });

    // Create a map for O(1) lookup
    const salesMap = new Map();
    for (const sale of salesDataBatch) {
      salesMap.set(sale.product_id, parseInt(sale.totalSold || 0));
    }

    // Calculate reorder recommendations using batched data
    const recommendations = products.map((product) => {
      const totalSold = salesMap.get(product.id) || 0;
      const avgDailySales = totalSold / 30;
      const daysUntilStockout = product.stock_quantity > 0
        ? Math.floor(product.stock_quantity / (avgDailySales || 1))
        : 0;

      // Recommended order quantity (2 weeks supply)
      const recommendedOrder = Math.ceil(avgDailySales * 14);

      return {
        product: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          category: product.category,
          currentStock: product.stock_quantity,
          price: product.price
        },
        supplier: product.Supplier,
        analytics: {
          avgDailySales: avgDailySales.toFixed(2),
          totalSold30Days: totalSold,
          daysUntilStockout,
          recommendedOrder
        },
        urgency: daysUntilStockout <= 3 ? 'critical' : daysUntilStockout <= 7 ? 'high' : 'medium'
      };
    });

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2 };
    recommendations.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    res.json({
      success: true,
      data: recommendations,
      summary: {
        total: recommendations.length,
        critical: recommendations.filter(r => r.urgency === 'critical').length,
        high: recommendations.filter(r => r.urgency === 'high').length,
        medium: recommendations.filter(r => r.urgency === 'medium').length
      }
    });
  } catch (error) {
    console.error('Low stock error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory/categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await Product.findAll({
      attributes: [
        'category',
        [fn('COUNT', col('id')), 'productCount'],
        [fn('SUM', col('stock_quantity')), 'totalStock'],
        [fn('AVG', col('price')), 'avgPrice']
      ],
      group: ['category'],
      raw: true
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === CHALLENGE B: Advanced Inventory Management ===

// GET /api/inventory/reorder-suggestions - Get automated reorder suggestions
router.get('/reorder-suggestions', async (req, res) => {
  try {
    const suggestions = await inventoryManagement.generateReorderSuggestions();
    res.json({ success: true, data: suggestions });
  } catch (error) {
    console.error('Reorder suggestions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory/predict/:id - Predict future stock levels
router.get('/predict/:id', async (req, res) => {
  try {
    const daysAhead = parseInt(req.query.days) || 14;
    const prediction = await inventoryManagement.predictStockLevels(req.params.id, daysAhead);

    if (!prediction) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: prediction });
  } catch (error) {
    console.error('Predict stock error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory/optimize-supplier/:id - Find optimal supplier for reordering
router.get('/optimize-supplier/:id', async (req, res) => {
  try {
    const quantity = parseInt(req.query.quantity) || 100;
    const optimization = await inventoryManagement.optimizeSupplier(req.params.id, quantity);

    if (!optimization) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: optimization });
  } catch (error) {
    console.error('Optimize supplier error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory/seasonal/:id - Analyze seasonal patterns
router.get('/seasonal/:id', async (req, res) => {
  try {
    const patterns = await inventoryManagement.analyzeSeasonalPatterns(req.params.id);

    if (!patterns) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: patterns });
  } catch (error) {
    console.error('Seasonal patterns error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/inventory/:id - Must be LAST (catches all numeric IDs)
router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id, {
      include: [Supplier]
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
