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

  const headers = rows[0];

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

module.exports = {
  parseCsv,
  splitList
};
