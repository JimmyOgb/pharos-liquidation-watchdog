import { build } from 'esbuild';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

if (!existsSync('dist')) {
  mkdirSync('dist', { recursive: true });
}

async function run() {
  console.log('[build] Bundling standalone server for production...');
  await build({
    entryPoints: ['src/server/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'esm',
    outfile: 'dist/server.js',
    banner: {
      js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
    },
    external: [],
    sourcemap: true,
  });
  console.log('[build] Successfully generated dist/server.js');
}

run().catch((err) => {
  console.error('[build] Failed to build:', err);
  process.exit(1);
});
