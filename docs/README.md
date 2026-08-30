# Lernexa — Documentation Index

**New here? Start with [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md)** — one document that
explains the whole system (what it is, the stack, architecture, RBAC, every feature,
routes, API, data model, flows, deployment, testing, security, decisions, limitations)
in ~10–15 minutes, with Mermaid diagrams and file references throughout. It ends with a
**"Lernexa in 2 Minutes"** interview script and a one-page visual summary.

## The rest of `docs/`

| Doc | What it covers |
|---|---|
| [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) | **The map.** Full system walkthrough — read this first. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | The BFF cookie pattern, the layer diagram, the canonical request flow, error-handling strategy, deployment notes. |
| [`DATA_MODEL.md`](DATA_MODEL.md) | Every entity and field, the "store facts / derive metrics" principle, `computeProgress`, uniqueness enforcement, index justifications, the deletion policy, the custom-endpoint table. |
| [`RBAC.md`](RBAC.md) | The permission matrix, the four enforcement layers, the blocking enforcement chain, the IDOR / isolation matrix, the verification script. |
| [`DECISIONS.md`](DECISIONS.md) | 40 architecture decision records (D-001…D-040), each with the case *against* it — including the features deliberately **not** built. |
| [`PERFORMANCE.md`](PERFORMANCE.md) | The three real N+1s, population discipline, caching, pagination caps. |
| [`ADMIN_PANEL.md`](ADMIN_PANEL.md) | The admin surface built in Next.js (not the Strapi back office): users, roles, blocking, stats, attention queue, audit log. |
| [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) | Tokens, type scale, 4px radius, borders-not-shadows, "green means completed", the screen inventory. |
| [`ENGINEERING.md`](ENGINEERING.md) | Engineering principles, hard prohibitions, conventions for both apps, the definition of done. |
| [`IMPLEMENTATION_CHECKLIST.md`](IMPLEMENTATION_CHECKLIST.md) | Phase-by-phase build plan and its completion state. |
| [`PROJECT_PLAN.md`](PROJECT_PLAN.md) | Scope tiers and the cut list. |

## Also worth reading in the repo

- Root [`README.md`](../README.md) — run instructions, env vars, demo credentials, live URLs.
- [`backend/scripts/SEED.md`](../backend/scripts/SEED.md) — what `npm run seed` builds and how to reset it.
- [`backend/tests/README.md`](../backend/tests/README.md) — the two kinds of test suite and how to run them.
