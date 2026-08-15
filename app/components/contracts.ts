import type { Season } from "@/lib/packing-templates";
import type { TripMode } from "@/lib/trip-log";

export type AuthState = "loading" | "setup" | "locked" | "unlocked" | "error";
export type Tab = "packing" | "lastMinute" | "shopping" | "food" | "itinerary";
export type AppView =
  | "overview"
  | "upcoming"
  | "past"
  | "map"
  | "knowledge"
  | "improvements"
  | "trip";
export type PackingFilter = "all" | "outstanding" | "complete";

export const seasonOptions: Array<{ value: Season; label: string; note: string }> = [
  { value: "spring", label: "春日", note: "3–5 月" },
  { value: "summer", label: "夏日", note: "6–8 月" },
  { value: "autumn", label: "秋日", note: "9–11 月" },
  { value: "winter", label: "冬日", note: "12–2 月" },
];

export const tabOptions: Array<{ value: Tab; label: string; hint: string }> = [
  { value: "packing", label: "執行李", hint: "按季節清單" },
  { value: "lastMinute", label: "臨出發", hint: "最後確認" },
  { value: "shopping", label: "想買", hint: "連結與數量" },
  { value: "food", label: "想食／飲", hint: "便利店與店舖" },
  { value: "itinerary", label: "行程", hint: "每日節奏" },
];

export const navigation: Array<{
  value: Exclude<AppView, "trip">;
  label: string;
  hint: string;
}> = [
  { value: "overview", label: "總覽", hint: "今日旅程桌" },
  { value: "upcoming", label: "即將出發", hint: "未來的準備" },
  { value: "past", label: "過往旅記", hint: "走過的日子" },
  { value: "map", label: "日本足跡", hint: "去過與下一站" },
  { value: "knowledge", label: "日本小知識", hint: "吃法與禮儀" },
  { value: "improvements", label: "想改善", hint: "下一次更順" },
];

export const initialTripForm = {
  title: "",
  destinations: "",
  startDate: "",
  endDate: "",
  season: "" as Season | "",
  mode: "plan" as TripMode,
};

export type TripFormValues = typeof initialTripForm;
