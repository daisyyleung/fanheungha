export type DashboardTrip = {
  trip: {
    mode: "plan" | "journal";
    endDate: string;
    destinations: string;
  };
  itinerary: Array<{ title: string; location: string; note: string }>;
};

export type PlaceStatus = "visited" | "next" | "visited-next" | "unrecorded";

export function isoDateInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function isPastTrip(trip: DashboardTrip, today: string): boolean {
  return trip.trip.mode === "journal" || trip.trip.endDate < today;
}

export function isUpcomingTrip(trip: DashboardTrip, today: string): boolean {
  return trip.trip.mode === "plan" && trip.trip.endDate >= today;
}

export function buildVisitedText(trips: DashboardTrip[], today: string): string {
  return trips
    .filter((trip) => isPastTrip(trip, today))
    .flatMap((trip) => [trip.trip.destinations, ...trip.itinerary.flatMap((item) => [item.title, item.location, item.note])])
    .join(" ");
}

export function getPlaceStatus(name: string, terms: string[], visitedText: string, nextDestination: string): PlaceStatus {
  const visited = terms.some((term) => visitedText.includes(term));
  const isNext = name === nextDestination;
  if (visited && isNext) return "visited-next";
  if (visited) return "visited";
  if (isNext) return "next";
  return "unrecorded";
}
