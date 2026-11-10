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

// Navegación compacta al bajar + hilo de progreso de lectura (indicador, no animación decorativa)
const nav = $('[data-nav]');
const progress = $('[data-progress]');
const syncNav = () => {
  nav?.classList.toggle('is-scrolled', window.scrollY > 24);
  if (progress) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  }
};
syncNav();
window.addEventListener('scroll', syncNav, { passive: true });
window.addEventListener('resize', syncNav, { passive: true });

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
      .fromTo(heroItems.slice(1), { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1 }, 1.0)
      // El corte: la línea diagonal de luz se traza detrás del emblema
      .fromTo('[data-stage-cut]', { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 0.85, duration: 1.6, ease: 'expo.inOut' }, 0.8);
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
    gsap.to([emblem, $('.stage__light'), $('[data-stage-cut]')], {
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
    // El emblema se inclina suavemente hacia el cursor (±7°), como un objeto sobre un pedestal
    const tiltEl = $('[data-tilt]');
    const tiltY = tiltEl ? gsap.quickTo(tiltEl, 'rotationY', { duration: 0.9, ease: 'power3.out' }) : null;
    const tiltX = tiltEl ? gsap.quickTo(tiltEl, 'rotationX', { duration: 0.9, ease: 'power3.out' }) : null;
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width) * 100;
      target.y = ((e.clientY - r.top) / r.height) * 100;
      const nx = Math.max(-1, Math.min(1, (target.x - 50) / 50));
      const ny = Math.max(-1, Math.min(1, (target.y - 50) / 50));
      tiltY?.(nx * 7);
      tiltX?.(-ny * 7);
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
      // "apagado" pero legible (contraste ≥ 3:1 en texto grande); la palabra lavanda es más clara, necesita partir más alto
      { opacity: (_i: number, el: Element) => (el.classList.contains('accent') ? 0.72 : 0.42) },
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
    // En escritorio las tarjetas forman un mazo que se apila (ver más abajo); la entrada en lote es para celular y tableta
    if (!window.matchMedia('(min-width: 900px)').matches) {
      gsap.set(svcCards, { autoAlpha: 0, y: 90 });
      ScrollTrigger.batch(svcCards, {
        start: 'top 90%',
        once: true,
        onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 1.2, stagger: 0.14, ease: 'expo.out' }),
      });
    }
    svcCards.forEach((card) => {
      const pic = $('[data-svc-pic]', card);
      if (!pic) return;
      gsap.fromTo(pic, { yPercent: -3 }, { yPercent: 3, ease: 'none', scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
  }

  // Proyectos: parallax suave de la foto dentro de su marco
  $$('.feature__media img').forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -3.5, scale: 1.07 },
      { yPercent: 3.5, scale: 1.07, ease: 'none', scrollTrigger: { trigger: img.closest('.feature__media'), start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  });

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

  // Muro de servicios: la fila que cruza el centro de la pantalla se enciende; el resto baja de volumen
  const wallEl = $('.wall');
  if (wallEl) {
    wallEl.classList.add('has-spot');
    $$('[data-row]', wallEl).forEach((row) => {
      ScrollTrigger.create({ trigger: row, start: 'top 57%', end: 'bottom 43%', toggleClass: { targets: row, className: 'is-center' } });
    });
  }

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

// Servicios (escritorio, con movimiento): mazo de tarjetas. Cada una queda fija arriba y la siguiente la cubre,
// mientras la anterior se hunde (escala y oscurece). En celular o con "reducir movimiento" son tarjetas normales.
mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
  const grid = $('.svc-grid');
  const cards = $$('[data-svc]');
  if (!grid || cards.length < 2) return;
  grid.classList.add('is-deck');
  const faces = cards.map((s) => $('.svc__card', s)!);
  cards.forEach((_, i) => {
    const next = cards[i + 1];
    if (!next) return;
    gsap.to(faces[i], {
      scale: 0.93,
      '--dim': 0.6,
      ease: 'none',
      scrollTrigger: { trigger: next, start: 'top 80%', end: 'top 22%', scrub: true },
    });
  });
  requestAnimationFrame(() => ScrollTrigger.refresh());
  return () => {
    grid.classList.remove('is-deck');
    gsap.set(faces, { clearProps: 'transform,--dim' });
  };
});

// Proyectos (escritorio, con movimiento): la galería se fija y las historias se deslizan mientras bajas.
// En celular o con "reducir movimiento" queda como carrusel con snap (o rejilla), sin fijar nada.
mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
  const stage = $('[data-stories-stage]');
  const track = $('[data-stories]');
  if (!stage || !track) return;
  const ghost = $('[data-ghost]');
  const bar = $('[data-hud-bar]');
  const count = $('[data-hud-count]');
  const stories = $$('.story', track);

  stage.classList.add('is-pinned');
  const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);

  gsap.to(track, {
    x: () => -dist(),
    ease: 'none',
    scrollTrigger: {
      trigger: stage,
      start: 'top top',
      end: () => `+=${dist() * 1.6}`, // un poco más de recorrido que de desplazamiento: el scroll "pesa" y se saborea
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
      // Mientras la galería ocupa toda la pantalla, el índice lateral se aparta para no cruzarse con las tarjetas
      onToggle: (self) => $('[data-chapters]')?.classList.toggle('is-away', self.isActive),
      onUpdate: (self) => {
        if (bar) bar.style.transform = `scaleX(${Math.max(0.04, self.progress)})`;
        if (count) count.textContent = String(1 + Math.round(self.progress * (stories.length - 1))).padStart(2, '0');
      },
    },
  });
  if (ghost) {
    gsap.to(ghost, {
      x: () => -dist() * 0.4,
      ease: 'none',
      scrollTrigger: { trigger: stage, start: 'top top', end: () => `+=${dist() * 1.6}`, scrub: true, invalidateOnRefresh: true },
    });
  }
  // El pin altera las posiciones de lo que viene después: recalcular
  requestAnimationFrame(() => ScrollTrigger.refresh());

  return () => {
    $('[data-chapters]')?.classList.remove('is-away');
    stage.classList.remove('is-pinned');
    gsap.set([track, ghost], { clearProps: 'transform' });
    if (bar) bar.style.transform = '';
  };
});
