import type { Metadata } from "next";
import type { Viewport } from "next";
import { Mada } from "next/font/google";
import "./globals.css";
import PwaRegistration from "./pwa-registration";

const appFont = Mada({
  subsets: ["latin", "latin-ext"],
  variable: "--font-app",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ev Hesap — Ortak ev harcamaları",
  description:
    "Ev arkadaşlarıyla ortak giderleri kaydedin, kimin kime ödeme yapacağını görün.",
  icons: {
    icon: "/icon.svg",
    apple: "/apple-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "Ev Hesap",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#EFE5D4",
};

const themeBootstrap = `(()=>{try{const key="ev-hesap-theme";const saved=localStorage.getItem(key);const choice=saved==="light"||saved==="dark"||saved==="system"?saved:"system";const dark=window.matchMedia("(prefers-color-scheme: dark)").matches;const theme=choice==="system"?(dark?"dark":"light"):choice;const root=document.documentElement;root.dataset.theme=theme;root.dataset.themeChoice=choice;const color=document.querySelector('meta[name="theme-color"]');if(color)color.setAttribute("content",theme==="dark"?"#18130F":"#EFE5D4")}catch(_){}})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className={appFont.variable} data-theme="light" data-theme-choice="system" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body><PwaRegistration />{children}</body>
    </html>
  );
}
