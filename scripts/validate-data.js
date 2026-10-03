const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");

const errors = [];
const warnings = [];

/**
 * Read all JSON files from a data directory.
 */
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
          filename: path.basename(file, ".json"),
          data: JSON.parse(
            fs.readFileSync(path.join(directory, file), "utf8")
          ),
        };
      } catch (error) {
        errors.push(`${relativePath}: invalid JSON — ${error.message}`);
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Validate IDs and build a lookup map.
 *
 * The JSON "id" field is the canonical ID.
 * The filename must match the JSON ID.
 *
 * Example:
 *
 *   person_001.json
 *   {
 *     "id": "person_001"
 *   }
 */
function checkIds(records, type) {
  const ids = new Map();

  for (const record of records) {
    const id = record.data?.id;

    if (!id) {
      errors.push(`${record.file}: missing id`);
      continue;
    }

    if (typeof id !== "string" || id.trim() === "") {
      errors.push(`${record.file}: id must be a non-empty string`);
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

    if (record.filename !== id) {
      errors.push(
        `${record.file}: filename "${record.filename}.json" ` +
          `does not match id "${id}"`
      );
    }
  }

  return ids;
}

/**
 * Require a non-empty string field.
 */
function requireString(record, field) {
  if (
    typeof record.data?.[field] !== "string" ||
    record.data[field].trim() === ""
  ) {
    errors.push(`${record.file}: "${field}" must be a non-empty string`);
  }
}

/**
 * Validate recording -> song relationships.
 *
 * A recording can contain multiple songs:
 *
 * "songs": [
 *   { "song_id": "song_001" },
 *   { "song_id": "song_002" }
 * ]
 */
function validateSongReferences(recording, songsById) {
  const data = recording.data;

  if (!Array.isArray(data.songs)) {
    errors.push(`${recording.file}: "songs" must be an array`);
    return;
  }

  for (const song of data.songs) {
    if (
      !song ||
      typeof song !== "object" ||
      Array.isArray(song)
    ) {
      errors.push(
        `${recording.file}: each songs entry must be an object`
      );
      continue;
    }

    if (
      typeof song.song_id !== "string" ||
      song.song_id.trim() === ""
    ) {
      errors.push(`${recording.file}: song missing song_id`);
      continue;
    }

    if (!songsById.has(song.song_id)) {
      errors.push(
        `${recording.file}: song_id "${song.song_id}" does not exist`
      );
    }
  }
}

/**
 * Validate recording -> person relationships.
 *
 * A recording can have multiple participants:
 *
 * "participants": [
 *   { "person_id": "person_001" },
 *   { "person_id": "person_002" }
 * ]
 */
function validateParticipantReferences(recording, peopleById) {
  const data = recording.data;

  if (!Array.isArray(data.participants)) {
    errors.push(`${recording.file}: "participants" must be an array`);
    return;
  }

  for (const participant of data.participants) {
    if (
      !participant ||
      typeof participant !== "object" ||
      Array.isArray(participant)
    ) {
      errors.push(
        `${recording.file}: each participants entry must be an object`
      );
      continue;
    }

    if (
      typeof participant.person_id !== "string" ||
      participant.person_id.trim() === ""
    ) {
      errors.push(
        `${recording.file}: participant missing person_id`
      );
      continue;
    }

    if (!peopleById.has(participant.person_id)) {
      errors.push(
        `${recording.file}: person_id "${participant.person_id}" does not exist`
      );
    }
  }
}

/**
 * Validate people.
 */
function validatePeople(people) {
  for (const person of people) {
    requireString(person, "name");
    requireString(person, "display_name");

    if (!Array.isArray(person.data.photos)) {
      errors.push(`${person.file}: "photos" must be an array`);
    }
  }
}

/**
 * Validate songs.
 */
function validateSongs(songs) {
  for (const song of songs) {
    requireString(song, "title");

    if (
      song.data.language !== undefined &&
      song.data.language !== null &&
      typeof song.data.language !== "string"
    ) {
      errors.push(
        `${song.file}: "language" must be a string or null`
      );
    }

    if (
      song.data.original_title !== undefined &&
      song.data.original_title !== null &&
      (
        typeof song.data.original_title !== "object" ||
        Array.isArray(song.data.original_title)
      )
    ) {
      errors.push(
        `${song.file}: "original_title" must be an object or null`
      );
    }
  }
}

/**
 * Validate recordings.
 */
function validateRecordings(recordings, peopleById, songsById) {
  for (const recording of recordings) {
    const data = recording.data;

    requireString(recording, "type");

    if (data.type !== "audio") {
      errors.push(
        `${recording.file}: "type" must currently be "audio"`
      );
    }

    // A recording can contain multiple songs.
    validateSongReferences(recording, songsById);

    // A recording can contain multiple participants.
    validateParticipantReferences(recording, peopleById);

    /*
     * Reel
     */
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

    /*
     * Audio
     */
    if (!data.audio || typeof data.audio !== "object") {
      errors.push(`${recording.file}: missing "audio" object`);
    } else if (
      typeof data.audio.path !== "string" ||
      data.audio.path.trim() === ""
    ) {
      errors.push(
        `${recording.file}: audio.path must be a non-empty string`
      );
    }

    /*
     * Duration
     */
    if (
      data.duration_seconds !== undefined &&
      data.duration_seconds !== null &&
      (
        !Number.isInteger(data.duration_seconds) ||
        data.duration_seconds < 0
      )
    ) {
      errors.push(
        `${recording.file}: duration_seconds must be a non-negative integer`
      );
    }

    /*
     * Documents
     */
    if (
      data.documents !== undefined &&
      !Array.isArray(data.documents)
    ) {
      errors.push(
        `${recording.file}: documents must be an array`
      );
    }

    /*
     * Date
     */
    if (data.date !== null && data.date !== undefined) {
      if (
        typeof data.date !== "object" ||
        Array.isArray(data.date)
      ) {
        errors.push(
          `${recording.file}: date must be an object or null`
        );
      } else {
        const validPrecisions = ["year", "date"];

        if (!data.date.value) {
          errors.push(
            `${recording.file}: date.value is required`
          );
        }

        if (!validPrecisions.includes(data.date.precision)) {
          errors.push(
            `${recording.file}: date.precision must be "year" or "date"`
          );
        }
      }
    }
  }
}

/*
 * Load data.
 */
const people = readDirectory("people");
const songs = readDirectory("songs");
const recordings = readDirectory("recordings");

/*
 * Build ID indexes.
 */
const peopleById = checkIds(people, "person");
const songsById = checkIds(songs, "song");
checkIds(recordings, "recording");

/*
 * Validate each data type.
 */
validatePeople(people);
validateSongs(songs);
validateRecordings(recordings, peopleById, songsById);

/*
 * Summary.
 */
console.log(`People:     ${people.length}`);
console.log(`Songs:      ${songs.length}`);
console.log(`Recordings: ${recordings.length}`);

/*
 * Warnings.
 */
if (warnings.length > 0) {
  console.log("\nWarnings:");

  for (const warning of warnings) {
    console.log(`  ⚠ ${warning}`);
  }
}

/*
 * Errors.
 */
if (errors.length > 0) {
  console.error("\nErrors:");

  for (const error of errors) {
    console.error(`  ✗ ${error}`);
  }

  console.error(
    `\nValidation failed with ${errors.length} error(s).`
  );

  process.exit(1);
}

console.log("\n✓ Archive data is valid.");