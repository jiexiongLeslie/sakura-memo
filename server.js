const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const db = require("./database/db");
const PORT = 27149;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".json": "application/json",
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  } catch (e) {
    res.writeHead(404);
    res.end("Not Found");
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try { resolve(JSON.parse(body)); }
      catch { resolve({}); }
    });
  });
}

// API handlers
async function handleAPI(req, res, url) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204); res.end(); return;
  }

  try {
    // POST /api/notes
    if (req.method === "POST" && url === "/api/notes") {
      const data = await parseBody(req);
      const id = db.createNote(data || {});
      res.writeHead(201);
      res.end(JSON.stringify({ id, ...db.getNote(id) }));
      return;
    }

    // GET /api/notes or GET /api/notes?q=xxx
    if (req.method === "GET" && url.startsWith("/api/notes")) {
      const urlObj = new URL(req.url, `http://localhost:${PORT}`);
      const id = urlObj.pathname.match(/^\/api\/notes\/(\d+)$/);
      const search = urlObj.searchParams.get("q");

      if (id) {
        const note = db.getNote(Number(id[1]));
        if (note) { res.writeHead(200); res.end(JSON.stringify(note)); }
        else { res.writeHead(404); res.end(JSON.stringify({ error: "Not found" })); }
      } else if (search) {
        res.writeHead(200);
        res.end(JSON.stringify(db.searchNotes(search)));
      } else {
        res.writeHead(200);
        res.end(JSON.stringify(db.getAllNotes()));
      }
      return;
    }

    // PUT /api/notes/:id
    if (req.method === "PUT") {
      const match = url.match(/^\/api\/notes\/(\d+)$/);
      if (match) {
        const data = await parseBody(req);
        db.updateNote(Number(match[1]), data);
        res.writeHead(200);
        res.end(JSON.stringify(db.getNote(Number(match[1]))));
        return;
      }
    }

    // DELETE /api/notes/:id
    if (req.method === "DELETE") {
      const match = url.match(/^\/api\/notes\/(\d+)$/);
      if (match) {
        db.deleteNote(Number(match[1]));
        res.writeHead(200);
        res.end(JSON.stringify({ success: true }));
        return;
      }
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
  } catch (e) {
    console.error("API Error:", e);
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`).pathname;

  // API routes
  if (url.startsWith("/api/")) {
    return handleAPI(req, res, url);
  }

  // Static files
  if (url === "/" || url === "/index.html") {
    return serveStatic(res, path.join(__dirname, "renderer", "index.html"));
  }
  if (url === "/note.html") {
    return serveStatic(res, path.join(__dirname, "renderer", "note.html"));
  }
  if (url === "/style.css") {
    return serveStatic(res, path.join(__dirname, "renderer", "style.css"));
  }
  if (url === "/app.js") {
    return serveStatic(res, path.join(__dirname, "renderer", "app.js"));
  }
  if (url === "/icon.png") {
    return serveStatic(res, path.join(__dirname, "assets", "icon.png"));
  }

  res.writeHead(404);
  res.end("Not Found");
});

async function start() {
  await db.initDB(path.join(__dirname, "data"));

  server.listen(PORT, () => {
    console.log(`Sakura Memo running at http://localhost:${PORT}`);
    // Open browser
    const cmd = process.platform === "win32" ? "start" : "open";
    spawn(cmd, [`http://localhost:${PORT}`], { shell: true, stdio: "ignore" });
  });
}

start().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
