import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  base: '/AlexBirthdayDinos/',
  server: {
    port: 3000,
  },
});
