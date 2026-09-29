import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/Energy-Consumption-prediction/',
  plugins: [react()],
  build: {
    outDir: '.',
    emptyOutDir: false,
    assetsDir: '',
    rollupOptions: {
      input: 'main.jsx',
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: '[name].js',
        assetFileNames: 'styles[extname]',
      },
    },
  },
});
