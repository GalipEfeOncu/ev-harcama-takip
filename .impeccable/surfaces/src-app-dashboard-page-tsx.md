---
version: 1
slug: "src-app-dashboard-page-tsx"
primary_target: "src/app/dashboard/page.tsx"
related_targets: ["src/app/page.tsx","src/app/start/start-client.tsx","src/app/settle/page.tsx"]
---

# Surface brief: household dashboard

## Scope and visitor mode

Operate. This brief leads the dashboard and its shared visual language across `/`, `/start`, `/dashboard`, and `/settle`. The representative visual surface is the mobile household dashboard. Preserve the existing create-household, join-household, expense, balance, and manual settlement behavior.

## Audience and job

Housemates who need to record shared costs and quickly understand the current open account. The primary action is recording an expense; the secondary action is reviewing a proposed transfer list before choosing to close the period.

## Content and constraints

Use the existing product data, labels, and Turkish copy. Demonstration values must stay clearly illustrative. Keep each expense's payer, participants, date, description, category, and amount understandable. Preserve the local-storage fallback and Supabase behavior. Never imply that settlement happens automatically or at month end.

Design density must remain clear for the user's four-person household and fit five members without clipping or hiding balances; do not introduce a backend membership limit.

## Direction contract

**THESIS:** Make a shared household account feel like a clear, welcoming home ledger. People should be able to see what the household recorded, who paid, who shares each cost, and what remains open without translating accounting jargon.

**OWN-WORLD:** “Sade Ortak Ev Defteri” is the single direction across `/`, `/start`, `/dashboard`, and `/settle`. Let neutral surfaces create hierarchy: white and one soft neutral in light mode; charcoal-green layers only in dark mode. Never use a light paper or cream focal card in dark mode. Use Mada, tabular amounts, code-native house marks, quiet tonal separation, and one coral action color. Green is reserved for positive state; standard red is reserved for destructive state and always carries a written label or icon.

**STORY:** A housemate opens the household account, sees the open expenses and each person's explicit alacaklı/borçlu state, records or edits an expense, and reviews “Kim kime ödeyecek?” before deciding whether to move the open records into history. The app never sends money or closes a period automatically.

**FIRST VIEWPORT:** At 390 × 844, household identity leads, followed by the open expense total, a readable vertical balance list, the activity feed, and a fixed action bar that respects the safe area. Keep the household name visible in the header and put theme choice in the secondary account menu. The primary action is “Harcama ekle”; the secondary action is “Ödeme kaydet”, opening its own focused form. Four members should breathe; five must fit without clipping or hiding names, balances, or written alacaklı/borçlu labels. At 1440 × 900, use a centered two-column work area with account summary and balances on the left and one activity feed on the right.

**FORM:** Three quiet layers define depth: room/page, working surface, and focal ledger. The ledger remains warm paper in both themes. Use spacing and tone before borders; keep editable controls, status, focus, error, disabled, loading, and empty states legible in both themes. Do not bring back rails, industrial switch language, decorative gradients, glass, card walls, or unverified claims.

**FUNCTION:** Preserve create/join, local-storage prototype behavior, Supabase, expense CRUD, equal and custom shares, direct payments, and manual settlement. Keep payer, participants, date, category, amounts, and signed member states precise. Non-open activity scopes also show each dated period closure with its included record counts. All sample data stays clearly illustrative.

**FINISH:** check both themes at 390 × 844 and 1440 × 900, verify contrast and horizontal overflow, and document any authenticated route that cannot be populated safely.
