export type Season = "spring" | "summer" | "autumn" | "winter";

export type PackingCategory =
  | "證件與金錢"
  | "小型電器"
  | "基本衣物與旅行用品"
  | "藥品與雜項"
  | "個人護理"
  | "其他";

export type PackingTemplateItem = {
  key: string;
  label: string;
  category: PackingCategory;
  origin: "reference" | "seasonal";
  sortOrder: number;
  optional: boolean;
};

type TemplateSeed = {
  key: string;
  label: string;
  category?: PackingCategory;
  optional?: boolean;
  origin?: PackingTemplateItem["origin"];
};

const commonGroups: Array<{
  category: PackingCategory;
  items: TemplateSeed[];
}> = [
  {
    category: "證件與金錢",
    items: [
      { key: "passport", label: "護照（至少有 6 個月有效期）" },
      { key: "id", label: "身份證" },
      { key: "boarding-pass", label: "機票 Check in（A4 紙／離線存檔）" },
      { key: "hotel-confirmation", label: "酒店訂房證明／保險資料" },
      { key: "money", label: "金錢（日圓及港幣備用）" },
      { key: "cards", label: "信用卡 1–2 張（有提款功能）" },
    ],
  },
  {
    category: "小型電器",
    items: [
      { key: "phone", label: "手提電話" },
      { key: "phone-cable", label: "充電線（手提電話）" },
      { key: "power-bank", label: "後備電（手提電話）" },
      { key: "camera", label: "相機", optional: true },
      { key: "camera-battery", label: "後備電（相機電池）", optional: true },
      { key: "sim", label: "手機 SIM 卡或 eSIM" },
      { key: "gopro", label: "GoPro", optional: true },
      { key: "gopro-accessories", label: "GoPro 手帶、頭套及配件", optional: true },
      { key: "memory-card", label: "後備記憶卡", optional: true },
      { key: "adapter", label: "旅行轉換插頭" },
      { key: "styling-iron", label: "直髮夾", optional: true },
      { key: "travel-kettle", label: "旅行水壺／電熱水壺", optional: true },
    ],
  },
  {
    category: "基本衣物與旅行用品",
    items: [
      { key: "underwear", label: "內褲／衛生褲（按天數加一套）" },
      { key: "bra", label: "Bra" },
      { key: "sanitary-wear", label: "衛生用品／生理褲" },
      { key: "socks", label: "襪子" },
      { key: "sleepwear", label: "睡衣" },
      { key: "slippers", label: "拖鞋" },
      { key: "pillowcase", label: "枕頭袋／頸枕", optional: true },
      { key: "towel", label: "浴巾", optional: true },
      { key: "hanger", label: "衣架", optional: true },
      { key: "rainwear", label: "雨傘／便利雨衣" },
      { key: "umbrella-bag", label: "雨傘袋" },
      { key: "crossbody-bag", label: "小斜孭袋（出街用）" },
      { key: "shopping-bag", label: "後備旅行袋（瘋狂購物後用）" },
      { key: "compression", label: "壓力袖／壓力襪", optional: true },
      { key: "urine-bag", label: "尿袋", optional: true },
    ],
  },
  {
    category: "藥品與雜項",
    items: [
      { key: "long-term-medicine", label: "長期藥物（旅程天數加後備）" },
      { key: "pain-fever", label: "常用止痛／退燒藥" },
      { key: "throat-medicine", label: "看門口藥／喉糖" },
      { key: "probiotics", label: "益生菌" },
      { key: "anti-diarrhoea", label: "個人處方藥／止瀉藥" },
      { key: "medicated-plaster", label: "藥水膠布／醫療膠布" },
      { key: "itch-relief", label: "止痕／蚊怕水" },
      { key: "nail-care", label: "指甲鉗及挫" },
      { key: "laundry", label: "洗衣液" },
      { key: "razor", label: "剃刀" },
    ],
  },
  {
    category: "個人護理",
    items: [
      { key: "makeup", label: "化妝品／掃掃" },
      { key: "remover", label: "卸妝水" },
      { key: "cleanser", label: "潔面用品、洗面／爽膚水／保濕" },
      { key: "cotton-pads", label: "化妝棉／棉花球／耳屎棒" },
      { key: "shower-products", label: "沖涼液／洗頭水／護髮素" },
      { key: "toothbrush", label: "牙刷／牙膏／牙線棒" },
      { key: "glasses", label: "眼鏡" },
      { key: "sunglasses", label: "太陽眼鏡＋眼鏡盒" },
      { key: "contacts", label: "隱形眼鏡（約 10 對）／護理液" },
      { key: "glasses-cleaning", label: "眼鏡清潔液／眼鏡紙", optional: true },
      { key: "menstrual", label: "護墊／衛生巾（按旅程天數準備）" },
      { key: "hair-oil", label: "髮尾油" },
      { key: "hair-water", label: "頭髮定型水" },
      { key: "comb-mirror", label: "梳、鏡及頭飾" },
      { key: "hair-clips", label: "髮夾＆橡筋" },
      { key: "dry-tissues", label: "紙巾（乾，小包裝）" },
      { key: "wet-tissues", label: "紙巾（濕）" },
      { key: "toilet-tissue", label: "廁紙（2 卷）" },
      { key: "body-cream", label: "Body Cream（沖涼後用）" },
      { key: "hand-cream", label: "Hand Cream（隨身攜帶）" },
    ],
  },
  {
    category: "其他",
    items: [
      { key: "pen", label: "原子筆" },
      { key: "masks", label: "口罩" },
      { key: "hand-sanitiser", label: "酒精／搓手液／消毒噴霧" },
    ],
  },
];

const seasonalGroups: Record<Season, TemplateSeed[]> = {
  spring: [
    { key: "spring-long-sleeves", label: "長袖衫", category: "基本衣物與旅行用品" },
    { key: "spring-trousers", label: "長褲（普通）", category: "基本衣物與旅行用品" },
    { key: "spring-windbreaker", label: "薄風褸", category: "基本衣物與旅行用品" },
    { key: "spring-cardigan", label: "薄外套／薄針織外套", category: "基本衣物與旅行用品" },
    { key: "spring-scarf", label: "薄頸巾", category: "基本衣物與旅行用品" },
    { key: "spring-heattech", label: "Heattech／薄羽絨（日本北部）", category: "基本衣物與旅行用品", optional: true },
    { key: "spring-pollen-mask", label: "花粉口罩", category: "其他", optional: true },
    { key: "spring-compact-umbrella", label: "輕便摺傘", category: "基本衣物與旅行用品" },
  ],
  summer: [
    { key: "summer-short-sleeves", label: "短袖衫", category: "基本衣物與旅行用品" },
    { key: "summer-breathable-bottoms", label: "透氣長／短褲", category: "基本衣物與旅行用品" },
    { key: "summer-cardigan", label: "薄外套（冷氣房用）", category: "基本衣物與旅行用品" },
    { key: "summer-sun-hat", label: "防曬帽", category: "基本衣物與旅行用品" },
    { key: "summer-sunglasses", label: "太陽眼鏡", category: "個人護理" },
    { key: "summer-sunscreen", label: "防曬用品", category: "個人護理" },
    { key: "summer-insect-repellent", label: "防蚊用品", category: "藥品與雜項" },
    { key: "summer-fan", label: "便攜小風扇", category: "小型電器" },
    { key: "summer-cooling-towel", label: "清涼毛巾／電解質飲品", category: "其他" },
  ],
  autumn: [
    { key: "autumn-long-sleeves", label: "長袖衫", category: "基本衣物與旅行用品" },
    { key: "autumn-trousers", label: "長褲", category: "基本衣物與旅行用品" },
    { key: "autumn-knit", label: "針織衫／薄外套", category: "基本衣物與旅行用品" },
    { key: "autumn-windbreaker", label: "風褸", category: "基本衣物與旅行用品" },
    { key: "autumn-scarf", label: "頸巾", category: "基本衣物與旅行用品" },
    { key: "autumn-umbrella", label: "輕便摺傘", category: "基本衣物與旅行用品" },
    { key: "autumn-moisturizer", label: "保濕／潤膚用品", category: "個人護理" },
    { key: "autumn-heattech", label: "Heattech（早晚較冷時）", category: "基本衣物與旅行用品", optional: true },
  ],
  winter: [
    { key: "winter-long-sleeves", label: "長袖衫", category: "基本衣物與旅行用品" },
    { key: "winter-trousers", label: "長褲＋保暖／抓毛褲", category: "基本衣物與旅行用品" },
    { key: "winter-heattech", label: "Heattech 保暖底衫", category: "基本衣物與旅行用品" },
    { key: "winter-down-vest", label: "羽絨背心／內膽", category: "基本衣物與旅行用品" },
    { key: "winter-down", label: "羽絨外套", category: "基本衣物與旅行用品" },
    { key: "winter-windbreaker", label: "防風外套", category: "基本衣物與旅行用品" },
    { key: "winter-scarf", label: "頸巾", category: "基本衣物與旅行用品" },
    { key: "winter-gloves", label: "手套", category: "基本衣物與旅行用品" },
    { key: "winter-thick-socks", label: "厚襪", category: "基本衣物與旅行用品" },
    { key: "winter-hat", label: "保暖帽", category: "基本衣物與旅行用品" },
    { key: "winter-hand-warmers", label: "暖包", category: "其他" },
    { key: "winter-thermos", label: "保溫壺／水樽", category: "小型電器" },
    { key: "winter-lip-moisturizer", label: "潤唇膏／身體潤膚霜", category: "個人護理" },
  ],
};

function materialize(groups: Array<{ category: PackingCategory; items: TemplateSeed[] }>): PackingTemplateItem[] {
  let sortOrder = 0;
  return groups.flatMap(({ category, items }) =>
    items.map((item) => ({
      ...item,
      category,
      origin: item.origin ?? "reference",
      sortOrder: sortOrder++,
      optional: item.optional ?? false,
    })),
  );
}

export const SEASONAL_PACKING_TEMPLATES: Record<Season, PackingTemplateItem[]> = {
  spring: materialize([
    ...commonGroups,
    { category: "基本衣物與旅行用品", items: seasonalGroups.spring.filter((item) => item.category === "基本衣物與旅行用品") },
    { category: "其他", items: seasonalGroups.spring.filter((item) => item.category === "其他") },
  ]).map((item) => ({ ...item, origin: item.key.startsWith("spring-") ? "seasonal" : item.origin })),
  summer: materialize([
    ...commonGroups,
    ...["基本衣物與旅行用品", "個人護理", "藥品與雜項", "小型電器", "其他"].map((category) => ({
      category: category as PackingCategory,
      items: seasonalGroups.summer.filter((item) => item.category === category),
    })),
  ]).map((item) => ({ ...item, origin: item.key.startsWith("summer-") ? "seasonal" : item.origin })),
  autumn: materialize([
    ...commonGroups,
    ...["基本衣物與旅行用品", "個人護理"].map((category) => ({
      category: category as PackingCategory,
      items: seasonalGroups.autumn.filter((item) => item.category === category),
    })),
  ]).map((item) => ({ ...item, origin: item.key.startsWith("autumn-") ? "seasonal" : item.origin })),
  winter: materialize([
    ...commonGroups,
    ...["基本衣物與旅行用品", "其他", "小型電器", "個人護理"].map((category) => ({
      category: category as PackingCategory,
      items: seasonalGroups.winter.filter((item) => item.category === category),
    })),
  ]).map((item) => ({ ...item, origin: item.key.startsWith("winter-") ? "seasonal" : item.origin })),
};

export const PACKING_CATEGORIES: PackingCategory[] = [
  "證件與金錢",
  "小型電器",
  "基本衣物與旅行用品",
  "藥品與雜項",
  "個人護理",
  "其他",
];

export function inferSeason(startDate: string): Season {
  const month = Number(startDate.slice(5, 7));
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export const SEASON_LABELS: Record<Season, string> = {
  spring: "春日",
  summer: "夏日",
  autumn: "秋日",
  winter: "冬日",
};

export const LAST_MINUTE_TEMPLATE = [
  { key: "carry-on-documents", label: "護照／身份證放進手提行李" },
  { key: "offline-documents", label: "Check-in 完成；登機證、酒店／保險資料可離線查看" },
  { key: "wallet-cards", label: "現金／銀包／信用卡已放好" },
  { key: "medicine-dose", label: "長期藥物及出發日劑量已放好" },
  { key: "charge-devices", label: "手機／相機／後備電已充電" },
  { key: "charge-cables", label: "充電線及轉插已放好" },
  { key: "sim-ready", label: "eSIM／SIM／漫遊已準備" },
  { key: "status-weather", label: "航班／火車狀態及最新天氣已查看" },
  { key: "baggage-check", label: "行李重量、液體、鎖及姓名牌已檢查" },
  { key: "home-shutdown", label: "煤氣／爐具及不必要電源已關閉，門窗已鎖，垃圾已處理" },
  { key: "pocket-check", label: "最後口袋檢查：護照、手機、銀包、鎖匙、眼鏡、藥物" },
] as const;

export const TEMPLATE_COUNTS = Object.fromEntries(
  Object.entries(SEASONAL_PACKING_TEMPLATES).map(([season, items]) => [season, items.length]),
) as Record<Season, number>;
