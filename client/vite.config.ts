import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Escucha también en la red local, para poder probar desde las tablets
    // sin tener que compilar.
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
      '/socket': { target: 'http://localhost:4000', ws: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
});
