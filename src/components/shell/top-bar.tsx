"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, Building, ChevronDown, ChevronRight, LogOut, Search, UserRoundCog } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api/client";
import { useNotifications } from "@/lib/api/hooks";
import { initials } from "@/lib/format";
import { useI18n, type Lang } from "@/lib/i18n";
import { homePathFor } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "@/components/tf/comments";
import { useSession } from "@/components/tf/session";
import { crumbsFor } from "./nav";
import { Logo } from "./logo";

/** White 64px top bar: breadcrumb · search · EN/বাংলা · bell · user menu. */
export function TopBar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const crumbs = crumbsFor(pathname);
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 xl:px-6">
      <Link href="/" className="md:hidden" aria-label="ThreadFlow home">
        <Logo collapsed />
      </Link>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1 md:flex-none">
        <ol className="flex min-w-0 items-center gap-1 text-[15px]">
          {crumbs.map((c, i) => (
            <li key={c} className="flex min-w-0 items-center gap-1">
              {i > 0 && <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
              <span className={cn("truncate", i === crumbs.length - 1 ? "font-semibold text-navy" : "text-muted-foreground")}>
                {t(c)}
              </span>
            </li>
          ))}
        </ol>
      </nav>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <CompanyChip />
        <LanguageToggle className="hidden sm:flex" />
        <NotificationsBell />
        <UserMenu />
      </div>
    </header>
  );
}

function GlobalSearch() {
  const router = useRouter();
  const { t } = useI18n();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="relative mx-auto hidden w-full max-w-md md:block"
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/orders${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ""}`);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("Search orders, buyer, color…")}
        aria-label={t("Search")}
        className="h-10 w-full rounded-md border border-border bg-background pr-3 pl-9 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:bg-surface focus:ring-2 focus:ring-primary/25"
      />
    </form>
  );
}

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useI18n();
  const opts: { value: Lang; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "bn", label: "বাংলা" },
  ];
  return (
    <div role="group" aria-label="Language" className={cn("flex h-10 items-center rounded-md border border-border bg-background p-1", className)}>
      {opts.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          className={cn(
            "h-8 min-w-11 rounded px-2 text-[13px] font-semibold transition-colors",
            lang === o.value ? "bg-surface text-primary shadow-sm" : "text-muted-foreground hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Count of unread = events since the panel was last opened (kept per device). */
function NotificationsBell() {
  const { t } = useI18n();
  const { data, isLoading, error, mutate } = useNotifications();
  const [seen, setSeen] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return localStorage.getItem("tf.notif.seen");
    } catch {
      return null;
    }
  });
  const unread = data?.items.filter((e) => !seen || e.at > seen).length ?? 0;

  return (
    <Popover
      onOpenChange={(open) => {
        if (open && data?.items[0]) {
          const latest = data.items[0].at;
          setSeen(latest);
          try {
            localStorage.setItem("tf.notif.seen", latest);
          } catch {
            /* ignore */
          }
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hidden md:inline-flex" aria-label={`${t("Notifications")}${unread ? `, ${unread} new` : ""}`}>
          <Bell className="size-5" />
          {unread > 0 && (
            <span className="tabular absolute top-1 right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] max-w-[calc(100vw-2rem)] p-0 shadow-pop">
        <div className="border-b border-border px-4 py-3">
          <p className="font-semibold text-ink">{t("Notifications")}</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4">
          <ActivityFeed items={data?.items} isLoading={isLoading} error={error} onRetry={() => mutate()} showOrder emptyText="You're all caught up." />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** The signed-in company, shown on wider screens (the sidebar shows it too). */
function CompanyChip() {
  const { companyName } = useSession();
  return (
    <span
      className="hidden h-10 max-w-56 items-center gap-2 rounded-md border border-border bg-background px-3 text-[13px] font-semibold text-ink lg:inline-flex"
      title={`Company: ${companyName}`}
    >
      <Building className="size-4 shrink-0 text-primary" aria-hidden />
      <span className="truncate">{companyName}</span>
    </span>
  );
}

const DEMO_ROLES = [
  { id: "u-admin", label: "Admin" },
  { id: "u-merch", label: "Merchandiser" },
  { id: "u-manager", label: "Production Manager" },
  { id: "u-sup-fab", label: "Fabric Supervisor" },
  { id: "u-sup-cut", label: "Cutting Supervisor" },
  { id: "u-sup-sew", label: "Sewing Supervisor" },
];

function UserMenu() {
  const user = useSession();
  const { t } = useI18n();
  const router = useRouter();

  async function signOut() {
    await api.logout().catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  async function switchTo(id: string) {
    const next = await api.login({ userId: id });
    window.location.assign(homePathFor(next));
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-11 items-center gap-2 rounded-lg pr-1 pl-1 hover:bg-background focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none sm:pr-2"
          aria-label={`Account menu for ${user.name}`}
        >
          <Avatar className="size-9">
            <AvatarFallback className="bg-primary text-sm font-semibold text-white">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden text-left leading-tight lg:block">
            <span className="block text-sm font-semibold text-ink">{user.name}</span>
            <span className="block text-xs text-muted-foreground">{user.title}</span>
          </span>
          <ChevronDown className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 shadow-pop">
        <DropdownMenuLabel className="font-normal">
          <p className="font-semibold text-ink">{user.name}</p>
          <p className="truncate text-xs font-medium text-primary">{user.companyName}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {!process.env.NEXT_PUBLIC_API_BASE_URL && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="h-10">
              <UserRoundCog className="size-4" /> Switch demo role
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {DEMO_ROLES.map((r) => (
                <DropdownMenuItem key={r.id} disabled={r.id === user.id} onSelect={() => void switchTo(r.id)} className="h-10">
                  {r.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        <DropdownMenuItem onSelect={() => void signOut()} className="h-10">
          <LogOut className="size-4" /> {t("Sign out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
