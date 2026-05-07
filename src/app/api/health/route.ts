import { prisma } from "@/lib/db/prisma";
import { jsonError, jsonOk } from "@/lib/utils/http";
import { logger } from "@/lib/utils/logger";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return jsonOk({
      status: "ok",
      service: "vietutor-studio",
      time: new Date().toISOString(),
      checks: {
        database: "ok"
      }
    });
  } catch (error) {
    logger.error("healthcheck.failed", { error });

    return jsonError("Health check failed", 500);
  }
}
