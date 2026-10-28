import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./time";

const now = new Date("2026-10-28T12:00:00.000Z");
const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

describe("formatRelativeTime", () => {
  it.each([
    [0, "just now"],
    [44, "just now"],
    [45, "1 minute ago"],
    [59, "1 minute ago"],
    [60, "1 minute ago"],
    [5 * 60, "5 minutes ago"],
    [59 * 60, "59 minutes ago"],
    [60 * 60, "1 hour ago"],
    [3 * 3600, "3 hours ago"],
    [24 * 3600, "yesterday"],
    [3 * 86400, "3 days ago"],
    [7 * 86400, "last week"],
    [14 * 86400, "2 weeks ago"],
    [30 * 86400, "last month"],
    [90 * 86400, "3 months ago"],
    [365 * 86400, "last year"],
    [3 * 365 * 86400, "3 years ago"],
  ])("%i seconds ago reads %s", (seconds, expected) => {
    expect(formatRelativeTime(ago(seconds), now)).toBe(expected);
  });

  it("treats future dates as just now", () => {
    expect(formatRelativeTime(ago(-3600), now)).toBe("just now");
  });

  it("returns invalid input unchanged without throwing", () => {
    expect(formatRelativeTime("not a date", now)).toBe("not a date");
  });
});
