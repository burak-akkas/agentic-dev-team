// Time helpers. No React and no board imports.

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

// "just now", "5 minutes ago", "yesterday", "2 weeks ago" ... Never throws:
// future dates read "just now" and an unparsable string is returned as is.
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return iso;
  }
  const seconds = Math.floor((now.getTime() - time) / 1000);
  if (seconds < 45) {
    return "just now";
  }
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * DAY],
    ["month", 30 * DAY],
    ["week", 7 * DAY],
    ["day", DAY],
    ["hour", HOUR],
    ["minute", MINUTE],
  ];
  for (const [unit, size] of units) {
    if (seconds >= size) {
      return formatter.format(-Math.floor(seconds / size), unit);
    }
  }
  // 45 to 59 seconds
  return formatter.format(-1, "minute");
}
