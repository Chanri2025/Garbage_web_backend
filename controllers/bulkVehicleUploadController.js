const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for vehicle upload
const EXPECTED_HEADERS = [
  'Vehicle_ID', 'Vehicle_No', 'Vehicle_Type', 'Description', 
  'Joined_Date', 'isActive', 'Area_ID', 'Device_id'
];

// Validate CSV headers
const validateHeaders = (headers) => {
  console.log('Validating headers:', headers);
  console.log('Expected headers:', EXPECTED_HEADERS);
  
  // Normalize headers (trim and convert to lowercase)
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase());
  const normalizedExpected = EXPECTED_HEADERS.map(h => h.toLowerCase());
  
  console.log('Normalized headers:', normalizedHeaders);
  
  const missingHeaders = normalizedExpected.filter(header => !normalizedHeaders.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
  }
  return true;
};

// Validate required fields in a row
const validateRow = (row) => {
  console.log('Validating row:', row);
  
  const requiredFields = ['Vehicle_ID', 'Vehicle_No', 'Vehicle_Type'];
  console.log('Checking required fields:', requiredFields);
  
  // Check each field's value
  Object.entries(row).forEach(([key, value]) => {
    console.log(`Field ${key}:`, value, typeof value);
  });
  
  const missingFields = requiredFields.filter(field => {
    const value = row[field];
    const isEmpty = !value || (typeof value === 'string' && value.trim() === '');
    if (isEmpty) {
      console.log(`Field ${field} is missing or empty:`, value);
    }
    return isEmpty;
  });
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Validate date format
  if (row.Joined_Date) {
    console.log('Validating date:', row.Joined_Date);
    const date = new Date(row.Joined_Date);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format for Joined_Date: ${row.Joined_Date}`);
    }
  }
  
  // Validate boolean field
  if (row.isActive) {
    console.log('Validating isActive:', row.isActive);
    if (!['true', 'false', '1', '0', 'yes', 'no'].includes(row.isActive.toString().toLowerCase())) {
      throw new Error(`Invalid boolean value for isActive: ${row.isActive}`);
    }
  }
  
  console.log('Row validation successful');
  return true;
};

// Check if vehicle exists
const vehicleExists = async (connection, vehicleId) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);
    
    connection.query(
      'SELECT Vehicle_ID FROM vehicle_details WHERE Vehicle_ID = ?',
      [vehicleId],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(results.length > 0);
      }
    );
  });
};

// Check if area exists
const areaExists = async (connection, areaId) => {
  if (!areaId) return true; // Optional field
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);
    
    connection.query(
      'SELECT Area_ID FROM area_details WHERE Area_ID = ?',
      [areaId],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(results.length > 0);
      }
    );
  });
};

// Insert or update vehicle
const upsertVehicle = async (connection, vehicleData) => {
  const {
    Vehicle_ID, Vehicle_No, Vehicle_Type, Description, 
    Joined_Date, isActive, Area_ID, Device_id
  } = vehicleData;
  
  const exists = await vehicleExists(connection, Vehicle_ID);
  
  if (exists) {
    // Update existing vehicle
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE vehicle_details SET 
          Vehicle_No = ?, Vehicle_Type = ?, Description = ?, 
          Joined_Date = ?, isActive = ?, Area_ID = ?, Device_id = ?,
          lastUpdate_Date = NOW()
        WHERE Vehicle_ID = ?
      `;
      
      connection.query(query, [
        Vehicle_No, Vehicle_Type, Description, Joined_Date, 
        isActive === 'true' || isActive === '1' || isActive === 'yes' ? 1 : 0,
        Area_ID || null, Device_id || null, Vehicle_ID
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'update', vehicleId: Vehicle_ID });
      });
    });
  } else {
    // Insert new vehicle
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO vehicle_details (
          Vehicle_ID, Vehicle_No, Vehicle_Type, Description, 
          Joined_Date, isActive, Area_ID, Device_id, Created_Date, lastUpdate_Date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
      `;
      
      connection.query(query, [
        Vehicle_ID, Vehicle_No, Vehicle_Type, Description, Joined_Date,
        isActive === 'true' || isActive === '1' || isActive === 'yes' ? 1 : 0,
        Area_ID || null, Device_id || null
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'insert', vehicleId: Vehicle_ID });
      });
    });
  }
};

// Main bulk upload function
exports.bulkUploadVehicles = async (req, res) => {
  console.log('Vehicle bulk upload request received');
  console.log('Request file:', req.file);
  console.log('Request body:', req.body);
  
  if (!req.file) {
    console.log('No file in request');
    return res.status(400).json({
      success: false,
      message: 'No CSV file uploaded'
    });
  }
  
  if (!req.file.path) {
    console.log('No file path available');
    return res.status(400).json({
      success: false,
      message: 'Invalid file upload'
    });
  }
  
  const filePath = req.file.path;
  const results = [];
  const errors = [];
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  
  try {
    // Parse CSV file
    const csvData = [];
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(filePath)
        .on('error', (error) => {
          console.error('Error reading CSV file:', error);
          reject(new Error(`Failed to read CSV file: ${error.message}`));
        });

      stream.pipe(csv({
        mapHeaders: ({ header }) => header.trim(),
        mapValues: ({ value }) => value.trim()
      }))
      .on('data', (row) => {
        console.log('Processing CSV row:', row);
        csvData.push(row);
      })
      .on('end', () => {
        console.log('CSV parsing completed. Total rows:', csvData.length);
        resolve();
      })
      .on('error', (error) => {
        console.error('Error parsing CSV:', error);
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      });
    });
    
    if (csvData.length === 0) {
      throw new Error('CSV file is empty');
    }
    
    // Validate headers
    const headers = Object.keys(csvData[0]);
    validateHeaders(headers);
    
    // Get database connection
    const connection = await db.promise().getConnection();
    
    try {
      for (const row of csvData) {
        processedCount++;
        
        try {
          // Validate row data
          validateRow(row);
          
          // Check if area exists (if provided)
          if (row.Area_ID) {
            const areaExistsResult = await areaExists(connection, row.Area_ID);
            if (!areaExistsResult) {
              throw new Error(`Area_ID ${row.Area_ID} not found`);
            }
          }
          
          // Insert/update vehicle
          const result = await upsertVehicle(connection, row);
          
          results.push({
            row: processedCount,
            vehicleId: row.Vehicle_ID,
            status: 'success',
            type: result.type,
            message: `Vehicle ${result.type === 'insert' ? 'created' : 'updated'} successfully`
          });
          
          successCount++;
          
        } catch (rowError) {
          errors.push({
            row: processedCount,
            vehicleId: row.Vehicle_ID || 'N/A',
            status: 'error',
            message: rowError.message,
            data: row
          });
          errorCount++;
        }
      }
      
      connection.release();
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      res.json({
        success: true,
        message: 'Vehicle bulk upload completed',
        data: {
          totalProcessed: processedCount,
          successCount,
          errorCount,
          results,
          errors
        }
      });
      
    } catch (error) {
      connection.release();
      throw error;
    }
    
  } catch (error) {
    console.error('Bulk upload error:', error);
    console.error('Error stack:', error.stack);
    
    // Clean up uploaded file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.status(500).json({
      success: false,
      message: 'Vehicle bulk upload failed',
      error: error.message,
      details: error.stack
    });
  }
};
