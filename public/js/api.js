const api = {
  async request(method, url, body) {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let data = null;
    try { data = await res.json(); } catch (e) { /* no body */ }
    if (!res.ok) {
      const err = new Error((data && data.error) || `เกิดข้อผิดพลาด (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
  get(url) { return this.request('GET', url); },
  post(url, body) { return this.request('POST', url, body || {}); },
  put(url, body) { return this.request('PUT', url, body || {}); },
  del(url) { return this.request('DELETE', url); },

  // Auth
  me() { return this.get('/api/auth/me'); },
  login(username, password) { return this.post('/api/auth/login', { username, password }); },
  register(username, password, displayName) { return this.post('/api/auth/register', { username, password, displayName }); },
  guest() { return this.post('/api/auth/guest'); },
  logout() { return this.post('/api/auth/logout'); },

  // Novels
  listNovels() { return this.get('/api/novels'); },
  getNovel(id) { return this.get(`/api/novels/${id}`); },
  createNovel(title, genre) { return this.post('/api/novels', { title, genre }); },
  updateNovel(id, data) { return this.put(`/api/novels/${id}`, data); },
  deleteNovel(id) { return this.del(`/api/novels/${id}`); },

  // Chapters
  listChapters(novelId) { return this.get(`/api/novels/${novelId}/chapters`); },
  getChapter(id) { return this.get(`/api/chapters/${id}`); },
  createChapter(novelId, data) { return this.post(`/api/novels/${novelId}/chapters`, data || {}); },
  updateChapter(id, data) { return this.put(`/api/chapters/${id}`, data); },
  deleteChapter(id) { return this.del(`/api/chapters/${id}`); },

  // Progress
  getProgress(novelId) { return this.get(`/api/progress/${novelId}`); },
  setProgress(novelId, data) { return this.put(`/api/progress/${novelId}`, data); },
};
