<div align="center">

```
███╗   ██╗██╗██╗   ██╗░█████╗░██╗░░░░░░█████╗░███╗░░██╗
████╗  ██║██║╚██╗ ██╔╝██╔══██╗██║░░░░░██╔══██╗████╗░██║
██╔██╗ ██║██║░╚████╔╝░███████║██║░░░░░██║░░██║██╔██╗██║
██║╚██╗██║██║░░╚██╔╝░░██╔══██║██║░░░░░██║░░██║██║╚████║
██║ ╚████║██║░░░██║░░░██║░░██║███████╗╚█████╔╝██║░╚███║
╚═╝  ╚═══╝╚═╝░░░╚═╝░░░╚═╝░░╚═╝╚══════╝░╚════╝░╚═╝░░╚══╝

```

# **Niyojan**
### Smart Resource Allocation Platform

*Niyojan (नियोजन) — meaning "deployment" or "assignment" — is an intelligent platform for NGO volunteer coordination, AI-powered need detection, and impact tracking.*

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js_20+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express_5-000000?style=for-the-badge&logo=express&logoColor=white)](https://expressjs.com/)
[![React](https://img.shields.io/badge/React_19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![Expo](https://img.shields.io/badge/Expo_SDK_54-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Google Cloud](https://img.shields.io/badge/Google_Cloud-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white)](https://cloud.google.com/)
[![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C?style=for-the-badge&logo=langchain&logoColor=white)](https://langchain-ai.github.io/langgraph/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

<br/>

[🚀 Quick Start](#-quick-start) • [📖 API Docs](#-api-overview) • [🏗️ Architecture](#%EF%B8%8F-architecture) • [📱 Mobile App](#-mobile-app) • [🤖 AI Pipeline](#-ai-pipeline) • [🌐 Demo](#-demo-credentials)

</div>

---

## ✨ Features

<div align="center">

| | | |
|---|---|---|
| 🏢 **NGO Management**<br/><sub>Self-registration, approval, members</sub> | 📋 **Form Builder**<br/><sub>Custom templates, versioning, publish</sub> | 📄 **Document AI Pipeline**<br/><sub>LangGraph: ingestion → PII → extraction → review</sub> |
| 📝 **Survey Capture**<br/><sub>EAV responses, AI needs analysis</sub> | 🎯 **Need Detection**<br/><sub>Smart clustering & aggregation</sub> | 👥 **Volunteer Management**<br/><sub>Skills, location, availability</sub> |
| ⚡ **Skill Matching**<br/><sub>50% skills + 30% avail + 20% location</sub> | 📌 **Assignment Tracking**<br/><sub>Full status lifecycle</sub> | 💬 **Feedback & Closure**<br/><sub>Evidence upload, case outcomes</sub> |
| 🗺️ **Geo Features**<br/><sub>Map visualization, location matching</sub> | 📊 **Dashboard**<br/><sub>Stats, urgent needs, pipeline health</sub> | 📜 **Audit Logging**<br/><sub>Event-sourced audit trail</sub> |

</div>

### Cross-Cutting Capabilities

| | |
|---|---|
| 🌐 **16 Languages** | Assamese, Bengali, English, Gujarati, Hindi, Kannada, Kashmiri, Maithili, Malayalam, Marathi, Odia, Punjabi, Santali, Tamil, Telugu, Urdu |
| 📱 **Offline Mobile** | SQLite local DB with background sync service |
| 🧠 **AI Pipeline** | 10+ LangGraph nodes with live & fallback paths |
| 🔒 **Security** | Firebase JWT, role guards (4 tiers), tenant isolation |

---

## 🏗️ Architecture

```
                         ┌──────────────────────────────────┐
                         │       🌐 WEB FRONTEND            │
                         │   React 19 · Vite 7 · Tailwind   │
                         │   TanStack Query · Leaflet Maps  │
                         │   i18next (16 languages)         │
                         └──────────────┬───────────────────┘
                                        │ HTTP/JSON
                         ┌──────────────▼───────────────────┐
                         │       ⚙️  BACKEND API           │
                         │   Express 5 · TypeScript · Zod   │
                         │   Firebase Auth · Knex ORM       │
                         │   LangGraph · PM2                │
                         │                                  │
                         │   ┌─ Modules ─────────────────┐  │
                         │   │ NGOs · Forms · Surveys    │  │
                         │   │ Volunteers · Matching     │  │
                         │   │ Assignments · Dashboard   │  │
                         │   │ Documents · Feedback      │  │
                         │   │ Field Catalog · Skills    │  │
                         │   │ Geo · Clustering · Audit  │  │
                         │   └───────────────────────────┘  │
                         └──────┬──────────────┬────────────┘
                                │              │
              ┌─────────────────▼──┐    ┌──────▼──────────┐
              │   🗄️ PostgreSQL 16 │    │  ⚡ Redis 7     │
              │   (Knex Migrations)│    │  (Cache/Queue)  │
              └────────────────────┘    └─────────────────┘
                                │
              ┌─────────────────▼──────────────────────────┐
              │          ☁️  GOOGLE CLOUD                 │
              │   Firebase Auth · GCS · Document AI        │
              │   Vertex AI (Gemini) · Language API        │
              └────────────────────────────────────────────┘
                                │
              ┌─────────────────▼──────────────────────────┐
              │       📱  MOBILE APP (Expo)               │
              │   React Native · Expo Router · NativeWind  │
              │   Zustand · SQLite (offline) · Sync Svc    │
              │   i18next (16 languages)                   │
              └────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
| | |
|---|---|
| **Runtime** | ![Node.js](https://img.shields.io/badge/Node.js_20+-339933?logo=node.js&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript_6-3178C6?logo=typescript&logoColor=white) |
| **Framework** | ![Express](https://img.shields.io/badge/Express_5-000?logo=express&logoColor=white) ![Zod](https://img.shields.io/badge/Zod_4-3068B7?logo=zod&logoColor=white) |
| **Database** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL_16-4169E1?logo=postgresql&logoColor=white) ![Knex](https://img.shields.io/badge/Knex_DB-311C87?logo=knex&logoColor=white) ![Redis](https://img.shields.io/badge/Redis_7-DC382D?logo=redis&logoColor=white) |
| **Auth** | ![Firebase](https://img.shields.io/badge/Firebase_Admin-FFCA28?logo=firebase&logoColor=black) |
| **AI/ML** | ![LangGraph](https://img.shields.io/badge/LangGraph-1C3C3C) ![Google Gemini](https://img.shields.io/badge/Vertex_AI_Gemini-4285F4?logo=google-cloud&logoColor=white) ![Document AI](https://img.shields.io/badge/Document_AI-4285F4?logo=google-cloud&logoColor=white) |
| **Storage** | ![GCS](https://img.shields.io/badge/Cloud_Storage-4285F4?logo=google-cloud&logoColor=white) |
| **Process** | ![PM2](https://img.shields.io/badge/PM2-2B037A?logo=pm2&logoColor=white) |

### Frontend & Mobile
| | |
|---|---|
| **Web** | ![React](https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black) ![Vite](https://img.shields.io/badge/Vite_7-646CFF?logo=vite&logoColor=white) ![TanStack Query](https://img.shields.io/badge/TanStack_Query-FF4154?logo=react-query&logoColor=white) ![Tailwind](https://img.shields.io/badge/Tailwind_3-06B6D4?logo=tailwindcss&logoColor=white) |
| **Mobile** | ![Expo](https://img.shields.io/badge/Expo_SDK_54-000020?logo=expo&logoColor=white) ![React Native](https://img.shields.io/badge/RN_0.81-61DAFB?logo=react&logoColor=black) ![NativeWind](https://img.shields.io/badge/NativeWind_4-06B6D4?logo=tailwindcss&logoColor=white) ![Zustand](https://img.shields.io/badge/Zustand_5-000?logo=react&logoColor=white) |
| **Testing** | ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white) ![Playwright](https://img.shields.io/badge/Playwright-45BA4B?logo=playwright&logoColor=white) ![Testing Library](https://img.shields.io/badge/Testing_Library-E33332?logo=testing-library&logoColor=white) |

---

## 📂 Project Structure

<details>
<summary><b>Click to expand</b> — full directory layout</summary>

```
niyojan/
├── 📁 src/                          # Backend (Express + TypeScript)
│   ├── 📄 app.ts                    # Express app setup
│   ├── 📄 server.ts                 # Entry point
│   ├── 📁 config/                   # DB, env, Firebase, GCP configs
│   ├── 📁 db/migrations/            # 16 Knex migration files
│   ├── 📁 langgraph-pipeline/       # 🤖 AI document processing pipeline
│   │   ├── 📁 nodes/                # 10+ pipeline node implementations
│   │   └── 📁 prompts/              # AI extraction/reasoning prompts
│   ├── 📁 middleware/               # Auth, role guard, tenant guard, validation
│   ├── 📁 modules/                  # Feature modules
│   │   ├── 📁 aiPipeline/           # Document AI, Vertex, Gemini services
│   │   ├── 📁 assignments/          # Task assignment lifecycle
│   │   ├── 📁 clustering/           # Smart need clustering
│   │   ├── 📁 dashboard/            # Summary endpoints
│   │   ├── 📁 documents/            # Upload/read URL management
│   │   ├── 📁 feedback/             # Assignment feedback, case closure
│   │   ├── 📁 fieldCatalog/         # Standardized field definitions
│   │   ├── 📁 formBuilder/          # Form template CRUD, versioning
│   │   ├── 📁 geo/                  # Geographic/location features
│   │   ├── 📁 matching/             # Volunteer-need matching algorithm
│   │   ├── 📁 needs/                # Needs analysis, skill attachment
│   │   ├── 📁 organizations/        # Organization CRUD
│   │   ├── 📁 pipeline/             # Pipeline orchestration
│   │   ├── 📁 skills/               # Skills taxonomy CRUD
│   │   ├── 📁 surveys/              # Survey creation, submission, analysis
│   │   ├── 📁 translation/          # Multi-language support
│   │   └── 📁 volunteers/           # Volunteer CRUD, skill assignment
│   ├── 📁 services/                 # Audit service
│   ├── 📁 types/                    # Shared TypeScript types
│   └── 📁 utils/                    # API response, logger, pagination, scoring
│
├── 📁 frontend/                     # React 19 + Vite 7 web app
│   └── 📁 src/
│       ├── 📁 app/                  # App shell, routing, guards
│       ├── 📁 components/           # Reusable UI components
│       ├── 📁 features/             # Auth context, form field inputs
│       ├── 📁 i18n/                 # i18next init + locales (16 🌐)
│       ├── 📁 lib/                  # API client, Firebase, utilities
│       ├── 📁 pages/                # Route page components
│       └── 📁 types/                # TypeScript type definitions
│
├── 📁 mobileApp/                    # Expo / React Native mobile app
│   ├── 📁 app/                      # Expo Router pages (file-based)
│   │   ├── 📁 (tabs)/               # Tab navigation
│   │   ├── 📁 assignments/
│   │   ├── 📁 forms/
│   │   └── 📁 surveys/
│   └── 📁 src/
│       ├── 📁 components/           # Mobile-specific components
│       ├── 📁 db/                   # Local SQLite database
│       ├── 📁 features/auth/
│       ├── 📁 i18n/                 # Mobile translations
│       ├── 📁 lib/                  # API, sync service, Firebase
│       ├── 📁 store/                # Zustand state store
│       └── 📁 types/
│
├── 📁 scripts/                      # Utility scripts
│   ├── 📄 create-superadmin.ts
│   ├── 📄 database_queries.sql
│   ├── 📄 demoIdentityCatalog.js
│   ├── 📄 firebaseIdentityBootstrap.js
│   └── 📄 manage-fake-volunteers.ts
│
├── 📁 tests/                        # Backend integration tests
├── 🐳 Dockerfile                    # Multi-stage (node:20-alpine)
├── 🐳 docker-compose.yml            # PostgreSQL 16 + Redis 7
├── 📄 knexfile.js                   # Knex config (dev/test/prod)
└── 📄 ecosystem.config.js           # PM2 process config
```

</details>

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+
- **Docker** (for PostgreSQL + Redis)
- **Google Cloud** project with Firebase, Document AI, Vertex AI, and GCS enabled

### 1. **Clone & Install**

```bash
git clone <repo-url>
cd niyojan
npm install && npm --prefix frontend install
```

### 2. **Configure Environment**

```bash
cp .env.example .env
# Fill in your DB, Firebase, and GCP credentials
```

### 3. **Start Infrastructure**

```bash
docker compose up -d    # 🐘 PostgreSQL (5432) + ⚡ Redis (6379)
```

### 4. **Initialize Database**

```bash
npm run migrate         # Run 16 migrations
npm run seed            # Seed demo data
```

### 5. **Launch Dev Servers**

```bash
npm run dev             # Backend API → http://localhost:8080
npm run frontend:dev    # Frontend    → http://localhost:5173
```

> 🎉 That's it! Open `http://localhost:5173` and log in with demo credentials below.

---

## 🔐 Environment Variables

<details>
<summary><b>Database (PostgreSQL)</b></summary>

| Variable | Description |
|---|---|
| `DATABASE_URL` | Full connection string |
| `DB_HOST` / `DB_PORT` | Host & port |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | Database credentials |

</details>

<details>
<summary><b>Firebase Auth</b></summary>

| Variable | Description |
|---|---|
| `FIREBASE_PROJECT_ID` | Firebase project ID |
| `FIREBASE_CLIENT_EMAIL` | Service account email |
| `FIREBASE_PRIVATE_KEY` | Service account private key |

</details>

<details>
<summary><b>Google Cloud & AI</b></summary>

| Variable | Description |
|---|---|
| `GCP_PROJECT_ID` | GCP project ID |
| `GCS_BUCKET_NAME` | Storage bucket |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON |
| `DOCUMENT_AI_LOCATION` | Processor location (e.g. `us`) |
| `DOCUMENT_AI_PROCESSOR_ID` | Document AI processor ID |
| `VERTEX_LOCATION` | Vertex AI location |
| `VERTEX_DOCUMENT_MODEL` | Gemini model for extraction |
| `VERTEX_REASONING_MODEL` | Gemini model for reasoning |
| `VERTEX_SURVEY_MODEL` | Gemini model for survey analysis |

</details>

---

## 📋 Available Commands

<div align="center">

| Category | Command | Description |
|---|---|---|
| **🚀 Dev** | `npm run dev` | Backend hot-reload |
| **📦 Build** | `npm run build` | Compile TS → dist/ |
| **✅ TypeCheck** | `npm run typecheck` | TypeScript checking |
| **🧪 Test** | `npm run test:backend` | Vitest backend tests |
| **🗄️ Migrate** | `npm run migrate` | Run pending migrations |
| **⏪ Rollback** | `npm run migrate:rollback` | Rollback last batch |
| **🌱 Seed** | `npm run seed` | Run all seeds |
| **🌀 Reset DB** | `npm run db:reset` | Rollback → migrate → seed |
| **🎭 Demo** | `npm run seed:demo:identity` | Bootstrap Firebase demo users |
| **🌐 Frontend** | `npm run frontend:dev` | Vite dev on :5173 |
| **📱 Frontend Build** | `npm run frontend:build` | Production build |
| **🧪 E2E Tests** | `npm run frontend:test:e2e` | Playwright tests |
| **⚡ PM2 Start** | `npm run pm2:start` | Production launch |

</div>

---

## 📖 API Overview

### 🔐 Auth & Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/auth/me` | Current user profile |
| `POST` | `/api/auth/register-ngo` | Register a new NGO |
| `GET` | `/api/admin/onboarding/ngos` | List pending NGOs |
| `POST` | `/api/admin/onboarding/ngos/:orgId/approve` | Approve NGO |
| `POST` | `/api/admin/onboarding/ngos/:orgId/reject` | Reject NGO |

### 🏢 Organizations
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET/POST` | `/api/organizations` | List / Create orgs |
| `GET/PATCH` | `/api/organizations/:id` | Get / Update org |
| `GET` | `/api/organizations/:id/users` | List org members |

### 📄 Documents & AI Pipeline
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/documents/upload-url` | Get signed upload URL |
| `POST` | `/api/documents` | Create document record |
| `GET` | `/api/documents/:id/read-url` | Get signed read URL |
| `POST` | `/api/documents/:id/pipeline/start` | Start LangGraph pipeline |
| `GET` | `/api/documents/:id/pipeline/status` | Pipeline status |
| `GET` | `/api/documents/:id/review-package` | Get review data |
| `POST` | `/api/documents/:id/review` | Submit human review |

### 📝 Form Builder
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST/GET` | `/api/form-templates` | Create / List templates |
| `POST` | `/api/form-templates/:id/versions` | Create new version |
| `POST` | `/api/form-template-versions/:id/publish` | Publish version |
| `POST` | `/api/form-templates/from-document/:documentId` | Generate from extracted fields |

### 📋 Surveys
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST/GET` | `/api/surveys` | Create / List surveys |
| `POST` | `/api/surveys/:id/submit` | Submit responses |
| `POST` | `/api/surveys/:id/analyze-needs` | AI needs analysis |

### 🎯 Needs & Matching
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/needs` | List needs |
| `GET` | `/api/needs/:id/matches` | Ranked volunteer matches |
| `POST` | `/api/needs/:id/close` | Close need with outcome |

### 📌 Assignments
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/assignments` | Create assignment |
| `GET` | `/api/assignments/:id` | Assignment details |
| `PATCH` | `/api/assignments/:id/status` | Update status |

### 💬 Feedback
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/assignments/:id/feedback` | Submit feedback |
| `POST` | `/api/assignments/:id/feedback/evidence-url` | Evidence upload URL |

### 📊 Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/summary` | Summary statistics |
| `GET` | `/api/dashboard/urgent-needs` | Urgent needs |
| `GET` | `/api/dashboard/volunteer-availability` | Availability stats |
| `GET` | `/api/dashboard/pipeline-health` | Pipeline health |

---

## 🤖 AI Pipeline

The document processing pipeline is a **LangGraph state machine** with 10+ nodes:

```
  📄 Input
     │
     ▼
  📥 Ingestion
     │
     ▼
  🎭 PII Masking
     │
     ▼
  🔍 AI Extraction (Gemini / Document AI)
     │
     ├──────────────▶ ❌ Reasoning Fallback
     ▼                          │
  🧠 Reasoning (Gemini)         │
     │                          │
     └──────────────▶ 🔄 Mapping
                              │
                              ▼
                          🛡️ Trust Gate (Human Review)
                              │
                          ┌───┴───┐
                          │       │
                          ▼       ▼
                      ✅ Persist  🔁 Fallback
```

### Pipeline features:
- **Live mode** — Google Document AI + Vertex AI Gemini
- **Fallback mode** — Graceful degradation when credentials are missing
- **Human review** — Trust gate before final persistence
- **Smart form generation** — Auto-create templates from extracted fields
- **PII masking** — Built-in privacy protection

---

## ⚡ Matching Algorithm

Volunteers are ranked against needs using a weighted scoring system:

```
┌─────────────────────────────────────────────┐
│   🏆  Final Score = Σ(weights × scores)    │
├─────────────────────────────────────────────┤
│   📌  Skills Match     ████████████████░ 50% │
│   📅  Availability     ██████████░░░░░░ 30% │
│   📍  Location         ██████░░░░░░░░░░ 20% │
└─────────────────────────────────────────────┘
```

---

## 🌐 Multilingual Support

**16 Indian languages** across both web and mobile:

<div align="center">

| Language | Code | Language | Code |
|---|---|---|---|
| অসমীয়া | `as` | বাংলা | `bn` |
| English | `en` | ગુજરાતી | `gu` |
| हिन्दी | `hi` | ಕನ್ನಡ | `kn` |
| कॉशुर | `ks` | मैथिली | `mai` |
| മലയാളം | `ml` | मराठी | `mr` |
| ଓଡ଼ିଆ | `or` | ਪੰਜਾਬੀ | `pa` |
| ᱥᱟᱱᱛᱟᱲᱤ | `sat` | தமிழ் | `ta` |
| తెలుగు | `te` | اُردُو | `ur` |

</div>

---

## 👤 Demo Credentials

| Role | Email | Password |
|---|---|---|
| 👑 **Superadmin** | `niyojanAdmin@gmail.com` | `asdf@1234` |

Also includes seeded NGO admins, field workers, and volunteers across **5 organizations**.

---

## 🔬 Smoke Test

```bash
# 1. Health check
curl http://localhost:8080/health

# 2. Check auth
curl http://localhost:8080/api/auth/me -H "Authorization: Bearer <token>"

# 3. Browse data
curl "http://localhost:8080/api/field-catalog?page=1&pageSize=10"
curl "http://localhost:8080/api/skills?page=1&pageSize=10"
curl "http://localhost:8080/api/form-templates?page=1&pageSize=10"

# 4. Dashboard
curl http://localhost:8080/api/dashboard/summary

# 5. Needs & matching
curl http://localhost:8080/api/needs
curl http://localhost:8080/api/needs/:id/matches
```

---

## 🧪 Testing

```bash
# ── Backend ──
npm run test:backend        # Vitest unit/integration tests

# ── Frontend ──
npm run frontend:test       # Vitest unit tests
npm run frontend:test:e2e   # Playwright E2E tests

# ── Type Checking ──
npm run typecheck           # Backend
npm run frontend:typecheck  # Frontend
```

---

## 🚢 Production Deployment

```bash
# PM2 (recommended)
npm run pm2:start

# Docker
docker build -t niyojan-backend .
docker run -p 8080:8080 --env-file .env niyojan-backend
```

---

## 🎨 Design System

A **Vercel-inspired design system** is documented in [`DESIGN.md`](./DESIGN.md) covering:

- 🎨 Color palette & design tokens
- 🔤 Typography scale
- 📐 Spacing & layout grid
- ☁️ Elevation & shadows
- 🧩 Component specs (buttons, inputs, cards, modals)
- 📱 Responsive breakpoints

Implemented via Tailwind config at `frontend/tailwind.config.ts`.

---

## 📄 License

**ISC** — free to use, modify, and distribute.

---

<div align="center">

*Built with ❤️ for social impact*

**[⬆ back to top](#niyojan)**

</div>
