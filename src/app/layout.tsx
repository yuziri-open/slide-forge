import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SlideForge — HTML Slide Visual Editor",
  description: "HTMLプレゼンテーションをビジュアル編集",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
