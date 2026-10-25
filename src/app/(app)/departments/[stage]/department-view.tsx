"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CircleCheck, Plus, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FilterBar } from "@/components/tf/filter-bar";
import { OrderCard, OrderCardSkeleton } from "@/components/tf/order-card";
import { OrderWorkDrawer } from "@/components/tf/order-work-drawer";
import { PageHeader } from "@/components/tf/page";
import { QueueAction } from "@/components/tf/queue-action";
import { useSession } from "@/components/tf/session";
import { STAGE_ICON } from "@/components/tf/stage-icon";
import { EmptyState, ErrorState } from "@/components/tf/states";
import { TONE } from "@/components/tf/status-badge";
import { useBuyers, useOrders, useUsers } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { EMBELLISHMENT_LABEL, SEWING_UNITS, STAGE_KEYS, STAGE_LABEL, waitingDays } from "@/lib/stages";
import type { Order, StageKey, StatusTone } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useNow } from "@/hooks/use-now";

type Filter = "all" | "waiting" | "in_progress" | "blocked" | "done";

const TILES: { value: Exclude<Filter, "all">; label: string; tone: StatusTone; text: string }[] = [
  { value: "waiting", label: "Ready", tone: "ready", text: "text-st-ready" },
  { value: "in_progress", label: "In progress", tone: "progress", text: "text-st-progress" },
  { value: "blocked", label: "Blocked", tone: "blocked", text: "text-st-blocked" },
  { value: "done", label: "Done today", tone: "done", text: "text-st-done" },
];

/** The PPM queue uses meeting words for the same four tiles. */
const PPM_TILE_LABEL: Record<Exclude<Filter, "all">, string> = {
  waiting: "Waiting for PPM",
  in_progress: "In progress",
  blocked: "Blocked",
  done: "Completed today",
};

/** Department workspace — one focused queue, built tablet-first for the floor. */
export function DepartmentView({ stage }: { stage: StageKey }) {
  const user = useSession();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const now = useNow(60_000);

  const filter = (sp.get("show") as Filter) || "all";
  // Set after creating an order: the new card is highlighted in the Fabric tab.
  const highlight = sp.get("highlight");
  const setFilter = (f: Filter) => router.replace(f === "all" || f === filter ? pathname : `${pathname}?show=${f}`, { scroll: false });

  const [q, setQ] = useState("");
  const [buyer, setBuyer] = useState("");
  const [emb, setEmb] = useState("");
  const [unit, setUnit] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const queue = useOrders({ stage });
  const doneToday = useOrders({ stage, scope: "done_today" });
  const buyers = useBuyers();
  const users = useUsers();

  const supervisor = users.data?.items.find((u) => u.role === "supervisor" && u.departments.includes(stage));
  const Icon: LucideIcon = STAGE_ICON[stage];
  const label = t(STAGE_LABEL[stage]);

  const counts = useMemo(() => {
    const items = queue.data?.items ?? [];
    return {
      waiting: items.filter((o) => o.stages[stage].state === "waiting").length,
      in_progress: items.filter((o) => o.stages[stage].state === "in_progress").length,
      blocked: items.filter((o) => o.stages[stage].state === "blocked").length,
      done: doneToday.data?.items.length ?? 0,
    };
  }, [queue.data, doneToday.data, stage]);

  const list = useMemo(() => {
    const source = filter === "done" ? (doneToday.data?.items ?? []) : (queue.data?.items ?? []);
    const needle = q.trim().toLowerCase();
    return source
      .filter((o) => filter === "all" || filter === "done" || o.stages[stage].state === filter)
      .filter((o) => !buyer || o.buyer.id === buyer)
      .filter((o) => !emb || o.embellishment === emb)
      .filter((o) => !unit || o.stages.sewing.sewingUnit === unit)
      .filter((o) => !needle || [o.orderNumber, o.buyer.name, ...o.colors].some((v) => v.toLowerCase().includes(needle)))
      // PPM queue: soonest PPM time first. Other queues: blocked first, then longest waiting.
      .sort((a, b) =>
        stage === "ppm" && a.ppMeeting && b.ppMeeting
          ? a.ppMeeting.ppmAt.localeCompare(b.ppMeeting.ppmAt)
          : rank(a, stage, now) - rank(b, stage, now),
      );
  }, [filter, queue.data, doneToday.data, q, buyer, emb, unit, stage, now]);

  const source = filter === "done" ? doneToday : queue;

  useEffect(() => {
    if (highlight && list.some((o) => o.id === highlight)) {
      document.getElementById(`order-${highlight}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [highlight, list]);
  const filtered = Boolean(q || buyer || emb || unit || filter !== "all");

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Icon}
        title={label}
        subtitle={
          <>
            {supervisor ? `Supervisor: ${supervisor.name}` : "Department queue"} · Shift A ·{" "}
            <span className="tabular font-semibold text-ink">{counts.done}</span> moved on today
          </>
        }
        actions={
          <>
            {/* Tablet rail and mobile have no department sub-list, so switch here. */}
            <Select value={stage} onValueChange={(v) => router.push(`/departments/${v}`)}>
              <SelectTrigger className="w-44 xl:hidden" aria-label="Switch department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGE_KEYS.map((k) => (
                  <SelectItem key={k} value={k}>
                    {t(STAGE_LABEL[k])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stage === "fabric" && can.createOrder(user) && (
              <Button asChild>
                <Link href="/orders/new">
                  <Plus /> {t("New order")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      {/* Count tiles — tappable filters. Scroll sideways on mobile. */}
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:px-0">
        {TILES.map((tile) => {
          const active = filter === tile.value;
          const ToneIcon = TONE[tile.tone].icon;
          const n = counts[tile.value];
          return (
            <button
              key={tile.value}
              type="button"
              onClick={() => setFilter(tile.value)}
              aria-pressed={active}
              className={cn(
                "flex min-w-36 shrink-0 flex-col gap-1 rounded-xl border bg-surface p-4 text-left transition-colors duration-150",
                active ? "border-primary bg-primary-soft ring-1 ring-primary" : "border-border hover:border-primary/50",
              )}
            >
              <span className={cn("flex items-center gap-1.5 text-[13px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <ToneIcon className={cn("size-4", !active && tile.text)} aria-hidden />
                {t(stage === "ppm" ? PPM_TILE_LABEL[tile.value] : tile.label)}
              </span>
              <span className={cn("tabular text-[30px] leading-9 font-bold", tile.value === "blocked" && n > 0 ? "text-st-blocked" : "text-ink")}>
                {queue.isLoading && !queue.data ? "–" : n}
              </span>
            </button>
          );
        })}
      </div>

      <FilterBar
        search={q}
        onSearch={setQ}
        searchPlaceholder="Search order number, buyer, color…"
        filters={[
          { key: "buyer", label: "Buyers", value: buyer, onChange: setBuyer, options: (buyers.data?.items ?? []).map((b) => ({ value: b.id, label: b.name })) },
          ...(stage === "cutting" || stage === "fabric" || stage === "ppm"
            ? [{ key: "emb", label: "Embellishments", value: emb, onChange: setEmb, options: (["none", "print", "emb", "print_emb"] as const).map((k) => ({ value: k, label: EMBELLISHMENT_LABEL[k] })) }]
            : []),
          ...(stage === "sewing"
            ? [{ key: "unit", label: "Units", value: unit, onChange: setUnit, options: SEWING_UNITS.map((u) => ({ value: u, label: u.replace(/^Sewing /, "") })) }]
            : []),
        ]}
        trailing={
          filter !== "all" && (
            <button type="button" onClick={() => setFilter("all")} className="min-h-11 text-sm font-medium text-primary hover:underline xl:min-h-10">
              Show whole queue
            </button>
          )
        }
      />

      {source.error ? (
        <ErrorState error={source.error} title={`Couldn't load the ${label} queue.`} onRetry={() => source.mutate()} />
      ) : source.isLoading && !source.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={CircleCheck}
            title={filtered ? "No orders match these filters." : `No pending work in ${label}.`}
            action={
              filtered ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setBuyer("");
                    setEmb("");
                    setUnit("");
                    setFilter("all");
                  }}
                >
                  {t("Clear filters")}
                </Button>
              ) : (
                <Button asChild variant="secondary">
                  <Link href="/orders">View all orders</Link>
                </Button>
              )
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((o) => (
            <li key={o.id} id={`order-${o.id}`} className="flex scroll-mt-24">
              <div className="w-full">
                <OrderCard
                  order={o}
                  stage={stage}
                  now={now}
                  selected={o.id === highlight}
                  onOpen={() => setOpen(o.id)}
                  action={filter !== "done" && <QueueAction order={o} stage={stage} onOpen={() => setOpen(o.id)} />}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <OrderWorkDrawer orderId={open} stage={stage} onClose={() => setOpen(null)} />
    </div>
  );
}

/** Queue order: blocked first, then whatever has waited longest. */
function rank(o: Order, stage: StageKey, now: number) {
  const rec = o.stages[stage];
  const blocked = rec.state === "blocked" ? -10_000 : 0;
  return blocked - waitingDays(rec, now) * 100 - (rec.arrivedAt ? (now - new Date(rec.arrivedAt).getTime()) / 3_600_000 : 0);
}
