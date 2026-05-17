// content.js - Extract book data from Douban page
const extractBookData = () => {
  const title =
    document.querySelector('[property="v:itemreviewed"]')?.textContent.trim() ||
    "";
  const coverImageUrl = document.querySelector("#mainpic img")?.src || "";
  const subjectId = window.location.pathname.split("/")[2] || "";

  const infoDiv = document.querySelector("#info");
  if (!infoDiv) return { title, coverImageUrl, subjectId };

  const infoText = infoDiv.textContent;

  const isbn = infoText.match(/ISBN:\s*(\S+)/)?.[1] || "";
  const publishedDate = infoText.match(/出版年:\s*(\S+)/)?.[1] || "";
  const publisher = infoText.match(/出版社:\s*([^\n]+)/)?.[1].trim() || "";
  const tagPrice = infoText.match(/定价:\s*([^\n]+)/)?.[1].trim() || "";
  const pageCount = infoText.match(/页数:\s*(\d+)/)?.[1] || "";
  const form = infoText.match(/装帧:\s*(\S+)/)?.[1] || "";

  return {
    title,
    isbn,
    publishedDate,
    subjectId,
    coverImageUrl,
    publisher,
    pageCount,
    form,
    tagPrice,
  };
};

// Send data to popup when requested
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getBookData") {
    sendResponse(extractBookData());
  }
});
