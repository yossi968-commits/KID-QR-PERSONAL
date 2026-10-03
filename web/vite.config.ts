import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// `vite build --mode demo` produces a self-contained build with the API mocked in the browser.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  ...(mode === 'demo' && {
    base: './',
    define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1') },
    resolve: { alias: { 'node:crypto': fileURLToPath(new URL('./src/demo/crypto-shim.ts', import.meta.url)) } },
    build: { outDir: 'dist-demo', rollupOptions: { output: { inlineDynamicImports: true } } },
  }),
}));
