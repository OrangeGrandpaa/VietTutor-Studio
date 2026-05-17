type LogLevel = "info" | "warn" | "error";

type LogDetails = Record<string, unknown>;

function serializeError(error: unknown, seen = new WeakSet<object>()): unknown {
  if (!(error instanceof Error)) {
    return error;
  }

  if (seen.has(error)) {
    return {
      name: error.name,
      message: error.message,
      circular: true
    };
  }

  seen.add(error);

  const errorWithDetails = error as Error & {
    address?: unknown;
    cause?: unknown;
    code?: unknown;
    errno?: unknown;
    errors?: unknown[];
    hostname?: unknown;
    port?: unknown;
    syscall?: unknown;
  };

  const serialized: Record<string, unknown> = {
    name: error.name,
    message: error.message,
    stack: error.stack
  };

  for (const key of ["code", "errno", "syscall", "hostname", "address", "port"] as const) {
    if (errorWithDetails[key] !== undefined) {
      serialized[key] = errorWithDetails[key];
    }
  }

  if (errorWithDetails.cause !== undefined) {
    serialized.cause = serializeError(errorWithDetails.cause, seen);
  }

  if (Array.isArray(errorWithDetails.errors)) {
    serialized.errors = errorWithDetails.errors.map((item) => serializeError(item, seen));
  }

  return serialized;
}

function write(level: LogLevel, message: string, details?: LogDetails) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...(details
      ? Object.fromEntries(
          Object.entries(details).map(([key, value]) => [key, serializeError(value)])
        )
      : {})
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.info(line);
}

export const logger = {
  info(message: string, details?: LogDetails) {
    write("info", message, details);
  },
  warn(message: string, details?: LogDetails) {
    write("warn", message, details);
  },
  error(message: string, details?: LogDetails) {
    write("error", message, details);
  }
};
