const path = require("path");
const { app } = require("electron");

let db = null;

function getDB() {
  if (db) return db;

  const Database = require("better-sqlite3");
  const dbPath = path.join(app.getPath("userData"), "sakura-memo.db");
  db = new Database(dbPath);

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT DEFAULT '',
      content TEXT DEFAULT '',
      color TEXT DEFAULT '#FEF1F5',
      x INTEGER DEFAULT 100,
      y INTEGER DEFAULT 100,
      width INTEGER DEFAULT 320,
      height INTEGER DEFAULT 400,
      mode TEXT DEFAULT 'standard',
      pinned INTEGER DEFAULT 0,
      tags TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      updated_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  return db;
}

function createNote(data = {}) {
  const d = getDB();
  const stmt = d.prepare(`
    INSERT INTO notes (title, content, color, x, y, width, height, mode, pinned, tags)
    VALUES (@title, @content, @color, @x, @y, @width, @height, @mode, @pinned, @tags)
  `);
  const info = stmt.run({
    title: data.title || "",
    content: data.content || "",
    color: data.color || "#FEF1F5",
    x: data.x || 100,
    y: data.y || 100,
    width: data.width || 320,
    height: data.height || 400,
    mode: data.mode || "standard",
    pinned: data.pinned || 0,
    tags: data.tags || ""
  });
  return info.lastInsertRowid;
}

function getNote(id) {
  const d = getDB();
  return d.prepare("SELECT * FROM notes WHERE id = ?").get(id);
}

function getAllNotes() {
  const d = getDB();
  return d.prepare("SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC").all();
}

function updateNote(id, data) {
  const d = getDB();
  const fields = [];
  const values = {};

  const allowed = ["title", "content", "color", "x", "y", "width", "height", "mode", "pinned", "tags"];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = @${key}`);
      values[key] = data[key];
    }
  }

  if (fields.length === 0) return;

  fields.push("updated_at = datetime('now', 'localtime')");
  values.id = id;

  d.prepare(`UPDATE notes SET ${fields.join(", ")} WHERE id = @id`).run(values);
}

function deleteNote(id) {
  const d = getDB();
  d.prepare("DELETE FROM notes WHERE id = ?").run(id);
}

function searchNotes(query) {
  const d = getDB();
  return d
    .prepare("SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY updated_at DESC")
    .all(`%${query}%`, `%${query}%`, `%${query}%`);
}

module.exports = { getDB, createNote, getNote, getAllNotes, updateNote, deleteNote, searchNotes };
