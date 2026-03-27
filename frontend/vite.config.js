import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig(({ command }) => ({
  plugins: [preact()],
  base: command === 'serve' ? '/' : '/dinosaur-birthday/',
  server: {
    port: 3000,
  },
}));
