"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { LANG_COOKIE } from "./session";

export type Lang = "en" | "bn";

/**
 * Bangla labels, keyed by the English text. Missing keys fall back to English.
 * Final wording to be confirmed by factory users (UI guideline §8.3).
 * Order codes, style codes and numbers stay in Latin digits.
 */
const BN: Record<string, string> = {
  // navigation
  Dashboard: "ড্যাশবোর্ড",
  Orders: "অর্ডার",
  "My Work": "আমার কাজ",
  Departments: "বিভাগ",
  Reports: "রিপোর্ট",
  Settings: "সেটিংস",
  Notifications: "নোটিফিকেশন",
  Menu: "মেনু",
  "Sign out": "সাইন আউট",
  "Collapse sidebar": "সাইডবার ছোট করুন",
  "Expand sidebar": "সাইডবার বড় করুন",
  // stages
  Fabric: "ফেব্রিক",
  "PP Meeting": "পিপি মিটিং",
  Cutting: "কাটিং",
  Print: "প্রিন্ট",
  Emb: "এমব্রয়ডারি",
  Sewing: "সেলাই",
  GPQ: "জিপিকিউ",
  // statuses
  Created: "তৈরি",
  Pending: "অপেক্ষমাণ",
  Ready: "প্রস্তুত",
  "In progress": "চলমান",
  "On hold": "স্থগিত",
  Blocked: "আটকে আছে",
  "Rework required": "পুনরায় কাজ দরকার",
  Completed: "সম্পন্ন",
  "Fabric delivered": "ফেব্রিক ডেলিভারি হয়েছে",
  "Fabric not found": "ফেব্রিক পাওয়া যায়নি",
  "Sent to Sewing": "সেলাইয়ে পাঠানো হয়েছে",
  "Sent to Print": "প্রিন্টে পাঠানো হয়েছে",
  "EMB to print": "এমব্রয়ডারিতে পাঠানো হয়েছে",
  "Sent to GPQ": "জিপিকিউতে পাঠানো হয়েছে",
  Dispatched: "পাঠানো হয়েছে",
  "Not needed": "দরকার নেই",
  "Sent to PPM": "পিপিএম-এ পাঠানো হয়েছে",
  "PPM completed": "পিপিএম সম্পন্ন",
  "Waiting for PPM": "পিপিএম-এর অপেক্ষায়",
  "Completed today": "আজ সম্পন্ন",
  Findings: "ফাইন্ডিংস",
  // actions
  "New order": "নতুন অর্ডার",
  Start: "শুরু করুন",
  Complete: "সম্পন্ন করুন",
  Resume: "আবার শুরু",
  "Update fabric": "ফেব্রিক আপডেট",
  Dispatch: "পাঠিয়ে দিন",
  "View order": "অর্ডার দেখুন",
  "View all": "সব দেখুন",
  "Try again": "আবার চেষ্টা করুন",
  Cancel: "বাতিল",
  Save: "সংরক্ষণ",
  Post: "পোস্ট",
  "Report a problem": "সমস্যা জানান",
  "Clear filters": "ফিল্টার মুছুন",
  "Sign in": "সাইন ইন",
  // common
  "To do": "করণীয়",
  "Done today": "আজ সম্পন্ন",
  Search: "খুঁজুন",
  "Search orders, buyer, color…": "অর্ডার, বায়ার, রং খুঁজুন…",
  "Production Overview": "উৎপাদন সারসংক্ষেপ",
  "Comments & activity": "মন্তব্য ও কার্যকলাপ",
  Buyer: "বায়ার",
  Colors: "রং",
  Embellishment: "এমবেলিশমেন্ট",
  "You're offline. Changes will be saved when you reconnect.": "আপনি অফলাইনে আছেন। সংযোগ ফিরলে পরিবর্তন সংরক্ষণ হবে।",
  "Good morning": "শুভ সকাল",
  "Good afternoon": "শুভ অপরাহ্ন",
  "Good evening": "শুভ সন্ধ্যা",
};

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (en: string) => string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
  }, []);

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t: (en) => (lang === "bn" ? (BN[en] ?? en) : en) }),
    [lang, setLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
