function readErrorDetail(error: Error) {
  const detail = error as Error & {
    address?: unknown;
    cause?: unknown;
    code?: unknown;
    errno?: unknown;
    errors?: unknown[];
    hostname?: unknown;
    port?: unknown;
    syscall?: unknown;
  };

  return detail;
}

export function formatErrorForDisplay(error: unknown, seen = new WeakSet<object>()): string {
  if (!(error instanceof Error)) {
    if (typeof error === "string") {
      return error;
    }

    const serialized = JSON.stringify(error, null, 2);
    return serialized ?? String(error);
  }

  if (seen.has(error)) {
    return `${error.name}: ${error.message} (circular cause)`;
  }

  seen.add(error);

  const detail = readErrorDetail(error);
  const lines = [`${error.name}: ${error.message}`];

  for (const key of ["code", "errno", "syscall", "hostname", "address", "port"] as const) {
    if (detail[key] !== undefined) {
      lines.push(`${key}: ${String(detail[key])}`);
    }
  }

  if (detail.cause !== undefined) {
    lines.push("cause:");
    lines.push(
      formatErrorForDisplay(detail.cause, seen)
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n")
    );
  }

  if (Array.isArray(detail.errors) && detail.errors.length > 0) {
    lines.push("errors:");
    for (const nestedError of detail.errors) {
      lines.push(
        formatErrorForDisplay(nestedError, seen)
          .split("\n")
          .map((line) => `  ${line}`)
          .join("\n")
      );
    }
  }

  return lines.join("\n");
}
