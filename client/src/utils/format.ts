export function formatDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function formatBytes(bytes?: number): string | null {
  if (bytes === undefined) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatMs(ms?: number): string | null {
  if (ms === undefined) return null;
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`;
}

export function formatCost(usd?: number): string | null {
  if (usd === undefined) return null;
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

export interface ConversationGroup<T> {
  label: string;
  items: T[];
}

/** Groups items (newest first) into Today / Yesterday / Previous 7 days / Earlier. */
export function groupByRecency<T extends { updatedAt: string }>(items: T[], now = new Date()): ConversationGroup<T>[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = 86_400_000;
  const buckets: ConversationGroup<T>[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Earlier", items: [] },
  ];
  const sorted = [...items].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  for (const item of sorted) {
    const t = Date.parse(item.updatedAt);
    const idx = Number.isNaN(t) || t < startOfToday - 6 * day ? 3 : t >= startOfToday ? 0 : t >= startOfToday - day ? 1 : 2;
    buckets[idx]?.items.push(item);
  }
  return buckets.filter((b) => b.items.length > 0);
}
