import "server-only";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import type { SessionUser } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/** Signed-in user for server components. Uses the NestJS API when configured, else the mock store. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session) return null;

  if (API_BASE) {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { cookie: `${SESSION_COOKIE}=${session}` },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as SessionUser) : null;
  }

  const { db, sessionUser } = await import("@/lib/mock/store");
  const user = db().users.find((u) => u.id === session && u.active);
  return user ? sessionUser(user) : null;
}
