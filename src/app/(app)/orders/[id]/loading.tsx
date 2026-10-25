import { Skel } from "@/components/tf/states";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy>
      <Skel className="h-16 w-80" />
      <Skel className="h-40 rounded-xl" />
      <Skel className="h-28 rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Skel className="h-96 rounded-xl xl:col-span-2" />
        <Skel className="h-96 rounded-xl" />
      </div>
    </div>
  );
}
