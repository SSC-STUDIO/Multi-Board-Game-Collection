#!/usr/bin/env node
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

const rootDir = process.cwd();
const targets = ['builds', 'output'];

for (const dir of targets) {
  const targetPath = join(rootDir, dir);
  try {
    await rm(targetPath, { recursive: true, force: true });
    console.log(`Removed: ${dir}/`);
  } catch { /* ignore */ }
}
