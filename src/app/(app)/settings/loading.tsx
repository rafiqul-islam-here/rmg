import { Skel } from "@/components/tf/states";

export default function Loading() {
  return (
    <div className="space-y-4" aria-busy>
      <Skel className="h-12 w-48" />
      <Skel className="h-11 w-full max-w-2xl" />
      <Skel className="h-96 rounded-xl" />
    </div>
  );
}
