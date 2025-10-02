const csv = require('csv-parser');
const fs = require('fs');
const HouseDetails = require('../models/houseRegistration.model');
const db = require('../config/db.sql');

// Expected CSV headers for house upload
const EXPECTED_HEADERS = [
  'Property_Type', 'Waste_Generated_Kg_Per_Day', 
  'Address', 'Coordinates', 'Area_Name' // House_ID will be auto-generated, Emp_ID removed
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
  const requiredFields = ['Property_Type', 'Address'];
  const missingFields = requiredFields.filter(field => !row[field] || row[field].trim() === '');
  
  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
  
  // Validate numeric fields
  if (row.Waste_Generated_Kg_Per_Day && isNaN(parseFloat(row.Waste_Generated_Kg_Per_Day))) {
    throw new Error(`Invalid numeric value for Waste_Generated_Kg_Per_Day: ${row.Waste_Generated_Kg_Per_Day}`);
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

// Get next available House_ID
const getNextHouseId = async () => {
  try {
    const lastHouse = await HouseDetails.findOne().sort({ House_ID: -1 });
    let nextId = 1;
    if (lastHouse && lastHouse.House_ID) {
      nextId = lastHouse.House_ID + 1;
    }
    console.log('Next House_ID:', nextId);
    return nextId;
  } catch (err) {
    console.error('Error getting next House_ID:', err);
    return 1; // Default to 1 if error
  }
};

// Lookup Area_ID from Area_Name
const getAreaIdByName = async (areaName) => {
  if (!areaName) return null;
  
  // Trim whitespace and normalize the area name
  const trimmedAreaName = areaName.trim();
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      resolve(null);
    }, 5000);
    
    db.query(
      'SELECT Area_ID, Area_Name FROM area_details WHERE TRIM(Area_Name) = ?',
      [trimmedAreaName],
      (err, results) => {
        clearTimeout(timeout);
        if (err) {
          console.error('Area lookup error:', err);
          resolve(null);
        } else if (results.length > 0) {
          const areaId = results[0].Area_ID;
          const foundName = results[0].Area_Name;
          console.log(`Area lookup: "${areaName}" (trimmed: "${trimmedAreaName}") -> ID: ${areaId}, Found: "${foundName}"`);
          resolve(areaId);
        } else {
          console.log(`❌ No area found for: "${areaName}" (trimmed: "${trimmedAreaName}")`);
          resolve(null);
        }
      }
    );
  });
};


// Insert new house with auto-generated ID and name-based area lookup
const insertHouse = async (houseData) => {
  const { Property_Type, Waste_Generated_Kg_Per_Day, Address, Coordinates, Area_Name } = houseData;
  
  console.log('Inserting new house:', houseData);
  
  // Lookup Area_ID from Area_Name (if provided)
  let areaId = null;
  if (Area_Name) {
    areaId = await getAreaIdByName(Area_Name);
    if (!areaId) {
      throw new Error(`Area "${Area_Name}" not found`);
    }
  }
  
  // Get next available House_ID
  const houseId = await getNextHouseId();
  
  const houseDataToSave = {
    House_ID: houseId,
    Property_Type,
    Waste_Generated_Kg_Per_Day: Waste_Generated_Kg_Per_Day ? parseFloat(Waste_Generated_Kg_Per_Day) : null,
    Address,
    Coordinates: Coordinates || null,
    Area_ID: areaId,
    Emp_ID: null, // Not needed as per requirement
    Created_Date: new Date(),
    Updated_Date: new Date()
  };
  
  try {
    const newHouse = new HouseDetails(houseDataToSave);
    const result = await newHouse.save();
    console.log(`✅ Inserted house with ID: ${houseId}`);
    return { type: 'insert', houseId: houseId, areaId: areaId, areaName: Area_Name, result };
  } catch (err) {
    console.error('❌ INSERT house error:', err);
    throw err;
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
        
        // Insert house with auto-generated ID and area name lookup
        const result = await insertHouse(row);
        
        results.push({
          row: processedCount,
          houseId: result.houseId,
          areaName: result.areaName || null,
          areaId: result.areaId || null,
          status: 'success',
          type: result.type,
          message: `House created successfully with ID: ${result.houseId}${result.areaName ? ` in Area: ${result.areaName}` : ''}`
        });
        
        successCount++;
        
      } catch (rowError) {
        errors.push({
          row: processedCount,
          areaName: row.Area_Name || 'N/A',
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
