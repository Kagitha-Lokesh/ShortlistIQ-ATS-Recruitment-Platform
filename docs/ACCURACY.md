# ShortlistIQ Engine V2: Accuracy, Explainability & Fairness Architecture

## 1. Executive Summary

ShortlistIQ Engine V2 is an accuracy-focused upgrade of the automated parsing, candidate-job matching, and recommendation engine. Designed for high-stakes talent screening, the engine operates on six non-negotiable principles:

1. **High-Stakes Decision Policy**: Prefer `needs_review` (uncertain, routed to human review) over confident wrong answers.
2. **Defensive Parsing Guarantee**: Never penalize a candidate for parsing defects or layout quirks.
3. **100% Grounded Evidence**: Every score, match, and recommendation is backed by verbatim resume text snippets and exact job description requirements.
4. **Zero Automated Rejections**: Automatic machine outcomes are strictly limited to `recommended_shortlist`, `recommended_not_shortlisted`, or `needs_review`. Final hiring decisions belong exclusively to human recruiters. Knockout criteria flag for human confirmation.
5. **Strict Demographic Blindness**: Demographics (name, gender, photo, age, date of birth, marital status, nationality, protected classes, address/city, institution prestige, and career gaps) are stripped prior to scoring and never passed to LLMs.
6. **Honest UI Transparency**: ATS scores are presented as contextual alignment estimates against specific job descriptions, never as hiring predictions.

---

## 2. Upgraded Architecture Components

### Part A: Ingest & Parse-Quality Gate (`packages/engine/src/ingest`)
- **2D Reading-Order Reconstruction (`layout.ts`)**: Reconstructs multi-column, table, and sidebar layouts based on 2D coordinates `(x, y, w, h)`, preventing interleaved cross-column text.
- **Normalization with Source-Mapping (`normalizer.ts`)**: Resolves unicode ligatures (`ﬁ` → `fi`), smart quotes, hyphenated linebreaks, spaced-out acronyms (`P Y T H O N` → `PYTHON`), and maintains a bidirectional map to original bounding boxes.
- **Adversarial & Integrity Scanner (`integrity.ts`)**: Detects prompt injection phrases (`ignore previous instructions`), microscopic text (< 3pt), and keyword stuffing. Sanitizes LLM prompts while creating an integrity flag for HR.
- **Parse Quality Report (`quality.ts`)**: Classifies document parse status as `OK`, `PARTIAL`, or `UNREADABLE`. `PARTIAL` and `UNREADABLE` documents automatically route to `needs_review`.

### Part B: Structured Resume Extraction (`packages/engine/src/extract`)
- **Multi-Format Date Engine (`dates.ts`)**: Parses formats (`Jan 2021`, `01/2021`, `2021-present`, `Q3 2020`, `Summer 2019`, year-only) and merges overlapping date intervals to prevent double-counting concurrent roles.
- **Tiered Skill Evidence (`profile.ts`)**: Extracts skill evidence into 3 deterministic strength tiers:
  - `outcome_backed`: Used in role with quantifiable business metric/outcome.
  - `job_context`: Used in experience or project description.
  - `listed_only`: Listed only in skills summary.
- **Demographic Stripping (`profile.ts`)**: Strips protected attributes and institution prestige markers before passing data to scoring models or LLMs.
- **LLM Verbatim Quote Guard (`profile.ts`)**: Rejects any LLM-assisted section whose quoted evidence does not appear verbatim in the original document.

### Part C: Job Description Analysis (`packages/engine/src/jd`)
- **Requirement Taxonomy (`parser.ts`)**: Extracts seniority, must-have skills, nice-to-have skills, required years, education requirements, and "or" alternatives (`React or Angular`).
- **Input Validity Check (`validator.ts`)**: Validates that pasted text is a genuine job description, rejecting random text, code, or marketing copy with explanatory guidance.
- **JD Quality Scanner (`validator.ts`)**: Flags unrealistic tech combinations (e.g. 10 years of a 4-year-old framework), discriminatory phrasing, or overly long requirement lists.

### Part D: Matching Engine (`packages/engine/src/match`)
- **Canonical Skills Ontology (`ontology.ts`)**: Distinguishes distinct technologies (`Java` vs `JavaScript`, `C` vs `C++`, `SQL` vs `NoSQL`) and applies context-aware stoplisting for short ambiguous tokens (`go`, `r`, `c`, `next`, `rest`).
- **Graduated Credit by Evidence Tier (`evaluator.ts`)**: Awards 100% credit for outcome-backed skills, 90% for job context, and 60% for listed-only skills.
- **Semantic Similarity Safeguard**: Semantic similarity is surfaced to HR as "related experience", but is strictly prohibited from auto-passing must-have requirements.

### Part E: Decision Policy (`packages/engine/src/decide`)
- **Deterministic Routing (`policy.ts`)**:
  - `needs_review`: Assigned if parse status is `PARTIAL`/`UNREADABLE`, knockout question failed, score is borderline (within 5 points of cutoff), experience is within 6 months of requirement, or integrity alert is triggered.
  - `recommended_shortlist`: Score exceeds cutoff with all must-haves met.
  - `recommended_not_shortlisted`: Clear deficiency not meeting criteria, requiring human confirmation.
- **Zero Auto-Reject**: No candidate is ever auto-rejected by the algorithm alone.

### Part F: Export Grounding & Verification (`apps/api/src/services/export`)
- **Anti-Hallucination Grounding (`verify.ts`)**: Verifies that exported PDF/DOCX templates do not inject inflated degrees or fabricated employers not present in the original resume.

### Part G: Benchmark Suite & Property Tests (`packages/engine/test`)
- **60 Golden Fixtures (`fixtures/index.ts`)**: Evaluates multi-column, table, single-column, career-changer, entry-level, senior, executive, and adversarial layouts.
- **Mathematical Invariance**: Verified property test proving demographic mutations (name, gender, address, college prestige) produce exact `0.0` point score delta.

### Part H: UI Transparency & Human-In-The-Loop (`apps/web`)
- **HR Candidate Drawer (`CandidateDrawer.tsx`)**:
  - Parse-Quality badge (`OK`, `PARTIAL`, `UNREADABLE`) with explanation.
  - Verbatim resume evidence snippet and evidence strength tier for each requirement.
  - Blind Review Toggle: Instantly masks candidate names, contact details, and institutions.
  - 1-Click HR Override: Recruiters make final decisions (`Shortlist`, `Needs Review`, `Unshortlist`) with audit trail.
- **Candidate Checker (`ResultsPage.tsx`, `SuggestionsPage.tsx`)**:
  - Prominent ATS accuracy disclosure banner.
  - Extractability report showing which resume sections were parsed.
  - Truthful optimization notice ensuring suggestions never fabricate skills.

---

## 3. Test & Verification Summary

All test suites and TypeScript checks pass across the entire monorepo:

| Workspace | Test Suite | Tests Passed | Status |
| :--- | :--- | :--- | :--- |
| `@shortlistiq/engine` | Ingest, Extract, JD, Match, Decide, Scoring, Golden Fixtures | 53 | PASS |
| `@shortlistiq/shared` | Zod Schemas & Validation | 4 | PASS |
| `@shortlistiq/api` | Storage, Export, Batching, Scoring, Review Flow, Error Handling | 103 | PASS |
| `@shortlistiq/web` | Frontend Acceptance & Workflow Tests | 9 | PASS |
| **Total** | **18 Suites** | **169 Tests** | **100% PASS** |

- **Typecheck**: `npm run typecheck` passes with 0 errors across `@shortlistiq/engine`, `@shortlistiq/shared`, `@shortlistiq/api`, and `@shortlistiq/web`.
