import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";

const encoder = new TextEncoder();

type ParsedCookie = {
  sessionId: string;
  expiresAt: string;
};

function encodeSegment(value: string) {
  return toBase64Url(encoder.encode(value));
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toBase64Url(buffer: ArrayBuffer | Uint8Array) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  const base64 = btoa(binary);

  return base64
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function signValue(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return toBase64Url(signature);
}

export async function createSignedCookieValue(sessionId: string, expiresAt: string, secret: string) {
  const payload = `${encodeSegment(sessionId)}.${encodeSegment(expiresAt)}`;
  const signature = await signValue(payload, secret);
  return `${payload}.${signature}`;
}

export async function verifySignedCookieValue(rawValue: string | undefined, secret: string) {
  if (!rawValue) {
    return null;
  }

  const parts = rawValue.split(".");

  if (parts.length < 3) {
    return null;
  }

  const signature = parts.pop();
  const encodedExpiresAt = parts.pop();
  const encodedSessionId = parts.join(".");

  if (!signature || !encodedExpiresAt || !encodedSessionId) {
    return null;
  }

  const payload = `${encodedSessionId}.${encodedExpiresAt}`;
  const expected = await signValue(payload, secret);

  if (expected !== signature) {
    return null;
  }

  let sessionId: string;
  let expiresAt: string;

  try {
    sessionId = fromBase64Url(encodedSessionId);
    expiresAt = fromBase64Url(encodedExpiresAt);
  } catch {
    return null;
  }

  if (new Date(expiresAt).getTime() <= Date.now()) {
    return null;
  }

  return { sessionId, expiresAt } satisfies ParsedCookie;
}

export function hasSessionCookie(cookieStore: { get: (name: string) => { value: string } | undefined }) {
  return Boolean(cookieStore.get(AUTH_COOKIE_NAME)?.value);
}
