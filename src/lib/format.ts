export function pts(n: number): string {
  return `${n.toLocaleString("en-US")} pts`;
}

export function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function timeUntil(date: Date): string {
  const ms = date.getTime() - Date.now();
  if (ms <= 0) return "closed";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function fmtDate(date: Date): string {
  return date.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
}
