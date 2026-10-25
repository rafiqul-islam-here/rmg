"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export interface FilterDef {
  key: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

export interface ToggleDef {
  key: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const ALL = "__all";

/**
 * Filter bar — search + 2–4 dropdowns + toggle + "Clear filters".
 * Active filters show as removable chips under the bar.
 */
export function FilterBar({
  search,
  onSearch,
  searchPlaceholder = "Search orders, buyer, color…",
  filters = [],
  toggles = [],
  trailing,
  className,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  filters?: FilterDef[];
  toggles?: ToggleDef[];
  /** Right-aligned extra controls, e.g. a view toggle. */
  trailing?: React.ReactNode;
  className?: string;
}) {
  const { t } = useI18n();
  const activeFilters = filters.filter((f) => f.value);
  const activeToggles = toggles.filter((tg) => tg.checked);
  const hasActive = Boolean(search) || activeFilters.length > 0 || activeToggles.length > 0;

  const clearAll = () => {
    onSearch("");
    filters.forEach((f) => f.onChange(""));
    toggles.forEach((tg) => tg.onChange(false));
  };

  return (
    <div className={cn("rounded-xl border border-border bg-surface p-3 xl:p-4", className)}>
      <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
        <div className="relative w-full xl:w-80">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t(searchPlaceholder)}
            aria-label={t("Search")}
            className="pl-9"
          />
        </div>
        {filters.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {filters.map((f) => (
              <Select key={f.key} value={f.value || ALL} onValueChange={(v) => f.onChange(v === ALL ? "" : v)}>
                <SelectTrigger className="w-full min-w-0 sm:w-auto sm:min-w-40" aria-label={f.label}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All {f.label.toLowerCase()}</SelectItem>
                  {f.options.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ))}
          </div>
        )}
        {toggles.map((tg) => (
          <div key={tg.key} className="flex min-h-11 items-center gap-2 xl:min-h-10">
            <Switch id={`tg-${tg.key}`} checked={tg.checked} onCheckedChange={tg.onChange} />
            <Label htmlFor={`tg-${tg.key}`} className="cursor-pointer text-sm font-medium">
              {tg.label}
            </Label>
          </div>
        ))}
        {hasActive && (
          <button
            type="button"
            onClick={clearAll}
            className="min-h-11 self-start text-sm font-medium text-primary hover:underline xl:min-h-10 xl:self-auto"
          >
            {t("Clear filters")}
          </button>
        )}
        {trailing && <div className="xl:ml-auto">{trailing}</div>}
      </div>

      {(activeFilters.length > 0 || activeToggles.length > 0) && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Active filters">
          {activeFilters.map((f) => (
            <Chip key={f.key} onRemove={() => f.onChange("")}>
              {f.label}: {f.options.find((o) => o.value === f.value)?.label ?? f.value}
            </Chip>
          ))}
          {activeToggles.map((tg) => (
            <Chip key={tg.key} onRemove={() => tg.onChange(false)}>
              {tg.label}
            </Chip>
          ))}
        </ul>
      )}
    </div>
  );
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <li className="inline-flex h-8 items-center gap-1 rounded-full bg-primary-soft pr-1 pl-3 text-[13px] font-medium text-primary">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="flex size-7 items-center justify-center rounded-full hover:bg-primary/10"
        aria-label={`Remove filter ${typeof children === "string" ? children : ""}`}
      >
        <X className="size-3.5" aria-hidden />
      </button>
    </li>
  );
}
