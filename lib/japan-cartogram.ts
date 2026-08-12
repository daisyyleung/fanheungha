import type { PrefectureId } from "./region-map";

/**
 * A normalized (0–100) CSS layout cell for the hand-built Japan cartogram.
 *
 * This is intentionally data-only: the atlas renders semantic HTML blocks and
 * uses these coordinates as percentages inside its horizontally scrollable
 * canvas.  The cells are ordered by PREFECTURE_IDS when exported below so the
 * region-map catalogue remains the sole source of labels and statuses.
 */
export type JapanCartogramCell = Readonly<{
  id: PrefectureId;
  x: number;
  y: number;
  width: number;
  height: number;
  clipPath?: string;
}>;

/** Exactly one normalized cell for each of Japan's 47 prefectures. */
export const JAPAN_CARTOGRAM: Readonly<Record<PrefectureId, JapanCartogramCell>> = {
  hokkaido: { id: "hokkaido", x: 70, y: 0, width: 21, height: 16, clipPath: "8% 0%, 50% 0%, 72% 22%, 100% 22%, 100% 76%, 72% 76%, 56% 100%, 28% 80%, 0% 84%, 0% 58%, 10% 46%" },

  aomori: { id: "aomori", x: 70, y: 18, width: 14, height: 7 },
  iwate: { id: "iwate", x: 77, y: 25, width: 7, height: 7 },
  akita: { id: "akita", x: 70, y: 25, width: 7, height: 7 },
  miyagi: { id: "miyagi", x: 77, y: 32, width: 7, height: 7 },
  yamagata: { id: "yamagata", x: 70, y: 32, width: 7, height: 7 },
  fukushima: { id: "fukushima", x: 70, y: 39, width: 14, height: 7 },

  niigata: { id: "niigata", x: 56, y: 39, width: 14, height: 7 },
  ishikawa: { id: "ishikawa", x: 42, y: 46, width: 7, height: 7 },
  toyama: { id: "toyama", x: 49, y: 46, width: 7, height: 7 },
  nagano: { id: "nagano", x: 56, y: 46, width: 14, height: 7 },
  fukui: { id: "fukui", x: 42, y: 53, width: 7, height: 7 },
  gifu: { id: "gifu", x: 49, y: 53, width: 14, height: 7 },
  yamanashi: { id: "yamanashi", x: 63, y: 53, width: 7, height: 7 },
  shizuoka: { id: "shizuoka", x: 56, y: 60, width: 14, height: 14 },
  aichi: { id: "aichi", x: 49, y: 60, width: 7, height: 7 },

  gunma: { id: "gunma", x: 70, y: 46, width: 7, height: 7 },
  tochigi: { id: "tochigi", x: 77, y: 46, width: 7, height: 7 },
  ibaraki: { id: "ibaraki", x: 84, y: 46, width: 7, height: 7 },
  saitama: { id: "saitama", x: 70, y: 53, width: 14, height: 7 },
  chiba: { id: "chiba", x: 84, y: 53, width: 7, height: 14 },
  tokyo: { id: "tokyo", x: 70, y: 60, width: 14, height: 7 },
  kanagawa: { id: "kanagawa", x: 70, y: 67, width: 14, height: 7 },

  shimane: { id: "shimane", x: 14, y: 60, width: 7, height: 7 },
  tottori: { id: "tottori", x: 21, y: 60, width: 7, height: 7 },
  yamaguchi: { id: "yamaguchi", x: 7, y: 67, width: 7, height: 7 },
  hiroshima: { id: "hiroshima", x: 14, y: 67, width: 7, height: 7 },
  okayama: { id: "okayama", x: 21, y: 67, width: 7, height: 7 },

  hyogo: { id: "hyogo", x: 28, y: 60, width: 7, height: 14 },
  kyoto: { id: "kyoto", x: 35, y: 60, width: 7, height: 7 },
  shiga: { id: "shiga", x: 42, y: 60, width: 7, height: 7 },
  osaka: { id: "osaka", x: 35, y: 67, width: 7, height: 7 },
  nara: { id: "nara", x: 42, y: 67, width: 7, height: 7 },
  mie: { id: "mie", x: 49, y: 67, width: 7, height: 14 },
  wakayama: { id: "wakayama", x: 35, y: 74, width: 14, height: 7 },

  kagawa: { id: "kagawa", x: 30, y: 84, width: 7, height: 7 },
  tokushima: { id: "tokushima", x: 37, y: 84, width: 7, height: 7 },
  ehime: { id: "ehime", x: 30, y: 91, width: 7, height: 7 },
  kochi: { id: "kochi", x: 37, y: 91, width: 14, height: 7 },

  nagasaki: { id: "nagasaki", x: 0, y: 77, width: 7, height: 14 },
  saga: { id: "saga", x: 7, y: 77, width: 7, height: 7 },
  fukuoka: { id: "fukuoka", x: 14, y: 77, width: 7, height: 7 },
  kumamoto: { id: "kumamoto", x: 7, y: 84, width: 14, height: 7 },
  oita: { id: "oita", x: 21, y: 77, width: 7, height: 7 },
  kagoshima: { id: "kagoshima", x: 7, y: 91, width: 14, height: 7 },
  miyazaki: { id: "miyazaki", x: 21, y: 84, width: 7, height: 14 },
  okinawa: { id: "okinawa", x: 0, y: 93, width: 5, height: 7 },
} as const;

export const JAPAN_CARTOGRAM_CELLS: readonly JapanCartogramCell[] = [
  JAPAN_CARTOGRAM.hokkaido,
  JAPAN_CARTOGRAM.aomori,
  JAPAN_CARTOGRAM.iwate,
  JAPAN_CARTOGRAM.miyagi,
  JAPAN_CARTOGRAM.akita,
  JAPAN_CARTOGRAM.yamagata,
  JAPAN_CARTOGRAM.fukushima,
  JAPAN_CARTOGRAM.ibaraki,
  JAPAN_CARTOGRAM.tochigi,
  JAPAN_CARTOGRAM.gunma,
  JAPAN_CARTOGRAM.saitama,
  JAPAN_CARTOGRAM.chiba,
  JAPAN_CARTOGRAM.tokyo,
  JAPAN_CARTOGRAM.kanagawa,
  JAPAN_CARTOGRAM.niigata,
  JAPAN_CARTOGRAM.toyama,
  JAPAN_CARTOGRAM.ishikawa,
  JAPAN_CARTOGRAM.fukui,
  JAPAN_CARTOGRAM.yamanashi,
  JAPAN_CARTOGRAM.nagano,
  JAPAN_CARTOGRAM.gifu,
  JAPAN_CARTOGRAM.shizuoka,
  JAPAN_CARTOGRAM.aichi,
  JAPAN_CARTOGRAM.mie,
  JAPAN_CARTOGRAM.shiga,
  JAPAN_CARTOGRAM.kyoto,
  JAPAN_CARTOGRAM.osaka,
  JAPAN_CARTOGRAM.hyogo,
  JAPAN_CARTOGRAM.nara,
  JAPAN_CARTOGRAM.wakayama,
  JAPAN_CARTOGRAM.tottori,
  JAPAN_CARTOGRAM.shimane,
  JAPAN_CARTOGRAM.okayama,
  JAPAN_CARTOGRAM.hiroshima,
  JAPAN_CARTOGRAM.yamaguchi,
  JAPAN_CARTOGRAM.tokushima,
  JAPAN_CARTOGRAM.kagawa,
  JAPAN_CARTOGRAM.ehime,
  JAPAN_CARTOGRAM.kochi,
  JAPAN_CARTOGRAM.fukuoka,
  JAPAN_CARTOGRAM.saga,
  JAPAN_CARTOGRAM.nagasaki,
  JAPAN_CARTOGRAM.kumamoto,
  JAPAN_CARTOGRAM.oita,
  JAPAN_CARTOGRAM.miyazaki,
  JAPAN_CARTOGRAM.kagoshima,
  JAPAN_CARTOGRAM.okinawa,
] as const;
