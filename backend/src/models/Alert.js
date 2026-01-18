const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  type: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isIn: [['fraud', 'low_stock', 'high_value', 'unusual_activity', 'custom']]
    }
  },
  severity: {
    type: DataTypes.STRING,
    defaultValue: 'medium',
    validate: {
      isIn: [['low', 'medium', 'high', 'critical']]
    }
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT
  },
  transaction_id: {
    type: DataTypes.INTEGER
  },
  customer_id: {
    type: DataTypes.INTEGER
  },
  product_id: {
    type: DataTypes.INTEGER
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  resolved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  metadata: {
    type: DataTypes.TEXT,
    defaultValue: '{}'
  }
}, {
  tableName: 'alerts'
});

module.exports = Alert;
