import { Skel } from "@/components/tf/states";

export default function OrdersLoading() {
  return (
    <div className="space-y-4" aria-busy>
      <Skel className="h-12 w-60" />
      <Skel className="h-11 w-full max-w-xl" />
      <Skel className="h-20 rounded-xl" />
      <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skel key={i} className="h-12" />
        ))}
      </div>
    </div>
  );
}
