const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for zone upload
const EXPECTED_HEADERS = [
  'Zone_ID', 'Zone_Name', 'Description'
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
  const requiredFields = ['Zone_ID', 'Zone_Name'];
  const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  return true;
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

// Insert or update zone
const upsertZone = async (connection, zoneData) => {
  const {
    Zone_ID, Zone_Name, Description
  } = zoneData;
  
  const exists = await zoneExists(connection, Zone_ID);
  
  if (exists) {
    // Update existing zone
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE zone_details SET 
          Zone_Name = ?, Description = ?
        WHERE Zone_ID = ?
      `;
      
      connection.query(query, [
        Zone_Name, Description || null, Zone_ID
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'update', zoneId: Zone_ID });
      });
    });
  } else {
    // Insert new zone
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO zone_details (
          Zone_ID, Zone_Name, Description
        ) VALUES (?, ?, ?)
      `;
      
      connection.query(query, [
        Zone_ID, Zone_Name, Description || null
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'insert', zoneId: Zone_ID });
      });
    });
  }
};

// Main bulk upload function
exports.bulkUploadZones = async (req, res) => {
  console.log('Zone bulk upload request received');
  
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
          
          // Insert/update zone
          const result = await upsertZone(connection, row);
          
          results.push({
            row: processedCount,
            zoneId: row.Zone_ID,
            status: 'success',
            type: result.type,
            message: `Zone ${result.type === 'insert' ? 'created' : 'updated'} successfully`
          });
          
          successCount++;
          
        } catch (rowError) {
          errors.push({
            row: processedCount,
            zoneId: row.Zone_ID || 'N/A',
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
        message: 'Zone bulk upload completed',
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
      message: 'Zone bulk upload failed',
      error: error.message
    });
  }
};
