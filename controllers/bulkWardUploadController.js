const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for ward upload
const EXPECTED_HEADERS = [
  'Ward_Name', 'Zone_Name' // Only Ward_Name and Zone_Name required, Ward_ID will be auto-generated
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
  const requiredFields = ['Ward_Name', 'Zone_Name'];
  const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  return true;
};

// Get next available Ward_ID
const getNextWardId = async (connection) => {
  try {
    const [results] = await connection.query(
      'SELECT Ward_ID FROM ward_details ORDER BY Ward_ID DESC LIMIT 1'
    );
    
    let nextId = 1;
    if (results.length > 0) {
      nextId = results[0].Ward_ID + 1;
    }
    console.log('Next Ward_ID:', nextId);
    return nextId;
  } catch (err) {
    console.error('Error getting next Ward_ID:', err);
    return 1; // Default to 1 if error
  }
};

// Lookup Zone_ID from Zone_Name
const getZoneIdByName = async (connection, zoneName) => {
  if (!zoneName) return null;
  
  try {
    const [results] = await connection.query(
      'SELECT Zone_ID, Zone_Name FROM zone_details WHERE Zone_Name = ? OR Zone_ID = ?',
      [zoneName, zoneName]
    );
    
    if (results.length > 0) {
      const zoneId = results[0].Zone_ID;
      const foundName = results[0].Zone_Name;
      console.log(`Zone lookup: "${zoneName}" -> ID: ${zoneId}, Found: "${foundName}"`);
      return zoneId;
    } else {
      console.log(`❌ No zone found for: "${zoneName}"`);
      return null;
    }
  } catch (err) {
    console.error('Zone lookup error:', err);
    return null;
  }
};

// Check if ward name already exists (prevent duplicates)
const wardNameExists = async (connection, wardName) => {
  try {
    const [results] = await connection.query(
      'SELECT Ward_ID, Ward_Name FROM ward_details WHERE Ward_Name = ?',
      [wardName]
    );
    
    if (results.length > 0) {
      console.log(`Ward name "${wardName}" already exists with ID: ${results[0].Ward_ID}`);
      return results[0];
    }
    return null;
  } catch (err) {
    console.error('Error checking ward name:', err);
    return null;
  }
};

// Check if ward exists by ID
const wardExists = async (connection, wardId) => {
  try {
    const [results] = await connection.query(
      'SELECT Ward_ID FROM ward_details WHERE Ward_ID = ?',
      [wardId]
    );
    return results.length > 0;
  } catch (err) {
    console.error('Error checking if ward exists:', err);
    return false;
  }
};

// Insert new ward with auto-generated ID
const insertWard = async (connection, wardData) => {
  const { Ward_Name, Zone_Name } = wardData;
  
  console.log('Inserting new ward:', wardData);
  
  // Check if ward name already exists
  const existingWard = await wardNameExists(connection, Ward_Name);
  if (existingWard) {
    throw new Error(`Ward name "${Ward_Name}" already exists with ID: ${existingWard.Ward_ID}`);
  }
  
  // Lookup Zone_ID from Zone_Name
  const zoneId = await getZoneIdByName(connection, Zone_Name);
  if (!zoneId) {
    throw new Error(`Zone "${Zone_Name}" not found`);
  }
  
  // Get next available Ward_ID
  const wardId = await getNextWardId(connection);
  
  try {
    const query = `
      INSERT INTO ward_details (
        Ward_ID, Ward_Name, Zone_ID, Created_Date, Updated_Date
      ) VALUES (?, ?, ?, NOW(), NOW())
    `;
    
    const params = [wardId, Ward_Name, zoneId];
    
    console.log('Executing INSERT query:', query);
    console.log('With parameters:', params);
    
    const [result] = await connection.query(query, params);
    console.log('✅ INSERT query result:', result);
    console.log(`✅ Inserted ${result.affectedRows} rows, Ward_ID: ${wardId}`);
    
    return { type: 'insert', wardId: wardId, zoneId: zoneId };
  } catch (err) {
    console.error('❌ INSERT query error:', err);
    throw err;
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
      // Start transaction
      await connection.beginTransaction();
      console.log('Database transaction started');
      
      for (const row of csvData) {
        processedCount++;
        
        try {
          // Validate row data
          validateRow(row);
          
          // Insert ward with auto-generated ID and zone lookup
          const result = await insertWard(connection, row);
          
          results.push({
            row: processedCount,
            wardId: result.wardId,
            wardName: row.Ward_Name,
            zoneName: row.Zone_Name,
            zoneId: result.zoneId,
            status: 'success',
            type: result.type,
            message: `Ward "${row.Ward_Name}" created successfully with ID: ${result.wardId} in Zone: ${row.Zone_Name} (${result.zoneId})`
          });
          
          successCount++;
          
        } catch (rowError) {
          errors.push({
            row: processedCount,
            wardName: row.Ward_Name || 'N/A',
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
      message: 'Ward bulk upload failed',
      error: error.message
    });
  }
};
