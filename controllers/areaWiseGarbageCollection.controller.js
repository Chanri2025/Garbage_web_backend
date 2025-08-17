const AreaWiseGarbageCollection = require("../models/areaWiseGarbageCollection.model");

// GET area-wise collections
exports.getAreaWiseGarbageCollections = async (req, res) => {
  try {
    const { startDate, endDate, areaId } = req.query;
    let query = {};
    if (startDate && endDate) {
      query.Date = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }
    if (areaId) {
      query.Area = parseInt(areaId);
    }
    const collections = await AreaWiseGarbageCollection.find(query).sort({ Date: -1 });
    res.json({
      success: true,
      data: collections,
      message: "Area-wise garbage collection data retrieved successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Failed to fetch area-wise collection data",
    });
  }
};
