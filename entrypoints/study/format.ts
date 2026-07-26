const groups = new Intl.NumberFormat('en-US');

/** 12480 → "12,480" */
export function n(value: number): string {
  return groups.format(Math.max(0, Math.round(value || 0)));
}

/** "4 minutes ago" — used for the last keystroke, so it stays conversational. */
export function ago(timestamp: number): string {
  if (!timestamp) return 'not yet today';
  const secs = Math.max(0, (Date.now() - timestamp) / 1000);
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

const dayMonth = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

/** "Mar 4" */
export function shortDate(timestamp: number): string {
  return dayMonth.format(new Date(timestamp));
}

export function pct(part: number, whole: number): number {
  if (!whole) return 0;
  return Math.min(100, Math.max(0, (part / whole) * 100));
}

/**
 * Pick ink or paper for text sitting on an arbitrary spine colour.
 * Spine colours come from state and can be anything, so this has to be real.
 */
export function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i.exec((hex || '').trim());
  if (!m) return '#faf8f3';
  let h = m[1];
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? '#211d17' : '#faf8f3';
}

/** Deterministic 0..1 from a string — for per-book variation that never jitters. */
export function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}
