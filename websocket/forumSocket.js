const socketIo = require("socket.io");
const jwt = require("jsonwebtoken");
const Admin = require("../models/admin.model");
const Citizen = require("../models/citizen.model");
const Employee = require("../models/employee.model");

class ForumSocket {
  constructor(server) {
    this.io = socketIo(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.connectedUsers = new Map(); // userId -> socketId
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace("Bearer ", "");
        
        if (!token) {
          return next(new Error("Authentication error: No token provided"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || "yoursecretkey");
        const getUserModel = (role) => {
          switch (role) {
            case "admin": return Admin;
            case "citizen": return Citizen;
            case "employee": return Employee;
            default: return null;
          }
        };

        const UserModel = getUserModel(decoded.role);
        if (!UserModel) {
          return next(new Error("Authentication error: Invalid user role"));
        }

        const user = await UserModel.findById(decoded.id);
        if (!user) {
          return next(new Error("Authentication error: User not found"));
        }

        socket.user = {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
          name: user.name || user.username
        };

        next();
      } catch (error) {
        next(new Error("Authentication error: Invalid token"));
      }
    });
  }

  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`User connected: ${socket.user.username} (${socket.user.role})`);
      
      // Store user connection
      this.connectedUsers.set(socket.user.id, socket.id);
      
      // Join user to their role-based room
      socket.join(`role_${socket.user.role}`);
      
      // Join user to general forum room
      socket.join("forum_general");

      // Handle user joining specific post room
      socket.on("join_post", (postId) => {
        socket.leaveAll();
        socket.join(`post_${postId}`);
        socket.join(`role_${socket.user.role}`);
        socket.join("forum_general");
        console.log(`User ${socket.user.username} joined post room: ${postId}`);
      });

      // Handle user leaving specific post room
      socket.on("leave_post", (postId) => {
        socket.leave(`post_${postId}`);
        console.log(`User ${socket.user.username} left post room: ${postId}`);
      });

      // Handle disconnection
      socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.user.username}`);
        this.connectedUsers.delete(socket.user.id);
      });
    });
  }

  // Emit new post to all users
  emitNewPost(post) {
    this.io.to("forum_general").emit("new_post", {
      type: "new_post",
      data: post,
      timestamp: new Date()
    });
  }

  // Emit post update to post room
  emitPostUpdate(postId, post) {
    this.io.to(`post_${postId}`).emit("post_updated", {
      type: "post_updated",
      data: post,
      timestamp: new Date()
    });
  }

  // Emit post deletion to all users
  emitPostDeleted(postId) {
    this.io.to("forum_general").emit("post_deleted", {
      type: "post_deleted",
      data: { postId },
      timestamp: new Date()
    });
  }

  // Emit new reply to post room
  emitNewReply(postId, reply) {
    this.io.to(`post_${postId}`).emit("new_reply", {
      type: "new_reply",
      data: { postId, reply },
      timestamp: new Date()
    });
  }

  // Emit reply update to post room
  emitReplyUpdated(postId, replyId, reply) {
    this.io.to(`post_${postId}`).emit("reply_updated", {
      type: "reply_updated",
      data: { postId, replyId, reply },
      timestamp: new Date()
    });
  }

  // Emit reply deletion to post room
  emitReplyDeleted(postId, replyId) {
    this.io.to(`post_${postId}`).emit("reply_deleted", {
      type: "reply_deleted",
      data: { postId, replyId },
      timestamp: new Date()
    });
  }

  // Emit like/unlike to post room
  emitPostLike(postId, likeData) {
    this.io.to(`post_${postId}`).emit("post_like_updated", {
      type: "post_like_updated",
      data: { postId, ...likeData },
      timestamp: new Date()
    });
  }

  // Emit reply like/unlike to post room
  emitReplyLike(postId, replyId, likeData) {
    this.io.to(`post_${postId}`).emit("reply_like_updated", {
      type: "reply_like_updated",
      data: { postId, replyId, ...likeData },
      timestamp: new Date()
    });
  }

  // Emit post pinned/unpinned to all users
  emitPostPinned(postId, isPinned) {
    this.io.to("forum_general").emit("post_pinned", {
      type: "post_pinned",
      data: { postId, isPinned },
      timestamp: new Date()
    });
  }

  // Emit post locked/unlocked to all users
  emitPostLocked(postId, isLocked) {
    this.io.to("forum_general").emit("post_locked", {
      type: "post_locked",
      data: { postId, isLocked },
      timestamp: new Date()
    });
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Get connected users by role
  getConnectedUsersByRole(role) {
    const count = Array.from(this.connectedUsers.values()).filter(socketId => {
      const socket = this.io.sockets.sockets.get(socketId);
      return socket && socket.user && socket.user.role === role;
    }).length;
    return count;
  }

  // Send notification to specific user
  sendNotificationToUser(userId, notification) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit("notification", {
        type: "notification",
        data: notification,
        timestamp: new Date()
      });
    }
  }

  // Send notification to all users with specific role
  sendNotificationToRole(role, notification) {
    this.io.to(`role_${role}`).emit("notification", {
      type: "notification",
      data: notification,
      timestamp: new Date()
    });
  }
}

module.exports = ForumSocket;
