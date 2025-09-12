const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for area upload
const EXPECTED_HEADERS = [
  'Area_ID', 'Area_Name', 'Coordinates', 'Zone_ID', 'WARD_ID'
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
  const requiredFields = ['Area_ID', 'Area_Name'];
  const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Validate coordinates format (basic validation)
  if (row.Coordinates && !row.Coordinates.includes(',')) {
    throw new Error(`Invalid coordinates format. Expected: "lat,lng", got: ${row.Coordinates}`);
  }
  
  return true;
};

// Check if area exists
const areaExists = async (connection, areaId) => {
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

// Check if zone exists
const zoneExists = async (connection, zoneId) => {
  if (!zoneId) return true; // Optional field
  
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

// Check if ward exists
const wardExists = async (connection, wardId) => {
  if (!wardId) return true; // Optional field
  
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

// Validate zone-ward relationship
const validateZoneWardRelationship = async (connection, zoneId, wardId) => {
  if (!zoneId || !wardId) return true; // Skip if either is missing
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);
    
    connection.query(
      'SELECT Ward_ID FROM ward_details WHERE Ward_ID = ? AND Zone_ID = ?',
      [wardId, zoneId],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(results.length > 0);
      }
    );
  });
};

// Insert or update area
const upsertArea = async (connection, areaData) => {
  const {
    Area_ID, Area_Name, Coordinates, Zone_ID, WARD_ID
  } = areaData;
  
  const exists = await areaExists(connection, Area_ID);
  
  if (exists) {
    // Update existing area
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE area_details SET 
          Area_Name = ?, Coordinates = ?, Zone_ID = ?, WARD_ID = ?
        WHERE Area_ID = ?
      `;
      
      connection.query(query, [
        Area_Name, Coordinates || null, Zone_ID || null, 
        WARD_ID || null, Area_ID
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'update', areaId: Area_ID });
      });
    });
  } else {
    // Insert new area
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO area_details (
          Area_ID, Area_Name, Coordinates, Zone_ID, WARD_ID
        ) VALUES (?, ?, ?, ?, ?)
      `;
      
      connection.query(query, [
        Area_ID, Area_Name, Coordinates || null, 
        Zone_ID || null, WARD_ID || null
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'insert', areaId: Area_ID });
      });
    });
  }
};

// Main bulk upload function
exports.bulkUploadAreas = async (req, res) => {
  console.log('Area bulk upload request received');
  
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
          
          // Check if zone exists (if provided)
          if (row.Zone_ID) {
            const zoneExistsResult = await zoneExists(connection, row.Zone_ID);
            if (!zoneExistsResult) {
              throw new Error(`Zone_ID ${row.Zone_ID} not found`);
            }
          }
          
          // Check if ward exists (if provided)
          if (row.WARD_ID) {
            const wardExistsResult = await wardExists(connection, row.WARD_ID);
            if (!wardExistsResult) {
              throw new Error(`WARD_ID ${row.WARD_ID} not found`);
            }
          }
          
          // Validate zone-ward relationship
          if (row.Zone_ID && row.WARD_ID) {
            const relationshipValid = await validateZoneWardRelationship(connection, row.Zone_ID, row.WARD_ID);
            if (!relationshipValid) {
              throw new Error(`WARD_ID ${row.WARD_ID} does not belong to Zone_ID ${row.Zone_ID}`);
            }
          }
          
          // Insert/update area
          const result = await upsertArea(connection, row);
          
          results.push({
            row: processedCount,
            areaId: row.Area_ID,
            status: 'success',
            type: result.type,
            message: `Area ${result.type === 'insert' ? 'created' : 'updated'} successfully`
          });
          
          successCount++;
          
        } catch (rowError) {
          errors.push({
            row: processedCount,
            areaId: row.Area_ID || 'N/A',
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
        message: 'Area bulk upload completed',
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
      message: 'Area bulk upload failed',
      error: error.message
    });
  }
};
