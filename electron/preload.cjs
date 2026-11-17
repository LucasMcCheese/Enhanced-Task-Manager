const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('windowsTaskManagerEnv', {
  isElectronExe: true,
  platform: process.platform,
});
