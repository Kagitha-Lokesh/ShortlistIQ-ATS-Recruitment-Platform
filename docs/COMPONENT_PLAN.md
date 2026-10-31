# ShortlistIQ Component Plan (21st.dev & shadcn/ui Adaptation)

This document establishes the prioritized selection of **12 core components and blocks** for ShortlistIQ. In alignment with our strict project constraints, free-tier limits, and `achromatic-ledger` art direction, every component is engineered exclusively with semantic design tokens, full keyboard/screen-reader accessibility, zero decorative shaders/neons, and honest recruitment transparency.

---

## 1. Prioritized Component Inventory (Max 12)

| # | Component Name | Category | Target Screens | Purpose & Constraints |
|---|----------------|----------|----------------|-----------------------|
| 1 | `KPICard` / `StatCard` | Stats and KPIs | HR Dashboard, Batch Detail, Results Page | Clean, type-first KPI metric with tabular numbers, contextual delta/ratio, zero vanity sparklines, flat 1px border. |
| 2 | `DataTable` | Tables | Batch Results, HR Batches List, Audit Log | Ledger-style table with sortable columns, row selection, search/filter input, pagination, and right-aligned metric values. |
| 3 | `FileDropzone` | File Uploads | Candidate Checker, Bulk Upload Wizard | Drag-and-drop file ingestion supporting PDF/DOCX, progress indicator, size limits, and full keyboard-accessible trigger. |
| 4 | `Stepper` | Steppers & Progress | Batch Creation Wizard, Multi-step Application | Numbered milestone tracker with active, completed, and pending states; announces active step to screen readers. |
| 5 | `EmptyState` | Empty States | Zero Batches, No Candidates, Empty Search | Clean empty container with subtle icon, calm headline, explanatory copy, and action button. |
| 6 | `MatchScoreMeter` | Charts & Data Viz | Candidate Results, HR Candidate Drawer | Linear/circular match estimate meter (0–100) with honest non-punitive tiers and "Estimate only" label. |
| 7 | `EvidenceCard` | Cards & Blocks | HR Candidate Drawer, Match Breakdown | Side-by-side verbatim comparison of exact JD requirement vs. exact resume quote with match tier badge. |
| 8 | `CriteriaBuilder` | Forms & Inputs | Criteria Builder, Application Form Builder | Dynamic list builder for must-have, nice-to-have, and dealbreaker knockout questions with accessible move controls. |
| 9 | `BlindReviewBar` | Controls & Banners | HR Candidate Drawer, Batch Screening | Sticky control bar with blind review toggle (strips PII: name, gender, college, address) and audit override note requirement. |
| 10 | `PreFinalizeChecklist` | Dialogs & Modals | Finalize Batch & Email Dispatch | Mandatory pre-flight checklist enforcing human review sign-off and non-rejection phrasing before triggering candidate emails. |
| 11 | `AppNavbar` | Navigation Menus | Public, Candidate & HR Shell Layouts | Quiet navigation header with breadcrumbs, role badge, organization switcher, and accessible active indicators. |
| 12 | `HeroRestrained` | Heroes (Public) | Landing Page (`/`) | Calm editorial hero with clear value proposition, dual CTA, parse quality transparency callout, and reduced-motion GSAP entry. |

---

## 2. Strict Project & Anti-Slop Constraints Checklist

- **Light Theme Only**: All components render exclusively on `--background` (`#F8FAFC`) and `--surface` (`#FFFFFF`). No dark mode toggles or dark overrides.
- **No Decorative Slop**: Categorically rejected: shaders, particle networks, glowing neon borders, liquid metal, glassmorphism blurs, and decorative 3D cards.
- **Tokens Only**: Strictly zero hardcoded hex codes outside CSS variables (`var(--border)`, `var(--primary)`, `var(--state-shortlist-text)`, etc.).
- **Accessibility Contract**:
  - Minimum contrast 4.5:1 for body and 3:1 for large headers and boundaries.
  - Visible keyboard focus ring (`2px solid var(--ring)` with `outline-offset: 2px`).
  - Decisions and statuses NEVER rely on color alone (mandatory icon + text pair).
  - All motion respects `prefers-reduced-motion: reduce`.
- **Human-in-the-Loop Copy**: Every match score is labeled an *estimate*; no candidate is ever labeled "Rejected by AI".

---

## 3. Implementation & Showcase Strategy

- Components live in `apps/web/src/components/ui/` (shared base primitives) and `apps/web/src/components/blocks/` (domain-specific composite blocks).
- A dedicated dev-only showcase route (`/dev/showcase`) renders every component in all interactive states (default, loading, error, empty, populated, disabled, and mobile viewport).
