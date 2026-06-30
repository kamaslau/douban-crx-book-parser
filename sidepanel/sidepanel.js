// sidepanel.js - Side panel logic for Douban Book Extractor

const elements = {
  title: null,
  isbn: null,
  publishedDate: null,
  subjectId: null,
  coverImageUrl: null,
  coverPreview: null,
  previewCoverBtn: null,
  publisher: null,
  pageCount: null,
  form: null,
  tagPrice: null,
  copyBtn: null,
  copyDropdown: null,
  downloadCoverBtn: null,
  uploadCoverBtn: null,
  settingsBtn: null,
  sendBtn: null,
  bookForm: null,
  unsupportedMessage: null,
  parserStatus: null,
  notification: null,
  uploadedUrl: null,
  parserView: null,
  historyView: null,
  historyList: null,
  historyEmpty: null,
  tabParser: null,
  tabHistory: null,
};

let currentTabId = null;
let lastValidBookData = null;
let isOnDoubanPage = false;
let _initializing = true;
let currentView = "parser";

const initElements = () => {
  elements.title = document.getElementById("title");
  elements.isbn = document.getElementById("isbn");
  elements.publishedDate = document.getElementById("publishedDate");
  elements.subjectId = document.getElementById("subjectId");
  elements.coverImageUrl = document.getElementById("coverImageUrl");
  elements.coverPreview = document.getElementById("coverPreview");
  elements.previewCoverBtn = document.getElementById("previewCoverBtn");
  elements.publisher = document.getElementById("publisher");
  elements.pageCount = document.getElementById("pageCount");
  elements.form = document.getElementById("form");
  elements.tagPrice = document.getElementById("tagPrice");
  elements.copyBtn = document.getElementById("copyBtn");
  elements.copyDropdown = document.getElementById("copyDropdown");
  elements.downloadCoverBtn = document.getElementById("downloadCoverBtn");
  elements.uploadCoverBtn = document.getElementById("uploadCoverBtn");
  elements.settingsBtn = document.getElementById("settingsBtn");
  elements.sendBtn = document.getElementById("sendBtn");
  elements.bookForm = document.getElementById("bookForm");
  elements.unsupportedMessage = document.getElementById("unsupportedMessage");
  elements.parserStatus = document.getElementById("parserStatus");
  elements.notification = document.getElementById("notification");
  elements.uploadedUrl = document.getElementById("uploadedUrl");
  elements.parserView = document.getElementById("parserView");
  elements.historyView = document.getElementById("historyView");
  elements.historyList = document.getElementById("historyList");
  elements.historyEmpty = document.getElementById("historyEmpty");
  elements.tabParser = document.querySelector('.tab[data-tab="parser"]');
  elements.tabHistory = document.querySelector('.tab[data-tab="history"]');
};

const getFormData = () => ({
  title: elements.title?.value ?? "",
  isbn: elements.isbn?.value ?? "",
  publishedDate: elements.publishedDate?.value ?? "",
  subjectId: elements.subjectId?.value ?? "",
  coverImageUrl: elements.coverImageUrl?.value ?? "",
  publisher: elements.publisher?.value ?? "",
  pageCount: elements.pageCount?.value ?? "",
  form: elements.form?.value ?? "",
  tagPrice: elements.tagPrice?.value ?? "",
});

const formatPublishedAt = (data) => {
  if (!data) return "";

  const parts = data.slice(0, 7).split("-");
  const year = parts[0] ?? "";
  const month = parts[1] ? parts[1].padStart(2, "0") : "";

  return month ? `${year}-${month}` : year;
};

const populateInputs = async (data) => {
  if (!data) return;
  lastValidBookData = { ...data };

  elements.title.value = data.title || "";
  elements.isbn.value = data.isbn || "";
  elements.publishedDate.value = data.publishedDate
    ? formatPublishedAt(data.publishedDate)
    : "";
  elements.subjectId.value = data.subjectId || "";
  elements.coverImageUrl.value = data.coverImageUrl || "";
  elements.publisher.value = data.publisher || "";
  elements.pageCount.value = data.pageCount || "";
  elements.form.value = data.form || "";
  elements.tagPrice.value = data.tagPrice || "";

  // Reset upload path — only shown after a fresh upload
  elements.uploadedUrl.value = "";
  elements.uploadedUrl.classList.add("hidden");

  if (data.coverImageUrl) {
    await updateCoverPreview(data.coverImageUrl);
  } else {
    elements.coverPreview.src = "";
    elements.coverPreview.classList.add("hidden");
  }
};

const updateCoverPreview = async (url) => {
  if (!url) {
    elements.coverPreview.src = "";
    elements.coverPreview.classList.add("hidden");
    return;
  }

  // Show loading state
  elements.coverPreview.classList.add("hidden");

  // Fetch via content script injected into the page, so Referer is automatic
  if (currentTabId) {
    const result = await fetchImageViaFetch(currentTabId, url);
    if (result.dataUrl) {
      elements.coverPreview.src = result.dataUrl;
      elements.coverPreview.classList.remove("hidden");
      elements.coverPreview.onerror = null;
      elements.coverPreview.title = "Click to save cover image";
      return;
    }
  }

  // Fallback: try direct load (works for cached or same-origin images)
  elements.coverPreview.onerror = () =>
    elements.coverPreview.classList.add("hidden");
  elements.coverPreview.src = url;
  elements.coverPreview.classList.remove("hidden");
};

const sanitizePrice = (value) => value.replace(/[^0-9.]/g, "");

const injectContentScript = async (tabId) => {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
    return true;
  } catch (err) {
    console.warn("Content script injection failed:", err);
    return false;
  }
};

// ─── Format Generators ──────────────────────────────────────────────────────

const formatAsMarkdown = (data) => {
  const escapeMd = (str) => {
    if (!str) return "";
    return str.replace(/\|/g, "\\|").replace(/\*/g, "\\*");
  };
  return [
    `| Field | Value |`,
    `|-------|-------|`,
    `| Title | ${escapeMd(data.title)} |`,
    `| ISBN | ${escapeMd(data.isbn)} |`,
    `| Published Date | ${escapeMd(data.publishedDate)} |`,
    `| Subject ID | ${escapeMd(data.subjectId)} |`,
    `| Cover Image URL | ${escapeMd(data.coverImageUrl)} |`,
    `| Publisher | ${escapeMd(data.publisher)} |`,
    `| Page Count | ${escapeMd(data.pageCount)} |`,
    `| Form | ${escapeMd(data.form)} |`,
    `| Tag Price | ${escapeMd(data.tagPrice)} |`,
  ].join("\n");
};

const formatAsHTMLDL = (data) => {
  const escapeHtml = (str) => {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  };
  const entries = [
    { dt: "Title", dd: data.title },
    { dt: "ISBN", dd: data.isbn },
    { dt: "Published Date", dd: data.publishedDate },
    { dt: "Subject ID", dd: data.subjectId },
    { dt: "Cover Image URL", dd: data.coverImageUrl },
    { dt: "Publisher", dd: data.publisher },
    { dt: "Page Count", dd: data.pageCount },
    { dt: "Form", dd: data.form },
    { dt: "Tag Price", dd: data.tagPrice },
  ];
  const items = entries
    .map(
      (e) => `  <dt>${escapeHtml(e.dt)}</dt>\n  <dd>${escapeHtml(e.dd)}</dd>`,
    )
    .join("\n");
  return `<dl class="book-info">\n${items}\n</dl>`;
};

const formatAsJSON = (data) => {
  const jsonData = {
    title: data.title,
    isbn: data.isbn,
    publishedDate: data.publishedDate,
    subjectId: data.subjectId,
    coverImageUrl: data.coverImageUrl,
    publisher: data.publisher,
    pageCount: data.pageCount,
    form: data.form,
    tagPrice: data.tagPrice,
  };
  return JSON.stringify(jsonData, null, 2);
};

// ─── Copy Logic ─────────────────────────────────────────────────────────────

const copyToClipboard = async (format) => {
  const data = getFormData();
  let text;
  switch (format) {
    case "html":
      text = formatAsHTMLDL(data);
      break;
    case "json":
      text = formatAsJSON(data);
      break;
    default:
      text = formatAsMarkdown(data);
      break;
  }
  try {
    await navigator.clipboard.writeText(text);
    const label =
      format === "html" ? "HTML" : format === "json" ? "JSON" : "Markdown";
    showNotification(`${label} copied!`, "success");
  } catch (err) {
    showNotification("Failed to copy", "error");
  }
};

// ─── Dropdown Logic ─────────────────────────────────────────────────────────

const toggleDropdown = (show) => {
  if (show === undefined) {
    elements.copyDropdown.classList.toggle("hidden");
  } else if (show) {
    elements.copyDropdown.classList.remove("hidden");
  } else {
    elements.copyDropdown.classList.add("hidden");
  }
};

const initDropdown = () => {
  elements.copyBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleDropdown();
  });
  elements.copyDropdown.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      copyToClipboard(item.dataset.format);
      toggleDropdown(false);
    });
  });
  document.addEventListener("click", () => toggleDropdown(false));
  elements.copyDropdown.addEventListener("click", (e) => e.stopPropagation());
};

// ─── Notifications ──────────────────────────────────────────────────────────

const showNotification = (message, type = "success") => {
  const el = elements.notification;
  el.textContent = message;
  el.className = `notification ${type}`;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.add("hidden"), 2500);
};

// ─── Image Extraction ───────────────────────────────────────────────────────

/**
 * Extract image from page DOM via canvas.
 * Returns {dataUrl} on success, {error} if CORS-tainted or not found.
 */
const extractImageFromPage = async (tabId, imgUrl) => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (targetUrl) => {
        const img = Array.from(document.images).find((i) => {
          if (i.src === targetUrl) return true;
          const normalized = targetUrl.replace(/^https?:\/\//, "");
          return i.src.includes(normalized);
        });

        if (!img)
          return { error: "NOT_FOUND", message: "Image not found in DOM" };
        if (!img.complete || img.naturalWidth === 0) {
          return { error: "NOT_LOADED", message: "Image not fully loaded" };
        }

        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
          return { dataUrl };
        } catch (canvasErr) {
          return { error: "CORS_TAINTED", message: canvasErr.message };
        }
      },
      args: [imgUrl],
    });

    return (
      result?.result || {
        error: "INJECTION_FAILED",
        message: "Script injection returned no result",
      }
    );
  } catch (err) {
    return { error: "INJECTION_FAILED", message: err.message };
  }
};

/**
 * Use fetch() in content script to get image as blob, then convert to dataURL.
 */
const fetchImageViaFetch = async (tabId, imgUrl) => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: async (targetUrl) => {
        try {
          const response = await fetch(targetUrl, {
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) {
            return {
              error: "FETCH_FAILED",
              status: response.status,
              statusText: response.statusText,
            };
          }
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve({ dataUrl: reader.result });
            reader.onerror = () => resolve({ error: "FILEREADER_ERROR" });
            reader.readAsDataURL(blob);
          });
        } catch (err) {
          return { error: "FETCH_ERROR", message: err.message };
        }
      },
      args: [imgUrl],
    });

    return (
      result?.result || {
        error: "INJECTION_FAILED",
        message: "No result from fetch script",
      }
    );
  } catch (err) {
    return { error: "INJECTION_FAILED", message: err.message };
  }
};

/**
 * Try to get image via background service worker fetch with referer override.
 */
const fetchImageViaBackground = async (imgUrl, referer) => {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "fetchImageBlob", url: imgUrl, referer },
      (response) => {
        if (chrome.runtime.lastError) {
          resolve({
            error: "BG_ERROR",
            message: chrome.runtime.lastError.message,
          });
        } else {
          resolve(response || { error: "BG_NO_RESPONSE" });
        }
      },
    );
  });
};

// ─── Download Cover ───────────────────────────────────────────────────────────

const downloadCoverImage = async () => {
  const coverImageUrl = elements.coverImageUrl.value;
  if (!coverImageUrl) {
    showNotification("No cover image URL", "error");
    return;
  }

  const fileName = `${elements.isbn.value || elements.subjectId.value || "cover"}.jpg`;

  showNotification("Downloading...", "success");

  // ── Attempt 1: fetch() in content script ───────────────────────────────────
  const fetchResult = await fetchImageViaFetch(currentTabId, coverImageUrl);

  if (fetchResult.dataUrl) {
    try {
      await new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: fetchResult.dataUrl,
            filename: fileName,
            saveAs: false,
            conflictAction: "uniquify",
          },
          (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!id) {
              reject(new Error("Download failed: no download ID"));
            } else {
              resolve(id);
            }
          },
        );
      });
      showNotification("Cover saved!", "success");
      return;
    } catch (err) {
      console.error("fetch dataURL download failed:", err);
    }
  }

  if (fetchResult.error) {
    console.error(
      "fetch failed:",
      fetchResult.error,
      fetchResult.status || fetchResult.message,
    );
  }

  // ── Attempt 2: Try canvas extraction (works for same-origin images) ───────
  const extractResult = await extractImageFromPage(currentTabId, coverImageUrl);

  if (extractResult.dataUrl) {
    try {
      await new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: extractResult.dataUrl,
            filename: fileName,
            saveAs: false,
            conflictAction: "uniquify",
          },
          (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!id) {
              reject(new Error("Download failed: no download ID"));
            } else {
              resolve(id);
            }
          },
        );
      });
      showNotification("Cover saved (from page)!", "success");
      return;
    } catch (err) {
      console.error("Canvas dataURL download failed:", err);
    }
  }

  if (extractResult.error === "CORS_TAINTED") {
    console.warn("Canvas tainted by CORS");
  } else if (extractResult.error) {
    console.warn("Canvas extraction failed:", extractResult.error);
  }

  // ── Attempt 3: Background service worker with Referer header ──────────────
  const referer = `https://book.douban.com/subject/${elements.subjectId.value}/`;
  const bgResult = await fetchImageViaBackground(coverImageUrl, referer);

  if (bgResult.dataUrl) {
    try {
      await new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: bgResult.dataUrl,
            filename: fileName,
            saveAs: false,
            conflictAction: "uniquify",
          },
          (id) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!id) {
              reject(new Error("Download failed: no download ID"));
            } else {
              resolve(id);
            }
          },
        );
      });
      showNotification("Cover saved (via background)!", "success");
      return;
    } catch (err) {
      console.error("Background dataURL download failed:", err);
    }
  }

  if (bgResult.error) {
    console.error("Background fetch failed:", bgResult.error, bgResult.message);
  }

  // ── All attempts failed ────────────────────────────────────────────────────
  showNotification("Download blocked by server. Copy URL manually.", "error");
};

// ─── Upload Cover ────────────────────────────────────────────────────────────

// AWS Signature V4 helpers using Web Crypto API
const uploadCoverImage = async () => {
  const coverImageUrl = elements.coverImageUrl.value;
  if (!coverImageUrl) {
    showNotification("No cover image URL", "error");
    return;
  }

  // Read R2 settings from storage
  let config;
  try {
    config = await readOptions(
      STORAGE_KEYS.r2AccountId,
      STORAGE_KEYS.r2ApiTokenKeyId,
      STORAGE_KEYS.r2ApiTokenKeySecret,
      STORAGE_KEYS.awsBucketName,
      STORAGE_KEYS.uploadDir,
    );
  } catch (err) {
    showNotification("Failed to load R2 settings", "error");
    return;
  }

  if (
    !config.r2AccountId ||
    !config.r2ApiTokenKeyId ||
    !config.r2ApiTokenKeySecret ||
    !config.awsBucketName
  ) {
    showNotification("Configure R2 in settings first", "error");
    return;
  }

  const fileName = `${elements.isbn.value || elements.subjectId.value || "cover"}.jpg`;
  const endpoint = `https://${config.awsBucketName}.${config.r2AccountId}.r2.cloudflarestorage.com`;

  showNotification("Uploading...", "success");

  // Get image data via fetch injected into page (correct Referer)
  const result = await fetchImageViaFetch(currentTabId, coverImageUrl);
  if (!result || !result.dataUrl) {
    showNotification("Failed to fetch image", "error");
    return;
  }

  try {
    const blob = await (await fetch(result.dataUrl)).blob();
    const dir = config.uploadDir
      ? `${config.uploadDir.replace(/^\/+|\/+$/g, "")}/`
      : "";
    const objectKey = `${dir}${fileName}`;

    // Check if file already exists
    const { exists, size: existingSize } = await s3HeadObject(
      endpoint,
      objectKey,
      config.r2ApiTokenKeyId,
      config.r2ApiTokenKeySecret,
    );

    if (exists) {
      const newSize = blob.size;
      const msg = `File exists (${formatFileSize(existingSize)}) vs new (${formatFileSize(newSize)}). Overwrite?`;
      if (!confirm(msg)) {
        showNotification("File already exists", "success");
        elements.uploadedUrl.value = objectKey;
        elements.uploadedUrl.classList.remove("hidden");
        return;
      }
    }

    const success = await s3PutObject(
      endpoint,
      objectKey,
      blob,
      config.r2ApiTokenKeyId,
      config.r2ApiTokenKeySecret,
    );

    if (success) {
      const path = `${dir}${fileName}`;
      showNotification("Upload Succeed", "success");
      elements.uploadedUrl.value = path;
      elements.uploadedUrl.classList.remove("hidden");
    } else {
      showNotification("Upload failed: server rejected", "error");
    }
  } catch (err) {
    showNotification(`Upload failed: ${err.message}`, "error");
  }
};

// ─── UI State Management ────────────────────────────────────────────────────

const updateParserStatus = () => {
  const showLoaded = isOnDoubanPage && currentView === "parser";
  if (showLoaded) {
    elements.parserStatus.textContent = "Book data loaded";
    elements.parserStatus.classList.add("active");
  } else {
    elements.parserStatus.textContent = lastValidBookData
      ? "Data retained"
      : "Not on Douban book page";
    elements.parserStatus.classList.remove("active");
  }
};

const showForm = () => {
  elements.unsupportedMessage.classList.add("hidden");
  elements.bookForm.classList.remove("hidden");
};

// ─── History ────────────────────────────────────────────────────────────────

const HISTORY_KEY = "bookHistory";
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;

const getHistory = async () => {
  const { [HISTORY_KEY]: raw } = await chrome.storage.local.get(HISTORY_KEY);
  return raw || {};
};

const pruneHistory = async (entries) => {
  const cutoff = Date.now() - HISTORY_TTL_MS;
  let changed = false;
  for (const key of Object.keys(entries)) {
    if (new Date(entries[key].parsedAt).getTime() < cutoff) {
      delete entries[key];
      changed = true;
    }
  }
  if (changed) await chrome.storage.local.set({ [HISTORY_KEY]: entries });
  return entries;
};

const saveHistoryItem = async (data) => {
  if (!data.subjectId) return;
  const entries = await getHistory();
  entries[data.subjectId] = {
    title: data.title || "",
    isbn: data.isbn || "",
    publishedDate: data.publishedDate || "",
    subjectId: data.subjectId,
    coverImageUrl: data.coverImageUrl || "",
    publisher: data.publisher || "",
    pageCount: data.pageCount || "",
    form: data.form || "",
    tagPrice: data.tagPrice || "",
    parsedAt: new Date().toISOString(),
  };
  await chrome.storage.local.set({ [HISTORY_KEY]: entries });
  await pruneHistory(entries);
};

const formatRelativeTime = (iso) => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const renderHistory = async () => {
  const entries = await getHistory();
  const pruned = await pruneHistory(entries);
  const items = Object.values(pruned).sort(
    (a, b) => new Date(b.parsedAt).getTime() - new Date(a.parsedAt).getTime(),
  );

  elements.historyList.innerHTML = "";
  if (items.length === 0) {
    elements.historyEmpty.classList.remove("hidden");
    return;
  }
  elements.historyEmpty.classList.add("hidden");

  for (const item of items) {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <div class="history-item-title">${item.title || "Untitled"}</div>
      <div class="history-item-meta">
        <span>${item.isbn || "—"}</span>
        <span>${formatRelativeTime(item.parsedAt)}</span>
      </div>`;
    div.addEventListener("click", () => onHistoryItemClick(item));
    elements.historyList.appendChild(div);
  }
};

const onHistoryItemClick = async (entry) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const isDouban = tab?.url?.startsWith("https://book.douban.com/subject/");

  if (isDouban && tab.id) {
    // Navigate to the book page, then let normal parse flow handle it
    await chrome.tabs.update(tab.id, {
      url: `https://book.douban.com/subject/${entry.subjectId}/`,
    });
    // loadBookData will fire via pageChanged; switch tab when data arrives
  } else {
    // Not on Douban — open a new tab for the book page
    await chrome.tabs.create({
      url: `https://book.douban.com/subject/${entry.subjectId}/`,
    });
  }
};

// ─── Tab View Switching ────────────────────────────────────────────────────

const switchView = (name) => {
  currentView = name;
  elements.tabParser.classList.toggle("active", name === "parser");
  elements.tabHistory.classList.toggle("active", name === "history");
  elements.parserView.classList.toggle("hidden", name !== "parser");
  elements.historyView.classList.toggle("hidden", name !== "history");

  updateParserStatus();
  if (name === "history") renderHistory();
};

const initTabs = () => {
  elements.tabParser?.addEventListener("click", () => switchView("parser"));
  elements.tabHistory?.addEventListener("click", () => switchView("history"));
};

const loadBookData = async (tabId) => {
  currentTabId = tabId;

  const requestBookData = async () => {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: "getBookData" }, (res) => {
        resolve({ res, error: chrome.runtime.lastError });
      });
    });
  };

  try {
    let { res: response, error } = await requestBookData();

    if (!response && error) {
      const injected = await injectContentScript(tabId);
      if (injected) {
        ({ res: response, error } = await requestBookData());
      }
    }

    if (response) {
      if (response.tagPrice) {
        response.tagPrice = sanitizePrice(response.tagPrice);
      }
      populateInputs(response);
      isOnDoubanPage = true;
      showForm();
      updateParserStatus();
      saveHistoryItem(response);
      // If user clicked a history item that triggered navigation, switch back
      if (currentView === "history") switchView("parser");
    } else {
      if (lastValidBookData) {
        // Re-populate form with cached data when fresh extraction fails
        populateInputs(lastValidBookData);
        isOnDoubanPage = true;
        showForm();
        updateParserStatus();
      } else {
        isOnDoubanPage = true;
        updateParserStatus();
      }
      if (error) {
        console.warn(
          "No content script response on Douban page after injection:",
          error,
        );
      }
    }
  } catch (err) {
    console.error("Failed to load book data:", err);
    isOnDoubanPage = false;
    updateParserStatus();
  }
};

const handleTabSwitch = async () => {
  _initializing = true;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    _initializing = false;
    return;
  }

  const isDouban = tab.url?.startsWith("https://book.douban.com/subject/");

  if (isDouban) {
    isOnDoubanPage = true;
    await loadBookData(tab.id);
  } else {
    currentTabId = tab.id;
  }

  _initializing = false;
};

// ─── Select All on Focus ────────────────────────────────────────────────────

const initSelectAllOnFocus = () => {
  const inputs = elements.bookForm?.querySelectorAll("input");
  inputs?.forEach((input) => {
    input.addEventListener("focus", () => {
      navigator.clipboard.writeText(input.value).catch(() => {});
      requestAnimationFrame(() => input.select());
    });
  });
};

// ─── Price Input Sanitization ───────────────────────────────────────────────

const initPriceSanitization = () => {
  elements.tagPrice?.addEventListener("input", (e) => {
    const sanitized = sanitizePrice(e.target.value);
    if (sanitized !== e.target.value) {
      e.target.value = sanitized;
    }
  });
};

// ─── Init ───────────────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((request) => {
  if (
    request.action === "pageChanged" &&
    request.url?.startsWith("https://book.douban.com/subject/")
  ) {
    if (_initializing) return;
    isOnDoubanPage = true;
    loadBookData(request.tabId);
  }
  if (request.action === "tabActivated") {
    if (_initializing) return;
    if (request.url?.startsWith("https://book.douban.com/subject/")) {
      isOnDoubanPage = true;
      loadBookData(request.tabId);
    } else {
      currentTabId = request.tabId;
    }
  }
  if (request.action === "saveCoverFromContextMenu") {
    downloadCoverImage();
  }
});

const initEventListeners = () => {
  initDropdown();
  initSelectAllOnFocus();
  initPriceSanitization();

  elements.downloadCoverBtn?.addEventListener("click", downloadCoverImage);
  elements.uploadCoverBtn?.addEventListener("click", uploadCoverImage);

  // Click preview image to save cover with proper filename
  elements.coverPreview?.addEventListener("click", (e) => {
    // Ignore if src is empty or not loaded from our proxy
    if (!e.target.src || e.target.src === window.location.href) return;
    downloadCoverImage();
  });

  elements.previewCoverBtn?.addEventListener("click", async () => {
    const url = elements.coverImageUrl.value.trim();
    if (url) {
      await updateCoverPreview(url);
    } else {
      showNotification("Enter a cover URL first", "error");
    }
  });

  let debounceTimer;
  elements.coverImageUrl?.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const url = e.target.value.trim();
      if (url) await updateCoverPreview(url);
      else {
        elements.coverPreview.src = "";
        elements.coverPreview.classList.add("hidden");
      }
    }, 300);
  });
};

// ─── Settings & Send ───────────────────────────────────────────────────────

const openSettings = () => {
  chrome.runtime.openOptionsPage();
};

const sendToRemote = async () => {
  const data = getFormData();

  // Validate data exists
  if (!data.title && !data.subjectId) {
    showNotification("No book data to send", "error");
    return;
  }

  // Get config from storage
  let config;
  try {
    const raw = await readOptions(
      STORAGE_KEYS.remoteUrl,
      STORAGE_KEYS.authToken,
    );
    config = {
      url: raw[STORAGE_KEYS.remoteUrl],
      token: raw[STORAGE_KEYS.authToken],
    };
  } catch (err) {
    showNotification("Failed to load settings", "error");
    return;
  }

  if (!config.url) {
    showNotification("Configure remote URL in settings", "error");
    openSettings();
    return;
  }

  if (!config.token) {
    showNotification("Configure token in settings", "error");
    openSettings();
    return;
  }

  // Disable send button during request
  elements.sendBtn.disabled = true;
  elements.sendBtn.textContent = "Sending...";

  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      showNotification("Data sent successfully!", "success");
    } else if (response.status === 401) {
      // Clear invalid token
      await chrome.storage.sync.remove(STORAGE_KEYS.authToken);
      showNotification(
        "Unauthorized - token cleared. Reconfigure in settings.",
        "error",
      );
      openSettings();
    } else {
      showNotification(
        `Error: ${response.status} ${response.statusText}`,
        "error",
      );
    }
  } catch (err) {
    if (err.message.includes("Failed to fetch")) {
      showNotification("Network error: check URL in settings", "error");
    } else {
      showNotification("Failed to send: " + err.message, "error");
    }
  } finally {
    elements.sendBtn.disabled = false;
    elements.sendBtn.textContent = "Send";
  }
};

const initSettingsAndSend = () => {
  elements.settingsBtn?.addEventListener("click", openSettings);
  elements.sendBtn?.addEventListener("click", sendToRemote);
};

const init = () => {
  initElements();
  initEventListeners();
  initTabs();
  initSettingsAndSend();
  handleTabSwitch();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
