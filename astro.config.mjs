import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: netlify({
    // Choose edge: true to deploy to Edge Functions; keeping Node Functions for compatibility
    edge: false,
  }),
  vite: {}
});
