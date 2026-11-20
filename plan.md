# SERVIO v2 development plan

## Safety and architecture

All implementation is restricted to `v2-dev`. The current Supabase project, payment integrations, QZ Tray printing, live orders, production settings, and `main`/`master` must not be modified or deployed. Database changes are versioned migration files for review and isolated testing only; no migration is applied to a live project. Existing application routes, contexts and order workflows remain authoritative. Test with local fixtures or an isolated development backend.

The existing React/Vite/MUI application will be enhanced in place. Manager reports and navigation, guest menu and native smart waiter, promotions, QR code generation, cashier receiver, and branches are separate modules. A server-authoritative plan source and enforced database policies are needed before plan isolation can be called secure. Never invent paid features or silently grant Pro.

## Visual direction

The new direction is **SERVIO Field Notes**: a vertical editorial product feed inspired by the supplied Dribbble references, not a generic SaaS template. The public surface uses warm paper (#f7f7f5), charcoal ink (#171717), thin hairline borders, soft 16–24px corners, generous whitespace, compact utility navigation, and large “shots” that alternate between light reporting boards and dark analytics boards. The manager and cashier workspaces keep the same visual language but become denser: charcoal canvas, graphite panels, lavender/blue chart accents, one orange action color, and high-contrast numeric hierarchy.

Core principles: (1) make the product feel like a curated stream of useful operational snapshots, (2) let one large card carry one story, (3) use dark analytics panels as signature brand assets rather than as decoration, and (4) preserve the fastest path to orders, shifts and printing. The layout paradigm is a single-column editorial spine on public pages and a split rail plus asymmetric data canvas inside workspaces. Signature elements are the SERVIO wordmark with a small status dot, pill-shaped filter controls, and miniature dashboard “shots” with a caption/meta row. Motion is limited to 160–220ms lift/fade transitions, never blocking operational actions. Tajawal remains the Arabic face; Inter/system sans-serif serves English. Brand essence: **a calm operating feed for hospitality teams that turns a noisy service day into the next clear action**. Personality: editorial, precise, human.

## Structure

- `src/pages` and `src/components/manager-dashboard`: manager navigation, reports, settings, promotions and branch interfaces.
- `src/components/menu`, `src/pages/Menu.jsx`, `src/utils/smartWaiter*`: guest menu and local browser-native recommendations/voice.
- `src/components/cashier-dashboard`: lean live order and service-call views, retaining existing operational components.
- `src/utils`: capability, analytics and export helpers.
- `supabase/migrations`: reviewable, unapplied database changes where needed.
- `src/styles/studio.css`: shared Field Notes tokens, editorial feed surfaces and workspace utility classes; visual changes must not alter order, payment, printer or database contracts.
