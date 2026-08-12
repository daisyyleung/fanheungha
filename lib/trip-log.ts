export const TRIP_MODES = ["plan", "journal"] as const;
export type TripMode = (typeof TRIP_MODES)[number];

export const ITINERARY_CATEGORIES = [
  "weather",
  "transport",
  "stay",
  "meal",
  "sightseeing",
  "shopping",
  "logistics",
  "highlight",
  "other",
] as const;
export type ItineraryCategory = (typeof ITINERARY_CATEGORIES)[number];

export const DAY_PERIODS = ["allDay", "morning", "afternoon", "evening"] as const;
export type DayPeriod = (typeof DAY_PERIODS)[number];

export const DAY_PERIOD_LABELS: Record<DayPeriod, string> = {
  allDay: "全日",
  morning: "早上",
  afternoon: "下午",
  evening: "晚上",
};

export const CATEGORY_LABELS: Record<ItineraryCategory, string> = {
  weather: "天氣",
  transport: "交通",
  stay: "住宿",
  meal: "餐飲",
  sightseeing: "景點",
  shopping: "購物",
  logistics: "提醒",
  highlight: "今次記住",
  other: "其他",
};

export const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"] as const;

export type ItineraryLike = {
  id: string;
  itemDate: string;
  itemTime: string;
  title: string;
  location: string;
  note: string;
  category: ItineraryCategory;
  dayPeriod: DayPeriod;
  sortOrder: number;
};

export type ItineraryDay<T extends ItineraryLike = ItineraryLike> = {
  date: string;
  weekday: string;
  weather: T | null;
  entries: T[];
};

export function weekdayLabelUtc(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  return WEEKDAY_LABELS[parsed.getUTCDay()];
}

export function groupItineraryByDate<T extends ItineraryLike>(items: T[]): ItineraryDay<T>[] {
  const sorted = [...items].sort((a, b) => {
    const dateOrder = a.itemDate.localeCompare(b.itemDate);
    if (dateOrder !== 0) return dateOrder;
    return a.sortOrder - b.sortOrder || a.itemTime.localeCompare(b.itemTime) || a.id.localeCompare(b.id);
  });
  const byDate = new Map<string, T[]>();
  for (const item of sorted) {
    const day = byDate.get(item.itemDate);
    if (day) day.push(item);
    else byDate.set(item.itemDate, [item]);
  }
  return [...byDate.entries()].map(([date, dateItems]) => {
    const weatherIndex = dateItems.findIndex((item) => item.category === "weather");
    const weather = weatherIndex >= 0 ? dateItems[weatherIndex] : null;
    return {
      date,
      weekday: weekdayLabelUtc(date),
      weather,
      entries: dateItems.filter((_, index) => index !== weatherIndex),
    };
  });
}

export function formatDayLabel(date: string): string {
  return `${date.slice(5).replace("-", "/")}（${weekdayLabelUtc(date)}）`;
}
