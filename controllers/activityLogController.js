const TransactionLog = require("../models/transactionLog.model");

// Get activity logs with filtering and pagination
exports.getActivityLogs = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      userEmail,
      action,
      target,
      userRole,
      startDate,
      endDate,
      sortBy = 'timestamp',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (userEmail) {
      filter.userEmail = { $regex: userEmail, $options: 'i' };
    }
    
    if (action) {
      filter.action = { $regex: action, $options: 'i' };
    }
    
    if (target) {
      filter.target = { $regex: target, $options: 'i' };
    }
    
    if (userRole) {
      filter.userRole = userRole;
    }
    
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const logs = await TransactionLog.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .select('-requestData -responseData -metadata'); // Exclude heavy fields for list view

    const total = await TransactionLog.countDocuments(filter);

    res.json({
      success: true,
      data: logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalRecords: total,
        hasNext: skip + logs.length < total,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error('Error fetching activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity logs',
      error: error.message
    });
  }
};

// Get detailed log by ID
exports.getActivityLogById = async (req, res) => {
  try {
    const { logId } = req.params;
    
    const log = await TransactionLog.findById(logId);
    
    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Activity log not found'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    console.error('Error fetching activity log:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity log',
      error: error.message
    });
  }
};

// Get activity statistics
exports.getActivityStats = async (req, res) => {
  try {
    const { startDate, endDate, userRole } = req.query;
    
    const filter = {};
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }
    if (userRole) {
      filter.userRole = userRole;
    }

    // Get various statistics
    const [
      totalActions,
      actionsByType,
      actionsByUser,
      actionsByRole,
      actionsByTarget,
      recentActivity
    ] = await Promise.all([
      // Total actions
      TransactionLog.countDocuments(filter),
      
      // Actions by type
      TransactionLog.aggregate([
        { $match: filter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Actions by user
      TransactionLog.aggregate([
        { $match: filter },
        { $group: { _id: '$userEmail', count: { $sum: 1 }, userName: { $first: '$userName' } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Actions by role
      TransactionLog.aggregate([
        { $match: filter },
        { $group: { _id: '$userRole', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      // Actions by target
      TransactionLog.aggregate([
        { $match: filter },
        { $group: { _id: '$target', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      
      // Recent activity (last 24 hours)
      TransactionLog.find({
        ...filter,
        timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      })
      .sort({ timestamp: -1 })
      .limit(20)
      .select('userEmail userName action target timestamp')
    ]);

    res.json({
      success: true,
      data: {
        totalActions,
        actionsByType,
        actionsByUser,
        actionsByRole,
        actionsByTarget,
        recentActivity
      }
    });
  } catch (error) {
    console.error('Error fetching activity stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching activity statistics',
      error: error.message
    });
  }
};

// Get user activity summary
exports.getUserActivitySummary = async (req, res) => {
  try {
    const { userEmail } = req.params;
    const { startDate, endDate } = req.query;
    
    const filter = { userEmail };
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) {
        filter.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.timestamp.$lte = new Date(endDate);
      }
    }

    const [
      totalActions,
      actionsByType,
      recentActions,
      averageResponseTime
    ] = await Promise.all([
      TransactionLog.countDocuments(filter),
      
      TransactionLog.aggregate([
        { $match: filter },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ]),
      
      TransactionLog.find(filter)
        .sort({ timestamp: -1 })
        .limit(10)
        .select('action target timestamp responseStatus'),
        
      TransactionLog.aggregate([
        { $match: { ...filter, duration: { $exists: true } } },
        { $group: { _id: null, avgDuration: { $avg: '$duration' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        userEmail,
        totalActions,
        actionsByType,
        recentActions,
        averageResponseTime: averageResponseTime[0]?.avgDuration || 0
      }
    });
  } catch (error) {
    console.error('Error fetching user activity summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user activity summary',
      error: error.message
    });
  }
};

// Export activity logs to CSV
exports.exportActivityLogs = async (req, res) => {
  try {
    const { startDate, endDate, userEmail, action, target, userRole } = req.query;
    
    const filter = {};
    if (userEmail) filter.userEmail = { $regex: userEmail, $options: 'i' };
    if (action) filter.action = { $regex: action, $options: 'i' };
    if (target) filter.target = { $regex: target, $options: 'i' };
    if (userRole) filter.userRole = userRole;
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const logs = await TransactionLog.find(filter)
      .sort({ timestamp: -1 })
      .select('userEmail userName userRole action method endpoint target operation databaseType responseStatus timestamp duration');

    // Convert to CSV format
    const csvHeader = 'User Email,User Name,User Role,Action,Method,Endpoint,Target,Operation,Database Type,Response Status,Timestamp,Duration (ms)\n';
    const csvRows = logs.map(log => 
      `"${log.userEmail}","${log.userName}","${log.userRole}","${log.action}","${log.method}","${log.endpoint}","${log.target}","${log.operation}","${log.databaseType}","${log.responseStatus}","${log.timestamp}","${log.duration || ''}"`
    ).join('\n');

    const csvContent = csvHeader + csvRows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="activity_logs_${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error exporting activity logs',
      error: error.message
    });
  }
};
