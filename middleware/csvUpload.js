


const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for CSV upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/csv/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, 'bulk-upload-' + Date.now() + path.extname(file.originalname));
  }
});

// File filter for CSV files only
const fileFilter = (req, file, cb) => {
  console.log('File upload attempt:', {
    originalname: file.originalname,
    mimetype: file.mimetype,
    fieldname: file.fieldname
  });
  
  // Check multiple conditions for CSV files
  const isCSV = 
    file.mimetype === 'text/csv' || 
    file.mimetype === 'application/csv' ||
    file.mimetype === 'text/plain' ||
    file.originalname.toLowerCase().endsWith('.csv') ||
    file.originalname.toLowerCase().includes('.csv');
  
  if (isCSV) {
    console.log('CSV file accepted:', file.originalname);
    cb(null, true);
  } else {
    console.log('File rejected - not a CSV:', {
      originalname: file.originalname,
      mimetype: file.mimetype
    });
    cb(new Error(`Only CSV files are allowed. Received: ${file.mimetype} for file: ${file.originalname}`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

module.exports = upload;