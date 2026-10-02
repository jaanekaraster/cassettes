const searchInput = document.querySelector("#search");
const recordingsContainer = document.querySelector("#recordings");
const resultCount = document.querySelector("#result-count");

let people = [];
let songs = [];
let recordings = [];
let mediaBaseUrl = "";

const peopleById = new Map();
const songsById = new Map();

async function loadJson(path) {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Unable to load ${path}: ${response.status}`);
  }

  return response.json();
}

async function loadArchive() {
  const [
    peopleData,
    songsData,
    recordingsData,
    mediaConfig
  ] = await Promise.all([
    loadJson("./data/people.json"),
    loadJson("./data/songs.json"),
    loadJson("./data/recordings.json"),
    loadJson("./config/media.json")
  ]);

  people = peopleData;
  songs = songsData;
  recordings = recordingsData;

  mediaBaseUrl = mediaConfig.base_url.replace(/\/$/, "");

  people.forEach((person) => {
    peopleById.set(person.id, person);
  });

  songs.forEach((song) => {
    songsById.set(song.id, song);
  });

  renderRecordings(recordings);
}

function getParticipants(recording) {
  return recording.participants
    .map((participant) => peopleById.get(participant.person_id))
    .filter(Boolean);
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return "";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function formatDate(date) {
  if (!date) {
    return "";
  }

  return date.value || "";
}

function getAudioUrl(recording) {
  return `${mediaBaseUrl}/${recording.audio.path.replace(/^\/+/, "")}`;
}

function addDetailRow(container, label, value) {
  if (!value) {
    return;
  }

  const row = document.createElement("div");
  row.className = "detail-row";

  const labelElement = document.createElement("dt");
  labelElement.textContent = label;

  const valueElement = document.createElement("dd");
  valueElement.textContent = value;

  row.appendChild(labelElement);
  row.appendChild(valueElement);

  container.appendChild(row);
}

function createYouTubeLink(url) {
  if (!url) {
    return null;
  }

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "Listen to the original song on YouTube ↗";

  return link;
}

function createDocumentLinks(recording) {
  if (!Array.isArray(recording.documents) || recording.documents.length === 0) {
    return null;
  }

  const section = document.createElement("section");
  section.className = "documents";

  const heading = document.createElement("h4");
  heading.textContent = "Documents";
  section.appendChild(heading);

  recording.documents.forEach((archiveDocument) => {
    if (!archiveDocument.path) {
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = "document-button";

    button.textContent =
      archiveDocument.type === "reel_information"
        ? "View reel information"
        : "View document";

    button.addEventListener("click", () => {
      openDocumentModal(archiveDocument.path);
    });

    section.appendChild(button);
  });

  return section;
}


function openDocumentModal(path) {
  const url =
    `${mediaBaseUrl}/${path.replace(/^\/+/, "")}`;

  const overlay = document.createElement("div");
  overlay.className = "document-modal";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Document viewer");

  const modal = document.createElement("div");
  modal.className = "document-modal-content";

  const toolbar = document.createElement("div");
  toolbar.className = "document-modal-toolbar";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "document-modal-close";
  closeButton.textContent = "Close";
  closeButton.setAttribute("aria-label", "Close document");

  const openButton = document.createElement("a");
  openButton.href = url;
  openButton.target = "_blank";
  openButton.rel = "noopener noreferrer";
  openButton.textContent = "Open PDF ↗";
  openButton.className = "document-modal-open";

  toolbar.appendChild(openButton);
  toolbar.appendChild(closeButton);

  const frame = document.createElement("iframe");
  frame.src = url;
  frame.title = "Archive document";
  frame.className = "document-frame";

  modal.appendChild(toolbar);
  modal.appendChild(frame);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function closeModal() {
    overlay.remove();
    document.body.style.overflow = "";
    document.removeEventListener("keydown", handleKeydown);
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  closeButton.addEventListener("click", closeModal);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  document.addEventListener("keydown", handleKeydown);

  document.body.style.overflow = "hidden";

  closeButton.focus();
}


function createDetails(recording) {
  const song = songsById.get(recording.song_id);
  const participants = getParticipants(recording);

  const details = document.createElement("div");
  details.className = "recording-details";
  details.hidden = true;

  if (song?.description) {
    const section = document.createElement("section");

    const heading = document.createElement("h4");
    heading.textContent = "About the song";

    const description = document.createElement("p");
    description.textContent = song.description;

    section.appendChild(heading);
    section.appendChild(description);

    details.appendChild(section);
  }

  const metadata = document.createElement("dl");
  metadata.className = "details-list";

  if (song?.language) {
    addDetailRow(metadata, "Language", song.language);
  }

  if (participants.length > 0) {
    addDetailRow(
      metadata,
      "Participants",
      participants
        .map((person) => person.display_name || person.name)
        .join(", ")
    );
  }

  if (recording.date) {
    addDetailRow(metadata, "Date", formatDate(recording.date));
  }

  if (recording.reel?.id) {
    addDetailRow(metadata, "Reel", recording.reel.id);
  }

  if (recording.reel?.size) {
    addDetailRow(metadata, "Reel size", recording.reel.size);
  }

  if (recording.comments) {
    addDetailRow(metadata, "Comments", recording.comments);
  }

  if (metadata.children.length > 0) {
    details.appendChild(metadata);
  }

  if (song?.reference) {
    const referenceSection = document.createElement("section");
    referenceSection.className = "reference";

    const heading = document.createElement("h4");
    heading.textContent = "Original song";

    referenceSection.appendChild(heading);

    const link = createYouTubeLink(song.reference);

    if (link) {
      referenceSection.appendChild(link);
    }

    details.appendChild(referenceSection);
  }

  const documentLinks = createDocumentLinks(recording);

  if (documentLinks) {
    details.appendChild(documentLinks);
  }


  return details;
}

function createRecordingCard(recording) {
  const song = songsById.get(recording.song_id);
  const participants = getParticipants(recording);

  const article = document.createElement("article");
  article.className = "recording-card";

  const title = document.createElement("h3");
  title.textContent = song?.title || "Untitled recording";

  article.appendChild(title);

  if (song?.original_title?.script) {
    const originalTitle = document.createElement("div");
    originalTitle.className = "original-title";
    originalTitle.textContent = song.original_title.script;
    article.appendChild(originalTitle);
  }

  if (song?.original_title?.transliteration) {
    const transliteration = document.createElement("div");
    transliteration.className = "transliteration";
    transliteration.textContent =
      song.original_title.transliteration;
    article.appendChild(transliteration);
  }

  const metadata = document.createElement("div");
  metadata.className = "metadata";

  const metadataParts = [];

  if (participants.length > 0) {
    metadataParts.push(
      participants
        .map((person) => person.display_name || person.name)
        .join(", ")
    );
  }

  if (recording.date) {
    metadataParts.push(formatDate(recording.date));
  }

  if (recording.reel?.id) {
    metadataParts.push(`Reel ${recording.reel.id}`);
  }

  if (song?.language) {
    metadataParts.push(song.language);
  }

  metadata.textContent = metadataParts.join(" · ");
  article.appendChild(metadata);

  if (recording.description) {
    const description = document.createElement("p");
    description.className = "description";
    description.textContent = recording.description;
    article.appendChild(description);
  }

  const audio = document.createElement("audio");
  audio.controls = true;
  audio.preload = "none";
  audio.src = getAudioUrl(recording);

  article.appendChild(audio);

  const details = createDetails(recording);

  const button = document.createElement("button");
  button.className = "details-button";
  button.type = "button";
  button.textContent = "Show details";

  button.addEventListener("click", () => {
    details.hidden = !details.hidden;
    button.textContent = details.hidden
      ? "Show details"
      : "Hide details";
  });

  article.appendChild(button);
  article.appendChild(details);

  return article;
}

function renderRecordings(items) {
  recordingsContainer.replaceChildren();

  resultCount.textContent =
    `${items.length} recording${items.length === 1 ? "" : "s"}`;

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "No recordings found.";
    recordingsContainer.appendChild(empty);
    return;
  }

  items.forEach((recording) => {
    recordingsContainer.appendChild(
      createRecordingCard(recording)
    );
  });
}

function searchableText(recording) {
  const song = songsById.get(recording.song_id);
  const participants = getParticipants(recording);

  return [
    song?.title,
    song?.language,
    song?.description,
    song?.original_title?.script,
    song?.original_title?.transliteration,
    recording.description,
    recording.comments,
    recording.reel?.id,
    recording.reel?.size,
    ...participants.map((person) => person.name),
    ...participants.map((person) => person.display_name)
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function search(query) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    renderRecordings(recordings);
    return;
  }

  const results = recordings.filter((recording) =>
    searchableText(recording).includes(normalizedQuery)
  );

  renderRecordings(results);
}

searchInput.addEventListener("input", (event) => {
  search(event.target.value);
});

loadArchive().catch((error) => {
  console.error(error);

  recordingsContainer.innerHTML = `
    <p class="error">
      Unable to load the archive. Check the browser console for details.
    </p>
  `;
});
