import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://evey.blog',
  markdown: {
    shikiConfig: {
      theme: 'tokyo-night',
    },
  },
});
