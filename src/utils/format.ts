const largeFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const midFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const subDollarFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const microFormatter = new Intl.NumberFormat('en-US', {
  useGrouping: false,
  minimumSignificantDigits: 2,
  maximumSignificantDigits: 8,
});

/**
 * Format a crypto price with adaptive precision so both BTC-scale and micro-cap
 * coins retain meaningful digits without rounding small prices to 0.00.
 */
export function formatPrice(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';

  const abs = Math.abs(value);
  if (abs >= 1000) return largeFormatter.format(value);
  if (abs >= 1) return midFormatter.format(value);
  if (abs >= 0.01) return subDollarFormatter.format(value);
  return microFormatter.format(value);
}

/**
 * Format a percentage value with 2 decimal places and optional leading '+' sign.
 */
export function formatPercent(value: number, signed = false): string {
  if (!Number.isFinite(value)) return '—';
  const normalized = Math.abs(value) < 0.005 ? 0 : value;
  const fixed = normalized.toFixed(2);
  if (signed && normalized > 0) return `+${fixed}%`;
  return `${fixed}%`;
}

/**
 * Format a Unix millisecond timestamp as `HH:mm · dd/MM/yyyy` in the local timezone.
 */
export function formatDateTimeVi(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) return '—';
  const date = new Date(timestampMs);
  if (Number.isNaN(date.getTime())) return '—';

  const pad = (n: number): string => String(n).padStart(2, '0');
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  const dd = pad(date.getDate());
  const MM = pad(date.getMonth() + 1);
  const yyyy = date.getFullYear();

  return `${hh}:${mm} · ${dd}/${MM}/${yyyy}`;
}
