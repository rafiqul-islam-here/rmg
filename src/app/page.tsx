import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api/server";
import { homePathFor } from "@/lib/permissions";

/** Owners and managers land on Dashboard; supervisors and workers on My Work. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homePathFor(user) : "/login");
}
