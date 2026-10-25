import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skel } from "@/components/tf/states";
import { getCurrentUser } from "@/lib/api/server";
import { can } from "@/lib/permissions";
import { NewOrderForm } from "./new-order-form";

export const metadata: Metadata = { title: "New order" };

export default async function NewOrderPage() {
  const user = await getCurrentUser();
  if (user && !can.createOrder(user)) redirect("/orders");
  return (
    <Suspense fallback={<Skel className="h-[600px] rounded-xl" />}>
      <NewOrderForm />
    </Suspense>
  );
}
