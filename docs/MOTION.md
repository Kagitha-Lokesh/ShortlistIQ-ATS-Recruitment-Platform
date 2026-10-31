# ShortlistIQ Motion System Specification (GSAP)

This document outlines the motion architecture, interaction timings, easing curves, and accessibility compliance rules for ShortlistIQ ATS, implemented in **Step 7** using GSAP (`gsap`, `@gsap/react`, `gsap/Flip`, and `gsap/ScrollTrigger`).

---

## 1. Principles & Art Direction Alignment

In alignment with the **Achromatic Ledger** design direction (data-dense, calm, light theme, high-trust recruitment software):
1. **Functional & Restrained**: Motion exists solely to convey hierarchy, spatial continuity, and state changes. No bouncing, rubber-banding, or decorative distractions.
2. **Never Block or Delay Work**: Critical data is accessible immediately. Animation durations never exceed 280ms on interactive app surfaces. Assistive technology receives final DOM state without delay.
3. **Compositor Transforms Only**: Animations target `opacity` and CSS `transform` (`x`, `y`, `scale`). Layout-triggering properties (`width`, `height`, `top`, `left`, `margin`) are avoided for motion to guarantee consistent 60fps performance without layout thrashing.
4. **Honest Counters & Progress**: Scores, match meters, and progress rings always animate strictly to their genuine calculated values—never simulated or inflated.

---

## 2. Motion Tokens & Scales

Centralized in [`apps/web/src/lib/motion.ts`](file:///d:/Project/ShortlistIQ%20ATS%20Recruitment%20Platform/apps/web/src/lib/motion.ts):

### Durations
| Token | Duration | Purpose |
| :--- | :--- | :--- |
| `MOTION_DURATIONS.micro` | `0.15s` (150ms) | Micro-interactions: tooltips, small popovers, badge toggles, toast exit |
| `MOTION_DURATIONS.standard` | `0.20s` (200ms) | Standard UI: dialog modals, tab content switching, toast entrance |
| `MOTION_DURATIONS.emphasis` | `0.28s` (280ms) | Spatial & layout continuity: candidate drawer slides, Flip layout transitions, score rings |
| `MOTION_DURATIONS.landing` | `0.65s` (650ms) | Public landing hero entrance & explainer reveals (isolated to public marketing route) |

### Eases
| Token | Value | Behavior |
| :--- | :--- | :--- |
| `MOTION_EASES.standard` | `power2.out` | Decelerating curve for elements entering the screen or responding to user action |
| `MOTION_EASES.smooth` | `power1.out` | Gentle decelerating curve for scroll triggers and subtle staggers |
| `MOTION_EASES.exit` | `power1.in` | Accelerating curve for elements exiting view (toasts, modals) |

---

## 3. Accessibility & `prefers-reduced-motion`

ShortlistIQ strictly complies with WCAG 2.2 Success Criterion 2.2.2 (Pause, Stop, Hide) and 2.3.3 (Animation from Interactions).

1. **Global Reduced-Motion Detection**:
   ```ts
   export function isReducedMotion(): boolean {
     if (typeof window === 'undefined') return false;
     return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
   }
   ```
2. **Immediate Fallback**:
   When reduced motion is preferred:
   - Numerical counters immediately display the exact number (`textContent = clamped`).
   - Circular score rings and progress bars immediately set their stroke offsets and widths via `gsap.set()`.
   - Modals and drawers appear instantly without translate or scale transitions.
   - Flip transitions and scroll animations are completely bypassed.
3. **`gsap.matchMedia()` Scoping**:
   On the public landing page, all `ScrollTrigger` tweens are registered through `gsap.matchMedia()` conditioned on `(prefers-reduced-motion: no-preference)`.

---

## 4. Implementation by Surface

### A. Core Primitives (`components/ui`)
- **`Toast.tsx`**: Enter animation (`opacity: 0, y: 12, scale: 0.98` $\to$ `1, 0, 1` in 200ms) and exit animation (`opacity: 0, y: -8, scale: 0.98` in 150ms) scoped via `useGSAP`.
- **`Dialog.tsx`**: Backdrop fades in (`opacity: 0` $\to$ `1`), and modal panel enters with subtle scale and rise (`opacity: 0, scale: 0.98, y: 6` $\to$ `1, 1, 0` in 200ms `power2.out`).
- **`Drawer.tsx`**: Slide-in panel transforms (`x: 32, opacity: 0` $\to$ `0, 1` in 280ms `power2.out`).
- **`Tabs.tsx`**: Tab content panel cross-fades on tab switch (`opacity: 0, y: 4` $\to$ `1, 0` in 200ms).

### B. Candidate Side
- **`ResultsPage.tsx`**:
  - Score ring SVG `strokeDashoffset` animates smoothly to true score using `animateScoreRing`.
  - Numeric score counter increments from 0 to actual value using `animateCounter`.
  - 5 breakdown progress bars animate to genuine percentages using `animateProgressBar`.
  - Page sections stagger in with subtle 4px rise.

### C. Recruiter & HR Side
- **`DashboardPage.tsx`**:
  - KPI metric cards, active batches table, and quick actions fade and rise with a subtle 0.04s stagger.
- **`BatchDetailPage.tsx`**:
  - **Flip Layout Transitions**: When candidates are moved between *Recommended shortlist*, *Needs review*, or *Recommended not shortlisted*, GSAP `Flip` captures the DOM rects and animates rows into place so recruiters can visually track where candidates moved without disorientation.
  - Table row insert / tab filter transitions with subtle 20ms stagger.
- **`CandidateDrawer.tsx`**:
  - Score ring and counter animate to candidate's score.
  - Requirement criteria breakdown bars animate into place.

### D. Public Landing Page (Lazy Loaded)
- Located in [`apps/web/src/pages/public/landingMotion.ts`](file:///d:/Project/ShortlistIQ%20ATS%20Recruitment%20Platform/apps/web/src/pages/public/landingMotion.ts).
- Dynamically imported in [`apps/web/src/pages/public/LandingPage.tsx`](file:///d:/Project/ShortlistIQ%20ATS%20Recruitment%20Platform/apps/web/src/pages/public/LandingPage.tsx) via `import('./landingMotion.js')`.
- Calm hero entrance (650ms `power2.out`).
- Explainer step cards revealed via restrained `ScrollTrigger` with 80ms stagger.
- Zero scroll hijacking, zero parallax, no `ScrollSmoother`.

---

## 5. Performance & Bundle Impact

To prevent bundle bloat, `gsap/ScrollTrigger` is isolated to the public landing page chunk. The main recruiter bundle only bundles the lightweight core `gsap`, `@gsap/react`, and `gsap/Flip`.

### Bundle Size Comparison (Production Build)

| Asset Chunk | Before Step 7 (End of Step 6) | After Step 7 (GSAP Integration) | Net Change |
| :--- | :--- | :--- | :--- |
| **Main App Bundle (`index-*.js`)** | 1,066.71 kB (gzip: 291.53 kB) | 1,098.03 kB (gzip: 301.88 kB) | **+31.32 kB** (+10.35 kB gzip) |
| **Landing Motion Chunk (`landingMotion-*.js`)** | *N/A (monolithic)* | 45.05 kB (gzip: 18.60 kB) | **Code-split dynamic chunk** (0 kB for app routes) |
| **Global Stylesheet (`index-*.css`)** | 43.43 kB (gzip: 8.36 kB) | 43.48 kB (gzip: 8.35 kB) | **+0.05 kB** (-0.01 kB gzip) |
| **HTML Shell (`index.html`)** | 0.81 kB (gzip: 0.46 kB) | 0.81 kB (gzip: 0.46 kB) | **0 kB** |

All tests pass (169/169 tests across engine, shared, api, and web), and TypeScript typechecks with 0 errors.
