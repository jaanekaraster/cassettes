const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

const INPUT_FILE = path.join(ROOT, "data", "people.csv");
const OUTPUT_DIR = path.join(ROOT, "data", "people");

const REQUIRED_HEADERS = [
  "id",
  "name",
  "display_name",
  "description",
  "photos",
];

function parseCsv(text) {
  const rows = [];

  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        // Escaped quote: ""
        field += '"';
        i++;
      } else {
        // Start/end quoted field
        insideQuotes = !insideQuotes;
      }

      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      // Handle Windows CRLF without creating an extra row.
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(field);
      field = "";

      // Ignore completely empty rows.
      if (row.some((value) => value !== "")) {
        rows.push(row);
      }

      row = [];
      continue;
    }

    field += char;
  }

  if (insideQuotes) {
    throw new Error("Unclosed quoted field in CSV");
  }

  // Handle final row if the file doesn't end with a newline.
  if (field !== "" || row.length > 0) {
    row.push(field);

    if (row.some((value) => value !== "")) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map((header) => header.trim());

  return rows.slice(1).map((values, index) => {
    const rowObject = {};

    headers.forEach((header, columnIndex) => {
      rowObject[header] = values[columnIndex] ?? "";
    });

    rowObject._line = index + 2;

    return rowObject;
  });
}

function splitList(value) {
  if (!value || !value.trim()) {
    return [];
  }

  return value
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
}

function validateHeaders(rows) {
  if (rows.length === 0) {
    throw new Error("People CSV is empty");
  }

  const headers = REQUIRED_HEADERS;

  for (const header of headers) {
    if (!(header in rows[0])) {
      throw new Error(
        `People CSV is missing required column "${header}"`
      );
    }
  }
}

function validatePersonId(id, line) {
  if (!id || !id.trim()) {
    throw new Error(`Line ${line}: missing id`);
  }

  if (!/^person_[0-9]+$/.test(id)) {
    throw new Error(
      `Line ${line}: invalid person id "${id}". ` +
      `Expected format like "person_001"`
    );
  }
}

function validateString(value, field, line) {
  if (typeof value !== "string") {
    throw new Error(
      `Line ${line}: "${field}" must be a string`
    );
  }
}

function buildPerson(row) {
  const line = row._line;

  const id = row.id.trim();
  const name = row.name.trim();
  const displayName = row.display_name.trim();
  const description = row.description.trim();

  validatePersonId(id, line);
  validateString(row.name, "name", line);
  validateString(row.display_name, "display_name", line);
  validateString(row.description, "description", line);
  validateString(row.photos, "photos", line);

  if (!name) {
    throw new Error(`Line ${line}: "name" cannot be empty`);
  }

  if (!displayName) {
    throw new Error(
      `Line ${line}: "display_name" cannot be empty`
    );
  }

  const photoPaths = splitList(row.photos);

  const photos = photoPaths.map((photoPath) => ({
    path: photoPath,
    caption: "",
  }));

  return {
    id,
    name,
    display_name: displayName,
    description,
    photos,
  };
}

function main() {
  if (!fs.existsSync(INPUT_FILE)) {
    throw new Error(
      `Input file not found: ${path.relative(ROOT, INPUT_FILE)}`
    );
  }

  const csvText = fs.readFileSync(INPUT_FILE, "utf8");
  const rows = parseCsv(csvText);

  validateHeaders(rows);

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const seenIds = new Set();
  let created = 0;

  for (const row of rows) {
    const person = buildPerson(row);

    if (seenIds.has(person.id)) {
      throw new Error(
        `Line ${row._line}: duplicate person id "${person.id}"`
      );
    }

    seenIds.add(person.id);

    const outputFile = path.join(
      OUTPUT_DIR,
      `${person.id}.json`
    );

    fs.writeFileSync(
      outputFile,
      JSON.stringify(person, null, 2) + "\n",
      "utf8"
    );

    console.log(
      `Created ${path.relative(ROOT, outputFile)}`
    );

    created++;
  }

  console.log(
    `\n✓ Created ${created} person JSON file(s).`
  );
}

try {
  main();
} catch (error) {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
}
