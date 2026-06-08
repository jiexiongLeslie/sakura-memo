const { app, BrowserWindow, Tray, Menu, ipcMain, globalShortcut, nativeImage, screen } = require("electron");
const path = require("path");
const db = require("./database/db");

let tray = null;
let managerWindow = null;
const noteWindows = new Map();

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

function createTray() {
  // Create a simple 16x16 pink icon programmatically
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAAbwAAAG8B8aLcQwAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAEISURBVDiNpZKxTsMwEIb/uyQKoiuISYmEhMTEwMLGyMLKyMrIwMLKyMLKwMLKyMLKwMLKyMLKwMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMLKyMJA0c8iYI1gHzrvKYqCJEkIIoABBIwj4A8KMMYZgjBFEQQCAnPOkKYpcM4hhADGGMYYgDH+CxMIQT8gCDxpAaCpqQsh/M8F0GQAXoCqK5x4AH4COANgHgDMP4Bs0v6emK44yIE/AAurDWc8gAIYAbAKoAvADWB3nqJ5oX7ceflFeA5CW8L1tdW4D/w3/B7puc3A1w/n/B8h6jT2GAAAAABJRU5ErkJggg=="
  );

  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Sakura Memo - 樱花便签");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "新建便签",
      click: () => createNoteWindow(),
    },
    { type: "separator" },
    {
      label: "管理面板",
      click: () => openManager(),
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // Double-click tray to create new note
  tray.on("double-click", () => createNoteWindow());
}

async function createNoteWindow(noteId = null) {
  // If note is already open, focus it
  if (noteId && noteWindows.has(noteId)) {
    const win = noteWindows.get(noteId);
    win.focus();
    return;
  }

  let noteData = { x: 100, y: 100, width: 320, height: 400 };
  if (noteId) {
    const note = db.getNote(noteId);
    if (note) {
      noteData = note;
    }
  }

  const win = new BrowserWindow({
    width: noteData.width,
    height: noteData.height,
    x: noteData.x,
    y: noteData.y,
    minWidth: 200,
    minHeight: 200,
    frame: false,
    transparent: true,
    alwaysOnTop: noteData.pinned === 1,
    resizable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Load note.html with optional id
  const query = noteId ? `?id=${noteId}` : "";
  await win.loadFile(path.join(__dirname, "renderer", "note.html"), {
    query: noteId ? { id: String(noteId) } : {},
  });

  // If new note, create in DB and store ID
  if (!noteId) {
    const newId = db.createNote({
      x: noteData.x,
      y: noteData.y,
      width: noteData.width,
      height: noteData.height,
    });
    win.webContents.on("did-finish-load", () => {
      win.webContents.send("note:created", newId);
    });
    noteId = newId;
  }

  // Track window
  win._noteId = noteId;
  noteWindows.set(noteId, win);

  // Save position/size on move/resize
  const saveDebounced = debounce((id) => {
    const w = noteWindows.get(id);
    if (w && !w.isDestroyed()) {
      const bounds = w.getBounds();
      db.updateNote(id, {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
    }
  }, 500);

  win.on("move", () => saveDebounced(noteId));
  win.on("resize", () => saveDebounced(noteId));

  win.on("closed", () => {
    const w = noteWindows.get(noteId);
    if (w && !w.isDestroyed()) {
      const bounds = w.getBounds();
      db.updateNote(noteId, {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
      });
    }
    noteWindows.delete(noteId);
  });

  return win;
}

function openManager() {
  if (managerWindow && !managerWindow.isDestroyed()) {
    managerWindow.focus();
    return;
  }

  managerWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  managerWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  managerWindow.on("closed", () => {
    managerWindow = null;
  });
}

// IPC Handlers
function setupIPC() {
  // DB operations
  ipcMain.handle("db:createNote", (_, data) => db.createNote(data));
  ipcMain.handle("db:getNote", (_, id) => db.getNote(id));
  ipcMain.handle("db:getAllNotes", () => db.getAllNotes());
  ipcMain.handle("db:updateNote", (_, id, data) => db.updateNote(id, data));
  ipcMain.handle("db:deleteNote", (_, id) => {
    db.deleteNote(id);
    // Close note window if open
    const win = noteWindows.get(id);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  });
  ipcMain.handle("db:searchNotes", (_, query) => db.searchNotes(query));

  // Window controls
  ipcMain.handle("win:close", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });
  ipcMain.handle("win:minimize", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });
  ipcMain.handle("win:pin", (event, pinned) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.setAlwaysOnTop(pinned);
      if (win._noteId) {
        db.updateNote(win._noteId, { pinned: pinned ? 1 : 0 });
      }
    }
  });
  ipcMain.handle("win:setIgnoreMouse", (event, ignore) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.setIgnoreMouseEvents(ignore, { forward: true });
  });
  ipcMain.handle("win:openManager", () => openManager());

  // Open existing note from manager
  ipcMain.handle("win:openNote", (_, id) => {
    createNoteWindow(id);
  });
}

// Utility
function debounce(fn, delay) {
  const timers = new Map();
  return function (...args) {
    const key = args[0];
    if (timers.has(key)) clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        fn(...args);
      }, delay)
    );
  };
}

// App lifecycle
app.on("ready", () => {
  db.getDB(); // Init database
  createTray();
  setupIPC();

  // Global shortcut: Ctrl+Shift+N
  globalShortcut.register("CommandOrControl+Shift+N", () => {
    createNoteWindow();
  });
});

app.on("window-all-closed", () => {
  // Don't quit on Windows when all windows are closed (tray app)
});

app.on("before-quit", () => {
  app.isQuitting = true;
});

app.on("second-instance", () => {
  // Focus manager if someone tries to open a second instance
  openManager();
});
