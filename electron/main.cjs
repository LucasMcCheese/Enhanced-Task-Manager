const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

let mainWindow = null;
let serverProc = null;

function waitForServer(url, retries = 30) {
  return new Promise((resolve) => {
    const attempt = (remaining) => {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on('error', () => {
          if (remaining <= 0) {
            resolve();
            return;
          }
          setTimeout(() => attempt(remaining - 1), 250);
        });
    };
    attempt(retries);
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#141416',
    title: 'Windows 11 Task Manager',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}`);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  const port = process.env.PORT || '3789';
  const serverEntry = path.join(__dirname, '..', 'server.ts');

  serverProc = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      PORT: port,
      NODE_ENV: app.isPackaged ? 'production' : 'development',
      ELECTRON_APP: '1',
    },
    stdio: 'inherit',
    windowsHide: true,
  });

  await waitForServer(`http://127.0.0.1:${port}/api/windows/status`);
  createWindow(port);
});

app.on('window-all-closed', () => {
  if (serverProc) {
    serverProc.kill();
    serverProc = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
