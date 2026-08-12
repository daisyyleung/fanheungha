export type SiteTheme = {
  id: string;
  label: string;
  palette: {
    dune: string;
    indigo: string;
    indigoDark: string;
    persimmon: string;
    persimmonSoft: string;
    paper: string;
    paperDeep: string;
    card: string;
    ink: string;
    inkSoft: string;
    line: string;
    muted: string;
  };
  motif: string;
};

export const SITE_THEMES: Record<string, SiteTheme> = {
  "travel-notebook": {
    id: "travel-notebook",
    label: "日本旅行手帳",
    palette: {
      dune: "#d9b77b",
      indigo: "#1f4e62",
      indigoDark: "#163d4f",
      persimmon: "#c85c3d",
      persimmonSoft: "#f4d9cc",
      paper: "#f7f0df",
      paperDeep: "#eadcc3",
      card: "#fffaf0",
      ink: "#213c47",
      inkSoft: "#52656a",
      line: "#d9cbb2",
      muted: "#817a6d",
    },
    motif: "把下一站寫得剛剛好",
  },
};

export const ACTIVE_SITE_THEME = SITE_THEMES["travel-notebook"];
