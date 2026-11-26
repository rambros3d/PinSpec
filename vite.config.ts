import { svelte } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: process.env.BASE_PATH ?? '/',
    plugins: [svelte(), tailwindcss()],
    build: {
      rollupOptions: {
        output: {
          /** Keep unchanged vendor code in cacheable chunks. */
          manualChunks(id) {
            if (id.includes('node_modules/@solar-icons')) return 'icons';
            if (id.includes('node_modules/fflate')) return 'codec';
            if (
              id.includes('node_modules/svelte/') ||
              id.includes('node_modules/@sveltejs/')
            ) {
              return 'svelte';
            }
            return undefined;
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
