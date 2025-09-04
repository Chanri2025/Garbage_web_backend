const express = require("express");
const router = express.Router();
const { body, param, query } = require("express-validator");
const rateLimit = require("express-rate-limit");
const { auth, requireRole } = require("../middleware/auth");
const forumController = require("../controllers/forumController");

// Rate limiting for spam prevention
const createPostLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: "Too many posts created, please try again later."
  }
});

const replyLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // limit each IP to 10 replies per windowMs
  message: {
    success: false,
    message: "Too many replies, please try again later."
  }
});

const likeLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 20, // limit each IP to 20 likes per windowMs
  message: {
    success: false,
    message: "Too many likes, please try again later."
  }
});

// Validation middleware
const validatePost = [
  body("title")
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage("Title must be between 5 and 200 characters"),
  body("content")
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage("Content must be between 10 and 5000 characters"),
  body("category")
    .isIn(["General", "Technical", "Workplace", "Suggestion", "Complaint", "technical-errors", "cleaning-garbage"])
    .withMessage("Invalid category"),
  body("tags")
    .optional()
    .isArray({ max: 5 })
    .withMessage("Tags must be an array with maximum 5 items")
];

const validateReply = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Reply content must be between 1 and 1000 characters")
];

const validateId = [
  param("id")
    .isMongoId()
    .withMessage("Invalid post ID")
];

const validatePostAndReplyId = [
  param("postId")
    .isMongoId()
    .withMessage("Invalid post ID"),
  param("replyId")
    .isMongoId()
    .withMessage("Invalid reply ID")
];

// Public routes (no authentication required)
router.get("/posts", forumController.getPosts);
router.get("/posts/:id", validateId, forumController.getPost);
router.get("/stats", forumController.getPostStats);

// Protected routes (authentication required)
router.post("/posts", auth, createPostLimit, validatePost, forumController.createPost);
router.put("/posts/:id", auth, validateId, validatePost, forumController.updatePost);
router.delete("/posts/:id", auth, validateId, requireRole(["admin"]), forumController.deletePost);

// Post interactions
router.put("/posts/:id/like", auth, likeLimit, validateId, forumController.togglePostLike);

// Reply management
router.post("/posts/:id/replies", auth, replyLimit, validateId, validateReply, forumController.addReply);
router.put("/posts/:postId/replies/:replyId/like", auth, likeLimit, validatePostAndReplyId, forumController.toggleReplyLike);
router.delete("/posts/:postId/replies/:replyId", auth, validatePostAndReplyId, forumController.deleteReply);

module.exports = router;
