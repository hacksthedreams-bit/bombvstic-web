import type { APIRoute } from 'astro';
import { u } from '../lib/url';

// Resumen legible por asistentes de IA. Solo datos confirmados por la agencia: sin cifras, precios ni resultados.
export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://bombvstic.cl');
  const home = new URL(u('/'), origin).href;
  const body = `# Bombvstic

> Agencia de marketing digital y soluciones de IA en Santiago de Chile. Marca, contenido, campañas y tecnología a medida en un solo equipo.

Sitio: ${home}
Contacto: bombvstic@gmail.com
Instagram: https://www.instagram.com/bombvstic/

## Servicios

Growth y Marca:
- Estrategia de marketing digital
- Branding e identidad
- Creación de contenido
- Gestión de redes sociales
- Campañas publicitarias (Meta Ads)
- Videos publicitarios para Meta Ads
- Asesoría para vender cursos y comunidades (por ejemplo en Skool)

IA y Software:
- Páginas web
- Dashboards a medida
- Asistentes de IA
- Apps a la medida
- Sistemas para empresas

## Para quién

Negocios locales (restaurantes, centros de eventos, tiendas online), creadores que venden cursos o comunidades, y empresas que necesitan marketing o tecnología a medida.

## Cómo trabajamos

Descubrir, definir, construir y evolucionar. El primer paso es un diagnóstico: ${home}#contacto
`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
