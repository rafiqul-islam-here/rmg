"use client";

import Link from "next/link";
import {
  ArrowRight,
  CircleCheck,
  Hourglass,
  Layers,
  Plus,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeed } from "@/components/tf/comments";
import { KpiCard, PageHeader, Section } from "@/components/tf/page";
import { useSession } from "@/components/tf/session";
import { STAGE_ICON } from "@/components/tf/stage-icon";
import { EmptyState, ErrorState, Skel } from "@/components/tf/states";
import { StatusBadge, WaitingTag } from "@/components/tf/status-badge";
import { useActivity, useDashboard } from "@/lib/api/hooks";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { can } from "@/lib/permissions";
import { orderTitle, STAGE_LABEL, statusInStage, WAITING_ALERT_DAYS } from "@/lib/stages";
import type { DashboardSummary, StageKey } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DashboardView() {
  const user = useSession();
  const { t } = useI18n();
  const { data, error, isLoading, mutate } = useDashboard();
  const activity = useActivity(8);
  const loading = isLoading && !data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("Production Overview")}
        subtitle={`Today · ${formatDate(new Date().toISOString())} · Shift A (08:00 – 16:30)`}
        actions={
          can.createOrder(user) && (
            <Button asChild>
              <Link href="/orders/new">
                <Plus /> {t("New order")}
              </Link>
            </Button>
          )
        }
      />

      {error && !data ? (
        // Without data, the cards below would show misleading "nothing here" messages.
        <ErrorState error={error} title="Couldn't load the dashboard." onRetry={() => mutate()} />
      ) : (
      <>
      {/* Row 1 — KPI cards, each opens a filtered order list */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <KpiCard label="Active orders" icon={Layers} loading={loading} value={data?.activeOrders} helper="On the floor now" href="/orders?tab=active" />
        <KpiCard
          label="Waiting to start"
          icon={Hourglass}
          loading={loading}
          value={data?.waitingOrders}
          helper="Arrived, not started yet"
          href="/orders?tab=active&status=ready"
        />
        <KpiCard label="Completed (this month)" icon={CircleCheck} loading={loading} value={data?.completedThisMonth} helper="PP Meeting done" href="/orders?tab=completed" />
        <KpiCard
          label="At risk"
          icon={TriangleAlert}
          loading={loading}
          value={data?.atRisk}
          alert={(data?.atRisk ?? 0) > 0}
          helper={data ? `${data.blocked} blocked · waiting > ${WAITING_ALERT_DAYS} days` : undefined}
          href="/orders?tab=blocked"
        />
      </div>

      {/* Row 2 — workload (2/3) + waiting longest (1/3) */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Section
          className="xl:col-span-2"
          title="Department workload"
          description="Orders in each department right now"
          actions={<Legend />}
        >
          {loading ? (
            <div className="space-y-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skel key={i} className="h-10" />
              ))}
            </div>
          ) : data && data.activeOrders === 0 ? (
            <EmptyState
              title="No active orders yet."
              description="Create an order and it will start in Fabric and PP Meeting."
              action={
                can.createOrder(user) && (
                  <Button asChild variant="secondary">
                    <Link href="/orders/new">{t("New order")}</Link>
                  </Button>
                )
              }
            />
          ) : data ? (
            <Workload data={data} />
          ) : null}
        </Section>

        <Section title="Waiting longest" description="Orders that have sat in one stage the longest">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skel key={i} className="h-14" />
              ))}
            </div>
          ) : !data?.longestWaiting.length ? (
            <EmptyState icon={CircleCheck} title="Nothing is waiting." className="py-8" />
          ) : (
            <ul className="-my-2 divide-y divide-border">
              {data.longestWaiting.map(({ order, stage, days }) => {
                const s = statusInStage(order, stage);
                return (
                  <li key={`${order.id}-${stage}`}>
                    <Link href={`/orders/${order.id}`} className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-3 hover:bg-background">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{orderTitle(order)}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {order.buyer.name} · {t(STAGE_LABEL[stage])}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <StatusBadge tone={s.tone} label={s.label} size="sm" />
                        </div>
                      </div>
                      {days >= WAITING_ALERT_DAYS ? (
                        <WaitingTag days={days} />
                      ) : (
                        <span className="tabular shrink-0 text-xs text-muted-foreground">{days === 0 ? "<1d" : `${days}d`}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>

      {/* Row 3 — bottlenecks + recent activity */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Section title="Bottlenecks" description={`Blocked, or waiting more than ${WAITING_ALERT_DAYS} days`}>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skel key={i} className="h-14" />
              ))}
            </div>
          ) : !data?.bottlenecks.length ? (
            <EmptyState icon={CircleCheck} title="No bottlenecks right now." className="py-8" />
          ) : (
            <ul className="space-y-2">
              {data.bottlenecks.map((b) => (
                <BottleneckRow key={b.stage} stage={b.stage} count={b.count} days={b.days} />
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent activity" description="Hand-offs, problems and comments">
          <ActivityFeed
            items={activity.data?.items}
            isLoading={activity.isLoading}
            error={activity.error}
            onRetry={() => activity.mutate()}
            showOrder
            emptyText="No activity yet."
            limit={8}
          />
        </Section>
      </div>
      </>
      )}
    </div>
  );
}

const SEGMENTS: { key: "inProgress" | "waiting" | "blocked"; label: string; className: string; text: string }[] = [
  { key: "inProgress", label: "In progress", className: "bg-primary", text: "text-st-progress" },
  { key: "waiting", label: "Waiting", className: "bg-[#94A3B8]", text: "text-st-pending" },
  { key: "blocked", label: "Blocked", className: "bg-danger", text: "text-st-blocked" },
];

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {SEGMENTS.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-full", s.className)} aria-hidden />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function Workload({ data }: { data: DashboardSummary }) {
  const { t } = useI18n();
  const max = Math.max(1, ...data.workload.map((w) => w.waiting + w.inProgress + w.blocked));
  return (
    <ul className="space-y-1">
      {data.workload.map((w) => {
        const total = w.waiting + w.inProgress + w.blocked;
        const Icon = STAGE_ICON[w.stage];
        const pct = (n: number) => `${(n / max) * 100}%`;
        return (
          <li key={w.stage}>
            <Link
              href={`/departments/${w.stage}`}
              className={cn(
                "-mx-2 grid grid-cols-[minmax(0,7.5rem)_1fr] items-center gap-x-4 gap-y-1 rounded-lg px-2 py-2.5 hover:bg-background sm:grid-cols-[9rem_1fr_auto]",
                w.blocked > 0 && "bg-st-blocked-bg/50",
              )}
              aria-label={`${STAGE_LABEL[w.stage]}: ${w.inProgress} in progress, ${w.waiting} waiting, ${w.blocked} blocked`}
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Icon className="size-4 text-muted-foreground" aria-hidden />
                {t(STAGE_LABEL[w.stage])}
              </span>
              <span className="flex h-3 overflow-hidden rounded-full bg-border/60" aria-hidden>
                {SEGMENTS.map((s) => (w[s.key] > 0 ? <span key={s.key} className={cn("h-full", s.className)} style={{ width: pct(w[s.key]) }} /> : null))}
              </span>
              <span className="tabular col-span-2 flex flex-wrap gap-x-3 text-xs text-muted-foreground sm:col-span-1 sm:justify-end">
                {SEGMENTS.map((s) => (
                  <span key={s.key} className={cn(w[s.key] > 0 && s.text)}>
                    <b className="font-semibold">{w[s.key]}</b> {s.label.toLowerCase()}
                  </span>
                ))}
                <span className="font-semibold text-ink sm:hidden">· {total} total</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function BottleneckRow({ stage, count, days }: { stage: StageKey; count: number; days: number }) {
  const { t } = useI18n();
  const Icon: LucideIcon = STAGE_ICON[stage];
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border border-l-[3px] border-l-danger p-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-st-blocked-bg text-st-blocked">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-sm text-ink">
        <span className="font-semibold">{t(STAGE_LABEL[stage])}</span> — {count} {count === 1 ? "order" : "orders"} stuck
        {days > 0 && <span className="text-muted-foreground"> · up to {days} days</span>}
      </p>
      <Button asChild variant="ghost" size="sm" className="text-primary">
        <Link href={`/departments/${stage}`}>
          View <ArrowRight className="size-4" />
        </Link>
      </Button>
    </li>
  );
}
