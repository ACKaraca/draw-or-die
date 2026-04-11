# Jules Async Task: Full Repository i18n Refactor

Repository: ACKaraca/draw-or-die
Branch: main

Use this as an asynchronous Jules task prompt.

## Goal

Refactor the entire repository so every user-facing string follows the project's i18n standard:

- Turkish is the default and primary locale.
- English is the secondary locale.
- No raw user-facing strings should remain in components, hooks, routes, or shared utilities unless they are intentionally locale-specific or AI-output text that must stay English.
- All dual-language rendering must go through the repo's localization layer, especially `pickLocalized` and related helpers in `lib/i18n.ts`.

## Scope

Review and update the following areas:

- `app/`
- `components/`
- `hooks/`
- `lib/`
- `types/`
- any translation data or helper files you need to introduce

Do not change the language policy for AI-generated critique output. AI output must stay English.

## What to inspect

- Hardcoded Turkish or English copy in UI components.
- Error messages, empty states, CTA labels, tooltips, toasts, banners, and form validation messages.
- Route handlers returning user-facing text.
- Profile, auth, referral, billing, gallery, and consent flows.
- Any place where user-facing text bypasses the localization helpers.

## Required approach

1. Map the current localization flow and identify every place where strings are still hardcoded.
2. Normalize the i18n model so translation keys are consistent and easy to extend.
3. Prefer centralized dictionaries or helper functions over scattered inline strings.
4. Keep the current UX language order: Turkish first, English second.
5. Preserve public behavior, data shape, and API contracts unless a fix is required for i18n.

## Acceptance criteria

- All visible UI text has Turkish and English variants.
- No new raw user-facing strings are introduced.
- The repo still passes lint, typecheck, and tests.
- Any necessary docs or developer notes are updated.
- If there are ambiguous strings, list them explicitly instead of guessing.

## Deliverable

Return a concise report with:

- files changed
- any remaining gaps or risky areas
- tests run and results
- follow-up recommendations if a full repo-wide refactor should be split into smaller passes