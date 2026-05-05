export type StorageBucket =
  | "assignments/writing"
  | "assignments/speaking"
  | "materials"
  | "recordings";

export type SavedFile = {
  originalName: string;
  storedName: string;
  relativePath: string;
  absolutePath: string;
  mimeType: string;
  size: number;
};
