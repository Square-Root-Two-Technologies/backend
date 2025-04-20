// migration_add_categories.js
require("dotenv").config({ path: "./config.env" });
const mongoose = require("mongoose");
const Note = require("./models/Note");
const Category = require("./models/Category");

const mongoURI = process.env.DATABASE;

async function runMigration() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoURI);
  console.log("Connected to MongoDB successfully.");

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  try {
    console.log("Fetching all categories...");
    const categories = await Category.find({});
    if (categories.length === 0) {
      console.error(
        'ERROR: No categories found in the database. Please create categories matching the old "type" values first.',
      );
      return;
    }

    // Create a map for easy lookup (case-insensitive name mapping)
    const categoryMap = categories.reduce((map, cat) => {
      // Assuming category names directly map to old type values (e.g., 'JavaScript', 'Salesforce')
      map[cat.name.toLowerCase()] = cat._id;
      return map;
    }, {});

    console.log(
      `Found ${categories.length} categories. Map created:`,
      Object.keys(categoryMap),
    );

    console.log("Starting note migration...");
    // Process notes in batches to avoid memory issues
    const batchSize = 100;
    let processedNotes = 0;
    let hasMoreNotes = true;
    let lastId = null;

    while (hasMoreNotes) {
      const query = {
        $or: [
          { category: { $exists: false } }, // Notes without a category field
          { type: { $exists: true } }, // Notes that still have the old 'type' field
        ],
      };
      if (lastId) {
        query._id = { $gt: lastId }; // Paginate using _id
      }

      const notesBatch = await Note.find(query)
        .select("_id type") // Only select needed fields
        .limit(batchSize)
        .sort({ _id: 1 }); // Sort by _id for pagination

      if (notesBatch.length === 0) {
        hasMoreNotes = false;
        break;
      }

      lastId = notesBatch[notesBatch.length - 1]._id;
      processedNotes += notesBatch.length;
      console.log(
        `Processing batch of ${notesBatch.length} notes (Total processed: ${processedNotes})...`,
      );

      for (const note of notesBatch) {
        if (!note.type) {
          console.warn(
            `Note ID ${note._id} has no 'type' field and no 'category'. Skipping.`,
          );
          skippedCount++;
          continue;
        }

        const typeLower = note.type.toLowerCase();
        const categoryId = categoryMap[typeLower];

        if (categoryId) {
          try {
            const updateResult = await Note.updateOne(
              { _id: note._id },
              {
                $set: { category: categoryId }, // Set the new category reference
                $unset: { type: "" }, // Remove the old 'type' field
              },
            );

            if (updateResult.modifiedCount === 1) {
              updatedCount++;
              // console.log(`Updated Note ID: ${note._id} (Type: ${note.type} -> Category: ${categoryId})`);
            } else {
              // This might happen if the note was somehow updated between the find and updateOne calls
              console.warn(
                `Note ID ${note._id} was found but not modified. Result:`,
                updateResult,
              );
              skippedCount++;
            }
          } catch (updateError) {
            console.error(`Error updating Note ID: ${note._id}`, updateError);
            errorCount++;
          }
        } else {
          console.warn(
            `No category found for type "${note.type}" (Note ID: ${note._id}). Skipping.`,
          );
          skippedCount++;
        }
      }
      console.log(
        `Batch processed. Updated: ${updatedCount}, Skipped: ${skippedCount}, Errors: ${errorCount}`,
      );
    }

    console.log("--- Migration Summary ---");
    console.log(`Total Notes Processed (approx): ${processedNotes}`);
    console.log(`Successfully Updated: ${updatedCount}`);
    console.log(`Skipped (no type/category or no match): ${skippedCount}`);
    console.log(`Errors during update: ${errorCount}`);
    console.log("Migration finished.");
  } catch (error) {
    console.error("An error occurred during migration:", error);
  } finally {
    console.log("Disconnecting from MongoDB...");
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

runMigration();
