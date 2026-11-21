---
version: 1
slug: "src-app-settings-page-tsx"
primary_target: "src/app/settings/page.tsx"
related_targets: ["src/app/layout.tsx", "src/app/dashboard/page.tsx", "src/app/settle/page.tsx"]
---

# Settings surface

Operate mode. The user approved a dedicated settings page, a 24-theme catalog, font, font size, density and reduced motion, account synchronization with per-device overrides. Preserve current expense, direct-payment and settlement semantics. Existing default palette and layout remain the incumbent; screenshots from 19 September are historical, not current visual authority.

## Direction contract

**THESIS:** Give personal preferences and household administration a readable home so the ledger header can focus on the household.

**OWN-WORLD:** Inherit the current Ev Hesap neutral surfaces, Mada, quiet spacing and coral default action. Curated themes change the complete semantic palette coherently. Money states retain explicit written labels and readable contrast.

**STORY:** A housemate finds appearance, sees an illustrative ledger preview, selects a harmonious palette independently of font and density, and understands whether changes apply to the account or this device. Household invite and identity actions live in their own sections.

**FIRST VIEWPORT:** Desktop: persistent section navigation on the left, appearance controls and a meaningful ledger preview on the right. Mobile: a clear section index opens one detail page with a visible back action. Theme search, favorite and light/dark filters make a large catalog manageable.

**FORM:** Code-led extension of the user-approved plan; no new identity or concept selection. Themes are presets, no arbitrary color editor. Apply changes live, expose sync failures and retry, offer undo and reset. Preserve 44px controls and large-type money readability.

**FINISH:** unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
