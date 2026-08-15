import { isoDateInTimeZone } from "@/lib/dashboard-logic";
import type { Season } from "@/lib/packing-templates";

export async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: { "content-type": "application/json", ...(options?.headers ?? {}) },
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(data.error ?? "暫時未能完成這項操作。");
  return data;
}

export function todayIso(): string {
  return isoDateInTimeZone(new Date(), "Asia/Hong_Kong");
}

export function inferSeasonForDate(date: string): Season {
  const month = Number(date.slice(5, 7));
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function formatDateRange(start: string, end: string): string {
  return `${start.replaceAll("-", "/")} — ${end.replaceAll("-", "/")}`;
}
