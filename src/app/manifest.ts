import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ev Hesap",
    short_name: "Ev Hesap",
    description: "Ev arkadaşlarıyla ortak harcamaları takip edin.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f3ed",
    theme_color: "#202a2b",
    lang: "tr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
