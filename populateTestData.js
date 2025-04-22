// FILE: populateTestData.js
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { LoremIpsum } = require("lorem-ipsum");
const slugify = require("slugify");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

const connectToMongo = require("./db");
const User = require("./models/User");
const Note = require("./models/Note");
const Category = require("./models/Category");

connectToMongo();

const lorem = new LoremIpsum({
  sentencesPerParagraph: { max: 8, min: 4 },
  wordsPerSentence: { max: 16, min: 4 },
});

// --- User Creation (No changes needed) ---
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
  // Add more test users if needed
];

async function createTestUsers() {
  try {
    console.log("Clearing existing users...");
    await User.deleteMany({}); // Careful in production!
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
    return [user]; // Return the created user(s)
  } catch (error) {
    console.error("Error creating user:", error);
    process.exit(1); // Exit if user creation fails
  }
}

// --- Category Creation ---

const initialTopLevelCategories = [
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
  { name: "General", description: "General uncategorized posts." }, // Added General
];

const subCategoryDefinitions = [
  {
    parentName: "Technology",
    name: "Web Development",
    description: "Frontend and backend web technologies.",
  },
  {
    parentName: "Technology",
    name: "Cloud Computing",
    description: "AWS, Azure, GCP, and other cloud platforms.",
  },
  {
    parentName: "Salesforce",
    name: "Apex",
    description: "Salesforce Apex programming language.",
  },
  {
    parentName: "Salesforce",
    name: "Flows",
    description: "Salesforce Flow automation.",
  },
  {
    parentName: "JavaScript",
    name: "React",
    description: "React library for building user interfaces.",
  },
  {
    parentName: "JavaScript",
    name: "Node.js",
    description: "Node.js runtime environment.",
  },
];

async function setupTopLevelCategories() {
  let createdCount = 0;
  let skippedCount = 0;
  const createdOrFoundCategories = [];

  console.log("Attempting to create/find initial top-level categories...");
  for (const catData of initialTopLevelCategories) {
    try {
      // Case-insensitive check
      const existing = await Category.findOne({
        name: { $regex: `^${catData.name}$`, $options: "i" },
        parent: null, // Ensure it's a top-level category
      });

      if (existing) {
        console.log(
          `Top-level category "${catData.name}" already exists. Skipping creation.`,
        );
        skippedCount++;
        createdOrFoundCategories.push(existing); // Add existing category to the list
      } else {
        const newCategory = new Category({
          ...catData,
          parent: null, // Explicitly set parent to null
        });
        await newCategory.save();
        console.log(`Created top-level category: "${newCategory.name}"`);
        createdCount++;
        createdOrFoundCategories.push(newCategory); // Add newly created category
      }
    } catch (error) {
      console.error(
        `Error processing top-level category "${catData.name}":`,
        error,
      );
      // Decide if you want to stop or continue on error
    }
  }
  console.log("--- Top-Level Category Setup Summary ---");
  console.log(`Created: ${createdCount}`);
  console.log(`Skipped (already existed): ${skippedCount}`);
  return createdOrFoundCategories;
}

async function setupSubCategories(parentCategories) {
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const createdOrFoundSubCategories = [];
  const parentMap = parentCategories.reduce((map, cat) => {
    map[cat.name.toLowerCase()] = cat._id;
    return map;
  }, {});

  console.log("\nAttempting to create subcategories...");

  for (const subCatData of subCategoryDefinitions) {
    const parentId = parentMap[subCatData.parentName.toLowerCase()];

    if (!parentId) {
      console.warn(
        `Parent category "${subCatData.parentName}" not found for subcategory "${subCatData.name}". Skipping.`,
      );
      errorCount++;
      continue;
    }

    try {
      // Case-insensitive check for subcategory under the SPECIFIC parent
      const existingSub = await Category.findOne({
        name: { $regex: `^${subCatData.name}$`, $options: "i" },
        parent: parentId,
      });

      if (existingSub) {
        console.log(
          `Subcategory "${subCatData.name}" under "${subCatData.parentName}" already exists. Skipping.`,
        );
        skippedCount++;
        createdOrFoundSubCategories.push(existingSub);
      } else {
        const newSubCategory = new Category({
          name: subCatData.name,
          description: subCatData.description,
          parent: parentId,
        });
        await newSubCategory.save();
        console.log(
          `Created subcategory: "${newSubCategory.name}" under "${subCatData.parentName}"`,
        );
        createdCount++;
        createdOrFoundSubCategories.push(newSubCategory);
      }
    } catch (error) {
      console.error(`Error creating subcategory "${subCatData.name}":`, error);
      errorCount++;
    }
  }

  console.log("--- Subcategory Setup Summary ---");
  console.log(`Created: ${createdCount}`);
  console.log(`Skipped (already existed): ${skippedCount}`);
  console.log(`Errors (e.g., parent not found): ${errorCount}`);
  return createdOrFoundSubCategories;
}

// --- Note Creation (Modified to use all categories) ---
async function createTestNotes(users, allCategories) {
  // Takes ALL categories now
  try {
    console.log("\nClearing existing notes...");
    await Note.deleteMany({}); // Careful in production!

    const notesCount = 150; // Increase count if desired
    const user = users[0]; // Assuming the first user is the author

    if (!user || !user._id) {
      console.error(
        "Admin user was not created successfully. Cannot create notes.",
      );
      process.exit(1);
    }
    if (!allCategories || allCategories.length === 0) {
      console.error("No categories provided to createTestNotes function.");
      process.exit(1);
    }

    console.log(
      `Starting creation of ${notesCount} notes for user ${user.email}, distributed across ${allCategories.length} categories...`,
    );

    for (let i = 0; i < notesCount; i++) {
      // Pick a random category from the combined list (parents and subs)
      const randomCategory =
        allCategories[Math.floor(Math.random() * allCategories.length)];
      const categoryId = randomCategory._id;
      const categoryName = randomCategory.name; // For title generation

      const title = `${categoryName} Post ${i + 1}: ${lorem.generateWords(
        Math.floor(Math.random() * 3) + 2, // Vary title length slightly
      )}`;
      const description = lorem.generateParagraphs(
        Math.floor(Math.random() * 2) + 1,
      ); // Vary paragraphs
      const tag = lorem.generateWords(1);
      const isFeatured = Math.random() < 0.15; // Slightly fewer featured posts

      // Slug generation logic (remains mostly the same)
      let baseSlug = slugify(title, {
        lower: true, // convert to lower case, defaults to `false`
        strict: true, // strip special characters except replacement, defaults to `false`
        remove: /[*+~.()'"!:@]/g, // remove characters that match regex, defaults to `undefined`
      });
      if (!baseSlug) {
        // Fallback if slugify results in empty string (e.g., title was only symbols)
        baseSlug = `note-${Date.now()}-${i}`;
      }

      let slug = baseSlug;
      let counter = 1;
      let existingNote = await Note.findOne({ slug: slug });

      // Handle potential slug collisions
      while (existingNote) {
        counter++;
        slug = `${baseSlug}-${counter}`;
        existingNote = await Note.findOne({ slug: slug });
      }

      const noteData = {
        user: user._id,
        title: title,
        slug: slug, // Use the unique slug
        description,
        tag,
        category: categoryId, // Assign the chosen category ID
        isFeatured,
        // readTimeMinutes will be calculated by the pre-save hook
      };

      try {
        await Note.create(noteData);
        if ((i + 1) % 25 === 0) {
          // Log progress less frequently
          console.log(`Created note ${i + 1}/${notesCount}...`);
        }
      } catch (noteError) {
        if (
          noteError.code === 11000 &&
          noteError.keyPattern &&
          noteError.keyPattern.slug
        ) {
          console.warn(
            `WARN: Slug collision occurred for title "${title}" (Slug: ${slug}) even after check. Skipping this note.`,
          );
          // This should ideally not happen with the check above, but good to handle.
        } else {
          console.error(
            `Error creating note "${title}" (Category: ${categoryName}, Slug: ${slug}):`,
            noteError.message,
          );
        }
      }
    }
    console.log(`Successfully attempted creation of ${notesCount} notes.`);
  } catch (error) {
    console.error("Error during the note creation process:", error);
    process.exit(1); // Exit if note creation fails catastrophically
  }
}

// --- Main Execution ---
async function main() {
  console.log("Starting test data population...");
  try {
    // 1. Create/Find Top-Level Categories
    const topLevelCategories = await setupTopLevelCategories();

    // 2. Create Subcategories
    const subCategories = await setupSubCategories(topLevelCategories);

    // 3. Combine all categories
    const allCategories = [...topLevelCategories, ...subCategories];

    if (allCategories.length === 0) {
      console.error(
        "ERROR: No categories found or created. Cannot proceed with note creation.",
      );
      process.exit(1);
    }
    console.log(
      `\nTotal categories available for notes: ${allCategories.length}`,
    );

    // 4. Create Users
    const users = await createTestUsers();

    // 5. Create Notes using ALL categories
    if (users && users.length > 0) {
      await createTestNotes(users, allCategories); // Pass the combined list
      console.log("\nTest data population completed successfully!");
    } else {
      console.error("User creation failed, skipping note creation.");
    }
  } catch (error) {
    console.error("An error occurred during the main execution:", error);
  } finally {
    await mongoose.connection.close();
    console.log("\nDatabase connection closed.");
  }
}

main();
