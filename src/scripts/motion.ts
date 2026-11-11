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

// Hora de Santiago en el pie (dato, no animación)
const clock = $('[data-clock]');
if (clock) {
  const fmt = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Santiago' });
  const tickClock = () => (clock.textContent = fmt.format(new Date()));
  tickClock();
  window.setInterval(tickClock, 20000);
}

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
      // El chip del titular se abre de izquierda a derecha, como una cortina
      .fromTo('[data-chip]', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)', duration: 1.3, ease: 'expo.inOut', clearProps: 'clipPath' }, 0.95)
      // El corte: la línea diagonal de luz se traza detrás del emblema
      .fromTo('[data-stage-cut]', { scaleX: 0, opacity: 0 }, { scaleX: 1, opacity: 0.85, duration: 1.6, ease: 'expo.inOut' }, 0.8);
  }

  // Chip del titular: el motion real del caso se carga solo en escritorio y tras el `load` (no compite con el LCP).
  // En móvil y con movimiento reducido queda el póster estático.
  const chipVideo = $<HTMLVideoElement>('[data-chip-video]');
  if (chipVideo && finePointer && window.innerWidth >= 900) {
    const startChip = () => {
      chipVideo.src = chipVideo.dataset.src ?? '';
      chipVideo.addEventListener('playing', () => chipVideo.classList.add('is-on'), { once: true });
      chipVideo.play().catch(() => {});
      new IntersectionObserver(([e]) => (e.isIntersecting ? chipVideo.play().catch(() => {}) : chipVideo.pause())).observe(chipVideo);
    };
    if (document.readyState === 'complete') startChip();
    else window.addEventListener('load', startChip, { once: true });
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

  // Destello metálico de la palabra clave: una vez cada ~9 s, solo con puntero fino (en táctil queda estático)
  const mqCleanupEarly: Array<() => void> = [];
  const accentWord = $('.hero__title .accent');
  if (accentWord && finePointer) {
    const flash = () => {
      accentWord.classList.remove('shine');
      void accentWord.offsetWidth;
      accentWord.classList.add('shine');
    };
    const shineTl = gsap.timeline({ delay: 3.4, repeat: -1, repeatDelay: 7 }).call(flash);
    mqCleanupEarly.push(() => shineTl.kill());
  }

  // Salida del hero por capas: cada línea del titular sube a distinta velocidad y el resto se apaga.
  // `immediateRender: false` para no pisar la animación de entrada (los valores iniciales se leen al empezar el scroll).
  const exitST = { trigger: '.hero', start: 'top top', end: '75% top', scrub: 0.5 } as const;
  heroLines.forEach((line, i) => {
    gsap.fromTo(line, { y: 0 }, { y: -(40 + i * 45), ease: 'none', immediateRender: false, scrollTrigger: exitST });
  });
  gsap.fromTo(
    ['.hero .kicker', '.hero__lead', '.hero__actions'].map((s) => $(s)).filter(Boolean),
    { opacity: 1, y: 0 },
    { opacity: 0.1, y: -60, ease: 'none', immediateRender: false, scrollTrigger: exitST },
  );

  // Cinta gigante: corre sola, se acelera con la velocidad del scroll y cambia de sentido con él
  const mq = $('[data-marquee]');
  const mqTrack = $('[data-marquee-track]');
  const mqCleanup: Array<() => void> = [];
  if (mq && mqTrack) {
    const loop = gsap.to(mqTrack, { xPercent: -50, repeat: -1, duration: 40, ease: 'none' });
    let target = 1;
    let cur = 1;
    let dir = 1;
    const st = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: (self) => {
        dir = self.direction || dir;
        target = dir * (1 + Math.min(6, Math.abs(self.getVelocity()) / 350));
      },
    });
    const step = () => {
      target += (dir - target) * 0.04; // vuelve a la velocidad base
      cur += (target - cur) * 0.08;
      loop.timeScale(cur);
    };
    gsap.ticker.add(step);
    const io = new IntersectionObserver(([e]) => loop.paused(!e.isIntersecting));
    io.observe(mq);
    mqCleanup.push(() => {
      gsap.ticker.remove(step);
      io.disconnect();
      st.kill();
      loop.kill();
      gsap.set(mqTrack, { clearProps: 'transform' });
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
    mqCleanup.forEach((fn) => fn());
    mqCleanupEarly.forEach((fn) => fn());
    gsap.ticker.remove(tick);
    lenis.destroy();
  };
});

mm.add('(prefers-reduced-motion: no-preference)', () => {
  // Titulares que se "encienden" palabra por palabra con el scroll (manifiesto y cierre)
  $$('[data-scrub-words]').forEach((manifesto) => {
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
  });

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
  const desktopMotion = window.matchMedia('(min-width: 900px)').matches; // ahí el Método se fija (ver más abajo)
  if (methodList && methodFill && !desktopMotion) {
    gsap.to(methodFill, {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: methodList, start: 'top 60%', end: 'bottom 60%', scrub: 0.3 },
    });
  }
  if (!desktopMotion) {
    $$('[data-step]').forEach((step) => {
      gsap.fromTo(
        $$('.step__icon, .step__head, .step__body', step),
        { autoAlpha: 0, y: 36 },
        { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: step, start: 'top 85%', once: true } },
      );
    });
  }

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

  // Equipo: palabra gigante que se desliza, tarjetas con parallax opuesto, nombres que suben de su máscara
  const teamSec = $('#equipo');
  if (teamSec) {
    const tGhost = $('[data-team-ghost]', teamSec);
    const sec = { trigger: teamSec, start: 'top bottom', end: 'bottom top', scrub: true } as const;
    if (tGhost) gsap.fromTo(tGhost, { xPercent: 6 }, { xPercent: -26, ease: 'none', scrollTrigger: sec });
    $$('[data-person]', teamSec).forEach((p, i) => {
      gsap.fromTo(p, { yPercent: i % 2 ? 7 : -5 }, { yPercent: i % 2 ? -7 : 5, ease: 'none', scrollTrigger: sec });
      const name = $('[data-person-name]', p);
      if (name) {
        gsap.fromTo(name, { yPercent: 115 }, { yPercent: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: p, start: 'top 80%', once: true } });
      }
      // Inclinación 3D suave hacia el cursor (solo puntero fino)
      const frame = $('.person__frame', p);
      if (finePointer && frame) {
        const rx = gsap.quickTo(frame, 'rotationX', { duration: 0.7, ease: 'power3.out' });
        const ry = gsap.quickTo(frame, 'rotationY', { duration: 0.7, ease: 'power3.out' });
        p.addEventListener('pointermove', (e) => {
          const r = frame.getBoundingClientRect();
          const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
          const ny = ((e.clientY - r.top) / r.height) * 2 - 1;
          ry(Math.max(-1, Math.min(1, nx)) * 9);
          rx(-Math.max(-1, Math.min(1, ny)) * 9);
          frame.style.setProperty('--gx', `${((e.clientX - r.left) / r.width) * 100}%`);
          frame.style.setProperty('--gy', `${((e.clientY - r.top) / r.height) * 100}%`);
        });
        p.addEventListener('pointerleave', () => {
          rx(0);
          ry(0);
        });
      }
    });
  }

  // Cierre: el emblema de fondo gira lento y sube; la línea diagonal se traza; el logotipo del pie se revela
  const closing = $('#contacto');
  const mark = $('[data-closing-mark]');
  if (closing && mark) {
    gsap.fromTo(mark, { rotate: -24, yPercent: 14 }, { rotate: 12, yPercent: -10, ease: 'none', scrollTrigger: { trigger: closing, start: 'top bottom', end: 'bottom top', scrub: true } });
  }
  const cutLine = $('[data-closing-cut]');
  if (closing && cutLine) {
    gsap.fromTo(cutLine, { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: closing, start: 'top 75%', end: 'top 20%', scrub: true } });
  }
  const wordmark = $('[data-wordmark]');
  if (wordmark) {
    gsap.fromTo(
      wordmark,
      { clipPath: 'inset(100% 0 0 0)', yPercent: 18 },
      { clipPath: 'inset(0% 0 0 0)', yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top 95%', end: 'top 45%', scrub: true } },
    );
  }

  // Borde de luz que sigue al cursor sobre el formulario (solo puntero fino)
  if (finePointer) {
    $$('.diag, .diag__done').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', `${e.clientX - r.left}px`);
        card.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

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
      refreshPriority: 3, // los efectos fijados se calculan primero (en orden de página): lo demás debe medir ya con su espacio añadido
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

// Método (escritorio, con movimiento): la sección se fija y los cuatro pasos se suceden uno a uno con el scroll.
// En celular o con "reducir movimiento" queda la lista vertical con su línea de progreso.
mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
  const stage = $('[data-method-stage]');
  if (!stage) return;
  const steps = $$('.step', stage);
  const ticks = $$('li', $('[data-method-ticks]', stage) ?? stage);
  const ghost = $('[data-method-ghost]', stage);
  if (steps.length < 2) return;

  stage.classList.add('is-pinned');
  let active = -1;
  const setActive = (i: number) => {
    if (i === active) return;
    active = i;
    steps.forEach((s, idx) => s.classList.toggle('is-active', idx === i));
    ticks.forEach((t, idx) => t.classList.toggle('is-on', idx <= i));
    if (ghost) ghost.textContent = String(i + 1).padStart(2, '0');
  };
  setActive(0);

  const len = () => window.innerHeight * 0.85 * (steps.length - 1) + window.innerHeight * 0.3;
  ScrollTrigger.create({
    trigger: stage,
    start: 'top top',
    end: () => `+=${len()}`,
    pin: true,
    refreshPriority: 2, // después del fijado de Proyectos (que está más arriba) y antes de todo lo que viene debajo
    anticipatePin: 1,
    invalidateOnRefresh: true,
    onToggle: (self) => $('[data-chapters]')?.classList.toggle('is-away', self.isActive),
    onUpdate: (self) => {
      stage.style.setProperty('--p', String(Math.max(0.04, self.progress)));
      setActive(Math.min(steps.length - 1, Math.floor(self.progress * steps.length)));
    },
  });
  requestAnimationFrame(() => ScrollTrigger.refresh());

  return () => {
    $('[data-chapters]')?.classList.remove('is-away');
    stage.classList.remove('is-pinned');
    stage.style.removeProperty('--p');
    steps.forEach((s) => s.classList.remove('is-active'));
    ticks.forEach((t) => t.classList.remove('is-on'));
  };
});
