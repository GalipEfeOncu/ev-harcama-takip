# Ev Hesap UI System

The implementation contract and rebuild rationale live in [UI_UX_REBUILD_SPEC.md](./UI_UX_REBUILD_SPEC.md). This file records the durable visual decisions; CSS and components remain the source of truth for exact behavior.

## Direction

**Sade Ortak Ev Defteri** is the single visual direction. Ev Hesap should feel like a clear, shared household record: welcoming, dependable, and easy to scan while several people coordinate everyday expenses. Let neutral surfaces do almost all visual work; coral is reserved for primary action, green for positive state, and red for destructive state. Dark mode uses only charcoal-green surfaces: it never introduces a light paper or cream focal card.

Use familiar household language and precise money labels. Keep ledger clarity in aligned amounts, explicit alacaklı/borçlu states, and traceable expense details. Build hierarchy with three quiet layers: room/page, working surface, and focal ledger. Avoid industrial panel motifs, rails, dense borders, decorative gradients, glass, fake testimonials, and unsupported claims.

## Color tokens

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#F6F5F2` | `#121412` |
| Working surface | `#FFFFFF` | `#191B19` |
| Raised control | `#FFFFFF` | `#202320` |
| Soft grouping | `#F0EFEB` | `#252825` |
| Focal ledger | `#F0EFEB` | `#202320` |
| Main text | `#1A1D1B` | `#F1F3F0` |
| Supporting text | `#69706B` | `#A8AEA8` |
| Primary action | `#E96F4C` | `#E97A5A` |
| Small accent text | `#B54627` | `#F19A82` |
| On primary action | `#1A1D1B` | `#26130E` |
| Positive state | `#24734B` | `#65B98A` |
| Negative state | `#B42318` | `#F07D73` |
| Focus ring | `#1E7A4E` | `#80CBA0` |

The negative state is standard red and stays distinct from coral actions. State color always accompanies a written label or icon. `--surface-raised` is reserved for editable controls and selected options; it is not a fourth general content layer. The ledger uses a slightly raised charcoal surface in dark mode, never a light focal card.

## Type, space, and shape

- Use Mada for product UI, with a 16px body baseline and tabular numerals for comparable money values.
- Use 44px as the minimum touch target and 48px for primary actions and modal controls.
- Use 10px control, 18px surface, and 24px sheet radii. Prefer spacing and surface tone over outlines around every region.
- Keep names and amounts legible at 320px; allow long names to wrap and household labels to truncate without hiding their accessible name.

## Information architecture

- On mobile, show household identity first, followed by the open account, vertically stacked member balances, one filtered activity feed, and reachable primary actions.
- On desktop, use a centered two-column work area: account summary, members, and secondary actions on the left; activity on the right.
- Keep equal split as the default. Progressively disclose custom shares and show their derived total; retain entered values when switching modes.
- Persist `system`, `light`, or `dark` theme selection and apply it before first paint. On authenticated mobile screens, keep theme choice in the secondary account menu.
- Preserve local-storage prototype behavior, Supabase access, expense CRUD, custom shares, direct payments, and user-controlled settlement.

## Accessibility and motion

Keep visible keyboard focus, semantic headings and labels, announced save/error status, reduced-motion support, safe-area padding, and keyboard-contained dialogs with focus restoration. Destructive confirmation remains an accessible `alertdialog`; color never carries status by itself. Body and placeholder text must meet 4.5:1 contrast; large text must meet 3:1.

## Source files

- Shared tokens and public surfaces: `src/app/globals.css`
- Dashboard and dialogs: `src/app/dashboard/dashboard.css` and `src/app/dashboard/page.tsx`
- Activity and balances: `src/components/activity-feed.tsx` and `src/components/member-balances.tsx`
- Settlement view: `src/app/settle/settle.css`
- Persisted theme control: `src/components/theme-control.tsx`
