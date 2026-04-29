const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const { validateSystem, detectFrameworks } = require('../src/detector');
const { getPlatform, getArchitecture, getHomeDir } = require('../src/platform');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 720,
    minWidth: 500,
    minHeight: 600,
    title: 'Agent Migrate',
    icon: path.join(__dirname, '..', 'assets', 'logos', 'logo.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// --- IPC: System Info ---
ipcMain.handle('system:get-status', () => {
  return validateSystem();
});

ipcMain.handle('framework:detect', () => {
  return detectFrameworks();
});

ipcMain.handle('app:get-version', () => {
  return {
    tool: 'Agent Migrate v1.0.0',
    electron: process.versions.electron,
    node: process.versions.node,
  };
});

// --- IPC: File Dialogs ---
ipcMain.handle('file:pick-export', async () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultPath = path.join(getHomeDir(), `agent-migration-${timestamp}.agent-mig`);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '保存迁移文件',
    defaultPath: defaultPath,
    filters: [{ name: 'Agent Migration', extensions: ['agent-mig'] }],
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('file:pick-import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '选择迁移文件',
    properties: ['openFile'],
    filters: [{ name: 'Agent Migration', extensions: ['agent-mig'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

// --- IPC: Export (spawn child process) ---
ipcMain.on('action:export', (event, options) => {
  const { outputPath, frameworks } = options;
  const srcPath = path.join(__dirname, '..', 'src', 'index.js');
  const args = [srcPath, 'export'];

  // Always use explicit framework flags to respect user selection
  if (frameworks.openclaw) args.push('--openclaw');
  if (frameworks.hermes) args.push('--hermes');
  if (outputPath) args.push('--output', outputPath);

  const child = spawn('node', args, { cwd: path.join(__dirname, '..') });

  child.stdout.on('data', (data) => {
    mainWindow.webContents.send('action:export-output', data.toString());
  });

  child.stderr.on('data', (data) => {
    mainWindow.webContents.send('action:export-output', data.toString());
  });

  child.on('close', (code) => {
    mainWindow.webContents.send('action:export-done', { code, success: code === 0 });
  });
});

// --- IPC: Import (spawn child process) ---
ipcMain.on('action:import', (event, options) => {
  const { filePath, force, autoInstall, frameworks } = options;
  const srcPath = path.join(__dirname, '..', 'src', 'index.js');
  const args = [srcPath, 'import', filePath];

  if (force) args.push('--force');
  if (autoInstall) args.push('--auto-install');
  // Always use explicit framework flags
  if (frameworks.openclaw) args.push('--openclaw');
  if (frameworks.hermes) args.push('--hermes');

  const child = spawn('node', args, { cwd: path.join(__dirname, '..') });

  child.stdout.on('data', (data) => {
    mainWindow.webContents.send('action:import-output', data.toString());
  });

  child.stderr.on('data', (data) => {
    mainWindow.webContents.send('action:import-output', data.toString());
  });

  child.on('close', (code) => {
    mainWindow.webContents.send('action:import-done', { code, success: code === 0 });
  });
});
