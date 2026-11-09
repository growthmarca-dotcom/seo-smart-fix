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

## Architecture rules

- The integral business diagnosis lives per company in `src/diagnosis/` (pure logic); the SEO audit contributes a single indicator to the "web" dimension, so SEO never drives the global index.
- Unevaluated, no-data, not-applicable and integration-only controls never count as zero; "not applicable" requires a written justification, and the global index is shown only when sufficiency thresholds and critical controls are met, never by redistributing weights, so missing data cannot fake a complete score.
- Tourism commercial controls are the single editable source for their equivalent diagnosis controls (read via `src/diagnosis/equivalences.ts`, conflicts surfaced), so the same fact is never edited twice.
- The company diagnosis page (`/companies/$companyId/diagnosis`) is read-only and builds an in-memory diagnosis via `src/diagnosis/preview.ts`, so previews never write to stored state before persistence is approved.
- Proposals and service catalog persist additively in the existing state key behind a write-once pre-P3 backup and write guard; malformed P3 data blocks writes instead of being discarded, so no stored proposal is ever silently lost.
- Proposal client preview is built only from `clientView()` in `src/proposals/ui/proposal-view.ts`, so internal notes and collaborator names never reach client-facing output.
- URL scope classification lives in `src/seo/scope/` as pure signals only (tri-state "unknown" when the crawl lacks evidence); it never decides inclusion/exclusion, so heuristics cannot silently drop pages.
