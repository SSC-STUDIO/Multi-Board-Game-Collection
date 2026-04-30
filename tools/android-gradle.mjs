#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidDir = path.join(rootDir, 'android');
const args = process.argv.slice(2);

if (args.length === 0) {
    console.error('Usage: node tools/android-gradle.mjs <task> [...args]');
    process.exit(1);
}

if (!existsSync(androidDir)) {
    console.error('Missing android project. Run "npx cap add android" first.');
    process.exit(1);
}

const gradleCommand = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const child = spawn(gradleCommand, args, {
    cwd: androidDir,
    stdio: 'inherit',
    shell: process.platform === 'win32'
});

child.on('exit', (code) => {
    process.exit(code ?? 1);
});

child.on('error', (error) => {
    console.error(`Failed to start Gradle wrapper: ${error.message}`);
    process.exit(1);
});
