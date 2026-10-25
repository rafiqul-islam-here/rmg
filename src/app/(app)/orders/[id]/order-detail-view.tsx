"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Copy,
  Ellipsis,
  FileText,
  ImagePlus,
  PackageSearch,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ActivityFeed, CommentBox } from "@/components/tf/comments";
import { OrderFacts } from "@/components/tf/order-work-drawer";
import { OrderThumb } from "@/components/tf/order-thumb";
import { FindingsList } from "@/components/tf/ppm-form";
import { Section } from "@/components/tf/page";
import { ProgressBar } from "@/components/tf/progress-bar";
import { StageActionPanel } from "@/components/tf/stage-actions";
import { STAGE_ICON } from "@/components/tf/stage-icon";
import { StageStepper } from "@/components/tf/stage-stepper";
import { EmptyState, ErrorState, Skel } from "@/components/tf/states";
import { EmbellishmentTag, StatusBadge, WaitingTag } from "@/components/tf/status-badge";
import { TabBar } from "@/components/tf/tab-bar";
import { ApiError, api } from "@/lib/api/client";
import { useOrder, useOrderActivity, useRefreshAll } from "@/lib/api/hooks";
import { formatDateTime, formatDayTime, formatDuration } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import {
  currentStages,
  isActiveState,
  isCompleted,
  maxWaitingDays,
  orderStatus,
  progressOf,
  STAGE_KEYS,
  STAGE_LABEL,
  stageStatus,
} from "@/lib/stages";
import type { Order, StageKey } from "@/lib/types";
import { cn } from "@/lib/utils";
import { MQ, useMediaQuery } from "@/hooks/use-media-query";
import { useNow } from "@/hooks/use-now";

type Tab = "stages" | "details" | "files" | "comments";

/** Production card — the single source of truth for one order. */
export function OrderDetailView({ id }: { id: string }) {
  const { data: order, error, isLoading, mutate } = useOrder(id);
  const activity = useOrderActivity(order?.id ?? null);
  const { t } = useI18n();
  const desktop = useMediaQuery(MQ.desktop);
  const [tab, setTab] = useState<Tab>("stages");

  if (error instanceof ApiError && error.status === 404) {
    return (
      <div className="rounded-xl border border-border bg-surface">
        <EmptyState
          icon={PackageSearch}
          title="Order not found."
          description="It may have been removed, or the link is wrong."
          action={
            <Button asChild variant="secondary">
              <Link href="/orders">Back to orders</Link>
            </Button>
          }
        />
      </div>
    );
  }
  if (error) return <ErrorState error={error} title="Couldn't load this order." onRetry={() => mutate()} />;
  if (isLoading || !order) return <DetailSkeleton />;

  const status = orderStatus(order);
  const progress = progressOf(order);
  const now = currentStages(order);
  const days = maxWaitingDays(order);
  // On desktop, comments sit in the right column; below that they get their own tab.
  const activeTab = desktop && tab === "comments" ? "stages" : tab;

  const comments = (
    <div className="grid gap-4">
      <CommentBox orderId={order.id} orderNumber={order.orderNumber} />
      <ActivityFeed items={activity.data?.items} isLoading={activity.isLoading} error={activity.error} onRetry={() => activity.mutate()} />
    </div>
  );

  return (
    <div className="space-y-4">
      <Link href="/orders" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary md:min-h-0">
        <ArrowLeft className="size-4" aria-hidden /> {t("Orders")}
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-4">
          <OrderThumb order={order} size={64} className="hidden sm:flex" />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Order</p>
            <h1 className="text-2xl leading-8 font-semibold break-words text-navy">{order.orderNumber}</h1>
            <p className="text-sm text-muted-foreground">
              {order.buyer.name} · {order.colors.join(", ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge tone={status.tone} label={status.label} />
              <WaitingTag days={days} />
              <EmbellishmentTag value={order.embellishment} ignored={order.ignoreEmbellishment} />
            </div>
          </div>
        </div>
        <OrderMenu order={order} />
      </div>

      {/* Summary + progress */}
      <Section>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-3 xl:grid-cols-6">
          <Fact label="Buyer" value={`${order.buyer.code} · ${order.buyer.name}`} />
          <Fact label="Colors" value={order.colors.join(", ")} />
          <Fact label="Embellishment" value={order.ignoreEmbellishment ? "Ignored" : order.embellishment === "none" ? "None" : <EmbellishmentTag value={order.embellishment} className="border-0 bg-transparent px-0 text-sm text-ink" />} />
          <Fact label="Created" value={formatDateTime(order.createdAt)} />
          <Fact label="Created by" value={order.createdBy.name} />
          <Fact label="Now in" value={isCompleted(order) ? "Completed" : now.map((k) => t(STAGE_LABEL[k])).join(" + ")} />
        </dl>
        <div className="mt-5 border-t border-border pt-4">
          <ProgressBar
            value={progress.percent}
            tone={progress.percent === 100 ? "complete" : status.tone === "blocked" ? "blocked" : days > 2 ? "risk" : "normal"}
            label={`${progress.percent}% · ${progress.done} of ${progress.total} stages`}
          />
        </div>
      </Section>

      <Section title="Production stages">
        <StageStepper order={order} />
      </Section>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="min-w-0 space-y-4 xl:col-span-2">
          <TabBar<Tab>
            label="Order sections"
            value={activeTab}
            onChange={setTab}
            tabs={[
              { value: "stages", label: "Stages" },
              { value: "details", label: "Details" },
              { value: "files", label: "Files" },
              ...(!desktop ? [{ value: "comments" as const, label: t("Comments & activity"), count: activity.data?.items.filter((e) => e.kind === "comment").length }] : []),
            ]}
          />
          {activeTab === "stages" && <StagesList order={order} />}
          {activeTab === "details" && <Details order={order} />}
          {activeTab === "files" && <Files order={order} attachments={activity.data?.items.filter((e) => e.attachmentName).map((e) => ({ name: e.attachmentName!, at: e.at, by: e.actor?.name })) ?? []} />}
          {activeTab === "comments" && <Section>{comments}</Section>}
        </div>
        {desktop && (
          <Section title={t("Comments & activity")} className="self-start">
            {comments}
          </Section>
        )}
      </div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular mt-0.5 font-semibold break-words text-ink">{value}</dd>
    </div>
  );
}

function OrderMenu({ order }: { order: Order }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label="More actions" className="self-start">
          <Ellipsis />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="shadow-pop">
        <DropdownMenuItem className="h-10" onSelect={() => window.print()}>
          <Printer className="size-4" /> Print production card
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-10"
          onSelect={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              toast.success(`Link to ${order.orderNumber} copied.`);
            } catch {
              toast.error("Couldn't copy the link.");
            }
          }}
        >
          <Copy className="size-4" /> Copy link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ------------------------------------------------------------------ Stages tab */

function StagesList({ order }: { order: Order }) {
  const { t } = useI18n();
  const current = currentStages(order);
  const nowMs = useNow(60_000);
  // One stage open at a time, so the page keeps a single main button.
  const [open, setOpen] = useState<StageKey | null>(current[0] ?? null);

  return (
    <ol className="space-y-2">
      {STAGE_KEYS.map((k) => {
        const rec = order.stages[k];
        const s = stageStatus(rec);
        const Icon = STAGE_ICON[k];
        const active = isActiveState(rec.state);
        const expanded = open === k && active;
        const skipped = rec.state === "skipped";
        const spent = rec.arrivedAt ? formatDuration((rec.doneAt ? new Date(rec.doneAt).getTime() : nowMs) - new Date(rec.arrivedAt).getTime()) : null;
        const facts: [string, string][] = [
          ...(rec.arrivedAt ? ([["Arrived", formatDayTime(rec.arrivedAt)]] as [string, string][]) : []),
          ...(rec.startedAt ? ([["Started", formatDayTime(rec.startedAt)]] as [string, string][]) : []),
          ...(rec.doneAt ? ([["Done", formatDayTime(rec.doneAt)]] as [string, string][]) : []),
          ...(spent && rec.state !== "not_reached" ? ([[rec.doneAt ? "Time spent" : "In stage", spent]] as [string, string][]) : []),
          ...(rec.sewingUnit ? ([["Sewing unit", rec.sewingUnit]] as [string, string][]) : []),
          ...(rec.assignee ? ([["By", rec.assignee.name]] as [string, string][]) : []),
        ];
        return (
          <li
            key={k}
            className={cn(
              "rounded-xl border bg-surface",
              expanded ? "border-primary/50 ring-1 ring-primary/20" : "border-border",
              skipped && "border-dashed bg-background",
            )}
          >
            <div className="relative flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", skipped ? "bg-muted text-muted-foreground" : "bg-primary-soft text-primary")}>
                <Icon className="size-5" aria-hidden />
              </span>
              {active ? (
                // Stretched toggle: the whole header row opens / closes the stage.
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : k)}
                  aria-expanded={expanded}
                  className="min-w-0 flex-1 text-left font-semibold text-ink outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-primary"
                >
                  {t(STAGE_LABEL[k])}
                </button>
              ) : (
                <span className={cn("min-w-0 flex-1 font-semibold", skipped ? "text-muted-foreground" : "text-ink")}>{t(STAGE_LABEL[k])}</span>
              )}
              {rec.state === "not_reached" ? (
                <span className="text-xs text-muted-foreground">{t("Pending")}</span>
              ) : (
                <StatusBadge tone={s.tone} label={s.label} size="sm" />
              )}
              {active && <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden />}
              {facts.length > 0 && (
                <dl className="flex w-full flex-wrap gap-x-5 gap-y-1 pl-12 text-xs">
                  {facts.map(([label, v]) => (
                    <div key={label} className="flex gap-1">
                      <dt className="text-muted-foreground">{label}:</dt>
                      <dd className="tabular font-medium text-ink">{v}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {rec.comment && !expanded && <p className="w-full pl-12 text-xs text-muted-foreground italic">“{rec.comment}”</p>}
            </div>
            {expanded && (
              <div className="border-t border-border p-4">
                <StageActionPanel order={order} stage={k} />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ Details & Files */

function Details({ order }: { order: Order }) {
  return (
    <Section title="Order entry">
      <OrderFacts order={order} />
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Created by</dt>
          <dd className="font-medium text-ink">
            {order.createdBy.name} <span className="text-muted-foreground">· {order.createdBy.email}</span>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Embellishment route</dt>
          <dd className="font-medium text-ink">
            {order.ignoreEmbellishment ? "Embellishment ignored by a super user — straight to Sewing" : order.embellishment === "none" ? "Straight to Sewing" : "Cutting → embellishment → Sewing"}
          </dd>
        </div>
      </dl>
      {order.ppMeeting && (
        <div className="mt-6 border-t border-border pt-4">
          <h3 className="mb-1 text-base font-semibold text-ink">PP Meeting findings</h3>
          <p className="tabular mb-3 text-[13px] text-muted-foreground">
            PPM time: {formatDateTime(order.ppMeeting.ppmAt)} · set by {order.ppMeeting.setBy.name}
          </p>
          <FindingsList findings={order.ppMeeting.findings} />
        </div>
      )}
    </Section>
  );
}

function Files({ order, attachments }: { order: Order; attachments: { name: string; at: string; by?: string }[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = useRefreshAll();
  const [busy, setBusy] = useState(false);

  function upload(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 2 * 1024 * 1024) {
      toast.error("Choose an image up to 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(true);
      try {
        await api.setOrderImage(order.id, String(reader.result));
        toast.success(`Photo updated for ${order.orderNumber}.`);
        await refresh();
      } catch (err) {
        toast.error("Photo not saved", { description: err instanceof Error ? err.message : undefined });
      } finally {
        setBusy(false);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <Section
      title="Files"
      description="Product photo and files attached in comments"
      actions={
        <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={busy}>
          <ImagePlus /> {order.imageUrl ? "Replace photo" : "Upload photo"}
        </Button>
      }
    >
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      {!order.imageUrl && attachments.length === 0 ? (
        <EmptyState icon={ImagePlus} title="No files yet." description="Upload a product photo so the floor can recognise this order." className="py-8" />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {order.imageUrl && (
            <li className="overflow-hidden rounded-lg border border-border">
              <Image src={order.imageUrl} alt={`${order.orderNumber} product photo`} width={320} height={240} unoptimized className="aspect-[4/3] w-full bg-background object-cover" />
              <p className="px-3 py-2 text-xs font-medium text-ink">Product photo</p>
            </li>
          )}
          {attachments.map((a, i) => (
            <li key={i} className="flex flex-col justify-between rounded-lg border border-border p-3">
              <FileText className="size-8 text-muted-foreground" aria-hidden />
              <div className="mt-6 min-w-0">
                <p className="truncate text-xs font-medium text-ink" title={a.name}>{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.by} · {formatDayTime(a.at)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-4" aria-busy>
      <Skel className="h-6 w-24" />
      <Skel className="h-20 w-80" />
      <Skel className="h-36 rounded-xl" />
      <Skel className="h-32 rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-3">
        <Skel className="h-80 rounded-xl xl:col-span-2" />
        <Skel className="h-80 rounded-xl" />
      </div>
    </div>
  );
}
