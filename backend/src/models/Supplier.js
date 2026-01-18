const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Supplier = sequelize.define('Supplier', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contact_email: {
    type: DataTypes.STRING
  },
  phone: {
    type: DataTypes.STRING
  },
  address: {
    type: DataTypes.TEXT
  },
  country: {
    type: DataTypes.STRING
  },
  reliability_score: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0
  },
  average_delivery_days: {
    type: DataTypes.INTEGER
  },
  payment_terms: {
    type: DataTypes.STRING
  },
  established_date: {
    type: DataTypes.DATEONLY
  },
  certification: {
    type: DataTypes.STRING
  }
}, {
  tableName: 'suppliers'
});

module.exports = Supplier;
