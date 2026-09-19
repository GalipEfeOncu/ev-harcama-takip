# Surface brief: household dashboard

## Scope and visitor mode

Operate. This brief leads the dashboard and its shared visual language across `/`, `/start`, `/dashboard`, and `/settle`. The representative visual surface is the mobile household dashboard. Preserve the existing create-household, join-household, expense, balance, and manual settlement behavior.

## Audience and job

Housemates who need to record shared costs and quickly understand the current open account. The primary action is recording an expense; the secondary action is reviewing a proposed transfer list before choosing to close the period.

## Content and constraints

Use the existing product data, labels, and Turkish copy. Demonstration values must stay clearly illustrative. Keep each expense's payer, participants, date, description, category, and amount understandable. Preserve the local-storage fallback and Supabase behavior. Never imply that settlement happens automatically or at month end.

Design density must remain clear for the user's four-person household and fit five members without clipping or hiding balances; do not introduce a backend membership limit.

## Direction contract

**THESIS:** Turn the shared open account into a readable household distribution panel, where every total, balance, and expense can be traced to the people who created it. Avoid the category-default dashboard made from interchangeable pastel cards.

**OWN-WORLD:** Matte mineral enamel, graphite ink, printed switch labels, and precise distribution rails. Use the selected gray-green, graphite, muted sage, signal-orange, and amber palette; strong sans-serif reading text; tabular amounts; small technical labels only where they aid scanning. Flat surfaces and rules carry the structure.

**STORY:** A housemate sees the open total, each person's net position, and the expenses behind those figures; they can add or edit an expense, then inspect the simplified transfers before manually closing a period.

**FIRST VIEWPORT:** On a 390 × 844 phone, a compact household identity strip leads into the open-period total. Preserve the approved two-level shared rail: Ece, Mert, and Deniz occupy three readable terminals on the first line; Ayşe and Can are centered below on a second connected line. Every active member has a visible name, signed net amount, and written alacaklı/borçlu state; never rely on color alone. The four-member case keeps the same breathing room, while five members fit without clipping. One orange “Harcama ekle” action sits beside or above the quieter “Borçları hesapla” link; open expenses begin below.

**FORM:** Daire Dağıtım Panosu, the direction assigned from the seven culturally grounded candidates; seed key `22a58c68`. Approved comp: `.impeccable/mocks/comp-panel-02.png`. The two-level five-member rail and its visual hierarchy are binding; names, household code, amounts, expenses, and member count shown in the comp are illustrative and must come from live app data. Keep the rail a clear diagram, preserve reversible pre-close choices, place expense edits beside their history rows, and keep explicit state labels.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
