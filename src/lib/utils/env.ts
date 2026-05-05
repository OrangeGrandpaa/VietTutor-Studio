const requiredEnv = ["DATABASE_URL", "SITE_ACCESS_PASSWORD", "SESSION_SECRET"] as const;

export function getEnv(name: string, fallback?: string) {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function validateRequiredEnv() {
  for (const key of requiredEnv) {
    getEnv(key);
  }
}

export function getMaxUploadSizeBytes() {
  const sizeMb = Number(process.env.MAX_UPLOAD_SIZE_MB ?? "20");
  return Number.isFinite(sizeMb) && sizeMb > 0 ? sizeMb * 1024 * 1024 : 20 * 1024 * 1024;
}
