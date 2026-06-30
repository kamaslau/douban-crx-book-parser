// options.js - Options page logic for Douban Book Parser

const STORAGE_KEYS = {
  remoteUrl: "remoteUrl",
  authToken: "authToken",
  r2AccountId: "r2AccountId",
  r2ApiTokenKeyId: "r2ApiTokenKeyId",
  r2ApiTokenKeySecret: "r2ApiTokenKeySecret",
  awsBucketName: "awsBucketName",
  uploadDir: "uploadDir",
};

const readOptions = async (...keys) => {
  const result = await chrome.storage.sync.get(keys);
  const out = {};
  for (const k of keys) out[k] = result[k] ?? "";
  return out;
};

const elements = {
  remoteUrl: null,
  authToken: null,
  r2AccountId: null,
  r2ApiTokenKeyId: null,
  r2ApiTokenKeySecret: null,
  awsBucketName: null,
  uploadDir: null,
  r2EndpointUrl: null,
  saveBtn: null,
  testBtn: null,
  optionsForm: null,
  status: null,
};

const initElements = () => {
  elements.remoteUrl = document.getElementById("remoteUrl");
  elements.authToken = document.getElementById("authToken");
  elements.r2AccountId = document.getElementById("r2AccountId");
  elements.r2ApiTokenKeyId = document.getElementById("r2ApiTokenKeyId");
  elements.r2ApiTokenKeySecret = document.getElementById("r2ApiTokenKeySecret");
  elements.awsBucketName = document.getElementById("awsBucketName");
  elements.uploadDir = document.getElementById("uploadDir");
  elements.r2EndpointUrl = document.getElementById("r2EndpointUrl");
  elements.saveBtn = document.getElementById("saveBtn");
  elements.testBtn = document.getElementById("testBtn");
  elements.optionsForm = document.getElementById("optionsForm");
  elements.status = document.getElementById("status");
};

const showStatus = (message, type = "success") => {
  const el = elements.status;
  el.textContent = message;
  el.className = `status ${type}`;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 3000);
};

const loadOptions = async () => {
  try {
    const values = await readOptions(
      STORAGE_KEYS.remoteUrl,
      STORAGE_KEYS.authToken,
      STORAGE_KEYS.r2AccountId,
      STORAGE_KEYS.r2ApiTokenKeyId,
      STORAGE_KEYS.r2ApiTokenKeySecret,
      STORAGE_KEYS.awsBucketName,
      STORAGE_KEYS.uploadDir,
    );

    elements.remoteUrl.value = values[STORAGE_KEYS.remoteUrl];
    elements.authToken.value = values[STORAGE_KEYS.authToken];
    elements.r2AccountId.value = values[STORAGE_KEYS.r2AccountId];
    elements.r2ApiTokenKeyId.value = values[STORAGE_KEYS.r2ApiTokenKeyId];
    elements.r2ApiTokenKeySecret.value =
      values[STORAGE_KEYS.r2ApiTokenKeySecret];
    elements.awsBucketName.value = values[STORAGE_KEYS.awsBucketName];
    elements.uploadDir.value = values[STORAGE_KEYS.uploadDir];
    updateR2EndpointUrl();
  } catch (err) {
    console.error("Failed to load options:", err);
    showStatus("Failed to load settings", "error");
  }
};

const saveOptions = async (event) => {
  event.preventDefault();

  const remoteUrl = elements.remoteUrl.value.trim();
  const authToken = elements.authToken.value.trim();

  if (!remoteUrl) {
    showStatus("Please enter a remote URL", "error");
    return;
  }

  if (!authToken) {
    showStatus("Please enter an authorization token", "error");
    return;
  }

  const r2AccountId = elements.r2AccountId.value.trim();
  const r2ApiTokenKeyId = elements.r2ApiTokenKeyId.value.trim();
  const r2ApiTokenKeySecret = elements.r2ApiTokenKeySecret.value.trim();
  const awsBucketName = elements.awsBucketName.value.trim();
  const uploadDir = elements.uploadDir.value.trim();

  try {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.remoteUrl]: remoteUrl,
      [STORAGE_KEYS.authToken]: authToken,
      [STORAGE_KEYS.r2AccountId]: r2AccountId,
      [STORAGE_KEYS.r2ApiTokenKeyId]: r2ApiTokenKeyId,
      [STORAGE_KEYS.r2ApiTokenKeySecret]: r2ApiTokenKeySecret,
      [STORAGE_KEYS.awsBucketName]: awsBucketName,
      [STORAGE_KEYS.uploadDir]: uploadDir,
    });
    showStatus("Settings saved successfully!", "success");
  } catch (err) {
    showStatus(`Failed to save settings: ${err.message}`, "error");
  }
};

const testConnection = async () => {
  const remoteUrl = elements.remoteUrl.value.trim();
  const authToken = elements.authToken.value.trim();

  if (!remoteUrl || !authToken) {
    showStatus("Please save settings first", "error");
    return;
  }

  elements.testBtn.disabled = true;
  elements.testBtn.textContent = "Testing...";
  showStatus("Dispatching...", "info");

  // Brief delay so "dispatching" is visible before async work
  await new Promise((r) => setTimeout(r, 200));

  showStatus("Waiting for response...", "info");

  try {
    const response = await fetch(remoteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({ _test: true }),
    });

    if (response.ok || response.status === 405) {
      showStatus("Connection successful! (endpoint responded)", "success");
    } else {
      showStatus(
        `Connection test: ${response.status} ${response.statusText}`,
        "error",
      );
    }
  } catch (err) {
    if (err.message.includes("Failed to fetch")) {
      showStatus("Connection failed: invalid URL or network error", "error");
    } else {
      showStatus(`Connection failed: ${err.message}`, "error");
    }
  } finally {
    elements.testBtn.disabled = false;
    elements.testBtn.textContent = "Test Connection";
  }
};

const init = () => {
  initElements();
  loadOptions();

  elements.optionsForm.addEventListener("submit", saveOptions);
  elements.testBtn.addEventListener("click", testConnection);

  // Auto-update S3 endpoint URL when R2 Account ID changes
  elements.r2AccountId.addEventListener("input", updateR2EndpointUrl);
};

const updateR2EndpointUrl = () => {
  const id = elements.r2AccountId.value.trim();
  elements.r2EndpointUrl.value = id
    ? `https://${id}.r2.cloudflarestorage.com`
    : "";
};

document.addEventListener("DOMContentLoaded", init);
