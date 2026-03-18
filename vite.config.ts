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
            cssFileName: 'assets/index'
        },
        rollupOptions: {
            external: ['/scripts/app.js'],
            output: {
                entryFileNames: `js/[name].js`,
                globals: {'/scripts/app.js': 'app'},
            }
        },
        minify: 'terser',
        // minify: false,
    },
    worker: {
        format: 'es',
        rollupOptions: {
            output: {
                entryFileNames: `assets/[name].js`,
            },
        },
    },
    css: {
        modules: {
            localsConvention: 'camelCaseOnly',
        },
    },
});