const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
dotenv.config();

// Connect to SQL and MongoDB
require("./config/db.sql");
require("./config/db.mongo");

const app = express();
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

// MongoDB API Endpoints
app.use("/api/garbageCollections", garbageCollectionRoutes);
app.use("/api/garbage_collection_areaWise", areaWiseGarbageCollectionRoutes);
app.use("/api/attendanceLogs", dailyAttendanceLogRoutes);
app.use("/api/houses", houseRoutes);
app.use("/api/carbonFootprintDetails", carbonFootprintDetailsRoutes);

app.get("/", (req, res) => {
  res.send("SWM API is running");
});

const PORT = process.env.PORT || 5000 || 4000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
