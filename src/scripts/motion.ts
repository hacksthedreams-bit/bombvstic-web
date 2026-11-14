import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './track';

gsap.registerPlugin(ScrollTrigger);
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));

const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Siempre se abre arriba (salvo que llegue con #ancla): evita que el scroll restaurado desincronice las animaciones
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
if (!location.hash) window.scrollTo(0, 0);

/* ───── Siempre activo, con o sin animaciones ───── */

// Scroll suave (solo existe con movimiento permitido). El menú lo detiene y lo reanuda; sin él, todo funciona igual.
let lenisRef: Lenis | null = null;

// Anclas internas: el foco viaja con el desplazamiento (WCAG 2.4.3). Un solo manejador, para Lenis y para movimiento reducido.
// Si Lenis ya hizo `preventDefault` (ruta animada), aquí se actualiza el hash; si no, el salto nativo ya lo hizo.
const focusTarget = (el: HTMLElement) => {
  if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
  el.setAttribute('data-focus-target', '');
  el.focus({ preventScroll: true });
};
document.addEventListener('click', (e) => {
  const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
  const id = a?.getAttribute('href');
  if (!a || !id || id.length < 2 || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const target = document.getElementById(decodeURIComponent(id.slice(1)));
  if (!target) return;
  focusTarget(target);
  if (e.defaultPrevented) history.replaceState(null, '', id);
});

// Menú móvil (<details>): se cierra al elegir un enlace, con Esc (devuelve el foco al botón) o con clic fuera.
// El traslado de foco al destino lo hace el manejador de anclas de arriba; aquí solo se cierra.
// Con este script activo el menú pasa a pantalla completa (ficha 203): `html.menu-full`. Sin el script queda el desplegable.
const menu = $<HTMLDetailsElement>('[data-menu]');
const menuBtn = menu ? $<HTMLElement>('summary', menu) : null;
if (menu) {
  const root = document.documentElement;
  root.classList.add('menu-full');
  let isOpen = false;
  // Idempotente y síncrono: abre/cierra, deja inerte el resto de la página y bloquea el desplazamiento del fondo.
  const setMenu = (open: boolean) => {
    if (menu.open !== open) menu.open = open;
    if (isOpen === open) return;
    isOpen = open;
    root.classList.toggle('menu-open', open);
    $$('main, .footer, [data-chapters], [data-dock], [data-cutthumb], .skip-link').forEach((el) => el.toggleAttribute('inert', open));
    if (open) lenisRef?.stop();
    else lenisRef?.start();
  };
  menu.addEventListener('toggle', () => setMenu(menu.open)); // el clic nativo en el botón solo se sincroniza aquí
  // En fase de CAPTURA: al elegir un enlace hay que soltar la página (inert, scroll, Lenis) ANTES de que corran el manejador
  // de Lenis del ancla y el de foco; si no, el menú se cerraría y la página no viajaría.
  document.addEventListener(
    'click',
    (e) => {
      if (menu.open && (e.target as Element | null)?.closest('.nav__panel a')) setMenu(false);
    },
    true,
  );
  document.addEventListener('click', (e) => {
    if (menu.open && !menu.contains(e.target as Node)) setMenu(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.open) {
      setMenu(false);
      menuBtn?.focus();
    }
  });
  // Si la ventana se ensancha hasta mostrar los enlaces en línea, el menú se cierra (la página no puede quedar inerte)
  window.matchMedia('(min-width: 1080px)').addEventListener('change', (e) => e.matches && setMenu(false));
}

// Pastilla "Agendar diagnóstico" (solo celular): aparece cuando el botón del hero ya salió POR ARRIBA (no por estar bajo el
// pliegue), y se oculta en el cierre, en el pie y con el menú abierto. "Agendar" de la barra cede su lugar la primera vez.
const dock = $('[data-dock]');
const heroCta = $('[data-hero-cta]');
if (dock && heroCta && 'IntersectionObserver' in window) {
  const root = document.documentElement;
  let leftAbove = false;
  let inEnd = false;
  const sync = () => {
    const on = leftAbove && !inEnd && !menu?.open;
    dock.classList.toggle('is-shown', on);
    root.classList.toggle('dock-on', on);
    if (on) root.classList.add('has-dock');
  };
  new IntersectionObserver(([e]) => {
    leftAbove = !e.isIntersecting && e.boundingClientRect.bottom < 0;
    sync();
  }).observe(heroCta);
  const endIo = new IntersectionObserver((entries) => {
    entries.forEach((e) => ((e.target as HTMLElement).dataset.in = e.isIntersecting ? '1' : ''));
    inEnd = $$('#contacto, .footer').some((el) => el.dataset.in === '1');
    sync();
  });
  $$('#contacto, .footer').forEach((el) => endIo.observe(el));
  menu?.addEventListener('toggle', sync);
}

// El corte en los botones (ficha 202), versión táctil: sin cursor, el filo cruza cada botón principal UNA vez por carga,
// cuando llega a la zona central de la pantalla. Fuera quedan el botón del hero (ya visible al cargar), la pastilla y el menú.
if (!finePointer && 'IntersectionObserver' in window && window.matchMedia('(prefers-reduced-motion: no-preference)').matches) {
  const cutIo = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-cut');
        cutIo.unobserve(e.target);
      }),
    { rootMargin: '-35% 0px -35% 0px' },
  );
  $$('main .btn--primary:not([data-hero-cta])').forEach((el) => cutIo.observe(el));
}

// Franja de datos medidos: si la medición envejeció (> 120 días) deja de mostrarse, aunque nadie vuelva a construir el sitio
const factsEl = $('[data-measured]');
if (factsEl) {
  const days = (Date.now() - new Date(`${factsEl.dataset.measured}T12:00:00`).getTime()) / 86400000;
  if (!(days >= 0 && days <= 120)) factsEl.hidden = true;
}

// Navegación compacta al bajar + hilo de progreso de lectura (indicador, no animación decorativa)
const nav = $('[data-nav]');
const thumb = $('[data-cutthumb]');
const syncNav = () => {
  nav?.classList.toggle('is-scrolled', window.scrollY > 24);
  if (thumb) {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    thumb.style.setProperty('--p', String(max > 0 ? Math.min(1, window.scrollY / max) : 0)); // solo variable: nada se deforma
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
  if (thumb && thumb.dataset.now !== id) {
    thumb.dataset.now = id ?? '';
    thumb.classList.remove('is-pulse'); // pulso breve de la punta al cambiar de capítulo (coincide con el fundido de color)
    void thumb.offsetWidth;
    thumb.classList.add('is-pulse');
  }
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
  lenisRef = lenis;
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
    // 404: el escenario ya está pintado (a 0,94 por CSS): solo asienta; nunca parte de invisible
    tl.fromTo(stage, { scale: 0.94 }, { scale: 1, duration: 1.6 }, 0)
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

  // Cursor propio (ficha 201). Una sola pieza: el punto ES la posición real del puntero (sin retraso) y el trazo a −31° sale de él;
  // la inercia va solo en el largo del trazo. Vuelve el cursor del sistema en formularios, menú, selección de texto, teclado,
  // toque, fuera de la ventana y si el equipo no da la fluidez (dos cuadros seguidos > 100 ms: apagado por toda la visita).
  const curOff = () => {
    try {
      return sessionStorage.getItem('bv-cur') === 'off';
    } catch {
      return false;
    }
  };
  if (finePointer && !window.matchMedia('(forced-colors: active), (prefers-contrast: more)').matches && !curOff()) {
    const root = document.documentElement;
    const cur = document.createElement('div');
    cur.className = 'cur';
    cur.setAttribute('aria-hidden', 'true');
    const tail = document.createElement('i');
    tail.className = 'cur__tail';
    cur.appendChild(tail);
    document.body.appendChild(cur);
    const LEN = { text: 14 / 52, rest: 26 / 52, link: 1 }; // tres largos: 14, 26 y 52 px
    gsap.set(tail, { rotation: -31, scaleX: LEN.rest, transformOrigin: '100% 50%' });
    const toLen = gsap.quickTo(tail, 'scaleX', { duration: 0.35, ease: 'power3.out' });
    const NATIVE = 'input, textarea, select, [contenteditable], [data-diag], .diag__done, .nav__panel, iframe';
    const LINK = 'a, button, summary, label, [role="button"], [data-chip]';
    const TEXT = 'p, h1, h2, h3, h4, li, dd, dt, blockquote, figcaption';
    let base = LEN.rest;
    let ready = false; // se habilita al terminar la entrada del hero
    let moved = false;
    let native = false;
    let keyboard = false;
    let selecting = false;
    let dead = false;
    let active = false;
    let lx = 0;
    let ly = 0;
    let rest = 0;
    let rafId = 0;
    let slow = 0;
    let last = 0;
    let movedAt = 0;
    const watch = (t: number) => {
      // vigilancia de fluidez: solo mientras el cursor propio está activo y la pestaña visible
      // Solo cuenta mientras el ratón se está moviendo (ahí se notaría el desfase); un salto de página largo no lo apaga
      if (last && !document.hidden && t - movedAt < 300) slow = t - last > 100 ? slow + 1 : 0;
      else slow = 0;
      last = t;
      if (slow >= 2) {
        dead = true;
        try {
          sessionStorage.setItem('bv-cur', 'off');
        } catch {
          /* sin almacenamiento: queda apagado solo en esta carga */
        }
        sync();
        return;
      }
      rafId = requestAnimationFrame(watch);
    };
    const sync = () => {
      const on = ready && moved && !native && !keyboard && !selecting && !dead;
      if (on === active) return;
      active = on;
      cur.classList.toggle('is-on', on);
      root.classList.toggle('cut-cursor', on);
      cancelAnimationFrame(rafId);
      last = 0;
      slow = 0;
      if (on) rafId = requestAnimationFrame(watch);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      cur.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
      const d = Math.hypot(e.clientX - lx, e.clientY - ly);
      lx = e.clientX;
      ly = e.clientY;
      keyboard = false;
      movedAt = performance.now();
      if (!moved) {
        moved = true;
        d0(e.target as Element | null);
      }
      toLen(Math.min(1, base + d / 60)); // al mover rápido el trazo se estira; al parar vuelve a su largo
      window.clearTimeout(rest);
      rest = window.setTimeout(() => toLen(base), 90);
      sync();
    };
    const d0 = (t: Element | null) => {
      native = !!t?.closest(NATIVE);
      const link = !native && !!t?.closest(LINK);
      const text = !native && !link && !!t?.closest(TEXT);
      base = link ? LEN.link : text ? LEN.text : LEN.rest;
      cur.classList.toggle('is-text', text);
      toLen(base);
    };
    const onOver = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      d0(e.target as Element | null);
      sync();
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') {
        moved = false; // toque o lápiz: fuera hasta el próximo movimiento de ratón
        sync();
        return;
      }
      toLen(base * 0.6);
      window.clearTimeout(rest);
      rest = window.setTimeout(() => toLen(base), 140);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      keyboard = true;
      sync();
    };
    const onLeave = () => {
      moved = false;
      sync();
    };
    const onSel = () => {
      selecting = !(document.getSelection()?.isCollapsed ?? true);
      sync();
    };
    const enable = gsap.delayedCall(2.6, () => {
      ready = true;
      sync();
    });
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerover', onOver, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('keydown', onKey);
    document.documentElement.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);
    document.addEventListener('selectionchange', onSel);
    cleanups.push(() => {
      enable.kill();
      cancelAnimationFrame(rafId);
      window.clearTimeout(rest);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerover', onOver);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      document.documentElement.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('selectionchange', onSel);
      root.classList.remove('cut-cursor');
      cur.remove();
    });
  }

  // Limpieza si la persona activa "reducir movimiento" mientras navega
  return () => {
    cleanups.forEach((fn) => fn());
    mqCleanup.forEach((fn) => fn());
    mqCleanupEarly.forEach((fn) => fn());
    gsap.ticker.remove(tick);
    lenisRef = null;
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
      const leave = () => gsap.to(btn, { x: 0, y: 0, duration: 0.7, ease: 'expo.out', overwrite: 'auto' }); // sin rebote (ficha 104)
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

// El riel lateral se aparta también ANTES de que la galería de Proyectos se fije y DESPUÉS de soltarla (mientras la galería ocupa
// la pantalla al entrar y al salir, el riel quedaba sobre las imágenes). Es un disparador común, no un pin; se crea al final, en orden.
mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
  const stage = $('[data-stories-stage]');
  const rail = $('[data-chapters]');
  if (!stage || !rail) return;
  const pin = ScrollTrigger.getAll().find((st) => st.pin === stage);
  if (!pin) return;
  const near = ScrollTrigger.create({
    start: () => pin.start - window.innerHeight * 0.9,
    end: () => pin.end + window.innerHeight * 0.9,
    invalidateOnRefresh: true,
    onToggle: (self) => rail.classList.toggle('is-near', self.isActive),
  });
  return () => {
    near.kill();
    rail.classList.remove('is-near');
  };
});
