// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import netlify from '@astrojs/netlify';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://quiniela.alirioi.dev',
  output: 'server',
  adapter: netlify(),
  integrations: [
    react(), 
    tailwind(), 
    sitemap({
      filter: (page) => 
        !page.includes('/admin') && 
        !page.includes('/dashboard') &&
        !page.includes('/pending') &&
        !page.includes('/my-entries') &&
        !page.includes('/predictions') &&
        !page.includes('/reset-password') &&
        !page.includes('/forgot-password')
    })
  ]
});