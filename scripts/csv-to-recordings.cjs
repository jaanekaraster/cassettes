const fs = require("fs");
const path = require("path");

const { parseCsv, splitList } = require("./csv-utils.cjs");

const ROOT = path.resolve(__dirname, "..");

const CSV_PATH = path.join(ROOT, "data", "recordings.csv");
const OUTPUT_DIR = path.join(ROOT, "data", "recordings");

function parseInteger(value, fieldName, row, options = {}) {
  if (!value.trim()) {
    if (options.required) {
      throw new Error(
        `Line ${row._line}: ${fieldName} is required`
      );
    }

    return null;
  }

  const number = Number(value);

  if (
    !Number.isInteger(number) ||
    (options.min !== undefined && number < options.min)
  ) {
    throw new Error(
      `Line ${row._line}: ${fieldName} must be an integer` +
      (options.min !== undefined
        ? ` >= ${options.min}`
        : "")
    );
  }

  return number;
}

function parseDate(row) {
  const value = row.date_value.trim();

  if (!value) {
    return null;
  }

  const precision = row.date_precision.trim();

  const validPrecisions = [
    "day",
    "month",
    "year",
    "unknown"
  ];

  if (!validPrecisions.includes(precision)) {
    throw new Error(
      `Line ${row._line}: invalid date_precision "${precision}". ` +
      `Expected one of: ${validPrecisions.join(", ")}`
    );
  }

  return {
    value,
    precision
  };
}

function makeRecording(row) {
  if (!row.id.trim()) {
    throw new Error(`Line ${row._line}: missing id`);
  }

  if (!row.title.trim()) {
    throw new Error(`Line ${row._line}: missing title`);
  }

  if (!row.reel_id.trim()) {
    throw new Error(`Line ${row._line}: missing reel_id`);
  }

  if (!row.audio_path.trim()) {
    throw new Error(`Line ${row._line}: missing audio_path`);
  }

  const songIds = splitList(row.song_ids);

  const songs = songIds.map((songId) => ({
    song_id: songId
  }));

  const participants = splitList(row.participants).map(
    (personId) => ({
      person_id: personId
    })
  );

  const documents = splitList(row.documents).map(
    (documentPath) => ({
      type: "reel_information",
      path: documentPath
    })
  );

  return {
    id: row.id.trim(),

    title: row.title.trim(),

    type: row.type.trim() || "audio",

    songs,

    reel: {
      id: row.reel_id.trim(),
      size: row.reel_size.trim() || null
    },

    participants,

    order: parseInteger(
      row.order,
      "order",
      row,
      { required: true, min: 0 }
    ),

    audio: {
      path: row.audio_path.trim()
    },

    duration_seconds: parseInteger(
      row.duration_seconds,
      "duration_seconds",
      row,
      { min: 0 }
    ),

    description: row.description.trim(),

    comments: row.comments.trim(),

    documents,

    date: parseDate(row)
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
  const recording = makeRecording(row);

  if (generatedIds.has(recording.id)) {
    throw new Error(
      `Duplicate recording ID: ${recording.id}`
    );
  }

  generatedIds.add(recording.id);

  const filename = `${recording.id}.json`;
  const outputPath = path.join(OUTPUT_DIR, filename);

  fs.writeFileSync(
    outputPath,
    JSON.stringify(recording, null, 2) + "\n",
    "utf8"
  );

  console.log(
    `Generated data/recordings/${filename}`
  );
}

console.log();
console.log(`Generated ${rows.length} recording(s).`);
