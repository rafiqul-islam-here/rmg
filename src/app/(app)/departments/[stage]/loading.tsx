import { OrderCardSkeleton } from "@/components/tf/order-card";
import { Skel } from "@/components/tf/states";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy>
      <Skel className="h-14 w-72" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skel key={i} className="h-20 w-40 shrink-0 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <OrderCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
