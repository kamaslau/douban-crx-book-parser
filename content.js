// content.js - Extract book data from Douban page
const extractBookData = () => {
  const getText = (selector) =>
    document.querySelector(selector)?.textContent?.trim() ?? "";
  const title = getText('[property="v:itemreviewed"]');
  const coverImageUrl = document.querySelector("#mainpic img")?.src ?? "";
  const subjectId = window.location.pathname.split("/")[2] ?? "";

  const infoDiv = document.querySelector("#info");
  if (!infoDiv) return { title, coverImageUrl, subjectId };

  const infoText = infoDiv.textContent ?? "";
  const getInfoValue = (pattern) => infoText.match(pattern)?.[1]?.trim() ?? "";

  return {
    title,
    isbn: getInfoValue(/ISBN:\s*(\S+)/),
    publishedDate: getInfoValue(/出版年:\s*(\S+)/),
    subjectId,
    coverImageUrl,
    publisher: getInfoValue(/出版社:\s*([^\n]+)/),
    pageCount: getInfoValue(/页数:\s*(\d+)/),
    form: getInfoValue(/装帧:\s*(\S+)/),
    tagPrice: getInfoValue(/定价:\s*([^\n]+)/),
  };
};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getBookData") {
    sendResponse(extractBookData());
  }
});
