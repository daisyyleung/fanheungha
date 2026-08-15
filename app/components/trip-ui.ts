import type { TripAggregate } from "@/lib/trip-data";

export type ArchiveTrip = (trip: TripAggregate) => Promise<boolean>;

export function swapIds(ids: string[], index: number, direction: "up" | "down"): string[] {
  const next = [...ids];
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
