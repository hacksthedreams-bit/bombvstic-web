// Datos de contacto: fuente única (se usa SOLO desde el frontmatter de Astro, nunca desde scripts de cliente).
export const EMAIL = 'bombvstic@gmail.com';

// WhatsApp (ficha 002). Hoy está APAGADO: sin número no se renderiza ningún elemento de WhatsApp.
// Para encenderlo: 1) escribe el número en formato 569XXXXXXXX; 2) revisa el texto de privacidad de WhatsApp
// (/privacidad/ y la nota del formulario ya traen la versión condicionada) y 3) pon WHATSAPP_PRIVACY_REVIEWED = true.
const WHATSAPP_NUMBER = '';
export const WHATSAPP_PRIVACY_REVIEWED = false;

/** Devuelve la configuración de WhatsApp o null si está apagado. Falla el build ante un número inválido o sin revisión legal. */
export function whatsapp(): { number: string; base: string; href: (text: string) => string } | null {
  // PUBLIC_WHATSAPP solo sirve para un build de PRUEBA fuera de site/dist (junto con PUBLIC_WHATSAPP_TEST=1): nunca se publica
  const number = String(import.meta.env.PUBLIC_WHATSAPP ?? WHATSAPP_NUMBER).trim();
  if (!number) return null;
  if (!/^569\d{8}$/.test(number)) throw new Error(`WhatsApp: el número "${number}" no cumple 569XXXXXXXX`);
  if (!WHATSAPP_PRIVACY_REVIEWED && import.meta.env.PUBLIC_WHATSAPP_TEST !== '1') {
    throw new Error('WhatsApp: el texto de privacidad de WhatsApp no está revisado (WHATSAPP_PRIVACY_REVIEWED = false)');
  }
  const base = `https://wa.me/${number}`;
  return { number, base, href: (text) => `${base}?text=${encodeURIComponent(text)}` };
}

export const WA_HELLO = 'Hola Bombvstic, vi su web y quiero agendar un diagnóstico.';
export const WA_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-4.2A8 8 0 1 1 8.4 18.8L4 20z" /><path d="M9.2 9.3c.2 2.2 2.1 4.1 4.4 4.5l1.1-1.1-1.7-.9-.8.6c-.7-.3-1.4-1-1.7-1.7l.6-.8-.9-1.7-1 1.1z" /></svg>';
