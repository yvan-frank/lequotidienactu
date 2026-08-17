import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/u/admin/',
  plugins: [react(), tailwindcss()],
  build: { outDir: '../../public/admin', emptyOutDir: true },
});
