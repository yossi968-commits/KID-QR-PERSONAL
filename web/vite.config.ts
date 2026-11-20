import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const shim = (f: string) => fileURLToPath(new URL(`./src/demo/shims/${f}`, import.meta.url));

/** The demo runs the real server code in the browser; swap its auth module for an unsigned stand-in. */
const demoAuth = (): Plugin => ({
  name: 'demo-auth',
  enforce: 'pre',
  resolveId(source, importer) {
    if (importer && source.startsWith('.') && path.resolve(path.dirname(importer), source).endsWith('/server/src/lib/auth.js')) return shim('auth.ts');
    return null;
  },
});

/** Outside the demo, the in-browser backend (and the server code it pulls in) stays out of the bundle. */
const noDemoBackend = (): Plugin => ({
  name: 'no-demo-backend',
  enforce: 'pre',
  resolveId: (source) => (source.endsWith('/demo/mockApi') ? '\0no-mock-api' : null),
  load: (id) => (id === '\0no-mock-api' ? 'export function mockApi() { throw new Error("demo backend not built"); }' : null),
});

/**
 * GitHub Pages answers unknown paths (the manifest's home-screen shortcuts such as ./login/parent)
 * with 404.html; send them to the same screen in the hash-routed app.
 */
const pagesFallback = (): Plugin => ({
  name: 'pages-404',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: '404.html',
      source: `<!doctype html><meta charset="utf-8"><script>var p=location.pathname.split('/');location.replace('/'+p[1]+'/'+location.search+'#/'+p.slice(2).join('/'))</script>`,
    });
  },
});

// `vite build --mode demo` produces a self-contained build with the backend running in the browser.
export default defineConfig(({ mode }) => ({
  plugins: [react(), ...(mode === 'demo' ? [demoAuth()] : [noDemoBackend()]), ...(process.env.VITE_PAGES ? [pagesFallback()] : [])],
  server: { port: 5173, proxy: { '/api': 'http://localhost:3000' } },
  ...(mode === 'demo' && {
    base: './',
    define: { 'import.meta.env.VITE_DEMO': JSON.stringify('1'), 'process.env': '{}', 'process.argv': '[]' },
    resolve: {
      alias: {
        'node:crypto': shim('crypto.ts'),
        'node:sqlite': shim('sqlite.ts'),
        'node:fs': shim('fs.ts'),
        'node:path': shim('path.ts'),
        express: shim('express.ts'),
      },
    },
    build: { outDir: 'dist-demo', chunkSizeWarningLimit: 4000, rollupOptions: { output: { inlineDynamicImports: true } } },
  }),
}));
