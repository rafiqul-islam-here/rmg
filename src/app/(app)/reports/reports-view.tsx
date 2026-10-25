"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChartColumn,
  CircleCheck,
  Download,
  Layers,
  PackageX,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DisabledReason } from "@/components/tf/drawer";
import { PageHeader, Section } from "@/components/tf/page";
import { EmptyState, ErrorState, Skel } from "@/components/tf/states";
import { useReport } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import type { ReportKey, ReportResult } from "@/lib/types";
import { cn } from "@/lib/utils";

const REPORTS: { key: ReportKey; title: string; question: string; icon: LucideIcon }[] = [
  { key: "by-stage", title: "Orders by stage", question: "Where are orders sitting right now?", icon: ChartColumn },
  { key: "stage-time", title: "Average time in stage", question: "How long does each department take?", icon: Timer },
  { key: "fabric-issues", title: "Fabric issues", question: "Which orders are waiting for fabric?", icon: PackageX },
  { key: "embellishment", title: "Embellishment mix", question: "How many orders need print or embroidery?", icon: Layers },
  { key: "completed", title: "Completed orders", question: "What has passed GPQ, and how long did it take?", icon: CircleCheck },
];

export function ReportsView() {
  const { t } = useI18n();
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = (REPORTS.find((r) => r.key === sp.get("r"))?.key ?? "by-stage") as ReportKey;
  const meta = REPORTS.find((r) => r.key === key)!;
  const { data, error, isLoading, mutate } = useReport(key);
  const pick = (k: ReportKey) => router.replace(k === "by-stage" ? pathname : `${pathname}?r=${k}`, { scroll: false });

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("Reports")}
        subtitle="Simple answers to everyday production questions."
        actions={
          <DisabledReason reason="CSV export is coming soon.">
            <Button variant="secondary" disabled>
              <Download /> Export CSV
            </Button>
          </DisabledReason>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        {/* Picker: list on desktop, dropdown on smaller screens */}
        <nav aria-label="Reports" className="hidden self-start rounded-xl border border-border bg-surface p-2 xl:block">
          <ul className="space-y-1">
            {REPORTS.map((r) => (
              <li key={r.key}>
                <button
                  type="button"
                  onClick={() => pick(r.key)}
                  aria-current={r.key === key ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                    r.key === key ? "bg-primary-soft font-semibold text-primary" : "text-ink hover:bg-background",
                  )}
                >
                  <r.icon className="size-4 shrink-0" aria-hidden />
                  {r.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <Select value={key} onValueChange={(v) => pick(v as ReportKey)}>
          <SelectTrigger className="w-full xl:hidden" aria-label="Choose a report">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPORTS.map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="min-w-0 space-y-4">
          <Section title={meta.title} description={meta.question}>
            {error ? (
              <ErrorState error={error} title="Couldn't load this report." onRetry={() => mutate()} />
            ) : isLoading && !data ? (
              <div className="space-y-4" aria-busy>
                <Skel className="h-64" />
                <Skel className="h-40" />
              </div>
            ) : !data || data.rows.length === 0 ? (
              <EmptyState icon={meta.icon} title="No data for this report yet." description="It fills in as orders move through the floor." />
            ) : (
              <div className="space-y-6">
                <ReportChart data={data} />
                <ReportTable data={data} />
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

/** Single-series bar chart: one hue, no legend (the title names the series), hover tooltip. */
function ReportChart({ data }: { data: ReportResult }) {
  if (data.chart.every((d) => d.value === 0)) return null;
  return (
    <figure className="h-64 w-full" aria-label={`Bar chart, ${data.chartUnit}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data.chart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }} barCategoryGap="30%">
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--border)" }} tick={{ fill: "var(--text-muted)", fontSize: 12 }} interval={0} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--text-muted)", fontSize: 12 }} width={48} />
          <Tooltip
            cursor={{ fill: "var(--background)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm shadow-pop">
                  <p className="font-semibold text-ink">{label}</p>
                  <p className="tabular text-muted-foreground">
                    {payload[0].value} {data.chartUnit}
                  </p>
                </div>
              ) : null
            }
          />
          <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

function ReportTable({ data }: { data: ReportResult }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[480px] text-[13px]">
        <thead className="bg-background">
          <tr>
            {data.columns.map((c) => (
              <th key={c.key} scope="col" className={cn("h-11 px-3 text-xs font-semibold tracking-wide whitespace-nowrap text-muted-foreground uppercase", c.numeric ? "text-right" : "text-left")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={i} className="h-12 border-t border-border hover:bg-background">
              {data.columns.map((c, j) => (
                <td key={c.key} className={cn("px-3 py-2", c.numeric ? "tabular text-right" : "text-left", j === 0 ? "font-semibold text-ink" : "text-ink")}>
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
