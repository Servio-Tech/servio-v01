# SERVIO v2 development plan

## Safety and architecture

All implementation is restricted to `v2-dev`. The current Supabase project, payment integrations, QZ Tray printing, live orders, production settings, and `main`/`master` must not be modified or deployed. Database changes are versioned migration files for review and isolated testing only; no migration is applied to a live project. Existing application routes, contexts and order workflows remain authoritative. Test with local fixtures or an isolated development backend.

The existing React/Vite/MUI application will be enhanced in place. Manager reports and navigation, guest menu and native smart waiter, promotions, QR code generation, cashier receiver, and branches are separate modules. A server-authoritative plan source and enforced database policies are needed before plan isolation can be called secure. Never invent paid features or silently grant Pro.

## Visual direction

A precise dark-analytics workspace: ink backgrounds (#111111, #161618), navy surfaces (#14213D, #1E2530), subtle one-pixel borders and burnt-orange actions (#D9541E). Keep layouts responsive, data-forward, keyboard accessible and bilingual. Use restrained movement, 6–8px radii and no heavy glass effects. Use Tajawal for Arabic and Inter/system sans-serif for English. A clear SERVIO wordmark and sparse orange highlights provide continuity; microcopy is direct and operational.

## Structure

- `src/pages` and `src/components/manager-dashboard`: manager navigation, reports, settings, promotions and branch interfaces.
- `src/components/menu`, `src/pages/Menu.jsx`, `src/utils/smartWaiter*`: guest menu and local browser-native recommendations/voice.
- `src/components/cashier-dashboard`: lean live order and service-call views, retaining existing operational components.
- `src/utils`: capability, analytics and export helpers.
- `supabase/migrations`: reviewable, unapplied database changes where needed.
