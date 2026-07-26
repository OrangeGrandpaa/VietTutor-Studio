const INTERNAL_ORIGIN = "https://internal.invalid";
const DEFAULT_REDIRECT_PATH = "/dashboard";

export function resolveLoginRedirect(
  candidate: string | null | undefined,
  fallback = DEFAULT_REDIRECT_PATH
) {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/\\") ||
    /[\u0000-\u001f\u007f\\]/.test(candidate)
  ) {
    return fallback;
  }

  try {
    const url = new URL(candidate, INTERNAL_ORIGIN);

    if (url.origin !== INTERNAL_ORIGIN) {
      return fallback;
    }

    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
