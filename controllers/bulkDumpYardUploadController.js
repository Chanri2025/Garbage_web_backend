const csv = require('csv-parser');
const fs = require('fs');
const db = require('../config/db.sql');

// Expected CSV headers for dumpyard upload
const EXPECTED_HEADERS = [
  'Dump_Yard_ID', 'Dump_Yard_Name', 'Location', 'Capacity', 
  'Current_Usage', 'Status', 'Created_Date', 'Updated_Date'
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
  const requiredFields = ['Dump_Yard_ID', 'Dump_Yard_Name', 'Location'];
  const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Validate numeric fields
  if (row.Capacity && isNaN(parseFloat(row.Capacity))) {
    throw new Error(`Invalid numeric value for Capacity: ${row.Capacity}`);
  }
  
  if (row.Current_Usage && isNaN(parseFloat(row.Current_Usage))) {
    throw new Error(`Invalid numeric value for Current_Usage: ${row.Current_Usage}`);
  }
  
  // Validate date formats
  if (row.Created_Date) {
    const date = new Date(row.Created_Date);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format for Created_Date: ${row.Created_Date}`);
    }
  }
  
  if (row.Updated_Date) {
    const date = new Date(row.Updated_Date);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date format for Updated_Date: ${row.Updated_Date}`);
    }
  }
  
  return true;
};

// Check if dumpyard exists
const dumpYardExists = async (connection, dumpYardId) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);
    
    connection.query(
      'SELECT Dump_Yard_ID FROM dump_yard_table WHERE Dump_Yard_ID = ?',
      [dumpYardId],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(results.length > 0);
      }
    );
  });
};

// Insert or update dumpyard
const upsertDumpYard = async (connection, dumpYardData) => {
  const {
    Dump_Yard_ID, Dump_Yard_Name, Location, Capacity, 
    Current_Usage, Status, Created_Date, Updated_Date
  } = dumpYardData;
  
  const exists = await dumpYardExists(connection, Dump_Yard_ID);
  
  if (exists) {
    // Update existing dumpyard
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE dump_yard_table SET 
          Dump_Yard_Name = ?, Location = ?, Capacity = ?, 
          Current_Usage = ?, Status = ?, Updated_Date = ?
        WHERE Dump_Yard_ID = ?
      `;
      
      connection.query(query, [
        Dump_Yard_Name, Location, Capacity || null, 
        Current_Usage || null, Status || 'Active', 
        Updated_Date || new Date(), Dump_Yard_ID
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'update', dumpYardId: Dump_Yard_ID });
      });
    });
  } else {
    // Insert new dumpyard
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO dump_yard_table (
          Dump_Yard_ID, Dump_Yard_Name, Location, Capacity, 
          Current_Usage, Status, Created_Date, Updated_Date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      connection.query(query, [
        Dump_Yard_ID, Dump_Yard_Name, Location, Capacity || null,
        Current_Usage || null, Status || 'Active', 
        Created_Date || new Date(), Updated_Date || new Date()
      ], (err, result) => {
        if (err) reject(err);
        else resolve({ type: 'insert', dumpYardId: Dump_Yard_ID });
      });
    });
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
          // Validate row data
          validateRow(row);
          
          // Insert/update dumpyard
          const result = await upsertDumpYard(connection, row);
          
          results.push({
            row: processedCount,
            dumpYardId: row.Dump_Yard_ID,
            status: 'success',
            type: result.type,
            message: `DumpYard ${result.type === 'insert' ? 'created' : 'updated'} successfully`
          });
          
          successCount++;
          
        } catch (rowError) {
          errors.push({
            row: processedCount,
            dumpYardId: row.Dump_Yard_ID || 'N/A',
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
