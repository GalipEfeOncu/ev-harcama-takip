---
name: Ev Hesap
description: A shared-expense account presented as a readable household distribution panel.
colors:
  graphite-ink: "#0a1117"
  mineral-paper: "#e9f0e8"
  mineral-paper-raised: "#f2f6f0"
  mineral-paper-shade: "#dce8dc"
  muted-copy: "#586866"
  sage-rule: "#a6b5aa"
  sage-accent: "#9eafa1"
  signal-orange: "#d86436"
  signal-orange-deep: "#b94924"
  danger: "#7b2b1d"
typography:
  display:
    fontFamily: "Yantramanav, sans-serif"
    fontSize: "clamp(50px, 6.1vw, 78px)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  heading:
    fontFamily: "Yantramanav, sans-serif"
    fontSize: "clamp(40px, 6vw, 60px)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.03em"
  body:
    fontFamily: "Mada, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.45
  action:
    fontFamily: "Mada, sans-serif"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: 1.1
  amount:
    fontFamily: "Yantramanav, sans-serif"
    fontSize: "clamp(17px, 2.3vw, 22px)"
    fontWeight: 700
    lineHeight: 1.06
  phone-balance:
    fontFamily: "Barrio, sans-serif"
    fontSize: "clamp(18px, 5.05vw, 20px)"
    fontWeight: 400
    lineHeight: 1.4
  code:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "12px"
    fontWeight: 400
rounded:
  field: "3px"
  control: "4px"
  node: "50%"
components:
  button-primary:
    backgroundColor: "{colors.signal-orange}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "#c8522a"
  button-primary-disabled:
    backgroundColor: "#c7bdb1"
    textColor: "#39413e"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "0 15px"
    height: "46px"
  input-field:
    backgroundColor: "{colors.mineral-paper-raised}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.field}"
    padding: "0 12px"
    height: "48px"
---

# Design System: Ev Hesap

## Overview

**Creative North Star: “Daire Dağıtım Panosu”**

Ev Hesap presents the household's open account as a readable distribution panel: totals, people, and expenses stay connected by precise rules. Matte mineral paper, graphite ink, muted sage, and one signal-orange family make the surface feel domestic and composed rather than like a repair console.

The mobile household dashboard is the signature surface. Its balance rail gives three members clear terminals on the upper line and centers up to two more on a connected lower line. The four-person household keeps breathing room; the five-member view remains readable without clipping. Each person has a signed amount and written alacaklı/borçlu state, and open expenses remain visible beneath the action area. The names and amounts shown in the surface brief are illustrative; use household data in the product.

**Key Characteristics:**
- Mineral green-gray surfaces, graphite ink, muted sage, and a restrained orange accent family.
- A connected two-level member rail with explicit names, signed balances, and text states.
- Tabular financial figures, readable Turkish copy, and compact labels.
- Flat, rule-led surfaces with compact rectangular controls.

## Colors

The active palette is mineral green-gray and graphite, with sage rules and signal orange for primary actions and small points of emphasis.

### Primary
- **Signal Orange** (#d86436): Filled primary actions and dashboard balance nodes.
- **Deep Signal Orange** (#b94924): Small supporting emphasis in headings, status icons, and selected underlines.

### Neutral
- **Graphite Ink** (#0a1117): Main text, strong rules, control borders, and dark wordmark marks.
- **Mineral Paper** (#e9f0e8): Page and dashboard background.
- **Raised Mineral Paper** (#f2f6f0): Input and code surfaces.
- **Shaded Mineral Paper** (#dce8dc): Quiet hover and confirmation surfaces.
- **Muted Copy** (#586866): Secondary text and supporting labels.
- **Sage Rule** (#a6b5aa): Dividers and low-emphasis borders.
- **Sage Accent** (#9eafa1): Link underline and quiet accent details.

### Semantic State
- **Danger** (#7b2b1d): Error text and destructive action feedback; pair it with an explicit message or action label.

The surface brief mentions amber, but the inspected stylesheet has no active amber use. It declares a warning variable that is not referenced, so amber is not part of the shipped palette documented here.

### Named Rules
**The One Signal Rule.** Orange marks the primary action or a meaningful balance node; deep orange is reserved for small supporting emphasis.

**The Readable Panel Rule.** A member name, signed amount, and alacaklı/borçlu state remain understandable without color or decoration.

## Typography

**Display Font:** Yantramanav (with sans-serif fallback)
**Body Font:** Mada (with sans-serif fallback)
**Label/Mono Font:** System monospace for short household codes only

**Character:** Mada keeps body copy open and legible in Turkish. Yantramanav gives headings and most financial figures a compact, sturdy voice; Barrio appears only for member balance amounts on phone widths. Household codes use the system monospace stack, while other labels stay in the reading or heading face.

### Hierarchy
- **Display** (700, `clamp(50px, 6.1vw, 78px)`, 0.98, -0.035em): Public landing hero heading.
- **Dashboard heading** (700, `clamp(40px, 6vw, 60px)`, 0.98, -0.03em): Household title; 42px on phone and 39px at widths up to 350px.
- **Body** (400, 16px, 1.45): Default copy and controls; route-specific supporting copy ranges from 13px to 18px.
- **Action** (700, 15px, 1.1): Standard action label; the phone dashboard primary action uses 17px Yantramanav.
- **Amount** (700, `clamp(17px, 2.3vw, 22px)`, 1.06): Member balance on wider layouts and aligned ledger amounts. Financial comparisons use tabular numerals.
- **Phone balance** (400, `clamp(18px, 5.05vw, 20px)`, 1.4): Upper-rail member amounts at widths up to 480px; the lower row uses `clamp(16px, 4.5vw, 18px)`.
- **Code** (400, 12px): Compact household code in the system monospace stack; it drops to 11px on phone widths and 10px up to 350px.

Yantramanav is loaded at weights 300, 400, 500, and 700; Mada uses Latin and Latin Extended subsets; Barrio is loaded at weight 400 with the Latin subset. Use tabular numerals where amounts align; the stylesheet applies `font-variant-numeric: tabular-nums` to financial figures and codes.

### Named Rules
**The Aligned Amount Rule.** Amounts compared in a row share a right edge and use tabular numerals wherever the stylesheet establishes that treatment.

## Layout

Keep the dashboard's reading order mobile-first: household identity, open-period total, member rail, primary expense action with the quieter settlement link, then open expenses and history. At the 390px-wide target in the surface brief, the five-member rail uses three upper terminals and two centered lower terminals. A four-member household uses the same upper line with one centered lower terminal. The CSS also has one- and two-member rail variants.

The dashboard main column is capped at 1360px. Its default padding is 27px top, `clamp(19px, 4.8vw, 54px)` horizontally, and 92px bottom. At widths up to 480px it becomes 23px top, 19px sides, and 70px bottom; up to 350px the side inset becomes 15px. On wider layouts, the lower rail is 76% wide with a 580px maximum; at phone widths it is 80% wide. The upper rail stays a three-column line, while the two-person lower rail is centered beneath it.

Dashboard section spacing is component-specific rather than a named scale: the total, rail, actions, and open ledger begin after 21px, 27px, 23px, and 30px on wider layouts. On phone widths, those gaps are 19.5px, 29px, 17px, and 30px; history begins after 48px. Keep these measured anchors and the existing fluid `clamp()` values instead of adding a new spacing scale.

The public shell is capped at 1440px, the dashboard header at 1240px, and the main dashboard at 1360px. Two-column landing, onboarding, and settlement layouts collapse to one column at 760px. The public navigation hides at that width. The stylesheet's responsive thresholds are 980px, 760px, 480px, and 350px; narrower rules compact the dashboard header, member rail, action pair, and settlement rows.

## Elevation & Depth

The inspected global rules use flat surfaces rather than shadows. Mineral paper, raised and shaded paper, one-pixel sage dividers, and stronger one- or two-pixel graphite rules establish depth. The expense modal uses a graphite outline and paper surface over a dimmed backdrop. Button transitions last 150ms with `ease`; the upper balance rail settles over 420ms with `cubic-bezier(0.16, 1, 0.3, 1)`. Reduced-motion preferences reduce animation and transition duration to 0.01ms and disable smooth scrolling.

### Named Rules
**The Flat-By-Default Rule.** Surfaces stay flat at rest; labels, borders, and fills show control state.

## Shapes

The visual language is compact and squared: fields use 3px corners, standard actions use 4px corners, and rail nodes are circular. Most sections and containers stay square and are defined by rules rather than rounded cards. The global keyboard focus ring is 2px graphite with a 3px offset; form fields retain the same outline with a 1px offset and a graphite border.

## Components

### Buttons
- **Shape:** Compact rectangle with 4px corners and a 1px border.
- **Primary:** Signal Orange fill, Graphite Ink text, 46px minimum height, and 15px horizontal padding. On phone dashboard widths it becomes 43px high and fills its grid column.
- **Hover / Focus:** Hover shifts fill and border to `#c8522a`; keyboard focus uses the visible 2px graphite outline. Disabled primary controls use `#c7bdb1` fill, `#39413e` text, and `#9a8a7e` border.
- **Secondary:** Transparent fill and graphite border in the standard button style. On the dashboard, “Borçları hesapla” is a quieter underlined text action with no box border or fill.

### Cards / Containers
- **Corner Style:** Square edges for panel sections; the modal has no rounded card silhouette.
- **Background:** The page uses Mineral Paper; fields use Raised Mineral Paper; the settlement confirmation uses Shaded Mineral Paper.
- **Shadow Strategy:** The inspected global rules add no shadows to these surfaces.
- **Border:** One-pixel sage or graphite rules, with a two-pixel graphite top rule on emphasized panels.
- **Internal Padding:** Expense modal uses 24px top, `clamp(19px, 4vw, 30px)` horizontal, and 28px bottom padding.

### Inputs / Fields
- **Style:** Raised Mineral Paper, graphite text, 3px corners, 1px `#87978c` border, 48px minimum height, and 12px horizontal padding.
- **Placeholder:** Muted green-gray `#53645c` at full opacity.
- **Focus:** Graphite border and 2px graphite outline with a 1px offset.
- **Error / Disabled:** Error rows use explicit text, `#7b2b1d` rules/text, and `#f2dfd8` fill; do not rely on color alone.

### Navigation
- The public header uses a 72px minimum height and a three-column grid; at widths up to 760px it becomes a 64px two-column header and hides its nav links.
- The household header keeps the household name and short code visible; at phone widths the name and code compact, and at widths up to 350px compact further.
- Period selection is a horizontal, scrollable text row with a 1px Deep Signal Orange underline on the active period.

### Balance Rail
- **Structure:** Three upper terminals connect by a fine graphite rule; one or two centered lower terminals connect through a vertical trunk and a short horizontal rule.
- **Marker:** 9px orange node with a paper border on the dashboard; nodes remain separate from names and amounts.
- **Phone Treatment:** The upper rail spans the dashboard's inner width. The lower rail widens to 80% and preserves the two-level five-member arrangement.
- **Content:** Keep signed amount and written alacaklı/borçlu state adjacent to each member name.

### Expense Rows
- **Style:** Transparent, full-width rows with a bottom divider rather than separate cards.
- **Hierarchy:** Description and amount lead; payer, participants, date, and category remain supporting details. Amounts stay tabular and unwrapped.
- **Spacing:** Wider rows have a 72px minimum height; phone rows use 68px, with the final open row at 85px.

### Expense Modal
- **Shape:** Square-edged panel with a 1px graphite border and no shadow.
- **Size:** `min(100%, 520px)` wide, capped at `calc(100dvh - 40px)` high, with its own vertical scrolling.
- **Surface:** Mineral Paper over the modal backdrop.

## Do's and Don'ts

### Do:
- **Do** preserve the household identity, total, connected balance rail, actions, and open ledger in that reading order.
- **Do** keep each name, signed amount, and written balance state readable without color.
- **Do** align comparable currency figures and use tabular numerals.
- **Do** use orange for the primary action and small meaningful markers; use deep orange for supporting emphasis.
- **Do** keep surfaces flat and let spacing, mineral tone, and rules establish their hierarchy.

### Don't:
- **Don't** turn the interface into interchangeable pastel cards, glass panels, gradient glow, or decorative blobs.
- **Don't** make the interface look like an electrical repair console or an error alarm.
- **Don't** encode owing, owed, selected, or error states with color alone.
- **Don't** promote the brief's amber mention into an active token without a shipped use.
- **Don't** decorate every section with switch labels, wiring, or equipment marks.
