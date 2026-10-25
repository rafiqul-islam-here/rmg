"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Bell, ClipboardCheck, Menu, Package } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNotifications } from "@/lib/api/hooks";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "@/components/tf/comments";
import { useSession } from "@/components/tf/session";
import { isActive } from "./nav";
import { Logo } from "./logo";
import { NavList } from "./sidebar";
import { LanguageToggle } from "./top-bar";

/** Mobile (< 768px): bottom tab bar — My Work · Orders · Notifications · Menu. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [sheet, setSheet] = useState<"notifications" | "menu" | null>(null);
  const { companyName } = useSession();
  const notifications = useNotifications();

  const tab = "flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium";
  const links = [
    { href: "/my-work", label: "My Work", icon: ClipboardCheck },
    { href: "/orders", label: "Orders", icon: Package },
  ];

  return (
    <>
      <nav
        aria-label="Main navigation"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {links.map((l) => {
          const active = isActive(pathname, l.href);
          return (
            <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined} className={cn(tab, active ? "text-primary" : "text-muted-foreground")}>
              <l.icon className="size-6" strokeWidth={active ? 2.25 : 1.75} aria-hidden />
              {t(l.label)}
            </Link>
          );
        })}
        <button type="button" onClick={() => setSheet("notifications")} className={cn(tab, "relative text-muted-foreground")}>
          <Bell className="size-6" strokeWidth={1.75} aria-hidden />
          {t("Notifications")}
          {(notifications.data?.items.length ?? 0) > 0 && (
            <span className="absolute top-2 left-1/2 ml-2 size-2.5 rounded-full bg-danger" aria-hidden />
          )}
        </button>
        <button type="button" onClick={() => setSheet("menu")} className={cn(tab, "text-muted-foreground")}>
          <Menu className="size-6" strokeWidth={1.75} aria-hidden />
          {t("Menu")}
        </button>
      </nav>

      <Sheet open={sheet === "menu"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="left" className="w-[85vw] max-w-xs gap-0 border-0 bg-navy p-0 text-white">
          <SheetHeader className="h-16 justify-center border-b border-white/10 px-4">
            <SheetTitle asChild>
              <div>
                <Logo onDark subtitle={companyName} />
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">Main menu</SheetDescription>
          </SheetHeader>
          <NavList full onNavigate={() => setSheet(null)} />
          <div className="border-t border-white/10 p-4">
            <LanguageToggle className="w-fit bg-white" />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={sheet === "notifications"} onOpenChange={(o) => !o && setSheet(null)}>
        <SheetContent side="bottom" className="max-h-[85dvh] gap-0 rounded-t-2xl bg-surface p-0">
          <SheetHeader className="border-b border-border px-4 py-4">
            <SheetTitle>{t("Notifications")}</SheetTitle>
            <SheetDescription className="sr-only">Latest updates</SheetDescription>
          </SheetHeader>
          <div className="overflow-y-auto p-4">
            <ActivityFeed
              items={notifications.data?.items}
              isLoading={notifications.isLoading}
              error={notifications.error}
              onRetry={() => notifications.mutate()}
              showOrder
              emptyText="You're all caught up."
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
