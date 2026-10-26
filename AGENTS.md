<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project rules
- Signed-in pages live under `src/routes/_authenticated/` (client-only gate, also redirects un-onboarded users to /onboarding); the shell (sidebar / mobile tab bar) is rendered by that layout. Why: one place for auth and navigation.
- Shared Odysstay display components (Money, ScoreBadge, DeadlinePill, SourceQuote, NotStated, IllustrationLabel) live in `src/components/odys/primitives.tsx`; reuse them, never re-implement. Why: source/fact rules stay consistent.
- Routing is TanStack Router (fixed by platform), despite Knowledge mentioning React Router.
