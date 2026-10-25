"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { CircleCheck, CircleDashed, ClipboardCheck, Loader, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { OrderCard, OrderCardSkeleton } from "@/components/tf/order-card";
import { OrderWorkDrawer } from "@/components/tf/order-work-drawer";
import { QueueAction } from "@/components/tf/queue-action";
import { useSession } from "@/components/tf/session";
import { EmptyState, ErrorState } from "@/components/tf/states";
import { TabBar } from "@/components/tf/tab-bar";
import { useMyWork } from "@/lib/api/hooks";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { STAGE_LABEL, waitingDays, WAITING_ALERT_DAYS } from "@/lib/stages";
import type { StageKey } from "@/lib/types";
import { useNow } from "@/hooks/use-now";

type Tab = "todo" | "inProgress" | "doneToday";

function greeting(now: number) {
  const h = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", hour: "numeric", hour12: false }).format(now));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

/** Home for supervisors and workers: open app → see task → tap Start. */
export function MyWorkView() {
  const user = useSession();
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const now = useNow(60_000);
  const { data, error, isLoading, mutate } = useMyWork();
  const [open, setOpen] = useState<{ id: string; stage: StageKey } | null>(null);

  const tab = (sp.get("tab") as Tab) || "todo";
  const setTab = (v: Tab) => router.replace(v === "todo" ? pathname : `${pathname}?tab=${v}`, { scroll: false });

  const list = data?.[tab] ?? [];
  const late = data?.todo.concat(data.inProgress).filter((p) => p.order.stages[p.stage].state === "blocked" || waitingDays(p.order.stages[p.stage], now) > WAITING_ALERT_DAYS) ?? [];
  const depts = data?.departments.map((k) => t(STAGE_LABEL[k])).join(", ");
  const firstName = user.name.split(" ")[0];

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between xl:p-6">
        <div className="min-w-0">
          <h1 className="text-2xl leading-8 font-semibold text-navy">
            {t(greeting(now))}, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            {data ? (user.departments.length ? depts : "All departments") : <span className="inline-block h-4 w-32 animate-pulse rounded bg-muted align-middle" aria-hidden />} · Shift A (08:00 – 16:30) ·{" "}
            {formatDate(new Date(now).toISOString())}
          </p>
        </div>
      </section>

      {late.length > 0 && (
        <button
          type="button"
          onClick={() => setTab(late.some((p) => data?.todo.includes(p)) ? "todo" : "inProgress")}
          className="flex w-full items-center gap-3 rounded-xl border border-danger/30 border-l-[3px] border-l-danger bg-st-blocked-bg px-4 py-3 text-left text-sm text-st-blocked hover:bg-st-blocked-bg/80"
        >
          <TriangleAlert className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <b>
              {late.length} {late.length === 1 ? "order needs" : "orders need"} attention
            </b>{" "}
            — blocked or waiting more than {WAITING_ALERT_DAYS} days.
          </span>
        </button>
      )}

      <TabBar<Tab>
        variant="pill"
        label="My work"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "todo", label: t("To do"), icon: CircleDashed, count: data?.todo.length },
          { value: "inProgress", label: t("In progress"), icon: Loader, count: data?.inProgress.length },
          { value: "doneToday", label: t("Done today"), icon: CircleCheck, count: data?.doneToday.length },
        ]}
      />

      {error ? (
        <ErrorState error={error} title="Couldn't load your work." onRetry={() => mutate()} />
      ) : isLoading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={tab === "doneToday" ? ClipboardCheck : CircleCheck}
            title={
              tab === "todo"
                ? `No work waiting${depts ? ` in ${depts}` : ""}.`
                : tab === "inProgress"
                  ? "Nothing in progress right now."
                  : "Nothing finished yet today."
            }
            action={
              <Button asChild variant="secondary">
                <Link href="/orders">View all orders</Link>
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map(({ order, stage }) => (
            <li key={`${order.id}-${stage}`} className="flex">
              <div className="flex w-full flex-col">
                {data && data.departments.length > 1 && (
                  <p className="mb-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">{t(STAGE_LABEL[stage])}</p>
                )}
                <OrderCard
                  order={order}
                  stage={stage}
                  now={now}
                  onOpen={() => setOpen({ id: order.id, stage })}
                  action={tab !== "doneToday" && <QueueAction order={order} stage={stage} onOpen={() => setOpen({ id: order.id, stage })} />}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <OrderWorkDrawer orderId={open?.id ?? null} stage={open?.stage ?? "fabric"} onClose={() => setOpen(null)} />
    </div>
  );
}
