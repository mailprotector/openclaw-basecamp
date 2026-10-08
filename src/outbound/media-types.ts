/**
 * File name and content type for an outbound upload, from its URL or path.
 * Shared by the outbound media send and the agent tools' attachments.
 */

const MEDIA_CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  txt: "text/plain",
  csv: "text/csv",
  json: "application/json",
  zip: "application/zip",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export function mediaNameAndType(mediaUrl: string): { name: string; contentType: string } {
  const path = /^https?:\/\//.test(mediaUrl) ? new URL(mediaUrl).pathname : mediaUrl;
  const name = path.split("/").filter(Boolean).pop() || "attachment";
  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
  return { name, contentType: MEDIA_CONTENT_TYPES[ext] ?? "application/octet-stream" };
}
