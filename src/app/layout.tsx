import type { Metadata } from "next";
import type { Viewport } from "next";
import "@fontsource-variable/mada";
import "./globals.css";
import "./appearance.css";
import PwaRegistration from "./pwa-registration";
import FocusMode from "@/components/focus-mode";
import { PreferencesProvider } from "@/components/preferences-provider";
import { getPreferencesBootstrapScript } from "@/lib/preferences";

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
  themeColor: "#F6F5F2",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" data-theme="light" data-theme-choice="system" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getPreferencesBootstrapScript() }} />
      </head>
      <body><PreferencesProvider><FocusMode /><PwaRegistration />{children}</PreferencesProvider></body>
    </html>
  );
}
