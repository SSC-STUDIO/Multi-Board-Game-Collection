import { readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, 'src');

const files = await collectJavaScriptFiles(sourceRoot);

for (const file of files) {
    await runNodeCheck(file);
}

console.log(`Checked ${files.length} JavaScript modules.`);

async function collectJavaScriptFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...await collectJavaScriptFiles(fullPath));
            continue;
        }

        if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath);
        }
    }

    return files.sort();
}

function runNodeCheck(file) {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--check', file], {
            cwd: projectRoot,
            stdio: 'inherit'
        });

        child.on('exit', (code) => {
            if (code === 0) {
                resolve();
                return;
            }

            reject(new Error(`Syntax check failed: ${file}`));
        });

        child.on('error', reject);
    });
}
