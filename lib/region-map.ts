// @ts-expect-error Node's direct test runner imports the source TypeScript module by extension.
import { isoDateInTimeZone, isPastTrip, isUpcomingTrip, type DashboardTrip } from "./dashboard-logic.ts";

/** The eight major regions shown by the notebook map, in reading order. */
export const REGION_IDS = [
  "hokkaido",
  "tohoku",
  "kanto",
  "chubu",
  "kinki",
  "chugoku",
  "shikoku",
  "kyushu-okinawa",
] as const;

export type RegionId = (typeof REGION_IDS)[number];
export type RegionStatus = "visited" | "next" | "both" | "unrecorded";

export const PREFECTURE_IDS = [
  "hokkaido", "aomori", "iwate", "miyagi", "akita", "yamagata", "fukushima",
  "ibaraki", "tochigi", "gunma", "saitama", "chiba", "tokyo", "kanagawa",
  "niigata", "toyama", "ishikawa", "fukui", "yamanashi", "nagano", "gifu", "shizuoka", "aichi",
  "mie", "shiga", "kyoto", "osaka", "hyogo", "nara", "wakayama",
  "tottori", "shimane", "okayama", "hiroshima", "yamaguchi",
  "tokushima", "kagawa", "ehime", "kochi",
  "fukuoka", "saga", "nagasaki", "kumamoto", "oita", "miyazaki", "kagoshima", "okinawa",
] as const;

export type PrefectureId = (typeof PREFECTURE_IDS)[number];
export type PrefectureDefinition = { id: PrefectureId; label: string; regionId: RegionId };

export type RegionAnchor = { x: number; y: number };

export type RegionDefinition = {
  id: RegionId;
  label: string;
  description: string;
  anchor: RegionAnchor;
  prefectures: string[];
};

export const REGION_DEFINITIONS: readonly RegionDefinition[] = [
  { id: "hokkaido", label: "北海道", description: "北國的雪景、溫泉與海鮮。", anchor: { x: 74, y: 10 }, prefectures: ["北海道"] },
  { id: "tohoku", label: "東北", description: "山海、溫泉與慢慢走的城鎮。", anchor: { x: 71, y: 30 }, prefectures: ["青森", "岩手", "宮城", "秋田", "山形", "福島"] },
  { id: "kanto", label: "關東", description: "東京周邊的城市、海岸與古寺。", anchor: { x: 73, y: 52 }, prefectures: ["茨城", "栃木", "群馬", "埼玉", "千葉", "東京", "神奈川"] },
  { id: "chubu", label: "中部", description: "山岳、古街與日本海風景。", anchor: { x: 53, y: 49 }, prefectures: ["新潟", "富山", "石川", "福井", "山梨", "長野", "岐阜", "靜岡", "愛知"] },
  { id: "kinki", label: "近畿", description: "古都、港口與關西日常滋味。", anchor: { x: 42, y: 62 }, prefectures: ["三重", "滋賀", "京都", "大阪", "兵庫", "奈良", "和歌山"] },
  { id: "chugoku", label: "中國", description: "瀨戶內海、日本海與鳥取砂丘。", anchor: { x: 27, y: 62 }, prefectures: ["鳥取", "島根", "岡山", "廣島", "山口"] },
  { id: "shikoku", label: "四國", description: "島嶼小路、海風與四國美食。", anchor: { x: 37, y: 76 }, prefectures: ["德島", "香川", "愛媛", "高知"] },
  { id: "kyushu-okinawa", label: "九州／沖繩", description: "火山、溫泉、海島與南國風景。", anchor: { x: 17, y: 80 }, prefectures: ["福岡", "佐賀", "長崎", "熊本", "大分", "宮崎", "鹿兒島", "沖繩"] },
] as const;

export const PREFECTURE_DEFINITIONS: readonly PrefectureDefinition[] = [
  { id: "hokkaido", label: "北海道", regionId: "hokkaido" },
  { id: "aomori", label: "青森", regionId: "tohoku" },
  { id: "iwate", label: "岩手", regionId: "tohoku" },
  { id: "miyagi", label: "宮城", regionId: "tohoku" },
  { id: "akita", label: "秋田", regionId: "tohoku" },
  { id: "yamagata", label: "山形", regionId: "tohoku" },
  { id: "fukushima", label: "福島", regionId: "tohoku" },
  { id: "ibaraki", label: "茨城", regionId: "kanto" },
  { id: "tochigi", label: "栃木", regionId: "kanto" },
  { id: "gunma", label: "群馬", regionId: "kanto" },
  { id: "saitama", label: "埼玉", regionId: "kanto" },
  { id: "chiba", label: "千葉", regionId: "kanto" },
  { id: "tokyo", label: "東京", regionId: "kanto" },
  { id: "kanagawa", label: "神奈川", regionId: "kanto" },
  { id: "niigata", label: "新潟", regionId: "chubu" },
  { id: "toyama", label: "富山", regionId: "chubu" },
  { id: "ishikawa", label: "石川", regionId: "chubu" },
  { id: "fukui", label: "福井", regionId: "chubu" },
  { id: "yamanashi", label: "山梨", regionId: "chubu" },
  { id: "nagano", label: "長野", regionId: "chubu" },
  { id: "gifu", label: "岐阜", regionId: "chubu" },
  { id: "shizuoka", label: "靜岡", regionId: "chubu" },
  { id: "aichi", label: "愛知", regionId: "chubu" },
  { id: "mie", label: "三重", regionId: "kinki" },
  { id: "shiga", label: "滋賀", regionId: "kinki" },
  { id: "kyoto", label: "京都", regionId: "kinki" },
  { id: "osaka", label: "大阪", regionId: "kinki" },
  { id: "hyogo", label: "兵庫", regionId: "kinki" },
  { id: "nara", label: "奈良", regionId: "kinki" },
  { id: "wakayama", label: "和歌山", regionId: "kinki" },
  { id: "tottori", label: "鳥取", regionId: "chugoku" },
  { id: "shimane", label: "島根", regionId: "chugoku" },
  { id: "okayama", label: "岡山", regionId: "chugoku" },
  { id: "hiroshima", label: "廣島", regionId: "chugoku" },
  { id: "yamaguchi", label: "山口", regionId: "chugoku" },
  { id: "tokushima", label: "德島", regionId: "shikoku" },
  { id: "kagawa", label: "香川", regionId: "shikoku" },
  { id: "ehime", label: "愛媛", regionId: "shikoku" },
  { id: "kochi", label: "高知", regionId: "shikoku" },
  { id: "fukuoka", label: "福岡", regionId: "kyushu-okinawa" },
  { id: "saga", label: "佐賀", regionId: "kyushu-okinawa" },
  { id: "nagasaki", label: "長崎", regionId: "kyushu-okinawa" },
  { id: "kumamoto", label: "熊本", regionId: "kyushu-okinawa" },
  { id: "oita", label: "大分", regionId: "kyushu-okinawa" },
  { id: "miyazaki", label: "宮崎", regionId: "kyushu-okinawa" },
  { id: "kagoshima", label: "鹿兒島", regionId: "kyushu-okinawa" },
  { id: "okinawa", label: "沖繩", regionId: "kyushu-okinawa" },
] as const;

export const PREFECTURE_BY_ID: Readonly<Record<PrefectureId, PrefectureDefinition>> = Object.fromEntries(
  PREFECTURE_DEFINITIONS.map((prefectureDefinition) => [prefectureDefinition.id, prefectureDefinition]),
) as Record<PrefectureId, PrefectureDefinition>;

/** Backwards-friendly aliases for consumers that prefer a shorter name. */
export const REGIONS = REGION_DEFINITIONS;
export const EIGHT_REGIONS = REGION_DEFINITIONS;
export const ORDERED_REGIONS = REGION_DEFINITIONS;

export const REGION_BY_ID: Readonly<Record<RegionId, RegionDefinition>> = Object.fromEntries(
  REGION_DEFINITIONS.map((region) => [region.id, region]),
) as Record<RegionId, RegionDefinition>;
export const REGION_ANCHORS: Readonly<Record<RegionId, RegionAnchor>> = Object.fromEntries(
  REGION_DEFINITIONS.map((region) => [region.id, region.anchor]),
) as Record<RegionId, RegionAnchor>;
export const REGION_LABELS: Readonly<Record<RegionId, string>> = Object.fromEntries(
  REGION_DEFINITIONS.map((region) => [region.id, region.label]),
) as Record<RegionId, string>;

type PlaceAlias = { label: string; regionId: RegionId; prefectureId: PrefectureId; aliases: readonly string[] };

const prefecture = (label: string, regionId: RegionId, prefectureId: PrefectureId, aliases: readonly string[] = []): PlaceAlias => ({
  label,
  regionId,
  prefectureId,
  aliases: [label, `${label}縣`, `${label}県`, ...aliases],
});

/**
 * All 47 prefectures plus the destinations already present in the notebook.
 * Matching is intentionally conservative: the catalogue is only used to
 * recognise text already entered in an active trip, never to invent a trip.
 */
export const PLACE_CATALOG: readonly PlaceAlias[] = [
  prefecture("北海道", "hokkaido", "hokkaido", ["Hokkaido"]),
  prefecture("青森", "tohoku", "aomori", ["Aomori", "青森市"]),
  prefecture("岩手", "tohoku", "iwate", ["Iwate"]),
  prefecture("宮城", "tohoku", "miyagi", ["Miyagi"]),
  prefecture("秋田", "tohoku", "akita", ["Akita"]),
  prefecture("山形", "tohoku", "yamagata", ["Yamagata"]),
  prefecture("福島", "tohoku", "fukushima", ["Fukushima"]),
  prefecture("茨城", "kanto", "ibaraki", ["Ibaraki"]),
  prefecture("栃木", "kanto", "tochigi", ["Tochigi"]),
  prefecture("群馬", "kanto", "gunma", ["Gunma"]),
  prefecture("埼玉", "kanto", "saitama", ["Saitama"]),
  prefecture("千葉", "kanto", "chiba", ["Chiba"]),
  prefecture("東京", "kanto", "tokyo", ["東京都", "Tokyo", "東京市"]),
  prefecture("神奈川", "kanto", "kanagawa", ["Kanagawa"]),
  prefecture("新潟", "chubu", "niigata", ["Niigata"]),
  prefecture("富山", "chubu", "toyama", ["Toyama"]),
  prefecture("石川", "chubu", "ishikawa", ["Ishikawa"]),
  prefecture("福井", "chubu", "fukui", ["Fukui"]),
  prefecture("山梨", "chubu", "yamanashi", ["Yamanashi"]),
  prefecture("長野", "chubu", "nagano", ["Nagano"]),
  prefecture("岐阜", "chubu", "gifu", ["Gifu"]),
  prefecture("靜岡", "chubu", "shizuoka", ["静岡", "Shizuoka"]),
  prefecture("愛知", "chubu", "aichi", ["Aichi"]),
  prefecture("三重", "kinki", "mie", ["Mie"]),
  prefecture("滋賀", "kinki", "shiga", ["Shiga"]),
  prefecture("京都", "kinki", "kyoto", ["Kyoto"]),
  prefecture("大阪", "kinki", "osaka", ["Osaka"]),
  prefecture("兵庫", "kinki", "hyogo", ["Hyogo"]),
  prefecture("奈良", "kinki", "nara", ["Nara"]),
  prefecture("和歌山", "kinki", "wakayama", ["Wakayama"]),
  prefecture("鳥取", "chugoku", "tottori", ["Tottori"]),
  prefecture("島根", "chugoku", "shimane", ["Shimane"]),
  prefecture("岡山", "chugoku", "okayama", ["Okayama"]),
  prefecture("廣島", "chugoku", "hiroshima", ["広島", "Hiroshima"]),
  prefecture("山口", "chugoku", "yamaguchi", ["Yamaguchi"]),
  prefecture("德島", "shikoku", "tokushima", ["徳島", "Tokushima"]),
  prefecture("香川", "shikoku", "kagawa", ["Kagawa"]),
  prefecture("愛媛", "shikoku", "ehime", ["Ehime"]),
  prefecture("高知", "shikoku", "kochi", ["Kochi"]),
  prefecture("福岡", "kyushu-okinawa", "fukuoka", ["Fukuoka"]),
  prefecture("佐賀", "kyushu-okinawa", "saga", ["Saga"]),
  prefecture("長崎", "kyushu-okinawa", "nagasaki", ["Nagasaki"]),
  prefecture("熊本", "kyushu-okinawa", "kumamoto", ["Kumamoto"]),
  prefecture("大分", "kyushu-okinawa", "oita", ["Oita"]),
  prefecture("宮崎", "kyushu-okinawa", "miyazaki", ["Miyazaki"]),
  prefecture("鹿兒島", "kyushu-okinawa", "kagoshima", ["鹿児島", "Kagoshima"]),
  prefecture("沖繩", "kyushu-okinawa", "okinawa", ["沖縄", "Okinawa"]),
  { label: "函館", regionId: "hokkaido", prefectureId: "hokkaido", aliases: ["函館", "函館市", "Hakodate"] },
  { label: "奧入瀨", regionId: "tohoku", prefectureId: "aomori", aliases: ["奧入瀨", "奥入瀬", "奧入瀨溪流", "奥入瀬渓流", "Oirase"] },
  { label: "銀山", regionId: "tohoku", prefectureId: "yamagata", aliases: ["銀山", "銀山溫泉", "銀山温泉", "Ginzan"] },
  { label: "仙台", regionId: "tohoku", prefectureId: "miyagi", aliases: ["仙台", "Sendai"] },
  { label: "松島", regionId: "tohoku", prefectureId: "miyagi", aliases: ["松島", "松島町", "Matsushima"] },
  { label: "鎌倉", regionId: "kanto", prefectureId: "kanagawa", aliases: ["鎌倉", "Kamakura"] },
  { label: "新宿", regionId: "kanto", prefectureId: "tokyo", aliases: ["新宿", "Shinjuku"] },
  { label: "羽田", regionId: "kanto", prefectureId: "tokyo", aliases: ["羽田", "羽田機場", "羽田空港", "Haneda"] },
  { label: "銀座", regionId: "kanto", prefectureId: "tokyo", aliases: ["銀座", "Ginza"] },
  { label: "錦糸町", regionId: "kanto", prefectureId: "tokyo", aliases: ["錦絲町", "錦糸町", "Kinshicho"] },
  { label: "名古屋", regionId: "chubu", prefectureId: "aichi", aliases: ["名古屋", "Nagoya"] },
  { label: "金澤", regionId: "chubu", prefectureId: "ishikawa", aliases: ["金澤", "金沢", "Kanazawa"] },
  { label: "白川鄉", regionId: "chubu", prefectureId: "gifu", aliases: ["白川鄉", "白川郷", "Shirakawa-go"] },
  { label: "大阪", regionId: "kinki", prefectureId: "osaka", aliases: ["大阪", "Osaka"] },
  { label: "京都", regionId: "kinki", prefectureId: "kyoto", aliases: ["京都", "Kyoto"] },
  { label: "神戶", regionId: "kinki", prefectureId: "hyogo", aliases: ["神戶", "神戸", "Kobe"] },
  { label: "奈良", regionId: "kinki", prefectureId: "nara", aliases: ["奈良", "Nara"] },
  { label: "鳥取", regionId: "chugoku", prefectureId: "tottori", aliases: ["鳥取", "鳥取市", "Tottori"] },
  { label: "倉吉", regionId: "chugoku", prefectureId: "tottori", aliases: ["倉吉", "Kurayoshi"] },
  { label: "境港", regionId: "chugoku", prefectureId: "tottori", aliases: ["境港", "Sakaiminato"] },
  { label: "松山", regionId: "shikoku", prefectureId: "ehime", aliases: ["松山", "Matsuyama"] },
  { label: "高松", regionId: "shikoku", prefectureId: "kagawa", aliases: ["高松", "Takamatsu"] },
  { label: "福岡", regionId: "kyushu-okinawa", prefectureId: "fukuoka", aliases: ["福岡", "Fukuoka"] },
  { label: "那霸", regionId: "kyushu-okinawa", prefectureId: "okinawa", aliases: ["那霸", "那覇", "Naha"] },
];

/** Canonical prefecture aliases, useful for tests and non-UI consumers. */
export const PREFECTURE_ALIASES: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  PLACE_CATALOG
    .slice(0, 47)
    .map((place) => [place.label, place.aliases]),
);
export const REGION_ALIASES: Readonly<Record<RegionId, readonly string[]>> = Object.fromEntries(
  REGION_DEFINITIONS.map((region) => [region.id, [...region.prefectures, region.label]]),
) as unknown as Record<RegionId, readonly string[]>;

const normalise = (value: string): string => value.normalize("NFKC").replaceAll("靜", "静").trim();

/** Split the free-text destination fields at common CJK and Latin separators. */
export function splitPlaces(value: string): string[] {
  return value
    .split(/[、,，/／|·•;；\n]+/u)
    .map((part) => part.trim())
    .filter(Boolean);
}

export const splitDestinationText = splitPlaces;

export function dedupePlaces(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const place = value.trim();
    if (!place) continue;
    const key = normalise(place).toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(place);
  }
  return result;
}

export const dedupeDestinationLabels = dedupePlaces;

export function classifyPlace(value: string): RegionId | null {
  const text = normalise(value);
  const match = [...PLACE_CATALOG]
    .sort((a, b) => Math.max(...b.aliases.map((alias) => alias.length)) - Math.max(...a.aliases.map((alias) => alias.length)))
    .find((place) => place.aliases.some((alias) => text.includes(normalise(alias))));
  return match?.regionId ?? null;
}

export function classifyPrefecture(value: string): PrefectureId | null {
  const text = normalise(value);
  const match = [...PLACE_CATALOG]
    .sort((a, b) => Math.max(...b.aliases.map((alias) => alias.length)) - Math.max(...a.aliases.map((alias) => alias.length)))
    .find((place) => place.aliases.some((alias) => text.includes(normalise(alias))));
  return match?.prefectureId ?? null;
}

export const classifyRegion = classifyPlace;
export const classifyDestination = classifyPlace;

export type RegionDestination = { label: string; status: RegionStatus };

export type RegionSummary = RegionDefinition & {
  status: RegionStatus;
  destinations: RegionDestination[];
  /** Internal chronological hints used for the default selection. */
  upcomingRank?: number;
  visitedRank?: number;
};

export type RegionStatusMap = Record<RegionId, RegionSummary>;
export type PrefectureSummary = PrefectureDefinition & { status: RegionStatus };
export type PrefectureStatusMap = Record<PrefectureId, PrefectureSummary>;

type TripText = DashboardTrip & {
  trip: DashboardTrip["trip"] & { startDate?: string };
};

function tripText(trip: TripText): string {
  return [
    trip.trip.destinations,
    ...trip.itinerary.flatMap((item) => [item.title, item.location, item.note]),
  ].filter(Boolean).join(" ");
}

export function statusFor(visited: boolean, next: boolean): RegionStatus {
  if (visited && next) return "both";
  if (visited) return "visited";
  if (next) return "next";
  return "unrecorded";
}

/** Convert current trip aggregates into an independent status for every prefecture. */
export function aggregatePrefectureStatuses(
  trips: readonly TripText[],
  today = isoDateInTimeZone(new Date(), "Asia/Hong_Kong"),
): PrefectureStatusMap {
  const flags = Object.fromEntries(
    PREFECTURE_IDS.map((id) => [id, { visited: false, next: false }]),
  ) as Record<PrefectureId, { visited: boolean; next: boolean }>;

  for (const trip of trips) {
    const isVisitedTrip = isPastTrip(trip, today);
    const isNextTrip = isUpcomingTrip(trip, today);
    if (!isVisitedTrip && !isNextTrip) continue;
    const text = normalise(tripText(trip));
    const matched = PLACE_CATALOG.filter((place) => place.aliases.some((alias) => text.includes(normalise(alias))));
    for (const place of matched) {
      flags[place.prefectureId].visited ||= isVisitedTrip;
      flags[place.prefectureId].next ||= isNextTrip;
    }
  }

  return Object.fromEntries(PREFECTURE_DEFINITIONS.map((definition) => [
    definition.id,
    { ...definition, status: statusFor(flags[definition.id].visited, flags[definition.id].next) },
  ])) as PrefectureStatusMap;
}

/** Convert current (non-archived) trip aggregates into one status per region. */
export function aggregateRegionStatuses(trips: readonly TripText[], today = isoDateInTimeZone(new Date(), "Asia/Hong_Kong")): RegionStatusMap {
  const visited = new Set<string>();
  const next = new Set<string>();
  const flags = Object.fromEntries(REGION_IDS.map((id) => [id, { visited: false, next: false }])) as Record<RegionId, { visited: boolean; next: boolean }>;
  const upcomingRank: Partial<Record<RegionId, number>> = {};
  const visitedRank: Partial<Record<RegionId, number>> = {};
  const chronologicalTrips = [...trips].sort((a, b) => (a.trip.startDate ?? a.trip.endDate).localeCompare(b.trip.startDate ?? b.trip.endDate));

  for (const [tripIndex, trip] of chronologicalTrips.entries()) {
    const isVisitedTrip = isPastTrip(trip, today);
    const isNextTrip = isUpcomingTrip(trip, today);
    if (!isVisitedTrip && !isNextTrip) continue;
    const text = normalise(tripText(trip));
    const matched = PLACE_CATALOG.filter((place) => place.aliases.some((alias) => text.includes(normalise(alias))));
    for (const place of matched) {
      const key = `${place.regionId}:${place.label}`;
      if (isVisitedTrip) visited.add(key);
      if (isNextTrip) next.add(key);
      flags[place.regionId].visited ||= isVisitedTrip;
      flags[place.regionId].next ||= isNextTrip;
      if (isVisitedTrip && visitedRank[place.regionId] === undefined) visitedRank[place.regionId] = tripIndex;
      if (isNextTrip && upcomingRank[place.regionId] === undefined) upcomingRank[place.regionId] = tripIndex;
    }
  }

  return Object.fromEntries(REGION_DEFINITIONS.map((region) => {
    const destinations = dedupePlaces(PLACE_CATALOG
      .filter((place) => place.regionId === region.id)
      .filter((place) => visited.has(`${region.id}:${place.label}`) || next.has(`${region.id}:${place.label}`))
      .map((place) => place.label))
      .map((label) => ({ label, status: statusFor(visited.has(`${region.id}:${label}`), next.has(`${region.id}:${label}`)) }));
    const regionFlags = flags[region.id];
    return [region.id, { ...region, status: statusFor(regionFlags.visited, regionFlags.next), destinations, upcomingRank: upcomingRank[region.id], visitedRank: visitedRank[region.id] }];
  })) as RegionStatusMap;
}

export const deriveRegionStatuses = aggregateRegionStatuses;
export const aggregateTripRegions = aggregateRegionStatuses;

/** Pick the first recognised upcoming region, then the first visited region. */
export function getDefaultRegionId(statuses: RegionStatusMap): RegionId {
  const upcoming = REGION_DEFINITIONS
    .filter((region) => statuses[region.id].status === "next" || statuses[region.id].status === "both")
    .sort((a, b) => (statuses[a.id].upcomingRank ?? REGION_IDS.indexOf(a.id)) - (statuses[b.id].upcomingRank ?? REGION_IDS.indexOf(b.id)))[0];
  if (upcoming) return upcoming.id;
  const visited = REGION_DEFINITIONS
    .filter((region) => statuses[region.id].status === "visited" || statuses[region.id].status === "both")
    .sort((a, b) => (statuses[a.id].visitedRank ?? REGION_IDS.indexOf(a.id)) - (statuses[b.id].visitedRank ?? REGION_IDS.indexOf(b.id)))[0];
  return visited?.id ?? "hokkaido";
}

export const defaultRegionId = getDefaultRegionId;
export const getDefaultRegion = getDefaultRegionId;

export function regionStatusLabel(status: RegionStatus): string {
  if (status === "both") return "已去過・下一站";
  if (status === "visited") return "已去過";
  if (status === "next") return "下一站";
  return "尚未記錄";
}
