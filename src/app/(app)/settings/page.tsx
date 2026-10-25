import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skel } from "@/components/tf/states";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";
import { SettingsView } from "./settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (user && !can.viewSettings(user)) redirect("/");
  return (
    <Suspense fallback={<Skel className="h-[600px] rounded-xl" />}>
      <SettingsView />
    </Suspense>
  );
}
