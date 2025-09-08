import { defineConfig } from 'astro/config';

// https://astro.build/config
export default defineConfig({
  output: 'static', // Changed to static for simpler deployment
  vite: {
    define: {
      'import.meta.env.PUBLIC_SANITY_PROJECT_ID': JSON.stringify('832k5je1'),
      'import.meta.env.PUBLIC_SANITY_DATASET': JSON.stringify('production'),
    }
  }
});