const sequelize = require('../config/database');
const Product = require('./Product');
const Customer = require('./Customer');
const Transaction = require('./Transaction');
const Supplier = require('./Supplier');
const Alert = require('./Alert');

// Define associations
Product.belongsTo(Supplier, { foreignKey: 'supplier_id' });
Supplier.hasMany(Product, { foreignKey: 'supplier_id' });

Transaction.belongsTo(Customer, { foreignKey: 'customer_id' });
Customer.hasMany(Transaction, { foreignKey: 'customer_id' });

Transaction.belongsTo(Product, { foreignKey: 'product_id' });
Product.hasMany(Transaction, { foreignKey: 'product_id' });

Alert.belongsTo(Transaction, { foreignKey: 'transaction_id' });
Alert.belongsTo(Customer, { foreignKey: 'customer_id' });
Alert.belongsTo(Product, { foreignKey: 'product_id' });

module.exports = {
  sequelize,
  Product,
  Customer,
  Transaction,
  Supplier,
  Alert
};
