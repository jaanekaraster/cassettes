const searchInput = document.querySelector("#search");
const languageFilter = document.querySelector("#language-filter");
const personFilter = document.querySelector("#person-filter");
const reelFilter = document.querySelector("#reel-filter");
const shuffleButton = document.querySelector("#shuffle-button");
const clearFiltersButton = document.querySelector("#clear-filters");

const recordingsContainer = document.querySelector("#recordings");
const resultCount = document.querySelector("#result-count");
const playerContainer = document.querySelector("#player");

let people = [];
let songs = [];
let recordings = [];
let mediaBaseUrl = "";

const peopleById = new Map();
const songsById = new Map();

let filteredRecordings = [];
let activeRecordingId = null;

let currentAudio = null;
let currentReel = null;


/*
 * ------------------------------------------------------------
 * Data loading
 * ------------------------------------------------------------
 */

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

  peopleById.clear();
  songsById.clear();

  people.forEach((person) => {
    peopleById.set(person.id, person);
  });

  songs.forEach((song) => {
    songsById.set(song.id, song);
  });

  populateFilters();

  filteredRecordings = [...recordings];

  renderRecordingList(filteredRecordings);

  if (recordings.length > 0) {
    selectRecording(recordings[0].id);
  }
}


/*
 * ------------------------------------------------------------
 * Relationships
 * ------------------------------------------------------------
 */

function getParticipants(recording) {
  if (!Array.isArray(recording.participants)) {
    return [];
  }

  return recording.participants
    .map((participant) =>
      peopleById.get(participant.person_id)
    )
    .filter(Boolean);
}


function getSongs(recording) {
  if (!Array.isArray(recording.songs)) {
    return [];
  }

  return recording.songs
    .map((entry) => songsById.get(entry.song_id))
    .filter(Boolean);
}


function getPrimarySong(recording) {
  return getSongs(recording)[0] || null;
}


/*
 * ------------------------------------------------------------
 * Filters
 * ------------------------------------------------------------
 */

function populateFilters() {
  populateLanguageFilter();
  populatePersonFilter();
  populateReelFilter();
}


function populateLanguageFilter() {
  const languages = new Set();

  songs.forEach((song) => {
    if (song.language) {
      languages.add(song.language);
    }
  });

  recordings.forEach((recording) => {
    getSongs(recording).forEach((song) => {
      if (song.language) {
        languages.add(song.language);
      }
    });
  });

  const values = [...languages].sort((a, b) =>
    a.localeCompare(b)
  );

  languageFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All languages";
  languageFilter.appendChild(allOption);

  values.forEach((language) => {
    const option = document.createElement("option");
    option.value = language;
    option.textContent = language;
    languageFilter.appendChild(option);
  });
}


function populatePersonFilter() {
  const participantIds = new Set();

  recordings.forEach((recording) => {
    if (!Array.isArray(recording.participants)) {
      return;
    }

    recording.participants.forEach((participant) => {
      if (participant.person_id) {
        participantIds.add(participant.person_id);
      }
    });
  });

  const participants = [...participantIds]
    .map((id) => peopleById.get(id))
    .filter(Boolean)
    .sort((a, b) => {
      const nameA = a.display_name || a.name || "";
      const nameB = b.display_name || b.name || "";

      return nameA.localeCompare(nameB);
    });

  personFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All people";
  personFilter.appendChild(allOption);

  participants.forEach((person) => {
    const option = document.createElement("option");

    option.value = person.id;
    option.textContent =
      person.display_name || person.name;

    personFilter.appendChild(option);
  });
}


function populateReelFilter() {
  const reels = new Set();

  recordings.forEach((recording) => {
    if (recording.reel?.id) {
      reels.add(recording.reel.id);
    }
  });

  const values = [...reels].sort((a, b) =>
    a.localeCompare(b, undefined, {
      numeric: true,
      sensitivity: "base"
    })
  );

  reelFilter.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "";
  allOption.textContent = "All reels";
  reelFilter.appendChild(allOption);

  values.forEach((reelId) => {
    const option = document.createElement("option");

    option.value = reelId;
    option.textContent = reelId;

    reelFilter.appendChild(option);
  });
}


/*
 * ------------------------------------------------------------
 * Searching
 * ------------------------------------------------------------
 */

function searchableText(recording) {
  const recordingSongs = getSongs(recording);
  const participants = getParticipants(recording);

  return [
    recording.id,
    recording.title,
    recording.description,
    recording.comments,
    recording.reel?.id,
    recording.reel?.size,

    ...recordingSongs.flatMap((song) => [
      song.title,
      song.description,
      song.language,
      song.reference,
      song.original_title?.script,
      song.original_title?.transliteration
    ]),

    ...participants.flatMap((person) => [
      person.id,
      person.name,
      person.display_name,
      person.description
    ])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}


function recordingMatches(recording) {
  const query = searchInput.value
    .trim()
    .toLowerCase();

  const selectedLanguage = languageFilter.value;
  const selectedPerson = personFilter.value;
  const selectedReel = reelFilter.value;

  /*
   * Search
   */

  if (
    query &&
    !searchableText(recording).includes(query)
  ) {
    return false;
  }

  /*
   * Language
   */

  if (selectedLanguage) {
    const matchesLanguage = getSongs(recording).some(
      (song) => song.language === selectedLanguage
    );

    if (!matchesLanguage) {
      return false;
    }
  }

  /*
   * Person
   */

  if (selectedPerson) {
    const matchesPerson = getParticipants(recording).some(
      (person) => person.id === selectedPerson
    );

    if (!matchesPerson) {
      return false;
    }
  }

  /*
   * Reel
   */

  if (
    selectedReel &&
    recording.reel?.id !== selectedReel
  ) {
    return false;
  }

  return true;
}


function applyFilters() {
  filteredRecordings = recordings.filter(
    recordingMatches
  );

  renderRecordingList(filteredRecordings);

  /*
   * If the current recording is no longer visible,
   * select the first visible recording.
   */

  if (
    filteredRecordings.length > 0 &&
    !filteredRecordings.some(
      (recording) =>
        recording.id === activeRecordingId
    )
  ) {
    selectRecording(filteredRecordings[0].id);
  }

  if (filteredRecordings.length === 0) {
    activeRecordingId = null;
    renderEmptyPlayer("No recordings match these filters.");
  }
}


/*
 * ------------------------------------------------------------
 * Recording list
 * ------------------------------------------------------------
 */

function renderRecordingList(items) {
  recordingsContainer.replaceChildren();

  resultCount.textContent =
    `${items.length} ${
      items.length === 1
        ? "recording"
        : "recordings"
    }`;

  if (items.length === 0) {
    const empty = document.createElement("p");

    empty.className = "recording-list-empty";
    empty.textContent = "No recordings found.";

    recordingsContainer.appendChild(empty);

    return;
  }

  items.forEach((recording) => {
    recordingsContainer.appendChild(
      createRecordingListItem(recording)
    );
  });
}


function createRecordingListItem(recording) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "recording-list-item";

  if (recording.id === activeRecordingId) {
    button.classList.add("is-active");
  }

  button.setAttribute(
    "aria-label",
    `Select recording ${recording.title || recording.id}`
  );

  const songsForRecording = getSongs(recording);
  const participants = getParticipants(recording);

  const title = document.createElement("strong");

  title.className = "recording-list-title";

  title.textContent =
    recording.title ||
    songsForRecording
      .map((song) => song.title)
      .filter(Boolean)
      .join(", ") ||
    "Untitled recording";

  button.appendChild(title);

  /*
   * Song names
   */

  if (songsForRecording.length > 0) {
    const songsElement = document.createElement("span");

    songsElement.className = "recording-list-songs";

    songsElement.textContent = songsForRecording
      .map((song) => song.title)
      .filter(Boolean)
      .join(" · ");

    button.appendChild(songsElement);
  }

  /*
   * People
   */

  if (participants.length > 0) {
    const peopleElement = document.createElement("span");

    peopleElement.className = "recording-list-people";

    peopleElement.textContent = participants
      .map(
        (person) =>
          person.display_name || person.name
      )
      .join(", ");

    button.appendChild(peopleElement);
  }

  /*
   * Reel / language
   */

  const metadata = document.createElement("span");

  metadata.className = "recording-list-meta";

  const metadataParts = [];

  if (recording.reel?.id) {
    metadataParts.push(
      `Reel ${recording.reel.id}`
    );
  }

  const languages = [
    ...new Set(
      songsForRecording
        .map((song) => song.language)
        .filter(Boolean)
    )
  ];

  if (languages.length > 0) {
    metadataParts.push(languages.join(", "));
  }

  metadata.textContent = metadataParts.join(" · ");

  if (metadata.textContent) {
    button.appendChild(metadata);
  }

  button.addEventListener("click", () => {
    selectRecording(recording.id);
  });

  return button;
}


/*
 * ------------------------------------------------------------
 * Active recording
 * ------------------------------------------------------------
 */

function selectRecording(recordingId) {
  const recording = recordings.find(
    (item) => item.id === recordingId
  );

  if (!recording) {
    return;
  }

  activeRecordingId = recording.id;

  renderRecordingList(filteredRecordings);
  renderPlayer(recording);
}


function renderPlayer(recording) {
  stopCurrentAudio();

  playerContainer.replaceChildren();

  const songsForRecording = getSongs(recording);
  const participants = getParticipants(recording);

  /*
   * Header
   */

  const header = document.createElement("header");
  header.className = "player-header";

  const eyebrow = document.createElement("div");
  eyebrow.className = "player-eyebrow";
  eyebrow.textContent = "Family Archive";

  header.appendChild(eyebrow);

  const title = document.createElement("h2");

  title.className = "player-title";

  title.textContent =
    recording.title ||
    songsForRecording
      .map((song) => song.title)
      .filter(Boolean)
      .join(" · ") ||
    "Untitled recording";

  header.appendChild(title);

  /*
   * Song titles
   */

  if (songsForRecording.length > 0) {
    const songsElement = document.createElement("div");

    songsElement.className = "player-songs";

    songsForRecording.forEach((song, index) => {
      const songElement = document.createElement("span");

      songElement.className = "player-song";

      songElement.textContent = song.title;

      if (index < songsForRecording.length - 1) {
        const separator =
          document.createElement("span");

        separator.className =
          "player-song-separator";

        separator.textContent = " · ";

        songsElement.appendChild(songElement);
        songsElement.appendChild(separator);
      } else {
        songsElement.appendChild(songElement);
      }
    });

    header.appendChild(songsElement);
  }

  playerContainer.appendChild(header);

  /*
   * Reel stage
   */

  const stage = document.createElement("div");

  stage.className = "reel-stage";

  const reel = createReel(recording);

  stage.appendChild(reel);

  playerContainer.appendChild(stage);

  currentReel = reel;

  /*
   * Main controls
   */

  const controls = document.createElement("div");

  controls.className = "player-controls";

  const playButton = document.createElement("button");

  playButton.type = "button";
  playButton.className = "play-button";
  playButton.textContent = "Play";

  const progress = document.createElement("div");

  progress.className = "player-progress";

  const progressBar = document.createElement("div");

  progressBar.className = "player-progress-bar";

  progress.appendChild(progressBar);

  const time = document.createElement("span");

  time.className = "player-time";
  time.textContent = "0:00";

  controls.appendChild(playButton);
  controls.appendChild(progress);
  controls.appendChild(time);

  playerContainer.appendChild(controls);

  /*
   * Metadata
   */

  const metadata = createPlayerMetadata(
    recording,
    songsForRecording,
    participants
  );

  if (metadata) {
    playerContainer.appendChild(metadata);
  }

  /*
   * Audio element
   */

  const audio = document.createElement("audio");

  audio.preload = "metadata";
  audio.src = getAudioUrl(recording);

  currentAudio = audio;

  /*
   * The browser reads the actual MP3 duration here.
   *
   * We deliberately do not depend on duration_seconds
   * in the recording JSON.
   */

  audio.addEventListener("loadedmetadata", () => {
    updateReelFromDuration(
      recording,
      audio.duration
    );
  });

  audio.addEventListener("timeupdate", () => {
    if (
      !Number.isFinite(audio.duration) ||
      audio.duration <= 0
    ) {
      return;
    }

    const percentage =
      (audio.currentTime / audio.duration) * 100;

    progressBar.style.width =
      `${Math.min(100, percentage)}%`;

    time.textContent =
      `${formatDuration(audio.currentTime)} / ` +
      `${formatDuration(audio.duration)}`;
  });

  audio.addEventListener("play", () => {
    reel.classList.add("is-playing");

    playButton.textContent = "Pause";
    playButton.setAttribute(
      "aria-label",
      "Pause recording"
    );
  });

  audio.addEventListener("pause", () => {
    reel.classList.remove("is-playing");

    playButton.textContent = "Play";
    playButton.setAttribute(
      "aria-label",
      "Play recording"
    );
  });

  audio.addEventListener("ended", () => {
    reel.classList.remove("is-playing");

    playButton.textContent = "Play";
    playButton.setAttribute(
      "aria-label",
      "Play recording"
    );

    progressBar.style.width = "0%";
  });

  audio.addEventListener("error", () => {
    time.textContent = "Audio unavailable";
  });

  playButton.addEventListener("click", () => {
    togglePlayback(audio);
  });

  progress.addEventListener("click", (event) => {
    if (
      !Number.isFinite(audio.duration) ||
      audio.duration <= 0
    ) {
      return;
    }

    const rect =
      progress.getBoundingClientRect();

    const position =
      (event.clientX - rect.left) / rect.width;

    audio.currentTime =
      Math.max(
        0,
        Math.min(1, position)
      ) * audio.duration;
  });
}


/*
 * ------------------------------------------------------------
 * CSS reel
 * ------------------------------------------------------------
 */

function createReel(recording) {
  const reel = document.createElement("div");

  reel.className = "reel";

  reel.dataset.recordingId = recording.id;

  /*
   * Two reels.
   */

  const reelLeft =
    document.createElement("div");

  reelLeft.className =
    "reel-wheel reel-wheel-left";

  const reelRight =
    document.createElement("div");

  reelRight.className =
    "reel-wheel reel-wheel-right";

  /*
   * Tape path.
   *
   * The tape intentionally exits from the lower
   * portion of the first reel and enters the lower
   * portion of the second reel rather than connecting
   * through their centers.
   */

  const tape =
    document.createElement("div");

  tape.className = "reel-tape";

  /*
   * Tape endpoints.
   */

  const tapeStart =
    document.createElement("span");

  tapeStart.className =
    "reel-tape-start";

  const tapeEnd =
    document.createElement("span");

  tapeEnd.className =
    "reel-tape-end";

  tape.appendChild(tapeStart);
  tape.appendChild(tapeEnd);

  /*
   * Center hubs.
   */

  const leftHub =
    createReelHub();

  const rightHub =
    createReelHub();

  reelLeft.appendChild(leftHub);
  reelRight.appendChild(rightHub);

  reel.appendChild(reelLeft);
  reel.appendChild(reelRight);
  reel.appendChild(tape);

  /*
   * Initial visual reel size.
   *
   * This will be replaced once the browser knows
   * the actual audio duration.
   */

  setReelSize(reel, null);

  return reel;
}


function createReelHub() {
  const hub =
    document.createElement("div");

  hub.className = "reel-hub";

  const hubCenter =
    document.createElement("div");

  hubCenter.className =
    "reel-hub-center";

  const holes =
    document.createElement("div");

  holes.className = "reel-holes";

  for (let i = 0; i < 5; i++) {
    const hole =
      document.createElement("span");

    hole.style.setProperty(
      "--hole-index",
      i
    );

    holes.appendChild(hole);
  }

  hub.appendChild(holes);
  hub.appendChild(hubCenter);

  return hub;
}


/*
 * Reel diameter is based on audio duration.
 *
 * The CSS variable --reel-size controls the
 * physical diameter of both reel wheels.
 *
 * The mapping is intentionally logarithmic-ish:
 * short recordings get a visibly smaller reel,
 * while long recordings approach the maximum size.
 */

function setReelSize(reel, duration) {
  let size;

  if (
    !Number.isFinite(duration) ||
    duration <= 0
  ) {
    size = 210;
  } else {
    const minimumDuration = 30;
    const maximumDuration = 60 * 60;

    const normalized =
      Math.max(
        0,
        Math.min(
          1,
          (Math.log(duration) -
            Math.log(minimumDuration)) /
            (
              Math.log(maximumDuration) -
              Math.log(minimumDuration)
            )
        )
      );

    const minimumSize = 170;
    const maximumSize = 310;

    size =
      minimumSize +
      normalized *
        (maximumSize - minimumSize);
  }

  reel.style.setProperty(
    "--reel-size",
    `${Math.round(size)}px`
  );
}


function updateReelFromDuration(
  recording,
  duration
) {
  if (!currentReel) {
    return;
  }

  if (
    currentReel.dataset.recordingId !==
    recording.id
  ) {
    return;
  }

  setReelSize(
    currentReel,
    duration
  );
}


/*
 * ------------------------------------------------------------
 * Player metadata
 * ------------------------------------------------------------
 */

function createPlayerMetadata(
  recording,
  songsForRecording,
  participants
) {
  const section =
    document.createElement("section");

  section.className =
    "player-metadata";

  let hasContent = false;

  /*
   * People
   */

  if (participants.length > 0) {
    const item =
      createMetadataItem(
        "Participants",
        participants
          .map(
            (person) =>
              person.display_name ||
              person.name
          )
          .join(", ")
      );

    section.appendChild(item);

    hasContent = true;
  }

  /*
   * Language
   */

  const languages = [
    ...new Set(
      songsForRecording
        .map((song) => song.language)
        .filter(Boolean)
    )
  ];

  if (languages.length > 0) {
    section.appendChild(
      createMetadataItem(
        "Language",
        languages.join(", ")
      )
    );

    hasContent = true;
  }

  /*
   * Reel
   */

  if (recording.reel?.id) {
    section.appendChild(
      createMetadataItem(
        "Reel",
        recording.reel.id
      )
    );

    hasContent = true;
  }

  /*
   * Reel size
   */

  if (recording.reel?.size) {
    section.appendChild(
      createMetadataItem(
        "Reel size",
        recording.reel.size
      )
    );

    hasContent = true;
  }

  /*
   * Date
   */

  if (recording.date?.value) {
    section.appendChild(
      createMetadataItem(
        "Date",
        recording.date.value
      )
    );

    hasContent = true;
  }

  /*
   * Description
   */

  if (recording.description) {
    const description =
      document.createElement("p");

    description.className =
      "player-description";

    description.textContent =
      recording.description;

    section.appendChild(description);

    hasContent = true;
  }

  /*
   * Comments
   */

  if (recording.comments) {
    const comments =
      document.createElement("p");

    comments.className =
      "player-comments";

    comments.textContent =
      recording.comments;

    section.appendChild(comments);

    hasContent = true;
  }

  /*
   * Original song references.
   */

  const references = songsForRecording
    .filter((song) => song.reference);

  if (references.length > 0) {
    const referencesSection =
      document.createElement("div");

    referencesSection.className =
      "player-references";

    const heading =
      document.createElement("h3");

    heading.textContent =
      "Original song";

    referencesSection.appendChild(heading);

    references.forEach((song) => {
      const link =
        document.createElement("a");

      link.href = song.reference;
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      link.textContent =
        `${song.title} ↗`;

      referencesSection.appendChild(link);
    });

    section.appendChild(
      referencesSection
    );

    hasContent = true;
  }

  /*
   * Documents.
   */

  const documents =
    createDocumentLinks(recording);

  if (documents) {
    section.appendChild(documents);
    hasContent = true;
  }

  return hasContent ? section : null;
}


function createMetadataItem(label, value) {
  const item =
    document.createElement("div");

  item.className =
    "player-metadata-item";

  const labelElement =
    document.createElement("span");

  labelElement.className =
    "player-metadata-label";

  labelElement.textContent =
    label;

  const valueElement =
    document.createElement("span");

  valueElement.className =
    "player-metadata-value";

  valueElement.textContent =
    value;

  item.appendChild(labelElement);
  item.appendChild(valueElement);

  return item;
}


/*
 * ------------------------------------------------------------
 * Audio
 * ------------------------------------------------------------
 */

function getAudioUrl(recording) {
  if (
    !recording.audio ||
    typeof recording.audio.path !== "string"
  ) {
    return "";
  }

  return (
    `${mediaBaseUrl}/` +
    recording.audio.path.replace(/^\/+/, "")
  );
}


function stopCurrentAudio() {
  if (!currentAudio) {
    return;
  }

  currentAudio.pause();
  currentAudio.currentTime = 0;
  currentAudio = null;
  currentReel = null;
}


function togglePlayback(audio) {
  if (!audio.src) {
    return;
  }

  if (audio.paused) {
    /*
     * Pause any other audio that might exist.
     */

    document
      .querySelectorAll("audio")
      .forEach((element) => {
        if (element !== audio) {
          element.pause();
        }
      });

    audio.play().catch((error) => {
      console.error(
        "Unable to play audio:",
        error
      );
    });
  } else {
    audio.pause();
  }
}


/*
 * ------------------------------------------------------------
 * Duration formatting
 * ------------------------------------------------------------
 */

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const totalSeconds =
    Math.max(0, Math.floor(seconds));

  const hours =
    Math.floor(totalSeconds / 3600);

  const minutes =
    Math.floor(
      (totalSeconds % 3600) / 60
    );

  const remainingSeconds =
    totalSeconds % 60;

  if (hours > 0) {
    return (
      `${hours}:` +
      `${String(minutes).padStart(2, "0")}:` +
      `${String(remainingSeconds).padStart(2, "0")}`
    );
  }

  return (
    `${minutes}:` +
    `${String(remainingSeconds).padStart(2, "0")}`
  );
}


/*
 * ------------------------------------------------------------
 * Empty player
 * ------------------------------------------------------------
 */

function renderEmptyPlayer(message) {
  stopCurrentAudio();

  playerContainer.replaceChildren();

  const empty =
    document.createElement("div");

  empty.className =
    "player-empty";

  const mark =
    document.createElement("div");

  mark.className =
    "player-empty-mark";

  mark.setAttribute(
    "aria-hidden",
    "true"
  );

  mark.textContent = "◉";

  const heading =
    document.createElement("h2");

  heading.textContent =
    "No recording selected";

  const paragraph =
    document.createElement("p");

  paragraph.textContent =
    message ||
    "Choose a recording from the archive.";

  empty.appendChild(mark);
  empty.appendChild(heading);
  empty.appendChild(paragraph);

  playerContainer.appendChild(empty);
}


/*
 * ------------------------------------------------------------
 * Documents
 * ------------------------------------------------------------
 */

function createDocumentLinks(recording) {
  if (
    !Array.isArray(recording.documents) ||
    recording.documents.length === 0
  ) {
    return null;
  }

  const section =
    document.createElement("div");

  section.className =
    "player-documents";

  const heading =
    document.createElement("h3");

  heading.textContent =
    "Documents";

  section.appendChild(heading);

  recording.documents.forEach(
    (archiveDocument) => {
      if (!archiveDocument.path) {
        return;
      }

      const button =
        document.createElement("button");

      button.type = "button";
      button.className =
        "document-button";

      button.textContent =
        archiveDocument.type ===
        "reel_information"
          ? "View reel information"
          : "View document";

      button.addEventListener(
        "click",
        () => {
          openDocumentModal(
            archiveDocument.path
          );
        }
      );

      section.appendChild(button);
    }
  );

  return section;
}


function openDocumentModal(documentPath) {
  const url =
    `${mediaBaseUrl}/` +
    documentPath.replace(/^\/+/, "");

  const overlay =
    document.createElement("div");

  overlay.className =
    "document-modal";

  overlay.setAttribute(
    "role",
    "dialog"
  );

  overlay.setAttribute(
    "aria-modal",
    "true"
  );

  overlay.setAttribute(
    "aria-label",
    "Document viewer"
  );

  const modal =
    document.createElement("div");

  modal.className =
    "document-modal-content";

  const toolbar =
    document.createElement("div");

  toolbar.className =
    "document-modal-toolbar";

  const closeButton =
    document.createElement("button");

  closeButton.type = "button";
  closeButton.className =
    "document-modal-close";

  closeButton.textContent =
    "Close";

  closeButton.setAttribute(
    "aria-label",
    "Close document"
  );

  const openButton =
    document.createElement("a");

  openButton.href = url;
  openButton.target = "_blank";
  openButton.rel =
    "noopener noreferrer";

  openButton.textContent =
    "Open PDF ↗";

  openButton.className =
    "document-modal-open";

  toolbar.appendChild(openButton);
  toolbar.appendChild(closeButton);

  const frame =
    document.createElement("iframe");

  frame.src = url;
  frame.title =
    "Archive document";

  frame.className =
    "document-frame";

  modal.appendChild(toolbar);
  modal.appendChild(frame);

  overlay.appendChild(modal);

  document.body.appendChild(overlay);

  function closeModal() {
    overlay.remove();

    document.body.style.overflow = "";

    document.removeEventListener(
      "keydown",
      handleKeydown
    );
  }

  function handleKeydown(event) {
    if (event.key === "Escape") {
      closeModal();
    }
  }

  closeButton.addEventListener(
    "click",
    closeModal
  );

  overlay.addEventListener(
    "click",
    (event) => {
      if (event.target === overlay) {
        closeModal();
      }
    }
  );

  document.addEventListener(
    "keydown",
    handleKeydown
  );

  document.body.style.overflow =
    "hidden";

  closeButton.focus();
}


/*
 * ------------------------------------------------------------
 * Shuffle
 * ------------------------------------------------------------
 */

function shuffleRecording() {
  if (filteredRecordings.length === 0) {
    return;
  }

  /*
   * Prefer a different recording when possible.
   */

  const choices =
    filteredRecordings.length > 1
      ? filteredRecordings.filter(
          (recording) =>
            recording.id !== activeRecordingId
        )
      : filteredRecordings;

  const randomIndex =
    Math.floor(
      Math.random() * choices.length
    );

  const recording =
    choices[randomIndex];

  selectRecording(recording.id);
}


/*
 * ------------------------------------------------------------
 * Clear filters
 * ------------------------------------------------------------
 */

function clearFilters() {
  searchInput.value = "";
  languageFilter.value = "";
  personFilter.value = "";
  reelFilter.value = "";

  applyFilters();
}


/*
 * ------------------------------------------------------------
 * Event listeners
 * ------------------------------------------------------------
 */

searchInput.addEventListener(
  "input",
  applyFilters
);

languageFilter.addEventListener(
  "change",
  applyFilters
);

personFilter.addEventListener(
  "change",
  applyFilters
);

reelFilter.addEventListener(
  "change",
  applyFilters
);

shuffleButton.addEventListener(
  "click",
  shuffleRecording
);

clearFiltersButton.addEventListener(
  "click",
  clearFilters
);


/*
 * ------------------------------------------------------------
 * Initial load
 * ------------------------------------------------------------
 */

loadArchive().catch((error) => {
  console.error(error);

  recordingsContainer.replaceChildren();

  const message =
    document.createElement("p");

  message.className = "error";

  message.textContent =
    "Unable to load the archive. " +
    "Check the browser console for details.";

  recordingsContainer.appendChild(message);

  renderEmptyPlayer(
    "The archive could not be loaded."
  );
});
