const db = require("../config/db.sql");
const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

// READ: Get all dump yards
exports.getAllDumpYards = (req, res) => {
  db.query("SELECT * FROM Dump_Yard_Details", (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
};

// CREATE: Add a new dump yard and generate a QR code
exports.createDumpYard = async (req, res) => {
  try {
    const data = req.body;

    const dumpYardId = data.DY_ID; // User-defined ID

    // Optional: Check if this DY_ID already exists to prevent duplicates
    const [existing] = await db
      .promise()
      .query("SELECT * FROM Dump_Yard_Details WHERE DY_ID = ?", [dumpYardId]);

    if (existing.length > 0) {
      return res.status(400).json({ error: "Dump Yard ID already exists" });
    }

    // Insert the dump yard record with user-defined DY_ID
    await db.promise().query("INSERT INTO Dump_Yard_Details SET ?", data);

    // Generate QR data using the provided DY_ID and DY_Name
    const dumpYardName = data.DY_Name || "DumpYard";
    const qrData = `DY_ID=${dumpYardId}&name=${dumpYardName}`;

    // Path setup for QR code file
    const qrFilename = `dump_yard_qr_${dumpYardId}.png`;
    const qrDir = path.join(__dirname, "../uploads/qrcodes");
    const qrFilePath = path.join(qrDir, qrFilename);

    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    // Generate QR code image
    await QRCode.toFile(qrFilePath, qrData, {
      type: "png",
      errorCorrectionLevel: "H",
    });

    const qrUrl = `/uploads/qrcodes/${qrFilename}`;

    // Update the record with the QR code URL
    await db
      .promise()
      .query("UPDATE Dump_Yard_Details SET DY_QR_Url = ? WHERE DY_ID = ?", [
        qrUrl,
        dumpYardId,
      ]);

    res.status(201).json({
      message: "Dump yard created",
      id: dumpYardId,
      qrUrl,
    });
  } catch (err) {
    console.error("Error creating dump yard:", err);
    res.status(500).json({ error: err.message });
  }
};

// UPDATE: Edit an existing dump yard by DY_ID, regenerate QR code, remove old QR image, and return updated record.
exports.updateDumpYard = async (req, res) => {
  try {
    const dumpYardId = req.params.id;
    const newData = { ...req.body };

    // Retrieve the current dump yard record to get the existing QR code URL and current name.
    const [currentRows] = await db
      .promise()
      .query(
        "SELECT DY_QR_Url, DY_Name FROM Dump_Yard_Details WHERE DY_ID = ?",
        [dumpYardId]
      );
    if (currentRows.length === 0) {
      return res.status(404).json({ message: "Dump yard not found" });
    }
    const oldQrUrl = currentRows[0].DY_QR_Url;
    const currentName = currentRows[0].DY_Name;
    // Use new name if provided; otherwise, fallback to current name.
    const newName = newData.DY_Name ? newData.DY_Name : currentName;

    // First, update the dump yard record with the new data (excluding QR code).
    await db
      .promise()
      .query("UPDATE Dump_Yard_Details SET ? WHERE DY_ID = ?", [
        newData,
        dumpYardId,
      ]);

    // Generate new QR code data.
    const qrData = `DY_ID=${dumpYardId}&name=${newName}`;
    const qrFilename = `dump_yard_qr_${dumpYardId}_${Date.now()}.png`;
    const qrDir = path.join(__dirname, "../uploads/qrcodes");
    const newQrFilePath = path.join(qrDir, qrFilename);

    if (!fs.existsSync(qrDir)) {
      fs.mkdirSync(qrDir, { recursive: true });
    }

    // Generate the new QR code.
    await QRCode.toFile(newQrFilePath, qrData, {
      type: "png",
      errorCorrectionLevel: "H",
    });
    const newQrUrl = `/uploads/qrcodes/${qrFilename}`;

    // Delete the old QR code image if it exists.
    if (oldQrUrl) {
      const oldQrPath = path.join(__dirname, "../", oldQrUrl);
      if (fs.existsSync(oldQrPath)) {
        fs.unlink(oldQrPath, (err) => {
          if (err) console.error("Error deleting old QR image:", err);
          else console.log("Old QR image deleted:", oldQrPath);
        });
      }
    }

    // Update the record with the new QR code URL.
    await db
      .promise()
      .query("UPDATE Dump_Yard_Details SET DY_QR_Url = ? WHERE DY_ID = ?", [
        newQrUrl,
        dumpYardId,
      ]);

    // Retrieve the updated record.
    const [updatedRows] = await db
      .promise()
      .query("SELECT * FROM Dump_Yard_Details WHERE DY_ID = ?", [dumpYardId]);
    res.json({ message: "Dump yard updated", data: updatedRows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE: Remove a dump yard by DY_ID and delete its associated QR code image.
exports.deleteDumpYard = async (req, res) => {
  try {
    const dumpYardId = req.params.id;
    // Retrieve the current dump yard record to get the QR code URL.
    const [rows] = await db
      .promise()
      .query("SELECT DY_QR_Url FROM Dump_Yard_Details WHERE DY_ID = ?", [
        dumpYardId,
      ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Dump yard not found" });
    }
    const qrUrl = rows[0].DY_QR_Url;

    // Delete the QR code image file if it exists.
    if (qrUrl) {
      const filePath = path.join(__dirname, "../", qrUrl);
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error("Error deleting QR image:", err);
          else console.log("QR image deleted:", filePath);
        });
      }
    }

    // Delete the dump yard record from the database.
    await db
      .promise()
      .query("DELETE FROM Dump_Yard_Details WHERE DY_ID = ?", [dumpYardId]);
    res.json({ message: "Dump yard and associated QR image deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
