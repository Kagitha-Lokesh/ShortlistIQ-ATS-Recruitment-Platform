# ShortlistIQ — AI ATS Recruitment & Resume Optimization Platform

ShortlistIQ is an open, multi-tenant AI recruitment platform and applicant tracking system designed for high-volume candidate screening, deterministic ATS scoring, truth-grounded AI suggestions, and automated GDPR-compliant data lifecycle management.

```
                           ShortlistIQ Monorepo Architecture
   ┌────────────────────────────────────────────────────────────────────────┐
   │                                                                        │
   │   apps/web (React 19 + Tailwind)     apps/api (Express + Prisma)       │
   │   ├── Candidate ATS Checker          ├── Public REST Endpoints         │
   │   ├── Interactive Suggestion Review  ├── Multi-Tenant HR APIs          │
   │   ├── ATS Resume PDF/DOCX Studio     ├── Storage Service (Supabase)    │
   │   ├── HR Cohort & Bulk Batch Screen  └── pg-boss Background Worker     │
   │   ├── Drag-and-Drop Form Builder                     │                 │
   │   └── Right to Erasure Self-Service                  │                 │
   │                  │                                   │                 │
   │                  ▼                                   ▼                 │
   │   packages/shared (Universal Zod)    packages/engine (Framework-free)  │
   │   ├── ResumeData & Template Schemas  ├── Section Tokenization          │
   │   ├── Multi-tenant DTOs & Models     ├── 500+ Skills Dictionary        │
   │   └── Knockout Evaluation Logic      └── Deterministic 0-100 Scoring   │
   │                                                                        │
   └────────────────────────────────────────────────────────────────────────┘
```

---

## 1. System Architecture & Workspaces

The platform is organized as an npm workspaces monorepo:

| Package / App | Path | Description |
| :--- | :--- | :--- |
| **`@shortlistiq/engine`** | `packages/engine` | Framework-free scoring engine, skill dictionary with aliases, heading synonym extraction, and TF-IDF keyword overlap calculation. |
| **`@shortlistiq/shared`** | `packages/shared` | Universal Zod schemas, TypeScript types, DTO contracts, and template theme definitions. |
| **`@shortlistiq/api`** | `apps/api` | REST API, multi-tenant repository layer, Supabase storage adapter, OpenRouter AI client, and `pg-boss` background worker. |
| **`@shortlistiq/web`** | `apps/web` | Modern React 19 web application with Tailwind CSS, TanStack Query, and React Router v7. |

### Visual Identity & Palette
- **Background**: `#F8FAFC` (Slate 50)
- **Surfaces**: `#FFFFFF` cards with subtle borders (`#E2E8F0`)
- **Primary Brand**: `#3730A3` (Indigo 700)
- **Success Accent**: `#15803D` (Green 700)
- **Warning Accent**: `#B45309` (Amber 700)
- **Danger Accent**: `#B91C1C` (Red 700)
- **Dark Neutral**: `#0F172A` (Slate 900)

---

## 2. Local Setup & Quickstart

### Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **PostgreSQL** or Supabase account (optional for local mock testing)

### Installation

1. **Clone the repository and install dependencies**:
   ```bash
   git clone https://github.com/your-org/shortlistiq.git
   cd shortlistiq
   npm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   cp apps/api/.env.example apps/api/.env
   cp apps/web/.env.example apps/web/.env
   ```

3. **Generate Prisma Client**:
   ```bash
   npm --workspace=@shortlistiq/api run db:generate
   ```

4. **Start the development servers**:
   ```bash
   # Starts both Web (port 5173) and API (port 4000) concurrently
   npm run dev
   ```

5. **Run test suites**:
   ```bash
   npm run test
   ```

6. **Run TypeScript typecheck across all workspaces**:
   ```bash
   npm run typecheck
   ```

7. **Execute automated end-to-end smoke test**:
   ```bash
   npm run smoke-test
   ```

---

## 3. Environment Variables Reference

| Variable | Target | Type | Default | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | API / Worker | `string` | `development` | Runtime environment (`development`, `test`, `production`). |
| `PORT` | API | `number` | `4000` | Port for the Express REST API server. |
| `CORS_ORIGIN` | API | `string` | `http://localhost:5173` | Permitted web client origin (or comma-separated origins). |
| `DATABASE_URL` | API / Worker | `string` | — | PostgreSQL connection string (Supabase transaction pooler). |
| `DIRECT_URL` | API / CLI | `string` | — | Direct PostgreSQL connection for migrations and Prisma introspection. |
| `SUPABASE_URL` | API / Web | `string` | — | Supabase project API base URL. |
| `SUPABASE_ANON_KEY` | API / Web | `string` | — | Supabase public anonymous API key. |
| `SUPABASE_SERVICE_ROLE_KEY`| API | `string` | — | Supabase administrative service role key (storage operations). |
| `SUPABASE_JWT_SECRET` | API | `string` | — | Shared HMAC secret used to verify Supabase Auth tokens. |
| `OPENROUTER_API_KEY` | API | `string` | — | OpenRouter API key for LLM suggestions, criteria, and summaries. |
| `TURNSTILE_SECRET_KEY` | API | `string` | — | Cloudflare Turnstile secret key for bot defense verification. |
| `TURNSTILE_SITE_KEY` | Web | `string` | — | Cloudflare Turnstile public site key. |
| `EMAIL_ENCRYPTION_KEY` | API | `string` | — | 32-byte hex key for AES-256-GCM OAuth token encryption. |
| `GOOGLE_CLIENT_ID` | API | `string` | — | Google Cloud OAuth2 Client ID (`gmail.send` scope). |
| `GOOGLE_CLIENT_SECRET` | API | `string` | — | Google Cloud OAuth2 Client Secret. |
| `MICROSOFT_CLIENT_ID` | API | `string` | — | Microsoft Entra / Azure AD App Client ID (`Mail.Send` scope). |
| `MICROSOFT_CLIENT_SECRET` | API | `string` | — | Microsoft Entra / Azure AD App Client Secret. |
| `PLATFORM_EMAIL_FROM` | API | `string` | `privacy@shortlistiq.com` | From address for transactional verification emails. |
| `MOCK_EMAIL` | API | `boolean` | `false` | Enable simulated email delivery for testing and offline demos. |
| `VITE_API_URL` | Web | `string` | `http://localhost:4000` | API base endpoint consumed by the React web application. |

---

## 4. Background Job Queue Architecture (`pg-boss`)

ShortlistIQ processes high-volume batch scoring and scheduled lifecycle purges through a persistent background worker:

```
  ┌────────────────────────────────────────────────────────┐
  │              Express API Upload Chunks                 │
  └──────────────────────────┬─────────────────────────────┘
                             │ Enqueue Job per Candidate
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │       pg-boss Queue ("process-candidate-resume")        │
  │     - Idempotency by candidateId                       │
  │     - 3 Retries with Exponential Backoff               │
  │     - Concurrency: 4                                   │
  └──────────────────────────┬─────────────────────────────┘
                             │
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │         Worker Processing Pipeline (worker.ts)         │
  │     1. Download & Validate PDF (magic bytes & size)    │
  │     2. Extract Text & Heading Synonyms                 │
  │     3. Run Deterministic Scoring Engine                │
  │     4. Evaluate Must-Have & Dealbreaker Criteria       │
  │     5. Compute Decision (shortlisted / needs_review)   │
  │     6. Update Database & Record Audit Trail            │
  └────────────────────────────────────────────────────────┘
```

- **Resilience**: In test environments or when running without an external database, the queue automatically switches to a deterministic in-memory worker maintaining identical behavior.
- **Data Lifecycle Cron**: A scheduled job runs daily at `02:00 AM` (`0 2 * * *`) purging expired candidates and candidate checks in batches of 50, strictly logging counts without personal data.

---

## 5. Free-Tier Limits & Hardening Guarantees

### OpenRouter AI Models
- **Free Models Priority**: `meta-llama/llama-3.2-3b-instruct:free` → `google/gemini-2.0-flash-exp:free` → `mistralai/mistral-7b-instruct:free` → `qwen/qwen-2.5-7b-instruct:free`.
- **Global Concurrency Limiter**: Maximum 2 concurrent AI requests, preventing 429 rate limit errors.
- **AI Summary Limiter**: Maximum 1 concurrent summary synthesis, gracefully skipping if all free models are busy.
- **Deterministic Caching**: All prompt inputs are canonically sorted and hashed with SHA-256; repeated checks or identical job descriptions return cached results instantly.

### Email Sending Limits
- **Gmail**: Daily sending cap of 500 emails (regular Google accounts) or 2,000 (Google Workspace). During testing, ensure target emails are registered as test users in the Google Cloud Console.
- **Outlook**: Microsoft Graph caps personal accounts at 300 emails/day.
- **Throttle Guardrail**: Outbound email worker delivers 1 email every 2 seconds to avoid provider rate limiting.

### Free Host & Memory Constraints (Render / Railway / Fly.io)
- **512MB RAM Container Sizing**: Node memory configured with `NODE_OPTIONS="--max-old-space-size=450"`.
- **Stream Buffering**: PDF parsing uses streaming buffers without saving temporary disk files, preventing file descriptor leaks and out-of-memory spikes.

---

## 6. Prompt-Injection & Security Defense

1. **Boundary Defanging**: User resumes and job descriptions are stripped of control characters and wrapped in strict delimiters (`<<<UNTRUSTED_DOCUMENT_DATA>>>`). Internal delimiter breakout attempts are automatically defanged.
2. **System Prompt Mandate**: Every LLM prompt explicitly directs the model to treat all document contents strictly as passive text, ignoring any role-shifts, command simulations, or administrative overrides.
3. **Strict Schema Parsing**: All AI outputs are validated against strict Zod schemas (`ScoringCriteriaSchema`, `CandidateSummaryResponseSchema`, `LlmSuggestionSchema`).
4. **Zero Direct Execution**: Model outputs only populate data structures and are never evaluated as executable code, shell commands, or database queries.

---

## 7. Manual QA Checklist

### Candidate Self-Service Flow
- [ ] **Landing Page**: Verify clean headline, feature cards, and immediate call-to-action button.
- [ ] **Resume Check**: Upload a valid PDF resume and paste target job description. Verify file size validation (5MB max) and PDF magic-byte checks.
- [ ] **Scoring Results**: Inspect overall score ring (0–100), 5 breakdown bars, and matched/missing keyword chips.
- [ ] **AI Suggestions**: Click "Review AI Suggestions" and verify targeted rephrasing recommendations without invented experience or credentials.
- [ ] **Suggestion Actions**: Accept, reject, or edit suggestions.
- [ ] **Resume Studio**: Switch between **Classic**, **Modern**, **Compact**, and **Minimal** templates. Change accent color, font size, and margins.
- [ ] **Download Export**: Click "Download PDF" and "Download DOCX". Verify ATS re-parsing score confirmation badge.
- [ ] **Candidate Erasure**: Navigate to `/privacy/delete-data`, submit email, enter 6-digit code, and verify all records and storage files are permanently purged.

### HR Management Flow
- [ ] **HR Sign-up / Login**: Register a new HR account with organization name.
- [ ] **Dashboard Home**: Verify metric counters, empty state, and recent batch table.
- [ ] **Create Batch Wizard**: Enter batch name, target job title, job description, and cutoff threshold (default 70).
- [ ] **Bulk Upload**: Drag-and-drop 10+ resumes. Verify chunked upload (concurrency 3) and live processing badges.
- [ ] **Review Dashboard**: Verify candidates distributed into **Shortlisted**, **Needs Review**, **Unshortlisted**, and **Failed** tabs.
- [ ] **Candidate Drawer**: Click a candidate row to inspect detected skills, must-have matches, score breakdown, and resume viewer.
- [ ] **Application Form Builder**: Go to Forms, add custom question fields with drag-and-drop, and configure a knockout rule (e.g. "Authorized to work? No").
- [ ] **Public Form Submission**: Open public `/apply/:slug` link in incognito, complete form, and upload resume. Test knockout rule triggering auto-rejection.
- [ ] **Email Connection & Finalization**: Connect test/mock email sender, customize acceptance/rejection templates, verify the finalization guardrail blocks if unresolved `needs_review` candidates exist, and confirm batch finalization by typing `SEND`.
- [ ] **Data Retention Settings**: Go to HR Settings → Data & Privacy, update retention policy to 30/60/90/180 days, and run on-demand data lifecycle purge.

---

## 8. Deployment & Containerization

### Docker Container Build

The single multi-stage Dockerfile can run both the REST API server and the background worker:

```bash
# Build production image
docker build -t shortlistiq-api .

# Run API Server
docker run -p 4000:4000 --env-file .env shortlistiq-api

# Run Background Worker
docker run --env-file .env shortlistiq-api node apps/api/dist/worker.js
```

### Cloudflare Pages Deployment (Web Client)
1. Set build command: `npm run build --workspace=@shortlistiq/web`
2. Set output directory: `apps/web/dist`
3. Environment variables: `VITE_API_URL=https://api.shortlistiq.com`, `VITE_TURNSTILE_SITE_KEY=0x4AAAAAA...`
4. The included `apps/web/public/_redirects` ensures seamless SPA routing on page refresh.

