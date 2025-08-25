const mongoose = require("mongoose");

const PendingChangeSchema = new mongoose.Schema({
  operation: { 
    type: String, 
    enum: ['CREATE', 'UPDATE', 'DELETE'],
    required: true 
  },
  targetModel: { 
    type: String, 
    required: true
  }, // e.g., 'HouseDetails', 'GarbageCollection', etc.
  targetId: { 
    type: String
  }, // MongoDB ObjectId or SQL primary key
  databaseType: {
    type: String,
    enum: ['MongoDB', 'MySQL'],
    required: true
  },
  proposedChanges: { 
    type: mongoose.Schema.Types.Mixed,
    required: true
  }, // The new data being proposed
  originalData: { 
    type: mongoose.Schema.Types.Mixed
  }, // The original data (for UPDATE/DELETE)
  requestedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Manager',
    required: true
  },
  requestedByName: {
    type: String,
    required: true
  },
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending' 
  },
  reviewedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Admin'
  },
  reviewedByName: {
    type: String
  },
  reviewedAt: { 
    type: Date 
  },
  reviewComments: { 
    type: String
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String
  }, // e.g., 'waste-management', 'user-management'
  description: {
    type: String
  },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    }
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Instance methods
PendingChangeSchema.methods.approve = async function(adminUser, comments) {
  this.status = 'approved';
  this.reviewedBy = adminUser._id;
  this.reviewedByName = adminUser.name || adminUser.username;
  this.reviewedAt = new Date();
  this.reviewComments = comments || '';
  this.updatedAt = new Date();
  
  // Execute the actual operation
  try {
    await this.executeOperation();
  } catch (error) {
    console.error('Error executing approved operation:', error);
    // Don't fail the approval, but log the execution error
  }
  
  return this.save();
};

PendingChangeSchema.methods.reject = function(adminUser, comments) {
  this.status = 'rejected';
  this.reviewedBy = adminUser._id;
  this.reviewedByName = adminUser.name || adminUser.username;
  this.reviewedAt = new Date();
  this.reviewComments = comments || '';
  this.updatedAt = new Date();
  return this.save();
};

PendingChangeSchema.methods.canBeReviewed = function() {
  return this.status === 'pending' && this.expiresAt > new Date();
};

// Execute the actual CRUD operation when approved
PendingChangeSchema.methods.executeOperation = async function() {
  const mongoose = require("mongoose");
  const sql = require("../config/db.sql");
  
  try {
    if (this.databaseType === 'MongoDB') {
      // Handle MongoDB operations
      const ModelClass = mongoose.model(this.targetModel);
      
      switch (this.operation) {
        case 'CREATE':
          await ModelClass.create(this.proposedChanges);
          break;
        case 'UPDATE':
          await ModelClass.findByIdAndUpdate(this.targetId, this.proposedChanges);
          break;
        case 'DELETE':
          await ModelClass.findByIdAndDelete(this.targetId);
          break;
      }
    } else if (this.databaseType === 'MySQL') {
      // Handle MySQL operations
      const tableName = this.targetModel;
      
      switch (this.operation) {
        case 'CREATE':
          const createFields = Object.keys(this.proposedChanges).join(', ');
          const createValues = Object.values(this.proposedChanges);
          const createPlaceholders = createValues.map(() => '?').join(', ');
          
          await sql.promise().query(
            `INSERT INTO ${tableName} (${createFields}) VALUES (${createPlaceholders})`,
            createValues
          );
          break;
          
        case 'UPDATE':
          const updateFields = Object.keys(this.proposedChanges)
            .map(field => `${field} = ?`)
            .join(', ');
          const updateValues = [...Object.values(this.proposedChanges), this.targetId];
          
          await sql.promise().query(
            `UPDATE ${tableName} SET ${updateFields} WHERE id = ?`,
            updateValues
          );
          break;
          
        case 'DELETE':
          await sql.promise().query(
            `DELETE FROM ${tableName} WHERE id = ?`,
            [this.targetId]
          );
          break;
      }
    }
    
    console.log(`Successfully executed ${this.operation} operation on ${this.targetModel}`);
  } catch (error) {
    console.error(`Failed to execute ${this.operation} operation on ${this.targetModel}:`, error);
    throw error;
  }
};

module.exports = mongoose.model("PendingChange", PendingChangeSchema);
