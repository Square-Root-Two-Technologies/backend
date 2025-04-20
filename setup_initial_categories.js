// setup_initial_categories.js
require("dotenv").config({ path: "./config.env" });
const mongoose = require("mongoose");
const Category = require("./models/Category"); // Adjust path if needed
const mongoURI = process.env.DATABASE;

const initialCategories = [
  {
    name: "JavaScript",
    description: "Posts related to JavaScript programming.",
  },
  {
    name: "Salesforce",
    description: "Posts about Salesforce CRM and platform.",
  },
  { name: "Sociology", description: "Posts related to sociological topics." },
  {
    name: "Life",
    description: "Posts about life experiences and reflections.",
  },
  { name: "Technology", description: "General technology posts." },
  {
    name: "Creative",
    description: "Posts about creative projects or processes.",
  },
  { name: "Tutorial", description: "How-to guides and tutorials." },
  { name: "News", description: "News related updates." },
  // Add ALL other values that existed in your Note.type enum
];

async function setupCategories() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoURI);
  console.log("Connected to MongoDB successfully.");

  let createdCount = 0;
  let skippedCount = 0;

  try {
    console.log("Attempting to create initial categories...");
    for (const catData of initialCategories) {
      const existing = await Category.findOne({
        name: { $regex: `^${catData.name}$`, $options: "i" },
      }); // Check name directly
      if (existing) {
        console.log(`Category "${catData.name}" already exists. Skipping.`);
        skippedCount++;
      } else {
        const newCategory = new Category(catData);
        await newCategory.save();
        // Update console log to remove slug reference
        console.log(`Created category: "${newCategory.name}"`);
        createdCount++;
      }
    }
    console.log("--- Initial Category Setup Summary ---");
    console.log(`Created: ${createdCount}`);
    console.log(`Skipped (already existed): ${skippedCount}`);
  } catch (error) {
    console.error("An error occurred during category setup:", error);
  } finally {
    console.log("Disconnecting from MongoDB...");
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

setupCategories();
