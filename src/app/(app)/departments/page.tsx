import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api/server";

/** /departments → the user's own department, or Fabric for office roles. */
export default async function DepartmentsIndex() {
  const user = await getCurrentUser();
  redirect(`/departments/${user?.departments[0] ?? "fabric"}`);
}
