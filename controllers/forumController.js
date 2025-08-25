const ForumPost = require("../models/forumPost.model");
const { validationResult } = require("express-validator");

// Get all posts with pagination, filtering, and sorting
exports.getPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      search,
      sortBy = "latest",
      author
    } = req.query;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter = {};
    
    if (category) {
      filter.category = category;
    }
    
    if (author) {
      filter["author.username"] = { $regex: author, $options: "i" };
    }
    
    if (search) {
      filter.$text = { $search: search };
    }

    // Build sort object
    let sort = {};
    switch (sortBy) {
      case "latest":
        sort = { createdAt: -1 };
        break;
      case "oldest":
        sort = { createdAt: 1 };
        break;
      case "mostLiked":
        sort = { likeCount: -1, createdAt: -1 };
        break;
      case "mostReplied":
        sort = { replyCount: -1, createdAt: -1 };
        break;
      case "pinned":
        sort = { isPinned: -1, createdAt: -1 };
        break;
      default:
        sort = { createdAt: -1 };
    }

    // Execute query
    const posts = await ForumPost.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .select("-__v");

    console.log("Debug - Found posts count:", posts.length);
    console.log("Debug - First post author:", posts[0]?.author);

    // Get total count for pagination
    const total = await ForumPost.countDocuments(filter);

    // Calculate pagination info
    const totalPages = Math.ceil(total / limitNum);
    const hasNext = pageNum < totalPages;
    const hasPrev = pageNum > 1;

    res.json({
      success: true,
      data: {
        posts,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalPosts: total,
          hasNext,
          hasPrev,
          limit: limitNum
        }
      }
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch posts",
      error: error.message
    });
  }
};

// Get single post by ID
exports.getPost = async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ForumPost.findById(id).select("-__v");
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Increment view count
    post.viewCount += 1;
    await post.save();

    res.json({
      success: true,
      data: post
    });
  } catch (error) {
    console.error("Error fetching post:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch post",
      error: error.message
    });
  }
};

// Create new post
exports.createPost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const { title, content, category, tags } = req.body;
    
    // Debug logging to see what user ID is being stored
    console.log("Debug - Creating post with user ID:", req.user.id);
    console.log("Debug - User ID type:", typeof req.user.id);
    console.log("Debug - User role:", req.user.role);
    console.log("Debug - User username:", req.user.username);
    
    const post = new ForumPost({
      title,
      content,
      category,
      tags,
      author: {
        id: req.user.id,
        model: req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1),
        username: req.user.username,
        name: req.user.name,
        role: req.user.role
      }
    });

    console.log("Debug - Post author object:", post.author);
    console.log("Debug - Post author ID type:", typeof post.author.id);

    const savedPost = await post.save();
    console.log("Debug - Post saved successfully:", savedPost._id);
    console.log("Debug - Saved post author:", savedPost.author);

    // Emit WebSocket event for new post
    if (global.forumSocket) {
      global.forumSocket.emitNewPost(savedPost);
    }

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      data: post
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create post",
      error: error.message
    });
  }
};

// Update post
exports.updatePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, category, tags } = req.body;

    const post = await ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Debug logging to see what we're comparing
    console.log("Debug - Post author ID:", post.author.id);
    console.log("Debug - Post author ID type:", typeof post.author.id);
    console.log("Debug - Post author ID toString:", post.author.id.toString());
    console.log("Debug - Request user ID:", req.user.id);
    console.log("Debug - Request user ID type:", typeof req.user.id);
    console.log("Debug - Request user role:", req.user.role);

    // Check if user is author or admin - Fix the comparison
    const isAuthor = post.author.id.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin";
    
    console.log("Debug - Is author:", isAuthor);
    console.log("Debug - Is admin:", isAdmin);

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own posts"
      });
    }

    // Update fields
    if (title) post.title = title;
    if (content) post.content = content;
    if (category) post.category = category;
    if (tags) post.tags = tags;

    await post.save();

    // Emit WebSocket event for post update
    if (global.forumSocket) {
      global.forumSocket.emitPostUpdate(id, post);
    }

    res.json({
      success: true,
      message: "Post updated successfully",
      data: post
    });
  } catch (error) {
    console.error("Error updating post:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update post",
      error: error.message
    });
  }
};

// Delete post
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Debug logging to see what we're comparing
    console.log("Debug - Post author ID:", post.author.id);
    console.log("Debug - Post author ID type:", typeof post.author.id);
    console.log("Debug - Post author ID toString:", post.author.id.toString());
    console.log("Debug - Request user ID:", req.user.id);
    console.log("Debug - Request user ID type:", typeof req.user.id);
    console.log("Debug - Request user role:", req.user.role);

    // Check if user is author or admin - Fix the comparison
    const isAuthor = post.author.id.toString() === req.user.id.toString();
    const isAdmin = req.user.role === "admin";
    
    console.log("Debug - Is author:", isAuthor);
    console.log("Debug - Is admin:", isAdmin);

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own posts or must be an admin"
      });
    }

    await ForumPost.findByIdAndDelete(id);

    // Emit WebSocket event for post deletion
    if (global.forumSocket) {
      global.forumSocket.emitPostDeleted(id);
    }

    res.json({
      success: true,
      message: "Post deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting post:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete post",
      error: error.message
    });
  }
};

// Like/unlike post
exports.togglePostLike = async (req, res) => {
  try {
    const { id } = req.params;
    
    const post = await ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    const existingLikeIndex = post.likes.findIndex(
      like => like.userId.toString() === req.user.id.toString()
    );

    let likeData = {};

    if (existingLikeIndex > -1) {
      // Unlike
      post.likes.splice(existingLikeIndex, 1);
      await post.save();
      
      likeData = { liked: false, likeCount: post.likes.length };
      
      res.json({
        success: true,
        message: "Post unliked",
        data: likeData
      });
    } else {
      // Like
      post.likes.push({
        userId: req.user.id,
        userRole: req.user.role,
        username: req.user.username,
        timestamp: new Date()
      });
      await post.save();
      
      likeData = { liked: true, likeCount: post.likes.length };
      
      res.json({
        success: true,
        message: "Post liked",
        data: likeData
      });
    }

    // Emit WebSocket event for like update
    if (global.forumSocket) {
      global.forumSocket.emitPostLike(id, likeData);
    }
  } catch (error) {
    console.error("Error toggling post like:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle like",
      error: error.message
    });
  }
};

// Add reply to post
exports.addReply = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { content } = req.body;
    
    const post = await ForumPost.findById(id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    if (post.isLocked) {
      return res.status(400).json({
        success: false,
        message: "This post is locked and cannot receive replies"
      });
    }

    const reply = {
      content,
      author: {
        id: req.user.id,
        model: req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1),
        username: req.user.username,
        name: req.user.name,
        role: req.user.role
      },
      timestamp: new Date()
    };

    post.replies.push(reply);
    await post.save();

    // Emit WebSocket event for new reply
    if (global.forumSocket) {
      global.forumSocket.emitNewReply(id, reply);
    }

    res.status(201).json({
      success: true,
      message: "Reply added successfully",
      data: reply
    });
  } catch (error) {
    console.error("Error adding reply:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add reply",
      error: error.message
    });
  }
};

// Like/unlike reply
exports.toggleReplyLike = async (req, res) => {
  try {
    const { postId, replyId } = req.params;
    
    const post = await ForumPost.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    const reply = post.replies.id(replyId);
    
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: "Reply not found"
      });
    }

    const existingLikeIndex = reply.likes.findIndex(
      like => like.userId.toString() === req.user.id.toString()
    );

    let likeData = {};

    if (existingLikeIndex > -1) {
      // Unlike
      reply.likes.splice(existingLikeIndex, 1);
      await post.save();
      
      likeData = { liked: false, likeCount: reply.likes.length };
      
      res.json({
        success: true,
        message: "Reply unliked",
        data: likeData
      });
    } else {
      // Like
      reply.likes.push({
        userId: req.user.id,
        userRole: req.user.role,
        username: req.user.username,
        timestamp: new Date()
      });
      await post.save();
      
      likeData = { liked: true, likeCount: reply.likes.length };
      
      res.json({
        success: true,
        message: "Reply liked",
        data: likeData
      });
    }

    // Emit WebSocket event for reply like update
    if (global.forumSocket) {
      global.forumSocket.emitReplyLike(postId, replyId, likeData);
    }
  } catch (error) {
    console.error("Error toggling reply like:", error);
    res.status(500).json({
      success: false,
      message: "Failed to toggle like",
      error: error.message
    });
  }
};

// Delete reply
exports.deleteReply = async (req, res) => {
  try {
    const { postId, replyId } = req.params;
    
    const post = await ForumPost.findById(postId);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    const reply = post.replies.id(replyId);
    
    if (!reply) {
      return res.status(404).json({
        success: false,
        message: "Reply not found"
      });
    }

    // Check if user is reply author or admin
    if (reply.author.id.toString() !== req.user.id.toString() && req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own replies or must be an admin"
      });
    }

    reply.deleteOne();
    await post.save();

    // Emit WebSocket event for reply deletion
    if (global.forumSocket) {
      global.forumSocket.emitReplyDeleted(postId, replyId);
    }

    res.json({
      success: true,
      message: "Reply deleted successfully"
    });
  } catch (error) {
    console.error("Error deleting reply:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete reply",
      error: error.message
    });
  }
};

// Get post statistics
exports.getPostStats = async (req, res) => {
  try {
    const stats = await ForumPost.aggregate([
      {
        $group: {
          _id: null,
          totalPosts: { $sum: 1 },
          totalReplies: { $sum: { $size: "$replies" } },
          totalLikes: { $sum: { $size: "$likes" } },
          totalViews: { $sum: "$viewCount" }
        }
      }
    ]);

    const categoryStats = await ForumPost.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      data: {
        overall: stats[0] || { totalPosts: 0, totalReplies: 0, totalLikes: 0, totalViews: 0 },
        byCategory: categoryStats
      }
    });
  } catch (error) {
    console.error("Error fetching post stats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message
    });
  }
};
