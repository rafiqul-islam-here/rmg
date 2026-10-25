import type { Metadata } from "next";
import { OrderDetailView } from "./order-detail-view";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <OrderDetailView id={decodeURIComponent(id)} />;
}
