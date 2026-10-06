import { rm } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
const result = await Bun.build({
  entrypoints: ['src/index.ts', 'src/core.ts', 'src/cashu.ts', 'src/ur.ts', 'src/encoding.ts', 'src/auto.ts', 'src/encoder.ts'],
  outdir: 'dist',
  target: 'browser',
  format: 'esm',
  splitting: true,
  packages: 'external',
  sourcemap: 'external',
});
if (!result.success) throw new AggregateError(result.logs, 'Package build failed');
const types = Bun.spawn(['bun', 'x', 'tsc', '-p', 'tsconfig.build.json'], {
  stdout: 'inherit', stderr: 'inherit',
});
if (await types.exited !== 0) throw new Error('Declaration build failed');
