// options.js - Options page logic for Douban Book Parser

const STORAGE_KEYS = {
  remoteUrl: "remoteUrl",
  authToken: "authToken",
};

const elements = {
  remoteUrl: null,
  authToken: null,
  saveBtn: null,
  testBtn: null,
  optionsForm: null,
  status: null,
};

const initElements = () => {
  elements.remoteUrl = document.getElementById("remoteUrl");
  elements.authToken = document.getElementById("authToken");
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
    const result = await chrome.storage.sync.get([
      STORAGE_KEYS.remoteUrl,
      STORAGE_KEYS.authToken,
    ]);
    const {
      [STORAGE_KEYS.remoteUrl]: remoteUrl = "",
      [STORAGE_KEYS.authToken]: authToken = "",
    } = result;

    elements.remoteUrl.value = remoteUrl;
    elements.authToken.value = authToken;
  } catch (err) {
    console.error("Failed to load options:", err);
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

  try {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.remoteUrl]: remoteUrl,
      [STORAGE_KEYS.authToken]: authToken,
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
};

document.addEventListener("DOMContentLoaded", init);
