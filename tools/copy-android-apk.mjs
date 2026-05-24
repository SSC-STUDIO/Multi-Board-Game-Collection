#!/usr/bin/env node

import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const variant = process.argv[2] || 'debug';
const packageJson = JSON.parse(await readFile(path.join(rootDir, 'package.json'), 'utf8'));
const version = packageJson.version || '0.0.0';

const apkName = variant === 'debug' ? 'app-debug.apk' : `app-${variant}.apk`;
const sourceApk = path.join(rootDir, 'android', 'app', 'build', 'outputs', 'apk', variant, apkName);
const outputDir = path.join(rootDir, 'output', 'android');
const outputApk = path.join(outputDir, `BoardGames-${version}-${variant}.apk`);

try {
    await stat(sourceApk);
} catch {
    console.error(`Missing APK: ${sourceApk}`);
    console.error(`Run "npm run android:build:${variant}" first.`);
    process.exit(1);
}

await mkdir(outputDir, { recursive: true });
await copyFile(sourceApk, outputApk);

const { size } = await stat(outputApk);
const sizeMb = (size / 1024 / 1024).toFixed(1);
console.log(`Installable APK: ${outputApk} (${sizeMb} MB)`);
