const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage } = require("electron");
const path = require("path");

let db = null;
function getDb() {
  if (!db) db = require("./database/db");
  return db;
}

let tray = null;
let managerWindow = null;
const noteWindows = new Map();

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); }

function createTray() {
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEISURBVDiNpZKxTsMwEIb/uyQKoiuISYmEhMTEwMLGyMLKyMrIwMLKyMLKwMLKyMLKwMLKyMLKwMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMJA0c8iYI1gHzrvKYqCJEkIIoABBIwj4A8KMMYZgjBFEQQCAnPOkKYpcM4hhADGGGMYgDH+CxMIQT8gCDxpAaCpqQsh/M8F0GQAXoCqK5x4AH4COANgHgDMP4Bs0v6emK44yIE/AAurDWc8gAIYAbAKoAvADWB3nqJ5oX7ceflFeA5CW8L1tdW4D/w3/B7puc3A1w/n/B8h6jT2GAAAAABJRU5ErkJggg=="
  );
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Sakura Memo - \u6A31\u82B1\u4FBF\u7B7E");
  const contextMenu = Menu.buildFromTemplate([
    { label: "\u65B0\u5EFA\u4FBF\u7B7E", click: () => createNoteWindow() },
    { type: "separator" },
    { label: "\u7BA1\u7406\u9762\u677F", click: () => openManager() },
    { type: "separator" },
    { label: "\u9000\u51FA", click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("double-click", () => createNoteWindow());
}

async function createNoteWindow(noteId = null) {
  if (noteId && noteWindows.has(noteId)) { noteWindows.get(noteId).focus(); return; }
  let noteData = { x: 100, y: 100, width: 320, height: 400 };
  if (noteId) { const n = getDb().getNote(noteId); if (n) noteData = n; }
  const win = new BrowserWindow({
    width: noteData.width, height: noteData.height, x: noteData.x, y: noteData.y,
    minWidth: 200, minHeight: 200, frame: false, transparent: true,
    alwaysOnTop: noteData.pinned === 1, resizable: true, skipTaskbar: true,
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  await win.loadFile(path.join(__dirname, "renderer", "note.html"), { query: noteId ? { id: String(noteId) } : {} });
  if (!noteId) {
    const newId = getDb().createNote({ x: noteData.x, y: noteData.y, width: noteData.width, height: noteData.height });
    win.webContents.on("did-finish-load", () => win.webContents.send("note:created", newId));
    noteId = newId;
  }
  win._noteId = noteId;
  noteWindows.set(noteId, win);
  const savePos = debounce((id) => { const w = noteWindows.get(id); if (w && !w.isDestroyed()) { const b = w.getBounds(); getDb().updateNote(id, { x: b.x, y: b.y, width: b.width, height: b.height }); } }, 500);
  win.on("move", () => savePos(noteId));
  win.on("resize", () => savePos(noteId));
  win.on("closed", () => { const w = noteWindows.get(noteId); if (w && !w.isDestroyed()) { const b = w.getBounds(); getDb().updateNote(noteId, { x: b.x, y: b.y, width: b.width, height: b.height }); } noteWindows.delete(noteId); });
  return win;
}

function openManager() {
  if (managerWindow && !managerWindow.isDestroyed()) { managerWindow.focus(); return; }
  managerWindow = new BrowserWindow({ width: 800, height: 600, minWidth: 600, minHeight: 400, frame: false, transparent: true, webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false } });
  managerWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  managerWindow.on("closed", () => { managerWindow = null; });
}

function setupIPC() {
  ipcMain.handle("db:createNote", (_, data) => getDb().createNote(data));
  ipcMain.handle("db:getNote", (_, id) => getDb().getNote(id));
  ipcMain.handle("db:getAllNotes", () => getDb().getAllNotes());
  ipcMain.handle("db:updateNote", (_, id, data) => getDb().updateNote(id, data));
  ipcMain.handle("db:deleteNote", (_, id) => { getDb().deleteNote(id); const w = noteWindows.get(id); if (w) w.close(); });
  ipcMain.handle("db:searchNotes", (_, q) => getDb().searchNotes(q));
  ipcMain.handle("win:close", (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.close(); });
  ipcMain.handle("win:minimize", (e) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.minimize(); });
  ipcMain.handle("win:pin", (e, p) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) { w.setAlwaysOnTop(p); if (w._noteId) getDb().updateNote(w._noteId, { pinned: p ? 1 : 0 }); } });
  ipcMain.handle("win:setIgnoreMouse", (e, ig) => { const w = BrowserWindow.fromWebContents(e.sender); if (w) w.setIgnoreMouseEvents(ig, { forward: true }); });
  ipcMain.handle("win:openManager", () => openManager());
  ipcMain.handle("win:openNote", (_, id) => createNoteWindow(id));
}

function debounce(fn, d) { const t = new Map(); return function(...a) { const k = a[0]; if (t.has(k)) clearTimeout(t.get(k)); t.set(k, setTimeout(() => { t.delete(k); fn(...a); }, d)); }; }

app.on("ready", async () => {
  await getDb().initDB(app.getPath("userData"));
  createTray();
  setupIPC();
  globalShortcut.register("CommandOrControl+Shift+N", () => createNoteWindow());
});

app.on("window-all-closed", () => {});
app.on("before-quit", () => { app.isQuitting = true; });
app.on("second-instance", () => openManager());
