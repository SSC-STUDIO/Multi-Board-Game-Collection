import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const electronBinary = require('electron');
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const isDev = process.argv.includes('--dev') || process.env.GOMOKU_ELECTRON_DEV === '1';

const child = spawn(electronBinary, [projectRoot], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
        ...process.env,
        ...(isDev ? { NODE_ENV: 'development' } : {})
    },
    shell: false
});

child.on('exit', (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }

    process.exit(code ?? 0);
});

child.on('error', (error) => {
    console.error('[Electron Launch Error]', error);
    process.exit(1);
});
