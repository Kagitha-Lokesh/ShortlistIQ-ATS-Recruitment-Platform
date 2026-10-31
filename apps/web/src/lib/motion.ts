import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { Flip } from 'gsap/Flip';

// Register plugins once at top-level
gsap.registerPlugin(useGSAP, Flip);

// Standardized motion tokens (Achromatic Ledger: restrained, professional, calm)
export const MOTION_DURATIONS = {
  micro: 0.15,      // 150ms: tooltips, toggles, badge states
  standard: 0.2,    // 200ms: dialogs, tabs, toast enter/exit
  emphasis: 0.28,   // 280ms: drawers, page content entrance, score meters
  landing: 0.65     // 650ms: hero reveal (landing page only)
} as const;

export const MOTION_EASES = {
  standard: 'power2.out',
  smooth: 'power1.out',
  exit: 'power1.in'
} as const;

/**
 * Check whether system prefers reduced motion
 */
export function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Animate an SVG circular score ring to its genuine, un-inflated value
 */
export function animateScoreRing(
  circleEl: SVGCircleElement | null,
  targetScore: number,
  radius = 54,
  duration: number = MOTION_DURATIONS.emphasis
): gsap.core.Tween | null {
  if (!circleEl) return null;

  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(targetScore)));
  const targetOffset = circumference - (clamped / 100) * circumference;

  if (isReducedMotion()) {
    gsap.set(circleEl, { strokeDashoffset: targetOffset });
    return null;
  }

  return gsap.fromTo(
    circleEl,
    { strokeDashoffset: circumference },
    {
      strokeDashoffset: targetOffset,
      duration,
      ease: MOTION_EASES.standard
    }
  );
}

/**
 * Animate a numeric text element from 0 to target score
 */
export function animateCounter(
  targetEl: HTMLElement | null,
  targetScore: number,
  duration: number = MOTION_DURATIONS.emphasis
): gsap.core.Tween | null {
  if (!targetEl) return null;

  const clamped = Math.max(0, Math.min(100, Math.round(targetScore)));

  if (isReducedMotion()) {
    targetEl.textContent = clamped.toString();
    return null;
  }

  const obj = { val: 0 };
  return gsap.to(obj, {
    val: clamped,
    duration,
    ease: MOTION_EASES.standard,
    onUpdate: () => {
      if (targetEl) {
        targetEl.textContent = Math.round(obj.val).toString();
      }
    }
  });
}

/**
 * Animate a progress bar width from 0% to genuine percentage
 */
export function animateProgressBar(
  barEl: HTMLElement | null,
  targetPercent: number,
  duration: number = MOTION_DURATIONS.standard
): gsap.core.Tween | null {
  if (!barEl) return null;

  const clamped = Math.max(0, Math.min(100, Math.round(targetPercent)));

  if (isReducedMotion()) {
    gsap.set(barEl, { width: `${clamped}%` });
    return null;
  }

  return gsap.fromTo(
    barEl,
    { width: '0%' },
    {
      width: `${clamped}%`,
      duration,
      ease: MOTION_EASES.standard
    }
  );
}

export { gsap, useGSAP, Flip };
