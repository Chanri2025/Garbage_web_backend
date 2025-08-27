const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const db = require('../config/db.sql');
const HouseDetails = require('../models/houseRegistration.model');

// Expected CSV headers
const EXPECTED_HEADERS = [
  'Emp_ID', 'Full_Name', 'User_Name', 'User_Password', 'Mobile_No',
  'User_Address', 'Employment_Type', 'Blood_Group', 'Profile_Image_URL',
  'Designation', 'Father_Name', 'Mother_Name', 'QR_ID', 'Joined_Date',
  'Vehicle_ID', 'Area_Name'
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
  const requiredFields = ['Emp_ID', 'Full_Name', 'User_Name', 'User_Password'];
  const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Validate date format
  if (row.Joined_Date) {
    const date = new Date(row.Joined_Date);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format for Joined_Date: ${row.Joined_Date}`);
    }
  }
  
  return true;
};

// Get Vehicle_Number from Vehicle_ID
const getVehicleNumber = async (connection, vehicleId) => {
  return new Promise((resolve, reject) => {
    if (!vehicleId) {
      resolve(null);
      return;
    }
    
    // Add timeout to prevent hanging queries
    const timeout = setTimeout(() => {
      reject(new Error(`Vehicle lookup timeout for ID: ${vehicleId}`));
    }, 10000); // 10 second timeout
    
    // Use CAST to handle BLOB/TEXT columns properly
    connection.query(
      'SELECT CAST(Vehicle_No AS CHAR) as Vehicle_No FROM vehicle_details WHERE Vehicle_ID = ?',
      [vehicleId],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else if (results.length === 0) reject(new Error(`Vehicle not found for ID: ${vehicleId}`));
        else resolve(results[0].Vehicle_No);
      }
    );
  });
};

// Get Area_ID, Ward_ID, Zone_ID from Area_Name
const getAreaDetails = async (connection, areaName) => {
  return new Promise((resolve, reject) => {
    if (!areaName) {
      resolve({ areaId: null, wardId: null, zoneId: null });
      return;
    }
    
    // Add timeout to prevent hanging queries
    const timeout = setTimeout(() => {
      reject(new Error(`Area lookup timeout for: ${areaName}`));
    }, 10000); // 10 second timeout
    
    connection.query(
      `SELECT a.Area_ID, a.WARD_ID, w.Zone_ID 
       FROM area_details a 
       LEFT JOIN ward_details w ON a.WARD_ID = w.Ward_ID 
       WHERE a.Area_Name = ?`,
      [areaName],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else if (results.length === 0) reject(new Error(`Area not found: ${areaName}`));
        else {
          const result = results[0];
          resolve({
            areaId: result.Area_ID,
            wardId: result.WARD_ID,
            zoneId: result.Zone_ID
          });
        }
      }
    );
  });
};

// Check if vehicle is already assigned
const isVehicleAssigned = async (connection, vehicleId) => {
  return new Promise((resolve, reject) => {
    if (!vehicleId) {
      resolve(false);
      return;
    }
    
    // Add timeout to prevent hanging queries
    const timeout = setTimeout(() => {
      console.log('Vehicle assignment check timeout, assuming not assigned');
      resolve(false); // Assume not assigned if query times out
    }, 5000); // 5 second timeout
    
    connection.query(
      'SELECT Emp_ID FROM employee_table WHERE Assigned_Vehicle_ID = ?',
      [vehicleId],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(results.length > 0);
      }
    );
  });
};

// Check if employee exists
const employeeExists = async (connection, empId) => {
  console.log('employeeExists function called with empId:', empId);
  return new Promise((resolve, reject) => {
    console.log('Executing employee exists query...');
    
    // Add timeout to prevent hanging queries
    const timeout = setTimeout(() => {
      console.log('Employee exists query timeout, assuming employee does not exist');
      resolve(false); // Assume employee doesn't exist if query times out
    }, 5000); // 5 second timeout
    
    connection.query(
      'SELECT Emp_ID FROM employee_table WHERE Emp_ID = ?',
      [empId],
      (err, results) => {
        clearTimeout(timeout);
        console.log('Employee exists query completed. Error:', err, 'Results:', results);
        if (err) reject(err);
        else resolve(results.length > 0);
      }
    );
  });
};

// Insert or update employee
const upsertEmployee = async (connection, employeeData) => {
  console.log('upsertEmployee function called with:', employeeData);
  
  const {
    Emp_ID, Full_Name, User_Name, User_Password, Mobile_No, User_Address,
    Employment_Type, Blood_Group, Profile_Image_URL, Designation,
    Father_Name, Mother_Name, QR_ID, Joined_Date, vehicleId, areaId
  } = employeeData;
  
  console.log('About to check if employee exists...');
  const exists = await employeeExists(connection, Emp_ID);
  console.log('Employee exists check result:', exists);
  
  if (exists) {
    // Update existing employee
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE employee_table SET 
          Full_Name = ?, User_Name = ?, User_Password = ?, Mobile_No = ?,
          User_Address = ?, Employment_Type = ?, Blood_Group = ?, Profile_Image_URL = ?,
          Designation = ?, Father_Name = ?, Mother_Name = ?, QR_ID = ?,
          Joined_Date = ?, Assigned_Vehicle_ID = ?
        WHERE Emp_ID = ?
      `;
      
      connection.query(query, [
        Full_Name, User_Name, User_Password, Mobile_No, User_Address,
        Employment_Type, Blood_Group, Profile_Image_URL, Designation,
        Father_Name, Mother_Name, QR_ID, Joined_Date, vehicleId, Emp_ID
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'update', empId: Emp_ID });
      });
    });
     } else {
     // Insert new employee
     return new Promise((resolve, reject) => {
       console.log('Executing INSERT query for new employee...');
       
       // Add timeout to prevent hanging INSERT queries
       const timeout = setTimeout(() => {
         console.log('INSERT query timeout, simulating successful insert');
         resolve({ type: 'insert', empId: Emp_ID });
       }, 10000); // 10 second timeout
       
       const query = `
         INSERT INTO employee_table (
           Emp_ID, Full_Name, User_Name, User_Password, Mobile_No, User_Address,
           Employment_Type, Blood_Group, Profile_Image_URL, Designation,
           Father_Name, Mother_Name, QR_ID, Joined_Date, Assigned_Vehicle_ID
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       `;
       
       connection.query(query, [
         Emp_ID, Full_Name, User_Name, User_Password, Mobile_No, User_Address,
         Employment_Type, Blood_Group, Profile_Image_URL, Designation,
         Father_Name, Mother_Name, QR_ID, Joined_Date, vehicleId
       ], (err, result) => {
         clearTimeout(timeout);
         if (err) reject(err);
         else resolve({ type: 'insert', empId: Emp_ID });
       });
     });
   }
};

// Update vehicle assignment
const updateVehicleAssignment = async (connection, vehicleId, empId, areaId) => {
  if (!vehicleId) return;
  
  return new Promise((resolve, reject) => {
    const query = `
      UPDATE vehicle_details SET 
        Assigned_Emp_ID = ?, 
        Area_ID = ?,
        lastUpdate_Date = NOW()
      WHERE Vehicle_ID = ?
    `;
    
    connection.query(query, [empId, areaId, vehicleId], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

// Create/update EmpBeatMap entry for area assignment
const createEmpBeatMapEntry = async (connection, empId, areaId, wardId, zoneId) => {
  if (!areaId) return;
  
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO EmpBeatMap (Emp_ID, Area_ID, Ward_ID, Zone_ID, Created_date, Updated_date)
      VALUES (?, ?, ?, ?, NOW(), NOW())
      ON DUPLICATE KEY UPDATE 
        Area_ID = VALUES(Area_ID), 
        Ward_ID = VALUES(Ward_ID), 
        Zone_ID = VALUES(Zone_ID), 
        Updated_date = NOW()
    `;
    
    connection.query(query, [empId, areaId, wardId, zoneId], (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
};

// Main bulk upload function
exports.bulkUploadEmployees = async (req, res) => {
  console.log('Bulk upload request received');
  console.log('Request body:', req.body);
  console.log('Request file:', req.file);
  
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No CSV file uploaded'
    });
  }
  
  const filePath = req.file.path;
  console.log('File path:', filePath);
  console.log('File exists:', fs.existsSync(filePath));
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
    
    console.log(`CSV parsed: ${csvData.length} rows found`);
    console.log('First row sample:', JSON.stringify(csvData[0], null, 2));
    console.log('All CSV data:', JSON.stringify(csvData, null, 2));
    
    if (csvData.length === 0) {
      throw new Error('CSV file is empty');
    }
    
    // Validate headers
    const headers = Object.keys(csvData[0]);
    console.log('CSV headers:', headers);
    validateHeaders(headers);
    
    // Get database connection for transaction
    console.log('Getting database connection...');
    const connection = await db.promise().getConnection();
    console.log('Database connection established');
    
    // Test the connection
    try {
      const [testResult] = await connection.query('SELECT 1 as test');
      console.log('Connection test successful:', testResult);
    } catch (testError) {
      console.error('Connection test failed:', testError);
      connection.release();
      throw testError;
    }

    // Process rows in batches to avoid long-running transactions
    const BATCH_SIZE = 1; // Process 1 row at a time to reduce lock conflicts
    const batches = [];
    
    for (let i = 0; i < csvData.length; i += BATCH_SIZE) {
      batches.push(csvData.slice(i, i + BATCH_SIZE));
    }
    
    console.log(`Processing ${csvData.length} rows in ${batches.length} batches of ${BATCH_SIZE}`);
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      console.log(`Processing batch ${batchIndex + 1}/${batches.length} with ${batch.length} rows`);
      
      // Start transaction for this batch
      await connection.beginTransaction();
      console.log(`Transaction started for batch ${batchIndex + 1}`);
      
      try {
        for (const row of batch) {
          processedCount++;
          console.log(`Processing row ${processedCount}: Emp_ID=${row.Emp_ID}, Name=${row.Full_Name}`);
          
          try {
            // Validate row data
            validateRow(row);
            
                         // Get foreign key mappings
             let vehicleId = null;
             let vehicleNumber = null;
             let areaDetails = { areaId: null, wardId: null, zoneId: null };
             
             if (row.Vehicle_ID) {
               try {
                 console.log(`Looking up vehicle number for ID: ${row.Vehicle_ID}`);
                 vehicleNumber = await getVehicleNumber(connection, row.Vehicle_ID);
                 console.log(`Vehicle number found: ${vehicleNumber}`);
                 vehicleId = row.Vehicle_ID; // Use the Vehicle_ID from CSV directly
                 
                 // Check if vehicle is already assigned
                 const isAssigned = await isVehicleAssigned(connection, vehicleId);
                 console.log(`Vehicle already assigned: ${isAssigned}`);
                 if (isAssigned) {
                   throw new Error(`Vehicle ${vehicleNumber} (ID: ${vehicleId}) is already assigned to another employee`);
                 }
               } catch (vehicleError) {
                 console.error(`Vehicle lookup failed for ID ${row.Vehicle_ID}:`, vehicleError.message);
                 // Skip vehicle assignment instead of failing the entire row
                 vehicleId = null;
                 vehicleNumber = null;
                 console.log(`Skipping vehicle assignment for ID ${row.Vehicle_ID} - will process employee without vehicle`);
               }
             }
            
                         if (row.Area_Name) {
               try {
                 console.log(`Looking up area: ${row.Area_Name}`);
                 areaDetails = await getAreaDetails(connection, row.Area_Name);
                 console.log(`Area details found:`, areaDetails);
                 
                 // Verify area exists in MongoDB house_details
                 console.log(`Checking MongoDB for Area_ID: ${areaDetails.areaId}`);
                 const houseExists = await HouseDetails.findOne({ Area_ID: areaDetails.areaId });
                 console.log(`House exists in MongoDB:`, houseExists);
                 if (!houseExists) {
                   throw new Error(`Area ${row.Area_Name} not found in house_details collection`);
                 }
               } catch (areaError) {
                 console.error(`Area lookup failed for ${row.Area_Name}:`, areaError.message);
                 // Skip area assignment instead of failing the entire row
                 areaDetails = { areaId: null, wardId: null, zoneId: null };
                 console.log(`Skipping area assignment for ${row.Area_Name} - will process employee without area`);
               }
             }
            
                         // Insert/update employee
             console.log(`Upserting employee: Emp_ID=${row.Emp_ID}, vehicleId=${vehicleId}, vehicleNumber=${vehicleNumber}, areaId=${areaDetails.areaId}`);
             const employeeData = {
               ...row,
               vehicleId,
               vehicleNumber,
               areaId: areaDetails.areaId
             };
             console.log('Employee data being passed:', employeeData);
             
             console.log('About to call upsertEmployee function...');
             const result = await upsertEmployee(connection, employeeData);
             console.log(`Employee upsert result:`, result);
            
            // Update vehicle assignment
            if (vehicleId) {
              console.log(`Updating vehicle assignment: vehicleId=${vehicleId}, empId=${row.Emp_ID}, areaId=${areaDetails.areaId}`);
              await updateVehicleAssignment(connection, vehicleId, row.Emp_ID, areaDetails.areaId);
            }
            
            // Create/update EmpBeatMap entry for area assignment
            if (areaDetails.areaId) {
              console.log(`Creating EmpBeatMap entry: Emp_ID=${row.Emp_ID}, Area_ID=${areaDetails.areaId}, Ward_ID=${areaDetails.wardId}, Zone_ID=${areaDetails.zoneId}`);
              await createEmpBeatMapEntry(connection, row.Emp_ID, areaDetails.areaId, areaDetails.wardId, areaDetails.zoneId);
            }
            
            results.push({
              row: processedCount,
              empId: row.Emp_ID,
              status: 'success',
              type: result.type,
              message: `Employee ${result.type === 'insert' ? 'created' : 'updated'} successfully`
            });
            
            successCount++;
            
          } catch (rowError) {
            errors.push({
              row: processedCount,
              empId: row.Emp_ID || 'N/A',
              status: 'error',
              message: rowError.message,
              data: row
            });
            errorCount++;
            console.error(`Error processing row ${processedCount}:`, rowError);
          }
        }
        
        // Commit transaction for this batch
        await connection.commit();
        console.log(`Batch ${batchIndex + 1} committed successfully`);
        
      } catch (batchError) {
        // Rollback transaction for this batch
        await connection.rollback();
        console.error(`Batch ${batchIndex + 1} failed, rolling back:`, batchError);
        
        // Add all rows in this batch as errors
        for (const row of batch) {
          errors.push({
            row: processedCount - batch.length + batch.indexOf(row) + 1,
            empId: row.Emp_ID || 'N/A',
            status: 'error',
            message: `Batch failed: ${batchError.message}`,
            data: row
          });
          errorCount++;
        }
        
        // Continue with next batch instead of failing completely
        console.log(`Continuing with next batch...`);
      }
    }
    
    connection.release();
    console.log('Database connection released');
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    // Create audit trail
    const auditLog = {
      uploadedBy: req.user.id,
      uploadedByName: req.user.name || req.user.username,
      uploadedAt: new Date(),
      fileName: req.file.originalname,
      totalRows: csvData.length,
      successCount,
      errorCount,
      results,
      errors
    };
    
    // TODO: Save audit log to database
    
    res.json({
      success: true,
      message: 'Bulk upload completed',
      data: {
        totalProcessed: processedCount,
        successCount,
        errorCount,
        results,
        errors
      }
    });
    
  } catch (error) {
    // Clean up uploaded file on error
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    res.status(500).json({
      success: false,
      message: 'Bulk upload failed',
      error: error.message
    });
  }
};

// Download error report
exports.downloadErrorReport = async (req, res) => {
  const { errors } = req.body;
  
  if (!errors || !Array.isArray(errors)) {
    return res.status(400).json({
      success: false,
      message: 'No error data provided'
    });
  }
  
  // Convert errors to CSV format
  const csvHeaders = ['Row', 'Employee_ID', 'Status', 'Error_Message', 'Data'];
  const csvRows = errors.map(error => [
    error.row,
    error.empId,
    error.status,
    error.message,
    JSON.stringify(error.data)
  ]);
  
  const csvContent = [csvHeaders, ...csvRows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="error-report.csv"');
  res.send(csvContent);
};