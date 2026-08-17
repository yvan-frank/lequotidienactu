import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../../public/assets',
    emptyOutDir: false,
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: 'islands.js',
        chunkFileNames: 'islands-[name].js',
        assetFileNames: 'islands[extname]',
      },
    },
  },
});
