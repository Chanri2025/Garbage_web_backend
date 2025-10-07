const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const crypto = require('crypto');

/**
 * Security middleware configurations
 * Provides comprehensive security measures for the application
 */

// Rate limiting configurations
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      message: message || 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        message: message || 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// General API rate limiting
const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  1000, // 1000 requests per 15 minutes
  'Too many requests from this IP, please try again later.'
);

// Strict rate limiting for authentication endpoints
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 login attempts per 15 minutes
  'Too many login attempts from this IP, please try again after 15 minutes.'
);

// Registration rate limiting
const registrationLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 registration attempts per hour
  'Too many registration attempts from this IP, please try again after 1 hour.'
);

// Password reset rate limiting
const passwordResetLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 password reset attempts per hour
  'Too many password reset attempts from this IP, please try again after 1 hour.'
);

// File upload rate limiting
const uploadLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  10, // 10 uploads per hour
  'Too many file uploads from this IP, please try again after 1 hour.'
);

// Admin operations rate limiting
const adminLimiter = createRateLimit(
  5 * 60 * 1000, // 5 minutes
  50, // 50 admin operations per 5 minutes
  'Too many admin operations from this IP, please try again after 5 minutes.'
);

/**
 * Generate a secure random string for JWT secrets
 * @param {number} length - Length of the random string
 * @returns {string} - Secure random string
 */
const generateSecureSecret = (length = 64) => {
  return crypto.randomBytes(length).toString('hex');
};

/**
 * Validate JWT secret strength
 * @param {string} secret - JWT secret to validate
 * @returns {boolean} - True if secret is strong enough
 */
const validateJWTSecret = (secret) => {
  if (!secret || typeof secret !== 'string') {
    return false;
  }
  
  // Minimum 32 characters for JWT secret
  if (secret.length < 32) {
    return false;
  }
  
  // Check for common weak secrets
  const weakSecrets = [
    'secret', 'password', '123456', 'admin', 'test',
    'yoursecretkey', 'jwtsecret', 'mysecret'
  ];
  
  return !weakSecrets.some(weak => secret.toLowerCase().includes(weak));
};

/**
 * Get secure JWT secret from environment or generate one
 * @returns {string} - Secure JWT secret
 */
const getSecureJWTSecret = () => {
  const envSecret = process.env.JWT_SECRET;
  
  if (envSecret && validateJWTSecret(envSecret)) {
    return envSecret;
  }
  
  // Generate a secure secret if none exists or current one is weak
  const newSecret = generateSecureSecret(64);
  console.warn('⚠️  JWT_SECRET not found or weak. Generated new secure secret.');
  console.warn('⚠️  Add this to your .env file: JWT_SECRET=' + newSecret);
  
  return newSecret;
};

/**
 * Security headers configuration
 */
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for API compatibility
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * CORS configuration for security
 */
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001'
    ];
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // 24 hours
};

/**
 * Input sanitization middleware
 */
const sanitizeInput = (req, res, next) => {
  // Remove potentially dangerous characters from string inputs
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/javascript:/gi, '') // Remove javascript: protocol
      .replace(/on\w+\s*=/gi, '') // Remove event handlers
      .trim();
  };
  
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = sanitizeString(req.body[key]);
      }
    }
  }
  
  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key]);
      }
    }
  }
  
  next();
};

module.exports = {
  // Rate limiters
  generalLimiter,
  authLimiter,
  registrationLimiter,
  passwordResetLimiter,
  uploadLimiter,
  adminLimiter,
  
  // Security utilities
  generateSecureSecret,
  validateJWTSecret,
  getSecureJWTSecret,
  
  // Middleware
  securityHeaders,
  corsOptions,
  sanitizeInput
};
