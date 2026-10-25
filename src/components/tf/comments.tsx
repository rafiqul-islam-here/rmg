"use client";

import { useRef, useState } from "react";
import {
  ArrowRightLeft,
  CirclePlus,
  FileText,
  OctagonAlert,
  Paperclip,
  RefreshCw,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api/client";
import { useRefreshAll } from "@/lib/api/hooks";
import { formatRelative, initials } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import type { ActivityEvent, ActivityKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, Skel } from "./states";

/** Comment box — text, @mention hint, attach file, "Post". */
export function CommentBox({ orderId, orderNumber, onPosted }: { orderId: string; orderNumber: string; onPosted?: () => void }) {
  const { t } = useI18n();
  const refresh = useRefreshAll();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.addComment(orderId, { text: text.trim(), attachmentName: file?.name });
      setText("");
      setFile(null);
      await refresh();
      onPosted?.();
    } catch (err) {
      // Keep what the user typed; let them retry.
      toast.error(`Comment not posted on ${orderNumber}`, {
        description: err instanceof Error ? err.message : undefined,
        duration: Infinity,
        action: { label: "Retry", onClick: () => void submit(e) },
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg border border-border bg-surface p-3 focus-within:border-primary">
      <label htmlFor={`comment-${orderId}`} className="sr-only">
        Write a comment
      </label>
      <Textarea
        id={`comment-${orderId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a comment… use @ to mention someone"
        className="min-h-20 resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) void submit(e);
        }}
      />
      {file && (
        <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-md border border-border bg-background px-2 py-1 text-xs">
          <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{file.name}</span>
          <button type="button" onClick={() => setFile(null)} aria-label="Remove attachment" className="rounded p-0.5 hover:bg-muted">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => fileRef.current?.click()} aria-label="Attach file" title="Attach file">
          <Paperclip />
        </Button>
        <Button type="submit" variant="secondary" size="sm" loading={busy} disabled={!text.trim()}>
          {t("Post")}
        </Button>
      </div>
    </form>
  );
}

const KIND_ICON: Record<Exclude<ActivityKind, "comment">, LucideIcon> = {
  created: CirclePlus,
  status: RefreshCw,
  handoff: ArrowRightLeft,
  problem: OctagonAlert,
};

/** Combined timeline: user comments (avatar) and system events (small icon, gray text). Newest first. */
export function ActivityList({
  items,
  showOrder = false,
  now,
  className,
}: {
  items: ActivityEvent[];
  showOrder?: boolean;
  now?: number;
  className?: string;
}) {
  return (
    <ol className={cn("space-y-4", className)}>
      {items.map((e) =>
        e.kind === "comment" ? (
          <li key={e.id} className="flex gap-3">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="bg-primary-soft text-xs font-semibold text-primary">
                {initials(e.actor?.name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[13px]">
                <span className="font-semibold text-ink">{e.actor?.name}</span>
                {showOrder && <span className="text-muted-foreground"> on {e.orderNumber}</span>}
                <span className="text-xs text-muted-foreground"> · {formatRelative(e.at, now)}</span>
              </p>
              <p className="mt-1 rounded-lg bg-background px-3 py-2 text-sm text-ink break-words">{e.text}</p>
              {e.attachmentName && (
                <span className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-ink">
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{e.attachmentName}</span>
                </span>
              )}
            </div>
          </li>
        ) : (
          <SystemEvent key={e.id} e={e} showOrder={showOrder} now={now} />
        ),
      )}
    </ol>
  );
}

function SystemEvent({ e, showOrder, now }: { e: ActivityEvent; showOrder: boolean; now?: number }) {
  const Icon = KIND_ICON[e.kind as Exclude<ActivityKind, "comment">];
  return (
    <li className="flex gap-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full",
          e.kind === "problem" ? "bg-st-blocked-bg text-st-blocked" : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 pt-1 text-[13px] text-muted-foreground">
        {showOrder && <span className="font-semibold text-ink">{e.orderNumber} · </span>}
        <span className={cn(e.kind === "problem" && "text-st-blocked")}>{e.text}</span>
        {e.actor && <span> · {e.actor.name}</span>}
        <span className="text-xs"> · {formatRelative(e.at, now)}</span>
      </p>
    </li>
  );
}

/** Ready-made block for loading / error / empty around an activity list. */
export function ActivityFeed({
  items,
  isLoading,
  error,
  onRetry,
  showOrder,
  emptyText = "No comments yet",
  limit,
}: {
  items?: ActivityEvent[];
  isLoading: boolean;
  error?: unknown;
  onRetry?: () => void;
  showOrder?: boolean;
  emptyText?: string;
  limit?: number;
}) {
  const [shown, setShown] = useState(limit ?? 10);
  if (error) return <ErrorState error={error} title="Couldn't load activity." onRetry={onRetry} />;
  if (isLoading && !items)
    return (
      <div className="space-y-4" aria-busy>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skel className="size-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skel className="h-3 w-1/2" />
              <Skel className="h-8" />
            </div>
          </div>
        ))}
      </div>
    );
  if (!items?.length) return <EmptyState title={emptyText} className="py-6" />;
  return (
    <div className="space-y-3">
      <ActivityList items={items.slice(0, shown)} showOrder={showOrder} />
      {!limit && items.length > shown && (
        <Button variant="ghost" size="sm" className="w-full" onClick={() => setShown((s) => s + 10)}>
          Load more
        </Button>
      )}
    </div>
  );
}
