const { Transaction, Customer, Alert } = require('../models');
const { Op } = require('sequelize');

class FraudDetectionService {
  constructor(wsServer = null) {
    this.wsServer = wsServer;
    this.THRESHOLDS = {
      HIGH_AMOUNT: 5000,
      VELOCITY_WINDOW_MINUTES: 10,
      VELOCITY_MAX_TRANSACTIONS: 5,
      AMOUNT_DEVIATION_MULTIPLIER: 3,
      SUSPICIOUS_HOURS_START: 2,
      SUSPICIOUS_HOURS_END: 5,
      MAX_VALID_AMOUNT: 10000,
      MIN_VALID_AMOUNT: 0.01
    };
  }

  // Main fraud scoring function
  async analyzeTransaction(transaction, customer) {
    const flags = [];
    let fraudScore = 0;

    // 1. Amount validation
    const amountCheck = this.checkAmountAnomaly(transaction, customer);
    if (amountCheck.suspicious) {
      flags.push(amountCheck);
      fraudScore += amountCheck.score;
    }

    // 2. Velocity check (rapid purchases)
    const velocityCheck = await this.checkVelocity(transaction.customer_id);
    if (velocityCheck.suspicious) {
      flags.push(velocityCheck);
      fraudScore += velocityCheck.score;
    }

    // 3. Time pattern check (unusual hours)
    const timeCheck = this.checkTimePattern(transaction.timestamp);
    if (timeCheck.suspicious) {
      flags.push(timeCheck);
      fraudScore += timeCheck.score;
    }

    // 4. Customer risk score check
    const riskCheck = this.checkCustomerRisk(customer);
    if (riskCheck.suspicious) {
      flags.push(riskCheck);
      fraudScore += riskCheck.score;
    }

    // 5. Bot detection (user agent analysis)
    const botCheck = this.checkForBot(transaction.user_agent);
    if (botCheck.suspicious) {
      flags.push(botCheck);
      fraudScore += botCheck.score;
    }

    // Normalize score to 0-1 range
    fraudScore = Math.min(fraudScore / 100, 1);

    return {
      fraudScore,
      flags,
      isSuspicious: fraudScore >= 0.5,
      severity: this.getSeverity(fraudScore)
    };
  }

  // Check if transaction amount is anomalous
  checkAmountAnomaly(transaction, customer) {
    const amount = parseFloat(transaction.total_amount);
    const avgSpent = customer ? parseFloat(customer.total_spent) / 10 : 500; // Rough estimate

    // Check absolute limits
    if (amount > this.THRESHOLDS.MAX_VALID_AMOUNT) {
      return {
        type: 'amount_exceeds_limit',
        suspicious: true,
        score: 40,
        message: `Transaction amount $${amount.toFixed(2)} exceeds maximum limit of $${this.THRESHOLDS.MAX_VALID_AMOUNT}`
      };
    }

    if (amount < this.THRESHOLDS.MIN_VALID_AMOUNT) {
      return {
        type: 'amount_too_low',
        suspicious: true,
        score: 20,
        message: `Transaction amount $${amount.toFixed(2)} is below minimum`
      };
    }

    // Check deviation from average
    if (amount > avgSpent * this.THRESHOLDS.AMOUNT_DEVIATION_MULTIPLIER) {
      return {
        type: 'amount_deviation',
        suspicious: true,
        score: 25,
        message: `Transaction amount $${amount.toFixed(2)} is ${(amount / avgSpent).toFixed(1)}x the customer average`
      };
    }

    // High value transaction alert
    if (amount > this.THRESHOLDS.HIGH_AMOUNT) {
      return {
        type: 'high_value',
        suspicious: true,
        score: 15,
        message: `High-value transaction of $${amount.toFixed(2)}`
      };
    }

    return { suspicious: false };
  }

  // Check for rapid successive purchases (velocity)
  async checkVelocity(customerId) {
    const windowStart = new Date(Date.now() - this.THRESHOLDS.VELOCITY_WINDOW_MINUTES * 60 * 1000);

    const recentTransactions = await Transaction.count({
      where: {
        customer_id: customerId,
        timestamp: { [Op.gte]: windowStart }
      }
    });

    if (recentTransactions >= this.THRESHOLDS.VELOCITY_MAX_TRANSACTIONS) {
      return {
        type: 'velocity_exceeded',
        suspicious: true,
        score: 30,
        message: `${recentTransactions} transactions in the last ${this.THRESHOLDS.VELOCITY_WINDOW_MINUTES} minutes`
      };
    }

    return { suspicious: false };
  }

  // Check for unusual time patterns
  checkTimePattern(timestamp) {
    const date = new Date(timestamp);
    const hour = date.getHours();

    if (hour >= this.THRESHOLDS.SUSPICIOUS_HOURS_START &&
        hour <= this.THRESHOLDS.SUSPICIOUS_HOURS_END) {
      return {
        type: 'unusual_time',
        suspicious: true,
        score: 15,
        message: `Transaction at unusual hour (${hour}:00)`
      };
    }

    return { suspicious: false };
  }

  // Check customer's existing risk score
  checkCustomerRisk(customer) {
    if (!customer) {
      return {
        type: 'unknown_customer',
        suspicious: true,
        score: 20,
        message: 'Transaction from unknown customer'
      };
    }

    const riskScore = parseFloat(customer.risk_score);
    if (riskScore >= 0.7) {
      return {
        type: 'high_risk_customer',
        suspicious: true,
        score: 25,
        message: `Customer has high risk score (${(riskScore * 100).toFixed(0)}%)`
      };
    }

    return { suspicious: false };
  }

  // Check for bot-like user agents
  checkForBot(userAgent) {
    if (!userAgent) {
      return {
        type: 'missing_user_agent',
        suspicious: true,
        score: 15,
        message: 'Missing user agent'
      };
    }

    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /curl/i, /wget/i,
      /python/i, /java\//i, /php/i
    ];

    for (const pattern of botPatterns) {
      if (pattern.test(userAgent)) {
        return {
          type: 'bot_detected',
          suspicious: true,
          score: 20,
          message: 'Request appears to be from automated system'
        };
      }
    }

    return { suspicious: false };
  }

  // Get severity level based on fraud score
  getSeverity(fraudScore) {
    if (fraudScore >= 0.8) return 'critical';
    if (fraudScore >= 0.6) return 'high';
    if (fraudScore >= 0.4) return 'medium';
    return 'low';
  }

  // Create alert for suspicious transaction
  async createFraudAlert(transaction, analysis) {
    const alert = await Alert.create({
      type: 'fraud',
      severity: analysis.severity,
      title: `Suspicious Transaction Detected`,
      message: analysis.flags.map(f => f.message).join('; '),
      transaction_id: transaction.id,
      customer_id: transaction.customer_id,
      metadata: JSON.stringify({
        fraudScore: analysis.fraudScore,
        flags: analysis.flags
      })
    });

    // Broadcast to connected WebSocket clients
    if (this.wsServer) {
      this.broadcast({
        type: 'FRAUD_ALERT',
        data: {
          alert,
          transaction,
          analysis
        }
      });
    }

    return alert;
  }

  // Get all suspicious transactions
  async getSuspiciousTransactions(limit = 50) {
    return Transaction.findAll({
      where: {
        fraud_score: { [Op.gte]: 0.5 }
      },
      include: [
        { model: Customer, attributes: ['id', 'email', 'first_name', 'last_name', 'risk_score'] }
      ],
      order: [['fraud_score', 'DESC'], ['timestamp', 'DESC']],
      limit
    });
  }

  // Analyze existing transactions for fraud patterns
  async analyzeExistingTransactions() {
    const transactions = await Transaction.findAll({
      include: [Customer],
      order: [['timestamp', 'DESC']],
      limit: 1000
    });

    const results = [];
    for (const transaction of transactions) {
      const analysis = await this.analyzeTransaction(transaction, transaction.Customer);

      // Update transaction with fraud score
      await transaction.update({
        fraud_score: analysis.fraudScore,
        fraud_flags: JSON.stringify(analysis.flags)
      });

      if (analysis.isSuspicious) {
        results.push({ transaction, analysis });
      }
    }

    return results;
  }

  // WebSocket broadcast helper
  broadcast(message) {
    if (this.wsServer) {
      this.wsServer.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify(message));
        }
      });
    }
  }

  setWsServer(wsServer) {
    this.wsServer = wsServer;
  }
}

module.exports = new FraudDetectionService();
