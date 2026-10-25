import type { Metadata } from "next";
import { Suspense } from "react";
import { OrdersView } from "./orders-view";
import OrdersLoading from "./loading";

export const metadata: Metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersLoading />}>
      <OrdersView />
    </Suspense>
  );
}
