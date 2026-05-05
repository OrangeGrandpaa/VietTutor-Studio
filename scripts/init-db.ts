import { mkdir } from "node:fs/promises";
import path from "node:path";

const uploadFolders = [
  "assignments/writing",
  "assignments/speaking",
  "materials",
  "recordings"
];

async function main() {
  const root = process.cwd();

  await Promise.all(
    uploadFolders.map((folder) =>
      mkdir(path.join(root, "uploads", folder), { recursive: true })
    )
  );

  console.log("Database prerequisites are ready.");
}

main().catch((error) => {
  console.error("Failed to initialize local folders.", error);
  process.exitCode = 1;
});
