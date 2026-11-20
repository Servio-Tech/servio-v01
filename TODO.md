# SERVIO v2 outcomes

- [x] Work restricted to `v2-dev`; production, payment gateway, QZ utilities and live data left unchanged. Automatic Git deployment for `v2-dev` is disabled in branch configuration because preview and production currently share Supabase settings.
- [x] Dark manager reports/analytics, cashier receiver shell, settings header, offers and QR studio; existing operational forms retain light surfaces for legibility and safety.
- [x] Guest AR/EN UI, browser language detection, local recommendations, optional browser voice, quiet floating mode, and Pro gating. Product text falls back to the language available in the existing menu schema. Allergy exclusions are not inferred; guests are directed to staff.
- [x] QR studio, branch-aware URLs, previews, downloadable artwork and browser print layouts; physical printer tests remain outstanding.
- [x] Branch-scoped promotional metadata, schedule, target items and active toggles. Discounts are not automatically applied to orders or payments.
- [x] Starter: one branch and all features except the smart waiter and branch addition. Pro: smart waiter and up to three total branches. Entitlements and server-side branch limits require the reviewed, unapplied migration and trusted plan assignment.
- [x] Consolidated reports, real sales trends, distribution and peak hours, PDF/print, XLSX, DOCX and Access-compatible CSV. Promotion-performance analytics remains unavailable without reliable tracking data.
- [x] Branch add, rename and switch, plus safe deletion of empty active non-main branches only. Data-bearing branches are protected; deletion migration requires real-schema and concurrent-load review.
- [x] Local build, unit/React tests and synthetic in-memory PostgreSQL checks; no production database or physical printer was used.
- [ ] Create an isolated Supabase/Vercel staging environment and confirm printer/receipt behavior on actual devices before any future release. The current release was validated with local fixtures and automated checks; no physical printer test was available.
- [ ] Implement and validate server-authoritative promotion discounts and performance tracking if the business requires those features.
- [ ] Decide an approved archive/retention workflow for branches with existing data before offering their removal.


## Field Notes redesign

- [x] Rework the public home into the supplied editorial product-feed direction with alternating light/dark dashboard shots, filters, captions, and a role-value section while preserving registration, login, FAQ and bilingual copy.
- [x] Apply the same visual system to the guest menu and cashier workspace without changing order, shift, printer, notification or payment behavior.
- [x] Validate the build, 18 focused React tests, 40 local logic/migration tests, and the local route manifest before merging v2-dev into main and publishing Production.
