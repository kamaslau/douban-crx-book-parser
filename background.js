// background.js - Service Worker

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo.status === "complete" &&
    tab.url?.startsWith("https://book.douban.com/subject/")
  ) {
    chrome.runtime
      .sendMessage({ action: "pageChanged", tabId, url: tab.url })
      .catch(() => {});
  }
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const tab = await chrome.tabs.get(tabId);
  if (tab.url?.startsWith("https://book.douban.com/subject/")) {
    chrome.runtime
      .sendMessage({ action: "tabActivated", tabId, url: tab.url })
      .catch(() => {});
  } else {
    chrome.runtime.sendMessage({ action: "nonDoubanPage" }).catch(() => {});
  }
});

// Handle sidepanel requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getBookData") {
    chrome.tabs.sendMessage(
      sender.tab?.id || request.tabId,
      { action: "getBookData" },
      (response) => {
        if (chrome.runtime.lastError) {
          sendResponse({ error: chrome.runtime.lastError.message });
        } else {
          sendResponse(response);
        }
      },
    );
    return true;
  }

  if (request.action === "downloadImage") {
    handleImageDownload(request.dataUrl, request.fileName)
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ error: err.message }));
    return true;
  }

  // NEW: Background image fetch to bypass page CORS
  if (request.action === "fetchImageBlob") {
    fetchImageAsDataURL(request.url)
      .then((dataUrl) => sendResponse({ dataUrl }))
      .catch((err) => sendResponse({ error: err.name, message: err.message }));
    return true;
  }

  if (request.action === "extractImageFromPage") {
    chrome.scripting
      .executeScript({
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
      })
      .then(([result]) => {
        sendResponse({ dataUrl: result?.result });
      })
      .catch((err) => {
        sendResponse({ error: err.message });
      });
    return true;
  }
});

async function handleImageDownload(dataUrl, fileName) {
  await chrome.downloads.download({
    url: dataUrl,
    filename: fileName,
    saveAs: false,
  });
}

/**
 * Fetch image in service worker context and convert to dataURL.
 * Service worker has different CORS permissions than content scripts.
 */
async function fetchImageAsDataURL(url) {
  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
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
}
