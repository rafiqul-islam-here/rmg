import { CalendarCheck, PackageCheck, Printer, Scissors, Scroll, Shirt, Sparkles, type LucideIcon } from "lucide-react";
import type { StageKey } from "@/lib/types";

export const STAGE_ICON: Record<StageKey, LucideIcon> = {
  fabric: Scroll,
  ppm: CalendarCheck,
  cutting: Scissors,
  print: Printer,
  emb: Sparkles,
  sewing: Shirt,
  gpq: PackageCheck,
};
