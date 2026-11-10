import type { APIRoute } from 'astro';
import { u } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const origin = site ?? new URL('https://bombvstic.cl');
  const home = new URL(u('/'), origin).href;
  const privacy = new URL(u('/privacidad/'), origin).href;
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${home}</loc></url>\n  <url><loc>${privacy}</loc></url>\n</urlset>\n`;
  return new Response(body, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
