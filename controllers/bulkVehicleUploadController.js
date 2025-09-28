const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for vehicle upload
const EXPECTED_HEADERS = [
  'Vehicle_No', 'Vehicle_Type', 'Assigned_Employee', 'isActive',
  'Description', 'Joined_Date', 'Area_Name', 'Device_Type'
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
  
  const requiredFields = ['Vehicle_No', 'Vehicle_Type'];
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
      console.error(`❌ VALIDATION ERROR: isActive field contains '${row.isActive}' which should be 1/0 or true/false`);
      console.error('❌ This suggests your CSV columns are in the wrong order!');
      console.error('❌ Expected order: Vehicle_No,Vehicle_Type,Assigned_Employee,isActive,Description,Joined_Date,Area_Name,Device_Type');
      throw new Error(`Invalid boolean value for isActive: ${row.isActive}. Expected 1/0 or true/false, but got area name. Check your CSV column order!`);
    }
  }
  
  console.log('Row validation successful');
  return true;
};

// Check if vehicle exists
const vehicleExists = async (connection, vehicleId) => {
  try {
    const [results] = await connection.query(
      'SELECT Vehicle_ID FROM vehicle_details WHERE Vehicle_ID = ?',
      [vehicleId]
    );
    return results.length > 0;
  } catch (err) {
    console.error('Error checking if vehicle exists:', err);
    return false;
  }
};

// Lookup Employee ID from employee name
const getEmployeeIdByName = async (connection, employeeName) => {
  if (!employeeName) return null;
  
  try {
    const [results] = await connection.query(
      'SELECT Emp_ID, Full_Name FROM employee_table WHERE Full_Name = ? OR Emp_ID = ? OR Full_Name LIKE ? OR User_Name = ?',
      [employeeName, employeeName, `%${employeeName}%`, employeeName]
    );
    
    if (results.length > 0) {
      const empId = results[0].Emp_ID;
      const foundName = results[0].Full_Name;
      console.log(`Employee lookup: "${employeeName}" -> ID: ${empId}, Found: "${foundName}"`);
      if (results.length > 1) {
        console.log(`⚠️ Multiple matches found for "${employeeName}":`, results.map(r => `${r.Emp_ID}: ${r.Full_Name}`));
      }
      return empId;
    } else {
      console.log(`❌ No employee found for: "${employeeName}"`);
      return null;
    }
  } catch (err) {
    console.error('Employee lookup error:', err);
    return null;
  }
};

// Lookup Area ID from area name
const getAreaIdByName = async (connection, areaName) => {
  if (!areaName) return null;
  
  try {
    const [results] = await connection.query(
      'SELECT Area_ID FROM area_details WHERE Area_Name = ? OR Area_ID = ?',
      [areaName, areaName]
    );
    
    const areaId = results.length > 0 ? results[0].Area_ID : null;
    console.log(`Area lookup: ${areaName} -> ${areaId}`);
    return areaId;
  } catch (err) {
    console.error('Area lookup error:', err);
    return null;
  }
};

// Lookup Device ID from device type or name
const getDeviceIdByType = async (connection, deviceType) => {
  if (!deviceType) return null;
  
  try {
    const [results] = await connection.query(
      'SELECT Device_ID FROM device_details WHERE Device_Type = ? OR Device_ID = ?',
      [deviceType, deviceType]
    );
    
    const deviceId = results.length > 0 ? results[0].Device_ID : null;
    console.log(`Device lookup: ${deviceType} -> ${deviceId}`);
    return deviceId;
  } catch (err) {
    console.error('Device lookup error:', err);
    return null;
  }
};

// Get next available Vehicle_ID
const getNextVehicleId = async (connection) => {
  try {
    const [results] = await connection.query(
      'SELECT Vehicle_ID FROM vehicle_details ORDER BY Vehicle_ID DESC LIMIT 1'
    );
    
    let nextId = 1;
    if (results.length > 0) {
      nextId = results[0].Vehicle_ID + 1;
    }
    console.log('Next Vehicle_ID:', nextId);
    return nextId;
  } catch (err) {
    console.error('Error getting next Vehicle_ID:', err);
    return 1; // Default to 1 if error
  }
};

// Insert or update vehicle
const upsertVehicle = async (connection, vehicleData) => {
  const {
    Vehicle_ID, Vehicle_No, Vehicle_Type, Description, 
    Joined_Date, isActive, Area_ID, Device_ID, Assigned_EMP_ID
  } = vehicleData;
  
  console.log('Upserting vehicle with data:', vehicleData);
  
  // Auto-generate Vehicle_ID if not provided
  const vehicleId = Vehicle_ID || await getNextVehicleId(connection);
  console.log('Using Vehicle_ID:', vehicleId);
  
  const exists = await vehicleExists(connection, vehicleId);
  console.log('Vehicle exists check result:', exists);
  
  if (exists) {
    // Update existing vehicle
    try {
      const query = `
        UPDATE vehicle_details SET 
          Vehicle_No = ?, Vehicle_Type = ?, Description = ?, 
          Joined_Date = ?, isActive = ?, Area_ID = ?, Device_ID = ?,
          Assigned_EMP_ID = ?, lastUpdate_Date = NOW()
        WHERE Vehicle_ID = ?
      `;
      
      const params = [
        Vehicle_No, Vehicle_Type, Description, Joined_Date, 
        isActive === 'true' || isActive === '1' || isActive === 'yes' ? 1 : 0,
        Area_ID || null, Device_ID || null, Assigned_EMP_ID || null, vehicleId
      ];
      
      console.log('Executing UPDATE query:', query);
      console.log('With parameters:', params);
      
      const [result] = await connection.query(query, params);
      console.log('✅ UPDATE query result:', result);
      console.log(`✅ Updated ${result.affectedRows} rows, changed ${result.changedRows} rows`);
      if (result.affectedRows === 0) {
        console.warn('⚠️ UPDATE query affected 0 rows - vehicle may not exist');
      }
      return { type: 'update', vehicleId: vehicleId };
    } catch (err) {
      console.error('❌ UPDATE query error:', err);
      throw err;
    }
  } else {
    // Insert new vehicle
    try {
      const query = `
        INSERT INTO vehicle_details (
          Vehicle_ID, Vehicle_No, Vehicle_Type, Description, 
          Joined_Date, isActive, Area_ID, Device_ID, Assigned_EMP_ID, lastUpdate_Date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `;
      
      const params = [
        vehicleId, Vehicle_No, Vehicle_Type, Description, Joined_Date,
        isActive === 'true' || isActive === '1' || isActive === 'yes' ? 1 : 0,
        Area_ID || null, Device_ID || null, Assigned_EMP_ID || null
      ];
      
      console.log('Executing INSERT query:', query);
      console.log('With parameters:', params);
      
      const [result] = await connection.query(query, params);
      console.log('✅ INSERT query result:', result);
      console.log(`✅ Inserted ${result.affectedRows} rows, insertId: ${result.insertId}`);
      if (result.affectedRows === 0) {
        console.warn('⚠️ INSERT query affected 0 rows - insertion may have failed');
      }
      return { type: 'insert', vehicleId: vehicleId };
    } catch (err) {
      console.error('❌ INSERT query error:', err);
      throw err;
    }
  }
};

// Main bulk upload function
exports.bulkUploadVehicles = async (req, res) => {
  console.log('Vehicle bulk upload request received');
  console.log('Request file:', JSON.stringify(req.file, null, 2));
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  console.log('Content type:', req.get('Content-Type'));
  
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
    // Check if file exists and is readable
    if (!fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle bulk upload failed',
        error: 'CSV file not found'
      });
    }

    // Check file size and content
    const fileContent = fs.readFileSync(filePath, 'utf8');
    console.log('File size:', fileContent.length);
    console.log('First 100 chars:', fileContent.substring(0, 100));
    
    if (!fileContent.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle bulk upload failed',
        error: 'CSV file is empty'
      });
    }

    // Parse CSV file
    const csvData = [];
    await new Promise((resolve, reject) => {
      // Read and log raw file content
      const rawContent = fs.readFileSync(filePath, 'utf8');
      console.log('Raw file content length:', rawContent.length);
      console.log('Raw file content first 500 chars:', rawContent.substring(0, 500));
      console.log('File content lines:', rawContent.split('\n').length);
      
      // Create read stream
      const stream = fs.createReadStream(filePath, { encoding: 'utf8' })
        .on('error', (error) => {
          console.error('Stream error:', error);
          reject(new Error(`Failed to read CSV file: ${error.message}`));
        });

      // First, normalize line endings and split content by lines
      // Handle both actual newlines and escaped newlines
      let normalizedContent = rawContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // If the content has literal \n characters instead of actual newlines, replace them
      if (normalizedContent.includes('\\n')) {
        normalizedContent = normalizedContent.replace(/\\n/g, '\n');
      }
      
      const lines = normalizedContent.split('\n').filter(line => line.trim().length > 0);
      
      console.log('Number of non-empty lines:', lines.length);
      console.log('Lines:', lines);
      
      if (lines.length < 2) {
        reject(new Error('CSV file must have at least a header row and one data row'));
        return;
      }

      // Get headers from first line
      const headers = lines[0].split(',').map(h => h.trim());
      console.log('📋 CSV Headers found:', headers);
      console.log('📋 Expected headers:', EXPECTED_HEADERS);
      
      // Show mapping for debugging
      console.log('📋 Header mapping:');
      headers.forEach((header, index) => {
        console.log(`   Column ${index + 1}: "${header}" -> Expected: "${EXPECTED_HEADERS[index] || 'EXTRA COLUMN'}"`);
      });

      // Process data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        console.log(`Processing line ${i}:`, line);
        
        const values = line.split(',').map(v => v.trim());
        console.log('Processing row:', values);
        
        if (values.length === headers.length) {
          const row = {};
          headers.forEach((header, index) => {
            row[header] = values[index];
          });
          console.log('Created row object:', row);
          csvData.push(row);
        } else {
          console.warn(`Skipping invalid row ${i + 1}: column count mismatch`);
        }
      }
      
      console.log('Processed rows:', csvData.length);
      resolve();

      parser.on('error', (error) => {
        console.error('CSV Parser error:', error);
        reject(error);
      });

      // Event handlers removed since we're processing the file directly
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
          
          // Perform lookups for names to IDs
          console.log('Performing lookups for row:', row);
          
          // Lookup Employee ID from name (optional)
          let employeeId = null;
          if (row.Assigned_Employee && row.Assigned_Employee.trim() !== '') {
            employeeId = await getEmployeeIdByName(connection, row.Assigned_Employee);
            if (!employeeId) {
              // Show available employees for debugging
              console.log('🔍 Employee not found. Checking available employees...');
              try {
              const [availableEmployees] = await connection.query(
                'SELECT Emp_ID, Full_Name FROM employee_table LIMIT 10'
              );
                console.log('📋 Available employees (first 10):');
                availableEmployees.forEach(emp => {
                  console.log(`   - ID: ${emp.Emp_ID}, Name: "${emp.Full_Name}"`);
                });
              } catch (debugErr) {
                console.error('Error fetching available employees:', debugErr);
              }
              console.warn(`⚠️ Employee '${row.Assigned_Employee}' not found. Vehicle will be created without employee assignment.`);
              employeeId = null; // Set to null instead of throwing error
            }
          } else {
            console.log('ℹ️ No employee specified for this vehicle');
          }
          
          // Lookup Area ID from name (optional)
          let areaId = null;
          if (row.Area_Name && row.Area_Name.trim() !== '') {
            areaId = await getAreaIdByName(connection, row.Area_Name);
            if (!areaId) {
              console.warn(`⚠️ Area '${row.Area_Name}' not found. Vehicle will be created without area assignment.`);
            }
          }
          
          // Lookup Device ID from type (optional)
          let deviceId = null;
          if (row.Device_Type && row.Device_Type.trim() !== '') {
            deviceId = await getDeviceIdByType(connection, row.Device_Type);
            if (!deviceId) {
              console.warn(`⚠️ Device type '${row.Device_Type}' not found. Vehicle will be created without device assignment.`);
            }
          }
          
          // Create updated row data with IDs
          const vehicleDataWithIds = {
            ...row,
            Assigned_EMP_ID: employeeId,
            Area_ID: areaId,
            Device_ID: deviceId
          };
          
          console.log('Vehicle data with IDs:', vehicleDataWithIds);
          
          // Insert/update vehicle
          const result = await upsertVehicle(connection, vehicleDataWithIds);
          
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
      
      // Commit transaction
      await connection.commit();
      console.log('Database transaction committed successfully');
      
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
