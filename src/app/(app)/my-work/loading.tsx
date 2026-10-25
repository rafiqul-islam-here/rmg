import { OrderCardSkeleton } from "@/components/tf/order-card";
import { Skel } from "@/components/tf/states";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy>
      <Skel className="h-24 rounded-xl" />
      <Skel className="h-14 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
