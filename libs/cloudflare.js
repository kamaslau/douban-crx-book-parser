// libs/cloudflare.js — S3-compatible (Cloudflare R2) upload utilities

const sha256 = async (data) => {
  const input =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : data;
  const hash = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const hmacSha256 = async (key, data) => {
  const keyBytes =
    typeof key === "string"
      ? new TextEncoder().encode(key)
      : key instanceof ArrayBuffer
        ? new Uint8Array(key)
        : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(data),
  );
  return new Uint8Array(sig);
};

const getSignatureKey = async (key, dateStr, region, service) => {
  const kDate = await hmacSha256("AWS4" + key, dateStr);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  return await hmacSha256(kService, "aws4_request");
};

const toHex = (buf) =>
  Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const EMPTY_HASH =
  "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const formatFileSize = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const buildS3Auth = async ({
  method,
  endpoint,
  objectKey,
  contentHash,
  dateTimeStr,
  dateStr,
  region,
  service,
  accessKeyId,
  secretAccessKey,
}) => {
  const url = `${endpoint.replace(/\/$/, "")}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;
  const host = new URL(url).host;
  const path = new URL(url).pathname;

  const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${contentHash}\nx-amz-date:${dateTimeStr}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest = [
    method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    contentHash,
  ].join("\n");

  const credentialScope = `${dateStr}/${region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    dateTimeStr,
    credentialScope,
    await sha256(canonicalRequest),
  ].join("\n");

  const signingKey = await getSignatureKey(
    secretAccessKey,
    dateStr,
    region,
    service,
  );
  const signature = toHex(await hmacSha256(signingKey, stringToSign));

  return {
    url,
    host,
    path,
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "x-amz-content-sha256": contentHash,
      "x-amz-date": dateTimeStr,
    },
  };
};

const s3PutObject = async (
  endpoint,
  objectKey,
  blob,
  accessKeyId,
  secretAccessKey,
) => {
  const region = "auto";
  const service = "s3";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const dateTimeStr = now.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";

  const buf = await blob.arrayBuffer();
  const contentHash = await sha256(new Uint8Array(buf));

  const { url, headers } = await buildS3Auth({
    method: "PUT",
    endpoint,
    objectKey,
    contentHash,
    dateTimeStr,
    dateStr,
    region,
    service,
    accessKeyId,
    secretAccessKey,
  });

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": blob.type || "image/jpeg",
    },
    body: buf,
  });

  return response.ok;
};

const s3HeadObject = async (
  endpoint,
  objectKey,
  accessKeyId,
  secretAccessKey,
) => {
  const region = "auto";
  const service = "s3";
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const dateTimeStr = now.toISOString().slice(0, 19).replace(/[-:]/g, "") + "Z";

  const { url, headers } = await buildS3Auth({
    method: "HEAD",
    endpoint,
    objectKey,
    contentHash: EMPTY_HASH,
    dateTimeStr,
    dateStr,
    region,
    service,
    accessKeyId,
    secretAccessKey,
  });

  try {
    const response = await fetch(url, { method: "HEAD", headers });
    return {
      exists: response.status === 200,
      size:
        response.status === 200
          ? parseInt(response.headers.get("content-length") || "0", 10)
          : null,
    };
  } catch {
    return { exists: false, size: null };
  }
};
