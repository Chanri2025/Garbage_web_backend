const QueryPost = require('../models/queryPost.model');
const { validationResult } = require('express-validator');

// Create a new query
exports.createQuery = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const queryData = {
      ...req.body,
      author: {
        id: req.user.id,
        model: req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1),
        name: req.user.name || req.user.username,
        role: req.user.role
      }
    };

    const newQuery = new QueryPost(queryData);
    await newQuery.save();

    res.status(201).json({
      success: true,
      message: 'Query created successfully',
      data: newQuery
    });

  } catch (error) {
    console.error('Error creating query:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create query',
      error: error.message
    });
  }
};

// Get all queries with filtering and pagination
exports.getQueries = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      type,
      status,
      priority,
      assignedTo,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const filter = {};
    
    // Apply filters
    if (type) filter.type = type;
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (assignedTo) filter['assignedTo.id'] = assignedTo;
    
    // Search in description
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const queries = await QueryPost.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('author.id', 'name username')
      .populate('assignedTo.id', 'name username');

    const total = await QueryPost.countDocuments(filter);

    res.json({
      success: true,
      data: {
        queries,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalQueries: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching queries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch queries',
      error: error.message
    });
  }
};

// Get single query by ID
exports.getQueryById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = await QueryPost.findById(id)
      .populate('author.id', 'name username')
      .populate('assignedTo.id', 'name username');

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    // Increment view count
    query.viewCount += 1;
    await query.save();

    res.json({
      success: true,
      data: query
    });

  } catch (error) {
    console.error('Error fetching query:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch query',
      error: error.message
    });
  }
};

// Update query
exports.updateQuery = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const updateData = { ...req.body };

    // Handle field mapping for old format
    if (updateData.userName && !updateData.username) {
      updateData.username = updateData.userName;
    }
    
    if (updateData.title && !updateData.description) {
      updateData.description = updateData.title;
    }
    
    if (updateData.category && !updateData.type) {
      // Map category to proper case
      const categoryMap = {
        'complaint': 'Complaint',
        'technical issue': 'Technical Issue',
        'garbage collection': 'Garbage Collection',
        'account problem': 'Account Problem',
        'payment issue': 'Payment Issue',
        'service request': 'Service Request',
        'suggestion': 'Suggestion',
        'general inquiry': 'General Inquiry',
        'emergency': 'Emergency',
        'other': 'Other'
      };
      updateData.type = categoryMap[updateData.category.toLowerCase()] || updateData.category;
    }

    // Handle priority case mapping
    if (updateData.priority) {
      const priorityMap = {
        'low': 'Low',
        'medium': 'Medium',
        'high': 'High',
        'urgent': 'Urgent'
      };
      updateData.priority = priorityMap[updateData.priority.toLowerCase()] || updateData.priority;
    }

    const query = await QueryPost.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    res.json({
      success: true,
      message: 'Query updated successfully',
      data: query
    });

  } catch (error) {
    console.error('Error updating query:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update query',
      error: error.message
    });
  }
};

// Add response to query
exports.addResponse = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { content, isInternal = false } = req.body;
    const author = req.user;

    const query = await QueryPost.findById(id);
    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    const response = {
      content,
      isInternal,
      author: {
        id: author.id,
        model: author.role.charAt(0).toUpperCase() + author.role.slice(1),
        username: author.username,
        name: author.name || author.username,
        role: author.role
      }
    };

    query.responses.push(response);
    await query.save();

    res.json({
      success: true,
      message: 'Response added successfully',
      data: query
    });

  } catch (error) {
    console.error('Error adding response:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add response',
      error: error.message
    });
  }
};

// Assign query to user
exports.assignQuery = async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedToId, assignedToName, assignedToRole } = req.body;
    const assigner = req.user;

    const query = await QueryPost.findById(id);
    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    query.assignedTo = {
      id: assignedToId,
      model: assignedToRole.charAt(0).toUpperCase() + assignedToRole.slice(1),
      name: assignedToName,
      role: assignedToRole,
      assignedAt: new Date()
    };

    query.status = 'In Progress';
    await query.save();

    res.json({
      success: true,
      message: 'Query assigned successfully',
      data: query
    });

  } catch (error) {
    console.error('Error assigning query:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign query',
      error: error.message
    });
  }
};

// Update query status
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, resolution } = req.body;
    const updater = req.user;

    const query = await QueryPost.findById(id);
    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    query.status = status;

    if (status === 'Resolved' && resolution) {
      query.resolution = {
        summary: resolution.summary,
        resolvedBy: {
          id: updater.id,
          name: updater.name || updater.username,
          role: updater.role
        },
        resolvedAt: new Date()
      };
    }

    await query.save();

    res.json({
      success: true,
      message: 'Query status updated successfully',
      data: query
    });

  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message
    });
  }
};

// Update query priority
exports.updatePriority = async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    const query = await QueryPost.findById(id);
    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    query.priority = priority;
    await query.save();

    res.json({
      success: true,
      message: 'Query priority updated successfully',
      data: query
    });

  } catch (error) {
    console.error('Error updating priority:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update priority',
      error: error.message
    });
  }
};

// Get user's queries
exports.getUserQueries = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { 'author.id': userId };
    if (status) filter.status = status;

    const queries = await QueryPost.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('assignedTo.id', 'name username');

    const total = await QueryPost.countDocuments(filter);

    res.json({
      success: true,
      data: {
        queries,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalQueries: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching user queries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user queries',
      error: error.message
    });
  }
};

// Get assigned queries
exports.getAssignedQueries = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10, status } = req.query;

    const filter = { 'assignedTo.id': userId };
    if (status) filter.status = status;

    const queries = await QueryPost.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('author.id', 'name username');

    const total = await QueryPost.countDocuments(filter);

    res.json({
      success: true,
      data: {
        queries,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalQueries: total
        }
      }
    });

  } catch (error) {
    console.error('Error fetching assigned queries:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch assigned queries',
      error: error.message
    });
  }
};

// Pin/Unpin query
exports.togglePin = async (req, res) => {
  try {
    const { id } = req.params;

    const query = await QueryPost.findById(id);
    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    query.isPinned = !query.isPinned;
    await query.save();

    res.json({
      success: true,
      message: `Query ${query.isPinned ? 'pinned' : 'unpinned'} successfully`,
      data: query
    });

  } catch (error) {
    console.error('Error toggling pin:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle pin',
      error: error.message
    });
  }
};

// Get query statistics
exports.getQueryStats = async (req, res) => {
  try {
    const stats = await QueryPost.aggregate([
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          openQueries: {
            $sum: { $cond: [{ $eq: ['$status', 'Open'] }, 1, 0] }
          },
          inProgressQueries: {
            $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] }
          },
          resolvedQueries: {
            $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] }
          },
          closedQueries: {
            $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] }
          }
        }
      }
    ]);

    const typeStats = await QueryPost.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const priorityStats = await QueryPost.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalQueries: 0,
          openQueries: 0,
          inProgressQueries: 0,
          resolvedQueries: 0,
          closedQueries: 0
        },
        byType: typeStats,
        byPriority: priorityStats
      }
    });

  } catch (error) {
    console.error('Error fetching query stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch query statistics',
      error: error.message
    });
  }
};

// Delete query
exports.deleteQuery = async (req, res) => {
  try {
    const { id } = req.params;

    const query = await QueryPost.findById(id);
    if (!query) {
      return res.status(404).json({
        success: false,
        message: 'Query not found'
      });
    }

    // Only the author or an admin/super-admin can delete
    const isAdmin = ['admin', 'super-admin'].includes(req.user?.role);
    const isAuthor = String(query.author?.id) === String(req.user?.id);
    if (!isAdmin && !isAuthor) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this query'
      });
    }

    await QueryPost.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Query deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting query:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete query',
      error: error.message
    });
  }
};