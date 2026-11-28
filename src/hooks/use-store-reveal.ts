import { useEffect, type RefObject } from "react";

const targets = ".promise>div,.how-order-heading,.how-order-steps article,.experience-heading,.experience-card,.section-heading,.product-card,.about-frame,.about>div:last-child";

/** One browser-compatible reveal mechanism, independent of viewport size. */
export function useStoreReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("bp-in-view");
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    const register = () => {
      root.querySelectorAll<HTMLElement>(targets).forEach(element => {
        if (motion.matches) {
          element.classList.remove("bp-reveal-pending");
          element.classList.add("bp-in-view");
          observer.unobserve(element);
        } else if (!element.classList.contains("bp-in-view")) {
          element.classList.add("bp-reveal-pending");
          observer.observe(element);
        }
      });
    };
    register();
    const changes = new MutationObserver(register);
    changes.observe(root, { childList: true, subtree: true });
    motion.addEventListener("change", register);
    return () => {
      observer.disconnect();
      changes.disconnect();
      motion.removeEventListener("change", register);
    };
  }, [ref]);
}