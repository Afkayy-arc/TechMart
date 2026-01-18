const { Product, Transaction, Supplier, Alert } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

class InventoryManagementService {
  constructor() {
    this.REORDER_LEAD_DAYS = 7; // Days to account for delivery
    this.SAFETY_STOCK_DAYS = 3; // Buffer stock days
  }

  // Predict future stock levels based on sales trends
  async predictStockLevels(productId, daysAhead = 14) {
    const product = await Product.findByPk(productId, { include: [Supplier] });
    if (!product) return null;

    // Get sales data for last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const salesData = await Transaction.findAll({
      attributes: [
        [fn('DATE', col('timestamp')), 'date'],
        [fn('SUM', col('quantity')), 'quantity']
      ],
      where: {
        product_id: productId,
        timestamp: { [Op.gte]: thirtyDaysAgo },
        status: 'completed'
      },
      group: [fn('DATE', col('timestamp'))],
      order: [[fn('DATE', col('timestamp')), 'ASC']],
      raw: true
    });

    // Calculate daily average and trend
    const dailySales = salesData.map(d => parseInt(d.quantity) || 0);
    const avgDailySales = dailySales.length > 0
      ? dailySales.reduce((a, b) => a + b, 0) / dailySales.length
      : 0;

    // Simple linear trend calculation
    let trend = 0;
    if (dailySales.length >= 7) {
      const firstWeekAvg = dailySales.slice(0, 7).reduce((a, b) => a + b, 0) / 7;
      const lastWeekAvg = dailySales.slice(-7).reduce((a, b) => a + b, 0) / 7;
      trend = (lastWeekAvg - firstWeekAvg) / firstWeekAvg; // Percentage change
    }

    // Predict future stock levels
    const predictions = [];
    let currentStock = product.stock_quantity;

    for (let day = 1; day <= daysAhead; day++) {
      const predictedSales = Math.max(0, avgDailySales * (1 + trend * (day / 30)));
      currentStock = Math.max(0, currentStock - predictedSales);

      predictions.push({
        day,
        date: new Date(Date.now() + day * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        predictedStock: Math.round(currentStock),
        predictedSales: Math.round(predictedSales),
        stockoutRisk: currentStock <= 0 ? 'critical' : currentStock <= 10 ? 'high' : 'low'
      });
    }

    // Calculate days until stockout
    const stockoutDay = predictions.find(p => p.predictedStock <= 0);
    const daysUntilStockout = stockoutDay ? stockoutDay.day : null;

    return {
      product: {
        id: product.id,
        name: product.name,
        currentStock: product.stock_quantity,
        price: product.price
      },
      analytics: {
        avgDailySales: avgDailySales.toFixed(2),
        salesTrend: (trend * 100).toFixed(1) + '%',
        trendDirection: trend > 0.05 ? 'increasing' : trend < -0.05 ? 'decreasing' : 'stable',
        daysUntilStockout
      },
      predictions,
      supplier: product.Supplier
    };
  }

  // Find optimal supplier for reordering
  async optimizeSupplier(productId, quantity) {
    const product = await Product.findByPk(productId);
    if (!product) return null;

    // Get all suppliers (in real scenario, would filter by product category)
    const suppliers = await Supplier.findAll({
      where: {
        reliability_score: { [Op.gte]: 0.7 } // Only reliable suppliers
      },
      order: [['reliability_score', 'DESC']]
    });

    // Score each supplier
    const supplierScores = suppliers.map(supplier => {
      // Weighted scoring: reliability (40%), delivery time (30%), cost efficiency (30%)
      const reliabilityScore = supplier.reliability_score * 40;
      const deliveryScore = (1 - Math.min(supplier.average_delivery_days, 14) / 14) * 30;

      // Simulate cost efficiency based on payment terms
      let costScore = 20;
      if (supplier.payment_terms === 'Net 60') costScore = 30;
      else if (supplier.payment_terms === 'Net 45') costScore = 25;
      else if (supplier.payment_terms === 'Net 30') costScore = 20;
      else if (supplier.payment_terms === 'Prepaid') costScore = 10;

      const totalScore = reliabilityScore + deliveryScore + costScore;

      return {
        supplier: {
          id: supplier.id,
          name: supplier.name,
          email: supplier.contact_email,
          country: supplier.country,
          reliabilityScore: supplier.reliability_score,
          avgDeliveryDays: supplier.average_delivery_days,
          paymentTerms: supplier.payment_terms,
          certification: supplier.certification
        },
        scores: {
          reliability: reliabilityScore.toFixed(1),
          delivery: deliveryScore.toFixed(1),
          cost: costScore.toFixed(1),
          total: totalScore.toFixed(1)
        }
      };
    });

    // Sort by total score
    supplierScores.sort((a, b) => parseFloat(b.scores.total) - parseFloat(a.scores.total));

    return {
      product: { id: product.id, name: product.name },
      quantity,
      recommendations: supplierScores.slice(0, 5),
      bestSupplier: supplierScores[0]
    };
  }

  // Generate automated reorder suggestions
  async generateReorderSuggestions() {
    const products = await Product.findAll({
      include: [Supplier],
      where: {
        stock_quantity: { [Op.lte]: 50 } // Focus on lower stock items
      }
    });

    if (products.length === 0) {
      return {
        totalSuggestions: 0,
        criticalCount: 0,
        highCount: 0,
        suggestions: []
      };
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

    const suggestions = [];

    for (const product of products) {
      const totalSold = salesMap.get(product.id) || 0;
      const avgDailySales = totalSold / 30;

      // Calculate reorder point and quantity
      const leadTime = product.Supplier?.average_delivery_days || 7;
      const reorderPoint = Math.ceil(avgDailySales * (leadTime + this.SAFETY_STOCK_DAYS));
      const recommendedQuantity = Math.ceil(avgDailySales * 30); // 30 days supply

      if (product.stock_quantity <= reorderPoint) {
        const urgency = product.stock_quantity === 0 ? 'critical'
          : product.stock_quantity <= avgDailySales * 3 ? 'high'
          : 'medium';

        suggestions.push({
          product: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            currentStock: product.stock_quantity,
            price: product.price
          },
          reorderAnalysis: {
            avgDailySales: avgDailySales.toFixed(2),
            reorderPoint,
            recommendedQuantity,
            estimatedCost: (recommendedQuantity * parseFloat(product.price) * 0.6).toFixed(2), // 60% wholesale estimate
            daysUntilStockout: avgDailySales > 0 ? Math.floor(product.stock_quantity / avgDailySales) : null
          },
          supplier: product.Supplier ? {
            id: product.Supplier.id,
            name: product.Supplier.name,
            leadTime: product.Supplier.average_delivery_days
          } : null,
          urgency
        });
      }
    }

    // Sort by urgency
    const urgencyOrder = { critical: 0, high: 1, medium: 2 };
    suggestions.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

    return {
      totalSuggestions: suggestions.length,
      criticalCount: suggestions.filter(s => s.urgency === 'critical').length,
      highCount: suggestions.filter(s => s.urgency === 'high').length,
      suggestions
    };
  }

  // Detect seasonal demand patterns
  async analyzeSeasonalPatterns(productId) {
    const product = await Product.findByPk(productId);
    if (!product) return null;

    // Get all historical sales grouped by day of week and hour
    const salesByDayOfWeek = await Transaction.findAll({
      attributes: [
        [fn('strftime', '%w', col('timestamp')), 'dayOfWeek'],
        [fn('SUM', col('quantity')), 'totalQuantity'],
        [fn('COUNT', col('id')), 'transactionCount']
      ],
      where: {
        product_id: productId,
        status: 'completed'
      },
      group: [fn('strftime', '%w', col('timestamp'))],
      raw: true
    });

    const salesByHour = await Transaction.findAll({
      attributes: [
        [fn('strftime', '%H', col('timestamp')), 'hour'],
        [fn('SUM', col('quantity')), 'totalQuantity'],
        [fn('COUNT', col('id')), 'transactionCount']
      ],
      where: {
        product_id: productId,
        status: 'completed'
      },
      group: [fn('strftime', '%H', col('timestamp'))],
      raw: true
    });

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const weeklyPattern = dayNames.map((name, index) => {
      const data = salesByDayOfWeek.find(d => parseInt(d.dayOfWeek) === index);
      return {
        day: name,
        dayIndex: index,
        totalQuantity: parseInt(data?.totalQuantity || 0),
        transactionCount: parseInt(data?.transactionCount || 0)
      };
    });

    const hourlyPattern = Array.from({ length: 24 }, (_, hour) => {
      const data = salesByHour.find(h => parseInt(h.hour) === hour);
      return {
        hour,
        label: `${hour.toString().padStart(2, '0')}:00`,
        totalQuantity: parseInt(data?.totalQuantity || 0),
        transactionCount: parseInt(data?.transactionCount || 0)
      };
    });

    // Find peak times
    const peakDay = weeklyPattern.reduce((max, d) => d.totalQuantity > max.totalQuantity ? d : max, weeklyPattern[0]);
    const peakHour = hourlyPattern.reduce((max, h) => h.totalQuantity > max.totalQuantity ? h : max, hourlyPattern[0]);

    return {
      product: { id: product.id, name: product.name },
      weeklyPattern,
      hourlyPattern,
      insights: {
        peakDay: peakDay.day,
        peakHour: peakHour.label,
        recommendation: `Consider increasing stock before ${peakDay.day}s and ensuring availability during ${peakHour.label} hours.`
      }
    };
  }
}

module.exports = new InventoryManagementService();
