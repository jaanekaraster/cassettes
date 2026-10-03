const fs = require("fs");
const path = require("path");

const { parseCsv } = require("./csv-utils.cjs");

const ROOT = path.resolve(__dirname, "..");

const CSV_PATH = path.join(ROOT, "data", "songs.csv");
const OUTPUT_DIR = path.join(ROOT, "data", "songs");

function parseCsvLine(line) {
  const fields = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      field += '"';
      i++;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      fields.push(field);
      field = "";
      continue;
    }

    field += char;
  }

  fields.push(field);

  if (insideQuotes) {
    throw new Error("Unclosed quote in CSV line");
  }

  return fields;
}


function makeSong(row) {
  if (!row.id.trim()) {
    throw new Error(`Line ${row._line}: missing id`);
  }

  if (!row.title.trim()) {
    throw new Error(`Line ${row._line}: missing title`);
  }

  return {
    id: row.id.trim(),

    title: row.title.trim(),

    original_title: {
      script: row.original_title.trim() || null,
      transliteration: row.transliteration.trim() || null
    },

    language: row.language.trim() || null,

    reference: row.reference.trim() || null,

    description: row.description.trim(),

    lyrics: {
      original: row.lyrics_original.trim() || null,
      transliteration: row.lyrics_transliterated.trim() || null,
      english: row.lyrics_english.trim() || null
    }
  };
}


if (!fs.existsSync(CSV_PATH)) {
  throw new Error(
    `CSV file not found: ${path.relative(ROOT, CSV_PATH)}`
  );
}

const csv = fs.readFileSync(CSV_PATH, "utf8");
const rows = parseCsv(csv);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const generatedIds = new Set();

for (const row of rows) {
  const song = makeSong(row);

  if (generatedIds.has(song.id)) {
    throw new Error(
      `Duplicate song ID: ${song.id}`
    );
  }

  generatedIds.add(song.id);

  const filename = `${song.id}.json`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(song, null, 2) + "\n",
    "utf8"
  );

  console.log(
    `Generated data/songs/${filename}`
  );
}

console.log();
console.log(`Generated ${rows.length} song(s).`);
