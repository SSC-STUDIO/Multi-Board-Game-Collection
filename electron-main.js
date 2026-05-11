const { app, BrowserWindow, protocol, net } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'electron-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  // Navigation protection: block unexpected navigation
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed = process.env.GOMOKU_ELECTRON_DEV === '1'
      ? url.startsWith('http://localhost:4173')
      : url.startsWith('file://');
    if (!allowed) {
      event.preventDefault();
    }
  });

  // Popup protection: block new window creation
  mainWindow.webContents.setWindowOpenHandler(() => {
    return { action: 'deny' };
  });

  if (process.env.GOMOKU_ELECTRON_DEV === '1') {
    mainWindow.loadURL('http://localhost:4173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, 'builds', 'web', 'index.html'));
  }
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    const filePath = path.join(app.getAppPath(), url.hostname, url.pathname);
    // Security: prevent directory traversal
    const resolved = path.resolve(filePath);
    const appRoot = path.resolve(app.getAppPath());
    if (!resolved.startsWith(appRoot)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch('file://' + filePath);
  });
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
