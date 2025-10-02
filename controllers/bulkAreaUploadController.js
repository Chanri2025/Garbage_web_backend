const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for area upload
const EXPECTED_HEADERS = [
  'Area_Name', 'Coordinates', 'Zone_Name', 'Ward_Name' // Area_ID will be auto-generated
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
  const requiredFields = ['Area_Name'];
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

// Get next available Area_ID
const getNextAreaId = async (connection) => {
  try {
    const [results] = await connection.query(
      'SELECT Area_ID FROM area_details ORDER BY Area_ID DESC LIMIT 1'
    );
    
    let nextId = 1;
    if (results.length > 0) {
      nextId = results[0].Area_ID + 1;
    }
    console.log('Next Area_ID:', nextId);
    return nextId;
  } catch (err) {
    console.error('Error getting next Area_ID:', err);
    return 1; // Default to 1 if error
  }
};

// Lookup Zone_ID from Zone_Name
const getZoneIdByName = async (connection, zoneName) => {
  if (!zoneName) return null;
  
  // Trim whitespace and normalize the zone name
  const trimmedZoneName = zoneName.trim();
  
  try {
    const [results] = await connection.query(
      'SELECT Zone_ID, Zone_Name FROM zone_details WHERE TRIM(Zone_Name) = ? OR Zone_ID = ?',
      [trimmedZoneName, trimmedZoneName]
    );
    
    if (results.length > 0) {
      const zoneId = results[0].Zone_ID;
      const foundName = results[0].Zone_Name;
      console.log(`Zone lookup: "${zoneName}" (trimmed: "${trimmedZoneName}") -> ID: ${zoneId}, Found: "${foundName}"`);
      return zoneId;
    } else {
      console.log(`❌ No zone found for: "${zoneName}" (trimmed: "${trimmedZoneName}")`);
      return null;
    }
  } catch (err) {
    console.error('Zone lookup error:', err);
    return null;
  }
};

// Lookup Ward_ID from Ward_Name
const getWardIdByName = async (connection, wardName) => {
  if (!wardName) return null;
  
  // Trim whitespace and normalize the ward name
  const trimmedWardName = wardName.trim();
  
  try {
    const [results] = await connection.query(
      'SELECT Ward_ID, Ward_Name FROM ward_details WHERE TRIM(Ward_Name) = ? OR Ward_ID = ?',
      [trimmedWardName, trimmedWardName]
    );
    
    if (results.length > 0) {
      const wardId = results[0].Ward_ID;
      const foundName = results[0].Ward_Name;
      console.log(`Ward lookup: "${wardName}" (trimmed: "${trimmedWardName}") -> ID: ${wardId}, Found: "${foundName}"`);
      return wardId;
    } else {
      console.log(`❌ No ward found for: "${wardName}" (trimmed: "${trimmedWardName}")`);
      return null;
    }
  } catch (err) {
    console.error('Ward lookup error:', err);
    return null;
  }
};

// Check if area name already exists (prevent duplicates)
const areaNameExists = async (connection, areaName) => {
  try {
    const [results] = await connection.query(
      'SELECT Area_ID, Area_Name FROM area_details WHERE Area_Name = ?',
      [areaName]
    );
    
    if (results.length > 0) {
      console.log(`Area name "${areaName}" already exists with ID: ${results[0].Area_ID}`);
      return results[0];
    }
    return null;
  } catch (err) {
    console.error('Error checking area name:', err);
    return null;
  }
};

// Validate zone-ward relationship using names
const validateZoneWardRelationship = async (connection, zoneName, wardName) => {
  if (!zoneName || !wardName) return true; // Skip if either is missing
  
  // Trim whitespace from both names
  const trimmedZoneName = zoneName.trim();
  const trimmedWardName = wardName.trim();
  
  try {
    const [results] = await connection.query(
      `SELECT w.Ward_ID, w.Ward_Name, z.Zone_ID, z.Zone_Name 
       FROM ward_details w 
       JOIN zone_details z ON w.Zone_ID = z.Zone_ID 
       WHERE TRIM(w.Ward_Name) = ? AND TRIM(z.Zone_Name) = ?`,
      [trimmedWardName, trimmedZoneName]
    );
    
    if (results.length > 0) {
      console.log(`✅ Zone-Ward relationship valid: "${zoneName}" (trimmed: "${trimmedZoneName}") contains "${wardName}" (trimmed: "${trimmedWardName}")`);
      return true;
    } else {
      console.log(`❌ Zone-Ward relationship invalid: "${wardName}" (trimmed: "${trimmedWardName}") does not belong to "${zoneName}" (trimmed: "${trimmedZoneName}")`);
      
      // Let's also check what wards exist for this zone to help with debugging
      const [zoneWards] = await connection.query(
        `SELECT w.Ward_Name, z.Zone_Name 
         FROM ward_details w 
         JOIN zone_details z ON w.Zone_ID = z.Zone_ID 
         WHERE TRIM(z.Zone_Name) = ?`,
        [trimmedZoneName]
      );
      
      if (zoneWards.length > 0) {
        console.log(`Available wards in zone "${trimmedZoneName}":`, zoneWards.map(w => `"${w.Ward_Name}"`).join(', '));
      } else {
        console.log(`No wards found for zone "${trimmedZoneName}"`);
      }
      
      return false;
    }
  } catch (err) {
    console.error('Zone-Ward relationship validation error:', err);
    return false;
  }
};

// Insert new area with auto-generated ID and name-based lookups
const insertArea = async (connection, areaData) => {
  // Trim all input data to handle whitespace issues
  const Area_Name = areaData.Area_Name ? areaData.Area_Name.trim() : null;
  const Coordinates = areaData.Coordinates ? areaData.Coordinates.trim() : null;
  const Zone_Name = areaData.Zone_Name ? areaData.Zone_Name.trim() : null;
  const Ward_Name = areaData.Ward_Name ? areaData.Ward_Name.trim() : null;
  
  console.log('Inserting new area (trimmed):', { Area_Name, Coordinates, Zone_Name, Ward_Name });
  
  // Check if area name already exists
  const existingArea = await areaNameExists(connection, Area_Name);
  if (existingArea) {
    throw new Error(`Area name "${Area_Name}" already exists with ID: ${existingArea.Area_ID}`);
  }
  
  // Lookup Zone_ID from Zone_Name (if provided)
  let zoneId = null;
  if (Zone_Name) {
    zoneId = await getZoneIdByName(connection, Zone_Name);
    if (!zoneId) {
      throw new Error(`Zone "${Zone_Name}" not found`);
    }
  }
  
  // Lookup Ward_ID from Ward_Name (if provided)
  let wardId = null;
  if (Ward_Name) {
    wardId = await getWardIdByName(connection, Ward_Name);
    if (!wardId) {
      throw new Error(`Ward "${Ward_Name}" not found`);
    }
  }
  
  // Get next available Area_ID
  const areaId = await getNextAreaId(connection);
  
  try {
    const query = `
      INSERT INTO area_details (
        Area_ID, Area_Name, Coordinates, Zone_ID, WARD_ID, Created_Date, Update_Date
      ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    const params = [areaId, Area_Name, Coordinates || null, zoneId, wardId];
    
    console.log('Executing INSERT query:', query);
    console.log('With parameters:', params);
    
    const [result] = await connection.query(query, params);
    console.log('✅ INSERT query result:', result);
    console.log(`✅ Inserted ${result.affectedRows} rows, Area_ID: ${areaId}`);
    
    return { 
      type: 'insert', 
      areaId: areaId, 
      zoneId: zoneId, 
      wardId: wardId,
      zoneName: Zone_Name,
      wardName: Ward_Name
    };
  } catch (err) {
    console.error('❌ INSERT query error:', err);
    throw err;
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
      // Start transaction
      await connection.beginTransaction();
      console.log('Database transaction started');
      
      for (const row of csvData) {
        processedCount++;
        
        try {
          // Trim all row data to handle whitespace issues
          const trimmedRow = {
            Area_Name: row.Area_Name ? row.Area_Name.trim() : row.Area_Name,
            Coordinates: row.Coordinates ? row.Coordinates.trim() : row.Coordinates,
            Zone_Name: row.Zone_Name ? row.Zone_Name.trim() : row.Zone_Name,
            Ward_Name: row.Ward_Name ? row.Ward_Name.trim() : row.Ward_Name
          };
          
          // Validate row data
          validateRow(trimmedRow);
          
          // Validate zone-ward relationship (if both provided)
          if (trimmedRow.Zone_Name && trimmedRow.Ward_Name) {
            const relationshipValid = await validateZoneWardRelationship(connection, trimmedRow.Zone_Name, trimmedRow.Ward_Name);
            if (!relationshipValid) {
              throw new Error(`Ward "${trimmedRow.Ward_Name}" does not belong to Zone "${trimmedRow.Zone_Name}"`);
            }
          }
          
          // Insert area with auto-generated ID and name-based lookups
          const result = await insertArea(connection, trimmedRow);
          
          results.push({
            row: processedCount,
            areaId: result.areaId,
            areaName: trimmedRow.Area_Name,
            zoneName: result.zoneName || null,
            wardName: result.wardName || null,
            zoneId: result.zoneId || null,
            wardId: result.wardId || null,
            status: 'success',
            type: result.type,
            message: `Area "${trimmedRow.Area_Name}" created successfully with ID: ${result.areaId}${result.zoneName ? ` in Zone: ${result.zoneName}` : ''}${result.wardName ? ` and Ward: ${result.wardName}` : ''}`
          });
          
          successCount++;
          
        } catch (rowError) {
          // Use trimmed data if available, otherwise fall back to original
          const errorRow = typeof trimmedRow !== 'undefined' ? trimmedRow : row;
          errors.push({
            row: processedCount,
            areaName: errorRow.Area_Name || 'N/A',
            zoneName: errorRow.Zone_Name || 'N/A',
            wardName: errorRow.Ward_Name || 'N/A',
            status: 'error',
            message: rowError.message,
            data: errorRow
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
      message: 'Area bulk upload failed',
      error: error.message
    });
  }
};
