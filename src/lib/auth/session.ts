import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { AUTH_COOKIE_NAME } from "@/lib/auth/constants";
import { createSignedCookieValue, verifySignedCookieValue } from "@/lib/auth/edge";
import { getEnv } from "@/lib/utils/env";

function sha256(input: string) {
  return createHash("sha256").update(input).digest("hex");
}

function comparePasswords(input: string, expected: string) {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

function getSessionMaxAgeMs() {
  const days = Number(process.env.SESSION_MAX_AGE_DAYS ?? "14");
  return Math.max(1, days) * 24 * 60 * 60 * 1000;
}

async function getCookiePayload() {
  const cookieStore = await cookies();
  const rawValue = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const secret = getEnv("SESSION_SECRET");
  return verifySignedCookieValue(rawValue, secret);
}

export async function getCurrentSession() {
  const payload = await getCookiePayload();

  if (!payload) {
    return null;
  }

  const session = await prisma.userSession.findUnique({
    where: { tokenHash: sha256(payload.sessionId) }
  });

  if (!session || session.revokedAt || session.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    sessionId: payload.sessionId,
    session
  };
}

export async function requireAuth() {
  const current = await getCurrentSession();

  if (!current) {
    redirect("/login");
  }

  return current;
}

export async function createSession(params: { password: string; ip?: string | null; userAgent?: string | null }) {
  const expectedPassword = getEnv("SITE_ACCESS_PASSWORD");

  if (!comparePasswords(params.password, expectedPassword)) {
    return { ok: false as const, message: "访问密码错误，请重试。" };
  }

  const sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + getSessionMaxAgeMs());

  await prisma.userSession.create({
    data: {
      tokenHash: sha256(sessionId),
      ip: params.ip ?? null,
      userAgent: params.userAgent ?? null,
      expiresAt
    }
  });

  const cookieStore = await cookies();
  const cookieValue = await createSignedCookieValue(
    sessionId,
    expiresAt.toISOString(),
    getEnv("SESSION_SECRET")
  );

  cookieStore.set(AUTH_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt
  });

  return { ok: true as const };
}

export async function destroySession() {
  const payload = await getCookiePayload();

  if (payload) {
    await prisma.userSession.updateMany({
      where: { tokenHash: sha256(payload.sessionId), revokedAt: null },
      data: { revokedAt: new Date() }
    });
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function isAuthenticated() {
  return Boolean(await getCurrentSession());
}

export async function ensureAuthenticatedApi() {
  const session = await getCurrentSession();
  return session;
}
