const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Transaction, Customer, Product, Alert } = require('../models');
const { Op } = require('sequelize');
const fraudDetection = require('../services/fraudDetection');

// Validation middleware
const transactionValidation = [
  body('customer_id').isInt().withMessage('Valid customer ID required'),
  body('product_id').isInt().withMessage('Valid product ID required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('payment_method').isIn(['credit_card', 'paypal', 'google_pay', 'apple_pay', 'bank_transfer'])
    .withMessage('Invalid payment method')
];

// GET /api/transactions - List all transactions with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { status, startDate, endDate, category, search } = req.query;

    // Build where clause
    const where = {};
    if (status) where.status = status;
    if (startDate && endDate) {
      where.timestamp = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }

    // Include filters
    const includeProduct = {
      model: Product,
      attributes: ['id', 'name', 'category', 'price']
    };
    if (category) {
      includeProduct.where = { category };
    }

    const { count, rows } = await Transaction.findAndCountAll({
      where,
      include: [
        { model: Customer, attributes: ['id', 'email', 'first_name', 'last_name', 'risk_score'] },
        includeProduct
      ],
      order: [['timestamp', 'DESC']],
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
    console.error('Get transactions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/transactions - Create new transaction with validation
router.post('/', transactionValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { customer_id, product_id, quantity, payment_method, ip_address, user_agent, session_id } = req.body;

    // Validate customer exists
    const customer = await Customer.findByPk(customer_id);
    if (!customer) {
      return res.status(404).json({ success: false, error: 'Customer not found' });
    }

    // Validate product exists and has stock
    const product = await Product.findByPk(product_id);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    if (product.stock_quantity < quantity) {
      return res.status(400).json({
        success: false,
        error: `Insufficient stock. Available: ${product.stock_quantity}`
      });
    }

    // Calculate amounts
    const unit_price = parseFloat(product.price);
    const subtotal = unit_price * quantity;
    const tax_amount = subtotal * 0.08; // 8% tax
    const total_amount = subtotal + tax_amount;

    // Validate amount is reasonable ($0.01 - $10,000)
    if (total_amount < 0.01 || total_amount > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Transaction amount must be between $0.01 and $10,000'
      });
    }

    // Create transaction
    const transaction = await Transaction.create({
      customer_id,
      product_id,
      quantity,
      unit_price,
      total_amount,
      tax_amount,
      status: 'completed',
      payment_method,
      ip_address: ip_address || req.ip,
      user_agent: user_agent || req.get('User-Agent'),
      session_id,
      timestamp: new Date()
    });

    // Run fraud detection
    const fraudAnalysis = await fraudDetection.analyzeTransaction(transaction, customer);

    // Update transaction with fraud score
    await transaction.update({
      fraud_score: fraudAnalysis.fraudScore,
      fraud_flags: JSON.stringify(fraudAnalysis.flags)
    });

    // Create alert if suspicious
    if (fraudAnalysis.isSuspicious) {
      await fraudDetection.createFraudAlert(transaction, fraudAnalysis);
    }

    // Update stock
    await product.update({
      stock_quantity: product.stock_quantity - quantity
    });

    // Update customer total spent
    await customer.update({
      total_spent: parseFloat(customer.total_spent) + total_amount
    });

    // Reload with associations
    await transaction.reload({
      include: [Customer, Product]
    });

    res.status(201).json({
      success: true,
      data: transaction,
      fraudAnalysis: {
        score: fraudAnalysis.fraudScore,
        isSuspicious: fraudAnalysis.isSuspicious,
        severity: fraudAnalysis.severity
      }
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/transactions/suspicious - Detect potentially fraudulent transactions
router.get('/suspicious', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const minScore = parseFloat(req.query.minScore) || 0.5;

    const transactions = await Transaction.findAll({
      where: {
        fraud_score: { [Op.gte]: minScore }
      },
      include: [
        { model: Customer, attributes: ['id', 'email', 'first_name', 'last_name', 'risk_score'] },
        { model: Product, attributes: ['id', 'name', 'category'] }
      ],
      order: [['fraud_score', 'DESC'], ['timestamp', 'DESC']],
      limit
    });

    // Group by severity
    const bySeverity = {
      critical: transactions.filter(t => t.fraud_score >= 0.8),
      high: transactions.filter(t => t.fraud_score >= 0.6 && t.fraud_score < 0.8),
      medium: transactions.filter(t => t.fraud_score >= 0.4 && t.fraud_score < 0.6)
    };

    res.json({
      success: true,
      data: transactions,
      summary: {
        total: transactions.length,
        critical: bySeverity.critical.length,
        high: bySeverity.high.length,
        medium: bySeverity.medium.length
      }
    });
  } catch (error) {
    console.error('Get suspicious transactions error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/transactions/:id
router.get('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findByPk(req.params.id, {
      include: [
        { model: Customer },
        { model: Product }
      ]
    });

    if (!transaction) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    res.json({ success: true, data: transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
