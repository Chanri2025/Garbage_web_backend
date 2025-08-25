const PendingChange = require('../models/pendingChange.model');

/**
 * Approval Workflow Middleware
 * 
 * This middleware intercepts CRUD operations from managers and creates
 * pending changes for admin approval instead of directly modifying data.
 */

// Helper function to determine database type from route
const getDatabaseType = (path) => {
  // SQL table patterns based on your existing routes
  const sqlRoutes = [
    'employees', 'devices', 'vehicles', 'wards', 'empBeatMap', 
    'dustBins', 'areas', 'dumpYards', 'iplogs', 'zones'
  ];
  
  const pathParts = path.split('/').filter(p => p && !p.startsWith(':'));
  const resource = pathParts[pathParts.length - 1];
  
  return sqlRoutes.includes(resource) ? 'MySQL' : 'MongoDB';
};

// Helper function to extract model name from request
const getModelFromRequest = (req) => {
  const path = req.route.path;
  const pathParts = path.split('/').filter(p => p && !p.startsWith(':'));
  
  if (pathParts.length > 0) {
    const resource = pathParts[pathParts.length - 1];
    
    // Map routes to model names
    const resourceToModel = {
      'houses': 'HouseDetails',
      'garbageCollections': 'GarbageCollection',
      'garbage_collection_areaWise': 'AreaWiseGarbageCollection',
      'attendanceLogs': 'DailyAttendanceLog',
      'carbonFootprintDetails': 'CarbonFootprint',
      'vehicles': 'swm.vehicle_table',
      'employees': 'swm.employee_table',
      'areas': 'swm.area_details',
      'zones': 'swm.zone_table',
      'wards': 'swm.ward_table',
      'dumpYards': 'swm.dump_yard_table',
      'devices': 'swm.device_table',
      'dustBins': 'swm.dust_bin_table',
      'iplogs': 'swm.ip_log_table'
    };
    
    return resourceToModel[resource] || resource;
  }
  
  return 'Unknown';
};

// Helper function to categorize changes
const getCategoryFromModel = (modelName) => {
  const categoryMap = {
    'HouseDetails': 'house-management',
    'GarbageCollection': 'waste-collection',
    'AreaWiseGarbageCollection': 'waste-collection',
    'DailyAttendanceLog': 'attendance',
    'CarbonFootprint': 'analytics',
    'swm.vehicle_table': 'vehicle-management',
    'swm.employee_table': 'user-management',
    'swm.area_details': 'area-management',
    'swm.zone_table': 'area-management',
    'swm.ward_table': 'area-management',
    'swm.dump_yard_table': 'infrastructure',
    'swm.device_table': 'device-management',
    'swm.dust_bin_table': 'infrastructure',
    'swm.ip_log_table': 'system-logs'
  };
  
  return categoryMap[modelName] || 'general';
};

// Helper function to determine priority
const getPriority = (operation, modelName, data) => {
  // High priority operations
  if (operation === 'DELETE') return 'high';
  if (modelName.includes('employee') && operation === 'UPDATE') return 'high';
  if (modelName === 'swm.vehicle_table' && operation === 'CREATE') return 'medium';
  if (modelName === 'swm.dump_yard_table') return 'medium';
  
  // Check data for urgent indicators
  if (data && typeof data === 'object') {
    if (data.urgent || data.priority === 'urgent') return 'urgent';
    if (data.emergency || data.status === 'emergency') return 'urgent';
  }
  
  return 'medium';
};

/**
 * Main approval workflow middleware
 * Intercepts manager operations and creates pending changes
 */
const requireApproval = (options = {}) => {
  return async (req, res, next) => {
    try {
      // Skip if user is not a manager
      if (!req.user || req.user.role !== 'manager') {
        return next();
      }
      
      const operation = req.method;
      const allowedOperations = ['POST', 'PUT', 'PATCH', 'DELETE'];
      
      // Only intercept CRUD operations
      if (!allowedOperations.includes(operation)) {
        return next();
      }
      
      // Skip if explicitly bypassed (for approved changes being applied)
      if (req.skipApproval) {
        return next();
      }
      
      // Extract information about the operation
      const modelName = options.modelName || getModelFromRequest(req);
      const targetId = req.params.id || req.params.houseId || req.params.vehicleId || null;
      const databaseType = options.databaseType || getDatabaseType(req.route.path);
      
      // Convert HTTP method to operation type
      const operationMap = {
        'POST': 'CREATE',
        'PUT': 'UPDATE',
        'PATCH': 'UPDATE',
        'DELETE': 'DELETE'
      };
      
      const operationType = operationMap[operation];
      
      // Create pending change record
      const pendingChange = new PendingChange({
        operation: operationType,
        targetModel: modelName,
        targetId: targetId,
        databaseType: databaseType,
        proposedChanges: req.body,
        requestedBy: req.user.id,
        requestedByName: req.user.name,
        priority: getPriority(operationType, modelName, req.body),
        category: getCategoryFromModel(modelName),
        description: options.description || `${operationType} operation on ${modelName}${targetId ? ` (ID: ${targetId})` : ''}`
      });
      
      await pendingChange.save();
      
      // Return pending status instead of executing the operation
      res.status(202).json({
        success: true,
        message: 'Request submitted for admin approval',
        pendingChangeId: pendingChange._id,
        status: 'pending_approval',
        details: {
          operation: operationType,
          targetModel: modelName,
          estimatedApprovalTime: '24-48 hours',
          priority: pendingChange.priority
        }
      });
      
    } catch (error) {
      console.error('Approval workflow error:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing approval request',
        error: error.message
      });
    }
  };
};

/**
 * Middleware to check if an operation needs approval
 * Sets req.needsApproval flag without blocking the request
 */
const checkApprovalNeeded = (req, res, next) => {
  req.needsApproval = (
    req.user && 
    req.user.role === 'manager' &&
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)
  );
  next();
};

module.exports = {
  requireApproval,
  checkApprovalNeeded
};
