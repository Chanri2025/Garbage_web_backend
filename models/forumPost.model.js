const mongoose = require("mongoose");

const ForumPostSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Post title is required"],
    trim: true,
    minlength: [5, "Title must be at least 5 characters long"],
    maxlength: [200, "Title cannot exceed 200 characters"]
  },
  content: {
    type: String,
    required: [true, "Post content is required"],
    trim: true,
    minlength: [10, "Content must be at least 10 characters long"],
    maxlength: [5000, "Content cannot exceed 5000 characters"]
  },
  category: {
    type: String,
    required: [true, "Category is required"],
    enum: ["General", "Technical", "Workplace", "Suggestion", "Complaint", "technical-errors", "cleaning-garbage"],
    default: "General"
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
  likes: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    userRole: {
      type: String,
      required: true,
      enum: ['admin', 'employee', 'citizen', 'manager']
    },
    username: {
      type: String,
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  replies: [{
    content: {
      type: String,
      required: [true, "Reply content is required"],
      trim: true,
      minlength: [1, "Reply cannot be empty"],
      maxlength: [1000, "Reply cannot exceed 1000 characters"]
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
    likes: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
      },
      userRole: {
        type: String,
        required: true,
        enum: ['admin', 'employee', 'citizen', 'manager']
      },
      username: {
        type: String,
        required: true
      },
      timestamp: {
        type: Date,
        default: Date.now
      }
    }],
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
  isPinned: {
    type: Boolean,
    default: false
  },
  isLocked: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for like count
ForumPostSchema.virtual('likeCount').get(function() {
  return this.likes.length;
});

// Virtual for reply count
ForumPostSchema.virtual('replyCount').get(function() {
  return this.replies.length;
});

// Indexes for performance
ForumPostSchema.index({ title: 'text', content: 'text' });
ForumPostSchema.index({ category: 1, createdAt: -1 });
ForumPostSchema.index({ author: 1, createdAt: -1 });
ForumPostSchema.index({ 'likes.userId': 1 });
ForumPostSchema.index({ createdAt: -1 });
ForumPostSchema.index({ likeCount: -1 });
ForumPostSchema.index({ replyCount: -1 });

// Pre-save middleware to update tags
ForumPostSchema.pre('save', function(next) {
  if (this.isModified('title') || this.isModified('content')) {
    // Extract potential tags from title and content
    const text = `${this.title} ${this.content}`.toLowerCase();
    const tagMatches = text.match(/#(\w+)/g);
    if (tagMatches) {
      this.tags = [...new Set(tagMatches.map(tag => tag.slice(1)))].slice(0, 5);
    }
  }
  next();
});

module.exports = mongoose.model("ForumPost", ForumPostSchema);
