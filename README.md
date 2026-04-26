# Smart Resource Allocation Backend (MVP)

Backend-only prototype for NGO volunteer coordination, survey capture, need detection, volunteer matching, and assignment tracking.

## Current implementation status

Implemented:

- Foundation: Express + TypeScript + Knex + Docker
- Auth/security: mock mode + Firebase Admin verification path, role guard, tenant-aware service checks
- Core data modules: organizations, field catalog, skills, volunteers
- Document flow: signed upload/read URL generation, document metadata, mock extraction trigger, AI preview endpoints
- Form builder: templates, versions, fields, publish flow, create template from extracted fields
- Surveys: draft creation, EAV response submission, survey detail/list, needs analysis trigger
- Needs: list, detail, and skill attachment
- Matching: volunteer ranking for a need with weighted scoring and explanations
- Assignments: create, list, detail, and status update
- Dashboard: summary, urgent needs, volunteer availability, pipeline health

Not yet implemented from the larger plan:

- Full 10-stage pipeline module and audit trail tables
- Feedback / case closure / outcome tracking
- Full AI live-provider pipeline beyond current mock-oriented abstractions

## Tech stack

- Node.js 20+
- Express 5
- TypeScript (strict)
- PostgreSQL + Knex
- Firebase Admin SDK
- Google Cloud Storage signed URL flow
- Zod validation

## Project structure

```text
src/
  config/
  db/
  jobs/
  middleware/
  modules/
    aiPipeline/
    assignments/
    auth/
    dashboard/
    documents/
    fieldCatalog/
    formBuilder/
    matching/
    needs/
    organizations/
    skills/
    surveys/
    volunteers/
  types/
  utils/
```

## Quick start

1. Copy environment template.
2. Start local Postgres.
3. Run migrations and seeds.
4. Start the API.

### Commands

```bash
cp .env.example .env
docker compose up -d
npm run migrate
npm run seed
npm run dev
```

### Validation commands

```bash
npm run typecheck
npm run build
```

## Environment setup

Use `.env.example` as the source of truth.

### Minimum local settings

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

or a single `DATABASE_URL`.

### Mock mode defaults

For local demo runs, keep:

- `AUTH_MOCK_MODE=true`
- `GCP_MOCK_MODE=true`
- `AI_PROVIDER_MODE=mock`

### Live integration settings

To switch to live providers, set:

- `AUTH_MOCK_MODE=false`
- `GCP_MOCK_MODE=false`
- `AI_PROVIDER_MODE=live`

and provide:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `GCP_PROJECT_ID`
- `GCS_BUCKET_NAME`
- `GOOGLE_APPLICATION_CREDENTIALS`
- `GEMINI_API_KEY` if using direct Gemini mode

## Database and seed data

The repo currently uses one main migration file that creates the prototype schema, including:

- organizations
- users
- field_catalog
- documents
- form_templates
- form_template_versions
- form_fields
- surveys
- survey_responses
- volunteers
- skills
- volunteer_skills
- needs_analysis
- need_skills
- task_assignments
- jobs

Seed data includes:

- 2 organizations
- users across platform/admin/field/volunteer roles
- 40+ field catalog entries
- 20+ skills
- 1 published survey template
- volunteers with skills
- submitted surveys
- needs and assignments for demo matching

## Core flows supported today

### 1. Auth

- `GET /api/auth/me`

### 2. Core admin data

- `POST /api/organizations`
- `GET /api/organizations/:id`
- `PATCH /api/organizations/:id`
- `GET /api/organizations/:id/users`
- `GET/POST/PATCH/DELETE /api/field-catalog...`
- `GET/POST/PATCH/DELETE /api/skills...`
- `POST/GET/PATCH /api/volunteers...`
- `POST /api/volunteers/:id/skills`

### 3. Documents and extraction

- `POST /api/documents/upload-url`
- `POST /api/documents`
- `GET /api/documents`
- `GET /api/documents/:id`
- `GET /api/documents/:id/read-url`
- `PATCH /api/documents/:id/status`
- `POST /api/documents/:id/extract-fields`
- `GET /api/ai/status`
- `POST /api/ai/documents/:id/preview-extraction`

### 4. Form builder

- `POST /api/form-templates`
- `GET /api/form-templates`
- `GET /api/form-templates/:id`
- `POST /api/form-templates/:id/versions`
- `GET /api/form-templates/:id/versions`
- `GET /api/form-template-versions/:id`
- `PATCH /api/form-template-versions/:id`
- `POST /api/form-template-versions/:id/fields`
- `PATCH /api/form-fields/:id`
- `DELETE /api/form-fields/:id`
- `POST /api/form-template-versions/:id/publish`
- `POST /api/form-templates/from-document/:documentId`

### 5. Surveys and needs analysis

- `POST /api/surveys`
- `GET /api/surveys`
- `GET /api/surveys/:id`
- `POST /api/surveys/:id/submit`
- `POST /api/surveys/:id/analyze-needs`
- `GET /api/needs`
- `GET /api/needs/:id`
- `POST /api/needs/:id/skills`

### 6. Matching and assignments

- `GET /api/needs/:id/matches`
- `POST /api/assignments`
- `GET /api/assignments`
- `GET /api/assignments/:id`
- `PATCH /api/assignments/:id/status`

### 7. Feedback and case closure

- `POST /api/assignments/:id/feedback`
- `GET /api/assignments/:id/feedback`
- `POST /api/assignments/:id/feedback/evidence-url`
- `POST /api/needs/:id/close`

### 8. Dashboard

- `GET /api/dashboard/summary`
- `GET /api/dashboard/urgent-needs`
- `GET /api/dashboard/volunteer-availability`
- `GET /api/dashboard/pipeline-health`

## Demo and testing notes

### Mock auth headers

Common NGO admin:

```text
x-mock-user-id: 10000000-0000-4000-8000-000000000002
x-mock-org-id: 11111111-1111-4111-8111-111111111111
x-mock-role: ngo_admin
x-mock-firebase-uid: firebase-ngo-admin-a-001
```

Common superadmin:

```text
x-mock-user-id: 10000000-0000-4000-8000-000000000001
x-mock-role: superadmin
x-mock-firebase-uid: firebase-superadmin-001
```

### Manual API docs in repo

- `API_TESTS_PHASE2.txt`
- `API_TESTS_PHASE3.txt`
- `API_TESTS_PHASE4.txt`
- `API_TESTS_PHASE5.txt`

### Browser console

Open:

```text
http://localhost:8080/api-console
```

## Known prototype simplifications

- Matching uses deterministic weighted scoring with application-code distance calculation.
- AI extraction and mapping are mock/demo-oriented abstractions unless live credentials are configured.
- The full audit/event/state-machine pipeline from the larger plan is not implemented yet.
- Feedback, outcome closure, and long-term AI accuracy tracking are still pending.
- The schema is still consolidated into one main migration instead of the larger multi-migration plan.

## Suggested smoke sequence

1. `GET /health`
2. `GET /api/auth/me`
3. `GET /api/field-catalog?page=1&pageSize=10`
4. `GET /api/skills?page=1&pageSize=10`
5. `GET /api/form-templates?page=1&pageSize=10`
6. `POST /api/surveys/:id/analyze-needs` on a submitted survey if needed
7. `GET /api/needs`
8. `GET /api/needs/:id/matches`
9. `POST /api/assignments`
10. `GET /api/dashboard/summary`

## Recently verified live flows

Verified against the running app with seeded data:

- volunteer feedback submission on seeded assignment `92000000-0000-4000-8000-000000000001`
- admin retrieval of assignment feedback
- feedback evidence signed upload URL generation
- need closure with case outcome creation
