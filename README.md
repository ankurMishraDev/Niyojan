# Smart Resource Allocation Backend (MVP)

Backend-only prototype for NGO volunteer coordination and survey intelligence.

## Phase 1 Status

Completed in this step:

- Project scaffold (Node.js + Express + TypeScript)
- Environment and cloud config scaffolding
- PostgreSQL connection setup via Knex
- Full schema migration for core domain tables
- Demo seed data for orgs, users, fields, skills, volunteers, surveys, needs, assignments
- App bootstrap and centralized error handling

## Quick Start

1. Copy environment template.
2. Start local dependencies.
3. Run migrations and seeds.
4. Start API server.

### Commands

- `cp .env.example .env` (PowerShell: `Copy-Item .env.example .env`)
- `docker compose up -d`
- `npm run migrate`
- `npm run seed`
- `npm run dev`

Health check:

- `GET /health`

## Keys And Secrets To Bring

Minimum required for Phase 1 local run:

- `DATABASE_URL` (or `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`)

Required when you switch from mock auth to real Firebase auth:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Required when you switch from mock GCP storage flow to real signed URLs:

- `GCP_PROJECT_ID`
- `GCS_BUCKET_NAME`
- Service account credentials via `GOOGLE_APPLICATION_CREDENTIALS` or runtime identity

Required when you switch AI mode to live providers:

- `GEMINI_API_KEY` (for direct Gemini API mode if used)
- Vertex AI access through service account and `GCP_PROJECT_ID`

Recommended app-level secret:

- `API_INTERNAL_SECRET` for internal job callbacks (can be introduced in next phase)

## Notes

- Firebase and GCP are scaffolded behind config services for later module wiring.
- Auth and tenancy middleware stubs are included and expanded in Phase 2.
- AI flow and feature modules are scaffolded for subsequent phases.
