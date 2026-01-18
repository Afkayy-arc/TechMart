const { Customer, Transaction, Product } = require('../models');
const { Op, fn, col, literal } = require('sequelize');

class CustomerAnalyticsService {

  // RFM Analysis - Recency, Frequency, Monetary
  async performRFMAnalysis() {
    const customers = await Customer.findAll({
      include: [{
        model: Transaction,
        where: { status: 'completed' },
        required: false
      }]
    });

    const now = new Date();
    const rfmData = [];

    for (const customer of customers) {
      const transactions = customer.Transactions || [];

      if (transactions.length === 0) {
        rfmData.push({
          customerId: customer.id,
          email: customer.email,
          name: `${customer.first_name} ${customer.last_name}`,
          recency: null,
          frequency: 0,
          monetary: 0,
          rfmScore: '111',
          segment: 'Lost'
        });
        continue;
      }

      // Recency: Days since last purchase
      const lastPurchase = transactions.reduce((latest, t) =>
        new Date(t.timestamp) > new Date(latest.timestamp) ? t : latest
      );
      const recencyDays = Math.floor((now - new Date(lastPurchase.timestamp)) / (1000 * 60 * 60 * 24));

      // Frequency: Number of transactions
      const frequency = transactions.length;

      // Monetary: Total spent
      const monetary = transactions.reduce((sum, t) => sum + parseFloat(t.total_amount), 0);

      rfmData.push({
        customerId: customer.id,
        email: customer.email,
        name: `${customer.first_name} ${customer.last_name}`,
        loyaltyTier: customer.loyalty_tier,
        recencyDays,
        frequency,
        monetary: monetary.toFixed(2)
      });
    }

    // Calculate RFM scores (1-5 scale, 5 being best)
    const recencyValues = rfmData.filter(r => r.recencyDays !== null).map(r => r.recencyDays);
    const frequencyValues = rfmData.map(r => r.frequency);
    const monetaryValues = rfmData.map(r => parseFloat(r.monetary));

    const getPercentile = (arr, val, inverse = false) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const index = sorted.findIndex(v => v >= val);
      const percentile = (index / sorted.length) * 100;
      return inverse ? 100 - percentile : percentile;
    };

    const getScore = (percentile) => {
      if (percentile >= 80) return 5;
      if (percentile >= 60) return 4;
      if (percentile >= 40) return 3;
      if (percentile >= 20) return 2;
      return 1;
    };

    // Assign scores and segments
    for (const customer of rfmData) {
      if (customer.recencyDays === null) continue;

      const rScore = getScore(getPercentile(recencyValues, customer.recencyDays, true)); // Lower is better
      const fScore = getScore(getPercentile(frequencyValues, customer.frequency));
      const mScore = getScore(getPercentile(monetaryValues, parseFloat(customer.monetary)));

      customer.rfmScores = { r: rScore, f: fScore, m: mScore };
      customer.rfmScore = `${rScore}${fScore}${mScore}`;
      customer.totalScore = rScore + fScore + mScore;

      // Assign segment based on RFM scores
      customer.segment = this.assignSegment(rScore, fScore, mScore);
    }

    // Group by segments
    const segments = {};
    for (const customer of rfmData) {
      if (!segments[customer.segment]) {
        segments[customer.segment] = { count: 0, customers: [] };
      }
      segments[customer.segment].count++;
      segments[customer.segment].customers.push(customer);
    }

    return {
      totalCustomers: rfmData.length,
      segments,
      topCustomers: rfmData
        .filter(c => c.totalScore)
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 20)
    };
  }

  assignSegment(r, f, m) {
    const avg = (r + f + m) / 3;

    if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
    if (r >= 4 && f >= 3 && m >= 3) return 'Loyal Customers';
    if (r >= 4 && f <= 2) return 'New Customers';
    if (r >= 3 && f >= 3 && m >= 3) return 'Potential Loyalists';
    if (r <= 2 && f >= 4 && m >= 4) return 'At Risk';
    if (r <= 2 && f >= 2 && m >= 2) return 'Need Attention';
    if (r <= 2 && f <= 2 && m <= 2) return 'Lost';
    if (m >= 4) return 'Big Spenders';
    return 'Others';
  }

  // Product recommendations based on purchase history
  async getRecommendations(customerId, limit = 10) {
    const customer = await Customer.findByPk(customerId);
    if (!customer) return null;

    // Get customer's purchase history
    const customerTransactions = await Transaction.findAll({
      where: { customer_id: customerId, status: 'completed' },
      include: [{ model: Product, attributes: ['id', 'category'] }]
    });

    const purchasedProductIds = customerTransactions.map(t => t.product_id);
    const purchasedCategories = [...new Set(customerTransactions.map(t => t.Product?.category).filter(Boolean))];

    if (purchasedCategories.length === 0) {
      // New customer - recommend best sellers
      const bestSellers = await this.getBestSellers(limit);
      return {
        customer: { id: customer.id, name: `${customer.first_name} ${customer.last_name}` },
        strategy: 'best_sellers',
        reason: 'New customer with no purchase history',
        recommendations: bestSellers
      };
    }

    // Collaborative filtering: Find similar customers
    const similarCustomers = await Transaction.findAll({
      attributes: ['customer_id'],
      where: {
        product_id: { [Op.in]: purchasedProductIds },
        customer_id: { [Op.ne]: customerId },
        status: 'completed'
      },
      group: ['customer_id'],
      having: literal('COUNT(DISTINCT product_id) >= 2'),
      raw: true
    });

    const similarCustomerIds = similarCustomers.map(c => c.customer_id);

    // Get products bought by similar customers but not by this customer
    const recommendedProducts = await Transaction.findAll({
      attributes: [
        'product_id',
        [fn('COUNT', col('Transaction.id')), 'purchaseCount']
      ],
      where: {
        customer_id: { [Op.in]: similarCustomerIds },
        product_id: { [Op.notIn]: purchasedProductIds },
        status: 'completed'
      },
      include: [{
        model: Product,
        attributes: ['id', 'name', 'category', 'price'],
        where: {
          stock_quantity: { [Op.gt]: 0 } // Only in-stock items
        }
      }],
      group: ['product_id'],
      order: [[fn('COUNT', col('Transaction.id')), 'DESC']],
      limit,
      raw: true,
      nest: true
    });

    // Also add category-based recommendations
    const categoryRecommendations = await Product.findAll({
      where: {
        category: { [Op.in]: purchasedCategories },
        id: { [Op.notIn]: purchasedProductIds },
        stock_quantity: { [Op.gt]: 0 }
      },
      order: [['price', 'DESC']],
      limit: 5
    });

    return {
      customer: {
        id: customer.id,
        name: `${customer.first_name} ${customer.last_name}`,
        purchaseCount: customerTransactions.length,
        favoriteCategories: purchasedCategories
      },
      strategy: 'collaborative_filtering',
      collaborativeRecommendations: recommendedProducts.map(p => ({
        product: p.Product,
        score: parseInt(p.purchaseCount),
        reason: 'Bought by similar customers'
      })),
      categoryRecommendations: categoryRecommendations.map(p => ({
        product: { id: p.id, name: p.name, category: p.category, price: p.price },
        reason: `Based on your interest in ${p.category}`
      }))
    };
  }

  async getBestSellers(limit = 10) {
    const bestSellers = await Transaction.findAll({
      attributes: [
        'product_id',
        [fn('SUM', col('quantity')), 'totalSold'],
        [fn('COUNT', col('Transaction.id')), 'orderCount']
      ],
      where: { status: 'completed' },
      include: [{
        model: Product,
        attributes: ['id', 'name', 'category', 'price'],
        where: { stock_quantity: { [Op.gt]: 0 } }
      }],
      group: ['product_id'],
      order: [[fn('SUM', col('quantity')), 'DESC']],
      limit,
      raw: true,
      nest: true
    });

    return bestSellers.map(b => ({
      product: b.Product,
      totalSold: parseInt(b.totalSold),
      orderCount: parseInt(b.orderCount)
    }));
  }

  // Customer Lifetime Value prediction
  async predictCustomerLifetimeValue(customerId) {
    const customer = await Customer.findByPk(customerId);
    if (!customer) return null;

    const transactions = await Transaction.findAll({
      where: { customer_id: customerId, status: 'completed' },
      order: [['timestamp', 'ASC']]
    });

    if (transactions.length === 0) {
      return {
        customer: { id: customer.id, name: `${customer.first_name} ${customer.last_name}` },
        clv: 0,
        predictedClv: 0,
        confidence: 'low'
      };
    }

    // Calculate metrics
    const totalRevenue = transactions.reduce((sum, t) => sum + parseFloat(t.total_amount), 0);
    const avgOrderValue = totalRevenue / transactions.length;

    // Calculate purchase frequency (orders per month)
    const firstPurchase = new Date(transactions[0].timestamp);
    const lastPurchase = new Date(transactions[transactions.length - 1].timestamp);
    const monthsActive = Math.max(1, (lastPurchase - firstPurchase) / (1000 * 60 * 60 * 24 * 30));
    const purchaseFrequency = transactions.length / monthsActive;

    // Estimate customer lifespan (in months)
    const avgCustomerLifespan = 24; // Assume 2 years average

    // Simple CLV formula: AOV * Purchase Frequency * Customer Lifespan
    const predictedClv = avgOrderValue * purchaseFrequency * avgCustomerLifespan;

    // Confidence based on transaction history
    const confidence = transactions.length >= 10 ? 'high'
      : transactions.length >= 5 ? 'medium' : 'low';

    return {
      customer: {
        id: customer.id,
        name: `${customer.first_name} ${customer.last_name}`,
        loyaltyTier: customer.loyalty_tier
      },
      metrics: {
        totalRevenue: totalRevenue.toFixed(2),
        transactionCount: transactions.length,
        avgOrderValue: avgOrderValue.toFixed(2),
        purchaseFrequency: purchaseFrequency.toFixed(2),
        monthsActive: monthsActive.toFixed(1)
      },
      clv: totalRevenue.toFixed(2),
      predictedClv: predictedClv.toFixed(2),
      confidence
    };
  }

  // Churn risk identification
  async identifyChurnRisk() {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    // Get all customers with their last transaction
    const customers = await Customer.findAll({
      include: [{
        model: Transaction,
        where: { status: 'completed' },
        required: false,
        order: [['timestamp', 'DESC']]
      }]
    });

    const churnRisk = [];

    for (const customer of customers) {
      const transactions = customer.Transactions || [];
      if (transactions.length === 0) continue;

      // Find last transaction
      const lastTransaction = transactions.reduce((latest, t) =>
        new Date(t.timestamp) > new Date(latest.timestamp) ? t : latest
      );
      const lastPurchaseDate = new Date(lastTransaction.timestamp);
      const daysSinceLastPurchase = Math.floor((Date.now() - lastPurchaseDate) / (1000 * 60 * 60 * 24));

      // Calculate average purchase frequency
      if (transactions.length < 2) continue;

      const firstPurchase = transactions.reduce((earliest, t) =>
        new Date(t.timestamp) < new Date(earliest.timestamp) ? t : earliest
      );
      const avgDaysBetweenPurchases = Math.floor(
        (lastPurchaseDate - new Date(firstPurchase.timestamp)) / (1000 * 60 * 60 * 24 * (transactions.length - 1))
      );

      // Calculate churn probability
      let churnProbability = 0;
      let riskLevel = 'low';

      if (daysSinceLastPurchase > avgDaysBetweenPurchases * 3) {
        churnProbability = 0.9;
        riskLevel = 'critical';
      } else if (daysSinceLastPurchase > avgDaysBetweenPurchases * 2) {
        churnProbability = 0.7;
        riskLevel = 'high';
      } else if (daysSinceLastPurchase > avgDaysBetweenPurchases * 1.5) {
        churnProbability = 0.4;
        riskLevel = 'medium';
      }

      if (churnProbability >= 0.4) {
        const totalSpent = transactions.reduce((sum, t) => sum + parseFloat(t.total_amount), 0);

        churnRisk.push({
          customer: {
            id: customer.id,
            email: customer.email,
            name: `${customer.first_name} ${customer.last_name}`,
            loyaltyTier: customer.loyalty_tier
          },
          metrics: {
            totalSpent: totalSpent.toFixed(2),
            transactionCount: transactions.length,
            daysSinceLastPurchase,
            avgDaysBetweenPurchases: avgDaysBetweenPurchases || 0
          },
          churnProbability: (churnProbability * 100).toFixed(0) + '%',
          riskLevel,
          suggestedAction: this.getSuggestedAction(riskLevel, customer.loyalty_tier)
        });
      }
    }

    // Sort by risk level
    const riskOrder = { critical: 0, high: 1, medium: 2 };
    churnRisk.sort((a, b) => riskOrder[a.riskLevel] - riskOrder[b.riskLevel]);

    return {
      totalAtRisk: churnRisk.length,
      criticalCount: churnRisk.filter(c => c.riskLevel === 'critical').length,
      highCount: churnRisk.filter(c => c.riskLevel === 'high').length,
      mediumCount: churnRisk.filter(c => c.riskLevel === 'medium').length,
      customers: churnRisk
    };
  }

  getSuggestedAction(riskLevel, loyaltyTier) {
    if (riskLevel === 'critical') {
      if (loyaltyTier === 'platinum' || loyaltyTier === 'gold') {
        return 'Personal outreach with exclusive VIP offer';
      }
      return 'Send win-back email with 20% discount';
    }
    if (riskLevel === 'high') {
      return 'Send re-engagement email with personalized recommendations';
    }
    return 'Include in next promotional campaign';
  }
}

module.exports = new CustomerAnalyticsService();
