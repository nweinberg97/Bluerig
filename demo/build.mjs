// Builds dist/demo.html: one self-contained page with the real Bluerig screens
// running on a made-up shop. `npm run demo`
import * as esbuild from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const r = (p) => path.join(root, p);

const alias = {
  name: 'demo-alias',
  setup(b) {
    b.onResolve({ filter: /^next\/link$/ }, () => ({ path: r('demo/shims/next-link.tsx') }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: r('demo/shims/next-navigation.ts') }));
    b.onResolve({ filter: /^@\/lib\/supabase\/browser$/ }, () => ({ path: r('demo/shims/supabase-browser.ts') }));
  },
};

const out = await esbuild.build({
  entryPoints: [r('demo/main.tsx')],
  bundle: true,
  write: false,
  format: 'iife',
  minify: true,
  jsx: 'automatic',
  target: 'es2020',
  tsconfig: r('tsconfig.json'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env.NEXT_PUBLIC_SUPABASE_URL': '"demo"' },
  plugins: [alias],
  legalComments: 'none',
});
const js = out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = ['src/app/globals.css', 'src/app/site.css', 'demo/demo.css'].map((f) => readFileSync(r(f), 'utf8')).join('\n');
const page = `<title>Bluerig Demo</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,100..900&display=swap" rel="stylesheet">
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>`;
// demo.html opens straight from disk; demo-artifact.html is the same page without
// the document wrapper, for hosts that add their own.
const html = `<!doctype html>\n<html lang="en-CA">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n</head>\n<body>\n${page}\n</body>\n</html>\n`;
mkdirSync(r('dist'), { recursive: true });
writeFileSync(r('dist/demo.html'), html);
writeFileSync(r('dist/demo-artifact.html'), page);
console.log(`dist/demo.html ${(html.length / 1024).toFixed(0)} KB`);
