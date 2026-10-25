import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";
import { DashboardView } from "./dashboard-view";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (user && !can.viewDashboard(user)) redirect("/my-work");
  return <DashboardView />;
}
