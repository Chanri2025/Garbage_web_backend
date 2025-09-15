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
    console.log(`Executing ${this.operation} operation on ${this.targetModel} (${this.databaseType})`);
    console.log('Target ID:', this.targetId);
    console.log('Proposed changes:', this.proposedChanges);
    
    if (this.databaseType === 'MongoDB') {
      // Handle MongoDB operations
      const ModelClass = mongoose.model(this.targetModel);
      
      switch (this.operation) {
        case 'CREATE':
          console.log('Creating new document in MongoDB');
          await ModelClass.create(this.proposedChanges);
          break;
        case 'UPDATE':
          console.log('Updating document in MongoDB with ID:', this.targetId);
          await ModelClass.findByIdAndUpdate(this.targetId, this.proposedChanges);
          break;
        case 'DELETE':
          console.log('Deleting document in MongoDB with ID:', this.targetId);
          await ModelClass.findByIdAndDelete(this.targetId);
          break;
      }
    } else if (this.databaseType === 'MySQL') {
      // Handle MySQL operations
      const tableName = this.targetModel;
      
      // Get the correct primary key column name for the table
      const getPrimaryKeyColumn = (tableName) => {
        const primaryKeyMap = {
          'swm.employee_table': 'Emp_ID',
          'employee_table': 'Emp_ID',
          'swm.vehicle_table': 'Vehicle_ID',
          'vehicle_table': 'Vehicle_ID',
          'vehicle_details': 'Vehicle_ID',
          'swm.area_details': 'Area_ID',
          'area_details': 'Area_ID',
          'swm.zone_table': 'Zone_ID',
          'zone_table': 'Zone_ID',
          'zone_details': 'Zone_ID',
          'swm.ward_table': 'Ward_ID',
          'ward_table': 'Ward_ID',
          'ward_details': 'Ward_ID',
          'swm.dump_yard_table': 'DY_ID',
          'dump_yard_table': 'DY_ID',
          'dump_yard_details': 'DY_ID',
          'swm.device_table': 'Device_ID',
          'device_table': 'Device_ID',
          'device_details': 'Device_ID',
          'swm.dust_bin_table': 'Dust_Bin_ID',
          'dust_bin_table': 'Dust_Bin_ID',
          'dust_bin_details': 'Dust_Bin_ID',
          'swm.ip_log_table': 'Log_ID', // MongoDB collection
          'ip_log_table': 'Log_ID' // MongoDB collection
        };
        return primaryKeyMap[tableName] || 'id';
      };
      
      // Map model names to actual table names
      const getActualTableName = (modelName) => {
        const tableNameMap = {
          'swm.employee_table': 'employee_table',
          'employee_table': 'employee_table',
          'swm.vehicle_table': 'vehicle_details',
          'vehicle_table': 'vehicle_details',
          'vehicle_details': 'vehicle_details',
          'swm.area_details': 'area_details',
          'area_details': 'area_details',
          'swm.zone_table': 'zone_details',
          'zone_table': 'zone_details',
          'zone_details': 'zone_details',
          'swm.ward_table': 'ward_details',
          'ward_table': 'ward_details',
          'ward_details': 'ward_details',
          'swm.dump_yard_table': 'dump_yard_details',
          'dump_yard_table': 'dump_yard_details',
          'dump_yard_details': 'dump_yard_details',
          'swm.device_table': 'device_details',
          'device_table': 'device_details',
          'device_details': 'device_details',
          'swm.dust_bin_table': 'dust_bin_details',
          'dust_bin_table': 'dust_bin_details',
          'dust_bin_details': 'dust_bin_details',
          'swm.ip_log_table': 'iplogs', // This is MongoDB collection
          'ip_log_table': 'iplogs' // This is MongoDB collection
        };
        return tableNameMap[modelName] || modelName.replace('swm.', '');
      };
      
      const actualTableName = getActualTableName(tableName);
      const primaryKeyColumn = getPrimaryKeyColumn(tableName);
      
      // Filter out metadata fields that shouldn't be in database updates
      const filterMetadataFields = (data) => {
        const metadataFields = [
          'operation',
          'entityType', 
          'entityId',
          'currentData',
          'proposedChanges',
          'reason',
          'requestedBy',
          'requestedAt',
          'status',
          'priority',
          'category'
        ];
        
        const filtered = {};
        for (const [key, value] of Object.entries(data)) {
          if (!metadataFields.includes(key)) {
            filtered[key] = value;
          }
        }
        
        return filtered;
      };

      // Map field names to match database column names
      const mapFieldNames = (data) => {
        const fieldMapping = {
          'emp_id': 'Emp_ID',
          'full_name': 'Full_Name',
          'mobile_no': 'Mobile_No',
          'user_address': 'User_Address',
          'blood_group': 'Blood_Group',
          'employment_type': 'Employment_Type',
          'assigned_target': 'Assigned_Target',
          'designation': 'Designation',
          'father_name': 'Father_Name',
          'mother_name': 'Mother_Name',
          'joined_date': 'Joined_Date',
          'qr_id': 'QR_ID',
          'assigned_vehicle_id': 'Assigned_Vehicle_ID'
        };
        
        const mapped = {};
        for (const [key, value] of Object.entries(data)) {
          const dbFieldName = fieldMapping[key] || key;
          mapped[dbFieldName] = value;
        }
        
        return mapped;
      };

      // Convert date fields to proper MySQL format
      const convertDateFields = (data) => {
        const converted = { ...data };
        
        // Convert Created_Date from MM/DD/YYYY to YYYY-MM-DD
        if (converted.Created_Date) {
          try {
            const date = new Date(converted.Created_Date);
            if (!isNaN(date.getTime())) {
              converted.Created_Date = date.toISOString().split('T')[0]; // YYYY-MM-DD
            } else {
              delete converted.Created_Date; // Skip if conversion fails
            }
          } catch (error) {
            delete converted.Created_Date; // Skip if conversion fails
          }
        }
        
        // Convert Update_Date from MM/DD/YYYY to YYYY-MM-DD
        if (converted.Update_Date) {
          try {
            const date = new Date(converted.Update_Date);
            if (!isNaN(date.getTime())) {
              converted.Update_Date = date.toISOString().split('T')[0]; // YYYY-MM-DD
            } else {
              delete converted.Update_Date; // Skip if conversion fails
            }
          } catch (error) {
            delete converted.Update_Date; // Skip if conversion fails
          }
        }
        
        // Convert Joined_Date and skip invalid dates
        if (converted.Joined_Date) {
          try {
            // Skip invalid dates like '0000-00-00 00:00:00'
            if (converted.Joined_Date === '0000-00-00 00:00:00' || 
                converted.Joined_Date === '0000-00-00' ||
                converted.Joined_Date === '') {
              delete converted.Joined_Date;
            } else {
              const date = new Date(converted.Joined_Date);
              if (!isNaN(date.getTime())) {
                converted.Joined_Date = date.toISOString().split('T')[0]; // YYYY-MM-DD
              } else {
                delete converted.Joined_Date; // Skip if conversion fails
              }
            }
          } catch (error) {
            delete converted.Joined_Date; // Skip if conversion fails
          }
        }
        
        return converted;
      };
      
      console.log('MySQL operation details:', {
        tableName: actualTableName,
        primaryKeyColumn: primaryKeyColumn,
        operation: this.operation
      });
      
      switch (this.operation) {
        case 'CREATE':
          // Use the nested proposedChanges object that contains the actual data
          const createData = this.proposedChanges.proposedChanges || this.proposedChanges;
          console.log('Raw create data:', createData);
          
          // Check if there are any valid fields to create
          if (Object.keys(createData).length === 0) {
            console.log('No valid fields to create');
            break; // Skip the create if no valid fields remain
          }
          
          const mappedCreateData = mapFieldNames(createData);
          const convertedCreateData = convertDateFields(mappedCreateData);
          const createFields = Object.keys(convertedCreateData).join(', ');
          const createValues = Object.values(convertedCreateData);
          const createPlaceholders = createValues.map(() => '?').join(', ');
          
          const createQuery = `INSERT INTO ${actualTableName} (${createFields}) VALUES (${createPlaceholders})`;
          console.log('CREATE query:', createQuery);
          console.log('CREATE values:', createValues);
          
          await sql.promise().query(createQuery, createValues);
          break;
          
        case 'UPDATE':
          // Use the nested proposedChanges object that contains the actual data
          const updateData = this.proposedChanges.proposedChanges || this.proposedChanges;
          console.log('Raw update data:', updateData);
          
          // Check if there are any valid fields to update
          if (Object.keys(updateData).length === 0) {
            console.log('No valid fields to update');
            break; // Skip the update if no valid fields remain
          }
          
          const mappedUpdateData = mapFieldNames(updateData);
          const convertedUpdateData = convertDateFields(mappedUpdateData);
          const updateFields = Object.keys(convertedUpdateData)
            .map(field => `${field} = ?`)
            .join(', ');
          // Use entityId from proposedChanges if targetId is undefined
          const targetId = this.targetId || this.proposedChanges.entityId;
          console.log('Using target ID:', targetId);
          const updateValues = [...Object.values(convertedUpdateData), targetId];
          
          const updateQuery = `UPDATE ${actualTableName} SET ${updateFields} WHERE ${primaryKeyColumn} = ?`;
          console.log('UPDATE query:', updateQuery);
          console.log('UPDATE values:', updateValues);
          
          await sql.promise().query(updateQuery, updateValues);
          break;
          
        case 'DELETE':
          const deleteQuery = `DELETE FROM ${actualTableName} WHERE ${primaryKeyColumn} = ?`;
          console.log('DELETE query:', deleteQuery);
          console.log('DELETE values:', [this.targetId]);
          
          await sql.promise().query(deleteQuery, [this.targetId]);
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
