const recordingsContainer = document.querySelector("#recordings");

async function loadArchive() {
  // Temporary scaffold.
  // The first implementation will load JSON metadata here.
  recordingsContainer.innerHTML = `
    <p>The archive is not populated yet.</p>
  `;
}

loadArchive();
