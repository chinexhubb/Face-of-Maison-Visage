// MongoDB Playground
// Use this file to test queries against your database using the MongoDB for VS Code extension.

// 1. Connect to your database (Make sure you've installed the MongoDB for VS Code extension)
// 2. Select the database 'glow'
use('glow');

// --- CONTESTANTS QUERIES ---

// View all contestants
db.getCollection('contestants').find({});

// View top 3 contestants by votes
db.getCollection('contestants').find({}).sort({ votes: -1 }).limit(3);

// --- TRANSACTIONS QUERIES ---

// View all transactions
db.getCollection('transactions').find({});

// View total revenue
db.getCollection('transactions').aggregate([
  { $match: { status: 'Success' } },
  { $group: { _id: null, totalRevenue: { $sum: '$amount' } } }
]);
