import { Skel } from "@/components/tf/states";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy>
      <Skel className="h-12 w-60" />
      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <Skel className="h-72 rounded-xl" />
        <Skel className="h-[480px] rounded-xl" />
      </div>
    </div>
  );
}
