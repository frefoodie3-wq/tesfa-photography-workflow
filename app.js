const photos = [
  { id: "TP-001", tone: "#c49975", pos: "46% 27%" },
  { id: "TP-002", tone: "#dcb584", pos: "55% 31%" },
  { id: "TP-003", tone: "#6f876f", pos: "62% 29%" },
  { id: "TP-004", tone: "#c97155", pos: "70% 31%" },
  { id: "TP-005", tone: "#9fb2b8", pos: "76% 30%" },
  { id: "TP-006", tone: "#aa905e", pos: "84% 42%" },
  { id: "TP-007", tone: "#d7a583", pos: "18% 81%" },
  { id: "TP-008", tone: "#61828c", pos: "40% 72%" },
  { id: "TP-009", tone: "#9f6a43", pos: "59% 65%" },
  { id: "TP-010", tone: "#86a187", pos: "74% 63%" },
  { id: "TP-011", tone: "#b07b86", pos: "90% 72%" },
  { id: "TP-012", tone: "#776f88", pos: "28% 46%" }
];

const selected = new Set();
let currentFilter = "all";

const grid = document.querySelector("#photoGrid");
const selectedCount = document.querySelector("#selectedCount");
const selectedList = document.querySelector("#selectedList");
const selectedTitle = document.querySelector("#selectedTitle");
const maxFavorites = document.querySelector("#maxFavorites");
const galleryName = document.querySelector("#galleryName");
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

      card.innerHTML = `
        <button class="favorite-button" type="button" aria-label="Select ${photo.id}" aria-pressed="${selected.has(photo.id)}">
          ${selected.has(photo.id) ? "♥" : "♡"}
        </button>
        <div class="photo-thumb" role="img" aria-label="Preview image ${photo.id}"></div>
        <div class="photo-meta">
          <strong>${photo.id}</strong>
          <span>Preview JPG</span>
        </div>
      `;

      card.querySelector("button").addEventListener("click", () => togglePhoto(photo.id));
      grid.appendChild(card);
    });
}

function renderSelectedList() {
  const ids = Array.from(selected).sort();
  selectedCount.textContent = ids.length;
  selectedTitle.textContent = ids.length ? `${ids.length} files ready for editing` : "Waiting for client picks";
  selectedList.innerHTML = "";

  if (!ids.length) {
    const empty = document.createElement("li");
    empty.textContent = "No favorites selected yet";
    selectedList.appendChild(empty);
    return;
  }

  ids.forEach((id, index) => {
    const item = document.createElement("li");
    item.innerHTML = `<strong>${id}.jpg</strong><span>#${String(index + 1).padStart(2, "0")}</span>`;
    selectedList.appendChild(item);
  });
}

function togglePhoto(id) {
  const limit = Number(maxFavorites.value) || 12;

  if (selected.has(id)) {
    selected.delete(id);
  } else if (selected.size >= limit) {
    showToast(`Selection limit reached: ${limit} favorites.`);
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
    const link = document.querySelector("#clientLink").textContent;
    try {
      await navigator.clipboard.writeText(`https://${link}`);
      showToast("Client link copied.");
    } catch {
      showToast(`Client link: ${link}`);
    }
  });
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
  if (!ids.length) {
    showToast("No selected files to download yet.");
    return;
  }

  const content = [
    `Gallery: ${galleryName.value}`,
    `Submitted: ${new Date().toLocaleDateString()}`,
    "",
    ...ids.map((id) => `${id}.jpg`)
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tesfa-selected-favorites.txt";
  link.click();
  URL.revokeObjectURL(url);
});

renderPhotos();
renderSelectedList();
