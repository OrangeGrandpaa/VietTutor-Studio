import path from "node:path";

export type FileTypeValidationOptions = {
  allowedExtensions: string[];
  allowedMimeTypes: string[];
};

const MIME_TYPES_BY_EXTENSION: Record<string, readonly string[]> = {
  ".pdf": ["application/pdf"],
  ".doc": ["application/msword"],
  ".docx": ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  ".ppt": ["application/vnd.ms-powerpoint"],
  ".pptx": ["application/vnd.openxmlformats-officedocument.presentationml.presentation"],
  ".md": ["text/markdown", "text/plain"],
  ".markdown": ["text/markdown", "text/plain"],
  ".txt": ["text/plain"],
  ".rtf": ["application/rtf", "application/x-rtf", "text/rtf", "text/plain"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".png": ["image/png"],
  ".webp": ["image/webp"],
  ".mp3": ["audio/mpeg"],
  ".wav": ["audio/wav"],
  ".m4a": ["audio/mp4", "audio/x-m4a"],
  ".webm": ["audio/webm"],
  ".ogg": ["audio/ogg"],
  ".mp4": ["video/mp4"],
  ".mov": ["video/quicktime"]
};

const INLINE_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
  "image/jpeg",
  "image/png",
  "image/webp",
  "audio/webm",
  "audio/wav",
  "audio/mpeg",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "video/mp4",
  "video/quicktime"
]);

const VALID_MIME_TYPE = /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/;

export function normalizeFileExtension(fileName: string) {
  return path.extname(fileName).toLowerCase();
}

export function normalizeMimeType(mimeType: string | null | undefined) {
  return (mimeType ?? "").split(";", 1)[0].trim().toLowerCase();
}

export function resolveValidatedFileMimeType(
  fileName: string,
  mimeType: string,
  options: FileTypeValidationOptions
) {
  const extension = normalizeFileExtension(fileName);
  const allowedExtensions = new Set(options.allowedExtensions.map((item) => item.toLowerCase()));

  if (!extension || !allowedExtensions.has(extension)) {
    return null;
  }

  const allowedMimeTypes = new Set(options.allowedMimeTypes.map(normalizeMimeType).filter(Boolean));
  const compatibleMimeTypes = (MIME_TYPES_BY_EXTENSION[extension] ?? []).filter((item) =>
    allowedMimeTypes.has(item)
  );

  if (compatibleMimeTypes.length === 0) {
    return null;
  }

  const normalizedMimeType = normalizeMimeType(mimeType);

  // Some browsers omit File.type. The extension still has to map to an explicitly allowed MIME.
  if (!normalizedMimeType) {
    return compatibleMimeTypes[0];
  }

  return compatibleMimeTypes.includes(normalizedMimeType) ? normalizedMimeType : null;
}

export function validateFileType(
  fileName: string,
  mimeType: string,
  options: FileTypeValidationOptions
) {
  return resolveValidatedFileMimeType(fileName, mimeType, options) !== null;
}

export function getSafeResponseMimeType(mimeType: string | null | undefined) {
  const normalizedMimeType = normalizeMimeType(mimeType);
  return VALID_MIME_TYPE.test(normalizedMimeType) ? normalizedMimeType : "application/octet-stream";
}

export function getFileDispositionType(mimeType: string, downloadRequested: boolean) {
  return downloadRequested || !INLINE_MIME_TYPES.has(getSafeResponseMimeType(mimeType))
    ? "attachment"
    : "inline";
}
