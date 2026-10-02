const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const OUTPUT_DIR = path.join(ROOT, "site", "data");

function readJsonDirectory(directory) {
  const fullPath = path.join(DATA_DIR, directory);

  if (!fs.existsSync(fullPath)) {
    return [];
  }

  return fs
    .readdirSync(fullPath)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !file.endsWith("-template.json"))
    .sort()
    .map((file) => {
      const filePath = path.join(fullPath, file);

      try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (error) {
        throw new Error(`Invalid JSON in ${directory}/${file}: ${error.message}`);
      }
    });
}

function writeJson(filename, data) {
  const outputPath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(data, null, 2) + "\n",
    "utf8"
  );

  console.log(`Generated ${path.relative(ROOT, outputPath)}`);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const people = readJsonDirectory("people");
const songs = readJsonDirectory("songs");
const recordings = readJsonDirectory("recordings");

writeJson("people.json", people);
writeJson("songs.json", songs);
writeJson("recordings.json", recordings);

console.log();
console.log(`People:     ${people.length}`);
console.log(`Songs:      ${songs.length}`);
console.log(`Recordings: ${recordings.length}`);
