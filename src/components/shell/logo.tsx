import Image from "next/image";
import { cn } from "@/lib/utils";

/** Brand mark on a white tile + wordmark. `onDark` for the navy sidebar; `subtitle` shows the company name. */
export function Logo({ collapsed = false, onDark = false, subtitle = "Garments Ops", className }: { collapsed?: boolean; onDark?: boolean; subtitle?: string; className?: string }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-3", className)}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white p-1">
        <Image src="/brand/threadflow-mark.png" alt="" width={32} height={32} priority />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className={cn("block text-lg font-bold tracking-tight", onDark ? "text-white" : "text-navy")}>
            Thread<span className={onDark ? "text-[#5FA8FF]" : "text-primary"}>Flow</span>
          </span>
          <span className={cn("block max-w-40 truncate text-xs", onDark ? "text-white/70" : "text-muted-foreground")} title={subtitle}>
            {subtitle}
          </span>
        </span>
      )}
      <span className="sr-only">ThreadFlow</span>
    </span>
  );
}
