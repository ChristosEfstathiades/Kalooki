# CLAUDE.md (apps/frontend)

Frontend-specific guidance for the TanStack Start app. Repo-wide context, commands, and coding conventions are in the root `CLAUDE.md`.

- **Routing:** file-based routes in `src/routes/` (`__root.tsx` is the shell). `routeTree.gen.ts` is **generated** by `tsr generate` — do not edit it by hand. Router/query setup lives in `src/router.tsx` and `src/integrations/tanstack-query/`.
- **UI:** Tailwind CSS v4 (configured in `src/styles.css`, not a `tailwind.config`) with shadcn/ui components (new-york style, `zinc` base colour, CSS variables) in `src/components/ui/`, built on Radix UI with `lucide-react` icons. Add components per `components.json`.
- **Backend client:** `@tuyau/core` consumes the type-safe client the backend generates.
- **Import aliases:** `#/*` and `@/*` both map to `src/*`.
- Much of the current `src/` (about page, `demo.*` files, demo routes) is starter scaffolding to be replaced with real Kalooki UI per `docs/Frontend-design.md`.
