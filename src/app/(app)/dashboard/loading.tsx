import { Skel } from "@/components/tf/states";

export default function Loading() {
  return (
    <div className="space-y-6" aria-busy>
      <Skel className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skel key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skel className="h-80 rounded-xl" />
    </div>
  );
}
