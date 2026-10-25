"use client";

import { cn } from "@/lib/utils";

/**
 * Underlined tab row with optional counts. Scrolls sideways on small screens.
 * `variant="pill"` gives the large segmented tabs used on My Work.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  variant = "line",
  className,
}: {
  tabs: { value: T; label: string; count?: number; icon?: React.ComponentType<{ className?: string }> }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  variant?: "line" | "pill";
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex",
        variant === "line"
          ? "gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]"
          : "gap-1 rounded-xl border border-border bg-surface p-1",
        className,
      )}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        const Icon = t.icon;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "flex min-h-11 items-center justify-center gap-2 text-sm font-semibold transition-colors duration-150",
              variant === "line"
                ? cn("-mb-px shrink-0 border-b-2 px-3 whitespace-nowrap", active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-ink")
                : // Pill tabs share the width and may wrap to 2 lines (Bangla is 30–40% longer).
                  cn("min-w-0 flex-1 flex-wrap rounded-lg px-2 py-1 text-center leading-tight", active ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-background hover:text-ink"),
            )}
          >
            {Icon && <Icon className="size-4" />}
            {t.label}
            {t.count !== undefined && (
              <span
                className={cn(
                  "tabular min-w-6 rounded-full px-1.5 py-0.5 text-xs",
                  active ? "bg-primary text-white" : "bg-muted text-muted-foreground",
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
