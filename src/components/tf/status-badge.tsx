"use client";

import {
  CircleCheck,
  CircleDashed,
  CirclePlay,
  Clock,
  Layers,
  Loader,
  OctagonAlert,
  CirclePause,
  Printer,
  RotateCcw,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { EMBELLISHMENT_LABEL, WAITING_ALERT_DAYS } from "@/lib/stages";
import type { Embellishment, StatusTone } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Status = soft background + dark text + icon + word (UI guideline §3.2). Never color alone. */
export const TONE: Record<StatusTone, { icon: LucideIcon; className: string; bar: string }> = {
  pending: { icon: CircleDashed, className: "bg-st-pending-bg text-st-pending", bar: "bg-st-pending" },
  ready: { icon: CirclePlay, className: "bg-st-ready-bg text-st-ready", bar: "bg-st-ready" },
  progress: { icon: Loader, className: "bg-st-progress-bg text-st-progress", bar: "bg-st-progress" },
  hold: { icon: CirclePause, className: "bg-st-hold-bg text-st-hold", bar: "bg-warning" },
  blocked: { icon: OctagonAlert, className: "bg-st-blocked-bg text-st-blocked", bar: "bg-danger" },
  rework: { icon: RotateCcw, className: "bg-st-rework-bg text-st-rework", bar: "bg-st-rework" },
  done: { icon: CircleCheck, className: "bg-st-done-bg text-st-done", bar: "bg-success" },
};

const pill = "inline-flex max-w-full items-center gap-1 rounded-full font-medium whitespace-nowrap";

export function StatusBadge({
  tone,
  label,
  size = "md",
  className,
}: {
  tone: StatusTone;
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const { t } = useI18n();
  const { icon: Icon, className: toneClass } = TONE[tone];
  return (
    <span
      className={cn(
        pill,
        toneClass,
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-xs md:text-[13px]",
        className,
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="truncate">{t(label)}</span>
    </span>
  );
}

/**
 * Time-in-stage flag — not a status. Orders have no due date, so "late" means the order has
 * been in one stage longer than the alert limit. Amber on the limit day, red after, hidden before.
 */
export function WaitingTag({ days, className }: { days: number; className?: string }) {
  if (days < WAITING_ALERT_DAYS) return null;
  const late = days > WAITING_ALERT_DAYS;
  return (
    <span
      className={cn(
        pill,
        "h-6 px-2 text-xs",
        late ? "bg-st-blocked-bg text-st-blocked" : "bg-st-hold-bg text-st-hold",
        className,
      )}
      title={`${days} days in this stage (alert after ${WAITING_ALERT_DAYS} days)`}
    >
      <Clock className="size-3.5" aria-hidden />
      {late ? `Late · ${days}d` : `${days}d in stage`}
    </span>
  );
}

const EMB_ICON: Record<Embellishment, LucideIcon | null> = {
  none: null,
  print: Printer,
  emb: Sparkles,
  print_emb: Layers,
};

/** Neutral chip that names the embellishment route. */
export function EmbellishmentTag({
  value,
  ignored,
  className,
}: {
  value: Embellishment;
  ignored?: boolean;
  className?: string;
}) {
  const Icon = EMB_ICON[value];
  return (
    <span
      className={cn(pill, "h-6 border border-border bg-surface px-2 text-xs text-st-pending", className)}
      title={ignored ? "Embellishment ignored — goes straight to Sewing" : undefined}
    >
      {Icon && <Icon className="size-3.5" aria-hidden />}
      <span className={cn(ignored && "line-through")}>{value === "none" ? "None" : EMBELLISHMENT_LABEL[value]}</span>
      {ignored && <span className="no-underline">· ignored</span>}
    </span>
  );
}
