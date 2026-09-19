import type { Metadata } from "next";
import type { Viewport } from "next";
import { Barrio, Mada, Yantramanav } from "next/font/google";
import "./globals.css";
import PwaRegistration from "./pwa-registration";

const displayFont = Yantramanav({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin", "latin-ext"],
  variable: "--font-display",
  display: "swap",
});

const readingFont = Mada({
  subsets: ["latin", "latin-ext"],
  variable: "--font-reading",
  display: "swap",
});

const ledgerFont = Barrio({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-ledger",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ev Hesap — Ortak ev harcamaları",
  description:
    "Ev arkadaşlarıyla ortak harcamaları takip edin, borçları sadeleştirin.",
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#e9f0e8",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={`${displayFont.variable} ${readingFont.variable} ${ledgerFont.variable}`} data-scroll-behavior="smooth">
      <body><PwaRegistration />{children}</body>
    </html>
  );
}
