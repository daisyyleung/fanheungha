import { HttpError } from "@/db";
import { IMPROVEMENT_STATUSES, type ImprovementStatus } from "@/lib/improvement-data";
import { inferSeason, type Season } from "@/lib/packing-templates";
import { DAY_PERIODS, ITINERARY_CATEGORIES, TRIP_MODES, type DayPeriod, type ItineraryCategory, type TripMode } from "@/lib/trip-log";

const seasons = new Set<Season>(["spring", "summer", "autumn", "winter"]);
const modes = new Set<TripMode>(TRIP_MODES);
const itineraryCategories = new Set<ItineraryCategory>(ITINERARY_CATEGORIES);
const dayPeriods = new Set<DayPeriod>(DAY_PERIODS);
const improvementStatuses = new Set<ImprovementStatus>(IMPROVEMENT_STATUSES);

export function stringField(value: unknown, name: string, options: { max: number; required?: boolean } = { max: 400 }): string {
  if (typeof value !== "string") {
    if (options.required === false && (value === undefined || value === null)) return "";
    throw new HttpError(400, `${name} 格式不正確。`);
  }
  const trimmed = value.trim();
  if (options.required !== false && !trimmed) throw new HttpError(400, `請填寫${name}。`);
  if (trimmed.length > options.max) throw new HttpError(400, `${name}太長了。`);
  return trimmed;
}

/** Normalize a place/group key without changing the display value kept in D1. */
export function normalizePlaceName(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}

export function placeNameField(value: unknown): { displayName: string; normalizedKey: string } {
  const displayName = stringField(value, "店舖", { max: 120, required: false }).normalize("NFKC").replace(/\s+/gu, " ").trim();
  const shownName = displayName || "未分類";
  return { displayName: shownName, normalizedKey: normalizePlaceName(displayName) };
}

export function dateField(value: unknown, name: string): string {
  const date = stringField(value, name, { max: 10 });
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new HttpError(400, `${name}格式不正確。`);
  }
  return date;
}

export function timeField(value: unknown, name: string): string {
  const time = stringField(value, name, { max: 5, required: false });
  if (time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw new HttpError(400, `${name}必須使用 24 小時 HH:mm 格式。`);
  }
  return time;
}

export function seasonField(value: unknown, startDate: string): Season {
  if (value === undefined || value === null || value === "") return inferSeason(startDate);
  const season = stringField(value, "季節", { max: 10 });
  if (!seasons.has(season as Season)) throw new HttpError(400, "季節選項不正確。");
  return season as Season;
}

export function modeField(value: unknown): TripMode {
  if (value === undefined || value === null || value === "") return "plan";
  const mode = stringField(value, "旅程模式", { max: 10 });
  if (!modes.has(mode as TripMode)) throw new HttpError(400, "旅程模式選項不正確。");
  return mode as TripMode;
}

export function itineraryCategoryField(value: unknown): ItineraryCategory {
  if (value === undefined || value === null || value === "") return "other";
  const category = stringField(value, "行程分類", { max: 20 });
  if (!itineraryCategories.has(category as ItineraryCategory)) throw new HttpError(400, "行程分類選項不正確。");
  return category as ItineraryCategory;
}

export function dayPeriodField(value: unknown): DayPeriod {
  if (value === undefined || value === null || value === "") return "allDay";
  const period = stringField(value, "時段", { max: 20 });
  if (!dayPeriods.has(period as DayPeriod)) throw new HttpError(400, "時段選項不正確。");
  return period as DayPeriod;
}

export function improvementStatusField(value: unknown): ImprovementStatus {
  if (value === undefined || value === null || value === "") return "open";
  const status = stringField(value, "狀態", { max: 10 });
  if (!improvementStatuses.has(status as ImprovementStatus)) throw new HttpError(400, "改善事項狀態不正確。");
  return status as ImprovementStatus;
}

export function dateWithinRange(value: string, startDate: string, endDate: string, name: string): string {
  if (value < startDate || value > endDate) throw new HttpError(400, `${name}必須在旅程日期範圍內。`);
  return value;
}

export function safeLink(value: unknown, label = "購物連結"): string {
  const link = stringField(value, "連結", { max: 1_000, required: false });
  if (!link) return "";
  let url: URL;
  try {
    url = new URL(link);
  } catch {
    throw new HttpError(400, `${label}必須是有效的 http 或 https 網址。`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new HttpError(400, `${label}只接受 http 或 https 網址。`);
  }
  return url.toString();
}

export function booleanField(value: unknown, name: string): boolean {
  if (typeof value !== "boolean") throw new HttpError(400, `${name}格式不正確。`);
  return value;
}

export function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "請提供有效的資料內容。");
  return value as Record<string, unknown>;
}
