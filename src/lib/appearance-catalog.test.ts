import { describe, expect, it } from "vitest";
import { DENSITIES, FONT_OPTIONS, FONT_SIZES, getTheme, THEMES } from "./appearance-catalog";

function luminance(hex: string) {
  const rgb = hex.replace("#", "").match(/../g)!.map((channel) => parseInt(channel, 16) / 255);
  const linear = rgb.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrast(a: string, b: string) {
  const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

const requiredTokens = [
  "--bg", "--surface", "--surface-raised", "--surface-soft", "--text", "--text-muted",
  "--accent", "--accent-text", "--accent-hover", "--on-accent", "--positive", "--negative",
  "--on-negative", "--warning", "--warning-surface", "--border-subtle", "--border-strong",
  "--focus", "--danger-surface", "--success-surface", "--ledger-surface", "--ledger-text",
  "--ledger-muted", "--scrim", "--shadow-selection", "--shadow-sheet",
].sort();

describe("appearance catalog", () => {
  it("offers 24 complete, uniquely identified palettes, balanced between light and dark", () => {
    expect(THEMES).toHaveLength(24);
    expect(new Set(THEMES.map((theme) => theme.id)).size).toBe(24);
    expect(THEMES.filter((theme) => theme.mode === "light")).toHaveLength(12);
    expect(THEMES.filter((theme) => theme.mode === "dark")).toHaveLength(12);
    for (const theme of THEMES) expect(Object.keys(theme.tokens).sort(), theme.id).toEqual(requiredTokens);
  });

  for (const theme of THEMES) {
    it(`${theme.label} keeps working text, actions and money states readable`, () => {
      const t = theme.tokens;
      const readable = (foreground: string, background: string) => {
        expect(contrast(t[foreground], t[background]), `${theme.id}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      };
      for (const surface of ["--bg", "--surface", "--surface-raised", "--surface-soft"]) {
        for (const foreground of ["--text", "--text-muted", "--accent-text", "--positive", "--negative"]) readable(foreground, surface);
      }
      readable("--ledger-text", "--ledger-surface");
      readable("--ledger-muted", "--ledger-surface");
      readable("--on-accent", "--accent");
      readable("--on-accent", "--accent-hover");
      readable("--on-negative", "--negative");
      readable("--positive", "--success-surface");
      readable("--negative", "--danger-surface");
      readable("--warning", "--warning-surface");
      // Money states always retain a green/red semantic independent of theme accent.
      expect(t["--positive"]).not.toBe(t["--accent"]);
      expect(t["--negative"]).not.toBe(t["--accent"]);
    });
  }

  it("resolves system appearance and safely falls back for stale or unknown theme ids", () => {
    expect(getTheme("system").id).toBe("ev-hesap-light");
    expect(getTheme("system", true).id).toBe("ev-hesap-dark");
    expect(getTheme("not-a-theme").id).toBe("ev-hesap-light");
    expect(getTheme("nord-night", false).id).toBe("nord-night");
  });

  it("keeps independent appearance controls available without downloading font libraries", () => {
    expect(FONT_OPTIONS[0].id).toBe("mada");
    expect(new Set(FONT_OPTIONS.map((font) => font.id)).size).toBe(FONT_OPTIONS.length);
    expect(FONT_OPTIONS.every((font) => font.family && !font.url)).toBe(true);
    expect(FONT_SIZES.map((size) => size.id)).toEqual(["small", "default", "large"]);
    expect(DENSITIES.map((density) => density.id)).toEqual(["comfortable", "standard", "compact"]);
  });
});
