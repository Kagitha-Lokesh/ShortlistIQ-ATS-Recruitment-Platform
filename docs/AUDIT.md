# ShortlistIQ ATS Architecture Audit: Accuracy, Parsing & Decision Pipeline

**Date:** 2026-10-31  
**Target:** High-Stakes Accuracy Upgrade (`accuracy-upgrade` branch)  
**Scope:** `@shortlistiq/engine`, `@shortlistiq/shared`, `apps/api`, `apps/web`, database models, queues, and prompt pipelines.

---

## 1. Executive Summary & Core Mandate

In high-stakes recruitment and applicant screening, algorithmic errors directly impact human livelihoods. The system must adhere to six non-negotiable principles:
1. **Uncertainty over Overconfidence:** Send ambiguous parses or scores to human review (`needs_review`).
2. **Never Penalize Candidates for Engine Failures:** Extraction defects must flag a parse quality issue, never reduce a candidate's match score.
3. **Verbatim Evidence Grounding:** Every match, score component, and suggestion must cite verbatim document snippets.
4. **No Automated Engine Rejection:** Engine outcomes are strictly advisory recommendations (`recommended_shortlist`, `recommended_not_shortlisted`, `needs_review`). Knockout rules flag candidates for HR confirmation; no automated knockout rejection.
5. **Strict Demographic Blindness:** Protected attributes (names, gender, age, DOB, photo, marital status, caste, religion, address/city, college prestige, career gaps) must never influence scoring or be transmitted to LLMs.
6. **Honest User Facing Communication:** ATS scores represent semantic alignment against specific JD requirements, not hiring predictions or external ATS replication.

---

## 2. Current Architecture Walkthrough

### 2.1 How Resumes are Parsed Today
- **File:** `apps/api/src/services/pdf.ts`
- **Mechanism:** Uses `unpdf` with `getDocumentProxy()` and `extractText(doc, { mergePages: true })`.
- **Text Normalization:** `normalizeExtractedText()` performs basic regex substitution of unicode bullets (`•, ●, *, -, ▪`) and whitespace collapsing.
- **Defects & Limitations:**
  - `extractText()` extracts linear text streams without 2D positional bounding boxes (`x, y, w, h`). Multi-column formats (e.g., sidebar contact/skills alongside work history) merge text line-by-line horizontally across columns, corrupting section boundaries, skill associations, and date ranges.
  - Imposes a hard cutoff: if readable alphanumeric characters `< 200`, throws `AppError(422, 'NO_TEXT')` or `CORRUPT_FILE`.
  - In `queue.ts`, if `NO_TEXT` or `CORRUPT` is caught, candidate status is permanently marked `failed`, aborting evaluation without human triage.
  - Does not produce parse quality metrics (ligature corruption, private-use unicode, multi-column suspicion, invisible text, font-size anomalies).

### 2.2 How Skills and Sections are Extracted
- **Sections File:** `packages/engine/src/sections/index.ts` (`segmentSections`)
  - Matches 6 predefined heading regex patterns (`summary`, `experience`, `skills`, `education`, `projects`, `certifications`).
  - Lines are segmented into single-string accumulators. If headings fail to match (e.g., "Relevant Background", non-standard casing, or text wrapped across column splits), content spills into `other` or `summary`.
- **Skills File:** `packages/engine/src/skills/index.ts` (`extractSkills`, `matchesAlias`)
  - Bundles a static dictionary of ~500 tech terms.
  - Regex alias matching uses: `(^|[^a-zA-Z0-9#+])${alias}([^a-zA-Z0-9#+]|$)`.
  - **Defects:**
    - High false-positive rate for short tokens and common English words: "go" (in "go-to person"), "r", "c", "next", "rest".
    - Binary credit: Skills listed in a raw keyword pile receive the exact same weight as skills verified with multi-year project outcomes.
    - No distinction between raw keyword mentions and verified employment outcomes.

### 2.3 How Scores are Calculated
- **File:** `packages/engine/src/scoring/index.ts` (`scoreResume`, `DEFAULT_SCORE_WEIGHTS`)
  - **Keyword Score (35%):** TF-IDF cosine similarity between resume text and JD text (`tfidf.ts`).
  - **Skills Score (30%):** Ratio of JD-overlapping skills or required skills matched.
  - **Experience Score (20%):** `estimateExperienceYears()` scans regexes for `\d+\s*years` and date spans `YYYY - YYYY`.
  - **Formatting Score (10%):** Section presence points + contact completeness (email, phone, LinkedIn) + word count heuristics.
  - **Readability Score (5%):** Automated Readability Index (ARI) and Flesch-Kincaid formula.
  - **Defects:**
    - `estimateExperienceYears()` naively sums disjoint date differences: `Math.min(15, endYear - startYear)`. Overlapping concurrent roles double-count years; gaps are penalized or miscalculated; education years (e.g. 2022-2026) are counted as professional work experience.
    - Formatting score awards points for phone and LinkedIn URLs, indirectly penalizing candidates who omit optional personal contact data.

### 2.4 How JD Text is Processed
- **Current State:** No formal JD parser exists.
- The JD text is treated as an unstructured string passed directly into TF-IDF and skill dictionary regex matching (`extractSkills(jdText)`).
- Does not extract structured requirements:
  - No distinction between "must-have" vs. "nice-to-have" vs. "bonus".
  - Fails to parse logical alternatives ("React OR Angular").
  - Fails to parse years per specific skill ("5+ years of Python").
  - Fails to flag JD quality issues (unrealistic tech requirements, discriminatory language).

### 2.5 How Shortlisting Decisions are Made
- **Files:** `packages/engine/src/scoring/index.ts` (`scoreAgainstCriteria`), `apps/api/src/services/queue.ts`, `apps/api/src/routes/v1/forms.ts`.
- **Engine Logic:**
  - If a criterion is marked `dealbreaker` and fails -> status set to `unshortlisted`.
  - If `alwaysRequireAllMustHaves` is true and any must-have fails -> `unshortlisted`.
  - If score < cutoff -> `unshortlisted`.
  - Borderline cases (score within 5 points of cutoff or exactly 1 failed must-have) produce `needs_review`.
- **Forms Knockout Logic (`apps/api/src/routes/v1/forms.ts`):**
  - When candidate submits a public form, `evaluateFormKnockoutRules()` evaluates answers.
  - If any knockout rule triggers: candidate is **immediately auto-rejected** (`decision: unshortlisted, decisionSource: knockout, score: 0`), never reviewed by HR.

### 2.6 Where the LLM is Used
- **File:** `apps/api/src/services/ai.ts`
- **Providers:** Groq (ultra-fast free models), Gemini fallback (`GEMINI_API_KEY`), OpenRouter free tier.
- **Tasks:**
  1. `suggestCriteriaFromJd`: Generates scoring criteria from job descriptions.
  2. `suggestCriteriaItemsFromJd`: Generates structured criteria items (must-haves, nice-to-haves).
  3. `summarizeCandidate`: Generates narrative summary for HR candidate drawer.
  4. `generateSuggestionsForCheck`: Generates bullet optimization suggestions for candidate-side checker.
  5. `generateCandidateStrengthGaps`: Evaluates strengths and gaps for shortlisted candidates.
- **Defects:**
  - Candidate's full name, raw resume text, and unredacted contact data are interpolated into LLM prompts without PII anonymization.
  - LLM suggestions are not strictly validated against source resume text to prevent hallucinated achievements, credentials, or metrics.

### 2.7 How the PDF is Regenerated
- **Files:** `apps/api/src/services/export/latex.ts`, `pdf.ts`, `docx.ts`, `packages/engine/src/converter/index.ts`.
- `convertTextToResumeData()` uses heuristic regexes to infer `ResumeData`. When education or job titles fail to parse cleanly, it falls back to hardcoded strings (`institution: 'University'`, `degree: 'Bachelor of Science'`).
- The LaTeX generator inserts these parsed values into LaTeX templates compiled via `https://latex.ytotech.com/builds/sync`.
- If deterministic extraction missed data, the generated PDF contains repeated placeholder entries.

### 2.8 Existing Tests
- `apps/api/test/`: 18 test files covering API routes, tenancy, auth, PDF parsing, health, and privacy.
- `packages/engine/test/scoring.test.ts`: 8 unit tests covering basics extraction, section segmentation, TF-IDF calculation, readability, and composite scoring.
- `packages/shared/test/schemas.test.ts`: Schema validation tests.
- **Missing Tests:**
  - No golden dataset of varied resume formats (multi-column, academic, creative, executive, technical).
  - No adversarial injection or invisible text test suites.
  - No property tests for date range normalization and skill disambiguation.
  - No regression benchmark comparing scoring across engine revisions.

---

## 3. Inventory: Places Where Candidates Are Wrongly Penalized or Rejected Today

| # | Component | Location | Failure Mechanism | Real-World Impact on Candidate |
|---|---|---|---|---|
| 1 | PDF Ingest | `apps/api/src/services/pdf.ts:58-64` | Throws `NO_TEXT (422)` if `< 200` chars; marked `failed` in queue. | Valid candidates with concise resumes or vector PDFs are completely dropped without HR seeing them. |
| 2 | PDF Ingest | `apps/api/src/services/pdf.ts:52` | `extractText` merges multi-column layouts horizontally. | Experience and skills intermingle, dates disconnect from titles, causing zero matches and low score. |
| 3 | Queue Ingestion | `apps/api/src/services/queue.ts:301-310` | Regex fails to extract email -> marked `failed` (`NO_EMAIL`), aborted. | Legitimate candidates with stylized headers or international formats are silently discarded. |
| 4 | Public Forms | `apps/api/src/routes/v1/forms.ts:162-187` | Knockout rules trigger immediate auto-rejection (`decision: unshortlisted, score: 0`). | Candidates rejected by machine logic alone without human confirmation (violates Principle 4). |
| 5 | Scoring Engine | `packages/engine/src/scoring/index.ts:376-387` | Dealbreaker or failed must-have directly sets `decision: unshortlisted`. | Candidates with equivalent experience or slight phrasing differences are auto-rejected without review. |
| 6 | Experience Estimator | `packages/engine/src/scoring/index.ts:63-78` | Naive date regex sums disjoint years, counts education spans as work experience. | Candidates with concurrent jobs get inflated years; candidates with non-standard date formats get 0 years. |
| 7 | Skills Engine | `packages/engine/src/skills/index.ts:190-200` | Ambiguous short tokens ("c", "r", "go") match conversational English. | False skill inflation for candidates using words like "go-to person"; penalizes genuine candidates by comparison. |
| 8 | Formatting Scoring | `packages/engine/src/scoring/index.ts:112-115` | Awards points for phone number, LinkedIn, and GitHub links. | Penalizes candidates who omit personal social media links or protect privacy. |
| 9 | PII / Demographic Bias | `packages/engine/src/basics/index.ts:27` & `apps/api/src/services/ai.ts` | Full candidate name, contact, and raw location passed to scoring and LLM prompts. | Potential for demographic, gender, ethnic, or age bias in LLM summaries and evaluations. |
| 10 | Resume Converter | `packages/engine/src/converter/index.ts:205,264` | Defaults missing education to `'University'` and `'Bachelor of Science'`. | Corrupts candidate profile and generates inaccurate export documents. |

---

## 4. Architecture Mapping: Parts A through H

### Part A: Resume Ingestion & Parse-Quality Gate
- **Modify:** `packages/engine/src/ingest/` (new module)
- **Modify:** `apps/api/src/services/pdf.ts`
- **Functions:**
  - Introduce coordinate-aware PDF extraction using `pdfjs-dist` / `unpdf` token items with `(x, y, w, h)` to detect columns, tables, and sidebars.
  - Implement reading-order layout reconstruction algorithm.
  - Implement `produceParseQualityReport(buffer)`: character count, ligature glyph check, garbled ratio, font sizes (< 3pt invisible text), background fill color matching.
  - Add text normalization with NFKC, ligature unrolling, and offset coordinate mapping for PDF highlighting.
  - Categorize parse status: `OK | PARTIAL | UNREADABLE`. Route `PARTIAL` and `UNREADABLE` directly to `needs_review`.

### Part B: Structured Resume Extraction
- **Modify:** `packages/engine/src/basics/index.ts`
- **Modify:** `packages/engine/src/sections/index.ts`
- **Modify:** `packages/engine/src/converter/index.ts`
- **Functions:**
  - Replace unconfident defaults with typed `ResumeProfile`: each field has `confidence` (0 to 1) and `sourceEvidence` `{ page, snippet, boundingBox }`.
  - Date parsing engine handling diverse formats (`Jan 2021`, `01/2021`, `2021-present`, `Q3 2020`, `Summer 2019`, year-only).
  - Date interval union algorithm: merges overlapping employment spans so concurrent roles do not inflate total years; neutral gap handling.
  - PII redaction layer: strips names, address, phone, photo, age, gender, college prestige from scoring payloads.

### Part C: Job Description Analysis
- **Create:** `packages/engine/src/jd/index.ts`
- **Functions:**
  - Parse JD into typed `JobRequirements` (title, seniority, must-have skills, nice-to-have skills, required years overall and per-skill, education, location/work authorization constraints).
  - Logical condition parsing: "React or Angular" parsed as single OR requirement.
  - JD Quality Validator: flags unrealistic requirements (e.g. 10 years experience in a 4-year-old technology), vague criteria, discriminatory language.
  - HR confirmation state: requires HR approval of extracted criteria before batch scoring.

### Part D: Matching Engine
- **Modify:** `packages/engine/src/skills/index.ts`
- **Modify:** `packages/engine/src/scoring/index.ts`
- **Functions:**
  - Upgraded skills ontology with strict token boundaries and stoplist for ambiguous short tokens ("c", "r", "go").
  - Evidence strength weighting:
    - Listed in skills section only: 0.4x weight
    - Used in experience bullet: 0.8x weight
    - Used with quantified outcome: 1.0x weight
  - Requirement evaluation result: `PASS | PARTIAL | FAIL | UNKNOWN` with exact quoted evidence.

### Part E: Decision Policy
- **Modify:** `packages/shared/src/utils/knockout.ts`
- **Modify:** `apps/api/src/routes/v1/forms.ts`
- **Modify:** `apps/api/src/routes/v1/batches.ts`
- **Modify:** `apps/api/src/services/queue.ts`
- **Functions:**
  - Eliminate all automated rejection paths. System outcomes are strictly advisory: `recommended_shortlist | recommended_not_shortlisted | needs_review`.
  - Knockout rules flag candidates with `knockoutFlag: true` and routing to `needs_review` for human confirmation.
  - Database schema: ensure audit log records whether decision was HR confirmed or engine recommended.

### Part F: Candidate-Side Checker Accuracy
- **Modify:** `apps/api/src/routes/v1/checks.ts`
- **Modify:** `apps/api/src/services/ai.ts`
- **Modify:** `apps/api/src/services/export/verify.ts`
- **Functions:**
  - Validate pasted JD text; warn candidate if pasted text does not resemble a legitimate job description.
  - Ground AI suggestions: verify that any suggested improvement only builds upon claims verbatim in the uploaded resume.
  - Add diff verification before PDF export to prevent hallucinated achievements.

### Part G: Verification & Golden Dataset
- **Create:** `packages/engine/test/fixtures/` (60 diverse synthetic resumes + 10 realistic JDs)
- **Create:** `packages/engine/test/golden.test.ts`
- **Create:** `scripts/regression-report.ts`
- **Functions:**
  - Benchmark Engine V1 vs Engine V2 across all 60 fixtures.
  - Produce comprehensive comparison report `docs/MIGRATION_REPORT.md`.

### Part H: HR & Candidate UI Transparency
- **Modify:** `apps/web/src/components/hr/CandidateDrawer.tsx`
- **Modify:** `apps/web/src/pages/hr/BatchDetailPage.tsx`
- **Modify:** `apps/web/src/pages/candidate/ResultsPage.tsx`
- **Modify:** `apps/web/src/pages/candidate/ExportPage.tsx`
- **Functions:**
  - Display Parse Quality badge (`OK`, `PARTIAL`, `UNREADABLE`) with inspectable quality report.
  - Show exact verbatim resume snippets for every matched criterion.
  - Add Blind Review Toggle (redacts candidate name, contact, college name).
  - Add HR single-click override for any requirement or recommendation.

---

## 5. Rollout & Feature Flag Architecture (`ENGINE_V2`)

To ensure backward compatibility and zero downtime:
- `ENGINE_V2` environment flag will govern engine dispatch:
  - `ENGINE_V2=false`: Legacy Engine V1 execution.
  - `ENGINE_V2=true`: Upgraded Engine V2 execution.
  - `ENGINE_V2=shadow`: Runs Engine V2 in shadow mode, recording discrepancies without impacting active decisions.
- All database columns introduced will be nullable or provide sensible defaults.
- Baseline snapshot has been captured in `.data/snapshot-baseline.json` prior to engine modifications.

