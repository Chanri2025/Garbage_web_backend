const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for dumpyard upload
const EXPECTED_HEADERS = [
  'DY_Name', 'Coordinates', 'Zone_Name', 'Ward_Name' // Dump_Yard_ID will be auto-generated
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
  const requiredFields = ['DY_Name'];
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

// Get next available Dump_Yard_ID
const getNextDumpYardId = async (connection) => {
  try {
    const [results] = await connection.query(
      'SELECT DY_ID FROM dump_yard_details ORDER BY DY_ID DESC LIMIT 1'
    );
    
    let nextId = 1;
    if (results.length > 0) {
      nextId = results[0].DY_ID + 1;
    }
    console.log('Next DY_ID:', nextId);
    return nextId;
  } catch (err) {
    console.error('Error getting next DY_ID:', err);
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
      'SELECT Zone_ID, Zone_Name FROM zone_details WHERE TRIM(Zone_Name) = ?',
      [trimmedZoneName]
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
      'SELECT Ward_ID, Ward_Name FROM ward_details WHERE TRIM(Ward_Name) = ?',
      [trimmedWardName]
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
      console.log(`✅ Zone-Ward relationship valid: "${zoneName}" contains "${wardName}"`);
      return true;
    } else {
      console.log(`❌ Zone-Ward relationship invalid: "${wardName}" does not belong to "${zoneName}"`);
      return false;
    }
  } catch (err) {
    console.error('Zone-Ward relationship validation error:', err);
    return false;
  }
};

// Insert new dumpyard with auto-generated ID
const insertDumpYard = async (connection, dumpYardData) => {
  const { DY_Name, Coordinates, Zone_Name, Ward_Name } = dumpYardData;
  
  console.log('Inserting new dumpyard:', dumpYardData);
  
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
  
  // Get next available DY_ID
  const dumpYardId = await getNextDumpYardId(connection);
  
  try {
    const query = `
      INSERT INTO dump_yard_details (
        DY_ID, DY_Name, Coordinates, Zone_ID, Ward_ID, Created_Date, Update_Date
      ) VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    `;
    
    const params = [dumpYardId, DY_Name, Coordinates || null, zoneId, wardId];
    
    console.log('Executing INSERT query:', query);
    console.log('With parameters:', params);
    
    const [result] = await connection.query(query, params);
    console.log('✅ INSERT query result:', result);
    console.log(`✅ Inserted ${result.affectedRows} rows, DY_ID: ${dumpYardId}`);
    
    return { 
      type: 'insert', 
      dumpYardId: dumpYardId, 
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
exports.bulkUploadDumpYards = async (req, res) => {
  console.log('DumpYard bulk upload request received');
  
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
          // Trim all row data to handle whitespace issues
          const trimmedRow = {
            DY_Name: row.DY_Name ? row.DY_Name.trim() : row.DY_Name,
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
          
          // Insert dumpyard with auto-generated ID
          const result = await insertDumpYard(connection, trimmedRow);
          
          results.push({
            row: processedCount,
            dumpYardId: result.dumpYardId,
            dumpYardName: trimmedRow.DY_Name,
            zoneName: result.zoneName || null,
            wardName: result.wardName || null,
            zoneId: result.zoneId || null,
            wardId: result.wardId || null,
            status: 'success',
            type: result.type,
            message: `DumpYard "${trimmedRow.DY_Name}" created successfully with ID: ${result.dumpYardId}${result.zoneName ? ` in Zone: ${result.zoneName}` : ''}${result.wardName ? ` and Ward: ${result.wardName}` : ''}`
          });
          
          successCount++;
          
        } catch (rowError) {
          // Use trimmed data if available, otherwise fall back to original
          const errorRow = typeof trimmedRow !== 'undefined' ? trimmedRow : row;
          errors.push({
            row: processedCount,
            dumpYardName: errorRow.DY_Name || 'N/A',
            zoneName: errorRow.Zone_Name || 'N/A',
            wardName: errorRow.Ward_Name || 'N/A',
            status: 'error',
            message: rowError.message,
            data: errorRow
          });
          errorCount++;
        }
      }
      
      connection.release();
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
      res.json({
        success: true,
        message: 'DumpYard bulk upload completed',
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
      message: 'DumpYard bulk upload failed',
      error: error.message
    });
  }
};
