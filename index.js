require("dotenv").config({ path: "./config.env" });

const config = require("./config/index");
const connectToMongo = require("./db");
const express = require("express");
var cors = require("cors");
const { startScheduledJobs } = require("./automation/scheduler");

connectToMongo();
const app = express();
const port = config.port;

app.use(cors());
app.use(express.json());

// Available Routes
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/notes", require("./routes/notes.routes"));
app.use("/api/categories", require("./routes/categories.routes"));
app.use("/api/contact", require("./routes/contact.routes"));

startScheduledJobs();

app.listen(port, () => {
  console.log(`squareroottwo backend listening at http://localhost:${port}`);
});

// Basic ping endpoint
app.get("/ping", (req, res) => {
  console.log("Ping request received at:", new Date().toISOString());
  res.status(200).send("OK");
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Internal Server Error",
  });
});
