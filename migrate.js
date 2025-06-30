require("dotenv").config();
const fs = require("fs");
const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;
const dbName = process.env.MONGO_DB;
const collectionName = "house_details";

async function migrate() {
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const collection = db.collection(collectionName);

    // Read JSON data
    const rawData = fs.readFileSync("house_details.json", "utf-8");
    const houseData = JSON.parse(rawData);

    // Optional: clear existing records
    await collection.deleteMany({});

    // Insert new data
    const result = await collection.insertMany(houseData);

    console.log(`✅ Inserted ${result.insertedCount} house records into '${collectionName}'`);
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await client.close();
  }
}

migrate();
