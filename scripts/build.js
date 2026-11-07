import { build } from 'esbuild';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

if (!existsSync('dist')) {
  mkdirSync('dist', { recursive: true });
}
if (!existsSync('api')) {
  mkdirSync('api', { recursive: true });
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
    sourcemap: true,
  });
  console.log('[build] Successfully generated dist/server.js');

  console.log('[build] Bundling Vercel serverless functions (api/*.js)...');
  const serverlessEndpoints = ['health', 'watch', 'reserves', 'alerts'];
  for (const ep of serverlessEndpoints) {
    const srcPath = `src/api/${ep}.ts`;
    const outPath = `api/${ep}.js`;
    if (existsSync(srcPath)) {
      await build({
        entryPoints: [srcPath],
        bundle: true,
        platform: 'node',
        target: 'node20',
        format: 'esm',
        outfile: outPath,
        sourcemap: false,
        banner: {
          js: `// Vercel Serverless Function: /api/${ep}\n`,
        },
      });
      console.log(`  -> Built ${outPath}`);
    }
  }
  console.log('[build] All serverless functions packaged successfully.');
}

run().catch((err) => {
  console.error('[build] Failed to build:', err);
  process.exit(1);
});
