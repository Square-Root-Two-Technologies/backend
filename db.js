const mongoose = require("mongoose");

const mongoURI =
  "mongodb://squareroottwo:Q9Vc5jBvnfCRdomDF0SvNNFwFwwwcMT86v5vm73ZdnhuwWT7IFGuYSzsv8Sdiy4wg2qUvHS441HkACDbV20lQg%3D%3D@squareroottwo.mongo.cosmos.azure.com:10255/?ssl=true&replicaSet=globaldb&retrywrites=false&maxIdleTimeMS=120000&appName=@squareroottwo@";
//"mongodb://localhost:27017/iNotebook?readPreference=primary&appname=MongoDB%20Compass&directConnection=true&ssl=false";

const connectToMongo = () => {
  mongoose.connect(mongoURI, () => {
    console.log("Connected to Mongo Successfully");
  });
};

module.exports = connectToMongo;
