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

  const metadata = document.createElement("div");
  metadata.className = "metadata";

  const metadataParts = [];

  if (participants.length > 0) {
    metadataParts.push(
      participants.map((person) => person.display_name || person.name).join(", ")
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
