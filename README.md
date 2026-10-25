# ThreadFlow — web frontend

Garments production tracking: Fabric → Cutting → Print / Emb → Sewing → GPQ → PP Meeting → Completed.
Next.js (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · lucide-react · SWR · Recharts.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run build
```

Sign in with **Company name → Username or ID → Password**. Demo data:

| Company | Password (all demo users) |
| --- | --- |
| `Demo Garments Ltd.` | `factory@2026` |

| Username | ID | Role |
| --- | --- | --- |
| `karim.admin` | EMP-0001 | Admin (super user) |
| `rahim.ahmed` | EMP-0002 | Production Manager (super user) |
| `tanvir.hasan` | EMP-0003 | Merchandiser (super user) |
| `jamal.uddin` | EMP-0011 | Fabric supervisor |
| `farhan.kabir` / `rahim.mia` | EMP-0012 / 0013 | Cutting supervisors |
| `tariqul.islam` | EMP-0015 | Sewing supervisor |

The **Quick demo** buttons fill these in. Super users (admin, merchandiser, manager) create users in
Settings → Users. The account menu has **Switch demo role**.

**PP Meeting** (per `Ui/PPM_ In the card_.pdf`): GPQ sets the **PPM time** when it completes and the
order moves to the PPM queue. Cards show Image · Order number · Buyer · Unit · PPM time. Opening a card
shows the PPM time as the main heading, all earlier data, and **Findings** — a numbered list or an
uploaded image of hard-copy findings. Completing the PP Meeting (≥ 1 finding) completes the order.

## Tests

```bash
npm test                 # unit + API contract + component tests (Vitest, ~10 s)
npm run test:e2e         # end-to-end in Chrome (Playwright); needs `npm run build` first
npm run test:all         # lint → typecheck → unit → build → e2e
```

| Suite | What it proves |
| --- | --- |
| `tests/unit/engine.test.ts` | Workflow rules from *ui documentations.pdf* §3–§6: Fabric delivered / not found, the 4 Cutting options, ignore embellishment, Print & Emb in parallel, refused requests leave the order unchanged |
| `tests/unit/stages.test.ts` | Status = tone + word, card timeline hides empty rows, queue buttons, waiting/late rules |
| `tests/unit/format.test.ts` | Bangladesh-time formats (card, stamp, datetime inputs) — run in UTC to prove it |
| `tests/unit/permissions.test.ts` | Who can do what; sidebar per role |
| `tests/unit/api.test.ts` | Mock REST contract the NestJS API must match: auth, validation, 401/403/404/409, reports, settings |
| `tests/unit/components.test.tsx` | Status badge, order card, filter chips, empty / error states |
| `tests/e2e/*.spec.ts` | Login and roles, the full PDF flow through the UI, no horizontal scroll and ≤1 blue button at 390 / 834 / 1440 px, loading / empty / error states, Bangla |

E2E uses the installed Google Chrome. To use Playwright's own browser instead:
`npx playwright install chromium` and set `E2E_CHANNEL=chromium`.

## Docker

```bash
docker compose up -d --build     # http://localhost:3000
docker compose logs -f web
docker compose down
```

To point at the NestJS API, set `NEXT_PUBLIC_API_BASE_URL` before building (it is baked into
the browser bundle), e.g. `NEXT_PUBLIC_API_BASE_URL=https://api.example.com docker compose up -d --build`.
Mock data lives in memory and resets when the container restarts.

Check a running container:

```bash
npm run docker:smoke                                  # build, start, wait for healthy, check routes, stop
E2E_BASE_URL=http://127.0.0.1:3000 npx playwright test   # full e2e suite against the container
```

Use `127.0.0.1`, not `localhost`: Node may resolve `localhost` to IPv6 (`::1`), which
Docker Desktop / WSL does not always forward.

## Where things are

| Path | What |
| --- | --- |
| `src/app/(app)/*` | Signed-in pages: dashboard, orders (+ new, detail), my-work, departments/[stage], reports, settings |
| `src/app/login` | Login |
| `src/components/tf/*` | Shared parts: status badge, order card, stepper, filter bar, comments, drawers, stage action forms |
| `src/components/shell/*` | Sidebar, top bar, mobile tab bar |
| `src/lib/stages.ts` | Stage list, status words, flow helpers |
| `src/lib/api/client.ts` | The only place the UI talks to the backend |
| `src/lib/mock/*` | In-memory mock backend (engine = workflow rules, seed = sample data) |
| `src/app/api/mock/[...path]` | Mock REST routes |

Design tokens (colors, status colors, radius) live in `src/app/globals.css` and follow
*ThreadFlow — Simple UI Guideline*.

## Connecting the NestJS backend

Set `NEXT_PUBLIC_API_BASE_URL` (see `.env.example`). The client then calls the backend
instead of `/api/mock`, sending cookies (`credentials: "include"`). The session cookie is
`tf_session`. Endpoints the backend should provide (same shapes as `src/lib/types.ts`):

```
POST /auth/login  {company,login,password,remember} | POST /auth/logout | GET /auth/me  (user + companyName)
GET  /orders?q&buyer&stage&status&embellishment&tab&scope   → {items,total}
POST /orders                                   (CreateOrderInput)
GET  /orders/:id  | GET /orders/:id/activity | POST /orders/:id/comments
POST /orders/:id/fabric                        (FabricUpdateInput)
POST /orders/:id/ignore-embellishment          (super users)
POST /orders/:id/stages/gpq/complete           ({doneAt, ppmAt}) → PPM queue
POST /orders/:id/ppm/time                      ({ppmAt})        GPQ / PP Meeting team
POST /orders/:id/ppm/findings                  (PPMFindingInput: text and/or imageUrl)
POST /orders/:id/ppm/complete                  ({doneAt})       needs ≥ 1 finding; completes the order
POST /orders/:id/cutting/dispatch              (CuttingDispatchInput)
POST /orders/:id/stages/:stage/{start|complete|problem|resume}
POST /orders/:id/image
GET  /dashboard/summary | GET /activity?limit | GET /notifications | GET /my-work
GET  /reports/:key  (by-stage, stage-time, embellishment, fabric-issues, completed)
GET|POST /buyers | GET|POST /users (CreateUserInput, super users) | PATCH /users/:id (incl. password reset)
GET|PUT /settings/factory | GET|PUT /settings/notifications
```

The workflow rules the backend must enforce are written down in `src/lib/mock/engine.ts`.

## Previewing UI states (mock only)

Add `?state=loading`, `?state=empty` or `?state=error` to any page URL.
