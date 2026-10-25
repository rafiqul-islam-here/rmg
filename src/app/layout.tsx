import type { Metadata, Viewport } from "next";
import { Hind_Siliguri, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider, type Lang } from "@/lib/i18n";
import { LANG_COOKIE } from "@/lib/session";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bangla = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bangla",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "ThreadFlow", template: "%s · ThreadFlow" },
  description: "Production. Connected. — garments production tracking.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0B1F3A",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = ((await cookies()).get(LANG_COOKIE)?.value === "bn" ? "bn" : "en") as Lang;
  return (
    <html lang={lang} className={`${inter.variable} ${bangla.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2">
          Skip to content
        </a>
        <I18nProvider initialLang={lang}>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster />
        </I18nProvider>
      </body>
    </html>
  );
}
