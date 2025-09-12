const csv = require('csv-parser');
const fs = require('fs');
const HouseDetails = require('../models/houseRegistration.model');
const db = require('../config/db.sql');

// Expected CSV headers for house upload
const EXPECTED_HEADERS = [
  'House_ID', 'Property_Type', 'Waste_Generated_Kg_Per_Day', 
  'Address', 'Coordinates', 'Area_ID', 'Emp_ID'
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
  const requiredFields = ['House_ID', 'Property_Type', 'Address'];
  const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Validate numeric fields
  if (row.Waste_Generated_Kg_Per_Day && isNaN(parseFloat(row.Waste_Generated_Kg_Per_Day))) {
    throw new Error(`Invalid numeric value for Waste_Generated_Kg_Per_Day: ${row.Waste_Generated_Kg_Per_Day}`);
  }
  
  if (row.Area_ID && isNaN(parseInt(row.Area_ID))) {
    throw new Error(`Invalid numeric value for Area_ID: ${row.Area_ID}`);
  }
  
  if (row.Emp_ID && isNaN(parseInt(row.Emp_ID))) {
    throw new Error(`Invalid numeric value for Emp_ID: ${row.Emp_ID}`);
  }
  
  // Validate coordinates format (basic validation)
  if (row.Coordinates && !row.Coordinates.includes(',')) {
    throw new Error(`Invalid coordinates format. Expected: "lat,lng", got: ${row.Coordinates}`);
  }
  
  // Validate property type
  const validPropertyTypes = ['Residential', 'Commercial', 'Industrial', 'Mixed'];
  if (row.Property_Type && !validPropertyTypes.includes(row.Property_Type)) {
    throw new Error(`Invalid Property_Type. Must be one of: ${validPropertyTypes.join(', ')}`);
  }
  
  return true;
};

// Check if house exists in MongoDB
const houseExists = async (houseId) => {
  try {
    const house = await HouseDetails.findOne({ House_ID: parseInt(houseId) });
    return !!house;
  } catch (error) {
    console.error('Error checking house existence:', error);
    return false;
  }
};

// Check if area exists in MySQL
const areaExists = async (areaId) => {
  if (!areaId) return true; // Optional field
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);
    
    db.query(
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

// Check if employee exists in MySQL
const employeeExists = async (empId) => {
  if (!empId) return true; // Optional field
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);
    
    db.query(
      'SELECT Emp_ID FROM employee_table WHERE Emp_ID = ?',
      [empId],
      (err, results) => {
        clearTimeout(timeout);
        if (err) reject(err);
        else resolve(results.length > 0);
      }
    );
  });
};

// Insert or update house
const upsertHouse = async (houseData) => {
  const {
    House_ID, Property_Type, Waste_Generated_Kg_Per_Day, 
    Address, Coordinates, Area_ID, Emp_ID
  } = houseData;
  
  const exists = await houseExists(House_ID);
  
  const houseDataToSave = {
    House_ID: parseInt(House_ID),
    Property_Type,
    Waste_Generated_Kg_Per_Day: Waste_Generated_Kg_Per_Day ? parseFloat(Waste_Generated_Kg_Per_Day) : null,
    Address,
    Coordinates: Coordinates || null,
    Area_ID: Area_ID ? parseInt(Area_ID) : null,
    Emp_ID: Emp_ID ? parseInt(Emp_ID) : null,
    Created_Date: new Date(),
    Updated_Date: new Date()
  };
  
  if (exists) {
    // Update existing house
    const result = await HouseDetails.findOneAndUpdate(
      { House_ID: parseInt(House_ID) },
      { $set: houseDataToSave },
      { new: true }
    );
    return { type: 'update', houseId: House_ID, result };
  } else {
    // Insert new house
    const newHouse = new HouseDetails(houseDataToSave);
    const result = await newHouse.save();
    return { type: 'insert', houseId: House_ID, result };
  }
};

// Main bulk upload function
exports.bulkUploadHouses = async (req, res) => {
  console.log('House bulk upload request received');
  
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
    
    for (const row of csvData) {
      processedCount++;
      
      try {
        // Validate row data
        validateRow(row);
        
        // Check if area exists in MySQL (if provided)
        if (row.Area_ID) {
          const areaExistsResult = await areaExists(row.Area_ID);
          if (!areaExistsResult) {
            throw new Error(`Area_ID ${row.Area_ID} not found in area_details table`);
          }
        }
        
        // Check if employee exists in MySQL (if provided)
        if (row.Emp_ID) {
          const employeeExistsResult = await employeeExists(row.Emp_ID);
          if (!employeeExistsResult) {
            throw new Error(`Emp_ID ${row.Emp_ID} not found in employee_table`);
          }
        }
        
        // Insert/update house in MongoDB
        const result = await upsertHouse(row);
        
        results.push({
          row: processedCount,
          houseId: row.House_ID,
          status: 'success',
          type: result.type,
          message: `House ${result.type === 'insert' ? 'created' : 'updated'} successfully`
        });
        
        successCount++;
        
      } catch (rowError) {
        errors.push({
          row: processedCount,
          houseId: row.House_ID || 'N/A',
          status: 'error',
          message: rowError.message,
          data: row
        });
        errorCount++;
      }
    }
    
    // Clean up uploaded file
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      message: 'House bulk upload completed',
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
      message: 'House bulk upload failed',
      error: error.message
    });
  }
};
