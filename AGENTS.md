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
- Unevaluated, not-applicable and integration-only controls never count as zero; dimensions below minimum coverage are excluded from the global index, so missing data cannot penalize a company.
