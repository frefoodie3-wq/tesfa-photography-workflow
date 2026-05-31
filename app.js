let photos = [];

const selected = new Set();
const uploadedUrls = [];
let currentFilter = "all";
let currentGallery = null;
let currentUser = null;
let currentClientToken = new URLSearchParams(window.location.search).get("token") || "";

const config = window.TESFA_SUPABASE || {};
const isSupabaseConfigured = Boolean(config.url && config.anonKey && window.supabase);
const supabaseClient = isSupabaseConfigured
  ? window.supabase.createClient(config.url, config.anonKey)
  : null;
const storageBucket = config.storageBucket || "gallery-previews";

const grid = document.querySelector("#photoGrid");
const selectedCount = document.querySelector("#selectedCount");
const selectedList = document.querySelector("#selectedList");
const selectedTitle = document.querySelector("#selectedTitle");
const galleryName = document.querySelector("#galleryName");
const selectionLimit = document.querySelector("#selectionLimit");
const limitCount = document.querySelector("#limitCount");
const clientLink = document.querySelector("#clientLink");
const proofFiles = document.querySelector("#proofFiles");
const proofCount = document.querySelector("#proofCount");
const uploadStatus = document.querySelector("#uploadStatus");
const clearGallery = document.querySelector("#clearGallery");
const backendStatus = document.querySelector("#backendStatus");
const adminEmail = document.querySelector("#adminEmail");
const adminPassword = document.querySelector("#adminPassword");
const signInButton = document.querySelector("#signInButton");
const signOutButton = document.querySelector("#signOutButton");
const toast = document.querySelector("#toast");

function getFileKey(file) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function createToken() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getSlug() {
  return galleryName.value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "client-gallery";
}

function getSelectionLimit() {
  return Math.max(1, Number(selectionLimit.value) || 1);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function setActiveFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll("[data-filter]").forEach((item) => {
    item.classList.toggle("is-selected", item.dataset.filter === filter);
  });
}

function updateBackendStatus() {
  if (!isSupabaseConfigured) {
    backendStatus.textContent = "Browser-only mode until Supabase is configured.";
    signInButton.disabled = true;
    signOutButton.disabled = true;
    adminEmail.disabled = true;
    adminPassword.disabled = true;
    return;
  }

  signInButton.disabled = Boolean(currentUser);
  signOutButton.disabled = !currentUser;
  adminEmail.disabled = Boolean(currentUser);
  adminPassword.disabled = Boolean(currentUser);
  backendStatus.textContent = currentUser
    ? `Signed in as ${currentUser.email}`
    : "Sign in to save galleries online.";
}

function updateGalleryMeta() {
  const token = currentGallery?.client_token || currentClientToken || createToken();
  if (!currentGallery && !currentClientToken) {
    currentClientToken = token;
  }

  clientLink.textContent = `${window.location.origin}/?gallery=${getSlug()}&token=${token}#client-view`;
  proofCount.textContent = photos.length;
  limitCount.textContent = getSelectionLimit();
  clearGallery.disabled = photos.length === 0;
  updateBackendStatus();
}

function getPhotoImageUrl(photo) {
  if (photo.url) return photo.url;
  if (photo.storage_path && supabaseClient) {
    return supabaseClient.storage.from(storageBucket).getPublicUrl(photo.storage_path).data.publicUrl;
  }
  return "assets/workflow-hero.png";
}

function renderPhotos() {
  grid.innerHTML = "";

  if (!photos.length) {
    grid.innerHTML = `
      <div class="empty-gallery">
        <strong>No previews uploaded yet</strong>
        <p>Upload client proof images above and they will appear here for selection.</p>
      </div>
    `;
    return;
  }

  const visiblePhotos = photos.filter((photo) => {
    if (currentFilter === "selected") return selected.has(photo.id);
    return !selected.has(photo.id);
  });

  if (!visiblePhotos.length) {
    grid.innerHTML = `
      <div class="empty-gallery">
        <strong>No photos in this view</strong>
        <p>${currentFilter === "selected" ? "Selected photos will appear here." : "Every preview in this view has already been selected."}</p>
      </div>
    `;
    return;
  }

  visiblePhotos.forEach((photo) => {
    const card = document.createElement("article");
    card.className = `photo-card${selected.has(photo.id) ? " is-selected" : ""}`;
    card.style.setProperty("--thumb", photo.tone || "#c49975");
    card.style.setProperty("--position", photo.pos || "center");
    card.style.setProperty("--image", `url("${getPhotoImageUrl(photo)}")`);

    card.innerHTML = `
      <button class="favorite-button" type="button" aria-label="Select ${photo.id}" aria-pressed="${selected.has(photo.id)}">
        ${selected.has(photo.id) ? "♥" : "♡"}
      </button>
      <div class="photo-thumb" role="img" aria-label="Preview image ${photo.id}"></div>
      <div class="photo-meta">
        <strong>${photo.displayId || photo.display_id || photo.id}</strong>
        <span>${photo.fileName || photo.file_name}</span>
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
    item.innerHTML = `<strong>${photo.fileName || photo.file_name}</strong><span>#${String(index + 1).padStart(2, "0")}</span>`;
    selectedList.appendChild(item);
  });
}

async function ensureRemoteGallery() {
  if (!isSupabaseConfigured || !currentUser) return null;

  const payload = {
    name: galleryName.value.trim() || "Client Gallery",
    slug: getSlug(),
    selection_limit: getSelectionLimit(),
    deadline: document.querySelector('input[type="date"]').value || null
  };

  if (currentGallery?.id) {
    const { data, error } = await supabaseClient
      .from("galleries")
      .update(payload)
      .eq("id", currentGallery.id)
      .select()
      .single();

    if (error) throw error;
    currentGallery = data;
    return data;
  }

  const { data, error } = await supabaseClient
    .from("galleries")
    .insert({
      ...payload,
      owner_id: currentUser.id,
      client_token: currentClientToken || createToken()
    })
    .select()
    .single();

  if (error) throw error;
  currentGallery = data;
  currentClientToken = data.client_token;
  return data;
}

async function addFilesToRemoteGallery(files) {
  const gallery = await ensureRemoteGallery();
  if (!gallery) return null;

  const existingKeys = new Set(photos.map((photo) => photo.fileKey || photo.file_key));
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

  if (!uniqueFiles.length) return { added: 0, skipped: skippedCount };

  const startIndex = photos.length;
  const uploadedPhotos = [];

  for (let index = 0; index < uniqueFiles.length; index += 1) {
    const { file, fileKey } = uniqueFiles[index];
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${gallery.id}/${fileKey}-${safeName}`;
    const displayId = `TP-${String(startIndex + index + 1).padStart(3, "0")}`;

    const { error: uploadError } = await supabaseClient.storage
      .from(storageBucket)
      .upload(storagePath, file, { upsert: false, contentType: file.type });

    if (uploadError) throw uploadError;

    const { data, error } = await supabaseClient
      .from("photos")
      .insert({
        gallery_id: gallery.id,
        display_id: displayId,
        file_name: file.name,
        file_key: fileKey,
        storage_path: storagePath
      })
      .select()
      .single();

    if (error) throw error;

    uploadedPhotos.push({
      id: data.id,
      display_id: data.display_id,
      file_name: data.file_name,
      file_key: data.file_key,
      storage_path: data.storage_path,
      tone: ["#c49975", "#dcb584", "#6f876f", "#c97155", "#9fb2b8", "#aa905e"][(startIndex + index) % 6],
      pos: "center"
    });
  }

  photos = [...photos, ...uploadedPhotos];
  return { added: uploadedPhotos.length, skipped: skippedCount };
}

function addFilesLocally(files) {
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

  const startIndex = photos.length;
  const newPhotos = uniqueFiles.map(({ file, fileKey }, index) => {
    const url = URL.createObjectURL(file);
    uploadedUrls.push(url);
    return {
      id: `local-${startIndex + index + 1}`,
      displayId: `TP-${String(startIndex + index + 1).padStart(3, "0")}`,
      fileName: file.name,
      fileKey,
      tone: ["#c49975", "#dcb584", "#6f876f", "#c97155", "#9fb2b8", "#aa905e"][(startIndex + index) % 6],
      pos: "center",
      url
    };
  });

  photos = [...photos, ...newPhotos];
  return { added: newPhotos.length, skipped: skippedCount };
}

async function loadClientGallery() {
  if (!isSupabaseConfigured || !currentClientToken) return;

  const { data, error } = await supabaseClient.rpc("get_gallery_by_token", {
    p_token: currentClientToken
  });

  if (error || !data?.gallery) {
    showToast("Gallery link could not be loaded.");
    return;
  }

  currentGallery = data.gallery;
  galleryName.value = data.gallery.name;
  selectionLimit.value = data.gallery.selection_limit;
  photos = (data.photos || []).map((photo, index) => ({
    id: photo.id,
    display_id: photo.display_id,
    file_name: photo.file_name,
    file_key: photo.file_key,
    storage_path: photo.storage_path,
    tone: ["#c49975", "#dcb584", "#6f876f", "#c97155", "#9fb2b8", "#aa905e"][index % 6],
    pos: "center"
  }));
  selected.clear();
  (data.selected_photo_ids || []).forEach((id) => selected.add(id));
  setActiveFilter("all");
  updateGalleryMeta();
  renderPhotos();
  renderSelectedList();
}

async function togglePhoto(id) {
  const nextSelected = !selected.has(id);

  if (nextSelected && selected.size >= getSelectionLimit()) {
    showToast("Selection limit reached. Unselect a photo first to choose another.");
    return;
  }

  if (isSupabaseConfigured && currentClientToken && currentGallery?.id) {
    try {
      const { data, error } = await supabaseClient.rpc("set_gallery_selection", {
        p_token: currentClientToken,
        p_photo_id: id,
        p_selected: nextSelected
      });

      if (error) throw error;
      selected.clear();
      (data.selected_photo_ids || []).forEach((photoId) => selected.add(photoId));
    } catch (error) {
      showToast(error.message?.includes("Selection limit")
        ? "Selection limit reached. Unselect a photo first to choose another."
        : "Could not save selection.");
      return;
    }
  } else if (selected.has(id)) {
    selected.delete(id);
  } else {
    selected.add(id);
  }

  renderPhotos();
  renderSelectedList();
}

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(button.dataset.filter);
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
  if (isSupabaseConfigured && !currentUser) {
    showToast("Sign in before uploading previews.");
    return;
  }
  proofFiles.click();
});

proofFiles.addEventListener("change", async () => {
  const files = Array.from(proofFiles.files || []).filter((file) => file.type.startsWith("image/"));

  if (!files.length) {
    showToast("Choose image files for the gallery.");
    return;
  }

  try {
    uploadStatus.textContent = "Uploading previews...";
    const result = isSupabaseConfigured && currentUser
      ? await addFilesToRemoteGallery(files)
      : addFilesLocally(files);

    proofFiles.value = "";
    setActiveFilter("all");
    uploadStatus.textContent = `${result.added} added. ${photos.length} total preview${photos.length === 1 ? "" : "s"} loaded.`;
    updateGalleryMeta();
    renderPhotos();
    renderSelectedList();
    showToast(result.skipped
      ? `${result.added} added, ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"} skipped.`
      : `${result.added} preview${result.added === 1 ? "" : "s"} added.`);
  } catch (error) {
    proofFiles.value = "";
    updateGalleryMeta();
    showToast(error.message || "Upload failed.");
  }
});

galleryName.addEventListener("input", updateGalleryMeta);
selectionLimit.addEventListener("input", async () => {
  updateGalleryMeta();
  if (isSupabaseConfigured && currentUser && currentGallery?.id) {
    try {
      await ensureRemoteGallery();
    } catch {
      showToast("Could not save selection limit.");
    }
  }
});

clearGallery.addEventListener("click", async () => {
  if (!photos.length) {
    showToast("There are no previews to clear.");
    return;
  }

  if (isSupabaseConfigured && currentUser && currentGallery?.id) {
    const storagePaths = photos.map((photo) => photo.storage_path).filter(Boolean);
    if (storagePaths.length) {
      const { error: storageError } = await supabaseClient.storage
        .from(storageBucket)
        .remove(storagePaths);
      if (storageError) {
        showToast(storageError.message || "Could not clear storage files.");
        return;
      }
    }

    const { error: deleteError } = await supabaseClient
      .from("photos")
      .delete()
      .eq("gallery_id", currentGallery.id);

    if (deleteError) {
      showToast(deleteError.message || "Could not clear saved previews.");
      return;
    }
  }

  uploadedUrls.forEach((url) => URL.revokeObjectURL(url));
  uploadedUrls.length = 0;
  photos = [];
  selected.clear();
  setActiveFilter("all");
  proofFiles.value = "";
  uploadStatus.textContent = "Choose JPG or PNG proof images. You can add more later.";
  updateGalleryMeta();
  renderPhotos();
  renderSelectedList();
  showToast("Uploaded previews cleared.");
});

signInButton.addEventListener("click", async () => {
  if (!isSupabaseConfigured) {
    showToast("Add Supabase URL and anon key first.");
    return;
  }

  const email = adminEmail.value.trim();
  const password = adminPassword.value;
  if (!email || !password) {
    showToast("Enter email and password.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    showToast(error.message);
    return;
  }

  currentUser = data.user;
  updateGalleryMeta();
  showToast("Signed in.");
});

signOutButton.addEventListener("click", async () => {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
  currentUser = null;
  updateGalleryMeta();
  showToast("Signed out.");
});

document.querySelector("#submitSelections").addEventListener("click", () => {
  if (!selected.size) {
    showToast("Select at least one favorite before sending.");
    return;
  }

  showToast(isSupabaseConfigured && currentClientToken
    ? "Selected list saved for the photographer."
    : "Selected list ready for download.");
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
    ...selectedPhotos.map((photo) => photo.fileName || photo.file_name)
  ].join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "tesfa-selected-favorites.txt";
  link.click();
  URL.revokeObjectURL(url);
});

async function boot() {
  if (supabaseClient) {
    const { data } = await supabaseClient.auth.getUser();
    currentUser = data.user || null;
  }

  updateGalleryMeta();

  if (currentClientToken) {
    await loadClientGallery();
  }

  renderPhotos();
  renderSelectedList();
}

boot();
