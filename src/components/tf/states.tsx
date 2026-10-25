"use client";

import { Inbox, OctagonAlert, RotateCcw, WifiOff, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n";
import { useOnline } from "@/hooks/use-online";
import { cn } from "@/lib/utils";

/** Empty state — line icon, one sentence, one action (UI guideline §5). */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      <Icon className="size-12 text-muted-foreground/70" strokeWidth={1.5} aria-hidden />
      <div className="max-w-sm space-y-1">
        <p className="text-base font-semibold text-ink">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Inline red banner: what failed + "Try again". */
export function ErrorState({
  error,
  title = "Couldn't load this.",
  onRetry,
  className,
}: {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const message = error instanceof ApiError || error instanceof Error ? error.message : undefined;
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-danger/30 bg-st-blocked-bg p-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <OctagonAlert className="size-5 shrink-0 text-st-blocked" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-st-blocked">{title}</p>
        {message && <p className="text-sm text-st-blocked/90">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="self-start sm:self-auto">
          <RotateCcw /> {t("Try again")}
        </Button>
      )}
    </div>
  );
}

/** Gray skeleton block. Shapes match the content they replace. */
export function Skel({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} aria-hidden />;
}

/** Amber bar shown at the top while the device is offline (UI guideline §8.1). */
export function OfflineBanner() {
  const online = useOnline();
  const { t } = useI18n();
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 bg-st-hold-bg px-4 py-2 text-sm font-medium text-st-hold">
      <WifiOff className="size-4 shrink-0" aria-hidden />
      {t("You're offline. Changes will be saved when you reconnect.")}
    </div>
  );
}
