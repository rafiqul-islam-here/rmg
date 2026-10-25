"use client";

import { SWRConfig } from "swr";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api/client";
import type { SessionUser } from "@/lib/types";
import { SessionProvider } from "@/components/tf/session";
import { OfflineBanner } from "@/components/tf/states";
import { MobileTabBar } from "./mobile-nav";
import { Sidebar } from "./sidebar";
import { TopBar } from "./top-bar";

/** Navy sidebar + white top bar + light gray content (max 1280px, 24px padding). */
export function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <SessionProvider user={user}>
      <SWRConfig
        value={{
          onError: (err) => {
            if (err instanceof ApiError && err.status === 401) router.replace("/login");
          },
        }}
      >
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <TopBar />
            <OfflineBanner />
            <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 pt-4 pb-24 md:px-6 md:pt-6 md:pb-10">
              {children}
            </main>
          </div>
        </div>
        <MobileTabBar />
      </SWRConfig>
    </SessionProvider>
  );
}
