const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const mongoURI = process.env.DATABASE;
mongoose.set("strictQuery", false);

// One-time, idempotent backfill: notes created before the isActive field
// existed have no isActive value stored in Mongo at all (Mongoose schema
// defaults only apply to new documents, not existing ones), so they were
// silently excluded by every `{ isActive: true }` query. Safe to run on
// every boot — once every note has the field, this matches zero documents.
async function backfillIsActive() {
  const Note = require("./models/Note");
  const result = await Note.updateMany(
    { isActive: { $exists: false } },
    { $set: { isActive: true } },
  );
  if (result.modifiedCount > 0) {
    console.log(`Backfilled isActive:true on ${result.modifiedCount} pre-existing note(s).`);
  }
}

const connectToMongo = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log("Connected to Mongo Successfully");
    await backfillIsActive();
  } catch (err) {
    console.log("no connection");
    console.log(err);
  }
};

module.exports = connectToMongo;
