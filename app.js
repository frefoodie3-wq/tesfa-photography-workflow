let photos = [
  { id: "TP-001", fileName: "TP-001.jpg", tone: "#c49975", pos: "46% 27%", url: "assets/workflow-hero.png" },
  { id: "TP-002", fileName: "TP-002.jpg", tone: "#dcb584", pos: "55% 31%", url: "assets/workflow-hero.png" },
  { id: "TP-003", fileName: "TP-003.jpg", tone: "#6f876f", pos: "62% 29%", url: "assets/workflow-hero.png" },
  { id: "TP-004", fileName: "TP-004.jpg", tone: "#c97155", pos: "70% 31%", url: "assets/workflow-hero.png" },
  { id: "TP-005", fileName: "TP-005.jpg", tone: "#9fb2b8", pos: "76% 30%", url: "assets/workflow-hero.png" },
  { id: "TP-006", fileName: "TP-006.jpg", tone: "#aa905e", pos: "84% 42%", url: "assets/workflow-hero.png" },
  { id: "TP-007", fileName: "TP-007.jpg", tone: "#d7a583", pos: "18% 81%", url: "assets/workflow-hero.png" },
  { id: "TP-008", fileName: "TP-008.jpg", tone: "#61828c", pos: "40% 72%", url: "assets/workflow-hero.png" },
  { id: "TP-009", fileName: "TP-009.jpg", tone: "#9f6a43", pos: "59% 65%", url: "assets/workflow-hero.png" },
  { id: "TP-010", fileName: "TP-010.jpg", tone: "#86a187", pos: "74% 63%", url: "assets/workflow-hero.png" },
  { id: "TP-011", fileName: "TP-011.jpg", tone: "#b07b86", pos: "90% 72%", url: "assets/workflow-hero.png" },
  { id: "TP-012", fileName: "TP-012.jpg", tone: "#776f88", pos: "28% 46%", url: "assets/workflow-hero.png" }
];

const selected = new Set();
const uploadedUrls = [];
let currentFilter = "all";

const grid = document.querySelector("#photoGrid");
const selectedCount = document.querySelector("#selectedCount");
const selectedList = document.querySelector("#selectedList");
const selectedTitle = document.querySelector("#selectedTitle");
const maxFavorites = document.querySelector("#maxFavorites");
const galleryName = document.querySelector("#galleryName");
const clientLink = document.querySelector("#clientLink");
const proofFiles = document.querySelector("#proofFiles");
const proofCount = document.querySelector("#proofCount");
const favoriteLimit = document.querySelector("#favoriteLimit");
const uploadStatus = document.querySelector("#uploadStatus");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
}

function renderPhotos() {
  grid.innerHTML = "";

  photos
    .filter((photo) => {
      if (currentFilter === "selected") return selected.has(photo.id);
      if (currentFilter === "unselected") return !selected.has(photo.id);
      return true;
    })
    .forEach((photo) => {
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
  favoriteLimit.textContent = maxFavorites.value || "12";
}

function togglePhoto(id) {
  const limit = Number(maxFavorites.value) || 12;

  if (selected.has(id)) {
    selected.delete(id);
  } else if (selected.size >= limit) {
    showToast(`Selection limit reached: ${limit} photos.`);
    return;
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

  uploadedUrls.forEach((url) => URL.revokeObjectURL(url));
  uploadedUrls.length = 0;
  selected.clear();

  photos = files.map((file, index) => {
    const url = URL.createObjectURL(file);
    uploadedUrls.push(url);
    return {
      id: `TP-${String(index + 1).padStart(3, "0")}`,
      fileName: file.name,
      tone: ["#c49975", "#dcb584", "#6f876f", "#c97155", "#9fb2b8", "#aa905e"][index % 6],
      pos: "center",
      url
    };
  });

  currentFilter = "all";
  document.querySelectorAll("[data-filter]").forEach((item) => item.classList.remove("is-selected"));
  document.querySelector('[data-filter="all"]').classList.add("is-selected");
  uploadStatus.textContent = `${files.length} preview${files.length === 1 ? "" : "s"} loaded.`;
  updateGalleryMeta();
  renderPhotos();
  renderSelectedList();
  showToast("Preview gallery updated.");
});

galleryName.addEventListener("input", updateGalleryMeta);
maxFavorites.addEventListener("input", updateGalleryMeta);

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
