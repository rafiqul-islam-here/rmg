/** Formatting helpers. All times are shown in Bangladesh time (Asia/Dhaka), 12-hour. */

const TZ = "Asia/Dhaka";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const shortDateFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "short" });

/** "30 Oct 2026" */
export function formatDate(iso: string) {
  return dateFmt.format(new Date(iso));
}

/** "2:15 PM" */
export function formatTime(iso: string) {
  return timeFmt.format(new Date(iso));
}

/** "30 Oct 2026, 2:15 PM" */
export function formatDateTime(iso: string) {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

/** Card format from the UI documentation: "17 Oct, 2026 05:43 PM". */
export function formatCardTime(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")}, ${get("year")} ${get("hour")}:${get("minute")} ${get("dayPeriod").toUpperCase()}`;
}

/** Stamp format used on the entry form and dispatch screens: "2026-10-23 10:45:00". */
export function formatStamp(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")} ${get("hour") === "24" ? "00" : get("hour")}:${get("minute")}:${get("second")}`;
}

/** "Today, 2:15 PM" / "Yesterday, 9:00 AM" / "22 Oct, 2:15 PM" */
export function formatDayTime(iso: string, now = Date.now()) {
  const day = dayKey(iso);
  if (day === dayKey(new Date(now).toISOString())) return `Today, ${formatTime(iso)}`;
  if (day === dayKey(new Date(now - 86_400_000).toISOString())) return `Yesterday, ${formatTime(iso)}`;
  return `${shortDateFmt.format(new Date(iso))}, ${formatTime(iso)}`;
}

/** Relative for 7 days ("5 min ago", "3h ago", "2d ago"), then the full date. */
export function formatRelative(iso: string, now = Date.now()) {
  const diff = Math.max(0, now - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(iso);
}

/** "3d 4h" / "2h 15m" / "12m" */
export function formatDuration(ms: number) {
  const totalMin = Math.max(0, Math.floor(ms / 60_000));
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

/** Calendar day in Dhaka, "2026-10-23". */
export function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));
}

export function isToday(iso: string, now = Date.now()) {
  return dayKey(iso) === dayKey(new Date(now).toISOString());
}

/** Value for <input type="datetime-local"> in Dhaka time. */
export function toDateTimeLocal(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}

/** Parse a datetime-local value entered in Dhaka time (UTC+6, no DST) to ISO. */
export function fromDateTimeLocal(value: string) {
  return new Date(`${value}:00+06:00`).toISOString();
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}
