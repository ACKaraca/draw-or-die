# Manual Prompt: Add the `x` Language in i18n Standards

Use this prompt manually in the coding agent or any local assistant session.

Repository: ACKaraca/draw-or-die
Branch: main

## Prompt

Refactor the repository to add a new supported language called `x` while preserving the existing i18n conventions.

Requirements:

- Update `lib/i18n.ts` so `SupportedLanguage` includes `x`.
- Extend normalization and language resolution so `x` is recognized everywhere a locale can be resolved.
- Refactor the localization helpers if needed so they scale beyond only Turkish and English.
- Update every user-facing string in the app to have `tr`, `en`, and `x` variants or a scalable equivalent translation structure.
- Keep Turkish as the fallback default unless the repo's conventions require a different fallback.
- Keep AI-generated critique output in English unless there is a strong repository-level reason not to.
- Preserve existing behavior for auth, billing, referral, gallery, and consent flows.
- Update tests, fixtures, and any snapshot-like expectations that depend on visible copy.
- Do not introduce raw strings into components, hooks, or route handlers if a localization helper already exists or can be introduced.

Implementation guidance:

- Prefer a translation dictionary or key-based approach if adding `x` makes the current two-language helper too limited.
- Keep the current user language selection behavior stable.
- If the repo has language-aware user profile fields, persist `x` without breaking existing `tr` and `en` users.
- Update any runtime localizers, helper components, and server responses that render user-facing copy.

Validation:

- Run lint.
- Run TypeScript type checking.
- Run the test suite.
- Summarize any files that still need manual translation review.

Output required:

- a concise implementation summary
- the list of files changed
- any unresolved gaps or follow-up tasks