const PendingChange = require('../models/pendingChange.model');
const Manager = require('../models/manager.model');

/**
 * Approval Controller
 * 
 * Handles all approval workflow operations
 */

// Helper function to create approval requests
const createApprovalRequest = async (req, res, entityType, operation, targetId = null) => {
  try {
    // Check if user is manager or higher
    if (!req.user || !['manager', 'admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only managers and above can create approval requests'
      });
    }

    // If user is admin or super-admin, execute directly for CREATE operations
    if (['admin', 'super-admin'].includes(req.user.role) && operation === 'CREATE') {
      return res.status(200).json({
        success: true,
        message: 'Operation executed directly (admin privilege)',
        directExecution: true
      });
    }

    // For managers, create approval request
    const pendingChange = new PendingChange({
      operation: operation,
      targetModel: getModelName(entityType),
      targetId: targetId,
      databaseType: getDatabaseType(entityType),
      proposedChanges: req.body,
      requestedBy: req.user.id,
      requestedByName: req.user.name || req.user.username,
      priority: getPriority(operation, entityType, req.body),
      category: getCategory(entityType),
      description: `${operation} operation on ${entityType}${targetId ? ` (ID: ${targetId})` : ''}`,
      reason: req.body.reason || ''
    });

    await pendingChange.save();

    res.status(202).json({
      success: true,
      message: `${entityType} ${operation.toLowerCase()} request submitted for approval`,
      request_id: pendingChange._id,
      status: 'pending_approval',
      details: {
        operation: operation,
        entityType: entityType,
        estimatedApprovalTime: '24-48 hours',
        priority: pendingChange.priority
      }
    });

  } catch (error) {
    console.error(`Create ${entityType} approval request error:`, error);
    res.status(500).json({
      success: false,
      message: `Error creating ${entityType} approval request`,
      error: error.message
    });
  }
};

// Helper functions
const getModelName = (entityType) => {
  const modelMap = {
    'house': 'HouseDetails',
    'employee': 'swm.employee_table',
    'vehicle': 'swm.vehicle_table', 
    'area': 'swm.area_details',
    'dumpyard': 'swm.dump_yard_table'
  };
  return modelMap[entityType] || entityType;
};

const getDatabaseType = (entityType) => {
  const mongoEntities = ['house'];
  return mongoEntities.includes(entityType) ? 'MongoDB' : 'MySQL';
};

const getPriority = (operation, entityType, data) => {
  if (operation === 'DELETE') return 'high';
  if (entityType === 'employee' && operation === 'UPDATE') return 'high';
  if (entityType === 'vehicle' && operation === 'CREATE') return 'medium';
  if (entityType === 'dumpyard') return 'medium';
  
  if (data && typeof data === 'object') {
    if (data.urgent || data.priority === 'urgent') return 'urgent';
    if (data.emergency || data.status === 'emergency') return 'urgent';
  }
  
  return 'medium';
};

const getCategory = (entityType) => {
  const categoryMap = {
    'house': 'house-management',
    'employee': 'user-management',
    'vehicle': 'vehicle-management',
    'area': 'area-management',
    'dumpyard': 'infrastructure'
  };
  return categoryMap[entityType] || 'general';
};

// Get all pending changes for admin review (updated to match frontend API expectations)
exports.getPendingChanges = async (req, res) => {
  try {
    // Only admins can view pending changes
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view pending changes'
      });
    }
    
    const { category, priority, page = 1, limit = 20 } = req.query;
    
    // Build query
    const query = { status: 'pending' };
    if (category) query.category = category;
    if (priority) query.priority = priority;
    
    // Execute query with pagination
    const skip = (page - 1) * limit;
    const pendingChanges = await PendingChange.find(query)
      .populate('requestedBy', 'name username department')
      .sort({ priority: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await PendingChange.countDocuments(query);
    
    // Transform data to match frontend expectations
    const transformedChanges = pendingChanges.map(change => ({
      id: change._id,
      entityType: change.targetModel.toLowerCase().replace('swm.', '').replace('_table', '').replace('_details', '').replace('details', ''),
      operation: change.operation.toLowerCase(),
      entityId: change.targetId,
      proposedChanges: change.proposedChanges,
      currentData: change.originalData,
      requestedBy: change.requestedByName,
      requestedAt: change.createdAt,
      reason: change.description || change.reason
    }));
    
    res.json({
      success: true,
      changes: transformedChanges,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Get pending changes error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending changes',
      error: error.message
    });
  }
};

// Approve a pending change
exports.approveChange = async (req, res) => {
  try {
    const { changeId } = req.params;
    const { comments } = req.body;
    
    // Only admins can approve
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can approve changes'
      });
    }
    
    const pendingChange = await PendingChange.findById(changeId);
    if (!pendingChange) {
      return res.status(404).json({
        success: false,
        message: 'Pending change not found'
      });
    }
    
    if (!pendingChange.canBeReviewed()) {
      return res.status(400).json({
        success: false,
        message: 'This change cannot be reviewed (already processed or expired)'
      });
    }
    
    await pendingChange.approve(req.user, comments);
    
    res.json({
      success: true,
      message: 'Change approved successfully',
      pendingChange: {
        id: pendingChange._id,
        operation: pendingChange.operation,
        targetModel: pendingChange.targetModel,
        status: pendingChange.status,
        reviewComments: pendingChange.reviewComments
      }
    });
    
  } catch (error) {
    console.error('Approve change error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving change',
      error: error.message
    });
  }
};

// Reject a pending change
exports.rejectChange = async (req, res) => {
  try {
    const { changeId } = req.params;
    const { comments } = req.body;
    
    // Only admins can reject
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can reject changes'
      });
    }
    
    const pendingChange = await PendingChange.findById(changeId);
    if (!pendingChange) {
      return res.status(404).json({
        success: false,
        message: 'Pending change not found'
      });
    }
    
    if (!pendingChange.canBeReviewed()) {
      return res.status(400).json({
        success: false,
        message: 'This change cannot be reviewed (already processed or expired)'
      });
    }
    
    await pendingChange.reject(req.user, comments);
    
    res.json({
      success: true,
      message: 'Change rejected successfully',
      pendingChange: {
        id: pendingChange._id,
        operation: pendingChange.operation,
        targetModel: pendingChange.targetModel,
        status: pendingChange.status,
        reviewComments: pendingChange.reviewComments
      }
    });
    
  } catch (error) {
    console.error('Reject change error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting change',
      error: error.message
    });
  }
};

// Get manager's own pending requests
exports.getMyRequests = async (req, res) => {
  try {
    // Only managers can view their own requests
    if (req.user.role !== 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Only managers can view their own requests'
      });
    }
    
    const { status = 'all', page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = { requestedBy: req.user.id };
    if (status !== 'all') {
      query.status = status;
    }
    
    const skip = (page - 1) * limit;
    const myRequests = await PendingChange.find(query)
      .populate('reviewedBy', 'name username')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await PendingChange.countDocuments(query);
    
    res.json({
      success: true,
      requests: myRequests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: parseInt(limit)
      }
    });
    
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching your requests',
      error: error.message
    });
  }
};

// Get approval statistics for admin dashboard
exports.getApprovalStats = async (req, res) => {
  try {
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can view approval statistics'
      });
    }
    
    const stats = await PendingChange.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const categoryStats = await PendingChange.aggregate([
      {
        $match: { status: 'pending' }
      },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);
    
    const priorityStats = await PendingChange.aggregate([
      {
        $match: { status: 'pending' }
      },
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      success: true,
      statistics: {
        byStatus: stats,
        byCategory: categoryStats,
        byPriority: priorityStats
      }
    });
    
  } catch (error) {
    console.error('Get approval stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching approval statistics',
      error: error.message
    });
  }
};

// ========== HOUSE APPROVAL ENDPOINTS ==========

exports.createHouseApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'house', 'CREATE');
};

exports.updateHouseApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'house', 'UPDATE', req.params.id);
};

exports.deleteHouseApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'house', 'DELETE', req.params.id);
};

// ========== EMPLOYEE APPROVAL ENDPOINTS ==========

exports.createEmployeeApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'employee', 'CREATE');
};

exports.updateEmployeeApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'employee', 'UPDATE', req.params.id);
};

exports.deleteEmployeeApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'employee', 'DELETE', req.params.id);
};

// ========== VEHICLE APPROVAL ENDPOINTS ==========

exports.createVehicleApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'vehicle', 'CREATE');
};

exports.updateVehicleApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'vehicle', 'UPDATE', req.params.id);
};

exports.deleteVehicleApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'vehicle', 'DELETE', req.params.id);
};

// ========== AREA APPROVAL ENDPOINTS ==========

exports.createAreaApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'area', 'CREATE');
};

exports.updateAreaApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'area', 'UPDATE', req.params.id);
};

exports.deleteAreaApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'area', 'DELETE', req.params.id);
};

// ========== DUMPYARD APPROVAL ENDPOINTS ==========

exports.createDumpyardApprovalRequest = async (req, res) => {
  await createApprovalRequest(req, res, 'dumpyard', 'CREATE');
};

// ========== ADMIN APPROVAL MANAGEMENT ==========

// Approve a request (updated to match frontend API expectations)
exports.approveRequest = async (req, res) => {
  try {
    const { request_id } = req.params;
    const { admin_response } = req.body;
    
    // Only admins can approve
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can approve requests'
      });
    }
    
    const pendingChange = await PendingChange.findById(request_id);
    if (!pendingChange) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }
    
    if (!pendingChange.canBeReviewed()) {
      return res.status(400).json({
        success: false,
        message: 'This request cannot be reviewed (already processed or expired)'
      });
    }
    
    await pendingChange.approve(req.user, admin_response);
    
    res.json({
      success: true,
      message: 'Request approved and processed successfully'
    });
    
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error approving request',
      error: error.message
    });
  }
};

// Reject a request (updated to match frontend API expectations)
exports.rejectRequest = async (req, res) => {
  try {
    const { request_id } = req.params;
    const { admin_response } = req.body;
    
    // Only admins can reject
    if (!['admin', 'super-admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can reject requests'
      });
    }
    
    const pendingChange = await PendingChange.findById(request_id);
    if (!pendingChange) {
      return res.status(404).json({
        success: false,
        message: 'Request not found'
      });
    }
    
    if (!pendingChange.canBeReviewed()) {
      return res.status(400).json({
        success: false,
        message: 'This request cannot be reviewed (already processed or expired)'
      });
    }
    
    await pendingChange.reject(req.user, admin_response);
    
    res.json({
      success: true,
      message: 'Request rejected successfully'
    });
    
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting request',
      error: error.message
    });
  }
};
