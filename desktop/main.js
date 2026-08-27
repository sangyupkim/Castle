'use strict';

// ─── 데스크톱 셸 ──────────────────────────────────────────────────────────────
// 웹 버전(index.html)을 그대로 띄우는 얇은 껍데기다. 게임 코드는 한 줄도 바꾸지 않는다.
// 브라우저에서 돌던 것과 같은 파일을 로컬에서 읽어 창에 담을 뿐이라,
// 웹과 데스크톱이 갈라지지 않는다 — 고치면 양쪽이 같이 고쳐진다.
//
// 세이브는 localStorage를 그대로 쓴다. Electron은 앱마다 별도 저장소를 주므로
// 브라우저 세이브와 섞이지 않고, 앱을 지우기 전까지 남는다.

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// 캔버스가 480×800이라 3:5다. 창도 같은 비율로 열고 그 비율을 유지한다.
const ASPECT = 480 / 800;
const DEFAULT_H = 900;
const DEFAULT_W = Math.round(DEFAULT_H * ASPECT);

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: DEFAULT_W,
    height: DEFAULT_H,
    minWidth: Math.round(520 * ASPECT),
    minHeight: 520,
    backgroundColor: '#0a0a0f',
    title: '듀얼 프론티어',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false   // 창이 뒤로 가도 게임 루프가 멈추지 않게
    }
  });

  // 세로 게임이라 가로로 늘어나면 여백만 생긴다 — 비율을 고정한다
  win.setAspectRatio(ASPECT);
  win.loadFile(path.join(__dirname, '..', 'index.html'));

  win.once('ready-to-show', () => win.show());
  win.on('closed', () => { win = null; });

  // 외부 링크는 기본 브라우저로 — 게임 창이 웹 브라우저가 되지 않게
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 게임에는 메뉴가 필요 없다. 전체화면과 개발자 도구만 단축키로 남긴다.
function installShortcuts() {
  Menu.setApplicationMenu(Menu.buildFromTemplate([{
    label: '보기',
    submenu: [
      { role: 'togglefullscreen', label: '전체 화면' },
      { role: 'reload',           label: '새로 고침' },
      { role: 'toggleDevTools',   label: '개발자 도구' },
      { type: 'separator' },
      { role: 'quit',             label: '종료' }
    ]
  }]));
}

app.whenReady().then(() => {
  installShortcuts();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
