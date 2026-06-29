// background.js - Service Worker

chrome.runtime.onInstalled.addListener(async () => {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  chrome.contextMenus.create({
    id: "saveCoverImage",
    title: "Save Cover Image",
    contexts: ["image"],
    documentUrlPatterns: ["chrome-extension://*/sidepanel/*"],
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === "saveCoverImage") {
    chrome.runtime.sendMessage({ action: "saveCoverFromContextMenu" });
  }
});

const isDoubanBookPage = (url) =>
  typeof url === "string" && url.startsWith("https://book.douban.com/subject/");

const sendPageEvent = (action, tabId, url) =>
  chrome.runtime.sendMessage({ action, tabId, url }).catch(() => {});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && isDoubanBookPage(tab.url)) {
    sendPageEvent("pageChanged", tabId, tab.url);
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (isDoubanBookPage(tab.url)) {
    sendPageEvent("tabActivated", tabId, tab.url);
  } else {
    sendPageEvent("nonDoubanPage");
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action } = request;

  if (action === "getBookData") {
    const tabId = sender.tab?.id ?? request.tabId;

    chrome.tabs.sendMessage(tabId, { action: "getBookData" }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse(response);
      }
    });

    return true;
  }

  if (action === "downloadImage") {
    (async () => {
      try {
        await handleImageDownload(request.dataUrl, request.fileName);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }

  if (action === "fetchImageBlob") {
    (async () => {
      try {
        const dataUrl = await fetchImageAsDataURL(request.url, request.referer);
        sendResponse({ dataUrl });
      } catch (err) {
        sendResponse({ error: err.name, message: err.message });
      }
    })();
    return true;
  }

  if (action === "extractImageFromPage") {
    (async () => {
      try {
        const [result] = await chrome.scripting.executeScript({
          target: { tabId: request.tabId },
          func: (imgUrl) => {
            const img = Array.from(document.images).find((i) => {
              if (i.src === imgUrl) return true;
              const normalized = imgUrl.replace(/^https?:\/\//, "");
              return i.src.includes(normalized);
            });
            if (!img) return null;

            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || img.width;
            canvas.height = img.naturalHeight || img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            return canvas.toDataURL("image/jpeg", 0.92);
          },
          args: [request.imgUrl],
        });
        sendResponse({ dataUrl: result?.result });
      } catch (err) {
        sendResponse({ error: err.message });
      }
    })();
    return true;
  }
});

const handleImageDownload = async (dataUrl, fileName) => {
  await chrome.downloads.download({
    url: dataUrl,
    filename: fileName,
    saveAs: false,
  });
};

// Last frozen Chrome desktop UA string (stable channel, pre-UA-CH freeze).
// Modern browsers no longer send variable UA strings; this fixed value helps
// bypass image CDNs that reject headless/service-worker requests.
const FROZEN_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

/**
 * Fetch image in service worker context and convert to dataURL.
 * Service worker has different CORS permissions than content scripts.
 *
 * @param {string} url     - Image URL to fetch
 * @param {string} [referer] - Optional Referer header (helps CDNs that whitelist referrers)
 */
const fetchImageAsDataURL = async (url, referer) => {
  const headers = {
    "User-Agent": FROZEN_UA,
  };
  if (referer) {
    headers["Referer"] = referer;
  }

  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};
