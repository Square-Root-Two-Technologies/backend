const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { LoremIpsum } = require("lorem-ipsum");
const connectToMongo = require("./db"); // Your existing db connection
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

// Sample user data
const testUsers = [
  {
    name: "Admin User",
    email: "admin@example.com",
    password: "admin123",
    country: "USA",
    city: "New York",
    about: "I am the admin.",
    role: "admin",
  },
  {
    name: "John Doe",
    email: "john.doe@example.com",
    password: "password123",
    country: "Canada",
    city: "Toronto",
    about: "Just a regular user.",
    role: "user",
  },
  {
    name: "Jane Smith",
    email: "jane.smith@example.com",
    password: "password123",
    country: "UK",
    city: "London",
    about: "Loves writing notes.",
    role: "user",
  },
  {
    name: "Alice Johnson",
    email: "alice.j@example.com",
    password: "password123",
    country: "Australia",
    city: "Sydney",
    about: "Tech enthusiast.",
    role: "user",
  },
  {
    name: "Bob Brown",
    email: "bob.brown@example.com",
    password: "password123",
    country: "Germany",
    city: "Berlin",
    about: "Creative writer.",
    role: "user",
  },
];

// Function to create test users
async function createTestUsers() {
  try {
    await User.deleteMany({}); // Clear existing users (optional)
    const users = [];
    for (const userData of testUsers) {
      const salt = await bcrypt.genSalt(10);
      const secPass = await bcrypt.hash(userData.password, salt);
      const user = await User.create({
        name: userData.name,
        email: userData.email,
        password: secPass,
        country: userData.country,
        city: userData.city,
        about: userData.about,
        role: userData.role,
      });
      users.push(user);
      console.log(`Created user: ${user.name}`);
    }
    return users;
  } catch (error) {
    console.error("Error creating users:", error);
    process.exit(1);
  }
}

// Function to create test notes
async function createTestNotes(users) {
  try {
    await Note.deleteMany({}); // Clear existing notes (optional)
    const notesCount = 100;
    for (let i = 0; i < notesCount; i++) {
      const user = users[Math.floor(Math.random() * users.length)]; // Random user
      const type = noteTypes[Math.floor(Math.random() * noteTypes.length)]; // Random type
      const title = lorem.generateWords(3); // 3-word title
      const description = lorem.generateParagraphs(2); // 2-paragraph description
      const tag = lorem.generateWords(1); // 1-word tag
      const isFeatured = user.role === "admin" && Math.random() < 0.2; // 20% chance for admin
      const words = description.split(/\s+/).filter(Boolean).length;
      const readTimeMinutes = Math.max(1, Math.ceil(words / 200));

      const note = await Note.create({
        user: user._id,
        title: `${type} Note: ${title}`,
        description,
        tag,
        type,
        isFeatured,
        readTimeMinutes,
      });
      console.log(`Created note ${i + 1}/${notesCount}: ${note.title}`);
    }
  } catch (error) {
    console.error("Error creating notes:", error);
    process.exit(1);
  }
}

// Main function to run the script
async function main() {
  try {
    const users = await createTestUsers();
    await createTestNotes(users);
    console.log("Test data population completed!");
  } catch (error) {
    console.error("Error in main:", error);
  } finally {
    mongoose.connection.close();
    console.log("Database connection closed.");
  }
}

// Run the script
main();
