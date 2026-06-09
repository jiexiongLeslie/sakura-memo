const path = require("path");
const fs = require("fs");

let SQL = null;  // sql.js module
let db = null;   // database instance
let dbPath = null;

async function initDB(userDataPath) {
  if (db) return db;

  // Ensure directory exists
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }

  const initSqlJs = require("sql.js");
  SQL = await initSqlJs();

  dbPath = path.join(userDataPath, "sakura-memo.db");

  // Load existing database or create new
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL-like behavior (sql.js runs in memory)
  db.run("PRAGMA foreign_keys = ON");

  // Create tables
  db.run(`
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

function saveDB() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

function getDB() {
  if (!db) throw new Error("Database not initialized. Call initDB() first.");
  return db;
}

function createNote(data = {}) {
  const d = getDB();
  const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
  const stmt = d.prepare(`
    INSERT INTO notes (title, content, color, x, y, width, height, mode, pinned, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.bind([
    data.title || "",
    data.content || "",
    data.color || "#FEF1F5",
    data.x || 100,
    data.y || 100,
    data.width || 320,
    data.height || 400,
    data.mode || "standard",
    data.pinned || 0,
    data.tags || "",
    timestamp,
    timestamp
  ]);
  stmt.step();
  stmt.free();

  // Get last inserted id
  const result = d.exec("SELECT last_insert_rowid() as id");
  const id = result[0].values[0][0];
  saveDB();
  return id;
}

function getNote(id) {
  const d = getDB();
  const stmt = d.prepare("SELECT * FROM notes WHERE id = ?");
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function getAllNotes() {
  const d = getDB();
  const stmt = d.prepare("SELECT * FROM notes ORDER BY pinned DESC, updated_at DESC");
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function updateNote(id, data) {
  const d = getDB();
  const fields = [];
  const values = [];

  const allowed = ["title", "content", "color", "x", "y", "width", "height", "mode", "pinned", "tags"];
  for (const key of allowed) {
    if (data[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) return;

  const timestamp = new Date().toISOString().replace("T", " ").split(".")[0];
  fields.push("updated_at = ?");
  values.push(timestamp);
  values.push(id);

  const sql = `UPDATE notes SET ${fields.join(", ")} WHERE id = ?`;
  d.run(sql, values);
  saveDB();
}

function deleteNote(id) {
  const d = getDB();
  d.run("DELETE FROM notes WHERE id = ?", [id]);
  saveDB();
}

function searchNotes(query) {
  const d = getDB();
  const stmt = d.prepare(
    "SELECT * FROM notes WHERE title LIKE ? OR content LIKE ? OR tags LIKE ? ORDER BY updated_at DESC"
  );
  const pattern = `%${query}%`;
  stmt.bind([pattern, pattern, pattern]);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

module.exports = { initDB, saveDB, createNote, getNote, getAllNotes, updateNote, deleteNote, searchNotes };
