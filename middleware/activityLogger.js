const TransactionLog = require("../models/transactionLog.model");

// Activity logging middleware
const activityLogger = (options = {}) => {
  return async (req, res, next) => {
    const startTime = Date.now();
    
    // Skip logging for certain paths if specified
    const skipPaths = options.skipPaths || ['/api/auth/login', '/api/auth/register', '/uploads'];
    if (skipPaths.some(path => req.path.startsWith(path))) {
      console.log('🔍 Activity Logger: Skipping path:', req.path);
      return next();
    }

    console.log('🔍 Activity Logger: Processing request:', req.method, req.path);

    // Store original res.json to capture response data
    const originalJson = res.json;
    let responseData = null;
    let responseStatus = 200;

    res.json = function(data) {
      responseData = data;
      responseStatus = res.statusCode;
      return originalJson.call(this, data);
    };

    // Override res.status to capture status code
    const originalStatus = res.status;
    res.status = function(code) {
      responseStatus = code;
      return originalStatus.call(this, code);
    };

    // Continue with the request
    res.on('finish', async () => {
      try {
        // Log all requests, but handle cases where user might not be authenticated
        const userInfo = req.user || {
          email: 'anonymous@system.com',
          id: 'system',
          name: 'Anonymous User',
          role: 'system'
        };
        
        const duration = Date.now() - startTime;
        
        // Determine action based on method and endpoint
        const action = getActionFromRequest(req);
        
        // Determine target and operation
        const { target, operation } = getTargetAndOperation(req);
        
        // Determine database type based on endpoint
        const databaseType = getDatabaseType(req.path);
        
        // Create log entry
        const logEntry = {
          userEmail: userInfo.email,
          userId: userInfo.id,
          userName: userInfo.name || userInfo.username,
          userRole: userInfo.role,
          
          action: action,
          method: req.method,
          endpoint: req.path,
          
          target: target,
          targetId: getTargetId(req),
          operation: operation,
          
          databaseType: databaseType,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          
          requestData: {
            body: req.body,
            query: req.query,
            params: req.params
          },
          responseStatus: responseStatus,
          responseData: options.includeResponseData ? responseData : undefined,
          
          description: getDescription(req, action),
          metadata: {
            originalUrl: req.originalUrl,
            referer: req.get('Referer'),
            contentLength: res.get('Content-Length')
          },
          
          duration: duration
        };

        // Save log entry
        console.log('🔍 Activity Logger: Creating log entry:', {
          userEmail: logEntry.userEmail,
          action: logEntry.action,
          endpoint: logEntry.endpoint
        });
        await TransactionLog.create(logEntry);
        console.log('✅ Activity Logger: Log entry saved successfully');
      } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw error to avoid breaking the main request
      }
    });

    next();
  };
};

// Helper function to determine action from request
function getActionFromRequest(req) {
  const method = req.method;
  const path = req.path;
  
  // Extract resource name from path
  const pathParts = path.split('/').filter(part => part && part !== 'api');
  const resource = pathParts[0] || 'unknown';
  
  // Map HTTP methods to actions
  const actionMap = {
    'GET': 'FETCH',
    'POST': 'CREATE',
    'PUT': 'UPDATE',
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE'
  };
  
  const baseAction = actionMap[method] || 'UNKNOWN';
  const resourceName = resource.toUpperCase().replace(/S$/, ''); // Remove plural 's'
  
  return `${baseAction}_${resourceName}`;
}

// Helper function to get target and operation
function getTargetAndOperation(req) {
  const method = req.method;
  const path = req.path;
  
  // Extract resource name
  const pathParts = path.split('/').filter(part => part && part !== 'api');
  const resource = pathParts[0] || 'unknown';
  
  // Map to database table/collection names
  const resourceMap = {
    'employees': 'employee_table',
    'zones': 'zone_table',
    'wards': 'ward_table',
    'areas': 'area_table',
    'vehicles': 'vehicle_table',
    'devices': 'device_table',
    'dumpYards': 'dump_yard_table',
    'dustBins': 'dust_bin_table',
    'garbageCollections': 'garbage_collections',
    'attendanceLogs': 'daily_attendance_logs',
    'houses': 'house_registrations',
    'carbonFootprintDetails': 'carbon_footprint_details',
    'queries': 'query_posts',
    'approvals': 'pending_changes'
  };
  
  const target = resourceMap[resource] || resource;
  
  // Map HTTP methods to CRUD operations
  const operationMap = {
    'GET': 'READ',
    'POST': 'CREATE',
    'PUT': 'UPDATE',
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE'
  };
  
  const operation = operationMap[method] || 'UNKNOWN';
  
  return { target, operation };
}

// Helper function to get target ID
function getTargetId(req) {
  // Try to get ID from params
  if (req.params.id) return req.params.id;
  if (req.params.zoneId) return req.params.zoneId;
  if (req.params.wardId) return req.params.wardId;
  if (req.params.areaId) return req.params.areaId;
  if (req.params.employeeId) return req.params.employeeId;
  if (req.params.vehicleId) return req.params.vehicleId;
  if (req.params.deviceId) return req.params.deviceId;
  if (req.params.dumpYardId) return req.params.dumpYardId;
  if (req.params.dustBinId) return req.params.dustBinId;
  if (req.params.houseId) return req.params.houseId;
  if (req.params.queryId) return req.params.queryId;
  if (req.params.approvalId) return req.params.approvalId;
  
  // Try to get ID from body for creation
  if (req.body._id) return req.body._id;
  if (req.body.id) return req.body.id;
  
  return null;
}

// Helper function to determine database type
function getDatabaseType(path) {
  // MongoDB endpoints
  const mongoEndpoints = [
    '/garbageCollections',
    '/attendanceLogs',
    '/houses',
    '/carbonFootprintDetails',
    '/queries',
    '/approvals'
  ];
  
  if (mongoEndpoints.some(endpoint => path.includes(endpoint))) {
    return 'MongoDB';
  }
  
  // Default to SQL for other endpoints
  return 'SQL';
}

// Helper function to generate human-readable description
function getDescription(req, action) {
  const method = req.method;
  const path = req.path;
  const resource = path.split('/').filter(part => part && part !== 'api')[0] || 'resource';
  
  const descriptions = {
    'GET': `Retrieved ${resource} data`,
    'POST': `Created new ${resource}`,
    'PUT': `Updated ${resource}`,
    'PATCH': `Partially updated ${resource}`,
    'DELETE': `Deleted ${resource}`
  };
  
  return descriptions[method] || `Performed ${action} on ${resource}`;
}

module.exports = { activityLogger };
