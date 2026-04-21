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
  bookForm: null,
  unsupportedMessage: null,
  pageStatus: null,
  notification: null,
};

let currentTabId = null;
let lastValidBookData = null;
let isOnDoubanPage = false;

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
  elements.bookForm = document.getElementById("bookForm");
  elements.unsupportedMessage = document.getElementById("unsupportedMessage");
  elements.pageStatus = document.getElementById("pageStatus");
  elements.notification = document.getElementById("notification");
};

const getFormData = () => ({
  title: elements.title.value,
  isbn: elements.isbn.value,
  publishedDate: elements.publishedDate.value,
  subjectId: elements.subjectId.value,
  coverImageUrl: elements.coverImageUrl.value,
  publisher: elements.publisher.value,
  pageCount: elements.pageCount.value,
  form: elements.form.value,
  tagPrice: elements.tagPrice.value,
});

const populateInputs = (data) => {
  if (!data) return;
  lastValidBookData = { ...data };

  elements.title.value = data.title || "";
  elements.isbn.value = data.isbn || "";
  elements.publishedDate.value = data.publishedDate || "";
  elements.subjectId.value = data.subjectId || "";
  elements.coverImageUrl.value = data.coverImageUrl || "";
  elements.publisher.value = data.publisher || "";
  elements.pageCount.value = data.pageCount || "";
  elements.form.value = data.form || "";
  elements.tagPrice.value = data.tagPrice || "";

  if (data.coverImageUrl) {
    updateCoverPreview(data.coverImageUrl);
  } else {
    elements.coverPreview.src = "";
    elements.coverPreview.classList.add("hidden");
  }
};

const updateCoverPreview = (url) => {
  if (!url) {
    elements.coverPreview.src = "";
    elements.coverPreview.classList.add("hidden");
    return;
  }
  elements.coverPreview.src = url;
  elements.coverPreview.classList.remove("hidden");
  elements.coverPreview.onerror = () => {
    elements.coverPreview.classList.add("hidden");
  };
};

const sanitizePrice = (value) => value.replace(/[^0-9.]/g, "");

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
    fallbackCopyToClipboard(text, format);
  }
};

const fallbackCopyToClipboard = (text, format) => {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.cssText = "position:fixed;opacity:0;";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const success = document.execCommand("copy");
    const label =
      format === "html" ? "HTML" : format === "json" ? "JSON" : "Markdown";
    showNotification(
      success ? `${label} copied!` : "Failed to copy",
      success ? "success" : "error",
    );
  } catch (err) {
    showNotification("Failed to copy", "error");
  }
  document.body.removeChild(textarea);
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
 * Use XMLHttpRequest in content script to fetch image as blob.
 * XHR sometimes bypasses fetch() restrictions.
 */
const fetchImageViaXHR = async (tabId, imgUrl) => {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (targetUrl) => {
        return new Promise((resolve) => {
          const xhr = new XMLHttpRequest();
          xhr.open("GET", targetUrl, true);
          xhr.responseType = "blob";

          xhr.onload = function () {
            if (xhr.status === 200) {
              const reader = new FileReader();
              reader.onloadend = () => resolve({ dataUrl: reader.result });
              reader.onerror = () => resolve({ error: "FILEREADER_ERROR" });
              reader.readAsDataURL(xhr.response);
            } else {
              resolve({
                error: "XHR_FAILED",
                status: xhr.status,
                statusText: xhr.statusText,
              });
            }
          };

          xhr.onerror = () =>
            resolve({ error: "XHR_ERROR", message: "Network error" });
          xhr.ontimeout = () => resolve({ error: "XHR_TIMEOUT" });

          // Set headers to mimic normal browser request
          xhr.setRequestHeader(
            "Accept",
            "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          );

          xhr.send();
        });
      },
      args: [imgUrl],
    });

    return (
      result?.result || {
        error: "INJECTION_FAILED",
        message: "No result from XHR script",
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
      { action: "fetchImageXHR", url: imgUrl, referer },
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

  // ── Attempt 1: Try canvas extraction (works for same-origin images) ───────
  const extractResult = await extractImageFromPage(currentTabId, coverImageUrl);

  if (extractResult.dataUrl) {
    try {
      const downloadId = await new Promise((resolve, reject) => {
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
    console.log("Canvas tainted by CORS, trying XHR fetch");
  } else if (extractResult.error) {
    console.warn("Canvas extraction failed:", extractResult.error);
  }

  // ── Attempt 2: XMLHttpRequest in content script ────────────────────────────
  const xhrResult = await fetchImageViaXHR(currentTabId, coverImageUrl);

  if (xhrResult.dataUrl) {
    try {
      const downloadId = await new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: xhrResult.dataUrl,
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
      showNotification("Cover saved (via XHR)!", "success");
      return;
    } catch (err) {
      console.error("XHR dataURL download failed:", err);
    }
  }

  if (xhrResult.error) {
    console.error(
      "XHR fetch failed:",
      xhrResult.error,
      xhrResult.status || xhrResult.message,
    );
  }

  // ── Attempt 3: Background service worker with referer hack ───────────────
  const referer = `https://book.douban.com/subject/${elements.subjectId.value}/`;
  const bgResult = await fetchImageViaBackground(coverImageUrl, referer);

  if (bgResult.dataUrl) {
    try {
      const downloadId = await new Promise((resolve, reject) => {
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

// ─── UI State Management ────────────────────────────────────────────────────

const updatePageStatus = () => {
  if (isOnDoubanPage) {
    elements.pageStatus.textContent = "Book data loaded";
    elements.pageStatus.classList.add("active");
  } else {
    elements.pageStatus.textContent = lastValidBookData
      ? "Data retained (not on Douban)"
      : "Not on Douban book page";
    elements.pageStatus.classList.remove("active");
  }
};

const showForm = () => {
  elements.unsupportedMessage.classList.add("hidden");
  elements.bookForm.classList.remove("hidden");
};

const loadBookData = async (tabId) => {
  currentTabId = tabId;
  try {
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { action: "getBookData" }, (res) => {
        resolve(chrome.runtime.lastError ? null : res);
      });
    });
    if (response) {
      if (response.tagPrice) {
        response.tagPrice = sanitizePrice(response.tagPrice);
      }
      populateInputs(response);
      isOnDoubanPage = true;
      showForm();
      updatePageStatus();
    } else {
      isOnDoubanPage = true;
      updatePageStatus();
    }
  } catch (err) {
    console.error("Failed to load book data:", err);
    isOnDoubanPage = false;
    updatePageStatus();
  }
};

const handleTabSwitch = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const isDouban = tab.url?.startsWith("https://book.douban.com/subject/");

  if (isDouban) {
    isOnDoubanPage = true;
    await loadBookData(tab.id);
  } else {
    isOnDoubanPage = false;
    currentTabId = tab.id;
    updatePageStatus();
  }
};

// ─── Select All on Focus ────────────────────────────────────────────────────

const initSelectAllOnFocus = () => {
  const inputs = elements.bookForm?.querySelectorAll("input");
  inputs?.forEach((input) => {
    input.addEventListener("focus", () => {
      setTimeout(() => input.select(), 10);
    });
  });
};

// ─── Subject ID Click to Copy ───────────────────────────────────────────────

const initSubjectIdCopy = () => {
  elements.subjectId?.addEventListener("click", async () => {
    const value = elements.subjectId.value;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      showNotification("Subject ID copied!", "success");
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.cssText = "position:fixed;opacity:0;";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      showNotification("Subject ID copied!", "success");
    }
  });
  elements.subjectId.style.cursor = "pointer";
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
    isOnDoubanPage = true;
    loadBookData(request.tabId);
  }
  if (request.action === "tabActivated") {
    if (request.url?.startsWith("https://book.douban.com/subject/")) {
      isOnDoubanPage = true;
      loadBookData(request.tabId);
    } else {
      isOnDoubanPage = false;
      currentTabId = request.tabId;
      updatePageStatus();
    }
  }
});

const initEventListeners = () => {
  initDropdown();
  initSelectAllOnFocus();
  initSubjectIdCopy();
  initPriceSanitization();

  elements.downloadCoverBtn?.addEventListener("click", downloadCoverImage);

  elements.previewCoverBtn?.addEventListener("click", () => {
    const url = elements.coverImageUrl.value.trim();
    if (url) {
      updateCoverPreview(url);
    } else {
      showNotification("Enter a cover URL first", "error");
    }
  });

  let debounceTimer;
  elements.coverImageUrl?.addEventListener("input", (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const url = e.target.value.trim();
      if (url) updateCoverPreview(url);
      else {
        elements.coverPreview.src = "";
        elements.coverPreview.classList.add("hidden");
      }
    }, 300);
  });
};

const init = () => {
  initElements();
  initEventListeners();
  handleTabSwitch();
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
