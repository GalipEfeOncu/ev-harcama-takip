import type { Metadata } from "next";
import type { Viewport } from "next";
import "./globals.css";
import PwaRegistration from "./pwa-registration";

export const metadata: Metadata = {
  title: "Ev Hesap — Ortak ev harcamaları",
  description:
    "Ev arkadaşlarıyla ortak harcamaları takip edin, borçları sadeleştirin.",
};

export const viewport: Viewport = {
  themeColor: "#202a2b",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" data-scroll-behavior="smooth">
      <body><PwaRegistration />{children}</body>
    </html>
  );
}
