import type { APIRoute } from 'astro';
import { u } from '../lib/url';

// En la vista previa (github.io) se pide no indexar; en el dominio definitivo se permite todo.
export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://bombvstic.cl');
  const preview = origin.hostname.endsWith('github.io');
  const body = preview
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL(u('/sitemap.xml'), origin).href}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
