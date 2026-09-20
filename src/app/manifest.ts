import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ev Hesap",
    short_name: "Ev Hesap",
    description: "Ev arkadaşlarıyla ortak harcamaları takip edin.",
    start_url: "/",
    display: "standalone",
    background_color: "#EFE5D4",
    theme_color: "#EFE5D4",
    lang: "tr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
