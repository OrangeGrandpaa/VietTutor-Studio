import "server-only";

import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { randomUUID } from "node:crypto";

import { getMaxUploadSizeBytes } from "@/lib/utils/env";
import type { SavedFile, StorageBucket } from "@/lib/storage/types";

const uploadsRoot = path.join(process.cwd(), "uploads");

export class StorageValidationError extends Error {
  constructor(
    message: string,
    readonly code: "FILE_TOO_LARGE" | "UNSUPPORTED_FILE_TYPE"
  ) {
    super(message);
    this.name = "StorageValidationError";
  }
}

function normalizeExtension(originalName: string) {
  return path.extname(originalName).toLowerCase();
}

export function generateSafeFileName(originalName: string) {
  const extension = normalizeExtension(originalName);
  const baseName = path
    .basename(originalName, extension)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const fallback = baseName || "file";
  return `${Date.now()}-${randomUUID()}-${fallback}${extension}`;
}

export function validateFileType(
  fileName: string,
  mimeType: string,
  options: { allowedExtensions: string[]; allowedMimeTypes: string[] }
) {
  const extension = normalizeExtension(fileName);
  return (
    options.allowedExtensions.includes(extension) ||
    options.allowedMimeTypes.includes(mimeType.toLowerCase())
  );
}

export function validateFileSize(size: number) {
  return size <= getMaxUploadSizeBytes();
}

function resolveSafePath(relativePath: string) {
  const absolute = path.resolve(uploadsRoot, relativePath);
  const rootWithSep = `${uploadsRoot}${path.sep}`;

  if (absolute !== uploadsRoot && !absolute.startsWith(rootWithSep)) {
    throw new Error("Invalid file path.");
  }

  return absolute;
}

export async function saveUploadedFile(params: {
  file: File;
  bucket: StorageBucket;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
}) {
  const { file, bucket, allowedExtensions, allowedMimeTypes } = params;

  if (!validateFileSize(file.size)) {
    throw new StorageValidationError("File too large.", "FILE_TOO_LARGE");
  }

  if (!validateFileType(file.name, file.type, { allowedExtensions, allowedMimeTypes })) {
    throw new StorageValidationError("Unsupported file type.", "UNSUPPORTED_FILE_TYPE");
  }

  const storedName = generateSafeFileName(file.name);
  const relativePath = path.join(bucket, storedName);
  const absolutePath = resolveSafePath(relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, buffer);

  return {
    originalName: file.name,
    storedName,
    relativePath,
    absolutePath,
    mimeType: file.type || "application/octet-stream",
    size: file.size
  } satisfies SavedFile;
}

export async function getProtectedFile(relativePath: string) {
  const absolutePath = resolveSafePath(relativePath);
  const [fileBuffer, fileStats] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);

  return {
    buffer: fileBuffer,
    size: fileStats.size,
    absolutePath
  };
}

export async function deleteFile(relativePath: string | null | undefined) {
  if (!relativePath) {
    return;
  }

  const absolutePath = resolveSafePath(relativePath);
  await rm(absolutePath, { force: true });
}
