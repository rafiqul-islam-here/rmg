import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api/server";
import { homePathFor } from "@/lib/permissions";
import { COMPANY_COOKIE } from "@/lib/session";
import { LoginForm, type DemoLogin } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

/** Demo accounts are only offered while the built-in mock API is in use. */
async function demoLogin(): Promise<DemoLogin | undefined> {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return undefined;
  const { db } = await import("@/lib/mock/store");
  const { SEED_PASSWORD } = await import("@/lib/mock/seed");
  return {
    company: db().factory.name,
    password: SEED_PASSWORD,
    accounts: [
      { username: "tanvir.hasan", role: "Merchandiser", lands: "Dashboard" },
      { username: "rahim.ahmed", role: "Manager", lands: "Dashboard" },
      { username: "farhan.kabir", role: "Supervisor", lands: "Cutting floor" },
    ],
  };
}

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homePathFor(user));
  const remembered = (await cookies()).get(COMPANY_COOKIE)?.value;
  return <LoginForm demo={await demoLogin()} initialCompany={remembered ? decodeURIComponent(remembered) : ""} />;
}
