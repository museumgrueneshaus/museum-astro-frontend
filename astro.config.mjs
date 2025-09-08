import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  adapter: netlify(),
  vite: {
    define: {
      'import.meta.env.PUBLIC_SANITY_PROJECT_ID': JSON.stringify('832k5je1'),
      'import.meta.env.PUBLIC_SANITY_DATASET': JSON.stringify('production'),
    }
  }
});