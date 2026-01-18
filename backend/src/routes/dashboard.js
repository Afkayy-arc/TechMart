const express = require('express');
const router = express.Router();
const { Transaction, Customer, Product, Alert, Supplier } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

// GET /api/dashboard/overview - Summary statistics for last 24h
router.get('/overview', async (req, res) => {
  try {
    const now = new Date();
    const last24h = new Date(now - 24 * 60 * 60 * 1000);
    const last48h = new Date(now - 48 * 60 * 60 * 1000);

    // Current period stats (last 24h)
    const currentStats = await Transaction.findOne({
      attributes: [
        [fn('COUNT', col('id')), 'totalTransactions'],
        [fn('SUM', col('total_amount')), 'totalRevenue'],
        [fn('AVG', col('total_amount')), 'avgOrderValue']
      ],
      where: {
        timestamp: { [Op.gte]: last24h },
        status: 'completed'
      },
      raw: true
    });

    // Previous period stats (24-48h ago) for comparison
    const previousStats = await Transaction.findOne({
      attributes: [
        [fn('COUNT', col('id')), 'totalTransactions'],
        [fn('SUM', col('total_amount')), 'totalRevenue']
      ],
      where: {
        timestamp: { [Op.between]: [last48h, last24h] },
        status: 'completed'
      },
      raw: true
    });

    // Active customers (unique customers with transactions in last 24h)
    const activeCustomers = await Transaction.count({
      distinct: true,
      col: 'customer_id',
      where: {
        timestamp: { [Op.gte]: last24h }
      }
    });

    // Unread alerts count
    const alertsCount = await Alert.count({
      where: { is_read: false }
    });

    // Suspicious transactions count
    const suspiciousCount = await Transaction.count({
      where: {
        fraud_score: { [Op.gte]: 0.5 },
        timestamp: { [Op.gte]: last24h }
      }
    });

    // Low stock products count
    const lowStockCount = await Product.count({
      where: {
        stock_quantity: { [Op.lte]: 10 }
      }
    });

    // Calculate change percentages
    const revenueChange = previousStats.totalRevenue
      ? ((currentStats.totalRevenue - previousStats.totalRevenue) / previousStats.totalRevenue * 100).toFixed(1)
      : 0;

    const transactionChange = previousStats.totalTransactions
      ? ((currentStats.totalTransactions - previousStats.totalTransactions) / previousStats.totalTransactions * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        totalRevenue: parseFloat(currentStats.totalRevenue || 0).toFixed(2),
        totalTransactions: parseInt(currentStats.totalTransactions || 0),
        avgOrderValue: parseFloat(currentStats.avgOrderValue || 0).toFixed(2),
        activeCustomers,
        alertsCount,
        suspiciousCount,
        lowStockCount,
        revenueChange: parseFloat(revenueChange),
        transactionChange: parseFloat(transactionChange),
        period: '24h'
      }
    });
  } catch (error) {
    console.error('Dashboard overview error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/sales-by-category
router.get('/sales-by-category', async (req, res) => {
  try {
    const sales = await Transaction.findAll({
      attributes: [
        [fn('SUM', col('Transaction.total_amount')), 'totalSales'],
        [fn('COUNT', col('Transaction.id')), 'count']
      ],
      include: [{
        model: Product,
        attributes: ['category'],
        required: true
      }],
      where: { status: 'completed' },
      group: ['Product.category'],
      raw: true
    });

    const formatted = sales.map(s => ({
      category: s['Product.category'],
      totalSales: parseFloat(s.totalSales || 0),
      count: parseInt(s.count || 0)
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    console.error('Sales by category error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/recent-transactions
router.get('/recent-transactions', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const transactions = await Transaction.findAll({
      include: [
        { model: Customer, attributes: ['id', 'email', 'first_name', 'last_name', 'risk_score'] },
        { model: Product, attributes: ['id', 'name', 'category', 'price'] }
      ],
      order: [['timestamp', 'DESC']],
      limit
    });

    res.json({ success: true, data: transactions });
  } catch (error) {
    console.error('Recent transactions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/dashboard/top-products
router.get('/top-products', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const products = await Transaction.findAll({
      attributes: [
        'product_id',
        [fn('SUM', col('total_amount')), 'totalRevenue'],
        [fn('SUM', col('quantity')), 'totalQuantity'],
        [fn('COUNT', col('Transaction.id')), 'transactionCount']
      ],
      include: [{
        model: Product,
        attributes: ['id', 'name', 'category', 'price', 'stock_quantity']
      }],
      where: { status: 'completed' },
      group: ['product_id', 'Product.id'],
      order: [[fn('SUM', col('total_amount')), 'DESC']],
      limit,
      raw: true,
      nest: true
    });

    res.json({ success: true, data: products });
  } catch (error) {
    console.error('Top products error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
