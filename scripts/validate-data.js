const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const errors = [];
const warnings = [];

function readDirectory(type) {
  const directory = path.join(DATA_DIR, type);

  if (!fs.existsSync(directory)) {
    errors.push(`Missing directory: data/${type}`);
    return [];
  }

  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .filter((file) => !file.endsWith("-template.json"))
    .sort()
    .map((file) => {
      const relativePath = `data/${type}/${file}`;

      try {
        return {
          file: relativePath,
          data: JSON.parse(
            fs.readFileSync(path.join(directory, file), "utf8")
          )
        };
      } catch (error) {
        errors.push(`${relativePath}: invalid JSON — ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

function checkIds(records, type) {
  const ids = new Map();

  for (const record of records) {
    const id = record.data?.id;

    if (!id) {
      errors.push(`${record.file}: missing id`);
      continue;
    }

    if (ids.has(id)) {
      errors.push(
        `${record.file}: duplicate ${type} id "${id}" ` +
        `(also in ${ids.get(id)})`
      );
    } else {
      ids.set(id, record.file);
    }
  }

  return ids;
}

function requireString(record, field) {
  if (
    typeof record.data?.[field] !== "string" ||
    record.data[field].trim() === ""
  ) {
    errors.push(`${record.file}: "${field}" must be a non-empty string`);
  }
}

const people = readDirectory("people");
const songs = readDirectory("songs");
const recordings = readDirectory("recordings");

const peopleById = checkIds(people, "person");
const songsById = checkIds(songs, "song");
checkIds(recordings, "recording");

for (const person of people) {
  requireString(person, "name");
  requireString(person, "display_name");

  if (!Array.isArray(person.data.photos)) {
    errors.push(`${person.file}: "photos" must be an array`);
  }
}

for (const song of songs) {
  requireString(song, "title");

  if (song.data.language !== undefined &&
      song.data.language !== null &&
      typeof song.data.language !== "string") {
    errors.push(`${song.file}: "language" must be a string or null`);
  }

  if (
    song.data.original_title !== undefined &&
    song.data.original_title !== null &&
    typeof song.data.original_title !== "object"
  ) {
    errors.push(`${song.file}: "original_title" must be an object or null`);
  }
}

for (const recording of recordings) {
  const data = recording.data;

  requireString(recording, "type");

  if (data.type !== "audio") {
    errors.push(`${recording.file}: "type" must currently be "audio"`);
  }

  if (!data.song_id) {
    errors.push(`${recording.file}: missing "song_id"`);
  } else if (!songsById.has(data.song_id)) {
    errors.push(
      `${recording.file}: song_id "${data.song_id}" does not exist`
    );
  }

  if (!data.reel || typeof data.reel !== "object") {
    errors.push(`${recording.file}: missing "reel" object`);
  } else {
    if (!data.reel.id) {
      errors.push(`${recording.file}: reel.id is required`);
    }

    if (!data.reel.size) {
      warnings.push(`${recording.file}: reel.size is missing`);
    }
  }

  if (!data.audio || typeof data.audio !== "object") {
    errors.push(`${recording.file}: missing "audio" object`);
  } else if (
    typeof data.audio.path !== "string" ||
    data.audio.path.trim() === ""
  ) {
    errors.push(`${recording.file}: audio.path must be a non-empty string`);
  }

  if (
    data.duration_seconds !== undefined &&
    data.duration_seconds !== null &&
    (!Number.isInteger(data.duration_seconds) ||
      data.duration_seconds < 0)
  ) {
    errors.push(
      `${recording.file}: duration_seconds must be a non-negative integer`
    );
  }

  if (!Array.isArray(data.participants)) {
    errors.push(`${recording.file}: participants must be an array`);
  } else {
    for (const participant of data.participants) {
      if (!participant.person_id) {
        errors.push(`${recording.file}: participant missing person_id`);
      } else if (!peopleById.has(participant.person_id)) {
        errors.push(
          `${recording.file}: person_id "${participant.person_id}" does not exist`
        );
      }
    }
  }

  if (data.documents !== undefined && !Array.isArray(data.documents)) {
    errors.push(`${recording.file}: documents must be an array`);
  }

  if (data.date !== null && data.date !== undefined) {
    if (typeof data.date !== "object") {
      errors.push(`${recording.file}: date must be an object or null`);
    } else {
      const validPrecisions = ["year", "date"];

      if (!data.date.value) {
        errors.push(`${recording.file}: date.value is required`);
      }

      if (!validPrecisions.includes(data.date.precision)) {
        errors.push(
          `${recording.file}: date.precision must be "year" or "date"`
        );
      }
    }
  }
}

console.log(`People:     ${people.length}`);
console.log(`Songs:      ${songs.length}`);
console.log(`Recordings: ${recordings.length}`);

if (warnings.length > 0) {
  console.log("\nWarnings:");

  for (const warning of warnings) {
    console.log(`  ⚠ ${warning}`);
  }
}

if (errors.length > 0) {
  console.error("\nErrors:");

  for (const error of errors) {
    console.error(`  ✗ ${error}`);
  }

  console.error(`\nValidation failed with ${errors.length} error(s).`);
  process.exit(1);
}

console.log("\n✓ Archive data is valid.");
