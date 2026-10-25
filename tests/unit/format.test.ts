import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatCardTime,
  formatDate,
  formatDayTime,
  formatDuration,
  formatNumber,
  formatRelative,
  formatStamp,
  formatTime,
  fromDateTimeLocal,
  initials,
  isToday,
  toDateTimeLocal,
} from "@/lib/format";

// 2026-10-17 11:43 UTC = 05:43 PM in Dhaka (UTC+6). Tests run with TZ=UTC.
const ISO = "2026-10-17T11:43:00.000Z";

describe("Bangladesh time formats", () => {
  it("card format from the UI documentation", () => {
    expect(formatCardTime(ISO)).toBe("17 Oct, 2026 05:43 PM");
  });

  it("stamp format for the entry form / dispatch screens", () => {
    expect(formatStamp(ISO)).toBe("2026-10-17 17:43:00");
    expect(formatStamp("2026-10-22T18:00:00.000Z")).toBe("2026-10-23 00:00:00"); // midnight, not "24"
  });

  it("guideline date and 12-hour time", () => {
    expect(formatDate(ISO)).toBe("17 Oct 2026");
    expect(formatTime(ISO)).toBe("5:43 PM");
  });

  it("day boundaries use Dhaka, not UTC", () => {
    // 20:30 UTC on the 17th is already the 18th in Dhaka.
    expect(dayKey("2026-10-17T20:30:00.000Z")).toBe("2026-10-18");
    expect(isToday("2026-10-17T20:30:00.000Z", Date.parse("2026-10-18T03:00:00.000Z"))).toBe(true);
  });

  it("today / yesterday labels", () => {
    const now = Date.parse("2026-10-18T06:00:00.000Z");
    expect(formatDayTime("2026-10-18T03:00:00.000Z", now)).toBe("Today, 9:00 AM");
    expect(formatDayTime("2026-10-17T03:00:00.000Z", now)).toBe("Yesterday, 9:00 AM");
    expect(formatDayTime("2026-10-10T03:00:00.000Z", now)).toBe("10 Oct, 9:00 AM");
  });

  it("datetime-local round trip in Dhaka time", () => {
    expect(toDateTimeLocal(ISO)).toBe("2026-10-17T17:43");
    expect(fromDateTimeLocal("2026-10-17T17:43")).toBe(ISO);
    expect(toDateTimeLocal("2026-10-22T18:05:00.000Z")).toBe("2026-10-23T00:05");
  });
});

describe("relative and durations", () => {
  const now = Date.parse("2026-10-20T12:00:00.000Z");
  it.each([
    [now - 10_000, "Just now"],
    [now - 5 * 60_000, "5 min ago"],
    [now - 3 * 3_600_000, "3h ago"],
    [now - 2 * 86_400_000, "2d ago"],
  ])("relative %#", (t, expected) => {
    expect(formatRelative(new Date(t).toISOString(), now)).toBe(expected);
  });

  it("switches to the full date after 7 days", () => {
    expect(formatRelative("2026-10-01T12:00:00.000Z", now)).toBe("01 Oct 2026");
  });

  it("durations", () => {
    expect(formatDuration(12 * 60_000)).toBe("12m");
    expect(formatDuration((2 * 60 + 15) * 60_000)).toBe("2h 15m");
    expect(formatDuration((3 * 24 + 4) * 3_600_000)).toBe("3d 4h");
    expect(formatDuration(-5)).toBe("0m");
  });

  it("numbers and initials", () => {
    expect(formatNumber(2000)).toBe("2,000");
    expect(initials("Rahim  Mia")).toBe("RM");
    expect(initials("Karim Hossain Khan")).toBe("KH");
  });
});
