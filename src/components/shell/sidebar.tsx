"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDashboard } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { STAGE_ICON } from "@/components/tf/stage-icon";
import { useSession } from "@/components/tf/session";
import { isActive, navFor, type NavItem } from "./nav";
import { Logo } from "./logo";

const KEY = "tf.sidebar.collapsed";
const listeners = new Set<() => void>();

/** Remembered collapsed state (desktop only). */
function useCollapsed() {
  const collapsed = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => {
      try {
        return localStorage.getItem(KEY) === "1";
      } catch {
        return false;
      }
    },
    () => false,
  );
  const toggle = () => {
    try {
      localStorage.setItem(KEY, collapsed ? "0" : "1");
    } catch {
      /* storage blocked — ignore */
    }
    listeners.forEach((l) => l());
  };
  return [collapsed, toggle] as const;
}

/**
 * Navy sidebar. Desktop (≥1200): 240px, collapsible to a 72px rail.
 * Tablet (768–1199): always the 72px icon rail. Hidden on mobile (bottom tab bar instead).
 */
export function Sidebar() {
  const [collapsed, toggle] = useCollapsed();
  const { companyName } = useSession();
  const { t } = useI18n();
  return (
    // Outer column paints navy for the full page height; inner panel stays in view while scrolling.
    <div className={cn("hidden shrink-0 bg-navy md:block", "w-[72px]", collapsed ? "xl:w-[72px]" : "xl:w-60")}>
    <aside className="sticky top-0 flex h-dvh flex-col text-white" aria-label="Main navigation">
      <div className={cn("flex h-16 items-center border-b border-white/10 px-4", collapsed ? "xl:justify-center xl:px-0" : "xl:px-5", "justify-center xl:justify-start")}>
        <Link href="/" className="rounded-lg focus-visible:ring-2 focus-visible:ring-white">
          <Logo collapsed onDark className={cn(!collapsed && "xl:hidden")} />
          {!collapsed && <Logo onDark subtitle={companyName} className="hidden xl:flex" />}
        </Link>
      </div>
      <NavList collapsed={collapsed} />
      <div className="hidden border-t border-white/10 p-3 xl:block">
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm text-white/70 hover:bg-white/10 hover:text-white",
            collapsed && "justify-center px-0",
          )}
          aria-label={t(collapsed ? "Expand sidebar" : "Collapse sidebar")}
        >
          {collapsed ? <PanelLeftOpen className="size-5" /> : <PanelLeftClose className="size-5" />}
          {!collapsed && t("Collapse sidebar")}
        </button>
      </div>
    </aside>
    </div>
  );
}

/** Nav list, shared by the sidebar and the mobile menu sheet. `full` forces labels (mobile sheet). */
export function NavList({ collapsed = false, full = false, onNavigate }: { collapsed?: boolean; full?: boolean; onNavigate?: () => void }) {
  const user = useSession();
  const pathname = usePathname();
  const items = navFor(user);
  // Labels: always in the mobile sheet; on desktop unless collapsed; never on the tablet rail.
  const labelCls = full ? "" : collapsed ? "hidden" : "hidden xl:inline";
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4">
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink item={item} active={isActive(pathname, item.href)} labelCls={labelCls} iconOnly={!full} onNavigate={onNavigate} />
            {item.children && (full || !collapsed) && (
              <DepartmentList item={item} pathname={pathname} full={full} onNavigate={onNavigate} />
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function NavLink({ item, active, labelCls, iconOnly, onNavigate }: { item: NavItem; active: boolean; labelCls: string; iconOnly: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  const href = item.children ? item.children[0].href : item.href;
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-11 items-center gap-3 rounded-lg px-3 text-[15px] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
        iconOnly && "max-xl:justify-center max-xl:px-0",
        active ? "bg-primary-soft/15 font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white",
      )}
    >
      {active && <span aria-hidden className="absolute top-2 bottom-2 left-0 w-[3px] rounded-r bg-[#5FA8FF]" />}
      <item.icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
      <span className={labelCls}>{t(item.label)}</span>
      {iconOnly && <span className="sr-only xl:hidden">{t(item.label)}</span>}
    </Link>
  );
  if (!iconOnly) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="xl:hidden">
        {t(item.label)}
      </TooltipContent>
    </Tooltip>
  );
}

function DepartmentList({ item, pathname, full, onNavigate }: { item: NavItem; pathname: string; full: boolean; onNavigate?: () => void }) {
  const { t } = useI18n();
  const { data } = useDashboard();
  return (
    <ul className={cn("mt-1 space-y-0.5 pl-4", !full && "hidden xl:block")}>
      {item.children!.map((c) => {
        const active = isActive(pathname, c.href);
        const Icon = STAGE_ICON[c.stage];
        const w = data?.workload.find((x) => x.stage === c.stage);
        const count = w ? w.waiting + w.inProgress + w.blocked : undefined;
        return (
          <li key={c.href}>
            <Link
              href={c.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-lg pr-2 pl-4 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none",
                active ? "bg-primary-soft/15 font-semibold text-white" : "text-white/65 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="flex-1 truncate">{t(c.label)}</span>
              {count !== undefined && count > 0 && (
                <span className="tabular rounded-full bg-white/10 px-2 text-xs text-white/80">{count}</span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
