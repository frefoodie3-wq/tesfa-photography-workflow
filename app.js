let photos = [];

const selected = new Set();
const uploadedUrls = [];
let currentFilter = "all";

const grid = document.querySelector("#photoGrid");
const selectedCount = document.querySelector("#selectedCount");
const selectedList = document.querySelector("#selectedList");
const selectedTitle = document.querySelector("#selectedTitle");
const galleryName = document.querySelector("#galleryName");
const clientLink = document.querySelector("#clientLink");
const proofFiles = document.querySelector("#proofFiles");
const proofCount = document.querySelector("#proofCount");
const uploadStatus = document.querySelector("#uploadStatus");
const clearGallery = document.querySelector("#clearGallery");
const toast = document.querySelector("#toast");

function getFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function renderPhotos() {
  grid.innerHTML = "";

  if (!photos.length) {
    grid.innerHTML = `
      <div class="empty-gallery">
        <strong>No previews uploaded yet</strong>
        <p>Upload your client proof images above and they will appear here for selection.</p>
      </div>
    `;
    return;
  }

  const visiblePhotos = photos.filter((photo) => {
    if (currentFilter === "selected") return selected.has(photo.id);
    if (currentFilter === "unselected") return !selected.has(photo.id);
    return true;
  });

  if (!visiblePhotos.length) {
    grid.innerHTML = `
      <div class="empty-gallery">
        <strong>No photos in this view</strong>
        <p>Switch filters or select photos from the full gallery.</p>
      </div>
    `;
    return;
  }

  visiblePhotos.forEach((photo) => {
    const card = document.createElement("article");
    card.className = `photo-card${selected.has(photo.id) ? " is-selected" : ""}`;
    card.style.setProperty("--thumb", photo.tone);
    card.style.setProperty("--position", photo.pos);
    card.style.setProperty("--image", `url("${photo.url}")`);

    card.innerHTML = `
      <button class="favorite-button" type="button" aria-label="Select ${photo.id}" aria-pressed="${selected.has(photo.id)}">
        ${selected.has(photo.id) ? "♥" : "♡"}
      </button>
      <div class="photo-thumb" role="img" aria-label="Preview image ${photo.id}"></div>
      <div class="photo-meta">
        <strong>${photo.id}</strong>
        <span>${photo.fileName}</span>
      </div>
    `;

    card.querySelector("button").addEventListener("click", () => togglePhoto(photo.id));
    grid.appendChild(card);
  });
}

function renderSelectedList() {
  const ids = Array.from(selected).sort();
  const selectedPhotos = ids.map((id) => photos.find((photo) => photo.id === id)).filter(Boolean);
  selectedCount.textContent = ids.length;
  selectedTitle.textContent = ids.length
    ? `${ids.length} file${ids.length === 1 ? "" : "s"} ready for editing`
    : "Waiting for client picks";
  selectedList.innerHTML = "";

  if (!ids.length) {
    const empty = document.createElement("li");
    empty.textContent = "No selections yet";
    selectedList.appendChild(empty);
    return;
  }

  selectedPhotos.forEach((photo, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${photo.fileName}</strong><span>#${String(index + 1).padStart(2, "0")}</span>`;
    selectedList.appendChild(item);
  });
}

function updateGalleryMeta() {
  const slug = galleryName.value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "client-gallery";

  clientLink.textContent = `${window.location.origin}/?gallery=${slug}#client-view`;
  proofCount.textContent = photos.length;
  clearGallery.disabled = photos.length === 0;
}

function togglePhoto(id) {
  if (selected.has(id)) {
    selected.delete(id);
  } else {
    selected.add(id);
  }

  renderPhotos();
  renderSelectedList();
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-selected"));
    button.classList.add("is-selected");
    renderPhotos();
  });
});

document.querySelectorAll("[data-copy-link]").forEach((button) => {
  button.addEventListener("click", async () => {
    const link = clientLink.textContent;
    try {
      await navigator.clipboard.writeText(link);
      showToast("Client link copied.");
    } catch {
      showToast(`Client link: ${link}`);
    }
  });
});

document.querySelector("#uploadButton").addEventListener("click", () => {
  proofFiles.click();
});

proofFiles.addEventListener("change", () => {
  const files = Array.from(proofFiles.files || []).filter((file) => file.type.startsWith("image/"));

  if (!files.length) {
    showToast("Choose image files for the gallery.");
    return;
  }

  const existingKeys = new Set(photos.map((photo) => photo.fileKey));
  const uniqueFiles = [];
  let skippedCount = 0;

  files.forEach((file) => {
    const fileKey = getFileKey(file);
    if (existingKeys.has(fileKey)) {
      skippedCount += 1;
      return;
    }

    existingKeys.add(fileKey);
    uniqueFiles.push({ file, fileKey });
  });

  if (!uniqueFiles.length) {
    proofFiles.value = "";
    showToast(`${skippedCount} duplicate preview${skippedCount === 1 ? "" : "s"} skipped.`);
    return;
  }

  const startIndex = photos.length;
  const newPhotos = uniqueFiles.map(({ file, fileKey }, index) => {
    const url = URL.createObjectURL(file);
    uploadedUrls.push(url);
    return {
      id: `TP-${String(startIndex + index + 1).padStart(3, "0")}`,
      fileName: file.name,
      fileKey,
      tone: ["#c49975", "#dcb584", "#6f876f", "#c97155", "#9fb2b8", "#aa905e"][(startIndex + index) % 6],
      pos: "center",
      url
    };
  });

  photos = [...photos, ...newPhotos];
  currentFilter = "all";
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-selected"));
  document.querySelector('[data-filter="all"]').classList.add("is-selected");
  uploadStatus.textContent = `${uniqueFiles.length} added. ${photos.length} total preview${photos.length === 1 ? "" : "s"} loaded.`;
  proofFiles.value = "";
  updateGalleryMeta();
  renderPhotos();
  renderSelectedList();
  showToast(
    skippedCount
      ? `${uniqueFiles.length} added, ${skippedCount} duplicate${skippedCount === 1 ? "" : "s"} skipped.`
      : `${uniqueFiles.length} preview${uniqueFiles.length === 1 ? "" : "s"} added.`
  );
});

galleryName.addEventListener("input", updateGalleryMeta);

clearGallery.addEventListener("click", () => {
  if (!photos.length) {
    showToast("There are no previews to clear.");
    return;
  }

  uploadedUrls.forEach((url) => URL.revokeObjectURL(url));
  uploadedUrls.length = 0;
  photos = [];
  selected.clear();
  currentFilter = "all";
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-selected"));
  document.querySelector('[data-filter="all"]').classList.add("is-selected");
  proofFiles.value = "";
  uploadStatus.textContent = "Choose JPG or PNG proof images. You can add more later.";
  updateGalleryMeta();
  renderPhotos();
  renderSelectedList();
  showToast("Uploaded previews cleared.");
});

document.querySelector("#submitSelections").addEventListener("click", () => {
  if (!selected.size) {
    showToast("Select at least one favorite before sending.");
    return;
  }

  showToast("Selected list sent to Tesfa Photography.");
  document.querySelector("#deliver").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelector("#downloadList").addEventListener("click", () => {
  const ids = Array.from(selected).sort();
  const selectedPhotos = ids.map((id) => photos.find((photo) => photo.id === id)).filter(Boolean);
  if (!ids.length) {
    showToast("No selected files to download yet.");
    return;
  }

  const content = [
    `Gallery: ${galleryName.value}`,
    `Submitted: ${new Date().toLocaleDateString()}`,
    "",
    ...selectedPhotos.map((photo) => photo.fileName)
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tesfa-selected-favorites.txt";
  link.click();
  URL.revokeObjectURL(url);
});

updateGalleryMeta();
renderPhotos();
renderSelectedList();
