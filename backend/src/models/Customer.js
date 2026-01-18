const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Customer = sequelize.define('Customer', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  first_name: {
    type: DataTypes.STRING
  },
  last_name: {
    type: DataTypes.STRING
  },
  registration_date: {
    type: DataTypes.DATE
  },
  total_spent: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  risk_score: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0
  },
  address: {
    type: DataTypes.TEXT
  },
  phone: {
    type: DataTypes.STRING
  },
  date_of_birth: {
    type: DataTypes.DATEONLY
  },
  preferred_payment: {
    type: DataTypes.STRING
  },
  loyalty_tier: {
    type: DataTypes.STRING,
    defaultValue: 'none'
  }
}, {
  tableName: 'customers'
});

module.exports = Customer;
