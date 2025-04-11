const fs = require("fs").promises;
const path = require("path");

// --- Configuration ---
const rootDir = __dirname; // The root directory of your Node.js backend
const outputFile = path.join(__dirname, "all_backend_code_condensed.txt"); // Renamed output

// Files and extensions to include (common for Node.js backends)
// *** REVIEW: Are all these extensions truly necessary? Maybe remove less common ones? ***
const relevantExtensions = [
  ".js",
  ".ts",
  ".json", // For configs like package.json - consider if *all* JSONs are needed
  ".env", // Be careful including .env files if they contain secrets!
  // Add other extensions relevant to your specific backend if needed
];

// Specific root files to include (optional, will be included if they match extensions)
const rootFilesToInclude = [
  "package.json",
  "server.js",
  "app.js",
  "index.js",
  "tsconfig.json",
  ".eslintrc.js",
  "Dockerfile",
  // Add other specific root config/entry files if needed
].map((file) => path.join(rootDir, file));

// Directories and files to ignore (adjusted for backend)
// *** REVIEW: Add any other build output, cache, log, or non-essential dirs ***
const ignoredDirs = [
  "node_modules",
  ".git",
  "dist",
  "build", // Another common build output folder
  "logs",
  "test", // Keep tests if you want them, otherwise ignore
  "coverage",
  ".vscode",
  "temp",
  "cache",
];

// *** REVIEW: Add any other specific files to ignore (lock files, local envs, etc.) ***
const ignoredRootFiles = new Set([
  path.basename(outputFile), // Ignore the output file itself
  "aggregate-code.js", // Ignore this script itself (assuming it's named this)
  "package-lock.json",
  "yarn.lock",
  ".gitignore",
  ".env.local",
  ".env.development",
  ".env.production",
  // Add other sensitive or generated files you don’t want included
]);

// --- Helper Functions ---

function isIgnored(itemPath, isDirectory) {
  const baseName = path.basename(itemPath);
  const relativePath = path.relative(rootDir, itemPath);
  const pathSegments = relativePath.split(path.sep);

  // Ignore hidden files/folders (except special cases like .github/.gitlab if needed)
  if (
    baseName.startsWith(".") &&
    baseName !== ".github" &&
    baseName !== ".gitlab" &&
    !relevantExtensions.includes(path.extname(baseName).toLowerCase()) && // Don't ignore hidden files if they have relevant extensions (like .eslintrc.js)
    !rootFilesToInclude.includes(itemPath) // Check if it's an explicitly included root file like .env
  ) {
    // Refined logic: Ignore hidden unless explicitly included or matching relevant extension
    const ext = path.extname(baseName).toLowerCase();
    if (
      !relevantExtensions.includes(ext) &&
      !rootFilesToInclude.includes(itemPath)
    ) {
      return true;
    }
    // Allow explicitly included hidden files like .env, .eslintrc.js if relevantExtensions match
    if (
      rootFilesToInclude.includes(itemPath) &&
      relevantExtensions.includes(ext)
    ) {
      // Keep it
    } else if (!relevantExtensions.includes(ext)) {
      // Ignore hidden files without relevant extension unless explicitly listed
      // This part might be redundant with the outer check, but makes logic clearer
      return true;
    }
  }

  if (pathSegments.length > 0 && ignoredDirs.includes(pathSegments[0]))
    return true;
  if (path.dirname(itemPath) === rootDir && ignoredRootFiles.has(baseName))
    return true;

  return false;
}

// Async function to get all relevant files from the root directory
async function getAllFiles(dirPath) {
  const files = [];
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(dirPath, item.name);
      if (isIgnored(fullPath, item.isDirectory())) continue;

      if (item.isDirectory()) {
        const subFiles = await getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (
        item.isFile() &&
        relevantExtensions.includes(path.extname(item.name).toLowerCase())
      ) {
        // Check again if it's explicitly ignored as a root file
        if (!isIgnored(fullPath, false)) {
          files.push(fullPath);
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dirPath}:`, err);
  }
  return files;
}

// Build file structure (async) - unchanged
async function buildFileStructure(dirPath) {
  const structure = {};
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });
    for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const fullPath = path.join(dirPath, item.name);
      if (isIgnored(fullPath, item.isDirectory())) continue;

      if (item.isDirectory()) {
        const subStructure = await buildFileStructure(fullPath);
        if (Object.keys(subStructure).length > 0) {
          structure[item.name] = subStructure;
        }
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        // Include in structure only if relevant extension and not ignored
        if (relevantExtensions.includes(ext) && !isIgnored(fullPath, false)) {
          structure[item.name] = true;
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory for structure ${dirPath}:`, err);
  }
  return structure;
}

// --- NEW: Content Processing Functions ---

/**
 * Removes single-line (//) and multi-line (/* ... * /) comments from code.
 * Note: This regex approach might not be 100% perfect for edge cases
 * like comments within strings or regex literals. Test carefully.
 * @param {string} code The code content
 * @returns {string} Code with comments removed
 */
function removeComments(code) {
  // Remove multi-line comments /* ... */ (non-greedy)
  let cleanedCode = code.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove single-line comments // ... (handles http:// correctly)
  cleanedCode = cleanedCode.replace(/(?<!:)\/\/[^\r\n]*/g, ""); // Avoid matching // in http://
  return cleanedCode;
}

/**
 * Removes blank lines (lines containing only whitespace) from text.
 * @param {string} text The text content
 * @returns {string} Text with blank lines removed
 */
function removeBlankLines(text) {
  return text
    .split(/[\r\n]+/) // Split by one or more newline characters
    .filter((line) => line.trim().length > 0) // Keep lines with non-whitespace content
    .join("\n"); // Join back with single newlines
}

// --- Core Aggregation Logic ---
async function aggregateCode() {
  console.log(
    `Aggregating and condensing code from root directory: ${rootDir}...`,
  );

  // Filter root files to include only those that exist and match extensions
  const existingRootFiles = [];
  for (const file of rootFilesToInclude) {
    try {
      await fs.access(file);
      const ext = path.extname(file).toLowerCase();
      // Ensure it has a relevant extension AND is not globally ignored
      if (relevantExtensions.includes(ext) && !isIgnored(file, false)) {
        existingRootFiles.push(file);
      }
    } catch (err) {
      if (err.code === "ENOENT") {
        // console.log(`Skipping non-existent root file: ${path.relative(rootDir, file)}`); // Optional: Log skipped files
      } else {
        console.error(`Error checking file ${file}:`, err);
      }
    }
  }

  // Scan the entire root directory for other files
  const scannedFiles = await getAllFiles(rootDir);

  // Combine, ensure uniqueness (Set), sort, and filter out ignored root files again just in case
  const allFilePaths = [...new Set([...existingRootFiles, ...scannedFiles])]
    .filter((filePath) => !isIgnored(filePath, false)) // Final check for ignored status
    .sort();

  // Build the file structure representation (optional, can be removed for more size savings)
  const fileStructure = await buildFileStructure(rootDir);
  let aggregatedContent = "// --- File Structure ---\n";
  aggregatedContent += JSON.stringify(fileStructure, null, 2) + "\n\n"; // Pretty print structure
  // For slightly smaller structure: aggregatedContent += JSON.stringify(fileStructure) + "\n\n";

  aggregatedContent +=
    "// --- Aggregated Code Content (Comments and Blank Lines Removed) ---\n\n";

  for (const filePath of allFilePaths) {
    try {
      const relativePath = path
        .relative(__dirname, filePath)
        .replace(/\\/g, "/"); // Use forward slashes for consistency

      let fileContent = await fs.readFile(filePath, "utf8");

      // --- Process Content ---
      // Only process specific types to avoid breaking JSON, .env etc.
      const fileExt = path.extname(filePath).toLowerCase();
      if ([".js", ".ts", ".jsx", ".tsx"].includes(fileExt)) {
        // Add other code extensions if needed
        fileContent = removeComments(fileContent);
        fileContent = removeBlankLines(fileContent);
      } else if (fileExt === ".json") {
        // Optionally minify JSON (removes whitespace)
        try {
          fileContent = JSON.stringify(JSON.parse(fileContent)); // Minify JSON
        } catch (jsonError) {
          console.warn(
            `Warning: Could not parse/minify JSON file ${relativePath}. Keeping original content. Error: ${jsonError.message}`,
          );
          // Keep original content if parsing fails
        }
      } else {
        // For other files like .env, maybe just trim whitespace? Or leave as is.
        fileContent = fileContent.trim(); // Simple trim for other types
      }
      // -----------------------

      // Add a separator only if the file content is not empty after processing
      if (fileContent.length > 0) {
        aggregatedContent += `// FILE: ${relativePath}\n${fileContent}\n\n`;
      } else {
        aggregatedContent += `// FILE: ${relativePath} (Content Removed or Empty)\n\n`;
      }
    } catch (err) {
      const relativePath = path
        .relative(__dirname, filePath)
        .replace(/\\/g, "/");
      console.error(`Error processing file ${relativePath}:`, err);
      aggregatedContent += `// !!! ERROR Processing File: ${relativePath} !!!\n// Error: ${err.message}\n\n`;
    }
  }

  try {
    // Ensure there's a single newline at the very end
    aggregatedContent = aggregatedContent.trimEnd() + "\n";
    await fs.writeFile(outputFile, aggregatedContent);
    console.log(`Successfully aggregated and condensed code to ${outputFile}`);
    console.log(`\nTip: For further size reduction, compress the output file:`);
    console.log(`  gzip ${path.basename(outputFile)}`);
    console.log(`  (Or use zip/7z)`);
  } catch (err) {
    console.error(`Error writing to ${outputFile}:`, err);
  }
}

// --- Run Once ---
(async () => {
  await aggregateCode();
})();
