import { cn } from "@/lib/utils";

/** Progress bar — 8px, gray track, number always shown (UI guideline §5). */
export function ProgressBar({
  value,
  tone = "normal",
  label,
  className,
}: {
  value: number;
  tone?: "normal" | "complete" | "risk" | "blocked";
  /** Text to the right; defaults to "62%". */
  label?: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const fill = {
    normal: "bg-primary",
    complete: "bg-success",
    risk: "bg-warning",
    blocked:
      "bg-danger bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgba(255,255,255,0.35)_6px_12px)]",
  }[tone];
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={cn("h-full rounded-full transition-[width] duration-200", fill)} style={{ width: `${pct}%` }} />
      </div>
      <span className="tabular shrink-0 text-xs font-semibold text-ink">{label ?? `${pct}%`}</span>
    </div>
  );
}
