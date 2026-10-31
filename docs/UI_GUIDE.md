# ShortlistIQ UI/UX Design System Guide

This guide establishes the interface standards, token architecture, component specifications, motion rules, and UX writing guidelines for **ShortlistIQ**, a high-trust, data-dense B2B recruitment platform and consumer ATS resume checker.

---

## 1. System Philosophy: The Achromatic Ledger

ShortlistIQ operates in high-stakes human recruitment and career evaluations. The visual language is **The Achromatic Ledger**—restrained, precise, and objective:
- **Light Theme Only**: No dark mode toggles, neon colors, glassmorphism, or decorative background shaders.
- **Data-Dense Clarity**: High information density without visual clutter. Generous use of subtle dividers, borders, and tabular numerals.
- **Advisory, Not Deterministic**: Algorithmic match scores are clearly labeled as **estimates**. The system assists recruiter judgment and never executes silent, automated candidate rejections.
- **Accessible by Default**: WCAG 2.2 AA compliant, full keyboard navigable, screen-reader verified, and honoring `prefers-reduced-motion`.

---

## 2. Design Tokens Architecture

All tokens are defined as CSS variables in [`apps/web/src/index.css`](file:///d:/Project/ShortlistIQ%20ATS%20Recruitment%20Platform/apps/web/src/index.css) and exposed through Tailwind CSS.

### 2.1 Core Semantic Color Roles

| Token | CSS Variable | Hex Value | Purpose |
| :--- | :--- | :--- | :--- |
| **Background** | `--background` | `#F8FAFC` | Page canvas background (Slate 50) |
| **Surface** | `--surface` | `#FFFFFF` | Primary card, modal, drawer, and table background |
| **Surface Subtle** | `--surface-subtle` | `#F1F5F9` | Table headers, secondary toolbars, item hover |
| **Foreground (Ink Primary)** | `--text-primary` | `#0F172A` | Primary headings, table text, high-emphasis text |
| **Ink Secondary** | `--text-secondary` | `#475569` | Body descriptions, secondary metadata, table sub-text |
| **Ink Muted** | `--text-muted` | `#64748B` | Timestamps, helper hints, non-critical labels |
| **Border** | `--border` | `#E2E8F0` | Structural dividers, card borders, table rules |
| **Border Strong** | `--border-strong` | `#CBD5E1` | Input outlines, active card states |
| **Ring / Focus** | `--ring` | `#2563EB` | 2px solid accessible keyboard focus indicator (4.5:1 contrast) |

### 2.2 Recruitment Decision & Quality Tokens

> [!IMPORTANT]
> **No Meaning by Color Alone**: Every decision and parse status token **must** be rendered alongside its corresponding icon and verbatim label text.

| State Role | Background | Text | Border | Icon | Label Text |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Recommended Shortlist** | `#ECFDF5` | `#065F46` | `#A7F3D0` | `CheckCircle2` | `Recommended Shortlist` |
| **Needs Review** | `#FFFBEB` | `#92400E` | `#FDE68A` | `AlertCircle` | `Needs Review` |
| **Recommended Not Shortlisted** | `#F8FAFC` | `#475569` | `#E2E8F0` | `MinusCircle` | `Recommended Not Shortlisted` |
| **Knockout / Flagged** | `#FEF2F2` | `#991B1B` | `#FECACA` | `XCircle` | `Knockout Flag (Needs Review)` |
| **Parse Quality: OK** | `#F0FDF4` | `#166534` | `#BBF7D0` | `FileCheck` | `Parse Quality: OK` |
| **Parse Quality: Partial** | `#FFFBEB` | `#B45309` | `#FDE68A` | `AlertTriangle` | `Parse Quality: Partial` |
| **Parse Quality: Unreadable** | `#FEF2F2` | `#B91C1C` | `#FECACA` | `AlertOctagon` | `Parse Quality: Unreadable` |

### 2.3 Typography Scale

- **Primary Font**: `Plus Jakarta Sans`, sans-serif (weights 400, 500, 600, 700).
- **Monospace Font**: `Geist Mono`, ui-monospace (candidate IDs, hashes, match criteria regexes, audit logs).
- **Tabular Figures**: Every numeric display (match percentages, counts, timestamps) applies `.tabular-nums` (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during data streaming or animation.

| Role | Font Size | Line Height | Tracking | Weight |
| :--- | :--- | :--- | :--- | :--- |
| **Display Title** | `1.5rem` (24px) | `2rem` (32px) | `-0.025em` | Bold (700) |
| **Page Heading (H1)** | `1.25rem` (20px) | `1.75rem` (28px) | `-0.02em` | Bold (700) |
| **Section Heading (H2)** | `0.875rem` (14px) | `1.25rem` (20px) | `-0.01em` | SemiBold (600) |
| **Subheading (H3)** | `0.75rem` (12px) | `1rem` (16px) | `0` | SemiBold (600) |
| **Body Standard** | `0.75rem` (12px) | `1.25rem` (20px) | `0` | Regular (400) / Medium (500) |
| **Caption / Metadata** | `0.6875rem` (11px) | `0.875rem` (14px) | `0` | Medium (500) |
| **Badge Microcopy** | `0.625rem` (10px) | `0.75rem` (12px) | `0.025em` | Bold (700) |

### 2.4 Radii & Elevation

- **Radii**:
  - `sm` (4px): Badges, tooltips, tags, table row actions.
  - `md` (6px): Form inputs, standard buttons, tabs, dropdowns.
  - `lg` (8px): Cards, dialog modals, preview containers.
  - `full` (9999px): Avatar pills, circular score meters.
- **Elevation (Flat Shadows)**:
  - `--shadow-subtle`: `0 1px 2px 0 rgba(0, 0, 0, 0.04)` (Cards, input fields).
  - `--shadow-soft`: `0 1px 3px 0 rgba(15, 23, 42, 0.04)` (Hovered rows, popovers).
  - `--shadow-raised`: `0 4px 6px -1px rgba(0, 0, 0, 0.05)` (Dialogs, candidate drawer).

---

## 3. Component Standards & Usage

### 3.1 Buttons (`components/ui/Button.tsx`)
- **Primary**: Solid achromatic (`#0F172A`). Used for single primary action per view (e.g. *Run Analysis*, *Shortlist Candidate*).
- **Secondary / Outline**: Bordered with `#E2E8F0` and subtle hover background.
- **Ghost**: Borderless. Used for table icon buttons, dismissals, and inline actions.
- **Destructive**: Soft red background with dark red text (`#FEF2F2` / `#991B1B`). Reserved for irreversible actions.
- **Loading State**: Displays an accessible `<Loader2 className="animate-spin" />` while preserving element width and setting `disabled aria-busy="true"`.

### 3.2 Decision & Quality Badges (`components/ui/Badge.tsx`)
- Always use the dedicated `<DecisionStatusBadge decision={candidate.decision} />` and `<ParseQualityBadge status={candidate.parseQuality.status} />` primitives.
- Badges must wrap automatically (`flex-wrap gap-1.5`) when container space constrains.

### 3.3 Data Pipeline Table (`pages/hr/BatchDetailPage.tsx`)
- **Density**: 40px compact row height on desktop; responsive card stacks on mobile (`< 768px`).
- **Keyboard Navigation**:
  - `j` or `Down Arrow`: Move to next candidate row.
  - `k` or `Up Arrow`: Move to previous candidate row.
  - `Enter` or `Space`: Open candidate detail drawer.
  - `s`: Quick-shortlist focused candidate.
  - `u`: Quick-unshortlist focused candidate.
  - `b`: Toggle blind review mode.
  - `Escape`: Close open drawer or modal.
- **Blind Review Mode**: Anonymizes names (`Candidate #A1B2`), hides emails (`[Protected Demographic]`), and obscures candidate contact numbers to prevent cognitive screening bias.

### 3.4 Candidate Drawer (`components/hr/CandidateDrawer.tsx`)
- Side panel providing split-pane review: parsed requirements against original PDF text evidence.
- Full keyboard trap with focus management: focuses panel on open and restores previous focused element on dismissal.
- Dismissible via `Escape` key, backdrop click, or close button.
- Requirement Overrides: Any recruiter override requires an explicit reason note to ensure auditability.

### 3.5 Form Builder & Screening Questions (`components/hr/FormBuilderModal.tsx`)
- **Drag & Drop**: Powered by `@dnd-kit`.
- **Keyboard Alternative**: Every custom question includes dedicated **Move Up** and **Move Down** buttons (`ChevronUp`/`ChevronDown`) with accessible labels (`aria-label="Move question 'Years of Experience' up"`), allowing non-pointer keyboard users full reordering capability.
- **Knockout Rules Warning**: Knockout logic includes an alert banner explaining that knockout rules automatically tag applicants who fail critical eligibility criteria for recruiter review.

---

## 4. Motion Guidelines (GSAP Integration)

Motion in ShortlistIQ is subtle, compositor-accelerated, and never delays access to information.

### 4.1 Timing Tokens & Curves
| Token | Duration | Ease | Usage |
| :--- | :--- | :--- | :--- |
| `micro` | `0.15s` (150ms) | `power2.out` | Tooltips, button press feedback, badge transitions |
| `standard` | `0.20s` (200ms) | `power2.out` | Modals, tab panel cross-fade, toast enter/exit |
| `emphasis` | `0.28s` (280ms) | `power2.out` | Candidate drawer slide, score meter sweep, FLIP row moves |
| `landing` | `0.65s` (650ms) | `power2.out` | Public landing hero reveal only (code-split) |

### 4.2 GSAP Guidelines
1. **Compositor Transforms Only**: Never animate `width`, `height`, `top`, or `left` directly. Use `x`, `y`, `scale`, and `opacity`.
2. **`useGSAP` with Scoping**: Always pass a container `scope` and `dependencies` to avoid memory leaks.
3. **GSAP FLIP**: When candidates move between status tabs, `Flip.getState()` and `Flip.from(..., { simple: true })` smoothly translate rows into position so recruiters can track candidate state changes.
4. **Honest Counters**: Progress rings and score numbers always animate to the authentic calculated value.

### 4.3 Accessibility: `prefers-reduced-motion`
- When `isReducedMotion()` returns true (or `prefers-reduced-motion: reduce` matches):
  - Numeric counters render the final score instantly.
  - SVG rings set `strokeDashoffset` immediately via `gsap.set()`.
  - All FLIP and sliding transitions are bypassed; content appears in its final resting state without delay.

---

## 5. UX Writing & Microcopy Standards

Recruitment software directly impacts livelihoods and hiring equity. ShortlistIQ enforces an objective, calm, and non-exclusionary tone.

### 5.1 Voice & Tone Glossary

| System Concept | Recommended Term | Prohibited / Deprecated Terms | Rationale |
| :--- | :--- | :--- | :--- |
| **Top Match Evaluation** | *Recommended Shortlist* | *Passed Candidate*, *Approved by AI* | Shortlists are advisory recommendations for human recruiters. |
| **Uncertain Match** | *Needs Review* | *Borderline*, *Suspicious*, *Failed Test* | Clear, non-accusatory guidance for recruiter inspection. |
| **Low Match Evaluation** | *Recommended Not Shortlisted* | *Rejected*, *Disqualified*, *Unqualified* | Avoids punitive rejection language; preserves applicant dignity. |
| **Knockout Criterion** | *Knockout Flag (Needs Review)* | *Auto-Rejected*, *System Disqualification* | Clarifies that knockout rules flag eligibility issues for human review. |
| **ATS Match Rating** | *Match Score Estimate* | *AI Score*, *Absolute Rating*, *Hire Probability* | Accurately communicates that calculations are estimates against specific text. |
| **Text Parsing Failure** | *Resume Contains No Selectable Text* | *Corrupt Document*, *Invalid Candidate Resume* | Explains the exact mechanical issue with helpful upload instructions. |

### 5.2 Microcopy Rules
1. **No Hype, No Guarantees**: Never promise job interviews, guaranteed ATS passage, or infallible parsing. Always disclose that human recruiters make hiring decisions.
2. **No Blame**: Frame parser difficulties around file characteristics (e.g. *scanned image without selectable text*) rather than user fault.
3. **Confirmations for Destructive Actions**:
   - Deleting a batch requires typing `DELETE`.
   - Finalizing and sending emails requires typing `SEND` and displays a pre-flight checklist and rate limit notice.
4. **Error Message Anatomy**:
   - **What happened**: *Resume contains no extractable text.*
   - **Why**: *The uploaded PDF appears to be an image scan or flattened photograph.*
   - **How to resolve**: *Export a text-based PDF directly from Microsoft Word or Google Docs, or upload a .docx file.*

---

## 6. Accessibility & Zoom Verification

ShortlistIQ conforms to **WCAG 2.2 Level AA**:
1. **Contrast**: All text achieves at least 4.5:1 against light surfaces (large headings achieve > 3:1).
2. **Focus Rings**: `:focus-visible` outline is 2px solid `#2563EB` with a 2px offset.
3. **200% Zoom Reflow**: All cards, forms, and dialog surfaces use flexible percentage widths, `min-w-0`, and `flex-wrap` to reflow without horizontal clipping at 200% browser zoom.
4. **Automated Axe Testing**: 12/12 core application routes pass `axe.run()` with **0 Critical, 0 Serious, 0 Moderate, and 0 Minor** violations.
