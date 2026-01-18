const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { Alert, Transaction, Customer, Product } = require('../models');
const { Op } = require('sequelize');

// GET /api/alerts - List all alerts
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const { type, severity, resolved, unreadOnly } = req.query;

    const where = {};
    if (type) where.type = type;
    if (severity) where.severity = severity;
    if (resolved !== undefined) where.resolved = resolved === 'true';
    if (unreadOnly === 'true') where.is_read = false;

    const { count, rows } = await Alert.findAndCountAll({
      where,
      include: [
        { model: Transaction, attributes: ['id', 'total_amount', 'status', 'timestamp'] },
        { model: Customer, attributes: ['id', 'email', 'first_name', 'last_name'] },
        { model: Product, attributes: ['id', 'name', 'category'] }
      ],
      order: [['created_at', 'DESC']],
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
    console.error('Get alerts error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/alerts - Create custom business alert
router.post('/', [
  body('type').isIn(['fraud', 'low_stock', 'high_value', 'unusual_activity', 'custom'])
    .withMessage('Invalid alert type'),
  body('severity').isIn(['low', 'medium', 'high', 'critical'])
    .withMessage('Invalid severity level'),
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { type, severity, title, message, transaction_id, customer_id, product_id, metadata } = req.body;

    const alert = await Alert.create({
      type,
      severity,
      title,
      message,
      transaction_id,
      customer_id,
      product_id,
      metadata: JSON.stringify(metadata || {})
    });

    res.status(201).json({ success: true, data: alert });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/alerts/:id/read - Mark alert as read
router.put('/:id/read', async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    await alert.update({ is_read: true });
    res.json({ success: true, data: alert });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/alerts/:id/resolve - Mark alert as resolved
router.put('/:id/resolve', async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    await alert.update({ resolved: true, is_read: true });
    res.json({ success: true, data: alert });
  } catch (error) {
    console.error('Resolve alert error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /api/alerts/mark-all-read - Mark all alerts as read
router.put('/mark-all-read', async (req, res) => {
  try {
    await Alert.update({ is_read: true }, { where: { is_read: false } });
    res.json({ success: true, message: 'All alerts marked as read' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/alerts/summary - Get alerts summary
router.get('/summary', async (req, res) => {
  try {
    const [unread, bySeverity, byType] = await Promise.all([
      Alert.count({ where: { is_read: false } }),
      Alert.findAll({
        attributes: ['severity', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
        where: { resolved: false },
        group: ['severity'],
        raw: true
      }),
      Alert.findAll({
        attributes: ['type', [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']],
        where: { resolved: false },
        group: ['type'],
        raw: true
      })
    ]);

    res.json({
      success: true,
      data: {
        unreadCount: unread,
        bySeverity: bySeverity.reduce((acc, s) => ({ ...acc, [s.severity]: parseInt(s.count) }), {}),
        byType: byType.reduce((acc, t) => ({ ...acc, [t.type]: parseInt(t.count) }), {})
      }
    });
  } catch (error) {
    console.error('Alerts summary error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res) => {
  try {
    const alert = await Alert.findByPk(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, error: 'Alert not found' });
    }

    await alert.destroy();
    res.json({ success: true, message: 'Alert deleted' });
  } catch (error) {
    console.error('Delete alert error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
