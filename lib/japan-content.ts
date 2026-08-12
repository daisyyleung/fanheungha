export type JapanLink = { label: string; href: string };
export type CuisineCategory = { name: string; examples: string };
export type RegionalSpecialty = { place: string; foods: string[]; source: JapanLink };

export const CUISINE_CATEGORIES: CuisineCategory[] = [
  { name: "和食／懷石", examples: "季節料理、精進料理、懷石" },
  { name: "壽司刺身", examples: "江戶前壽司、海鮮、刺身" },
  { name: "丼與定食", examples: "海鮮丼、牛舌定食、日常定食" },
  { name: "拉麵烏冬蕎麥", examples: "牛骨拉麵、鹽味拉麵、蕎麥" },
  { name: "鍋物", examples: "芋煮、季節鍋、涮涮鍋" },
  { name: "居酒屋／串燒", examples: "串燒、小菜、晚間聚會" },
  { name: "洋食", examples: "咖哩、蛋包飯、漢堡排" },
  { name: "和菓子", examples: "紅豆餅、羊羹、季節甜點" },
];

export const REGIONAL_SPECIALTIES: RegionalSpecialty[] = [
  { place: "鳥取", foods: ["二十世紀梨", "松葉蟹", "牛骨拉麵", "白魷魚"], source: { label: "鳥取官方美食", href: "https://www.tottori-tour.jp/en/food/" } },
  { place: "青森／奧入瀨", foods: ["蘋果", "いちご煮"], source: { label: "日本國家旅遊局：青森", href: "https://www.japan.travel/en/destinations/tohoku/aomori/" } },
  { place: "函館", foods: ["海鮮丼", "函館鹽味拉麵"], source: { label: "日本國家旅遊局：函館", href: "https://www.japan.travel/en/spot/ma_3/" } },
  { place: "仙台／松島", foods: ["牛舌", "毛豆蓉"], source: { label: "日本國家旅遊局：仙台", href: "https://www.japan.travel/en/spot/ma_21/" } },
  { place: "山形／銀山", foods: ["芋煮", "櫻桃"], source: { label: "日本國家旅遊局：山形", href: "https://www.japan.travel/en/destinations/tohoku/yamagata/" } },
  { place: "福島", foods: ["喜多方拉麵", "白河拉麵"], source: { label: "日本國家旅遊局：福島", href: "https://www.japan.travel/en/spot/2125/" } },
  { place: "東京", foods: ["文字燒", "江戶前壽司"], source: { label: "日本國家旅遊局：東京", href: "https://www.japan.travel/en/destinations/kanto/tokyo/" } },
];

export const CUSTOMS_AND_RULES = [
  { title: "溫泉禮儀", body: "先在浴場洗身；毛巾不要浸入水中；紋身先查詢各店政策。", source: { label: "日本國家旅遊局：享受溫泉", href: "https://www.japan.travel/en/guide/how-to-best-enjoy-onsen/" } },
  { title: "鐵路與公共空間", body: "車廂內盡量調靜音，按隊伍上落車，讓乘客先下後上。", source: { label: "日本國家旅遊局：日本禮儀", href: "https://www.japan.travel/en/guide/japanese-manners-dos-and-donts/" } },
  { title: "日常小規矩", body: "一般不需要小費；按指示脫鞋；神社寺院保持尊重；垃圾帶到有垃圾桶的地方。", source: { label: "日本國家旅遊局：小費", href: "https://www.japan.travel/en/plan/tipping-in-japan/" } },
  { title: "拍照與付款", body: "看到禁止拍照標誌要遵守，拍人先詢問；帶現金備用並按場地接受的付款方式準備。", source: { label: "日本國家旅遊局：現金與無現金付款", href: "https://www.japan.travel/en/plan/cashless-payments-in-japan/" } },
  { title: "參拜方式", body: "進入神社或寺院前留意入口、手水與參拜提示，跟從現場指示。", source: { label: "日本國家旅遊局：神社與寺院", href: "https://www.japan.travel/en/guide/shrine-and-temple-traditions/" } },
];

export const KNOWLEDGE_SOURCES: JapanLink[] = [
  { label: "日本國家旅遊局：日本美食", href: "https://www.japan.travel/en/gastronomy/?language=en" },
  { label: "日本國家旅遊局：地方美食", href: "https://www.japan.travel/en/local-specialities/local-foods/" },
  { label: "日本國家旅遊局：常見問題", href: "https://www.japan.travel/en/faq/" },
  { label: "鳥取官方觀光：景點", href: "https://www.tottori-tour.jp/en/sightseeing/1190/" },
];
