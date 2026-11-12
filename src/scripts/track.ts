// Eventos de conversión SOLO EN MEMORIA (ficha 003). No se carga ningún script externo, no hay cookies y nada sale del navegador.
//  - `window.dataLayer` es un arreglo local que se pierde al cerrar la pestaña. Tope: 200 entradas.
//  - Nunca se guardan valores escritos por la persona (ni nombre, ni correo, ni opciones elegidas): solo el nombre del evento y el lugar.
//  - Para conectar una herramienta de medición: exige consentimiento previo, actualizar /privacidad/ y VACIAR este arreglo
//    antes de cargarla (por ejemplo GTM procesa la cola anterior al consentimiento).
type Datos = Record<string, string | number | boolean>;
type Evento = { event: string } & Datos;
declare global {
  interface Window {
    dataLayer?: Evento[];
  }
}

export function track(event: string, datos: Datos = {}) {
  const dl = (window.dataLayer ??= []);
  if (dl.length >= 200) dl.shift();
  dl.push({ event, ...datos });
}

// Clics en botones marcados con data-cta="<lugar>" (nombres de lugar, nunca texto del visitante)
document.addEventListener('click', (e) => {
  const el = (e.target as Element | null)?.closest<HTMLElement>('[data-cta]');
  if (el?.dataset.cta) track('cta_click', { cta: el.dataset.cta });
});
