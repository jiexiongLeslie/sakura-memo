const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("sakura", {
  // Database operations
  db: {
    createNote: (data) => ipcRenderer.invoke("db:createNote", data),
    getNote: (id) => ipcRenderer.invoke("db:getNote", id),
    getAllNotes: () => ipcRenderer.invoke("db:getAllNotes"),
    updateNote: (id, data) => ipcRenderer.invoke("db:updateNote", id, data),
    deleteNote: (id) => ipcRenderer.invoke("db:deleteNote", id),
    searchNotes: (query) => ipcRenderer.invoke("db:searchNotes", query),
  },

  // Window controls
  window: {
    close: () => ipcRenderer.invoke("win:close"),
    minimize: () => ipcRenderer.invoke("win:minimize"),
    pin: (pinned) => ipcRenderer.invoke("win:pin", pinned),
    setIgnoreMouse: (ignore) => ipcRenderer.invoke("win:setIgnoreMouse", ignore),
    openManager: () => ipcRenderer.invoke("win:openManager"),
    openNote: (id) => ipcRenderer.invoke("win:openNote", id),
  },

  // Listen for events from main process
  on: (channel, callback) => {
    const valid = ["note:saved", "note:focus", "note:created"];
    if (valid.includes(channel)) {
      ipcRenderer.on(channel, (_, ...args) => callback(...args));
    }
  },

  // Get current note ID if passed via query param
  getNoteId: () => {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") ? Number(params.get("id")) : null;
  }
});
