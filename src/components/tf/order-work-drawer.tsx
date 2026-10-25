"use client";

import Link from "next/link";
import { CalendarClock, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrder, useOrderActivity } from "@/lib/api/hooks";
import { formatCardTime, formatDateTime, formatStamp } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { EMBELLISHMENT_LABEL, STAGE_LABEL, statusInStage, timelineRows, type TimelineRow } from "@/lib/stages";
import type { Order, StageKey } from "@/lib/types";
import { ActivityFeed, CommentBox } from "./comments";
import { Drawer } from "./drawer";
import { UnitBadge } from "./order-card";
import { OrderThumb } from "./order-thumb";
import { StageActionPanel } from "./stage-actions";
import { ErrorState, Skel } from "./states";
import { StatusBadge } from "./status-badge";

/**
 * Card tap → this drawer. Shows the "New order entry form" data, what earlier departments
 * recorded, the action form for this department, and comments.
 */
export function OrderWorkDrawer({
  orderId,
  stage,
  onClose,
}: {
  orderId: string | null;
  stage: StageKey;
  onClose: () => void;
}) {
  const { data: order, error, isLoading, mutate } = useOrder(orderId);
  const activity = useOrderActivity(orderId);
  const { t } = useI18n();
  const status = order ? statusInStage(order, stage) : null;

  return (
    <Drawer
      open={!!orderId}
      onOpenChange={(o) => !o && onClose()}
      eyebrow={stage === "cutting" ? "Cutting dispatch" : stage === "ppm" ? "PP Meeting" : `${t(STAGE_LABEL[stage])} update`}
      title={order ? (stage === "ppm" ? order.orderNumber : `${STAGE_LABEL[stage]} Processing: ${order.orderNumber}`) : "Order"}
      description={
        order && stage === "ppm" && order.ppMeeting ? (
          // PPM time is the main heading, right under the order number.
          <span className="mt-1 flex items-center gap-2 text-xl leading-7 font-semibold text-primary">
            <CalendarClock className="size-5 shrink-0" aria-hidden />
            <span>
              PPM time: <span className="tabular">{formatDateTime(order.ppMeeting.ppmAt)}</span>
            </span>
          </span>
        ) : order ? (
          `${order.buyer.name} · ${order.colors.join(", ")}`
        ) : undefined
      }
    >
      {error ? (
        <ErrorState error={error} title="Couldn't load this order." onRetry={() => mutate()} />
      ) : !order || (isLoading && !order) ? (
        <div className="space-y-3" aria-busy>
          <Skel className="h-32" />
          <Skel className="h-48" />
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="flex flex-wrap items-center gap-2">
            {status && <StatusBadge tone={status.tone} label={status.label} />}
            <Button asChild variant="link" size="sm" className="ml-auto">
              <Link href={`/orders/${order.id}`}>
                Open full order <ExternalLink className="size-3.5" />
              </Link>
            </Button>
          </div>

          {stage === "ppm" && <PpmCardFacts order={order} />}
          <OrderFacts order={order} />
          {stage === "ppm" && <ProductionHistory order={order} />}

          <section aria-labelledby="action-h">
            {/* Cutting's route line already names the section (see the drawer title). */}
            <h3 id="action-h" className={stage === "cutting" ? "sr-only" : "mb-3 text-xs font-semibold tracking-wider text-muted-foreground uppercase"}>
              {stage === "cutting" ? "Cutting dispatch" : stage === "ppm" ? "PP Meeting" : `${STAGE_LABEL[stage]} action`}
            </h3>
            {/* Hand-offs close the drawer; Start / Resume keep it open so the next step is right there. */}
            <StageActionPanel order={order} stage={stage} sticky onDone={onClose} />
          </section>

          <section aria-labelledby="comments-h" className="grid gap-3">
            <h3 id="comments-h" className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("Comments & activity")}
            </h3>
            <CommentBox orderId={order.id} orderNumber={order.orderNumber} />
            <ActivityFeed
              items={activity.data?.items}
              isLoading={activity.isLoading}
              error={activity.error}
              onRetry={() => activity.mutate()}
              limit={3}
            />
          </section>
        </div>
      )}
    </Drawer>
  );
}

/**
 * Data from the New order entry form plus what Fabric recorded, laid out like the
 * "Cutting Processing" screen in the UI documentation.
 */
export function OrderFacts({ order }: { order: Order }) {
  const fabric = order.stages.fabric;
  const fabricStatus =
    fabric.state === "done" ? (
      <span className="font-semibold text-st-done">Fabric delivered</span>
    ) : fabric.state === "blocked" ? (
      <span className="font-semibold text-st-blocked">Fabric not found</span>
    ) : (
      <span className="text-muted-foreground">Waiting for fabric</span>
    );
  const cells: [string, React.ReactNode][] = [
    ["Buyer", <span key="b" className="font-semibold text-primary">{order.buyer.name}</span>],
    ["Order Number", order.orderNumber],
    ["Created Time", formatStamp(order.createdAt)],
    ["Embellishment", <span key="e" className="font-semibold text-primary">{EMBELLISHMENT_LABEL[order.embellishment]}{order.ignoreEmbellishment && " (ignored)"}</span>],
    ["Fabric Status", fabricStatus],
    ["Fabric Delivered Time", fabric.state === "done" && fabric.actionAt ? formatStamp(fabric.actionAt) : "—"],
  ];
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <div className="flex gap-4">
        <OrderThumb order={order} size={72} className="hidden sm:block" />
        <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm md:grid-cols-3">
          {cells.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{k}:</dt>
              <dd className="tabular font-medium break-words text-ink">{v}</dd>
            </div>
          ))}
          <div className="col-span-2 min-w-0 md:col-span-3">
            <dt className="text-xs text-muted-foreground">Colors:</dt>
            <dd className="font-medium text-ink">
              {order.colors.map((c, i) => `${String.fromCharCode(97 + i)}) ${c}`).join(", ")}
            </dd>
          </div>
          {order.comments && (
            <div className="col-span-2 min-w-0 md:col-span-3">
              <dt className="text-xs text-muted-foreground">Comments / Special Instructions:</dt>
              <dd className="text-ink italic">{order.comments}</dd>
            </div>
          )}
          {fabric.comment && (
            <div className="col-span-2 min-w-0 md:col-span-3">
              <dt className="text-xs text-muted-foreground">Fabric Comments:</dt>
              <dd className="text-ink italic">{fabric.comment}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

/** PPM drawer: the card's sequence first — Image, Order number, Buyer, Unit, PPM time. */
function PpmCardFacts({ order }: { order: Order }) {
  return (
    <div className="flex gap-4 rounded-lg border border-primary/30 bg-surface p-4">
      <OrderThumb order={order} size={88} />
      <dl className="grid min-w-0 flex-1 gap-2 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Order number</dt>
          <dd className="font-semibold text-ink">{order.orderNumber}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Buyer</dt>
          <dd className="font-semibold text-primary">{order.buyer.name}</dd>
        </div>
        {order.stages.sewing.sewingUnit && (
          <div>
            <dt className="mb-1 text-xs text-muted-foreground">Unit</dt>
            <dd>
              <UnitBadge value={order.stages.sewing.sewingUnit} />
            </dd>
          </div>
        )}
        {order.ppMeeting && (
          <div>
            <dt className="text-xs text-muted-foreground">PPM time</dt>
            <dd className="tabular font-semibold text-ink">{formatCardTime(order.ppMeeting.ppmAt)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}

/** Every earlier step with its time — "all the previous data" for the PP Meeting. */
function ProductionHistory({ order }: { order: Order }) {
  const rows = timelineRows(order).filter((r) => r.key !== "ppm");
  const s = order.stages;
  const done = (label: string, at?: string): TimelineRow[] => (at ? [{ key: label, label, at }] : []);
  const extra = [
    ...done("Cutting dispatched", s.cutting.doneAt),
    ...(s.print.state === "done" ? done("Print completed", s.print.doneAt) : []),
    ...(s.emb.state === "done" ? done("EMB completed", s.emb.doneAt) : []),
    ...done("Sewing completed", s.sewing.state === "done" ? s.sewing.doneAt : undefined),
    ...done("GPQ completed", s.gpq.state === "done" ? s.gpq.doneAt : undefined),
  ];
  const all = [...rows, ...extra].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <section aria-labelledby="history-h" className="rounded-lg border border-border bg-background p-4">
      <h3 id="history-h" className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        Production history
      </h3>
      <dl className="grid gap-1.5 text-[13px]">
        {all.map((r) => (
          <div key={`${r.key}-${r.at}`} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="tabular text-right font-medium text-ink">
              {formatCardTime(r.at)}
              {r.detail && <span className="block text-xs font-normal text-muted-foreground">{r.detail}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
