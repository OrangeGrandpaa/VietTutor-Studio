import { loadEnvFile } from "node:process";

try {
  loadEnvFile(".env");
} catch (error) {
  console.error(`Unable to load .env: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}

const required = ["DATABASE_URL", "SITE_ACCESS_PASSWORD", "SESSION_SECRET", "KIMI_API_KEY"];
const missing = required.filter((name) => !process.env[name]?.trim());

if (missing.length > 0) {
  console.error(`Missing production environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

if ((process.env.SITE_ACCESS_PASSWORD?.length ?? 0) < 12) {
  console.error("SITE_ACCESS_PASSWORD must contain at least 12 characters in production.");
  process.exit(1);
}

if ((process.env.SESSION_SECRET?.length ?? 0) < 32) {
  console.error("SESSION_SECRET must contain at least 32 characters in production.");
  process.exit(1);
}

if (!process.env.DATABASE_URL?.startsWith("file:")) {
  console.error("This deployment runbook expects a file: SQLite DATABASE_URL.");
  process.exit(1);
}

console.log("Production environment variables are present and meet minimum checks.");
