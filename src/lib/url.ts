// Antepone la ruta base del sitio (p. ej. /bombvstic-web en GitHub Pages; vacío en un dominio propio).
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const u = (path: string) => `${base}${path.startsWith('/') ? path : `/${path}`}`;
