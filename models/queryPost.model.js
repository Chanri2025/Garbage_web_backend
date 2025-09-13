const mongoose = require("mongoose");

const QueryPostSchema = new mongoose.Schema({
  // Support both old forum format and new query format
  username: {
    type: String,
    trim: true,
    maxlength: [50, "Username cannot exceed 50 characters"]
  },
  userName: {
    type: String,
    trim: true,
    maxlength: [50, "Username cannot exceed 50 characters"]
  },
  title: {
    type: String,
    trim: true,
    minlength: [5, "Title must be at least 5 characters long"],
    maxlength: [200, "Title cannot exceed 200 characters"]
  },
  description: {
    type: String,
    required: [true, "Query description is required"],
    trim: true,
    minlength: [10, "Description must be at least 10 characters long"],
    maxlength: [2000, "Description cannot exceed 2000 characters"]
  },
  type: {
    type: String,
    required: [true, "Query type is required"],
    enum: [
      "Technical Issue",
      "Garbage Collection",
      "Account Problem", 
      "Payment Issue",
      "Service Request",
      "Complaint",
      "Suggestion",
      "General Inquiry",
      "Emergency",
      "Other"
    ],
    default: "General Inquiry"
  },
  category: {
    type: String,
    enum: [
      "Technical Issue", "technical issue",
      "Garbage Collection", "garbage collection",
      "Account Problem", "account problem",
      "Payment Issue", "payment issue",
      "Service Request", "service request",
      "Complaint", "complaint",
      "Suggestion", "suggestion",
      "General Inquiry", "general inquiry", "general",
      "Emergency", "emergency",
      "Other", "other"
    ]
  },
  status: {
    type: String,
    enum: ["Open", "In Progress", "Resolved", "Closed"],
    default: "Open"
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High", "Urgent", "low", "medium", "high", "urgent"],
    default: "Medium"
  },
  location: {
    address: {
      type: String,
      trim: true,
      maxlength: [200, "Address cannot exceed 200 characters"]
    },
    coordinates: {
      latitude: {
        type: Number,
        min: -90,
        max: 90
      },
      longitude: {
        type: Number,
        min: -180,
        max: 180
      }
    },
    area: {
      type: String,
      trim: true,
      maxlength: [100, "Area name cannot exceed 100 characters"]
    },
    ward: {
      type: String,
      trim: true,
      maxlength: [100, "Ward name cannot exceed 100 characters"]
    },
    zone: {
      type: String,
      trim: true,
      maxlength: [100, "Zone name cannot exceed 100 characters"]
    }
  },
  author: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    model: {
      type: String,
      required: true,
      enum: ['Admin', 'Employee', 'Citizen', 'Manager']
    },
    name: {
      type: String,
      required: true
    },
    role: {
      type: String,
      required: true,
      enum: ['admin', 'employee', 'citizen', 'manager']
    }
  },
  assignedTo: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null
    },
    model: {
      type: String,
      enum: ['Admin', 'Employee', 'Manager'],
      default: null
    },
    name: {
      type: String,
      default: null
    },
    role: {
      type: String,
      enum: ['admin', 'employee', 'manager'],
      default: null
    },
    assignedAt: {
      type: Date,
      default: null
    }
  },
  responses: [{
    content: {
      type: String,
      required: [true, "Response content is required"],
      trim: true,
      minlength: [1, "Response cannot be empty"],
      maxlength: [1000, "Response cannot exceed 1000 characters"]
    },
    author: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      model: {
        type: String,
        required: true,
        enum: ['Admin', 'Employee', 'Citizen', 'Manager']
      },
      username: {
        type: String,
        required: true
      },
      name: {
        type: String,
        required: true
      },
      role: {
        type: String,
        required: true,
        enum: ['admin', 'employee', 'citizen', 'manager']
      }
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  tags: [{
    type: String,
    trim: true,
    maxlength: 20
  }],
  attachments: [{
    filename: {
      type: String,
      required: true
    },
    originalName: {
      type: String,
      required: true
    },
    mimetype: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    uploadedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      username: {
        type: String,
        required: true
      }
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  resolution: {
    summary: {
      type: String,
      maxlength: [500, "Resolution summary cannot exceed 500 characters"]
    },
    resolvedBy: {
      id: {
        type: mongoose.Schema.Types.ObjectId
      },
      name: {
        type: String
      },
      role: {
        type: String
      }
    },
    resolvedAt: {
      type: Date
    }
  },
  viewCount: {
    type: Number,
    default: 0
  },
  isPinned: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for response count
QueryPostSchema.virtual('responseCount').get(function() {
  return this.responses.length;
});

// Virtual for time since creation
QueryPostSchema.virtual('timeSinceCreated').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
});

// Indexes for performance
QueryPostSchema.index({ username: 1, createdAt: -1 });
QueryPostSchema.index({ type: 1, status: 1, createdAt: -1 });
QueryPostSchema.index({ status: 1, priority: 1, createdAt: -1 });
QueryPostSchema.index({ 'author.id': 1, createdAt: -1 });
QueryPostSchema.index({ 'assignedTo.id': 1, status: 1 });
QueryPostSchema.index({ description: 'text' });
QueryPostSchema.index({ createdAt: -1 });
QueryPostSchema.index({ isPinned: -1, createdAt: -1 });
QueryPostSchema.index({ 'location.area': 1, 'location.ward': 1, 'location.zone': 1 });
QueryPostSchema.index({ 'location.coordinates.latitude': 1, 'location.coordinates.longitude': 1 });

// Pre-save middleware to handle field mapping and update tags
QueryPostSchema.pre('save', function(next) {
  // Map old forum fields to new query fields if needed
  if (this.userName && !this.username) {
    this.username = this.userName;
  }
  
  if (this.title && !this.description) {
    this.description = this.title;
  }
  
  if (this.category && !this.type) {
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
      'general': 'General Inquiry',
      'emergency': 'Emergency',
      'other': 'Other'
    };
    this.type = categoryMap[this.category.toLowerCase()] || this.category;
  }
  
  // Set username from userName if not provided
  if (!this.username && this.userName) {
    this.username = this.userName;
  }
  
  // Set username from author if still not provided
  if (!this.username && this.author && this.author.name) {
    this.username = this.author.name;
  }
  
  if (!this.description) {
    return next(new Error('Description is required'));
  }
  
  if (!this.type) {
    this.type = 'General Inquiry';
  }
  
  // Extract potential tags from description
  if (this.isModified('description')) {
    const text = this.description.toLowerCase();
    const tagMatches = text.match(/#(\w+)/g);
    if (tagMatches) {
      this.tags = [...new Set(tagMatches.map(tag => tag.slice(1)))].slice(0, 5);
    }
  }
  
  next();
});

module.exports = mongoose.model("QueryPost", QueryPostSchema);
