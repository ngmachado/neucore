import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.test.ts'],
        exclude: ['node_modules', 'dist'],
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'dist/', '**/interfaces/**', '**/types/**']
        }
    },
    resolve: {
        alias: {
            '@neurocore': path.resolve(__dirname, './src')
        }
    }
}); 