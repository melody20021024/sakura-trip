# CLAUDE.md

Guidance for AI assistants (and humans) working in this repository.

## Project overview

**Sakura Trip (櫻旅)** is a mobile-first, **offline-first collaborative trip planner PWA** for Japan travel. A group shares a single trip via a link — no accounts, no login. Everyone can edit the same itinerary, budget, and checklists concurrently (including offline), and changes merge without clobbering each other.

This is **v2**, an upgrade that fixes critical v1 data-loss bugs and adds budget tracking, drag-to-reorder, a packing list, and AI-assisted flight/exchange-rate lookup. The UI language is Traditional Chinese.

Five tabs: **Trip** (itinerary) · **Money** (expenses/budget) · **Lists** (food / shopping / packing) · **Album** (shared album links) · **Setting**.

## Tech stack

- **React 18** + **Vite 5** (ESM, `"type": "module"`).
- **Tailwind CSS 3** (build-time via PostCSS + autoprefixer — not CDN).
- **Dexie** (IndexedDB) for offline-first local persistence.
- **Supabase** (Postgres + Realtime, anonymous RLS) as the shared cloud store.
- **@dnd-kit** for drag-and-drop reordering; **lucide-react** for icons.
- **vite-plugin-pwa** for the service worker / installable app.
- **Vitest** for unit tests.
- **Vercel serverless functions** in `api/` that call the **Anthropic Claude API** (flight lookup) and a free FX API (exchange rate).

## Commands

```bash
npm install
npm run dev       # Vite dev server. The .claude/launch.json preset pins port 5188 (--strictPort)
npm run build     # Production build → dist/
npm run preview   # Serve the production build
npm test          # Vitest (vitest run) — runs src/lib/__tests__/*.test.js
```

There is no lint script configured. `src/scripts/check-jsx.mjs` is an ad-hoc JSX syntax sanity check.

## Environment variables

Provide via `.env.local` (git-ignored):

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — consumed by `src/supabase.js` (frontend; `VITE_` prefix required).
- `ANTHROPIC_API_KEY` — used only by the serverless functions in `api/`, never the frontend.
- `FLIGHT_MODEL` — optional Claude model override for `api/flight.js`.

## Repository layout

```
src/
  App.jsx                main shell: 5-tab frame + sync status
  main.jsx               React root
  supabase.js            Supabase client
  hooks/
    useTrip.js           ★ central orchestrator: local state, mutations, sync, realtime
    useConfirm.js        promise-based confirm-dialog state
  lib/                   framework-free business logic
    schema.js            data shape, defaults, enums, validation (schemaVersion: 3)
    db.js                Dexie/IndexedDB access (+ in-memory fallback)
    tripKey.js           resolve trip key from URL ?trip + localStorage; mint strong keys
    sync.js              Supabase pull / push / realtime subscribe (read-merge-write + CAS)
    merge.js             field-level last-write-wins merge with tombstones
    migrate.js           idempotent v1 → v2/v3 data normalization
    settle.js            multi-currency expense settlement math
    api.js               client for /api/flight and /api/rate
    __tests__/           merge.test.js, settle.test.js
  components/            shared UI: ui.jsx, Header, BottomNav, SyncStatusBadge,
                         OfflineBanner, ConfirmSheet, DragHandle
  views/                 one folder per tab: trip/ money/ lists/ album/ setting/
api/
  flight.js              GET /api/flight — Claude + web_search for flight times
  rate.js                GET /api/rate   — free FX rate lookup
supabase-schema.sql      single `trips` table + anonymous RLS policy
.claude/launch.json      dev-server launch preset (port 5188)
```

### Documentation folders (numbered, read these for intent)

- **01-PRD/** — `PRD.md`, the authoritative v2 spec (features `F-xx`, data model, test plan, risks).
- **02-Design/** — `ui-spec.md` (design tokens) and a clickable `prototype.html`.
- **03-DesignDocs/** — `backend/sync-and-apis.md` (data/merge contract + API specs + migration rules), `frontend/app-v2.md` (component architecture), `commits-plan.md`, `implementation-report.md`.
- **05-SA-Reports/** — software-assurance audits (`audit-20260605*.md`) with severity-ranked findings; the latest verdict is **pass**.
- **04-Implementation/**, **99-Archive/** — currently empty / reserved.

Feature requirements are referenced by IDs like `F-03`; trace them through `01-PRD/PRD.md`.

## Architecture: state, sync, and merge

`src/hooks/useTrip.js` is the **single source of truth** that all five views consume. It keeps the live snapshot in a `useRef`, mirrors it to React state for rendering, and exposes mutators (`setField`, `addItem`, `updateItem`, `reorderItems`, `addExpense`, `addCheck`, etc.). It owns the sync state machine (`synced | syncing | offline | failed`) and the pending-push counter.

**Write path**: edit → commit to IndexedDB immediately (instant render) → debounced push to Supabase (~600ms). Each mutation stamps **only the changed field's `updatedAt`**.

**Read path**: on startup, load IndexedDB first, then pull from Supabase and merge. A Realtime subscription adopts remote changes but skips fields the user is actively editing.

**Merge contract** (`src/lib/merge.js`): field-level **last-write-wins** keyed by `updatedAt`; lists are unioned by `id` with newest-per-item winning; deletes use **tombstones** (`{ _deleted: true, updatedAt }`) so removed items don't resurrect; ties break deterministically (tombstone wins, else stable-serialized comparison). Pushes use read-merge-write with compare-and-swap retry to avoid clobbering another device's writes.

This is the heart of the app and the source of v1's data-loss bugs. **Any change touching `merge.js`, `sync.js`, `migrate.js`, or `schema.js` must keep `npm test` green and should add cases to `src/lib/__tests__/`.**

### Data model (schemaVersion 3)

Mutable scalars are wrapped as `{ v, updatedAt }`; list items each carry `updatedAt` and an optional `_deleted`. Top-level fields: `tripName`, `startDate`, `endDate`, `rate` (JPY→TWD), `budgetJPY`, `travelers[]`, `flights[]`, `days[]` (each with `city`/`lodging` mergeable scalars and `items[]`), `expenses[]`, `food[]`, `shopping[]`, `packing[]`, `albums[]`, and a one-time `_v1backup`. `migrate.js` upgrades older blobs idempotently (migrated scalars get `updatedAt: 0` so fresh edits win).

### Backend

Supabase exposes one `trips` table (`id text pk`, `data jsonb`, `writer`, `updated_at`) with an **anonymous "all access" RLS policy** — the 22-char trip key is the access boundary (PIN protection is a Phase-2 consideration). See `supabase-schema.sql`. The serverless `api/` functions fail gracefully so the app stays usable when they're unavailable.

## Conventions

- **Components**: `PascalCase.jsx`. Views in `views/<tab>/` own their tab's UI and call mutators from the `trip` prop; `components/` are presentational (data + callbacks, no business logic). Library/util files are `camelCase.js`.
- **Mutators** are named by action: `add*` / `update*` / `delete*` / `set*`.
- **No Redux/Context store** — `useTrip` is the hub.
- Keep React-free logic in `src/lib/` so it stays unit-testable.
- Enums (item types, expense categories) live in `schema.js` and per-view `constants.js`; reuse them rather than hardcoding strings.

## When making changes

- Match the existing modular structure; do not reintroduce a monolithic component (v1's 600-line file was the thing v2 refactored away).
- Touching sync/merge/migrate/schema → add tests and run `npm test`.
- Adding a feature → check `01-PRD/PRD.md` for the relevant `F-xx` requirement first.
- The app must remain functional offline; prefer optimistic local writes that reconcile via merge.

## Git workflow

Active development branch: **`claude/claude-md-docs-hKGeH`**. Commit with clear messages and push with `git push -u origin claude/claude-md-docs-hKGeH`. Do not open a pull request unless explicitly asked.
