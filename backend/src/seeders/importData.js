const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { sequelize, Product, Customer, Transaction, Supplier, Alert } = require('../models');
const fraudDetection = require('../services/fraudDetection');

const DATA_DIR = path.join(__dirname, '../../../../techmart_data');

async function parseCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Handle different date formats
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function parseNumber(val, defaultVal = 0) {
  const num = parseFloat(val);
  return isNaN(num) ? defaultVal : num;
}

async function importSuppliers() {
  console.log('Importing suppliers...');
  const data = await parseCSV(path.join(DATA_DIR, 'suppliers.csv'));

  for (const row of data) {
    await Supplier.create({
      id: parseInt(row.id),
      name: row.name,
      contact_email: row.contact_email,
      phone: row.phone,
      address: row.address,
      country: row.country,
      reliability_score: parseNumber(row.reliability_score),
      average_delivery_days: parseInt(row.average_delivery_days) || null,
      payment_terms: row.payment_terms,
      established_date: parseDate(row.established_date),
      certification: row.certification
    });
  }

  console.log(`  Imported ${data.length} suppliers`);
}

async function importProducts() {
  console.log('Importing products...');
  const data = await parseCSV(path.join(DATA_DIR, 'products.csv'));

  for (const row of data) {
    await Product.create({
      id: parseInt(row.id),
      name: row.name,
      category: row.category,
      price: parseNumber(row.price),
      stock_quantity: parseInt(row.stock_quantity) || 0,
      supplier_id: parseInt(row.supplier_id) || null,
      sku: row.sku,
      description: row.description,
      weight: parseNumber(row.weight, null),
      dimensions: row.dimensions,
      warranty_months: parseInt(row.warranty_months) || null
    });
  }

  console.log(`  Imported ${data.length} products`);
}

async function importCustomers() {
  console.log('Importing customers...');
  const data = await parseCSV(path.join(DATA_DIR, 'customers.csv'));

  for (const row of data) {
    await Customer.create({
      id: parseInt(row.id),
      email: row.email,
      first_name: row.first_name,
      last_name: row.last_name,
      registration_date: parseDate(row.registration_date),
      total_spent: parseNumber(row.total_spent),
      risk_score: parseNumber(row.risk_score),
      address: row.address,
      phone: row.phone,
      date_of_birth: parseDate(row.date_of_birth),
      preferred_payment: row.preferred_payment,
      loyalty_tier: row.loyalty_tier || 'none'
    });
  }

  console.log(`  Imported ${data.length} customers`);
}

async function importTransactions() {
  console.log('Importing transactions...');
  const data = await parseCSV(path.join(DATA_DIR, 'transactions.csv'));

  let suspicious = 0;
  let processed = 0;

  for (const row of data) {
    const transaction = await Transaction.create({
      id: parseInt(row.id),
      customer_id: parseInt(row.customer_id),
      product_id: parseInt(row.product_id),
      quantity: parseInt(row.quantity) || 1,
      unit_price: parseNumber(row.unit_price),
      total_amount: parseNumber(row.total_amount),
      status: row.status || 'completed',
      payment_method: row.payment_method,
      timestamp: parseDate(row.timestamp),
      ip_address: row.ip_address,
      user_agent: row.user_agent,
      session_id: row.session_id,
      discount_applied: parseNumber(row.discount_applied),
      tax_amount: parseNumber(row.tax_amount),
      shipping_cost: parseNumber(row.shipping_cost)
    });

    processed++;

    // Run fraud analysis on each transaction
    const customer = await Customer.findByPk(transaction.customer_id);
    const analysis = await fraudDetection.analyzeTransaction(transaction, customer);

    await transaction.update({
      fraud_score: analysis.fraudScore,
      fraud_flags: JSON.stringify(analysis.flags)
    });

    if (analysis.isSuspicious) {
      suspicious++;
      // Create alert for suspicious transactions
      await Alert.create({
        type: 'fraud',
        severity: analysis.severity,
        title: `Suspicious Transaction #${transaction.id}`,
        message: analysis.flags.map(f => f.message).join('; '),
        transaction_id: transaction.id,
        customer_id: transaction.customer_id,
        metadata: JSON.stringify({ fraudScore: analysis.fraudScore, flags: analysis.flags })
      });
    }

    if (processed % 500 === 0) {
      console.log(`    Processed ${processed}/${data.length} transactions...`);
    }
  }

  console.log(`  Imported ${data.length} transactions`);
  console.log(`  Detected ${suspicious} suspicious transactions`);
}

async function createLowStockAlerts() {
  console.log('Creating low stock alerts...');

  const lowStockProducts = await Product.findAll({
    where: { stock_quantity: { [require('sequelize').Op.lte]: 10 } },
    include: [Supplier]
  });

  for (const product of lowStockProducts) {
    const severity = product.stock_quantity === 0 ? 'critical'
      : product.stock_quantity <= 5 ? 'high' : 'medium';

    await Alert.create({
      type: 'low_stock',
      severity,
      title: `Low Stock: ${product.name}`,
      message: `${product.name} has only ${product.stock_quantity} units in stock. Supplier: ${product.Supplier?.name || 'Unknown'}`,
      product_id: product.id,
      metadata: JSON.stringify({
        currentStock: product.stock_quantity,
        supplierId: product.supplier_id
      })
    });
  }

  console.log(`  Created ${lowStockProducts.length} low stock alerts`);
}

async function main() {
  try {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║         TechMart Data Import Script                       ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    // Reset database
    console.log('Resetting database...');
    await sequelize.sync({ force: true });

    // Import data in order (respecting foreign keys)
    await importSuppliers();
    await importProducts();
    await importCustomers();
    await importTransactions();
    await createLowStockAlerts();

    // Print summary
    const [supplierCount, productCount, customerCount, transactionCount, alertCount] = await Promise.all([
      Supplier.count(),
      Product.count(),
      Customer.count(),
      Transaction.count(),
      Alert.count()
    ]);

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    Import Summary                         ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Suppliers:     ${supplierCount.toString().padStart(5)}                                  ║`);
    console.log(`║  Products:      ${productCount.toString().padStart(5)}                                  ║`);
    console.log(`║  Customers:     ${customerCount.toString().padStart(5)}                                  ║`);
    console.log(`║  Transactions:  ${transactionCount.toString().padStart(5)}                                  ║`);
    console.log(`║  Alerts:        ${alertCount.toString().padStart(5)}                                  ║`);
    console.log('╚═══════════════════════════════════════════════════════════╝\n');

    console.log('Data import completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Import failed:', error);
    process.exit(1);
  }
}

main();
