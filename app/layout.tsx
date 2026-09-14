import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LOL Atlas",
  description: "A Chinese data atlas for League of Legends.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
