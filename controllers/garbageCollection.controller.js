// controllers/garbageCollection.controller.js

const GarbageCollection = require("../models/garbageCollection.model");

// GET all house-wise records with pagination, filtering, and sorting
exports.getAllGarbageCollections = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'TIMESTAMP',
      sortOrder = 'asc',
      search,
      propertyType,
      empId,
      dateFrom,
      dateTo,
      minWeight,
      maxWeight,
      type = 'daily',
      houseId
    } = req.query;

    // Convert to numbers and validate limits
    const pageNum = parseInt(page);
    let limitNum = parseInt(limit);
    
    // Allow larger page sizes for data export scenarios
    if (limitNum > 1000) {
      limitNum = 1000; // Maximum limit to prevent performance issues
    }
    
    // Ensure minimum limit
    if (limitNum < 1) {
      limitNum = 20;
    }
    
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter = {};
    
    // Search across multiple fields
    if (search) {
      filter.$or = [
        { Address: { $regex: search, $options: 'i' } },
        { Coordinates: { $regex: search, $options: 'i' } },
        { Property_Type: { $regex: search, $options: 'i' } },
        { EMP_ID: { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by property type
    if (propertyType) {
      filter.Property_Type = { $regex: propertyType, $options: 'i' };
    }

    // Filter by employee ID
    if (empId) {
      filter.EMP_ID = { $regex: empId, $options: 'i' };
    }

    // Date range filtering
    if (dateFrom || dateTo) {
      filter.TIMESTAMP = {};
      if (dateFrom) {
        filter.TIMESTAMP.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.TIMESTAMP.$lte = new Date(dateTo);
      }
    }

    // Weight range filtering
    if (minWeight || maxWeight) {
      filter.$and = filter.$and || [];
      if (minWeight) {
        filter.$and.push({ waste_generated: { $gte: parseFloat(minWeight) } });
      }
      if (maxWeight) {
        filter.$and.push({ waste_generated: { $lte: parseFloat(maxWeight) } });
      }
    }

    // Filter by house ID
    if (houseId) {
      filter.House_ID = parseInt(houseId);
    }

    // Build sort object
    let sort = {};
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    
    // Map frontend sort fields to database fields
    const sortFieldMap = {
      'TIMESTAMP': 'TIMESTAMP',
      'House_ID': 'House_ID',
      'Address': 'Address',
      'Property_Type': 'Property_Type',
      'waste_generated': 'waste_generated',
      'DRY_WEIGHT': 'DRY_WEIGHT',
      'LIQUID_WEIGHT': 'LIQUID_WEIGHT',
      'EMP_ID': 'EMP_ID',
      'No_of_People': 'No_of_People'
    };
    
    const sortField = sortFieldMap[sortBy] || 'TIMESTAMP';
    sort[sortField] = sortDirection;

    // Execute query with pagination
    let data;
    let totalCount;

    if (type === 'daily') {
      // Default daily behavior - return individual records with pagination
      data = await GarbageCollection.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select('-__v');

      totalCount = await GarbageCollection.countDocuments(filter);
    } else {
      // For monthly/yearly, get all data without pagination for aggregation
      data = await GarbageCollection.find(filter)
        .sort({ TIMESTAMP: 1 })
        .select('-__v');

      totalCount = data.length;
    }

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    // Calculate summary statistics
    const stats = await GarbageCollection.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalWaste: { $sum: '$waste_generated' },
          totalDryWeight: { $sum: '$DRY_WEIGHT' },
          totalLiquidWeight: { $sum: '$LIQUID_WEIGHT' },
          totalHouses: { $sum: 1 },
          totalPeople: { $sum: '$No_of_People' },
          avgWastePerHouse: { $avg: '$waste_generated' }
        }
      }
    ]);

    // Get property type distribution
    const propertyTypeStats = await GarbageCollection.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$Property_Type',
          count: { $sum: 1 },
          totalWaste: { $sum: '$waste_generated' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Process data based on type parameter
    let processedData = data;
    if (type === 'monthly' || type === 'yearly') {
      processedData = aggregateDataByPeriod(data, type);
    }

    res.json({
      success: true,
      data: {
        records: processedData,
        pagination: type === 'daily' ? {
          currentPage: pageNum,
          totalPages,
          totalRecords: totalCount,
          hasNext,
          hasPrev,
          limit: limitNum,
          showing: `${skip + 1}-${Math.min(skip + limitNum, totalCount)} of ${totalCount}`
        } : null,
        statistics: {
          summary: stats[0] || {
            totalWaste: 0,
            totalDryWeight: 0,
            totalLiquidWeight: 0,
            totalHouses: 0,
            totalPeople: 0,
            avgWastePerHouse: 0
          },
          byPropertyType: propertyTypeStats
        },
        filters: {
          applied: {
            search,
            propertyType,
            empId,
            dateFrom,
            dateTo,
            minWeight,
            maxWeight,
            type,
            houseId
          },
          sortBy,
          sortOrder
        }
      }
    });

  } catch (err) {
    console.error('Error fetching garbage collections:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      message: "Failed to fetch garbage collection data"
    });
  }
};

// Helper function to aggregate data by period (monthly/yearly)
function aggregateDataByPeriod(data, type) {
  const groupedData = {};
  
  data.forEach(record => {
    let period;
    const timestamp = new Date(record.TIMESTAMP);
    const houseId = record.House_ID;
    
    if (type === 'monthly') {
      period = `${timestamp.getFullYear()}-${String(timestamp.getMonth() + 1).padStart(2, '0')}`;
    } else if (type === 'yearly') {
      period = timestamp.getFullYear().toString();
    }
    
    // Create unique key for house + period combination
    const key = `${houseId}_${period}`;
    
    if (!groupedData[key]) {
      groupedData[key] = {
        house_id: houseId,
        period,
        total_waste: 0,
        dry_waste: 0,
        liquid_waste: 0,
        count: 0,
        waste_values: []
      };
    }
    
    groupedData[key].total_waste += record.waste_generated || 0;
    groupedData[key].dry_waste += record.DRY_WEIGHT || 0;
    groupedData[key].liquid_waste += record.LIQUID_WEIGHT || 0;
    groupedData[key].count += 1;
    groupedData[key].waste_values.push(record.waste_generated || 0);
  });
  
  // Calculate average waste for each house-period combination
  Object.values(groupedData).forEach(group => {
    group.avg_waste = group.count > 0 ? (group.total_waste / group.count).toFixed(2) : 0;
    // Remove temporary fields
    delete group.count;
    delete group.waste_values;
  });
  
  // Convert to array and sort by house_id first, then by period
  return Object.values(groupedData).sort((a, b) => {
    if (a.house_id !== b.house_id) {
      return a.house_id - b.house_id; // Sort by house ID first
    }
    return a.period.localeCompare(b.period); // Then by period
  });
}

// CREATE a new house-wise record
exports.createGarbageCollection = async (req, res) => {
  try {
    const newRecord = new GarbageCollection(req.body);
    await newRecord.save();
    res.status(201).json(newRecord);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET house-wise record by ID
exports.getGarbageCollectionById = async (req, res) => {
  try {
    const record = await GarbageCollection.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE house-wise record by ID
exports.updateGarbageCollection = async (req, res) => {
  try {
    const updated = await GarbageCollection.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE house-wise record by ID
exports.deleteGarbageCollection = async (req, res) => {
  try {
    const deleted = await GarbageCollection.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET statistics and analytics
exports.getGarbageCollectionStats = async (req, res) => {
  try {
    const { dateFrom, dateTo, propertyType } = req.query;
    
    // Build filter for statistics
    const filter = {};
    if (dateFrom || dateTo) {
      filter.TIMESTAMP = {};
      if (dateFrom) filter.TIMESTAMP.$gte = new Date(dateFrom);
      if (dateTo) filter.TIMESTAMP.$lte = new Date(dateTo);
    }
    if (propertyType) {
      filter.Property_Type = { $regex: propertyType, $options: 'i' };
    }

    // Get comprehensive statistics
    const stats = await GarbageCollection.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalRecords: { $sum: 1 },
          totalWaste: { $sum: '$waste_generated' },
          totalDryWeight: { $sum: '$DRY_WEIGHT' },
          totalLiquidWeight: { $sum: '$LIQUID_WEIGHT' },
          totalHouses: { $sum: 1 },
          totalPeople: { $sum: '$No_of_People' },
          avgWastePerHouse: { $avg: '$waste_generated' },
          avgDryWeight: { $avg: '$DRY_WEIGHT' },
          avgLiquidWeight: { $avg: '$LIQUID_WEIGHT' },
          maxWaste: { $max: '$waste_generated' },
          minWaste: { $min: '$waste_generated' }
        }
      }
    ]);

    // Get daily waste generation trend
    const dailyTrend = await GarbageCollection.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$TIMESTAMP" } } },
          totalWaste: { $sum: '$waste_generated' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 } // Last 30 days
    ]);

    // Get property type distribution
    const propertyTypeStats = await GarbageCollection.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$Property_Type',
          count: { $sum: 1 },
          totalWaste: { $sum: '$waste_generated' },
          avgWaste: { $avg: '$waste_generated' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get top employees by collection volume
    const topEmployees = await GarbageCollection.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$EMP_ID',
          totalCollections: { $sum: 1 },
          totalWaste: { $sum: '$waste_generated' },
          avgWaste: { $avg: '$waste_generated' }
        }
      },
      { $sort: { totalWaste: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      data: {
        summary: stats[0] || {
          totalRecords: 0,
          totalWaste: 0,
          totalDryWeight: 0,
          totalLiquidWeight: 0,
          totalHouses: 0,
          totalPeople: 0,
          avgWastePerHouse: 0,
          avgDryWeight: 0,
          avgLiquidWeight: 0,
          maxWaste: 0,
          minWaste: 0
        },
        dailyTrend,
        propertyTypeStats,
        topEmployees,
        filters: { dateFrom, dateTo, propertyType }
      }
    });

  } catch (err) {
    console.error('Error fetching garbage collection stats:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      message: "Failed to fetch statistics"
    });
  }
};

// GET search suggestions for autocomplete
exports.getSearchSuggestions = async (req, res) => {
  try {
    const { q, field } = req.query;
    
    if (!q || !field) {
      return res.status(400).json({
        success: false,
        message: "Query (q) and field parameters are required"
      });
    }

    const suggestions = await GarbageCollection.distinct(field, {
      [field]: { $regex: q, $options: 'i' }
    });

    res.json({
      success: true,
      data: suggestions.slice(0, 10) // Limit to 10 suggestions
    });

  } catch (err) {
    console.error('Error fetching search suggestions:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      message: "Failed to fetch search suggestions"
    });
  }
};

// GET all data without pagination (for export and full data visualization)
exports.getAllGarbageCollectionsExport = async (req, res) => {
  try {
    const {
      sortBy = 'TIMESTAMP',
      sortOrder = 'asc',
      search,
      propertyType,
      empId,
      dateFrom,
      dateTo,
      minWeight,
      maxWeight
    } = req.query;

    // Build filter object (same as main endpoint)
    const filter = {};
    
    if (search) {
      filter.$or = [
        { Address: { $regex: search, $options: 'i' } },
        { Coordinates: { $regex: search, $options: 'i' } },
        { Property_Type: { $regex: search, $options: 'i' } },
        { EMP_ID: { $regex: search, $options: 'i' } }
      ];
    }

    if (propertyType) {
      filter.Property_Type = { $regex: propertyType, $options: 'i' };
    }

    if (empId) {
      filter.EMP_ID = { $regex: empId, $options: 'i' };
    }

    if (dateFrom || dateTo) {
      filter.TIMESTAMP = {};
      if (dateFrom) {
        filter.TIMESTAMP.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        filter.TIMESTAMP.$lte = new Date(dateTo);
      }
    }

    if (minWeight || maxWeight) {
      filter.$and = filter.$and || [];
      if (minWeight) {
        filter.$and.push({ waste_generated: { $gte: parseFloat(minWeight) } });
      }
      if (maxWeight) {
        filter.$and.push({ waste_generated: { $lte: parseFloat(maxWeight) } });
      }
    }

    // Build sort object
    let sort = {};
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    
    const sortFieldMap = {
      'TIMESTAMP': 'TIMESTAMP',
      'House_ID': 'House_ID',
      'Address': 'Address',
      'Property_Type': 'Property_Type',
      'waste_generated': 'waste_generated',
      'DRY_WEIGHT': 'DRY_WEIGHT',
      'LIQUID_WEIGHT': 'LIQUID_WEIGHT',
      'EMP_ID': 'EMP_ID',
      'No_of_People': 'No_of_People'
    };
    
    const sortField = sortFieldMap[sortBy] || 'TIMESTAMP';
    sort[sortField] = sortDirection;

    // Get all data without pagination
    const data = await GarbageCollection.find(filter)
      .sort(sort)
      .select('-__v');

    const totalCount = data.length;

    res.json({
      success: true,
      data: {
        records: data,
        totalRecords: totalCount,
        message: `Retrieved all ${totalCount} records without pagination`,
        filters: {
          applied: {
            search,
            propertyType,
            empId,
            dateFrom,
            dateTo,
            minWeight,
            maxWeight,
            type,
            houseId
          },
          sortBy,
          sortOrder
        }
      }
    });

  } catch (err) {
    console.error('Error fetching all garbage collections:', err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      message: "Failed to fetch all garbage collection data"
    });
  }
};
