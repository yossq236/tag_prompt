import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    base: '/extensions/tag_prompt',
    build: {
        outDir: 'web',
        lib: {
            entry: './src/index.ts',
            name: 'index',
            formats: ['es'],
        },
        rollupOptions: {
            external: ['/scripts/app.js'],
            output: {
                entryFileNames: `js/[name].js`,
                globals: {'/scripts/app.js': 'app'},
            }
        },
        minify: 'terser',
    },
    worker: {
        format: 'es',
        rollupOptions: {
            output: {
                entryFileNames: `assets/[name].js`,
            },
        },
    },
});