import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ev Hesap — Ortak ev harcamaları",
  description:
    "Ev arkadaşlarıyla ortak harcamaları takip edin, borçları sadeleştirin.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
