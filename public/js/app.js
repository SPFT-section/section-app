// ===== Global state =====
let currentUser = null;
let currentNovel = null;      // full novel object with chapters, when on editor/reader
let currentChapter = null;    // chapter being edited/read
let manageMode = false;
let autosaveTimer = null;
let selectedGradient = null;

const GRADIENTS = [
  'linear-gradient(135deg,#6d5bd0,#8f7ff0)',
  'linear-gradient(135deg,#e0785a,#f0a58c)',
  'linear-gradient(135deg,#4a5568,#718096)',
  'linear-gradient(135deg,#2f855a,#68d391)',
  'linear-gradient(135deg,#b83280,#ed64a6)',
];

// ===== Toast =====
function showToast(message, isError) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.className = 'toast'; }, 2600);
}

// ===== Routing =====
function navigate(path, opts) {
  opts = opts || {};
  history.pushState({}, '', path);
  render(path, opts.params || {});
}

window.addEventListener('popstate', () => render(location.pathname, {}));

document.addEventListener('click', (e) => {
  const navEl = e.target.closest('[data-nav]');
  if (navEl) {
    e.preventDefault();
    navigate(navEl.dataset.nav);
  }
});

async function render(path, params) {
  const pages = document.querySelectorAll('.page');
  pages.forEach(p => p.classList.remove('active'));

  const isAuthPage = path === '/login';

  if (!isAuthPage && !currentUser) {
    try {
      currentUser = await api.me();
    } catch (e) {
      history.replaceState({}, '', '/login');
      document.getElementById('page-login').classList.add('active');
      return;
    }
  }

  if (isAuthPage) {
    document.getElementById('page-login').classList.add('active');
    return;
  }

  updateAvatars();

  if (path === '/library' || path === '/') {
    document.getElementById('page-library').classList.add('active');
    await loadLibrary();
  } else if (path.startsWith('/editor')) {
    document.getElementById('page-editor').classList.add('active');
    await loadEditor(params.novelId || currentEditorNovelId);
  } else if (path.startsWith('/reader')) {
    document.getElementById('page-reader').classList.add('active');
    await loadReader(params.novelId || currentReaderNovelId, params.chapterId);
  } else {
    navigate('/library');
  }
}

function updateAvatars() {
  const initial = currentUser ? (currentUser.displayName || currentUser.username || '?').slice(0, 2).toUpperCase() : '?';
  document.getElementById('user-avatar').textContent = initial;
  document.getElementById('editor-avatar').textContent = initial;
}

// ===== Auth: login/register/guest =====
document.getElementById('show-register').addEventListener('click', () => {
  document.getElementById('login-view').classList.remove('active');
  document.getElementById('register-view').classList.add('active');
});
document.getElementById('show-login').addEventListener('click', () => {
  document.getElementById('register-view').classList.remove('active');
  document.getElementById('login-view').classList.add('active');
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.classList.remove('show');
  const fd = new FormData(e.target);
  try {
    currentUser = await api.login(fd.get('username'), fd.get('password'));
    showToast(`ยินดีต้อนรับ ${currentUser.displayName}`);
    navigate('/library');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errEl = document.getElementById('register-error');
  errEl.classList.remove('show');
  const fd = new FormData(e.target);
  try {
    currentUser = await api.register(fd.get('username'), fd.get('password'), fd.get('displayName'));
    showToast(`สร้างบัญชีสำเร็จ ยินดีต้อนรับ ${currentUser.displayName}`);
    navigate('/library');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.add('show');
  }
});

document.getElementById('guest-btn').addEventListener('click', async () => {
  try {
    currentUser = await api.guest();
    showToast('เข้าใช้งานแบบผู้เยี่ยมชม');
    navigate('/library');
  } catch (err) {
    showToast(err.message, true);
  }
});

function doLogout() {
  api.logout().finally(() => {
    currentUser = null;
    currentNovel = null;
    currentChapter = null;
    navigate('/login');
    showToast('ออกจากระบบแล้ว');
  });
}
document.getElementById('user-avatar').addEventListener('click', doLogout);
document.getElementById('editor-avatar').addEventListener('click', doLogout);

// ===== LIBRARY PAGE =====
async function loadLibrary() {
  let novels = [];
  try {
    novels = await api.listNovels();
  } catch (err) {
    showToast(err.message, true);
    return;
  }

  // Hero: most recently updated novel
  const heroBtn = document.getElementById('hero-btn');
  if (novels.length > 0) {
    const latest = novels[0];
    document.getElementById('hero-title').textContent = `${latest.title} — ${latest.chapter_count} ตอน`;
    document.getElementById('hero-sub').textContent = latest.chapter_count > 0
      ? 'บันทึกในฐานข้อมูล อัปเดตล่าสุดเมื่อไม่นานนี้'
      : 'ยังไม่มีตอนในนิยายเรื่องนี้ เริ่มเขียนตอนแรกได้เลย';
    heroBtn.innerHTML = '<i class="ti ti-player-play"></i> เขียนต่อ';
    heroBtn.onclick = () => navigate(`/editor?novel=${latest.id}`, { params: { novelId: latest.id } });
    currentEditorNovelId = latest.id;
  } else {
    document.getElementById('hero-title').textContent = 'ยังไม่มีนิยายที่กำลังเขียน';
    document.getElementById('hero-sub').textContent = 'เริ่มต้นเรื่องราวใหม่ของคุณได้เลยตอนนี้';
    heroBtn.innerHTML = '<i class="ti ti-plus"></i> เริ่มนิยายใหม่';
    heroBtn.onclick = () => openNewNovelFlow();
  }

  renderLibraryGrid(novels);
}

function renderLibraryGrid(novels) {
  const grid = document.getElementById('library-grid');
  grid.innerHTML = '';

  novels.forEach(novel => {
    const card = document.createElement('div');
    card.className = 'novel-card';
    card.style.minWidth = '0';
    card.innerHTML = `
      <div class="cover" style="height:150px; background:${novel.cover_gradient};">
        <span>${escapeHtml(novel.title)}</span>
        ${manageMode ? '<span class="badge" style="left:auto; right:8px; background:rgba(197,48,48,0.9); color:#fff;" data-action="delete"><i class="ti ti-trash"></i></span>' : ''}
      </div>
      <p class="title">${escapeHtml(novel.title)}</p>
      <p class="meta">${novel.chapter_count} ตอน${novel.genre ? ' · ' + escapeHtml(novel.genre) : ''}</p>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action="delete"]')) {
        e.stopPropagation();
        confirmDeleteNovel(novel);
        return;
      }
      navigate(`/editor?novel=${novel.id}`, { params: { novelId: novel.id } });
    });
    grid.appendChild(card);
  });

  const addCard = document.createElement('div');
  addCard.className = 'novel-card';
  addCard.style.cssText = 'min-width:0; display:flex; align-items:center; justify-content:center; flex-direction:column; border:1px dashed var(--glass-border); border-radius:12px; height:150px; cursor:pointer; color:var(--accent);';
  addCard.innerHTML = '<i class="ti ti-plus" style="font-size:26px; margin-bottom:6px;"></i><span style="font-size:12px;">เริ่มนิยายใหม่</span>';
  addCard.addEventListener('click', openNewNovelFlow);
  grid.appendChild(addCard);

  if (novels.length === 0) {
    // Add-card still shows; nothing else needed
  }
}

document.getElementById('manage-toggle').addEventListener('click', async () => {
  manageMode = !manageMode;
  document.getElementById('manage-toggle').textContent = manageMode ? 'เสร็จสิ้น' : 'จัดการ';
  const novels = await api.listNovels();
  renderLibraryGrid(novels);
});

async function confirmDeleteNovel(novel) {
  if (!confirm(`ลบ "${novel.title}" ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
  try {
    await api.deleteNovel(novel.id);
    showToast('ลบนิยายแล้ว');
    loadLibrary();
  } catch (err) {
    showToast(err.message, true);
  }
}

async function openNewNovelFlow() {
  const title = prompt('ตั้งชื่อนิยายเรื่องใหม่:');
  if (!title || !title.trim()) return;
  const genre = prompt('ประเภทนิยาย (ไม่บังคับ):') || '';
  try {
    const novel = await api.createNovel(title.trim(), genre.trim());
    showToast('สร้างนิยายใหม่แล้ว');
    navigate(`/editor?novel=${novel.id}`, { params: { novelId: novel.id } });
  } catch (err) {
    showToast(err.message, true);
  }
}

// ===== EDITOR PAGE =====
let currentEditorNovelId = null;

async function loadEditor(novelId) {
  novelId = novelId || getQueryParam('novel');
  if (!novelId) { navigate('/library'); return; }
  currentEditorNovelId = novelId;

  try {
    currentNovel = await api.getNovel(novelId);
  } catch (err) {
    showToast(err.message, true);
    navigate('/library');
    return;
  }

  document.getElementById('editor-novel-title').textContent = currentNovel.title;
  renderChapterList();

  if (currentNovel.chapters.length > 0) {
    await selectChapter(currentNovel.chapters[currentNovel.chapters.length - 1].id);
  } else {
    clearEditorFields();
  }
}

function renderChapterList() {
  const list = document.getElementById('chapter-list');
  list.innerHTML = '';
  currentNovel.chapters.forEach(ch => {
    const item = document.createElement('div');
    item.className = 'chapter-item' + (currentChapter && currentChapter.id === ch.id ? ' active' : '');
    item.innerHTML = `<span>${currentChapter && currentChapter.id === ch.id ? '<i class="ti ti-edit" style="font-size:13px;"></i> ' : ''}ตอนที่ ${ch.chapter_number} — ${escapeHtml(ch.title || '')}</span>`;
    item.addEventListener('click', () => selectChapter(ch.id));
    list.appendChild(item);
  });
}

async function selectChapter(chapterId) {
  try {
    currentChapter = await api.getChapter(chapterId);
  } catch (err) {
    showToast(err.message, true);
    return;
  }
  document.getElementById('chapter-title-input').value = currentChapter.title;
  document.getElementById('chapter-content-input').value = currentChapter.content;
  updateWordCount();
  renderChapterList();
}

function clearEditorFields() {
  currentChapter = null;
  document.getElementById('chapter-title-input').value = '';
  document.getElementById('chapter-content-input').value = '';
  updateWordCount();
}

document.getElementById('add-chapter-btn').addEventListener('click', async () => {
  if (!currentNovel) return;
  try {
    const chapter = await api.createChapter(currentNovel.id, {});
    currentNovel.chapters.push({
      id: chapter.id, chapter_number: chapter.chapter_number,
      title: chapter.title, word_count: chapter.word_count, updated_at: chapter.updated_at,
    });
    showToast('เพิ่มตอนใหม่แล้ว');
    await selectChapter(chapter.id);
  } catch (err) {
    showToast(err.message, true);
  }
});

function updateWordCount() {
  const text = document.getElementById('chapter-content-input').value.trim();
  const count = text ? text.split(/\s+/).length : 0;
  document.getElementById('word-count-display').textContent = `${count.toLocaleString('th-TH')} คำ`;
}

function scheduleAutosave() {
  const statusEl = document.getElementById('save-status');
  statusEl.innerHTML = '<i class="ti ti-loader-2"></i> กำลังบันทึก...';
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveCurrentChapter, 900);
}

async function saveCurrentChapter() {
  if (!currentChapter) return;
  const title = document.getElementById('chapter-title-input').value;
  const content = document.getElementById('chapter-content-input').value;
  const statusEl = document.getElementById('save-status');

  try {
    const updated = await api.updateChapter(currentChapter.id, { title, content });
    currentChapter = updated;
    const idx = currentNovel.chapters.findIndex(c => c.id === updated.id);
    if (idx >= 0) {
      currentNovel.chapters[idx].title = updated.title;
      currentNovel.chapters[idx].word_count = updated.word_count;
    }
    renderChapterList();
    statusEl.innerHTML = '<i class="ti ti-circle-check" style="color:#2f855a;"></i> บันทึกอัตโนมัติแล้ว';
  } catch (err) {
    statusEl.innerHTML = '<i class="ti ti-alert-circle" style="color:#c53030;"></i> บันทึกไม่สำเร็จ';
    showToast(err.message, true);
  }
}

document.getElementById('chapter-title-input').addEventListener('input', scheduleAutosave);
document.getElementById('chapter-content-input').addEventListener('input', () => {
  updateWordCount();
  scheduleAutosave();
});
document.getElementById('manual-save-btn').addEventListener('click', () => {
  clearTimeout(autosaveTimer);
  saveCurrentChapter();
});

// ===== READER PAGE =====
let currentReaderNovelId = null;
let readerChapterIndex = 0;

async function loadReader(novelId, chapterId) {
  novelId = novelId || getQueryParam('novel') || currentEditorNovelId;
  if (!novelId) { navigate('/library'); return; }
  currentReaderNovelId = novelId;

  try {
    currentNovel = await api.getNovel(novelId);
  } catch (err) {
    showToast(err.message, true);
    navigate('/library');
    return;
  }

  if (currentNovel.chapters.length === 0) {
    showToast('นิยายเรื่องนี้ยังไม่มีตอน', true);
    navigate('/library');
    return;
  }

  document.getElementById('reader-novel-title').textContent = currentNovel.title;

  let targetChapterId = chapterId || getQueryParam('chapter');
  if (!targetChapterId) {
    try {
      const progress = await api.getProgress(novelId);
      targetChapterId = progress.chapter_id;
    } catch (e) { /* ignore */ }
  }

  readerChapterIndex = targetChapterId
    ? currentNovel.chapters.findIndex(c => String(c.id) === String(targetChapterId))
    : currentNovel.chapters.length - 1;
  if (readerChapterIndex < 0) readerChapterIndex = 0;

  await renderReaderChapter();
}

async function renderReaderChapter() {
  const chMeta = currentNovel.chapters[readerChapterIndex];
  const chapter = await api.getChapter(chMeta.id);
  currentChapter = chapter;

  document.getElementById('reader-chapter-title').textContent = `ตอนที่ ${chapter.chapter_number} — ${chapter.title}`;
  document.getElementById('reader-chapter-heading').textContent = chapter.title;

  const contentEl = document.getElementById('reader-content');
  contentEl.innerHTML = '';
  const paragraphs = (chapter.content || 'ตอนนี้ยังไม่มีเนื้อหา').split(/\n+/).filter(Boolean);
  paragraphs.forEach(p => {
    const pEl = document.createElement('p');
    pEl.textContent = p;
    contentEl.appendChild(pEl);
  });

  const percent = Math.round(((readerChapterIndex + 1) / currentNovel.chapters.length) * 100);
  document.getElementById('reader-progress-fill').style.width = percent + '%';

  document.getElementById('prev-chapter-btn').toggleAttribute('disabled', readerChapterIndex === 0);
  document.getElementById('next-chapter-btn').toggleAttribute('disabled', readerChapterIndex === currentNovel.chapters.length - 1);

  try {
    await api.setProgress(currentNovel.id, { chapterId: chapter.id, percent });
  } catch (e) { /* non-critical */ }

  history.replaceState({}, '', `/reader?novel=${currentNovel.id}&chapter=${chapter.id}`);
}

document.getElementById('prev-chapter-btn').addEventListener('click', async () => {
  if (readerChapterIndex > 0) {
    readerChapterIndex--;
    await renderReaderChapter();
  }
});
document.getElementById('next-chapter-btn').addEventListener('click', async () => {
  if (readerChapterIndex < currentNovel.chapters.length - 1) {
    readerChapterIndex++;
    await renderReaderChapter();
  }
});

// Disable text selection / copy shortcuts on reader body
document.getElementById('reader-body').addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('keydown', (e) => {
  const onReader = document.getElementById('page-reader').classList.contains('active');
  if (onReader && (e.ctrlKey || e.metaKey) && ['c', 'C'].includes(e.key)) {
    e.preventDefault();
  }
});

// ===== Utilities =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

// Wire navigate() to also parse query params for editor/reader on plain path clicks
const _origNavigate = navigate;
navigate = function (path, opts) {
  opts = opts || {};
  if (!opts.params) {
    const [base, qs] = path.split('?');
    const params = {};
    if (qs) {
      const usp = new URLSearchParams(qs);
      if (usp.get('novel')) params.novelId = usp.get('novel');
      if (usp.get('chapter')) params.chapterId = usp.get('chapter');
    }
    opts.params = params;
  }
  _origNavigate(path, opts);
};

// ===== Init =====
render(location.pathname === '/' ? '/library' : location.pathname, (() => {
  const usp = new URLSearchParams(location.search);
  const params = {};
  if (usp.get('novel')) params.novelId = usp.get('novel');
  if (usp.get('chapter')) params.chapterId = usp.get('chapter');
  return params;
})());
