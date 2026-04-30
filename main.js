// Electron 主进程文件
// 用于将 Web 应用打包为桌面应用

import { app, BrowserWindow, protocol } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let protocolsRegistered = false;

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true
        }
    }
]);

function registerProtocols() {
    if (protocolsRegistered) {
        return;
    }

    protocol.registerFileProtocol('app', (request, callback) => {
        try {
            const parsedUrl = new URL(request.url);
            let pathname = decodeURIComponent(parsedUrl.pathname);
            const normalizedPath = path.normalize(pathname);

            if (normalizedPath.startsWith('..') || normalizedPath.includes('../')) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn('[Security] Blocked directory traversal attempt:', pathname);
                }
                callback({ statusCode: 403 });
                return;
            }

            const cleanPath = normalizedPath.startsWith('/')
                ? normalizedPath.slice(1)
                : normalizedPath;
            const filePath = path.join(__dirname, cleanPath);

            const realAppPath = path.resolve(__dirname);
            const realFilePath = path.resolve(filePath);
            if (!realFilePath.startsWith(realAppPath)) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn('[Security] Blocked access outside app directory:', cleanPath);
                }
                callback({ statusCode: 403 });
                return;
            }

            callback(filePath);
        } catch (error) {
            console.error('[Protocol Error]', error);
            callback({ statusCode: 500 });
        }
    });

    protocolsRegistered = true;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: '五子棋 · Gomoku',
        icon: path.join(__dirname, 'assets/icons/icon_256x256.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
            sandbox: true,
            webSecurity: true
        },
        backgroundColor: '#1a1a1a',
        show: false
    });

    mainWindow.loadURL('app://./index.html');

    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

function initSteamworks() {
    // TODO: Steamworks SDK集成
}

app.whenReady().then(() => {
    registerProtocols();
    createWindow();
    initSteamworks();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('web-contents-created', (_event, contents) => {
    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.protocol !== 'file:' && parsedUrl.protocol !== 'app:') {
            event.preventDefault();
        }
    });

    contents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });
});

console.log('App Name:', app.getName());
console.log('App Version:', app.getVersion());
console.log('Electron Version:', process.versions.electron);

export { mainWindow, app };
