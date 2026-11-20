const CLIENT_ID = "b1d4fd63a1a0472eb2052def73bb0538";
const REDIRECT_URI = window.location.origin + window.location.pathname;
const AUTH_ENDPOINT = "https://accounts.spotify.com/authorize";
const TOKEN_ENDPOINT = "https://accounts.spotify.com/api/token";
const SCOPES = ["user-read-private"];

const STORAGE = {
  token: "ostinato.spotifyToken",
  verifier: "ostinato.pkceVerifier",
  state: "ostinato.authState",
};

const API_BASE = "../../api";
const CHAT_POLL_MS = 5000;
const QUEUE_POLL_MS = 15000;

function storageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
function storageRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}

let token = null;
try { token = JSON.parse(storageGet(STORAGE.token)); } catch { token = null; }
let refreshPromise = null;

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

async function sha256Base64Url(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function login() {
  if (!window.crypto || !crypto.subtle) {
    alert("Spotify login needs a secure page. Open the app via http://127.0.0.1 or https.");
    return;
  }
  const verifier = randomString(64);
  const state = randomString(16);
  storageSet(STORAGE.verifier, verifier);
  storageSet(STORAGE.state, state);

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    code_challenge_method: "S256",
    code_challenge: await sha256Base64Url(verifier),
    state,
    scope: SCOPES.join(" "),
  });
  window.location.href = `${AUTH_ENDPOINT}?${params}`;
}

function logout() {
  token = null;
  storageRemove(STORAGE.token);
  currentUser = "Guest";
  updateAuthUI();
}

function saveToken(data) {
  token = {
    access: data.access_token,
    refresh: data.refresh_token || (token && token.refresh),
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  storageSet(STORAGE.token, JSON.stringify(token));
}

async function handleAuthRedirect() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const error = params.get("error");
  if (!code && !error) return;

  window.history.replaceState(null, "", window.location.pathname);

  const expectedState = storageGet(STORAGE.state);
  const verifier = storageGet(STORAGE.verifier);
  storageRemove(STORAGE.state);
  storageRemove(STORAGE.verifier);

  if (error) {
    console.warn("Spotify login cancelled:", error);
    return;
  }
  if (!verifier || params.get("state") !== expectedState) {
    console.error("Spotify login failed: state mismatch");
    return;
  }

  try {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
      }),
    });
    if (!response.ok) {
      console.error("Token exchange failed:", response.status, await response.text());
      alert("Spotify login failed. If you're not on the app's tester list, ask to be added.");
      return;
    }
    saveToken(await response.json());
  } catch (err) {
    console.error("Token exchange error:", err);
  }
}

async function refreshAccessToken() {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token.refresh,
      client_id: CLIENT_ID,
    }),
  });
  if (!response.ok) throw new Error(`Refresh failed: ${response.status}`);
  saveToken(await response.json());
}

async function getAccessToken() {
  if (!token) return null;
  if (Date.now() < token.expiresAt - 60_000) return token.access;
  if (!token.refresh) {
    logout();
    return null;
  }
  try {
    refreshPromise = refreshPromise || refreshAccessToken();
    await refreshPromise;
    return token.access;
  } catch (err) {
    console.error(err);
    logout();
    return null;
  } finally {
    refreshPromise = null;
  }
}

async function spotifyGet(path) {
  const accessToken = await getAccessToken();
  if (!accessToken) return { loggedOut: true };
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 401) {
    logout();
    return { loggedOut: true };
  }
  if (!response.ok) {
    return { error: `${response.status} ${await response.text()}` };
  }
  return { data: await response.json() };
}

const loginButton = document.querySelector(".login-button");
const profileLink = document.getElementById("profile-link");
const chatWrapper = document.querySelector(".chat-wrapper");
const chatInput = document.querySelector(".chat-input");
const sendButton = document.querySelector(".send-message");
const toggleButton = document.querySelector(".toggle-input-bar");
const chatInputWrapper = document.querySelector(".chat-input-x-button-wrapper");
const spotifyEmbedWrapper = document.getElementById("spotify-embed-wrapper");
const queueWrapper = document.getElementById("queue-wrapper");
const searchResults = document.getElementById("search-results");
const startPlaybackButton = document.getElementById("start-playback-button");
const backendStatus = document.getElementById("backend-status");

const MUSIC_ICON = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#e8eaed"><path d="M400-120q-66 0-113-47t-47-113q0-66 47-113t113-47q23 0 42.5 5.5T480-418v-422h240v160H560v400q0 66-47 113t-113 47Z"/></svg>`;

let currentUser = "Guest";
let isSearchMode = false;
let backendAvailable = true;

function formatTime(date) {
  return date
    .toLocaleString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase();
}

function formatTimestamp(ts) {
  if (!ts) return "";
  const date = new Date(String(ts).replace(" ", "T"));
  return isNaN(date) ? String(ts) : formatTime(date);
}

function msToMinutesAndSeconds(ms) {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

function profileUrl(username) {
  return `../account/profile.html?user=${encodeURIComponent(username)}`;
}

function markBackendUnavailable(reason) {
  if (!backendAvailable) return;
  backendAvailable = false;
  console.info("Backend unavailable, running in local-only mode:", reason);
  backendStatus.hidden = false;
}

async function apiRequest(path, options = {}) {
  if (!backendAvailable) return null;
  try {
    const response = await fetch(`${API_BASE}/${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    });
    const text = await response.text();
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      markBackendUnavailable(`non-JSON response (${response.status})`);
      return null;
    }
    if (response.status >= 500) {
      markBackendUnavailable(result.message || response.status);
      return null;
    }
    return result;
  } catch (err) {
    markBackendUnavailable(err.message);
    return null;
  }
}

async function updateAuthUI() {
  if (!token) {
    loginButton.querySelector("span").textContent = "login";
    loginButton.title = "Log in with Spotify";
    profileLink.href = profileUrl(currentUser);
    return;
  }
  const { data } = await spotifyGet("/me");
  if (data) currentUser = data.display_name || data.id || "Guest";
  loginButton.querySelector("span").textContent = "logout";
  loginButton.title = `Logged in as ${currentUser}`;
  profileLink.href = profileUrl(currentUser);
}

loginButton.addEventListener("click", () => {
  if (token) logout();
  else login();
});

let chatMessages = [];

function createChatMessageComponent({ userId, message, timestamp }) {
  const messageWrapper = document.createElement("div");
  messageWrapper.className = "comment-x-time-stamp-wrapper";

  const commentWrapper = document.createElement("div");
  commentWrapper.className = "comment-wrapper";

  const username = document.createElement("a");
  username.className = "commenter-username";
  username.href = profileUrl(userId);
  username.textContent = `${userId}:`;

  const commentText = document.createElement("p");
  commentText.className = "comment";
  commentText.textContent = message;

  const timestampElement = document.createElement("p");
  timestampElement.className = "time-stamp";
  timestampElement.textContent = formatTimestamp(timestamp);

  commentWrapper.append(username, commentText);
  messageWrapper.append(commentWrapper, timestampElement);
  return messageWrapper;
}

function renderChat() {
  const nearBottom =
    chatWrapper.scrollHeight - chatWrapper.scrollTop - chatWrapper.clientHeight < 60;
  chatWrapper.replaceChildren(...chatMessages.map(createChatMessageComponent));
  if (nearBottom) chatWrapper.scrollTop = chatWrapper.scrollHeight;
  updateStats();
}

async function fetchChatMessages() {
  const result = await apiRequest("chat.php");
  if (!result || result.status !== "success") return;
  const incoming = result.data || [];
  const last = (list) => list[list.length - 1];
  const changed =
    incoming.length !== chatMessages.length ||
    (incoming.length && last(incoming).id !== last(chatMessages).id);
  if (changed) {
    chatMessages = incoming;
    renderChat();
  }
}

async function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;
  chatInput.value = "";

  if (backendAvailable) {
    const result = await apiRequest("chat.php", {
      method: "POST",
      body: JSON.stringify({ userid: currentUser, content: message }),
    });
    if (result && result.status === "success") {
      await fetchChatMessages();
      return;
    }
    if (result) console.error("Error posting message:", result.message);
  }

  chatMessages.push({ userId: currentUser, message, timestamp: new Date().toISOString() });
  renderChat();
  chatWrapper.scrollTop = chatWrapper.scrollHeight;
}

let queue = [];
let nowPlaying = null;
const playedPositions = new Set();
const imageCache = new Map();

function normalizeSpotifyTrack(track) {
  const image = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || "";
  if (image) imageCache.set(track.uri, image);
  return {
    name: track.name,
    artist: track.artists.map((a) => a.name).join(", "),
    uri: track.uri,
    durationMs: track.duration_ms,
    image,
    position: null,
    addedBy: currentUser,
  };
}

function createQueueItem(track, isCurrent) {
  const item = document.createElement("div");
  item.className = "queue-item" + (isCurrent ? " current-track" : "");

  if (track.image) {
    const img = document.createElement("img");
    img.className = "queue-image";
    img.src = track.image;
    img.alt = "";
    item.appendChild(img);
  }

  const text = document.createElement("div");
  text.className = "queue-text";
  const title = document.createElement("p");
  title.className = "song-display-title";
  title.textContent = (isCurrent ? "▶ " : "") + track.name;
  const artist = document.createElement("p");
  artist.className = "artist-name";
  artist.textContent = track.addedBy ? `${track.artist} · added by ${track.addedBy}` : track.artist;
  text.append(title, artist);

  const length = document.createElement("p");
  length.className = "song-length";
  length.textContent = track.durationMs ? msToMinutesAndSeconds(track.durationMs) : "";

  item.append(text, length);
  return item;
}

function renderQueue() {
  const items = [];
  if (nowPlaying) items.push(createQueueItem(nowPlaying, true));
  queue.forEach((track) => items.push(createQueueItem(track, false)));
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "Queue is empty — search for a song with the ♪ button.";
    items.push(empty);
  }
  queueWrapper.replaceChildren(...items);
  startPlaybackButton.textContent = nowPlaying ? "Skip" : "Start Playback";
  updateStats();
}

async function fetchQueueFromBackend() {
  const result = await apiRequest("queue.php");
  if (!result || result.status !== "success") return;
  queue = result.data
    .filter((t) => !playedPositions.has(t.position))
    .map((t) => ({
      name: t.trackName,
      artist: t.artistName,
      uri: t.trackUri,
      durationMs: t.durationMs,
      image: imageCache.get(t.trackUri) || "",
      position: t.position,
      addedBy: t.addedBy,
    }));
  renderQueue();
}

async function addTrackToQueue(spotifyTrack) {
  const track = normalizeSpotifyTrack(spotifyTrack);
  queue.push(track);
  renderQueue();
  queueWrapper.scrollTop = queueWrapper.scrollHeight;

  searchResults.replaceChildren();
  switchToChatMode();

  if (backendAvailable) {
    const result = await apiRequest("queue.php", {
      method: "POST",
      body: JSON.stringify({
        trackName: track.name,
        artistName: track.artist,
        trackUri: track.uri,
        durationMs: track.durationMs,
        addedBy: currentUser,
      }),
    });
    if (result && result.status === "success") {
      track.position = result.position ?? null;
    } else if (result) {
      console.error("Failed to add track to queue:", result.message);
    }
  }
}

async function markTrackAsPlayed(position) {
  if (position === null || position === undefined) return;
  playedPositions.add(position);
  const result = await apiRequest("queue.php", {
    method: "PUT",
    body: JSON.stringify({ position }),
  });
  if (result && result.status !== "success") {
    console.error("Failed to mark track as played:", result.message);
  }
}

let iframeApi = null;
let embedController = null;
let pendingUri = null;
let waitingForStart = false;
let lastPlayback = { isPaused: true, position: 0, duration: 0 };

window.onSpotifyIframeApiReady = (IFrameAPI) => {
  iframeApi = IFrameAPI;
  if (pendingUri) {
    const uri = pendingUri;
    pendingUri = null;
    loadInEmbed(uri);
  }
};

function onPlaybackUpdate(e) {
  const { isPaused, position, duration } = e.data;
  if (waitingForStart) {
    if (!isPaused && position < 3000) waitingForStart = false;
    lastPlayback = e.data;
    return;
  }
  const ended =
    duration > 0 &&
    (position >= duration || (isPaused && !lastPlayback.isPaused && lastPlayback.position >= duration - 1500));
  lastPlayback = e.data;
  if (ended) playNext();
}

function loadInEmbed(uri) {
  waitingForStart = true;
  lastPlayback = { isPaused: true, position: 0, duration: 0 };

  if (embedController) {
    embedController.loadUri(uri);
    embedController.play();
    return;
  }
  if (!iframeApi) {
    pendingUri = uri;
    const id = uri.split(":").pop();
    spotifyEmbedWrapper.innerHTML = `<iframe id="spotify-player" src="https://open.spotify.com/embed/track/${encodeURIComponent(id)}" width="100%" height="352" frameborder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy"></iframe>`;
    return;
  }

  const target = document.createElement("div");
  spotifyEmbedWrapper.replaceChildren(target);
  iframeApi.createController(target, { uri, width: "100%", height: 352 }, (controller) => {
    embedController = controller;
    controller.addListener("ready", () => controller.play());
    controller.addListener("playback_update", onPlaybackUpdate);
  });
}

function playNext() {
  if (!queue.length) {
    nowPlaying = null;
    renderQueue();
    return false;
  }
  nowPlaying = queue.shift();
  markTrackAsPlayed(nowPlaying.position);
  loadInEmbed(nowPlaying.uri);
  renderQueue();
  return true;
}

startPlaybackButton.addEventListener("click", () => {
  if (!playNext()) {
    alert("Queue is empty. Please add tracks to the queue.");
  }
});

let searchTimer = null;
let searchSeq = 0;

function showSearchMessage(text, withLogin = false) {
  const note = document.createElement("div");
  note.className = "empty-note";
  note.textContent = text;
  if (withLogin) {
    const btn = document.createElement("button");
    btn.className = "add-to-queue-button";
    btn.textContent = "Log in with Spotify";
    btn.addEventListener("click", login);
    note.append(" ", btn);
  }
  searchResults.replaceChildren(note);
}

async function searchSongs(query) {
  const seq = ++searchSeq;
  const params = new URLSearchParams({ q: query, type: "track", limit: "10" });
  const result = await spotifyGet(`/search?${params}`);
  if (seq !== searchSeq) return;

  if (result.loggedOut) {
    showSearchMessage("Log in to Spotify to search for songs.", true);
    return;
  }
  if (result.error) {
    console.error("Search failed:", result.error);
    showSearchMessage("Search failed — please try again.");
    return;
  }
  displaySearchResults(result.data.tracks?.items || []);
}

function scheduleSearch(query) {
  clearTimeout(searchTimer);
  if (!query) {
    searchSeq++;
    searchResults.replaceChildren();
    return;
  }
  searchTimer = setTimeout(() => searchSongs(query), 350);
}

function displaySearchResults(tracks) {
  if (!tracks.length) {
    showSearchMessage("No results.");
    return;
  }
  searchResults.replaceChildren(
    ...tracks.map((track) => {
      const trackElement = document.createElement("div");
      trackElement.className = "track-item";

      const image = document.createElement("img");
      image.src = track.album?.images?.[2]?.url || track.album?.images?.[0]?.url || "";
      image.alt = "Album Art";
      image.className = "track-image";

      const info = document.createElement("div");
      info.className = "track-info";
      const title = document.createElement("p");
      title.className = "song-display-title";
      title.textContent = track.name;
      const artist = document.createElement("p");
      artist.className = "artist-name";
      artist.textContent = track.artists.map((a) => a.name).join(", ");
      info.append(title, artist);

      const addButton = document.createElement("button");
      addButton.className = "add-to-queue-button";
      addButton.textContent = "Add to Queue";
      addButton.addEventListener("click", () => addTrackToQueue(track));

      trackElement.append(image, info, addButton);
      return trackElement;
    })
  );
}

function switchToSearchMode() {
  isSearchMode = true;
  chatInputWrapper.classList.remove("active");
  toggleButton.classList.add("active");
  toggleButton.innerHTML = `
    <input type="text" class="song-input" placeholder="search song..." />
    <button class="search-close" title="Back to chat" aria-label="Back to chat">✕</button>
  `;

  const songInput = toggleButton.querySelector(".song-input");
  songInput.focus();
  songInput.addEventListener("input", () => scheduleSearch(songInput.value.trim()));
  songInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      clearTimeout(searchTimer);
      const query = songInput.value.trim();
      if (query) searchSongs(query);
    } else if (e.key === "Escape") {
      switchToChatMode();
    }
  });
  toggleButton.querySelector(".search-close").addEventListener("click", (e) => {
    e.stopPropagation();
    switchToChatMode();
  });
}

function switchToChatMode() {
  isSearchMode = false;
  clearTimeout(searchTimer);
  searchSeq++;
  searchResults.replaceChildren();
  chatInputWrapper.classList.add("active");
  toggleButton.classList.remove("active");
  toggleButton.innerHTML = MUSIC_ICON;
  chatInput.focus();
}

function updateStats() {
  document.getElementById("stat-queue").textContent = queue.length;
  document.getElementById("stat-messages").textContent = chatMessages.length;
  document.getElementById("stat-length").textContent = nowPlaying
    ? msToMinutesAndSeconds(nowPlaying.durationMs || 0)
    : "–";
}

document.addEventListener("DOMContentLoaded", async () => {
  sendButton.addEventListener("click", sendMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendMessage();
  });

  toggleButton.addEventListener("click", () => {
    if (!isSearchMode) switchToSearchMode();
  });

  renderQueue();
  await handleAuthRedirect();
  updateAuthUI();

  await fetchChatMessages();
  await fetchQueueFromBackend();
  if (backendAvailable) {
    const chatTimer = setInterval(() => {
      if (backendAvailable) fetchChatMessages();
      else clearInterval(chatTimer);
    }, CHAT_POLL_MS);
    const queueTimer = setInterval(() => {
      if (backendAvailable) fetchQueueFromBackend();
      else clearInterval(queueTimer);
    }, QUEUE_POLL_MS);
  }
});
