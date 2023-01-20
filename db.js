const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config({ path: "./config.env" });

const mongoURI = process.env.DATABASE;
//"mongodb://localhost:27017/iNotebook?readPreference=primary&appname=MongoDB%20Compass&directConnection=true&ssl=false";
mongoose.set("strictQuery", false);
const connectToMongo = () => {
  mongoose
    .connect(mongoURI, () => {
      console.log(mongoURI);
      console.log("Connected to Mongo Successfully");
    })
    .catch((err) => console.log("no connection"));
};

module.exports = connectToMongo;
