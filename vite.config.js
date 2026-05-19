import { defineConfig } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
    root: '.',
    publicDir: 'assets',
    build: {
        outDir: 'builds/web',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules/three/')) {
                        return 'three';
                    }
                },
            },
        },
    },
    server: {
        port: 4173,
        open: false,
    },
    assetsInclude: ['**/*.glsl'],
});
