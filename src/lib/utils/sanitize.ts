export function sanitizeText(input: string) {
  return input.replace(/\u0000/g, "").trim();
}

export function sanitizeOptionalText(input: string | null | undefined) {
  if (!input) {
    return null;
  }

  const value = sanitizeText(input);
  return value.length > 0 ? value : null;
}
