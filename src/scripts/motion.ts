import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Siempre se abre arriba (salvo que llegue con #ancla): evita que el scroll restaurado desincronice las animaciones
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) window.scrollTo(0, 0);

/* ───── Siempre activo, con o sin animaciones ───── */

// Navegación compacta al bajar
const nav = $('[data-nav]');
const syncNav = () => nav?.classList.toggle('is-scrolled', window.scrollY > 24);
syncNav();
window.addEventListener('scroll', syncNav, { passive: true });

// Capítulos y atmósfera: qué sección está en pantalla
const chapterLinks = $$<HTMLAnchorElement>('[data-chapter]');
const atmoLayers = $$('[data-atmo]');
const setAtmo = (name: string | undefined) => {
  if (!name) return;
  atmoLayers.forEach((l) => l.classList.toggle('is-on', l.dataset.atmo === name));
};
const setChapter = (id: string | undefined) => {
  chapterLinks.forEach((a) => {
    const on = a.dataset.chapter === id;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'true');
    else a.removeAttribute('aria-current');
  });
};
$$('[data-section]').forEach((section) => {
  ScrollTrigger.create({
    trigger: section,
    start: 'top 55%',
    end: 'bottom 55%',
    onToggle: (self) => {
      if (!self.isActive) return;
      setChapter(section.dataset.section);
      setAtmo(section.dataset.atmoOn);
    },
  });
});

// Reposo → acción en pantallas táctiles: la tarjeta que llega al centro se "enciende"
if (!finePointer && 'IntersectionObserver' in window) {
  const live = new IntersectionObserver(
    (entries) => entries.forEach((e) => e.target.classList.toggle('is-live', e.isIntersecting)),
    { rootMargin: '-38% 0px -38% 0px' },
  );
  $$('[data-svc]').forEach((el) => live.observe(el));
}

// Método: cada paso se "enciende" al llegar a la línea del 60 % de la pantalla y se queda encendido
if ('IntersectionObserver' in window) {
  const steps = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        const reached = e.isIntersecting || e.boundingClientRect.top < 0;
        e.target.classList.toggle('is-done', reached);
      }),
    { rootMargin: '0px 0px -40% 0px' },
  );
  $$('[data-step]').forEach((el) => steps.observe(el));
}

/* ───── Solo con movimiento permitido ───── */
const mm = gsap.matchMedia();

mm.add('(prefers-reduced-motion: no-preference)', () => {
  // Scroll suave: el visitante conserva el control
  const lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  window.addEventListener('load', () => ScrollTrigger.refresh(), { once: true });
  const tick = (t: number) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);

  $$<HTMLAnchorElement>('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      const target = id && id.length > 1 ? $(id) : null;
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -56, duration: 1.4 });
    });
  });

  // Entrada del hero
  const heroLines = $$('[data-hero-title] .line > span');
  const heroItems = $$('.hero [data-reveal]');
  const stage = $('[data-stage]');
  if (stage) {
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 });
    tl.fromTo(stage, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 1.6 }, 0)
      .fromTo(heroItems.slice(0, 1), { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.2)
      .fromTo(heroLines, { yPercent: 115, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.2, stagger: 0.12 }, 0.35)
      .fromTo(heroItems.slice(1), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1 }, 1.0);
  }

  // El emblema responde al scroll: gira y se desvanece hacia la siguiente sección
  const emblem = $('[data-emblem]');
  if (emblem) {
    gsap.to(emblem, {
      rotate: -9,
      scale: 1.16,
      yPercent: -6,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.6 },
    });
    // La opacidad del contenedor la controla la entrada; el desvanecido por scroll va en los hijos
    gsap.to([emblem, $('.stage__light')], {
      opacity: 0.12,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: '55% top', end: 'bottom top', scrub: true },
    });
  }

  // Luz violeta que sigue al cursor sobre el metal
  const cleanups: Array<() => void> = [];
  if (finePointer && stage) {
    // El halo vive en una caja 2,2× el escenario: el 0–100 % del escenario equivale a 27,3–72,7 % de esa caja
    const toBox = (stagePct: number) => 27.27 + Math.min(100, Math.max(0, stagePct)) * 0.4545;
    const target = { x: 50, y: 45 };
    const cur = { x: 50, y: 45 };
    let raf = 0;
    const loop = () => {
      cur.x += (target.x - cur.x) * 0.08;
      cur.y += (target.y - cur.y) * 0.08;
      stage.style.setProperty('--mx', `${toBox(cur.x)}%`);
      stage.style.setProperty('--my', `${toBox(cur.y)}%`);
      raf = requestAnimationFrame(loop);
    };
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width) * 100;
      target.y = ((e.clientY - r.top) / r.height) * 100;
    };
    const io = new IntersectionObserver(([entry]) => {
      cancelAnimationFrame(raf);
      if (entry.isIntersecting) raf = requestAnimationFrame(loop);
    });
    io.observe(stage);
    window.addEventListener('pointermove', onMove, { passive: true });
    cleanups.push(() => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
    });
  }

  // Limpieza si la persona activa "reducir movimiento" mientras navega
  return () => {
    cleanups.forEach((fn) => fn());
    gsap.ticker.remove(tick);
    lenis.destroy();
  };
});

mm.add('(prefers-reduced-motion: no-preference)', () => {
  const manifesto = $('[data-manifesto]');
  if (manifesto) {
    const words: HTMLElement[] = [];
    const walk = (node: Node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === Node.TEXT_NODE) {
          const parts = (child.textContent ?? '').split(/(\s+)/);
          const frag = document.createDocumentFragment();
          parts.forEach((p) => {
            if (!p) return;
            if (/^\s+$/.test(p)) {
              frag.appendChild(document.createTextNode(' '));
              return;
            }
            const span = document.createElement('span');
            span.className = 'w';
            span.textContent = p;
            words.push(span);
            frag.appendChild(span);
          });
          child.replaceWith(frag);
        } else if (child instanceof HTMLElement && child.classList.contains('accent')) {
          child.classList.add('w');
          words.push(child);
        } else {
          walk(child);
        }
      });
    };
    walk(manifesto);
    gsap.fromTo(
      words,
      { opacity: 0.16 },
      {
        opacity: 1,
        ease: 'none',
        stagger: 0.12,
        scrollTrigger: { trigger: manifesto, start: 'top 78%', end: 'bottom 48%', scrub: 0.4 },
      },
    );
  }

  // Revelados al entrar en pantalla (todo lo que no es del hero)
  $$('[data-reveal]:not(.hero [data-reveal])').forEach((el) => {
    gsap.fromTo(
      el,
      { autoAlpha: 0, y: 24 },
      { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } },
    );
  });

  // Servicios: las tarjetas entran en grupo; la imagen tiene un paralaje suave
  const svcCards = $$('[data-svc]');
  if (svcCards.length) {
    gsap.set(svcCards, { autoAlpha: 0, y: 90 });
    ScrollTrigger.batch(svcCards, {
      start: 'top 90%',
      once: true,
      onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.14, ease: 'expo.out' }),
    });
    svcCards.forEach((card) => {
      const pic = $('[data-svc-pic]', card);
      if (!pic) return;
      gsap.fromTo(pic, { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  // Proyectos: la pieza se revela con el corte diagonal (el gesto de la marca)
  $$('[data-cut-reveal]').forEach((el) => {
    gsap.fromTo(
      el,
      { clipPath: 'polygon(0% 0%, 0% 0%, -22% 100%, 0% 100%)' },
      {
        clipPath: 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)',
        duration: 1.5,
        ease: 'expo.inOut',
        clearProps: 'clipPath',
        scrollTrigger: { trigger: el, start: 'top 82%', once: true },
      },
    );
  });

  // Método: la línea violeta se dibuja con el scroll; cada paso entra al aparecer
  const methodList = $('[data-method]');
  const methodFill = $('[data-method-fill]');
  if (methodList && methodFill) {
    gsap.to(methodFill, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: methodList, start: 'top 60%', end: 'bottom 60%', scrub: 0.3 },
    });
  }
  $$('[data-step]').forEach((step) => {
    gsap.fromTo(
      $$('.step__icon, .step__head, .step__body', step),
      { autoAlpha: 0, y: 36 },
      { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: step, start: 'top 85%', once: true } },
    );
  });

  // Muro de servicios: cada fila entra al aparecer
  $$('[data-row]').forEach((row) => {
    gsap.fromTo(
      row,
      { autoAlpha: 0, y: 28 },
      { autoAlpha: 1, y: 0, duration: 0.9, ease: 'expo.out', scrollTrigger: { trigger: row, start: 'top 93%', once: true } },
    );
  });

  // Botón magnético (solo con puntero fino)
  if (finePointer) {
    $$('[data-magnetic]').forEach((btn) => {
      const move = (e: PointerEvent) => {
        const r = btn.getBoundingClientRect();
        gsap.to(btn, { x: (e.clientX - (r.left + r.width / 2)) * 0.25, y: (e.clientY - (r.top + r.height / 2)) * 0.35, duration: 0.4, ease: 'power2.out' });
      };
      const leave = () => gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      btn.addEventListener('pointermove', move);
      btn.addEventListener('pointerleave', leave);
    });
  }
});
