# CLAUDE.md (apps/frontend)

Frontend-specific guidance for the TanStack Start app. Repo-wide context, commands, and coding conventions are in the root `CLAUDE.md`.

- **Routing:** file-based routes in `src/routes/` (`__root.tsx` is the shell). `routeTree.gen.ts` is **generated** by `tsr generate` — do not edit it by hand. Router/query setup lives in `src/router.tsx` and `src/integrations/tanstack-query/`.
- **UI:** Tailwind CSS v4 (configured in `src/styles.css`, not a `tailwind.config`) with shadcn/ui components (new-york style, `zinc` base colour, CSS variables) in `src/components/ui/`, built on Radix UI with `lucide-react` icons. Add components per `components.json`.
- **Backend client:** `@tuyau/core` consumes the type-safe client the backend generates.
- **SEO:** every route builds its head through `seo()` in `src/lib/seo.ts` (title, description, keywords, robots, canonical, Open Graph/Twitter, optional JSON-LD). Signed-in pages pass `noindex: true`; `_app/_auth` also sets a blanket noindex so a new authed route is covered by default. The public pages are listed once in `sitemap.ts` — that list drives both the build-time prerender (`pages` in `vite.config.ts`) and the generated `sitemap.xml`, so adding a public page means adding it there. The site origin comes from `VITE_SITE_URL` (falling back to `https://kalookionline.com` in both `seo.ts` and `vite.config.ts`).
- **Import aliases:** `#/*` and `@/*` both map to `src/*`.
- Much of the current `src/` (about page, `demo.*` files, demo routes) is starter scaffolding to be replaced with real Kalooki UI per `docs/Frontend-design.md`.
