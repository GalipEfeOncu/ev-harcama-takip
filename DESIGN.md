---
name: Ev Hesap
description: A clear shared household ledger with personal appearance preferences.
colors:
  primary: "#e96f4c"
  primary-hover: "#d85f3e"
  accent-text: "#b54627"
  on-primary: "#1a1d1b"
  page: "#f6f5f2"
  surface: "#ffffff"
  surface-raised: "#ffffff"
  surface-soft: "#f0efeb"
  ledger: "#f0efeb"
  text: "#1a1d1b"
  text-muted: "#626a64"
  positive: "#24734b"
  negative: "#b42318"
  focus: "#1e7a4e"
  border-subtle: "#e3e2dd"
  border-strong: "#b5b4ad"
  dark-primary: "#e97a5a"
  dark-primary-hover: "#d96648"
  dark-accent-text: "#f19a82"
  dark-on-primary: "#26130e"
  dark-page: "#121412"
  dark-surface: "#191b19"
  dark-surface-raised: "#202320"
  dark-surface-soft: "#252825"
  dark-ledger: "#202320"
  dark-text: "#f1f3f0"
  dark-text-muted: "#a8aea8"
  dark-positive: "#65b98a"
  dark-negative: "#f07d73"
  dark-focus: "#80cba0"
  dark-border-subtle: "#2c302c"
  dark-border-strong: "#464c47"
typography:
  display:
    fontFamily: '"Mada Variable", "Mada", sans-serif'
    fontSize: "clamp(2.5rem, 6.3vw, 5.4rem)"
    fontWeight: 750
    lineHeight: 1.02
  title:
    fontFamily: '"Mada Variable", "Mada", sans-serif'
    fontSize: "1.875rem"
    fontWeight: 750
    lineHeight: 1.15
    letterSpacing: "-.035em"
  body:
    fontFamily: '"Mada Variable", "Mada", sans-serif'
    fontSize: "1rem"
    lineHeight: 1.5
  label:
    fontFamily: '"Mada Variable", "Mada", sans-serif'
    fontSize: ".875rem"
    fontWeight: 650
  amount:
    fontFamily: '"Mada Variable", "Mada", sans-serif'
    fontSize: "clamp(1.5625rem, 3vw, 2rem)"
    lineHeight: 1.2
    letterSpacing: "-.035em"
rounded:
  control: "10px"
  surface: "18px"
  sheet: "24px"
spacing:
  appearance-gap: "1.5rem"
  appearance-panel-padding: "1.375rem"
  appearance-row-padding: "1.0625rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.control}"
    padding: "0 18px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "0 16px"
  input-field:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "10px 13px"
  working-surface:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.surface}"
  settings-navigation:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
  activity-filter:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    padding: "6px 12px"
---

# Design System: Ev Hesap

## Overview

**Creative North Star: "Sade Ortak Ev Defteri"**

Ev Hesap should feel like a clear, shared household record: welcoming, dependable, and easy to scan while several people coordinate everyday expenses. Use familiar household language and precise money labels. Keep ledger clarity in aligned amounts, explicit alacaklı/borçlu states, and traceable expense details.

The incumbent neutral surfaces and coral default action remain the starting point. Personal appearance is an approved extension of that direction: curated palettes and independent reading preferences preserve the same semantic hierarchy and household flows. Build hierarchy with three quiet layers: room/page, working surface, and focal ledger. Avoid industrial panel motifs, rails, dense borders, decorative gradients, glass, fake testimonials, and unsupported claims.

**Key Characteristics:**

- Quiet neutral surfaces and a restrained primary accent.
- Aligned money values, explicit balance states, and readable Turkish copy.
- Rounded controls and working surfaces with spacing rather than pervasive outlines.
- Curated appearance choices that preserve ledger clarity.

The rebuild rationale remains in [UI_UX_REBUILD_SPEC.md](./UI_UX_REBUILD_SPEC.md). This document merges the approved appearance system into the incumbent direction. Runtime values are implemented in `src/lib/appearance-catalog.ts`, `src/app/appearance.css`, and `src/app/globals.css`; `.impeccable/design.json` records extension metadata and component examples. The settings surface contract remains in `.impeccable/surfaces/src-app-settings-page-tsx.md`.

## Colors

The frontmatter records the current Ev Hesap default light and dark palettes. `THEMES` in `src/lib/appearance-catalog.ts` is normative for all 24 complete semantic presets: 12 light and 12 dark. Each preset supplies page, surface, ledger, text, accent, positive, negative, warning, borders, focus, scrim, and shadow tokens together. Do not transplant an accent onto an unrelated surface palette.

### Primary

Warm coral marks the primary action in the default palettes. Small accent text uses the separate readable accent-text token. Alternative presets may use their curated accent pair; coral is not a universal requirement for a selected alternative.

### Neutral

Page, working surface, and focal ledger retain quiet tonal separation. Raised controls are used for editable controls, selected options, and established popovers; they do not introduce a fourth general content layer. The default dark palette keeps its charcoal-green surfaces and raised charcoal ledger. Other approved dark presets use their own coherent dark surface family; none introduces a light focal card.

### Semantic states

Positive remains green and negative remains red, distinct from the primary action. State color always accompanies a written label or icon. The default light supporting text is slightly darkened for contrast; use the catalog value rather than the older CSS fallback value. Body and placeholder text must meet 4.5:1 contrast; large text must meet 3:1.

**The Complete Palette Rule.** Apply the selected preset's full semantic token map so previous theme values cannot leak into the next palette.

## Typography

**Default display and body font:** Mada Variable, with Mada and sans-serif fallbacks. `src/app/layout.tsx` imports `@fontsource-variable/mada`, serving the variable font locally with Turkish latin-ext support; the app does not depend on a build-time Google Fonts request.

Five independent font stacks are exposed by `FONT_OPTIONS` in `src/lib/appearance-catalog.ts`:

| Choice | Stack |
| --- | --- |
| Mada · Varsayılan | `var(--font-app), "Mada", sans-serif` |
| Sistem | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| Hümanist | `"Trebuchet MS", "Segoe UI", sans-serif` |
| Kitap | `Georgia, "Times New Roman", serif` |
| Eş aralıklı | `"Cascadia Code", "SFMono-Regular", Consolas, monospace` |

Only Mada is bundled. The other choices are local system stacks whose resolved family depends on the device; no listed local family is guaranteed to be installed.

### Hierarchy

The frontmatter captures default display, settings title, body, label, and dashboard total roles. Product section titles range from 1.125rem to 1.5rem; supporting text is generally .8125rem to .875rem. Comparable currency figures use tabular numerals. The reading-size control independently sets the root to small (93.75%, nominal 15px), standard (100%, nominal 16px), or large (112.5%, nominal 18px). Rem-based product type and amounts scale with that choice; mobile large-type layouts wrap rows and long money values as needed.

**The Aligned Amount Rule.** Align comparable money values and use tabular numerals without hiding names or amounts at larger reading sizes.

## Layout

Use a centered work area with a maximum width of 1240px. On desktop the dashboard has account summary, members, and secondary actions on the left and activity on the right. On mobile, household identity precedes the open account, vertically stacked member balances, one filtered activity feed, and reachable primary actions. Bottom actions open the expense and direct-payment forms from the same place; settlement remains a review route.

Density is independent of font, font size, theme, and reduced motion. `src/app/appearance.css` defines the actual affected panels, rows, and forms:

| Density | Gap | Panel padding | Row padding | Row minimum |
| --- | --- | --- | --- | --- |
| Comfortable | 2rem | 1.75rem | 1.5rem | 4.5rem |
| Standard | 1.5rem | 1.375rem | 1.0625rem | 3.875rem |
| Compact | 1rem | 1rem | .625rem | 3rem |

At 560px and below, panel padding becomes 1.25rem, 1.0625rem, or .875rem respectively. Density never shrinks interactive targets below 44px or editable fields below 48px. Preserve safe-area padding and legibility at 320px; long names wrap and truncated household labels retain their accessible name.

Settings apply density to section spacing, scope controls, navigation, account/member rows, and the illustrative ledger. Section gaps are 2.5rem, 2rem, or 1.5rem respectively. The Arayüz section includes a live illustrative activity list so changing density immediately shows actual row and padding differences, rather than only changing the selected option.

The dedicated `/settings` route uses persistent section navigation and content columns on desktop. At 760px and below, a section index opens one detail view with a visible back action. Its theme catalog changes from four columns to three or two as available width decreases, with a two-column catalog at 460px and below. These compositions are surface patterns, not a new global visual direction.

## Elevation & Depth

Prefer spacing and surface tone over outlines around every region. Working surfaces are flat at rest. Small selection shadows distinguish selected segmented options; sheet shadows separate dialogs and established popovers. Their light/dark values belong to the selected semantic preset and are listed in the sidecar.

**The Quiet Surface Rule.** Keep the page, working surface, and ledger hierarchy tonal; reserve elevation for selection and overlaid controls.

## Shapes

Use gently rounded controls (10px), working surfaces (18px), and sheets (24px). Preserve observed local variants such as settings previews (16px), theme tiles (11px), and pill-shaped state labels. These variants do not replace the shared radius scale. Use 44px minimum touch targets and 48px primary actions and modal controls.

## Components

### Buttons and fields

Primary actions use the selected accent and on-accent pair; hover uses accent-hover. Secondary actions use working surfaces, subtle borders, and soft hover fill. Fields use raised-control surfaces and strong borders. Keep semantic labels, announced save/error status, and visible keyboard focus. Keyboard focus uses the selected focus token; pointer interaction must not leave a persistent focus ring. Destructive confirmation remains an accessible `alertdialog`; dialogs contain keyboard focus and restore it when closed.

### Ledger and expense forms

Member balances remain vertically stacked with written alacaklı/borçlu states and comparable amounts. Activity is one filterable feed with traceable payer and participant context. Keep equal split as the default; progressively disclose custom shares, show their derived total, and retain entered values when switching modes. Preserve local-storage prototype behavior, Supabase access, expense CRUD, direct payments, and user-controlled settlement.

### Settings navigation and appearance controls

Dashboard and settlement headers link directly to `/settings`, retaining household context. On narrow screens the header entry uses an accessible gear icon. Appearance belongs to the dedicated settings page rather than a three-choice secondary account menu. Settings sections are Görünüm, Arayüz, Ev ve üyeler, and Hesap.

Theme controls offer name search, all/light/dark/favorite filters, a favorite action per tile, a selected checkmark, and a live illustrative ledger preview. In addition to the 24 fixed presets, “Cihaz temasını izle” follows the OS between the two default Ev Hesap palettes. Defaults are system theme, Mada, standard font size, standard density, reduced-motion override off, and no favorites. Selection applies live; undo and reset act on the current scope.

Theme, font stack, reading size, density, reduced motion, and favorites belong to one appearance preference record. Account scope is implemented through Supabase `user_preferences`, with a per-user local cache and queued writes; a device override applies a separate local record without changing the account appearance. Returning to account scope removes that override and applies the account values. Guests retain preferences in the browser. Account changes isolate caches by user; returning to the same account restores its device override and pending local choices. Apply cached appearance before first paint and expose loading, saving, saved/local, and error states with retry. The additive migration was applied to the production Supabase project on 2026-10-23; live OAuth and real account synchronization remain unverified.

Reduced motion is an independent switch. When enabled it removes smooth scrolling and reduces transitions and animations to .01ms. Existing OS `prefers-reduced-motion` rules also remain in effect; keep that support when extending components. Normal control color transitions are 150ms ease; the settings preview uses 180ms ease-out only when motion is permitted.

Implementation references: `src/lib/preferences.ts`, `src/components/preferences-provider.tsx`, `src/app/layout.tsx`, `src/app/settings/page.tsx`, `src/app/settings/settings.css`, `src/app/dashboard/dashboard.css`, `src/components/activity-feed.tsx`, `src/components/member-balances.tsx`, and `src/app/settle/settle.css`.

## Do's and Don'ts

### Do:

- **Do** preserve the Sade Ortak Ev Defteri direction while applying the user's complete selected palette.
- **Do** keep each name, signed amount, and written balance state readable without color.
- **Do** align comparable currency figures and use tabular numerals.
- **Do** keep appearance choices independent and identify account or device scope explicitly.
- **Do** retain keyboard focus, readable contrast, safe areas, and reduced-motion support.

### Don't:

- **Don't** turn the interface into industrial panels, rails, glass, decorative gradients, or dense outlined regions.
- **Don't** encode owing, owed, selected, or error states with color alone.
- **Don't** mix individual colors from different curated theme presets.
- **Don't** shrink touch targets to achieve compact density or hide amounts to fit larger type.
- **Don't** present illustrative household figures as verified customer evidence or claim account synchronization succeeded when it failed.
