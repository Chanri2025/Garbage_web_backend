const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for ward upload
const EXPECTED_HEADERS = [
  'Ward_ID', 'Ward_Name', 'Zone_ID'
];

// Validate CSV headers
const validateHeaders = (headers) => {
  const missingHeaders = EXPECTED_HEADERS.filter(header => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`Missing required headers: ${missingHeaders.join(', ')}`);
  }
  return true;
};

// Validate required fields in a row
const validateRow = (row) => {
  const requiredFields = ['Ward_ID', 'Ward_Name', 'Zone_ID'];
  const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  return true;
};

// Check if ward exists
const wardExists = async (connection, wardId) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);
    
    connection.query(
      'SELECT Ward_ID FROM ward_details WHERE Ward_ID = ?',
      [wardId],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(results.length > 0);
      }
    );
  });
};

// Check if zone exists
const zoneExists = async (connection, zoneId) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);
    
    connection.query(
      'SELECT Zone_ID FROM zone_details WHERE Zone_ID = ?',
      [zoneId],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(results.length > 0);
      }
    );
  });
};

// Insert or update ward
const upsertWard = async (connection, wardData) => {
  const {
    Ward_ID, Ward_Name, Zone_ID
  } = wardData;
  
  const exists = await wardExists(connection, Ward_ID);
  
  if (exists) {
    // Update existing ward
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE ward_details SET 
          Ward_Name = ?, Zone_ID = ?
        WHERE Ward_ID = ?
      `;
      
      connection.query(query, [
        Ward_Name, Zone_ID, Ward_ID
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'update', wardId: Ward_ID });
      });
    });
  } else {
    // Insert new ward
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO ward_details (
          Ward_ID, Ward_Name, Zone_ID
        ) VALUES (?, ?, ?)
      `;
      
      connection.query(query, [
        Ward_ID, Ward_Name, Zone_ID
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'insert', wardId: Ward_ID });
      });
    });
  }
};

// Main bulk upload function
exports.bulkUploadWards = async (req, res) => {
  console.log('Ward bulk upload request received');
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No CSV file uploaded'
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
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => csvData.push(row))
        .on('end', resolve)
        .on('error', reject);
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
          
          // Check if zone exists
          const zoneExistsResult = await zoneExists(connection, row.Zone_ID);
          if (!zoneExistsResult) {
            throw new Error(`Zone_ID ${row.Zone_ID} not found`);
          }
          
          // Insert/update ward
          const result = await upsertWard(connection, row);
          
          results.push({
            row: processedCount,
            wardId: row.Ward_ID,
            status: 'success',
            type: result.type,
            message: `Ward ${result.type === 'insert' ? 'created' : 'updated'} successfully`
          });
          
          successCount++;
          
        } catch (rowError) {
          errors.push({
            row: processedCount,
            wardId: row.Ward_ID || 'N/A',
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
        message: 'Ward bulk upload completed',
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
    // Clean up uploaded file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.status(500).json({
      success: false,
      message: 'Ward bulk upload failed',
      error: error.message
    });
  }
};
