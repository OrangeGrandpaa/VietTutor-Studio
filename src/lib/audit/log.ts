import { logger } from "@/lib/utils/logger";

export type AuditStatus = "success" | "failure";

export type AuditEvent =
  | "auth.login"
  | "auth.logout"
  | "assignments.writing.upload"
  | "assignments.speaking.upload"
  | "materials.upload";

type AuditPayload = {
  event: AuditEvent;
  status: AuditStatus;
  ip?: string | null;
  userAgent?: string | null;
  sessionId?: string | null;
  resourceId?: string | null;
  message?: string | null;
};

export function logAuditEvent(payload: AuditPayload) {
  logger.info("audit.event", payload);
}
