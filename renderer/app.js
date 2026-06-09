const API = "http://localhost:27149/api";

const sakura = {
  async createNote(data) {
    const res = await fetch(`${API}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data || {}),
    });
    return res.json();
  },

  async getNote(id) {
    const res = await fetch(`${API}/notes/${id}`);
    return res.json();
  },

  async getAllNotes() {
    const res = await fetch(`${API}/notes`);
    return res.json();
  },

  async updateNote(id, data) {
    const res = await fetch(`${API}/notes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteNote(id) {
    await fetch(`${API}/notes/${id}`, { method: "DELETE" });
  },

  async searchNotes(query) {
    const res = await fetch(`${API}/notes?q=${encodeURIComponent(query)}`);
    return res.json();
  },

  openNote(id) {
    window.open(
      `/note.html?id=${id}`,
      `sakura-note-${id}`,
      "width=340,height=440,resizable=yes,frame=no,location=no"
    );
  },

  getNoteId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id") ? Number(params.get("id")) : null;
  }
};
