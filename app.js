const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
dotenv.config();

// Connect to SQL and MongoDB
require("./config/db.sql");
require("./config/db.mongo");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// Import SQL routes
const employeeRoutes = require("./routes/employeeRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const vehicleRoutes = require("./routes/vehicleRoutes");
const zoneRoutes = require("./routes/zoneRoutes");
const wardRoutes = require("./routes/wardRoutes");
const empBeatMapRoutes = require("./routes/empBeatMapRoutes");
const dustBinRoutes = require("./routes/dustBinRoutes");
const areaRoutes = require("./routes/areaRoutes");
const dumpYardRoutes = require("./routes/dumpYardRoutes");
const ipLogRoutes = require("./routes/ipLog.routes");

// Import MongoDB routes
const garbageCollectionRoutes = require("./routes/GarbageCollection.route");
const dailyAttendanceLogRoutes = require("./routes/dailyAttendanceLog.routes");
const houseRoutes = require("./routes/houseRegistration.routes");
const carbonFootprintDetailsRoutes = require("./routes/carbonFootprintDetails.routes");
const areaWiseGarbageCollectionRoutes = require("./routes/areaWiseGarbageCollection.route");
const authRoutes = require("./routes/authRoutes");

// Import Forum routes
const forumRoutes = require("./routes/forumRoutes");

// Import Approval routes
const approvalRoutes = require("./routes/approvalRoutes");

// Import Admin routes
const adminRoutes = require("./routes/adminRoutes");

// SQL API Endpoints
app.use("/api/employees", employeeRoutes);
app.use("/api/devices", deviceRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/wards", wardRoutes);
app.use("/api/empBeatMap", empBeatMapRoutes);
app.use("/api/dustBins", dustBinRoutes);
app.use("/api/areas", areaRoutes);
app.use("/api/dumpYards", dumpYardRoutes);
app.use("/api/iplogs", ipLogRoutes);
app.use("/api/zones", zoneRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", authRoutes);
app.use("/", authRoutes);

// MongoDB API Endpoints
app.use("/api/garbageCollections", garbageCollectionRoutes);
app.use("/api/garbage_collection_areaWise", areaWiseGarbageCollectionRoutes);
app.use("/api/attendanceLogs", dailyAttendanceLogRoutes);
app.use("/api/houses", houseRoutes);
app.use("/api/carbonFootprintDetails", carbonFootprintDetailsRoutes);

// Forum API Endpoints
app.use("/api/forum", forumRoutes);

// Approval Workflow API Endpoints
app.use("/api/approvals", approvalRoutes);

// Admin API Endpoints
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "SWM API with Role Hierarchy is running",
    version: "1.1.0",
    features: {
      roleHierarchy: ["super-admin", "admin", "manager", "employee", "citizen"],
      approvalWorkflow: true,
      userManagement: true
    },
    endpoints: {
      auth: "/api/auth",
      approvals: "/api/approvals",
      forum: "/api/forum"
    }
  });
});

// Initialize WebSocket server
const ForumSocket = require("./websocket/forumSocket");
const forumSocket = new ForumSocket(server);

// Make forumSocket available globally for controllers
global.forumSocket = forumSocket;

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`WebSocket server initialized on port ${PORT}`);
});
