// libs/client.js — Shared utilities for extension pages

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
