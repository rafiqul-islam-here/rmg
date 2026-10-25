"use client";

import { useI18n } from "@/lib/i18n";
import { formatDayTime } from "@/lib/format";
import { isActiveState, STAGE_KEYS, STAGE_LABEL, stageStatus } from "@/lib/stages";
import type { Order } from "@/lib/types";
import { cn } from "@/lib/utils";
import { TONE } from "./status-badge";
import { STAGE_ICON } from "./stage-icon";

/**
 * Stage stepper — Fabric → Cutting → Print → Emb → Sewing → GPQ.
 * Each dot = status color + icon; the current stage is larger with a blue ring.
 * Stages the order skips show a dashed outline and "Not needed". Vertical on mobile.
 */
export function StageStepper({ order, className }: { order: Order; className?: string }) {
  const { t } = useI18n();
  return (
    <ol className={cn("flex flex-col gap-0 md:flex-row md:items-start", className)} aria-label="Production stages">
      {STAGE_KEYS.map((key, i) => {
        const rec = order.stages[key];
        const status = stageStatus(rec);
        const current = isActiveState(rec.state);
        const skipped = rec.state === "skipped";
        const notReached = rec.state === "not_reached";
        const Icon = current || rec.state === "done" ? TONE[status.tone].icon : STAGE_ICON[key];
        const when = rec.doneAt ?? rec.arrivedAt;
        return (
          <li key={key} className="relative flex min-w-0 flex-1 gap-3 pb-5 last:pb-0 md:flex-col md:items-center md:gap-2 md:pb-0 md:text-center">
            {/* connector */}
            {i < STAGE_KEYS.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  "absolute bg-border",
                  "top-10 bottom-0 left-[19px] w-0.5 md:top-5 md:right-[-50%] md:bottom-auto md:left-[50%] md:h-0.5 md:w-auto",
                  rec.state === "done" && "bg-success",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border-2",
                skipped && "border-dashed border-input bg-surface text-muted-foreground",
                notReached && "border-border bg-surface text-muted-foreground",
                !skipped && !notReached && cn("border-transparent", TONE[status.tone].className),
                current && "ring-4 ring-primary/25 outline-2 outline-primary md:size-11",
              )}
            >
              <Icon className="size-5" aria-hidden strokeWidth={1.75} />
            </span>
            <div className="min-w-0 pt-1 md:pt-0">
              <p className={cn("text-sm font-semibold", current ? "text-primary" : "text-ink", skipped && "text-muted-foreground")}>
                {t(STAGE_LABEL[key])}
              </p>
              <p className="text-xs text-muted-foreground">
                {skipped ? t("Not needed") : notReached ? t("Pending") : t(status.label)}
              </p>
              {when && !skipped && !notReached && (
                <p className="tabular text-xs text-muted-foreground">{formatDayTime(when)}</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
