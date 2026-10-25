"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skel } from "./states";

/** Page header: title, one-line subtitle, actions on the right (UI guideline §4.4). */
export function PageHeader({
  title,
  eyebrow,
  subtitle,
  icon: Icon,
  actions,
  badges,
  className,
}: {
  title: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  badges?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 md:flex-row md:items-end md:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl leading-8 font-semibold text-navy">{title}</h1>
            {badges}
          </div>
          {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:shrink-0 md:justify-end">{actions}</div>}
    </div>
  );
}

/** White card with optional title row. 16px padding on mobile, 24px on desktop. */
export function Section({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-xl border border-border bg-surface", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 xl:px-6 xl:pt-5">
          <div className="min-w-0">
            {title && <h2 className="text-lg leading-7 font-semibold text-ink">{title}</h2>}
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className={cn("p-4 xl:p-6", (title || actions) && "pt-3 xl:pt-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** KPI card — label, big number, helper line. Clickable cards open a filtered list. */
export function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  href,
  alert = false,
  loading = false,
}: {
  label: string;
  value?: number | string;
  helper?: React.ReactNode;
  icon: LucideIcon;
  href?: string;
  alert?: boolean;
  loading?: boolean;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-[13px] font-medium", alert ? "text-st-blocked" : "text-muted-foreground")}>{label}</p>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            alert ? "bg-st-blocked-bg text-st-blocked" : "bg-primary-soft text-primary",
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      </div>
      {loading ? (
        <div className="space-y-2">
          <Skel className="h-9 w-20" />
          <Skel className="h-3 w-32" />
        </div>
      ) : (
        <div>
          <p className={cn("tabular text-[30px] leading-9 font-bold", alert ? "text-st-blocked" : "text-ink")}>{value}</p>
          {helper && <p className="mt-1 text-[13px] text-muted-foreground">{helper}</p>}
        </div>
      )}
    </>
  );
  const cls = cn(
    "flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4 xl:p-5",
    alert && "border-l-[3px] border-l-danger",
    href && "transition-colors duration-150 hover:border-primary/60 focus-visible:ring-2 focus-visible:ring-primary",
  );
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
