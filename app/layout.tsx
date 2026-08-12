import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "日本旅行手帳",
  description: "日本旅程、季節執行李、想買清單、臨出發檢查與下一站筆記。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        {children}
        <div className="copyright-notice">Copyright © 2026 DaisYY Leung. Licensed under the MIT License.</div>
      </body>
    </html>
  );
}
