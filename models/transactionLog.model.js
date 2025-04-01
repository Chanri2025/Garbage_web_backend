// models/transactionLog.model.js
const mongoose = require("mongoose");

const TransactionLogSchema = new mongoose.Schema({
  // Name of the table or collection that was affected.
  target: { type: String, required: true },
  // Type of operation: INSERT, UPDATE, DELETE, SELECT, etc.
  operation: { type: String, required: true },
  // Indicate which database: 'SQL' or 'MongoDB'
  databaseType: { type: String, required: true },
  // Additional details or payload of the transaction. Can be a JSON object.
  details: { type: mongoose.Schema.Types.Mixed },
  // Identifier for the user/system that performed the operation.
  performedBy: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TransactionLog", TransactionLogSchema);
