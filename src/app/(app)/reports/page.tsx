import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skel } from "@/components/tf/states";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";
import { ReportsView } from "./reports-view";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (user && !can.viewReports(user)) redirect("/my-work");
  return (
    <Suspense fallback={<Skel className="h-[600px] rounded-xl" />}>
      <ReportsView />
    </Suspense>
  );
}
