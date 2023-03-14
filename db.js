const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const mongoURI = process.env.DATABASE;
mongoose.set("strictQuery", false);
const connectToMongo = () => {
  mongoose
    .connect(mongoURI, () => {
      //console.log(mongoURI);
      console.log("Connected to Mongo Successfully");
    })
    .catch((err) => {
      console.log("no connection");
      console.log(err);
    });
};

module.exports = connectToMongo;
