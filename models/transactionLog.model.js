// models/transactionLog.model.js
const mongoose = require("mongoose");

const TransactionLogSchema = new mongoose.Schema({
  // User information
  userEmail: { type: String, required: true, lowercase: true },
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userRole: { type: String, required: true },
  
  // Action details
  action: { type: String, required: true }, // e.g., "CREATE_ZONE", "FETCH_EMPLOYEES", "UPDATE_DUMPYARD"
  method: { type: String, required: true }, // HTTP method: GET, POST, PUT, DELETE
  endpoint: { type: String, required: true }, // API endpoint
  
  // Target resource
  target: { type: String, required: true }, // Table/collection name
  targetId: { type: String }, // ID of the affected record
  operation: { type: String, required: true }, // CRUD operation
  
  // Database and technical details
  databaseType: { type: String, required: true }, // 'SQL' or 'MongoDB'
  ipAddress: { type: String },
  userAgent: { type: String },
  
  // Request/Response details
  requestData: { type: mongoose.Schema.Types.Mixed }, // Request body/query params
  responseStatus: { type: Number }, // HTTP status code
  responseData: { type: mongoose.Schema.Types.Mixed }, // Response data (optional)
  
  // Additional context
  description: { type: String }, // Human-readable description
  metadata: { type: mongoose.Schema.Types.Mixed }, // Additional context data
  
  // Timestamps
  timestamp: { type: Date, default: Date.now },
  duration: { type: Number } // Request duration in milliseconds
}, {
  timestamps: true
});

// Indexes for better query performance
TransactionLogSchema.index({ userEmail: 1, timestamp: -1 });
TransactionLogSchema.index({ action: 1, timestamp: -1 });
TransactionLogSchema.index({ target: 1, timestamp: -1 });
TransactionLogSchema.index({ userRole: 1, timestamp: -1 });

module.exports = mongoose.model("TransactionLog", TransactionLogSchema);
