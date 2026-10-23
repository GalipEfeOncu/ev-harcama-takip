export type ThemePreset = {
  id: string;
  label: string;
  mode: "light" | "dark";
  description: string;
  tokens: Record<string, string>;
};

type Palette = {
  id: string;
  label: string;
  description: string;
  // Page → working surface → grouped surface; accents are curated as a pair.
  colors: [string, string, string, string, string, string, string, string];
};

function preset(mode: ThemePreset["mode"], palette: Palette): ThemePreset {
  const [bg, surface, soft, text, muted, accent, accentText, hover] = palette.colors;
  const dark = mode === "dark";
  return {
    id: palette.id,
    label: palette.label,
    mode,
    description: palette.description,
    tokens: {
      "--bg": bg,
      "--surface": surface,
      "--surface-raised": dark ? soft : surface,
      "--surface-soft": soft,
      "--text": text,
      "--text-muted": muted,
      "--accent": accent,
      "--accent-text": accentText,
      "--accent-hover": hover,
      "--on-accent": "#171b19",
      "--positive": dark ? "#83cba4" : "#205f40",
      "--negative": dark ? "#f49c98" : "#a82b27",
      "--on-negative": dark ? "#27110f" : "#ffffff",
      "--warning": dark ? "#e7bf70" : "#755000",
      "--warning-surface": dark ? "#302a21" : "#f7efd9",
      "--border-subtle": dark ? `color-mix(in srgb, ${text} 12%, ${surface})` : `color-mix(in srgb, ${text} 13%, ${surface})`,
      "--border-strong": `color-mix(in srgb, ${text} 34%, ${surface})`,
      "--focus": accentText,
      "--danger-surface": dark ? "#35201f" : "#fdecec",
      "--success-surface": dark ? "#183124" : "#e8f4ec",
      "--ledger-surface": soft,
      "--ledger-text": text,
      "--ledger-muted": muted,
      "--scrim": dark ? "rgb(5 7 5 / 76%)" : "rgb(20 24 21 / 62%)",
      "--shadow-selection": dark ? "0 1px 3px rgb(0 0 0 / 28%)" : "0 1px 3px rgb(20 24 21 / 10%)",
      "--shadow-sheet": dark ? "0 20px 64px rgb(0 0 0 / 50%)" : "0 20px 64px rgb(20 24 21 / 18%)",
    },
  };
}

const light: Palette[] = [
  { id: "ev-hesap-light", label: "Ev Hesap · Açık", description: "Tanıdık mercan, sıcak beyaz ve sakin yeşil.", colors: ["#f6f5f2", "#ffffff", "#f0efeb", "#1a1d1b", "#626a64", "#e96f4c", "#b54627", "#d85f3e"] },
  { id: "rose-dawn", label: "Gül Şafağı", description: "Gül kurusu, krem ve soluk çam tonları.", colors: ["#faf4ed", "#fffaf5", "#f2e9e1", "#403b4e", "#6c6173", "#e6a5a8", "#914763", "#d9989d"] },
  { id: "nord-day", label: "Kuzey Günü", description: "Buz mavisi yüzeyler, dingin çelik mavisi.", colors: ["#eceff4", "#f8fafc", "#e3e8f0", "#2e3440", "#526074", "#8fbcce", "#365b78", "#81aebf"] },
  { id: "gruvbox-day", label: "Sıcak Plak", description: "Parşömen üzerinde bal ve toprak renkleri.", colors: ["#fbf1c7", "#fff8de", "#f2e5bc", "#3c3836", "#665a49", "#dba84e", "#7c481c", "#cc9740"] },
  { id: "sage", label: "Adaçayı", description: "Soluk adaçayı ve yumuşak zeytin yeşili.", colors: ["#f0f3eb", "#fafcf6", "#e4ebda", "#26342d", "#53614f", "#a7bd8d", "#415d32", "#98af7e"] },
  { id: "lavender", label: "Lavanta", description: "Lila yüzeyler, duru erik vurguları.", colors: ["#f4f1f9", "#fcfaff", "#eae4f1", "#352d43", "#655870", "#c7afe1", "#694586", "#b99ed4"] },
  { id: "linen", label: "Keten", description: "Doğal keten, açık ahşap ve sıcak kahve.", colors: ["#f6f1e8", "#fffcf6", "#ede3d4", "#342c24", "#6c5d4c", "#d6b38b", "#78502b", "#c9a378"] },
  { id: "sea-glass", label: "Deniz Camı", description: "Açık turkuaz, köpük beyazı ve derin petrol.", colors: ["#edf6f3", "#f8fdfa", "#dfede7", "#243c37", "#4c6660", "#91c8bb", "#2d665c", "#80b8ab"] },
  { id: "peach", label: "Şeftali", description: "Şeftali kremi ve kiremit vurgular.", colors: ["#fcf1e9", "#fffaf6", "#f4e3d8", "#402e29", "#74574c", "#edb394", "#944c31", "#dfa184"] },
  { id: "blueprint", label: "Mavi Mürekkep", description: "Serin kâğıt beyazında yumuşak mürekkep mavisi.", colors: ["#f0f4fa", "#fbfdff", "#e3eaf5", "#28364b", "#52617a", "#a6bedf", "#3e5d8b", "#94acd0"] },
  { id: "cherry-paper", label: "Kiraz Çiçeği", description: "Pudra pembesi ve ölçülü vişne rengi.", colors: ["#fbf1f3", "#fff9fa", "#f1e1e7", "#412d37", "#725460", "#dfa6bc", "#8a3f5f", "#d195ad"] },
  { id: "graphite-paper", label: "Kurşun Kalem", description: "Nötr gri, temiz beyaz ve açık grafit.", colors: ["#f2f3f4", "#ffffff", "#e5e7e9", "#292d32", "#5b626b", "#b9c3cc", "#4b5966", "#a8b3be"] },
];

const dark: Palette[] = [
  { id: "ev-hesap-dark", label: "Ev Hesap · Koyu", description: "Kömür yeşili yüzeyler ve sıcak mercan.", colors: ["#121412", "#191b19", "#252825", "#f1f3f0", "#a8aea8", "#e97a5a", "#f19a82", "#d96648"] },
  { id: "rose-night", label: "Gül Gecesi", description: "Gece moru, toz pembe ve soluk altın.", colors: ["#191724", "#1f1d2e", "#26233a", "#e0def4", "#aba6c1", "#ebbcba", "#ebbcba", "#dbabaa"] },
  { id: "nord-night", label: "Kuzey Gecesi", description: "Derin kutup mavisi ve buzlu mavi vurgular.", colors: ["#242b36", "#2e3440", "#353e4c", "#eceff4", "#b8c3d3", "#88c0d0", "#a2d2df", "#79afbf"] },
  { id: "gruvbox-night", label: "Gece Plağı", description: "Koyu toprak yüzeylerde yumuşak kehribar.", colors: ["#211f1d", "#282623", "#32302c", "#f2e5bc", "#c2b393", "#e2b75c", "#e2b75c", "#d2a84e"] },
  { id: "pine", label: "Çam Ormanı", description: "Gölgeli orman yeşili ve sakin yosun.", colors: ["#111c19", "#192721", "#22322b", "#e4eee6", "#a4b9aa", "#b6c693", "#b6c693", "#a4b582"] },
  { id: "ink", label: "Gece Mürekkebi", description: "Lacivert, yumuşak lavanta ve açık mürekkep.", colors: ["#151b2a", "#1b2335", "#252e43", "#e4eaf7", "#aab7d2", "#b2b5ed", "#bec1fa", "#a2a5dc"] },
  { id: "mocha", label: "Mocha", description: "Espresso yüzeyler, sütlü kahve vurguları.", colors: ["#211b18", "#2a211d", "#352b25", "#f1e7dc", "#c0ac99", "#d7b494", "#e3c2a6", "#c6a383"] },
  { id: "deep-sea", label: "Derin Deniz", description: "Koyu petrol ve deniz köpüğü turkuazı.", colors: ["#101e24", "#172a30", "#20363d", "#e1eff0", "#a3bdc2", "#8dc8ce", "#a3d8dc", "#7cb7bd"] },
  { id: "ember", label: "Köz", description: "Sıcak antrasit üzerinde yumuşak bakır.", colors: ["#211b1a", "#2a2220", "#352a27", "#f4e7df", "#c4aea0", "#e5a07e", "#f0b698", "#d48f6e"] },
  { id: "blue-hour", label: "Mavi Saat", description: "Akşam mavisi ve gölgeli gökyüzü tonları.", colors: ["#171e27", "#202a36", "#2b3745", "#e5edf5", "#afc0d3", "#91b9e2", "#a9cef0", "#80a8d1"] },
  { id: "plum", label: "Mürdüm", description: "Koyu erik, pembe yaprak ve sıcak beyaz.", colors: ["#241b26", "#2d2331", "#392d3d", "#f2e5f0", "#c4aec3", "#dcb2cf", "#ebc2de", "#cba1be"] },
  { id: "carbon", label: "Karbon", description: "Duru kömür yüzeyler ve dengeli bal sarısı.", colors: ["#171818", "#202121", "#2b2d2d", "#eeefea", "#b4b8b2", "#dfc27d", "#e7cd95", "#ceb16c"] },
];

/** Every preset supplies every semantic token, so switching cannot leak the previous palette. */
export const THEMES: ThemePreset[] = [
  ...light.map((palette) => preset("light", palette)),
  ...dark.map((palette) => preset("dark", palette)),
];

// Preserve the established Ev Hesap colors, with only the light supporting text
// darkened slightly to remain readable on the ledger's off-white surface.
Object.assign(THEMES[0].tokens, {
  "--on-accent": "#1a1d1b",
  "--positive": "#24734b", "--negative": "#b42318", "--warning": "#8a5c00",
  "--focus": "#1e7a4e", "--border-subtle": "#e3e2dd", "--border-strong": "#b5b4ad",
});
Object.assign(THEMES[12].tokens, {
  "--surface-raised": "#202320", "--ledger-surface": "#202320",
  "--positive": "#65b98a", "--negative": "#f07d73", "--warning": "#d9a441",
  "--on-accent": "#26130e", "--focus": "#80cba0",
  "--border-subtle": "#2c302c", "--border-strong": "#464c47",
});

export function getTheme(id: string, systemDark = false): ThemePreset {
  const resolved = id === "system" ? (systemDark ? "ev-hesap-dark" : "ev-hesap-light") : id;
  return THEMES.find((theme) => theme.id === resolved) ?? THEMES[0];
}

export const FONT_OPTIONS: { id: string; label: string; family: string; url?: string }[] = [
  { id: "mada", label: "Mada · Varsayılan", family: 'var(--font-app), "Mada", sans-serif' },
  { id: "system", label: "Sistem", family: 'system-ui, -apple-system, "Segoe UI", sans-serif' },
  { id: "humanist", label: "Hümanist", family: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { id: "serif", label: "Kitap", family: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Eş aralıklı", family: '"Cascadia Code", "SFMono-Regular", Consolas, monospace' },
];

export const FONT_SIZES: { id: "small" | "default" | "large"; label: string; value: string }[] = [
  { id: "small", label: "Küçük", value: "0.9375rem" },
  { id: "default", label: "Standart", value: "1rem" },
  { id: "large", label: "Büyük", value: "1.125rem" },
];

export const DENSITIES: { id: "comfortable" | "standard" | "compact"; label: string }[] = [
  { id: "comfortable", label: "Rahat" },
  { id: "standard", label: "Standart" },
  { id: "compact", label: "Kompakt" },
];
