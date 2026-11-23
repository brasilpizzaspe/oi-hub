import { useCallback, useEffect, useRef, type RefObject } from "react";

/**
 * Carrossel com foco contínuo: o cartão em destaque cresce e os vizinhos se
 * reorganizam ao redor dele, guiados por uma mola (movimento orgânico).
 * Todo o movimento é escrito direto no DOM a cada quadro para não
 * re-renderizar a página inteira.
 */
const STIFFNESS = 140;
const DAMPING = 22;
const MOBILE_QUERY = "(max-width:760px)";

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const wrap = (rel: number, n: number) => {
  let r = ((rel % n) + n) % n;
  if (r > n / 2) r -= n;
  return r;
};

export function useFocusCarousel(ref: RefObject<HTMLDivElement | null>, count: number) {
  const s = useRef({ pos: 0, vel: 0, target: 0, raf: 0, last: 0, suppressClick: false });

  const render = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const cards = Array.from(el.children) as HTMLElement[];
    const n = cards.length;
    if (!n) return;
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    const cw = el.clientWidth;
    const W = cards[0]!.offsetWidth;
    const gap = mobile ? 12 : 16;
    const minS = mobile ? 0.86 : 0.84;
    const anchor = mobile ? cw / 2 : W / 2;
    const step = minS * W + gap;
    cards.forEach((card, i) => {
      const r = wrap(i - s.current.pos, n);
      const a = Math.abs(r);
      const focus = smoothstep(clamp(1 - a));
      const scale = minS + (1 - minS) * focus;
      // Empacotamento exato: a distância entre bordas é sempre `gap`, mesmo no meio da troca.
      const dist = a * step + ((1 - scale) * W) / 2;
      const cx = anchor + Math.sign(r) * dist;
      const lift = (1 - focus) * (mobile ? 6 : 10);
      let opacity: number;
      if (mobile) opacity = clamp(1 - (a - 1) * 1.4);
      else if (r < 0) opacity = clamp(1 + r * 1.35);
      else {
        const overflow = cx + (scale * W) / 2 - cw;
        opacity = clamp(1 - overflow / (scale * W * 0.75));
      }
      card.style.transform = `translate3d(${(cx - W / 2).toFixed(2)}px,${lift.toFixed(2)}px,0) scale(${scale.toFixed(4)})`;
      card.style.opacity = opacity.toFixed(3);
      card.style.zIndex = String(Math.round(100 - a * 10));
      card.style.setProperty("--focus", focus.toFixed(3));
      card.style.visibility = opacity < 0.02 ? "hidden" : "visible";
      card.style.pointerEvents = opacity < 0.35 ? "none" : "";
      card.classList.toggle("is-active", Math.abs(wrap(i - s.current.target, n)) < 0.5);
    });
  }, [ref]);

  const animate = useCallback(() => {
    const st = s.current;
    cancelAnimationFrame(st.raf);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      st.pos = st.target;
      st.vel = 0;
      render();
      return;
    }
    st.last = performance.now();
    const tick = (now: number) => {
      let dt = Math.min(0.05, (now - st.last) / 1000);
      st.last = now;
      while (dt > 0) {
        const h = Math.min(dt, 1 / 120);
        const acc = -STIFFNESS * (st.pos - st.target) - DAMPING * st.vel;
        st.vel += acc * h;
        st.pos += st.vel * h;
        dt -= h;
      }
      if (Math.abs(st.pos - st.target) < 0.0005 && Math.abs(st.vel) < 0.002) {
        st.pos = st.target;
        st.vel = 0;
        render();
        return;
      }
      render();
      st.raf = requestAnimationFrame(tick);
    };
    st.raf = requestAnimationFrame(tick);
  }, [render]);

  const go = useCallback((delta: number) => {
    s.current.target = Math.round(s.current.target) + delta;
    animate();
  }, [animate]);

  const goTo = useCallback((index: number) => {
    const el = ref.current;
    const n = el?.children.length || 0;
    if (!n) return;
    s.current.target = Math.round(s.current.target) + Math.round(wrap(index - s.current.target, n));
    animate();
  }, [animate, ref]);

  const isActive = useCallback((index: number) => {
    const n = ref.current?.children.length || 0;
    return n > 0 && Math.abs(wrap(index - s.current.target, n)) < 0.5;
  }, [ref]);

  /** true quando o toque foi um arraste (o clique seguinte deve ser ignorado). */
  const consumeDrag = useCallback(() => {
    if (!s.current.suppressClick) return false;
    s.current.suppressClick = false;
    return true;
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || !count) return;
    const st = s.current;

    const measure = () => {
      const cards = Array.from(el.children) as HTMLElement[];
      cards.forEach(c => { c.style.height = "auto"; });
      const maxH = cards.reduce((m, c) => Math.max(m, c.offsetHeight), 0);
      cards.forEach(c => { c.style.height = `${maxH}px`; });
      el.style.height = `${maxH + 14}px`;
      render();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    const stepPx = () => {
      const first = el.children[0] as HTMLElement | undefined;
      const mobile = window.matchMedia(MOBILE_QUERY).matches;
      return (first?.offsetWidth || 220) * (mobile ? 0.86 : 0.84) + (mobile ? 12 : 16);
    };

    // Arraste com o dedo ou o mouse: o carrossel acompanha e depois assenta com a mola.
    let down: { x: number; y: number; pos: number; id: number } | null = null;
    let dragging = false;
    let lastX = 0, lastT = 0, v = 0;
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      down = { x: e.clientX, y: e.clientY, pos: st.pos, id: e.pointerId };
      dragging = false;
      lastX = e.clientX; lastT = performance.now(); v = 0;
    };
    const onMove = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!dragging) {
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) { down = null; return; }
        if (Math.abs(dx) < 7) return;
        dragging = true;
        cancelAnimationFrame(st.raf);
        down.pos = st.pos;
        down.x = e.clientX;
        el.setPointerCapture(e.pointerId);
        el.classList.add("is-dragging");
      }
      const now = performance.now();
      const step = stepPx();
      const inst = -((e.clientX - lastX) / step) / Math.max(0.001, (now - lastT) / 1000);
      v = v * 0.7 + inst * 0.3;
      lastX = e.clientX; lastT = now;
      st.pos = down.pos - (e.clientX - down.x) / step;
      st.target = st.pos;
      render();
    };
    const onUp = (e: PointerEvent) => {
      if (!down || e.pointerId !== down.id) return;
      if (dragging) {
        st.suppressClick = true;
        window.setTimeout(() => { st.suppressClick = false; }, 80);
        el.classList.remove("is-dragging");
        const fling = clamp(v * 0.22, -2.5, 2.5);
        st.vel = clamp(v, -12, 12);
        st.target = Math.round(st.pos + fling);
        animate();
      }
      down = null;
      dragging = false;
    };

    // Rolagem lateral do trackpad: acompanha o gesto e assenta no cartão mais próximo.
    let wheelTimer = 0;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      cancelAnimationFrame(st.raf);
      st.pos += e.deltaX / stepPx();
      st.target = st.pos;
      st.vel = 0;
      render();
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => { st.target = Math.round(st.pos); animate(); }, 110);
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      ro.disconnect();
      cancelAnimationFrame(st.raf);
      window.clearTimeout(wheelTimer);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }, [ref, count, render, animate]);

  return { go, goTo, isActive, consumeDrag };
}
