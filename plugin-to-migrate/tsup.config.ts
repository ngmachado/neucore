import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    outDir: 'dist',
    format: ['esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: true,
    external: ['@elizaos/core'],
    noExternal: ['@elizaos-plugins/client-alfafrens'],
}); 