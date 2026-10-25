"use client";

import Link from "next/link";
import { CalendarClock, ClipboardList, Factory, MessageSquare, SquarePen } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { formatCardTime } from "@/lib/format";
import {
  isActiveState,
  isAtRisk,
  sewingUnitParts,
  maxWaitingDays,
  orderStatus,
  orderTitle,
  progressOf,
  statusInStage,
  timelineRows,
  waitingDays,
  WAITING_ALERT_DAYS,
} from "@/lib/stages";
import type { Order, StageKey, StatusTone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { OrderThumb } from "./order-thumb";
import { ProgressBar } from "./progress-bar";
import { EmbellishmentTag, StatusBadge, WaitingTag } from "./status-badge";

/**
 * Order card — used on the Orders board, department queues and My Work.
 * Top: photo + created time/by. Then "ORDER [colors]", buyer, status.
 * Timeline rows only appear when they have a value.
 */
export function OrderCard({
  order,
  stage,
  href,
  onOpen,
  action,
  compact = false,
  selected = false,
  now,
}: {
  order: Order;
  /** When shown in a department queue: status and waiting time are for this stage. */
  stage?: StageKey;
  href?: string;
  onOpen?: () => void;
  /** One big contextual button (queue cards). */
  action?: React.ReactNode;
  compact?: boolean;
  selected?: boolean;
  now?: number;
}) {
  const { t } = useI18n();
  const status = stage ? statusInStage(order, stage) : orderStatus(order);
  const days = stage ? waitingDays(order.stages[stage], now) : maxWaitingDays(order, now);
  const blocked = status.tone === "blocked";
  const late = blocked || (stage ? days > WAITING_ALERT_DAYS : isAtRisk(order, now));
  // "Created" is already in the card header, so the timeline starts at the first hand-off.
  const rows = timelineRows(order).filter((r) => r.key !== "created");
  const progress = progressOf(order);
  const problem = stage ? order.stages[stage].problem : undefined;
  // Sewing cards always carry the unit working on the order (highlighted).
  const sewing = order.stages.sewing;
  const unit = sewing.sewingUnit && (stage === "sewing" || (!stage && isActiveState(sewing.state))) ? sewingUnitParts(sewing.sewingUnit) : null;

  const titleText = orderTitle(order);
  const stretched =
    "text-left font-semibold text-ink outline-none after:absolute after:inset-0 after:rounded-xl after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-primary";
  const title = href ? (
    <Link href={href} className={stretched}>
      {titleText}
    </Link>
  ) : onOpen ? (
    <button type="button" onClick={onOpen} className={stretched}>
      {titleText}
    </button>
  ) : (
    <span className="font-semibold text-ink">{titleText}</span>
  );

  if (stage === "ppm") {
    return <PpmCard order={order} title={title} status={status} action={action} selected={selected} late={late} days={days} clickable={!!(href || onOpen)} />;
  }

  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors duration-150",
        (href || onOpen) && "hover:border-primary/60",
        selected && "border-primary ring-1 ring-primary",
        late && "border-l-[3px] border-l-danger",
      )}
    >
      <header className="flex items-start gap-3">
        <OrderThumb order={order} size={compact ? 44 : 56} />
        <div className="min-w-0 flex-1">
          <p className="tabular text-xs text-muted-foreground">
            <span className="font-medium text-ink">Created:</span> {formatCardTime(order.createdAt)}
          </p>
          <p className="truncate text-xs text-muted-foreground" title={order.createdBy.email}>
            {order.createdBy.email}
          </p>
        </div>
        {order.commentCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" title={`${order.commentCount} comments`}>
            <MessageSquare className="size-3.5" aria-hidden />
            <span className="tabular">{order.commentCount}</span>
            <span className="sr-only">comments</span>
          </span>
        )}
      </header>

      <div className="min-w-0">
        <h3 className="text-[15px] leading-6 break-words">{title}</h3>
        <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
          {t("Buyer")}: <span className="text-ink">{order.buyer.name}</span>
        </p>
      </div>

      {unit && <UnitBadge value={order.stages.sewing.sewingUnit!} />}

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={status.tone} label={status.label} size="sm" />
        <WaitingTag days={days} />
        {order.embellishment !== "none" && !compact && (
          <EmbellishmentTag value={order.embellishment} ignored={order.ignoreEmbellishment} />
        )}
      </div>

      {problem && (
        <p className="rounded-lg bg-st-blocked-bg px-3 py-2 text-[13px] text-st-blocked">
          <span className="font-semibold">Problem:</span> {problem}
          {order.stages[stage!].comment ? ` — ${order.stages[stage!].comment}` : ""}
        </p>
      )}

      {rows.length > 0 && (
        <dl className={cn("grid gap-1 border-t border-border pt-3", compact ? "text-xs" : "text-[13px]")}>
          {rows.map((r) => (
            <div key={r.key} className="flex items-baseline justify-between gap-3">
              <dt className="text-muted-foreground">{r.label}</dt>
              <dd className="tabular text-right font-medium text-ink">
                {formatCardTime(r.at)}
                {/* The unit already has its own highlighted badge on Sewing cards. */}
                {r.detail && !(unit && r.key === "sewing") && <span className="block text-xs font-normal text-muted-foreground">{r.detail}</span>}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {!stage && !compact && (
        <ProgressBar
          value={progress.percent}
          tone={progress.percent === 100 ? "complete" : blocked ? "blocked" : "normal"}
          label={`${progress.done}/${progress.total}`}
        />
      )}

      {action ? (
        <div className="relative z-10 mt-auto pt-1">{action}</div>
      ) : (href || onOpen) ? (
        <SquarePen className="mt-auto ml-auto size-4 text-muted-foreground group-hover:text-primary" aria-hidden />
      ) : null}
    </article>
  );
}

export function OrderCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4" aria-hidden>
      <div className="flex gap-3">
        <div className="size-14 animate-pulse rounded-lg bg-muted" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
      </div>
      <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-6 w-28 animate-pulse rounded-full bg-muted" />
      <div className="space-y-2 border-t border-border pt-3">
        <div className="h-3 animate-pulse rounded bg-muted" />
        <div className="h-3 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}

/** Highlighted sewing unit, e.g. "UNIT 2 · Lines 05–08". */
export function UnitBadge({ value }: { value: string }) {
  const unit = sewingUnitParts(value);
  return (
    <p className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-soft px-3 py-2 text-primary" aria-label={`Sewing ${unit.unit}, ${unit.lines}`}>
      <Factory className="size-4 shrink-0" aria-hidden />
      <span className="text-base leading-6 font-bold tracking-wide uppercase">{unit.unit}</span>
      {unit.lines && <span className="text-[13px] font-medium text-primary/80">· {unit.lines}</span>}
    </p>
  );
}

/**
 * PPM queue card — in the order the client asked for:
 * 1. Image · 2. Order number · 3. Buyer · 4. Unit · 5. PPM time (set by GPQ).
 */
function PpmCard({
  order,
  title,
  status,
  action,
  selected,
  late,
  days,
  clickable,
}: {
  order: Order;
  title: React.ReactNode;
  status: { tone: StatusTone; label: string };
  action?: React.ReactNode;
  selected: boolean;
  late: boolean;
  days: number;
  clickable: boolean;
}) {
  const { t } = useI18n();
  const unit = order.stages.sewing.sewingUnit;
  const meeting = order.ppMeeting;
  const findings = meeting?.findings.length ?? 0;
  return (
    <article
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 transition-colors duration-150",
        clickable && "hover:border-primary/60",
        selected && "border-primary ring-1 ring-primary",
        late && "border-l-[3px] border-l-danger",
      )}
    >
      {/* 1. Image */}
      <OrderThumb order={order} size={72} />
      {/* 2. Order number */}
      <h3 className="text-[15px] leading-6 break-words">{title}</h3>
      {/* 3. Buyer */}
      <p className="-mt-2 truncate text-[13px] text-muted-foreground">
        {t("Buyer")}: <span className="text-ink">{order.buyer.name}</span>
      </p>
      {/* 4. Unit */}
      {unit && <UnitBadge value={unit} />}
      {/* 5. PPM time */}
      {meeting && (
        <p className="flex items-center gap-2 text-sm text-ink">
          <CalendarClock className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="text-muted-foreground">PPM time:</span>
          <b className="tabular">{formatCardTime(meeting.ppmAt)}</b>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone={status.tone} label={status.label} size="sm" />
        <WaitingTag days={days} />
        {findings > 0 && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full border border-border px-2 text-xs text-st-pending">
            <ClipboardList className="size-3.5" aria-hidden /> {findings} finding{findings === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {action && <div className="relative z-10 mt-auto pt-1">{action}</div>}
    </article>
  );
}
