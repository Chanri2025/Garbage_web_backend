const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for zone upload
const EXPECTED_HEADERS = [
  'Zone_Name' // Only Zone_Name is required, Zone_ID will be auto-generated
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
  const requiredFields = ['Zone_Name'];
  const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  return true;
};

// Get next available Zone_ID
const getNextZoneId = async (connection) => {
  try {
    const [results] = await connection.query(
      'SELECT Zone_ID FROM zone_details ORDER BY Zone_ID DESC LIMIT 1'
    );
    
    let nextId = 1;
    if (results.length > 0) {
      nextId = results[0].Zone_ID + 1;
    }
    console.log('Next Zone_ID:', nextId);
    return nextId;
  } catch (err) {
    console.error('Error getting next Zone_ID:', err);
    return 1; // Default to 1 if error
  }
};

// Check if zone name already exists (prevent duplicates)
const zoneNameExists = async (connection, zoneName) => {
  try {
    const [results] = await connection.query(
      'SELECT Zone_ID, Zone_Name FROM zone_details WHERE Zone_Name = ?',
      [zoneName]
    );
    
    if (results.length > 0) {
      console.log(`Zone name "${zoneName}" already exists with ID: ${results[0].Zone_ID}`);
      return results[0];
    }
    return null;
  } catch (err) {
    console.error('Error checking zone name:', err);
    return null;
  }
};

// Check if zone exists by ID
const zoneExists = async (connection, zoneId) => {
  try {
    const [results] = await connection.query(
      'SELECT Zone_ID FROM zone_details WHERE Zone_ID = ?',
      [zoneId]
    );
    return results.length > 0;
  } catch (err) {
    console.error('Error checking if zone exists:', err);
    return false;
  }
};

// Insert new zone with auto-generated ID
const insertZone = async (connection, zoneData) => {
  const { Zone_Name, Description } = zoneData;
  
  console.log('Inserting new zone:', zoneData);
  
  // Check if zone name already exists
  const existingZone = await zoneNameExists(connection, Zone_Name);
  if (existingZone) {
    throw new Error(`Zone name "${Zone_Name}" already exists with ID: ${existingZone.Zone_ID}`);
  }
  
  // Get next available Zone_ID
  const zoneId = await getNextZoneId(connection);
  
  try {
    const query = `
      INSERT INTO zone_details (
        Zone_ID, Zone_Name, Created_Date, Updated_Date
      ) VALUES (?, ?, NOW(), NOW())
    `;
    
    const params = [zoneId, Zone_Name];
    
    console.log('Executing INSERT query:', query);
    console.log('With parameters:', params);
    
    const [result] = await connection.query(query, params);
    console.log('✅ INSERT query result:', result);
    console.log(`✅ Inserted ${result.affectedRows} rows, Zone_ID: ${zoneId}`);
    
    return { type: 'insert', zoneId: zoneId };
  } catch (err) {
    console.error('❌ INSERT query error:', err);
    throw err;
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
      // Start transaction
      await connection.beginTransaction();
      console.log('Database transaction started');
      
      for (const row of csvData) {
        processedCount++;
        
        try {
          // Validate row data
          validateRow(row);
          
          // Insert zone with auto-generated ID
          const result = await insertZone(connection, row);
          
          results.push({
            row: processedCount,
            zoneId: result.zoneId,
            zoneName: row.Zone_Name,
            status: 'success',
            type: result.type,
            message: `Zone "${row.Zone_Name}" created successfully with ID: ${result.zoneId}`
          });
          
          successCount++;
          
        } catch (rowError) {
          errors.push({
            row: processedCount,
            zoneName: row.Zone_Name || 'N/A',
            status: 'error',
            message: rowError.message,
            data: row
          });
          errorCount++;
        }
      }
      
      // Commit transaction
      await connection.commit();
      console.log('Database transaction committed successfully');
      
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
      // Rollback transaction on error
      try {
        await connection.rollback();
        console.log('Database transaction rolled back due to error');
      } catch (rollbackError) {
        console.error('Error during rollback:', rollbackError);
      }
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
