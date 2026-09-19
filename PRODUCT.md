# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

People who live in the same household and need to coordinate shared expenses.

## Product Purpose

Ev Hesap lets housemates record shared expenses, see their expense history, and understand who owes whom. Success means the household can keep a clear account without doing the split calculations by hand.

## Positioning

A lightweight shared-expense tool focused on housemates. It calculates balances from open expenses and reduces them to a short transfer list.

## Operating Context

- The app is a mobile-first PWA, used by people who share a household.
- A user creates a household or joins one with its household code.
- Expenses record the payer, amount, date, description, category, and participating members. Not every expense must include every housemate.
- Users decide when to calculate and close a settlement period; settlement is not automatic or tied to month end.
- A settlement uses only expenses and direct debt payments that have not already been settled.

## Capabilities and Constraints

- The existing create-household, join-household, dashboard, expense, and settlement flows are to remain intact during the UI/UX refactor.
- The dashboard should stay legible for the user's usual four-person household and fit five household members without clipping or hiding balances. This is a layout target, not a new backend membership limit.
- Expenses can be added, edited, and deleted; balances and a simplified transfer list are derived from open expense and direct-payment records.
- A member can record a partial payment to a creditor without closing the whole settlement period; the payment is dated, attributed, and limited to the open balances.
- New household creation, joining, and shared-data changes require a Google identity through Supabase Auth; existing anonymous sessions can link Google without changing their user ID.
- Existing local-storage sessions may still be read as a prototype fallback when Supabase is not configured, but they cannot create shared households.
- The refactor must preserve the current Next.js, React, and Tailwind CSS stack and all data semantics.

## Brand Commitments

- Product name: Ev Hesap.
- The current app is written in Turkish.

## Evidence on Hand

- Product and calculation details: `ev-harcama-app-plan.md`.
- Current behavior and setup: `README.md` and the existing app routes.
- Landing-page sample household and expense figures are illustrative UI content, not verified customer evidence. Do not turn them into testimonials or performance claims.

## Product Principles

- Make recording a shared expense straightforward on a phone.
- Keep payer, participants, and amounts understandable to the whole household.
- Show balances from recorded expenses and direct payments, and show only open records in a settlement.
- Let the user choose when to calculate and close a period.
- Preserve existing household data and core flows while the interface changes.
- Keep member names and balances readable for households of up to five people.
