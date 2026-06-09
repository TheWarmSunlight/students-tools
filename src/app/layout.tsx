import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 学情分析",
  description: "课堂二维码答题与学情分析"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
