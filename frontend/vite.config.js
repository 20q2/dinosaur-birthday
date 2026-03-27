import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: '/dinosaur-birthday/',
  server: {
    port: 3000,
  },
});
