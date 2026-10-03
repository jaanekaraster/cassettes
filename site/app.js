// app.js

const searchInput = document.querySelector("#search");
const languageFilter = document.querySelector("#language-filter");
const personFilter = document.querySelector("#person-filter");
const reelFilter = document.querySelector("#reel-filter");

const shuffleButton = document.querySelector("#shuffle-button");
const clearFiltersButton = document.querySelector("#clear-filters-button");

const recordingsContainer = document.querySelector("#recordings");
const resultCount = document.querySelector("#result-count");

const emptyState = document.querySelector("#empty-state");
const recordingView = document.querySelector("#recording-view");

const recordingNumber = document.querySelector("#recording-number");
const recordingTitle = document.querySelector("#recording-title");
const recordingSubtitle = document.querySelector("#recording-subtitle");

const detailsButton = document.querySelector("#details-button");
const detailsPanel = document.querySelector("#recording-details");
const detailsOverlay = document.querySelector("#details-overlay");
const detailsControlsDock = document.querySelector("#details-controls-dock");
const transportControls = document.querySelector(".reel-controls");
const playbackStatus = document.querySelector(".playback-status");
const progressContainer = document.querySelector(".progress-container");
const recordingHeader = document.querySelector(".recording-header");

// Reserve the actual title height, including wrapped recording titles.
new ResizeObserver(() => {
  recordingView.style.setProperty("--recording-header-height", `${recordingHeader.getBoundingClientRect().height}px`);
}).observe(recordingHeader);

function setDetailsOpen(open) {
  detailsPanel.hidden = !open;
  detailsOverlay.hidden = !open;
  detailsButton.textContent = open ? "Hide details" : "Details";
  detailsButton.setAttribute("aria-expanded", String(open));
  if (open) {
    detailsControlsDock.appendChild(transportControls);
    detailsControlsDock.appendChild(progressContainer);
    detailsPanel.querySelector(".details-close-button")?.focus();
  } else {
    playbackStatus.parentNode.insertBefore(transportControls, playbackStatus);
    playbackStatus.parentNode.appendChild(progressContainer);
    detailsButton.focus();
  }
}


const reelPlayer = document.querySelector("#reel-player");
const audioPlayer = document.querySelector("#audio-player");

const playButton = document.querySelector("#play-button");
const playIcon = playButton.querySelector(".play-icon");
const playLabel = playButton.querySelector(".play-label");

const stopButton = document.querySelector("#stop-button");

const progress = document.querySelector("#progress");
const playbackTime = document.querySelector("#playback-time");
const playbackDuration = document.querySelector("#playback-duration");

let people = [];
let songs = [];
let recordings = [];

let selectedRecording = null;

const peopleById = new Map();
const songsById = new Map();

let mediaBaseUrl = "";


/* -------------------------------------------------------
   Data loading
------------------------------------------------------- */

async function loadJson(filePath) {
  const response = await fetch(filePath);

  if (!response.ok) {
    throw new Error(
      `Unable to load ${filePath}: ${response.status}`
    );
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

  people = Array.isArray(peopleData) ? peopleData : [];
  songs = Array.isArray(songsData) ? songsData : [];
  recordings = Array.isArray(recordingsData)
    ? recordingsData
    : [];

  mediaBaseUrl = String(
    mediaConfig?.base_url || ""
  ).replace(/\/$/, "");

  peopleById.clear();
  songsById.clear();

  people.forEach((person) => {
    if (person?.id) {
      peopleById.set(person.id, person);
    }
  });

  songs.forEach((song) => {
    if (song?.id) {
      songsById.set(song.id, song);
    }
  });

  populateFilters();

  renderRecordings(recordings);

  if (recordings.length > 0) {
    selectRecording(recordings[0]);
  }
}


/* -------------------------------------------------------
   Relationship helpers
------------------------------------------------------- */

function getRecordingSongs(recording) {
  if (!Array.isArray(recording?.songs)) {
    return [];
  }

  return recording.songs
    .map((entry) => songsById.get(entry?.song_id))
    .filter(Boolean);
}

function getParticipants(recording) {
  if (!Array.isArray(recording?.participants)) {
    return [];
  }

  return recording.participants
    .map((participant) =>
      peopleById.get(participant?.person_id)
    )
    .filter(Boolean);
}


/* -------------------------------------------------------
   Filters
------------------------------------------------------- */

function populateFilters() {
  const languages = new Set();
  const peopleInRecordings = new Set();
  const reels = new Set();

  recordings.forEach((recording) => {
    getRecordingSongs(recording).forEach((song) => {
      if (song.language) {
        languages.add(song.language);
      }
    });

    getParticipants(recording).forEach((person) => {
      peopleInRecordings.add(person.id);
    });

    if (recording.reel?.id) {
      reels.add(recording.reel.id);
    }
  });

  [...languages]
    .sort((a, b) => a.localeCompare(b))
    .forEach((language) => {
      const option = document.createElement("option");
      option.value = language;
      option.textContent = language;
      languageFilter.appendChild(option);
    });

  [...peopleInRecordings]
    .map((id) => peopleById.get(id))
    .filter(Boolean)
    .sort((a, b) =>
      (a.display_name || a.name || "")
        .localeCompare(b.display_name || b.name || "")
    )
    .forEach((person) => {
      const option = document.createElement("option");
      option.value = person.id;
      option.textContent =
        person.display_name || person.name;

      personFilter.appendChild(option);
    });

  [...reels]
    .sort((a, b) => a.localeCompare(b))
    .forEach((reelId) => {
      const option = document.createElement("option");
      option.value = reelId;
      option.textContent = reelId;
      reelFilter.appendChild(option);
    });
}

function recordingMatchesFilters(recording) {
  const query = searchInput.value
    .trim()
    .toLowerCase();

  const selectedLanguage = languageFilter.value;
  const selectedPerson = personFilter.value;
  const selectedReel = reelFilter.value;

  const recordingSongs =
    getRecordingSongs(recording);

  const participants =
    getParticipants(recording);

  if (selectedLanguage) {
    const matchesLanguage = recordingSongs.some(
      (song) =>
        song.language === selectedLanguage
    );

    if (!matchesLanguage) {
      return false;
    }
  }

  if (selectedPerson) {
    const matchesPerson = participants.some(
      (person) =>
        person.id === selectedPerson
    );

    if (!matchesPerson) {
      return false;
    }
  }

  if (selectedReel) {
    if (recording.reel?.id !== selectedReel) {
      return false;
    }
  }

  if (query) {
    const searchable = searchableText(recording);

    if (!searchable.includes(query)) {
      return false;
    }
  }

  return true;
}

function getFilteredRecordings() {
  return recordings.filter(recordingMatchesFilters);
}

function applyFilters() {
  const filtered = getFilteredRecordings();

  renderRecordings(filtered);

  if (
    selectedRecording &&
    !filtered.includes(selectedRecording)
  ) {
    if (filtered.length > 0) {
      selectRecording(filtered[0]);
    } else {
      showEmptySelection();
    }
  }

  if (!selectedRecording && filtered.length > 0) {
    selectRecording(filtered[0]);
  }
}


/* -------------------------------------------------------
   Search
------------------------------------------------------- */

function searchableText(recording) {
  const recordingSongs =
    getRecordingSongs(recording);

  const participants =
    getParticipants(recording);

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
      song.original_title?.script,
      song.original_title?.transliteration,
      song.reference,
      song.lyrics?.original,
      song.lyrics?.transliteration,
      song.lyrics?.english
    ]),

    ...participants.flatMap((person) => [
      person.name,
      person.display_name,
      person.description
    ])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}


/* -------------------------------------------------------
   Recording list
------------------------------------------------------- */

function renderRecordings(items) {
  recordingsContainer.replaceChildren();

  resultCount.textContent =
    `${items.length} recording${items.length === 1 ? "" : "s"}`;

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "sidebar-empty";
    empty.textContent = "No recordings found.";
    recordingsContainer.appendChild(empty);
    return;
  }

  items.forEach((recording, index) => {
    const card = createRecordingListItem(
      recording,
      index
    );

    recordingsContainer.appendChild(card);
  });
}

function createRecordingListItem(recording, index) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = "recording-list-item";

  if (recording === selectedRecording) {
    button.classList.add("is-selected");
  }

  const title = document.createElement("span");
  title.className = "recording-list-title";

  title.textContent =
    recording.title ||
    getRecordingSongs(recording)[0]?.title ||
    "Untitled recording";

  const meta = document.createElement("span");
  meta.className = "recording-list-meta";

  const participants =
    getParticipants(recording);

  const parts = [];

  if (participants.length > 0) {
    parts.push(
      participants
        .map((person) =>
          person.display_name || person.name
        )
        .join(", ")
    );
  }

  if (recording.reel?.id) {
    parts.push(`Reel ${recording.reel.id}`);
  }

  const songsForRecording =
    getRecordingSongs(recording);

  if (songsForRecording.length > 1) {
    parts.push(
      `${songsForRecording.length} songs`
    );
  }

  meta.textContent = parts.join(" · ");

  button.appendChild(title);
  button.appendChild(meta);

  button.addEventListener("click", () => {
    selectRecording(recording);
  });

  return button;
}


/* -------------------------------------------------------
   Selection
------------------------------------------------------- */

function selectRecording(recording) {
  if (!recording) {
    showEmptySelection();
    return;
  }

  selectedRecording = recording;

  emptyState.hidden = true;
  recordingView.hidden = false;

  updateSelectedRecordingHeader(recording);
  updateReel(recording);
  updateDetails(recording);
  updateRecordingListSelection();
  loadAudio(recording);
}

function showEmptySelection() {
  selectedRecording = null;

  stopAudio();

  recordingView.hidden = true;
  emptyState.hidden = false;

  updateRecordingListSelection();
}

function updateRecordingListSelection() {
  const buttons =
    recordingsContainer.querySelectorAll(
      ".recording-list-item"
    );

  buttons.forEach((button) => {
    button.classList.remove("is-selected");
  });

  if (!selectedRecording) {
    return;
  }

  const items =
    getFilteredRecordings();

  items.forEach((recording, index) => {
    if (recording !== selectedRecording) {
      return;
    }

    const button = buttons[index];

    if (button) {
      button.classList.add("is-selected");
    }
  });
}


/* -------------------------------------------------------
   Recording header
------------------------------------------------------- */

function updateSelectedRecordingHeader(recording) {
  const songsForRecording =
    getRecordingSongs(recording);

  const participants =
    getParticipants(recording);

  recordingNumber.textContent =
    recording.id || "";

  recordingTitle.textContent =
    recording.title ||
    songsForRecording[0]?.title ||
    "Untitled recording";

  const subtitleParts = [];

  if (songsForRecording.length > 0) {
    subtitleParts.push(
      songsForRecording
        .map((song) => song.title)
        .join(" · ")
    );
  }

  if (participants.length > 0) {
    subtitleParts.push(
      participants
        .map((person) =>
          person.display_name || person.name
        )
        .join(", ")
    );
  }

  if (recording.reel?.id) {
    subtitleParts.push(
      `Reel ${recording.reel.id}`
    );
  }

  recordingSubtitle.textContent =
    subtitleParts.join(" · ");
}


/* -------------------------------------------------------
   Reel animation
------------------------------------------------------- */

const rewindButton = document.querySelector("#rewind-button");
const forwardButton = document.querySelector("#forward-button");
const reelBodies = reelPlayer.querySelectorAll(".reel-body");
const tapeGradient = document.querySelector("#tape-gradient");
let animationFrame = null;
let previousFrame = null;
let reelAngles = [0, 0];
let tapeOffset = 0;
let windingDirection = 0;
let windingElapsed = 0;
let resumeAfterWinding = false;
const windingStepSeconds = 0.125;


function updateReel() {
  stopReelAnimation();
  reelAngles = [0, 0];
  tapeOffset = 0;
  reelBodies.forEach((body) => body.style.transform = "rotate(0deg)");
  tapeGradient.setAttribute("gradientTransform", "translate(0)");
}

function animateReels(timestamp) {
  if ((!windingDirection && (audioPlayer.paused || audioPlayer.ended)) || document.hidden) {
    stopReelAnimation();
    return;
  }
  const elapsed = previousFrame === null ? 0 : Math.min((timestamp - previousFrame) / 1000, 0.1);
  previousFrame = timestamp;
  if (windingDirection) {
    windingElapsed += elapsed;
    while (windingDirection && windingElapsed >= windingStepSeconds) {
      windingElapsed -= windingStepSeconds;
      skipAudio(windingDirection);
      if (audioPlayer.currentTime <= 0 || audioPlayer.currentTime >= audioPlayer.duration) {
        finishWinding();
        return;
      }
    }
  }
  const duration = audioPlayer.duration;
  const fraction = Number.isFinite(duration) && duration > 0
    ? Math.min(1, Math.max(0, audioPlayer.currentTime / duration)) : 0;
  // Tape pack area transfers between reels; angular speed is inverse to radius.
  const radii = windingDirection ? [1, 0.7]
    : [Math.sqrt(1 - fraction * 0.75), Math.sqrt(0.25 + fraction * 0.75)];
  const speed = windingDirection ? windingDirection * 4 : audioPlayer.playbackRate;
  reelBodies.forEach((body, index) => {
    reelAngles[index] = (reelAngles[index] - elapsed * 90 * speed / radii[index]) % 360;
    body.style.transform = `rotate(${reelAngles[index]}deg)`;
  });
  tapeOffset = (tapeOffset + elapsed * 48 * speed) % 48;
  tapeGradient.setAttribute("gradientTransform", `translate(${tapeOffset})`);
  animationFrame = requestAnimationFrame(animateReels);
}

function startReelAnimation() {
  reelPlayer.classList.add("is-playing");
  // Playback motion is explicitly requested by the Play control.
  if (animationFrame === null && !document.hidden) {
    previousFrame = null;
    animationFrame = requestAnimationFrame(animateReels);
  }
}

function stopReelAnimation() {
  reelPlayer.classList.remove("is-playing");
  cancelAnimationFrame(animationFrame);
  animationFrame = null;
  previousFrame = null;
}

function syncReelAnimation() {
  if (document.hidden) finishWinding(false);
  stopReelAnimation();
  if (!audioPlayer.paused && !audioPlayer.ended) startReelAnimation();
}
document.addEventListener("visibilitychange", syncReelAnimation);

function skipAudio(seconds) {
  if (!Number.isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) return;
  audioPlayer.currentTime = Math.max(0, Math.min(audioPlayer.duration, audioPlayer.currentTime + seconds));
  updatePlaybackDisplay();
}
function beginWinding(direction) {
  if (!Number.isFinite(audioPlayer.duration) || audioPlayer.duration <= 0) return;
  if (windingDirection) finishWinding(false);
  resumeAfterWinding = !audioPlayer.paused;
  windingDirection = direction;
  windingElapsed = 0;
  audioPlayer.pause();
  updatePlayButton(false);
  rewindButton.classList.toggle("is-winding", direction < 0);
  forwardButton.classList.toggle("is-winding", direction > 0);
  skipAudio(direction);
  if (audioPlayer.currentTime <= 0 || audioPlayer.currentTime >= audioPlayer.duration) {
    finishWinding();
    return;
  }
  startReelAnimation();
}

function finishWinding(resume = true) {
  if (!windingDirection) return;
  const shouldResume = resume && resumeAfterWinding && audioPlayer.currentTime < audioPlayer.duration;
  windingDirection = 0;
  resumeAfterWinding = false;
  rewindButton.classList.remove("is-winding");
  forwardButton.classList.remove("is-winding");
  stopReelAnimation();
  if (shouldResume) {
    audioPlayer.play().catch((error) => console.error("Unable to resume recording:", error));
  }
}

function bindWindingButton(button, direction) {
  let suppressClick = false;
  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || button.disabled) return;
    event.preventDefault();
    suppressClick = true;
    button.setPointerCapture(event.pointerId);
    beginWinding(direction);
  });
  for (const eventName of ["pointerup", "pointercancel", "lostpointercapture", "blur"]) {
    button.addEventListener(eventName, () => {
      if (windingDirection === direction) finishWinding();
    });
  }
  button.addEventListener("keydown", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    event.preventDefault();
    event.stopPropagation();
    if (!event.repeat) beginWinding(direction);
  });
  button.addEventListener("keyup", (event) => {
    if (event.code !== "Space" && event.code !== "Enter") return;
    event.preventDefault();
    if (windingDirection === direction) finishWinding();
  });
  // Assistive technology can activate a button without pointer or key events.
  button.addEventListener("click", () => {
    if (suppressClick) { suppressClick = false; return; }
    beginWinding(direction);
    setTimeout(() => { if (windingDirection === direction) finishWinding(); }, 100);
  });
}
bindWindingButton(rewindButton, -1);
bindWindingButton(forwardButton, 1);
window.addEventListener("blur", () => finishWinding(false));

/* -------------------------------------------------------
   Audio
------------------------------------------------------- */

function getAudioUrl(recording) {
  const audioPath =
    recording?.audio?.path;

  if (!audioPath) {
    return "";
  }

  if (!mediaBaseUrl) {
    return audioPath;
  }

  return `${mediaBaseUrl}/${audioPath.replace(
    /^\/+/,
    ""
  )}`;
}

function loadAudio(recording) {
  finishWinding(false);
  stopReelAnimation();

  audioPlayer.pause();

  audioPlayer.currentTime = 0;

  updatePlayButton(false);
  const url = getAudioUrl(recording);
  [playButton, stopButton, rewindButton, forwardButton].forEach((button) => { button.disabled = true; });

  if (!url) {
    audioPlayer.removeAttribute("src");
    audioPlayer.load();

    playbackDuration.textContent = "0:00";
    playbackTime.textContent = "0:00";
    progress.value = 0;

    return;
  }

  audioPlayer.src = url;
  audioPlayer.load();

  playbackDuration.textContent = "0:00";
  playbackTime.textContent = "0:00";
  progress.value = 0;

  playButton.disabled = false;
}

async function playRecording() {
  if (!selectedRecording || !audioPlayer.getAttribute("src") || !audioPlayer.paused || playButton.disabled) {
    return;
  }

  finishWinding(false);
  updatePlayButton(true);
  try {
    await audioPlayer.play();
  } catch (error) {
    updatePlayButton(false);
    console.error("Unable to play recording:", error);
  }
}

function stopAudio() {
  finishWinding(false);
  audioPlayer.pause();
  stopReelAnimation();
  updatePlayButton(false);
  updatePlaybackDisplay();
}

function updatePlayButton(isPlaying) {
  playLabel.textContent = "Play";
  playButton.setAttribute("aria-label", "Play recording");
  playButton.disabled = isPlaying || !audioPlayer.getAttribute("src") || Boolean(audioPlayer.error);
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }

  const minutes =
    Math.floor(seconds / 60);

  const remainingSeconds =
    Math.floor(seconds % 60);

  return `${minutes}:${String(
    remainingSeconds
  ).padStart(2, "0")}`;
}

function updatePlaybackDisplay() {
  const currentTime =
    audioPlayer.currentTime || 0;

  const duration =
    audioPlayer.duration;

  playbackTime.textContent =
    formatTime(currentTime);

  if (Number.isFinite(duration)) {
    playbackDuration.textContent =
      formatTime(duration);

    progress.value =
      duration > 0
        ? (currentTime / duration) * 100
        : 0;
  }
}

function seekAudio() {
  const duration =
    audioPlayer.duration;

  if (!Number.isFinite(duration)) {
    return;
  }

  audioPlayer.currentTime =
    (Number(progress.value) / 100) *
    duration;
  updatePlaybackDisplay();
}


/* -------------------------------------------------------
   Reel sizing based on actual MP3 duration
------------------------------------------------------- */

function updateReelFromDuration() {
  const canSeek = Number.isFinite(audioPlayer.duration) && audioPlayer.duration > 0;
  rewindButton.disabled = !canSeek;
  forwardButton.disabled = !canSeek;
  stopButton.disabled = !audioPlayer.getAttribute("src");
}

/* -------------------------------------------------------
   Details
------------------------------------------------------- */

function updateDetails(recording) {
  detailsPanel.replaceChildren();

  const songsForRecording =
    getRecordingSongs(recording);

  const participants =
    getParticipants(recording);

  const heading =
    document.createElement("h3");

  heading.textContent = "Recording details";

  const toolbar = document.createElement("div");
  toolbar.className = "details-panel-toolbar";
  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.className = "details-close-button";
  closeButton.textContent = "Close";
  closeButton.setAttribute("aria-label", "Close recording details");
  closeButton.addEventListener("click", () => setDetailsOpen(false));
  toolbar.appendChild(heading);
  toolbar.appendChild(closeButton);
  detailsPanel.appendChild(toolbar);

  const metadata =
    document.createElement("dl");

  metadata.className = "details-list";

  addDetailRow(
    metadata,
    "Recording ID",
    recording.id
  );

  addDetailRow(
    metadata,
    "Reel ID",
    recording.reel?.id
  );

  addDetailRow(
    metadata,
    "Reel size",
    recording.reel?.size
  );

  addDetailRow(
    metadata,
    "Type",
    recording.type
  );

  if (recording.date?.value) {
    addDetailRow(
      metadata,
      "Date",
      recording.date.value
    );
  }

  if (recording.duration_seconds) {
    addDetailRow(
      metadata,
      "Duration",
      formatTime(recording.duration_seconds)
    );
  }

  if (participants.length > 0) {
    addDetailRow(
      metadata,
      "Participants",
      participants
        .map((person) =>
          person.display_name || person.name
        )
        .join(", ")
    );
  }

  if (songsForRecording.length > 0) {
    addDetailRow(
      metadata,
      "Songs in this recording",
      songsForRecording
        .map((song) => song.title)
        .join(", ")
    );
  }

  if (recording.description) {
    addDetailRow(
      metadata,
      "Description",
      recording.description
    );
  }

  if (recording.comments) {
    addDetailRow(
      metadata,
      "Comments",
      recording.comments
    );
  }

  detailsPanel.appendChild(metadata);

  if (songsForRecording.length > 0) {
    const songsSection =
      document.createElement("section");

    const songsHeading =
      document.createElement("h4");

    songsHeading.textContent = "Song Information";

    songsSection.appendChild(songsHeading);

    songsForRecording.forEach((song) => {
      const songBlock =
        document.createElement("div");

      songBlock.className = "detail-song";

      const title =
        document.createElement("strong");

      title.textContent = song.title;

      songBlock.appendChild(title);

      if (song.original_title?.script) {
        const original =
          document.createElement("div");

        original.textContent =
          "Original Title: "+song.original_title.script;

        songBlock.appendChild(original);
      }

      if (
        song.original_title?.transliteration
      ) {
        const transliteration =
          document.createElement("div");

        transliteration.className =
          "transliteration";

        transliteration.textContent =
          "Transliteration: "+song.original_title.transliteration;

        songBlock.appendChild(
          transliteration
        );
      }

      if (song.language) {
        const language =
          document.createElement("div");

        language.className =
          "detail-secondary";

        language.textContent =
          "Language: "+song.language;

        songBlock.appendChild(language);
      }

      if (song.reference) {
        const reference =
          document.createElement("a");

        reference.href =
          song.reference;

        reference.target = "_blank";
        reference.rel =
          "noopener noreferrer";

        reference.textContent =
          "Original song ↗";

        songBlock.appendChild(reference);
      }

      songsSection.appendChild(songBlock);
    });

    detailsPanel.appendChild(
      songsSection
    );
  }

  const lyricsSection = createLyricsSection(songsForRecording);
  if (lyricsSection) detailsPanel.appendChild(lyricsSection);

  if (
    Array.isArray(recording.documents) &&
    recording.documents.length > 0
  ) {
    const documentsSection =
      document.createElement("section");

    const heading =
      document.createElement("h4");

    heading.textContent = "Documents";

    documentsSection.appendChild(
      heading
    );

    recording.documents.forEach(
      (archiveDocument) => {
        if (!archiveDocument.path) {
          return;
        }

        const title = archiveDocument.type === "reel_information"
          ? "View reel information" : "View document";
        const documentBlock = document.createElement("div");
        documentBlock.className = "detail-document";
        const button = document.createElement("button");
        button.type = "button";
        button.className = "document-button";
        button.textContent = title;
        button.setAttribute("aria-expanded", "false");

        const viewer = document.createElement("iframe");
        viewer.className = "detail-pdf-viewer";
        viewer.title = archiveDocument.type === "reel_information"
          ? "Reel information PDF" : "Archive document";
        viewer.id = `document-viewer-${recording.id}-${documentsSection.childElementCount}`;
        viewer.hidden = true;
        button.setAttribute("aria-controls", viewer.id);
        const path = archiveDocument.path.replace(/^\/+/, "");
        const url = mediaBaseUrl ? `${mediaBaseUrl}/${path}` : path;
        button.addEventListener("click", () => {
          viewer.hidden = !viewer.hidden;
          if (!viewer.hidden && !viewer.getAttribute("src")) viewer.src = url;
          button.setAttribute("aria-expanded", String(!viewer.hidden));
          button.textContent = viewer.hidden ? title : "Hide document";
        });
        documentBlock.appendChild(button);
        documentBlock.appendChild(viewer);
        documentsSection.appendChild(documentBlock);
      }
    );

    detailsPanel.appendChild(
      documentsSection
    );
  }
}

function createLyricsSection(recordingSongs) {
  const section = document.createElement("section");
  section.className = "lyrics-section";
  const heading = document.createElement("h4");
  heading.textContent = "Lyrics";
  section.appendChild(heading);

  recordingSongs.forEach((song) => {
    const columns = [
      ["original", "Original lyrics"],
      ["transliteration", "Transliterated lyrics"],
      ["english", "English lyrics"]
    ].filter(([key]) => typeof song.lyrics?.[key] === "string" && song.lyrics[key].trim());
    if (!columns.length) return;

    const songSection = document.createElement("section");
    songSection.className = "song-lyrics";
    const title = document.createElement("h5");
    title.textContent = song.title;
    songSection.appendChild(title);
    const grid = document.createElement("div");
    grid.className = "lyrics-columns";
    grid.style.setProperty("--lyrics-columns", columns.length);
    // Compare authored lines and stanza breaks, not browser-generated wrapping.
    const linesByColumn = columns.map(([key]) => song.lyrics[key].replace(/\r\n?/g, "\n").split("\n"));
    const aligned = linesByColumn.every((lines) =>
      lines.length === linesByColumn[0].length &&
      lines.every((line, index) => Boolean(line.trim()) === Boolean(linesByColumn[0][index].trim()))
    );
    if (aligned) grid.classList.add("lyrics-aligned");
    const language = String(song.language || "").trim().toLowerCase();
    const originalRtl = /^(hebrew|yiddish|he|heb|iw|yi|yid)(?:$|[-_])/.test(language);

    columns.forEach(([key, label], columnIndex) => {
      const column = document.createElement("div");
      column.className = "lyrics-column";
      const columnHeading = document.createElement("h6");
      columnHeading.textContent = label;
      column.appendChild(columnHeading);
      if (aligned) {
        columnHeading.style.gridColumn = columnIndex + 1;
        columnHeading.style.gridRow = 1;
      }
      const textLines = aligned ? linesByColumn[columnIndex] : [song.lyrics[key]];
      textLines.forEach((line, lineIndex) => {
        const text = document.createElement("p");
        text.textContent = line;
        text.setAttribute("dir", key === "original" && originalRtl ? "rtl" : "auto");
        if (key === "original" && originalRtl) text.className = "lyrics-original-rtl";
        if (aligned) {
          text.classList.add("lyrics-line");
          text.style.gridColumn = columnIndex + 1;
          text.style.gridRow = lineIndex + 2;
        }
        column.appendChild(text);
      });
      grid.appendChild(column);
    });
    songSection.appendChild(grid);
    section.appendChild(songSection);
  });
  return section.childElementCount > 1 ? section : null;
}

function addDetailRow(
  container,
  label,
  value
) {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return;
  }

  const row =
    document.createElement("div");

  row.className = "detail-row";

  const dt =
    document.createElement("dt");

  dt.textContent = label;

  const dd =
    document.createElement("dd");

  dd.textContent = value;

  row.appendChild(dt);
  row.appendChild(dd);

  container.appendChild(row);
}


/* -------------------------------------------------------
   Shuffle
------------------------------------------------------- */

function shuffleRecording() {
  const filtered =
    getFilteredRecordings();

  if (filtered.length === 0) {
    return;
  }

  if (filtered.length === 1) {
    selectRecording(filtered[0]);
    return;
  }

  const candidates =
    filtered.filter(
      (recording) =>
        recording !== selectedRecording
    );

  const pool =
    candidates.length > 0
      ? candidates
      : filtered;

  const randomIndex =
    Math.floor(
      Math.random() * pool.length
    );

  selectRecording(
    pool[randomIndex]
  );
}


/* -------------------------------------------------------
   Events
------------------------------------------------------- */

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
  () => {
    searchInput.value = "";
    languageFilter.value = "";
    personFilter.value = "";
    reelFilter.value = "";

    applyFilters();
  }
);

playButton.addEventListener(
  "click",
  playRecording
);

stopButton.addEventListener(
  "click",
  stopAudio
);

detailsButton.addEventListener("click", () => setDetailsOpen(detailsPanel.hidden));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !detailsPanel.hidden) {
    event.preventDefault();
    setDetailsOpen(false);
  }
});

progress.addEventListener(
  "input",
  seekAudio
);

audioPlayer.addEventListener(
  "loadedmetadata",
  () => {
    updatePlaybackDisplay();
    updateReelFromDuration();
  }
);

audioPlayer.addEventListener(
  "timeupdate",
  () => {
    updatePlaybackDisplay();
    if (!audioPlayer.paused && !audioPlayer.ended && audioPlayer.readyState >= 3) {
      startReelAnimation();
    }
  }
);

audioPlayer.addEventListener(
  "play",
  () => {
    startReelAnimation();
    updatePlayButton(true);
  }
);

audioPlayer.addEventListener(
  "pause",
  () => {
    if (!windingDirection) stopReelAnimation();
    updatePlayButton(false);
  }
);

audioPlayer.addEventListener(
  "ended",
  () => {
    stopReelAnimation();
    updatePlayButton(false);

    progress.value = 100;
    updatePlaybackDisplay();
  }
);

audioPlayer.addEventListener(
  "error",
  () => {
    finishWinding(false);
    stopReelAnimation();
    updatePlayButton(false);

    console.error(
      "Unable to load audio:",
      audioPlayer.src
    );
  }
);


/* -------------------------------------------------------
   Keyboard controls
------------------------------------------------------- */

document.addEventListener(
  "keydown",
  (event) => {
    const target =
      event.target;

    const isTyping =
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement;

    if (isTyping) {
      return;
    }

    if (
      event.code === "Space" &&
      selectedRecording
    ) {
      event.preventDefault();
      playRecording();
    }
  }
);


/* -------------------------------------------------------
   Start
------------------------------------------------------- */

loadArchive().catch((error) => {
  console.error(error);

  recordingsContainer.innerHTML = "";

  const message =
    document.createElement("p");

  message.className = "error";
  message.textContent =
    "Unable to load the archive. Check the browser console for details.";

  recordingsContainer.appendChild(message);
});

audioPlayer.addEventListener("waiting", () => {
  if (!windingDirection) stopReelAnimation();
});
audioPlayer.addEventListener("playing", startReelAnimation);
audioPlayer.addEventListener("error", () => {
  stopReelAnimation();
  updatePlayButton(false);
  [playButton, stopButton, rewindButton, forwardButton].forEach((button) => { button.disabled = true; });
});
