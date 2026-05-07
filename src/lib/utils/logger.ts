type LogLevel = "info" | "warn" | "error";

type LogDetails = Record<string, unknown>;

function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return error;
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack
  };
}

function write(level: LogLevel, message: string, details?: LogDetails) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...(details
      ? Object.fromEntries(
          Object.entries(details).map(([key, value]) => [
            key,
            key === "error" ? serializeError(value) : value
          ])
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
