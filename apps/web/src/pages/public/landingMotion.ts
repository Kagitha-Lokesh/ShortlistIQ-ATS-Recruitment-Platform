import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { isReducedMotion, MOTION_DURATIONS, MOTION_EASES } from '../../lib/motion.js';

gsap.registerPlugin(ScrollTrigger);

export interface InitLandingMotionOptions {
  heroElement: HTMLElement | null;
  explainerElement: HTMLElement | null;
  hrSectionElement: HTMLElement | null;
}

/**
 * Lazy-loaded motion sequence for the public landing page.
 * Restrained, calm, zero scroll-hijacking, strictly compositor transforms.
 */
export function initLandingMotion({
  heroElement,
  explainerElement,
  hrSectionElement
}: InitLandingMotionOptions): () => void {
  const mm = gsap.matchMedia();

  mm.add(
    {
      reduceMotion: '(prefers-reduced-motion: reduce)',
      normalMotion: '(prefers-reduced-motion: no-preference)'
    },
    (context) => {
      const { reduceMotion } = context.conditions!;

      if (reduceMotion) {
        if (heroElement) {
          gsap.set(heroElement.querySelectorAll('.hero-fade'), { opacity: 1, y: 0 });
        }
        if (explainerElement) {
          gsap.set(explainerElement.querySelectorAll('.step-card'), { opacity: 1, y: 0 });
        }
        if (hrSectionElement) {
          gsap.set(hrSectionElement, { opacity: 1, y: 0 });
        }
        return;
      }

      // 1. Calm Hero Entrance (up to ~650ms total stagger)
      if (heroElement) {
        gsap.fromTo(
          heroElement.querySelectorAll('.hero-fade'),
          { opacity: 0, y: 14 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION_DURATIONS.landing,
            stagger: 0.08,
            ease: MOTION_EASES.standard,
            clearProps: 'transform'
          }
        );
      }

      // 2. Three-Step Explainer Cards with Restrained ScrollTrigger
      if (explainerElement) {
        const cards = explainerElement.querySelectorAll('.step-card');
        gsap.fromTo(
          cards,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.12,
            ease: MOTION_EASES.standard,
            clearProps: 'transform',
            scrollTrigger: {
              trigger: explainerElement,
              start: 'top 85%',
              toggleActions: 'play none none none'
            }
          }
        );
      }

      // 3. Section for HR Teams
      if (hrSectionElement) {
        gsap.fromTo(
          hrSectionElement,
          { opacity: 0, y: 16 },
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: MOTION_EASES.standard,
            clearProps: 'transform',
            scrollTrigger: {
              trigger: hrSectionElement,
              start: 'top 85%',
              toggleActions: 'play none none none'
            }
          }
        );
      }
    }
  );

  return () => {
    mm.revert();
  };
}

