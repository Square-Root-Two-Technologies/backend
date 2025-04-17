const connectToMongo = require("./db");
const express = require("express");
var cors = require("cors");
connectToMongo();
const app = express();
const port = 5000;

app.use(cors());
app.use(express.json());

// Available Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/notes", require("./routes/notes"));

app.listen(port, () => {
  console.log(`squareroottwo backend listening at http://localhost:${port}`);
});

//for basic ping
app.get("/", (req, res) => {
  console.log("Ping request received at:", new Date().toISOString()); // Optional: Log pings for verification
  res.status(200).send("OK"); // Send a simple 200 OK response
});
