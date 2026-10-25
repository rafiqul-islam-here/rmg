"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List,
  PackageSearch,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FilterBar } from "@/components/tf/filter-bar";
import { OrderCard, OrderCardSkeleton } from "@/components/tf/order-card";
import { OrderThumb } from "@/components/tf/order-thumb";
import { PageHeader } from "@/components/tf/page";
import { ProgressBar } from "@/components/tf/progress-bar";
import { useSession } from "@/components/tf/session";
import { STAGE_ICON } from "@/components/tf/stage-icon";
import { EmptyState, ErrorState, Skel } from "@/components/tf/states";
import { EmbellishmentTag, StatusBadge, WaitingTag } from "@/components/tf/status-badge";
import { TabBar } from "@/components/tf/tab-bar";
import { useBuyers, useOrders } from "@/lib/api/hooks";
import { formatDate, formatTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import {
  currentStages,
  EMBELLISHMENT_LABEL,
  isAtRisk,
  isCompleted,
  maxWaitingDays,
  orderStatus,
  progressOf,
  STAGE_KEYS,
  STAGE_LABEL,
  WAITING_ALERT_DAYS,
} from "@/lib/stages";
import type { Order, StageKey } from "@/lib/types";
import { cn } from "@/lib/utils";

type Tab = "all" | "active" | "blocked" | "completed";
type View = "list" | "board";
type SortKey = "order" | "buyer" | "created" | "waiting" | "progress";

const PAGE_SIZE = 10;

const STATUS_OPTIONS = [
  { value: "pending", label: "Created" },
  { value: "ready", label: "Ready / sent" },
  { value: "progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Completed" },
];

/** Keeps filters in the URL so lists can be shared and the back button works. */
function useUrlState() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    const s = next.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  };
  return { sp, set };
}

export function OrdersView() {
  const user = useSession();
  const { t } = useI18n();
  const { sp, set } = useUrlState();

  const tab = (sp.get("tab") as Tab) || "all";
  const view = (sp.get("view") as View) || "list";
  const qParam = sp.get("q") ?? "";
  const buyer = sp.get("buyer") ?? "";
  const stage = sp.get("stage") ?? "";
  const embellishment = sp.get("embellishment") ?? "";
  const status = sp.get("status") ?? "";
  const page = Math.max(1, Number(sp.get("page") ?? 1));

  // Search box updates the URL after a short pause; follows the URL when it changes elsewhere (top bar search).
  const [q, setQ] = useState(qParam);
  const [lastParam, setLastParam] = useState(qParam);
  if (qParam !== lastParam) {
    setLastParam(qParam);
    setQ(qParam);
  }
  useEffect(() => {
    if (q === qParam) return;
    const id = setTimeout(() => set({ q: q || null }), 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const { data, error, isLoading, mutate } = useOrders({
    q: qParam || undefined,
    buyer: buyer || undefined,
    stage: (stage || undefined) as StageKey | undefined,
    embellishment: embellishment || undefined,
    status: status || undefined,
  });
  const buyers = useBuyers();

  const all = useMemo(() => data?.items ?? [], [data]);
  const counts = useMemo(
    () => ({
      all: all.length,
      active: all.filter((o) => !isCompleted(o)).length,
      blocked: all.filter((o) => isAtRisk(o)).length,
      completed: all.filter(isCompleted).length,
    }),
    [all],
  );
  const items = useMemo(
    () =>
      all.filter((o) =>
        tab === "active" ? !isCompleted(o) : tab === "blocked" ? isAtRisk(o) : tab === "completed" ? isCompleted(o) : true,
      ),
    [all, tab],
  );

  const filtersActive = Boolean(qParam || buyer || stage || embellishment || status);
  const clear = () => {
    setQ("");
    set({ tab: null, q: null, buyer: null, stage: null, embellishment: null, status: null });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={
          <>
            {t("Orders")}
            {data && <span className="tabular ml-2 text-lg font-medium text-muted-foreground">{counts.all}</span>}
          </>
        }
        subtitle="Every order, from Fabric to GPQ."
        actions={
          <>
            <ViewToggle value={view} onChange={(v) => set({ view: v === "list" ? null : v })} />
            {can.createOrder(user) && (
              <Button asChild>
                <Link href="/orders/new">
                  <Plus /> {t("New order")}
                </Link>
              </Button>
            )}
          </>
        }
      />

      <TabBar<Tab>
        label="Order groups"
        value={tab}
        onChange={(v) => set({ tab: v === "all" ? null : v })}
        tabs={[
          { value: "all", label: "All", count: data ? counts.all : undefined },
          { value: "active", label: "Active", count: data ? counts.active : undefined },
          { value: "blocked", label: "Late & blocked", count: data ? counts.blocked : undefined },
          { value: "completed", label: t("Completed"), count: data ? counts.completed : undefined },
        ]}
      />

      <FilterBar
        search={q}
        onSearch={(v) => {
          setQ(v);
          if (!v) set({ q: null });
        }}
        searchPlaceholder="Search order number, buyer, color…"
        filters={[
          {
            key: "buyer",
            label: "Buyers",
            value: buyer,
            onChange: (v) => set({ buyer: v || null }),
            options: (buyers.data?.items ?? []).map((b) => ({ value: b.id, label: b.name })),
          },
          {
            key: "stage",
            label: "Stages",
            value: stage,
            onChange: (v) => set({ stage: v || null }),
            options: STAGE_KEYS.map((k) => ({ value: k, label: STAGE_LABEL[k] })),
          },
          {
            key: "embellishment",
            label: "Embellishments",
            value: embellishment,
            onChange: (v) => set({ embellishment: v || null }),
            options: (["none", "print", "emb", "print_emb"] as const).map((k) => ({ value: k, label: EMBELLISHMENT_LABEL[k] })),
          },
          {
            key: "status",
            label: "Statuses",
            value: status,
            onChange: (v) => set({ status: v || null }),
            options: STATUS_OPTIONS,
          },
        ]}
      />

      {error ? (
        <ErrorState error={error} title="Couldn't load orders." onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        view === "list" ? <ListSkeleton /> : <BoardSkeleton />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          {filtersActive || tab !== "all" ? (
            <EmptyState
              icon={PackageSearch}
              title="No orders match these filters."
              action={
                <Button variant="secondary" onClick={clear}>
                  {t("Clear filters")}
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={PackageSearch}
              title="No orders yet."
              description="Create your first order. It will start in Fabric and PP Meeting."
              action={
                can.createOrder(user) && (
                  <Button asChild variant="secondary">
                    <Link href="/orders/new">{t("New order")}</Link>
                  </Button>
                )
              }
            />
          )}
        </div>
      ) : view === "list" ? (
        <OrderList items={items} page={page} onPage={(p) => set({ page: p > 1 ? String(p) : null })} />
      ) : (
        <OrderBoard items={items} />
      )}
    </div>
  );
}

function ViewToggle({ value, onChange }: { value: View; onChange: (v: View) => void }) {
  const opts = [
    { value: "list" as const, label: "List", icon: List },
    { value: "board" as const, label: "Board", icon: Columns3 },
  ];
  return (
    <div role="group" aria-label="View" className="flex h-11 rounded-md border border-border bg-surface p-1 xl:h-10">
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1.5 rounded px-3 text-sm font-semibold transition-colors",
            value === o.value ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-ink",
          )}
        >
          <o.icon className="size-4" aria-hidden />
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ list */

function stageText(o: Order) {
  if (isCompleted(o)) return "Completed";
  return currentStages(o).map((k) => STAGE_LABEL[k]).join(" + ");
}

function OrderList({ items, page, onPage }: { items: Order[]; page: number; onPage: (p: number) => void }) {
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "created", dir: "desc" });

  const sorted = useMemo(() => {
    const val = (o: Order): string | number => {
      switch (sort.key) {
        case "order":
          return o.orderNumber.toLowerCase();
        case "buyer":
          return o.buyer.name.toLowerCase();
        case "waiting":
          return maxWaitingDays(o);
        case "progress":
          return progressOf(o).percent;
        default:
          return o.createdAt;
      }
    };
    return [...items].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return sort.dir === "asc" ? c : -c;
    });
  }, [items, sort]);

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const rows = sorted.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  const header = (key: SortKey | null, label: string, className?: string) => (
    <th scope="col" className={cn("h-11 px-3 text-left text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase", className)} aria-sort={key && sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      {key ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 uppercase hover:text-ink"
          onClick={() => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }))}
        >
          {label}
          {sort.key === key ? sort.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" /> : <ArrowUpDown className="size-3.5 opacity-50" />}
        </button>
      ) : (
        label
      )}
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Tablet & desktop: table (scrolls inside its card if needed) */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-surface md:block">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full min-w-[960px] border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface shadow-[inset_0_-1px_0_var(--border)]">
              <tr>
                {header("order", "Order")}
                {header("buyer", "Buyer")}
                {header(null, "Embellishment")}
                {header(null, "Current stage")}
                {header(null, "Status")}
                {header("progress", "Progress", "w-36")}
                {header("created", "Created")}
                {header("waiting", "In stage")}
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const s = orderStatus(o);
                const p = progressOf(o);
                const days = maxWaitingDays(o);
                const late = isAtRisk(o);
                return (
                  <tr
                    key={o.id}
                    onClick={() => router.push(`/orders/${o.id}`)}
                    className={cn("h-12 cursor-pointer border-b border-border last:border-0 hover:bg-background", late && "shadow-[inset_3px_0_0_var(--danger)]")}
                  >
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        <OrderThumb order={o} size={36} />
                        <div className="min-w-0">
                          <Link href={`/orders/${o.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold whitespace-nowrap text-ink hover:text-primary hover:underline">
                            {o.orderNumber}
                          </Link>
                          <p className="max-w-56 truncate text-xs text-muted-foreground" title={o.colors.join(", ")}>
                            {o.colors.join(", ")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink">{o.buyer.name}</td>
                    <td className="px-3 py-2">
                      <EmbellishmentTag value={o.embellishment} ignored={o.ignoreEmbellishment} />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-ink">{stageText(o)}</td>
                    <td className="px-3 py-2">
                      <StatusBadge tone={s.tone} label={s.label} size="sm" />
                    </td>
                    <td className="px-3 py-2">
                      <ProgressBar value={p.percent} tone={p.percent === 100 ? "complete" : s.tone === "blocked" ? "blocked" : "normal"} />
                    </td>
                    <td className="tabular px-3 py-2 whitespace-nowrap text-muted-foreground">
                      {formatDate(o.createdAt)}
                      <span className="block text-xs">{formatTime(o.createdAt)}</span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {isCompleted(o) ? (
                        <span className="text-muted-foreground">—</span>
                      ) : days >= WAITING_ALERT_DAYS ? (
                        <WaitingTag days={days} />
                      ) : (
                        <span className="tabular text-muted-foreground">{days === 0 ? "<1d" : `${days}d`}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile: stacked cards */}
      <div className="grid gap-3 md:hidden">
        {rows.map((o) => (
          <OrderCard key={o.id} order={o} href={`/orders/${o.id}`} compact />
        ))}
      </div>

      <Pagination page={current} pages={pages} total={sorted.length} onPage={onPage} />
    </div>
  );
}

function Pagination({ page, pages, total, onPage }: { page: number; pages: number; total: number; onPage: (p: number) => void }) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="tabular text-sm text-muted-foreground">
        Showing {from}–{to} of {total} orders
      </p>
      {pages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="secondary" size="sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page">
            <ChevronLeft /> Previous
          </Button>
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Button
              key={p}
              variant={p === page ? "soft" : "ghost"}
              size="icon-sm"
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              className="tabular"
            >
              {p}
            </Button>
          ))}
          <Button variant="secondary" size="sm" onClick={() => onPage(page + 1)} disabled={page >= pages} aria-label="Next page">
            Next <ChevronRight />
          </Button>
        </div>
      )}
    </nav>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-surface p-4" aria-busy>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skel key={i} className="h-12" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ board */

type Column = StageKey | "completed";
const COLUMNS: Column[] = [...STAGE_KEYS, "completed"];

function inColumn(o: Order, col: Column) {
  return col === "completed" ? isCompleted(o) : currentStages(o).includes(col);
}

/** Board is for viewing — stage changes happen inside the order to keep hand-off rules. */
function OrderBoard({ items }: { items: Order[] }) {
  const { t } = useI18n();
  const [mobileCol, setMobileCol] = useState<Column>("fabric");
  const label = (c: Column) => (c === "completed" ? t("Completed") : t(STAGE_LABEL[c]));

  return (
    <>
      {/* Mobile: one column at a time with stage tabs */}
      <div className="space-y-3 md:hidden">
        <TabBar<Column>
          label="Stages"
          value={mobileCol}
          onChange={setMobileCol}
          tabs={COLUMNS.map((c) => ({ value: c, label: label(c), count: items.filter((o) => inColumn(o, c)).length }))}
        />
        <div className="grid gap-3">
          {items.filter((o) => inColumn(o, mobileCol)).map((o) => (
            <OrderCard key={o.id} order={o} stage={mobileCol === "completed" ? undefined : mobileCol} href={`/orders/${o.id}`} compact />
          ))}
          {items.every((o) => !inColumn(o, mobileCol)) && <EmptyState title={`No orders in ${label(mobileCol)}.`} className="py-8" />}
        </div>
      </div>

      {/* Tablet & desktop: columns scroll sideways */}
      <div className="-mx-4 hidden overflow-x-auto px-4 pb-2 md:-mx-6 md:block md:px-6">
        <div className="flex min-w-max gap-4">
          {COLUMNS.map((c) => {
            const list = items.filter((o) => inColumn(o, c));
            const Icon = c === "completed" ? null : STAGE_ICON[c];
            return (
              <section key={c} className="flex w-72 shrink-0 flex-col rounded-xl bg-muted/70 p-2" aria-label={label(c)}>
                <header className="flex items-center justify-between px-2 py-2">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
                    {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
                    {label(c)}
                  </h2>
                  <span className="tabular rounded-full bg-surface px-2 py-0.5 text-xs font-semibold text-muted-foreground">{list.length}</span>
                </header>
                <div className="flex flex-col gap-2">
                  {list.map((o) => (
                    <OrderCard key={o.id} order={o} stage={c === "completed" ? undefined : c} href={`/orders/${o.id}`} compact />
                  ))}
                  {list.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No orders</p>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden" aria-busy>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="w-72 shrink-0 space-y-2 rounded-xl bg-muted/70 p-2">
          <Skel className="h-8" />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </div>
      ))}
    </div>
  );
}
