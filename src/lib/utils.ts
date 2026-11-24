import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getActiveCurrency(): string {
  try {
    const raw = localStorage.getItem('island_settings');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.currency && typeof parsed.currency === 'string') {
        return parsed.currency;
      }
    }
  } catch {
    // Fallback to USD if localStorage is unavailable or malformed
  }
  return 'USD';
}

export function formatCurrency(value: number, currencyOverride?: string) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const currency = currencyOverride || getActiveCurrency();
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue);
  } catch {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(safeValue);
  }
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(Number.isFinite(value) ? value : 0);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format((Number.isFinite(value) ? value : 0) / 100);
}

export function parseLocalDate(dateStr?: string | null): Date {
  if (!dateStr) return new Date(NaN);
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);
    return new Date(year, month - 1, day);
  }
  return new Date(dateStr);
}

export function formatLocalDate(date: Date = new Date()): string {
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return formatLocalDate(now);
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function sanitizeCsvCell(value: unknown): string {
  const raw = String(value ?? '');
  const isPureNumber = /^-?\d+(\.\d+)?$/.test(raw.trim());
  const neutralized = !isPureNumber && /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${neutralized.replace(/"/g, '""')}"`;
}

