// Datos MEDIDOS de esta misma web (ficha 004). Regla: nunca estimados, siempre con fecha y con la URL donde se midieron.
//  - Se rellenan DESPUÉS de desplegar, con tools/verify/measure-live.mjs sobre la URL pública (5 corridas, mediana).
//  - La franja de index.astro solo se muestra si: el host de `Astro.site` coincide con el de `measuredUrl`, la medición tiene
//    menos de 120 días y quedan al menos 2 celdas verdaderas. Si no, no se renderiza (no se maquilla ni se selecciona).
//  - Se remide en cada cierre de ola y tras publicar la propia franja; si algo deja de cumplirse, se retira de inmediato.
export const proof = {
  measuredUrl: 'https://hacksthedreams-bit.github.io/bombvstic-web/',
  measuredOn: '2026-11-12',
  lighthouseVersion: '12.8.2', // tomada del informe (docs/loop/004-evidencia/medicion-publicada)
  runs: 5,
  lcpDesktopMs: 553 as number | null,
  lcpMobileMs: 2785 as number | null, // > 2500: la celda de velocidad NO se publica (regla fijada antes de medir) // la celda de velocidad solo existe si es ≤ 2500 (y la de escritorio también está medida)
  a11y: 100 as number | null, // puntaje de accesibilidad de Lighthouse (0–100)
  axeClean: true, // puerta 4 del 12-nov-2026: axe sin serias/críticas en el build desplegado (fichas 007 y 108 incluidas) // axe sin violaciones serias/críticas en la versión PUBLICADA (requiere ficha 007 desplegada)
  thirdPartyRequests: 0 as number | null, // medido el 12-nov-2026: solo hacksthedreams-bit.github.io // conexiones a otros dominios durante la carga
};

export const PROOF_MAX_AGE_DAYS = 120;

const sec = (ms: number) => (ms / 1000).toFixed(1).replace('.', ',');

/** Celdas verdaderas hoy (vacío = la franja no existe). `siteHost` = host de Astro.site; `now` = fecha del build. */
export function proofCells(siteHost: string, now = new Date()) {
  const p = proof;
  if (!p.measuredUrl || !p.measuredOn) return null;
  let host = '';
  try {
    host = new URL(p.measuredUrl).host;
  } catch {
    return null;
  }
  if (host !== siteHost) return null;
  const age = (now.getTime() - new Date(p.measuredOn + 'T12:00:00').getTime()) / 86400000;
  if (!(age >= 0 && age <= PROOF_MAX_AGE_DAYS)) return null;
  const cells: { key: string; label: string; html: string }[] = [];
  if (p.lcpDesktopMs != null && p.lcpMobileMs != null && p.lcpMobileMs <= 2500) {
    cells.push({
      key: 'velocidad',
      label: 'Se ve rápido',
      html: `La página muestra lo principal en <b>${sec(p.lcpDesktopMs)}<span class="sr-only"> segundos</span><span aria-hidden="true"> s</span></b> en computador y <b>${sec(p.lcpMobileMs)}<span class="sr-only"> segundos</span><span aria-hidden="true"> s</span></b> en celular (gama media simulado, 4G lenta).`,
    });
  }
  if (p.a11y === 100 && p.axeClean) {
    cells.push({
      key: 'accesibilidad',
      label: 'Para todas las personas',
      html: `Pensada para que todas las personas puedan usarla: <b>100/100</b> en la auditoría automática de accesibilidad de Lighthouse (no reemplaza una revisión manual).`,
    });
  }
  if (p.thirdPartyRequests === 0) {
    cells.push({ key: 'terceros', label: 'Sin terceros al cargar', html: `<b>0</b> conexiones a otras empresas al cargar la página (medido).` });
  }
  if (cells.length < 2) return null;
  const fecha = new Date(p.measuredOn + 'T12:00:00').toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' });
  return { cells, fecha, host, version: p.lighthouseVersion, runs: p.runs, measuredOn: p.measuredOn };
}
