# Ev Hesap UI System

The implementation contract and rebuild rationale live in [UI_UX_REBUILD_SPEC.md](./UI_UX_REBUILD_SPEC.md). This file records the durable visual decisions; CSS and components remain the source of truth for exact behavior.

## Direction

**Sıcak Ortak Ev Defteri** is the single visual direction. Ev Hesap should feel like a clear, shared household record: welcoming, dependable, and easy to scan while several people coordinate everyday expenses. Keep the light theme in its ivory, off-white, evergreen, and coral family. Give dark mode an espresso and blackened-olive base, with the warm-paper ledger as its focal surface.

Use familiar household language and precise money labels. Keep ledger clarity in aligned amounts, explicit alacaklı/borçlu states, and traceable expense details. Build hierarchy with three quiet layers: room/page, working surface, and focal ledger. Avoid industrial panel motifs, rails, dense borders, decorative gradients, glass, fake testimonials, and unsupported claims.

## Color tokens

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#EFE5D4` | `#18130F` |
| Working surface | `#FFFCF5` | `#30231B` |
| Raised control | `#FFFFFF` | `#423126` |
| Soft grouping | `#E9DFD0` | `#514031` |
| Focal ledger | `#E5D3B8` | `#E8DCC7` |
| Main text | `#17211B` | `#F5EFE5` |
| Supporting text | `#59635D` | `#C1B19F` |
| Primary action | `#E66E45` | `#D97850` |
| Small accent text | `#A44729` | `#F0AB8B` |
| On primary action | `#17211B` | `#24160F` |
| Positive state | `#286248` | `#A9CCA8` |
| Negative state | `#78364E` | `#E9A6BB` |
| Focus ring | `#286C56` | `#F0B28E` |

The negative state uses a berry hue so it stays distinct from coral actions. State color always accompanies a written label or icon. `--surface-raised` is reserved for editable controls and selected options; it is not a fourth general content layer. The ledger surface stays warm and light in dark mode.

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
