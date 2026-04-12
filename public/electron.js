import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs-extra';
import isDev from 'electron-is-dev';
import { fileURLToPath } from 'url';

// ES Module에서 __dirname을 대신하는 설정
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 600,
    resizable: false,
    title: 'YEONYOU Updater',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      // 리액트 앱에서 window.require('electron')을 쓰기 위해 필요
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000');
  } else {
    // 빌드된 index.html 경로 (public 폴더 기준이므로 한 단계 위 build 폴더 참조)
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));
  }
};

app.whenReady().then(createWindow);

// --- IPC 통신 로직 ---

ipcMain.handle('get-default-path', () => {
  const defaultPath = path.join(
    os.homedir(),
    'AppData',
    'Roaming',
    '.minecraft'
  );
  
  return fs.existsSync(defaultPath)
    ? defaultPath
    : '경로를 수동으로 설정해주세요.';
});

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '마인크래프트 폴더를 선택해주세요',
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});