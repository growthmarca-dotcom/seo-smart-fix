# MarCa Audit — Connection status and minimal plan to finish the MVP

Read-only diagnosis based on the code. No changes have been made.

## 1. Connections: real status

| Connection | Status | Evidence in code | What's missing for real use |
|---|---|---|---|
| Generic website | **Really working** | `src/lib/crawl.server.ts` (actual fetch of robots, sitemaps and HTML) via `crawlSiteFn` / `analyzeUrlFn` in `src/lib/crawl.functions.ts`; called from `audits.new.tsx` | Nothing to function. Limits: doesn't run JavaScript; server functions are public (no login). |
| Google Search Console | **Partially implemented** | `src/lib/gsc.server.ts` calls the real API (`/webmasters/v3/sites`, `searchAnalytics/query`) through the Lovable connector; `gsc.functions.ts` returns `configured:false` if `GOOGLE_SEARCH_CONSOLE_API_KEY` is missing. Today that variable **is not set**. CSV import + demo also work. | Link a Google Search Console connection to the project. Never tested with real data. |
| Tienda Nube | **Partially implemented** | `src/lib/tiendanube.server.ts` (real API reads, 401/403/429 handling) + `src/seo/tiendanube/adapter.ts`. Credentials come from global environment variables (`TIENDANUBE_ACCESS_TOKEN`, `TIENDANUBE_STORE_ID`), **not set**. There is no OAuth callback route (no `src/routes/api/`): the "OAuth" generates the authorization URL, but the code is not exchanged automatically. | Tienda Nube partner app + token obtained manually; per-client credentials. Outside the MVP. |
| GA4 | **UI/placeholder only** | Just an entry in `src/seo/integrations.ts` (`status: needs-credentials`). No server function, no client. | Everything (connection, endpoint, data model). Future. |
| PageSpeed / CWV | **UI/placeholder only** | Same: entry in `integrations.ts`. The crawler does save `responseMs`, `htmlSizeKb`, `hasViewport` (proxy signals, not CWV). | API key + server function. Future improvement. |
| Google Business Profile | **Planned** | Entry `status: planned` in `integrations.ts`. Local SEO rules only read NAP/`LocalBusiness` from the HTML. | Everything. Future. |
| Mercado Libre | **UI/placeholder only (state C)** | `src/seo/connectors/mercadolibre.ts` with no `fetchSnapshots`; placeholder rules `ml-*`. | API, OAuth, adapter. Outside the MVP. |
| WordPress / WooCommerce / Shopify | **Planned (text only)** | Only mentions in `integrations.tsx:74` and comments in `connectors/index.ts`. No files. | Everything. Future. |

## 2. Already implemented in the main flow (not pending)

- New audit: whole site (50–1000 URLs, respects robots) or single URL; demo mode.
- Real crawl, 48 rules, weighted score with explanation, coverage, broken links.
- Results: summary, diagnostics with per-finding priority, URL detail, architecture, content, priorities, GSC and e-commerce tabs.
- Suggestions and changes with approve/reject/applied and editing; review history.
- Progress: shows discovered/analyzed/issues, but **not live** — the crawl is a single call and the numbers appear at the end. Works; it's an improvement, not a blocker.
- Persistence: works in the browser (`localStorage`). Survives reloads; not shared between devices.

## 3. The 3 blockers for calling the MVP finished

1. **There's no downloadable professional deliverable.** No PDF, print view or export exists in any route.
2. **Never validated end to end with a real lodging site.** Everything verified is the engine (81 tests); the screens haven't been tested against a real tourism site.
3. **No tourism/lodging criteria.** `page-profiles.ts` has no lodging page type and no rules exist for `Hotel`/`LodgingBusiness`, rooms, rates, direct booking or contact/WhatsApp.

(Online persistence and login are needed before using it with clients outside MarCa, but they don't block internal use by MarCa Growth.)

## 4. Recommended next phase (just one)

**Phase MVP-1 — Complete walkthrough + downloadable report**

1. Run the full flow on 1–3 real lodging sites and record any errors that stop use (fix only those).
2. New "Report" screen per audit, printable and downloadable as PDF from the browser (print to PDF), with a MarCa Growth cover page:
   - Executive summary (SEO Health score, categories, coverage).
   - Top prioritized findings with evidence and recommendation.
   - Opportunities (content/architecture; GSC if imported).
   - Action plan by priority (Alta/Media/Baja).
   - Methodology and limitations (no JS, no CWV).
3. "Lodging" section in the report that only shows criteria detectable today (lodging/local schema, NAP, contact, images); without new rules.

Lodging-specific rules go to a later phase (MVP-2), adding a page profile without touching existing scoring.

## 5. Scope

- **Current MVP:** web crawl, engine, diagnostics, priorities, suggestions, GSC by CSV/connection, report + walkthrough (phase MVP-1).
- **Later improvements:** lodging rules (MVP-2), live progress, online persistence + login, finishing the evidence migration, splitting large screens.
- **Future integrations:** real GSC tested, PageSpeed, GA4, Google Business Profile, Tienda Nube per client, Mercado Libre, WordPress/WooCommerce/Shopify.

## Technical details (phase MVP-1)

- New route `src/routes/audits.$auditId.report.tsx` with its own `head()`; read-only over `Audit`, `groupDiagnostics`, `correlate`, `link-graph`, `content-analysis`. Doesn't modify engine, rules, scoring or store.
- PDF via `window.print()` + `@media print` styles in `src/styles.css` (no new dependencies).
- Access button from `audits.$auditId.tsx`.
- Evidence rendered with existing helpers (`evidenceToStrings`).
- Update `docs/MARCA-AUDIT-PRODUCT.md` and `SEO-APP-STATE.md` correcting GSC: the real API code exists via connector (previously described as "CSV only").
