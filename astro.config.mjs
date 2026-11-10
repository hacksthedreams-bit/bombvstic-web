// @ts-check
import { defineConfig } from 'astro/config';

// Vista previa en GitHub Pages. Al publicar en el dominio definitivo:
// site → 'https://bombvstic.cl' y quitar `base`.
export default defineConfig({
  site: 'https://hacksthedreams-bit.github.io',
  base: '/bombvstic-web',
});
