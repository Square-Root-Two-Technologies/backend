// FILE: populateTestData.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { LoremIpsum } = require("lorem-ipsum");
const slugify = require("slugify"); // <-- Import slugify
const dotenv = require("dotenv"); // <-- Import dotenv

// Load environment variables from .env file
dotenv.config({ path: "./config.env" }); // <-- Load .env

const connectToMongo = require("./db");
const User = require("./models/User");
const Note = require("./models/Note");

// Connect to MongoDB
connectToMongo();

// Lorem Ipsum generator
const lorem = new LoremIpsum({
  sentencesPerParagraph: { max: 8, min: 4 },
  wordsPerSentence: { max: 16, min: 4 },
});

// Note types from your schema
const noteTypes = [
  "JavaScript",
  "Salesforce",
  "Sociology",
  "Life",
  "Technology",
  "Creative",
  "Tutorial",
  "News",
];

// Sample user data (only admin)
const testUsers = [
  {
    name: "Admin User",
    email: "admin@example.com",
    password: "admin123", // Use a strong password in reality
    country: "USA",
    city: "New York",
    about: "I am the admin.",
    role: "admin",
  },
];

// Function to create test user
async function createTestUsers() {
  try {
    console.log("Clearing existing users...");
    await User.deleteMany({}); // Clear existing users
    console.log("Creating test admin user...");
    const salt = await bcrypt.genSalt(10);
    const secPass = await bcrypt.hash(testUsers[0].password, salt);
    const user = await User.create({
      name: testUsers[0].name,
      email: testUsers[0].email,
      password: secPass,
      country: testUsers[0].country,
      city: testUsers[0].city,
      about: testUsers[0].about,
      role: testUsers[0].role,
    });
    console.log(`Created user: ${user.name} (ID: ${user._id})`);
    return [user]; // Return the created user in an array
  } catch (error) {
    console.error("Error creating user:", error);
    process.exit(1); // Exit if user creation fails
  }
}

// Function to create test notes
async function createTestNotes(users) {
  try {
    console.log("Clearing existing notes...");
    await Note.deleteMany({}); // Clear existing notes
    const notesCount = 100; // Number of notes to create
    const user = users[0]; // Get the single admin user created

    if (!user || !user._id) {
      console.error(
        "Admin user was not created successfully. Cannot create notes.",
      );
      process.exit(1);
    }

    console.log(
      `Starting creation of ${notesCount} notes for user ${user.email}...`,
    );

    for (let i = 0; i < notesCount; i++) {
      const type = noteTypes[Math.floor(Math.random() * noteTypes.length)];
      // Make title slightly more unique initially
      const title = `${type} Example ${i + 1}: ${lorem.generateWords(3)}`;
      const description = lorem.generateParagraphs(2);
      const tag = lorem.generateWords(1);
      // Only admin can set isFeatured, so we can randomly set it here
      const isFeatured = Math.random() < 0.2; // ~20% chance
      const words = description.split(/\s+/).filter(Boolean).length;
      const readTimeMinutes = Math.max(1, Math.ceil(words / 200)); // Min 1 minute read time

      // --- Slug Generation Logic (similar to your API) ---
      let baseSlug = slugify(title, {
        lower: true, // Convert to lower case
        strict: true, // Remove characters like !, @, #, etc.
        remove: /[*+~.()'"!:@]/g, // Define characters to remove
      });

      // Handle cases where slugify might return an empty string after removing chars
      if (!baseSlug) {
        baseSlug = `note-${Date.now()}-${i}`; // Fallback slug
      }

      let slug = baseSlug;
      let counter = 1;
      let existingNote = await Note.findOne({ slug: slug });

      // Check for collisions and append counter if needed
      while (existingNote) {
        counter++;
        slug = `${baseSlug}-${counter}`;
        // console.warn(`Slug collision detected for '${baseSlug}'. Trying new slug: ${slug}`); // Optional: log collisions
        existingNote = await Note.findOne({ slug: slug });
      }
      // --- End Slug Generation Logic ---

      const noteData = {
        user: user._id,
        title: title,
        slug: slug, // <-- Include the generated slug
        description,
        tag,
        type,
        isFeatured,
        readTimeMinutes,
      };

      // Use try-catch inside the loop to catch individual note creation errors if needed
      try {
        await Note.create(noteData);
        if ((i + 1) % 10 === 0) {
          // Log progress every 10 notes
          console.log(`Created note ${i + 1}/${notesCount}...`);
        }
      } catch (noteError) {
        console.error(`Error creating note "${title}":`, noteError.message);
        // Decide if you want to continue or stop on error
        // continue; // Skip this note and continue
        // process.exit(1); // Stop the script
      }
    }
    console.log(`Successfully created ${notesCount} notes.`);
  } catch (error) {
    console.error("Error during the note creation process:", error);
    process.exit(1); // Exit if there's a major error in the loop setup
  }
}

// Main function to run the script
async function main() {
  console.log("Starting test data population...");
  try {
    const users = await createTestUsers();
    if (users && users.length > 0) {
      await createTestNotes(users);
      console.log("Test data population completed successfully!");
    } else {
      console.error("User creation failed, skipping note creation.");
    }
  } catch (error) {
    console.error("An error occurred during the main execution:", error);
  } finally {
    // Ensure the connection is closed
    await mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

// Run the script
main();
