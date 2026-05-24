#!/usr/bin/env node
/**
 * 构建脚本 - 用于打包 Web 版本
 * 运行: node tools/build.mjs
 */

import { promises as fs } from 'fs';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const buildDir = join(rootDir, 'builds', 'web');

const BASE_COPY_TARGETS = [
    { source: 'index.html', target: 'index.html', required: true },
    { source: 'manifest.json', target: 'manifest.json', required: false },
    { source: 'src', target: 'src', required: true },
    { source: 'assets', target: 'assets', required: false }
];

const REQUIRED_THREE_RUNTIME = [
    'node_modules/three/build/three.module.js'
];

async function pathExists(targetPath) {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

async function resetBuildDir() {
    await fs.rm(buildDir, { recursive: true, force: true });
    await fs.mkdir(buildDir, { recursive: true });
}

async function walkFiles(targetPath, predicate = null) {
    if (!(await pathExists(targetPath))) {
        return [];
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = join(targetPath, entry.name);
        if (entry.isDirectory()) {
            files.push(...await walkFiles(entryPath, predicate));
            continue;
        }

        if (!predicate || predicate(entryPath)) {
            files.push(entryPath);
        }
    }

    return files;
}

async function detectThreeAddonRuntime() {
    const sourceFiles = await walkFiles(join(rootDir, 'src'), (filePath) => filePath.endsWith('.js'));
    const addonDeps = new Set();
    const patterns = [
        /from\s+['"]three\/addons\/([^'"]+)['"]/g,
        /import\s*\(\s*['"]three\/addons\/([^'"]+)['"]\s*\)/g
    ];

    for (const filePath of sourceFiles) {
        const content = await fs.readFile(filePath, 'utf8');
        for (const pattern of patterns) {
            for (const match of content.matchAll(pattern)) {
                addonDeps.add(`node_modules/three/examples/jsm/${match[1]}`);
            }
        }
    }

    return [...addonDeps].sort();
}

async function copyEntry(source, target, { required = true } = {}) {
    const sourcePath = join(rootDir, source);
    const targetPath = join(buildDir, target);

    if (!(await pathExists(sourcePath))) {
        if (required) {
            throw new Error(
                `Missing required runtime path "${source}". Run "npm install" before "npm run build".`
            );
        }

        console.log(`  - skipped missing optional path: ${source}`);
        return { source, target, copied: false, required };
    }

    await fs.mkdir(dirname(targetPath), { recursive: true });
    await fs.cp(sourcePath, targetPath, { force: true, recursive: true });
    console.log(`  ✓ ${source}`);
    return { source, target, copied: true, required };
}

async function readPackageMetadata() {
    try {
        const packageJsonPath = join(rootDir, 'package.json');
        const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
        return {
            name: packageJson.description || packageJson.name || '多棋类合集 · Board Games',
            version: packageJson.version || '1.0.0'
        };
    } catch {
        return {
            name: '多棋类合集 · Board Games',
            version: '1.0.0'
        };
    }
}

async function collectBuildFiles() {
    const files = await walkFiles(buildDir);
    return files
        .map((filePath) => relative(buildDir, filePath).replaceAll('\\', '/'))
        .sort();
}

function generateManifest({ appName, version, copiedEntries, runtimeDependencies, files }) {
    return JSON.stringify({
        name: appName,
        version,
        buildDate: new Date().toISOString(),
        buildNumber: process.env.BUILD_NUMBER || '1',
        copiedEntries: copiedEntries
            .filter((entry) => entry.copied)
            .map(({ source, target }) => ({ source, target })),
        runtimeDependencies,
        files
    }, null, 2);
}

async function build() {
    console.log('🔨 开始构建五子棋 Web 版本...\n');

    const startTime = Date.now();

    try {
        console.log('📁 清理旧构建目录...');
        await resetBuildDir();

        console.log('📦 复制项目文件...');
        const copiedEntries = [];
        for (const target of BASE_COPY_TARGETS) {
            copiedEntries.push(await copyEntry(target.source, target.target, target));
        }

        console.log('\n🧩 分析 Three 运行时依赖...');
        const runtimeDependencies = [
            ...REQUIRED_THREE_RUNTIME,
            ...await detectThreeAddonRuntime()
        ];

        for (const dependency of runtimeDependencies) {
            copiedEntries.push(await copyEntry(dependency, dependency, { required: true }));
        }

        console.log('\n📋 生成构建清单...');
        const manifestPath = join(buildDir, 'manifest.json');
        const { name: appName, version } = await readPackageMetadata();
        const files = await collectBuildFiles();
        await fs.writeFile(
            manifestPath,
            generateManifest({
                appName,
                version,
                copiedEntries,
                runtimeDependencies,
                files
            }),
            'utf8'
        );

        const duration = Date.now() - startTime;
        const finalFiles = await collectBuildFiles();
        console.log('\n✅ 构建完成!');
        console.log(`📍 构建目录: ${buildDir}`);
        console.log(`⏱️ 耗时: ${duration}ms`);
        console.log(`📊 文件数量: ${finalFiles.length}`);
    } catch (error) {
        console.error('❌ 构建失败:', error);
        process.exit(1);
    }
}

build();
