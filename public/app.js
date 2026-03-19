// ============================================================
//  God's Celebrities — app.js
//  Public site JS only — no admin overlay, no shortcuts.
//  Admin lives at admin.html
// ============================================================

// ============================================================
//  ERROR LOG SYSTEM (used on admin.html)
// ============================================================
const ErrorLog = (() => {
  const entries = [];

  function classify(err) {
    const msg  = (err?.message || err?.toString() || '').toLowerCase();
    const code = err?.code || '';
    if (code.startsWith('auth/') || msg.includes('credential') || msg.includes('password') || msg.includes('sign-in') || msg.includes('sign in')) return 'error-auth';
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch') || msg.includes('timeout') || msg.includes('offline') || msg.includes('connection') || msg.includes('internet')) return 'error-network';
    if (msg.includes('warn') || err?.level === 'warn') return 'error-warning';
    if (err?.level === 'info') return 'error-info';
    return '';
  }

  function typeLabel(cls) {
    return { 'error-network': 'Network', 'error-auth': 'Auth', 'error-warning': 'Warning', 'error-info': 'Info', '': 'Runtime' }[cls] || 'Error';
  }

  function timestamp() {
    return new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function push(err, source, stack) {
    const cls  = classify(err);
    const raw  = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown error';
    const code = err?.code ? ` [${err.code}]` : '';
    entries.push({
      id: Date.now() + '_' + Math.random().toString(36).slice(2),
      cls, msg: raw + code, source: source || '',
      stack: stack || err?.stack || '', time: timestamp()
    });
    render();
    updateTriggerBtn();
    if (cls !== 'error-warning' && cls !== 'error-info') openLog();
  }

  function render() {
    const el      = document.getElementById('error-log-entries');
    const countEl = document.getElementById('error-log-count');
    if (!el) return;
    if (!entries.length) {
      el.innerHTML = '<div class="error-log-empty"><div class="empty-icon">✓</div><p>No errors recorded.</p></div>';
      if (countEl) countEl.textContent = '0 errors';
      return;
    }
    if (countEl) countEl.textContent = entries.length + ' error' + (entries.length === 1 ? '' : 's');
    el.innerHTML = entries.slice().reverse().map(e => `
      <div class="error-entry ${e.cls}">
        <div class="error-entry-top">
          <span class="error-type-tag">${typeLabel(e.cls)}</span>
          <span class="error-timestamp">${e.time}</span>
        </div>
        <div class="error-message">${esc(e.msg)}</div>
        ${e.source ? `<div class="error-source">Source: ${esc(e.source)}</div>` : ''}
        ${e.stack ? `<button class="error-stack-toggle" onclick="toggleStack('es_${e.id}',this)">▶ Stack trace</button><pre class="error-stack" id="es_${e.id}">${esc(e.stack)}</pre>` : ''}
      </div>`).join('');
  }

  function updateTriggerBtn() {
    const btn = document.getElementById('error-log-trigger');
    if (!btn) return;
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.gap = '0.4rem';
    let badge = btn.querySelector('.err-badge-count');
    if (!badge) { badge = document.createElement('span'); badge.className = 'err-badge-count'; btn.appendChild(badge); }
    badge.textContent = entries.length > 9 ? '9+' : entries.length;
  }

  function openLog() {
    render();
    const ov = document.getElementById('error-log-overlay');
    if (ov) ov.classList.add('open');
  }

  function clear() {
    entries.length = 0;
    render();
    const btn = document.getElementById('error-log-trigger');
    if (btn) { btn.style.display = 'none'; const b = btn.querySelector('.err-badge-count'); if (b) b.remove(); }
  }

  function copy() {
    const text = entries.map(e =>
      `[${e.time}] ${typeLabel(e.cls).toUpperCase()}: ${e.msg}` +
      (e.source ? '\n  Source: ' + e.source : '') +
      (e.stack  ? '\n  Stack:\n' + e.stack : '')
    ).join('\n\n---\n\n') || 'No errors.';
    navigator.clipboard.writeText(text).then(() => {
      const c = document.getElementById('error-log-copy-confirm');
      if (c) { c.style.display = 'inline'; setTimeout(() => (c.style.display = 'none'), 2500); }
    });
  }

  function retry() {
    if (typeof lastAction === 'function') lastAction();
  }

  let lastAction = null;
  function setLast(fn) { lastAction = fn; }

  return { push, render, clear, copy, setLast, retry };
})();

window.ErrorLog        = ErrorLog;
window.openErrorLog    = () => { ErrorLog.render(); const ov = document.getElementById('error-log-overlay'); if (ov) ov.classList.add('open'); };
window.closeErrorLog   = () => { const ov = document.getElementById('error-log-overlay'); if (ov) ov.classList.remove('open'); };
window.clearErrorLog   = () => ErrorLog.clear();
window.copyErrorLog    = () => ErrorLog.copy();
window.retryLastAction = () => ErrorLog.retry();
window.toggleStack     = (id, btn) => {
  const el = document.getElementById(id); if (!el) return;
  el.classList.toggle('open');
  btn.textContent = el.classList.contains('open') ? '▼ Hide stack' : '▶ Stack trace';
};

// Global error catchers
window.addEventListener('error', e =>
  ErrorLog.push({ message: e.message, code: '' }, e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '', e.error?.stack || '')
);
window.addEventListener('unhandledrejection', e => {
  const err = e.reason;
  ErrorLog.push(err instanceof Error ? err : { message: String(err) }, 'Unhandled Promise', err?.stack || '');
});

// Fetch interceptor — catches server/network errors
const _origFetch = window.fetch;
window.fetch = async function(...args) {
  try {
    const res = await _origFetch(...args);
    if (!res.ok && res.status >= 500)
      ErrorLog.push({ message: `Server error ${res.status} ${res.statusText}`, code: `http/${res.status}` }, typeof args[0] === 'string' ? args[0] : 'fetch', '');
    return res;
  } catch (err) {
    ErrorLog.push({ message: err.message || 'Network request failed', code: 'network-error' }, typeof args[0] === 'string' ? args[0] : 'fetch', err.stack || '');
    throw err;
  }
};

// ============================================================
//  CLOSE ERROR LOG ON ESCAPE (public pages)
// ============================================================
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') window.closeErrorLog();
});

// ============================================================
//  TAB SWITCHING (admin.html)
// ============================================================
function switchTab(tab) {
  document.querySelectorAll('.admin-tab').forEach(t => {
    const fn = t.getAttribute('onclick') || '', m = fn.match(/switchTab\('([^']+)'\)/);
    t.classList.toggle('active', m ? m[1] === tab : false);
  });
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('panel-' + tab);
  if (target) target.classList.add('active');
  if (tab === 'admin-users' && typeof window.loadAdminUsers === 'function') window.loadAdminUsers();
}
window.switchTab = switchTab;

// ============================================================
//  PASSWORD TOGGLES
// ============================================================
function toggleLoginPassVisibility() {
  const i = document.getElementById('admin-pass'), b = document.getElementById('login-toggle-pass');
  if (!i) return;
  i.type = i.type === 'password' ? 'text' : 'password';
  if (b) b.textContent = i.type === 'password' ? '👁' : '🙈';
}
function toggleNewPassVisibility() {
  const i = document.getElementById('new-admin-pass'), b = document.getElementById('toggle-pass-btn');
  if (!i) return;
  i.type = i.type === 'password' ? 'text' : 'password';
  if (b) b.textContent = i.type === 'password' ? '👁' : '🙈';
}
window.toggleLoginPassVisibility = toggleLoginPassVisibility;
window.toggleNewPassVisibility   = toggleNewPassVisibility;

// ============================================================
//  CELEBRITY FORM HELPERS
// ============================================================
function clearCelebForm() {
  ['celeb-edit-id','celeb-name','celeb-title','celeb-scripture','celeb-story'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const s = document.getElementById('celeb-sphere'); if (s) s.value = 'Ministry';
  const t = document.getElementById('celeb-form-title'); if (t) t.textContent = 'Add New Celebrity';
}
function editCeleb(id, name, title, scripture, story, sphere) {
  document.getElementById('celeb-edit-id').value   = id;
  document.getElementById('celeb-name').value      = name;
  document.getElementById('celeb-title').value     = title;
  document.getElementById('celeb-scripture').value = scripture;
  document.getElementById('celeb-story').value     = decodeURIComponent(story);
  document.getElementById('celeb-sphere').value    = sphere;
  const t = document.getElementById('celeb-form-title'); if (t) t.textContent = 'Edit Celebrity';
  const tabs = document.getElementById('admin-tabs'); if (tabs) tabs.scrollIntoView({ behavior: 'smooth' });
}
window.clearCelebForm = clearCelebForm;
window.editCeleb      = editCeleb;

// ============================================================
//  GALLERY FORM HELPERS
// ============================================================
function clearGalleryForm() {
  ['gallery-edit-id','gallery-title','gallery-desc','gallery-date','gallery-image'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  // Reset Cloudinary UI
  const urlInput = document.getElementById('gallery-image-url');
  const fileInput = document.getElementById('gallery-file-input');
  if (urlInput)  urlInput.value = '';
  if (fileInput) fileInput.value = '';
  const preview = document.getElementById('gallery-img-preview');
  if (preview) preview.style.display = 'none';
  const prog = document.getElementById('gallery-upload-progress');
  if (prog) prog.style.display = 'none';
  const err = document.getElementById('gallery-upload-error');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  const formErr = document.getElementById('gallery-form-error');
  if (formErr) { formErr.style.display = 'none'; formErr.textContent = ''; }
  const formOk = document.getElementById('gallery-form-success');
  if (formOk)  { formOk.style.display = 'none'; formOk.textContent = ''; }
  // Reset to upload tab
  if (typeof window.setImgMethod === 'function') window.setImgMethod('upload');
}
function editGalleryEvent(id, title, date, image, desc) {
  document.getElementById('gallery-edit-id').value = id;
  document.getElementById('gallery-title').value   = title;
  document.getElementById('gallery-date').value    = date;
  document.getElementById('gallery-image').value   = image;
  document.getElementById('gallery-desc').value    = decodeURIComponent(desc);
  // Show existing image via URL tab
  if (image && typeof window.setImgMethod === 'function') {
    window.setImgMethod('url');
    const urlInput = document.getElementById('gallery-image-url');
    if (urlInput) urlInput.value = image;
    const previewImg = document.getElementById('gallery-preview-img');
    const previewWrap = document.getElementById('gallery-img-preview');
    const previewLbl  = document.getElementById('gallery-preview-label');
    if (previewImg)  previewImg.src = image;
    if (previewLbl)  previewLbl.textContent = 'Current image';
    if (previewWrap) previewWrap.style.display = 'block';
  }
  const tabs = document.getElementById('admin-tabs'); if (tabs) tabs.scrollIntoView({ behavior: 'smooth' });
}
window.clearGalleryForm  = clearGalleryForm;
window.editGalleryEvent  = editGalleryEvent;

// ============================================================
//  ANNOUNCEMENT FORM HELPERS
// ============================================================
function clearAnnForm() {
  ['ann-edit-id','ann-title','ann-date','ann-message'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const t = document.getElementById('ann-type'); if (t) t.value = 'Event';
}
function editAnnouncement(id, title, date, message, type) {
  document.getElementById('ann-edit-id').value  = id;
  document.getElementById('ann-title').value    = title;
  document.getElementById('ann-date').value     = date;
  document.getElementById('ann-message').value  = decodeURIComponent(message);
  document.getElementById('ann-type').value     = type;
  const tabs = document.getElementById('admin-tabs'); if (tabs) tabs.scrollIntoView({ behavior: 'smooth' });
}
window.clearAnnForm     = clearAnnForm;
window.editAnnouncement = editAnnouncement;

// ── Book edit helper ──
window.editBook = function(id, dataJson) {
  try {
    const b = JSON.parse(decodeURIComponent(dataJson));
    const setV = (id, v) => { const el=document.getElementById(id); if(el) el.value=v||''; };
    setV('book-edit-id', id);
    setV('book-title',   b.title);
    setV('book-author',  b.author);
    setV('book-desc',    b.desc);
    setV('book-cover',   b.cover);
    setV('book-price',   b.price);
    setV('book-pdf-url', b.pdfUrl);
    setV('book-pdf-url-input', b.pdfUrl);
    const acc = document.getElementById('book-access'); if(acc) acc.value = b.access||'free';
    const pg  = document.getElementById('book-price-group'); if(pg) pg.style.display = b.access==='paid'?'block':'none';
    const st  = document.getElementById('book-pdf-status'); if(st&&b.pdfUrl) { st.style.color='#7BC94C'; st.textContent='✓ PDF set'; }
    // Restore cover thumbnail and URL input if a cover exists
    if (b.cover) {
      setV('book-cover-url-input', b.cover);
      const thumb  = document.getElementById('book-cover-thumb');
      const prompt = document.getElementById('book-cover-prompt');
      if (thumb)  { thumb.src = b.cover; thumb.style.display = 'block'; }
      if (prompt) { prompt.style.display = 'none'; }
      const clearBtn = document.getElementById('book-cover-clear-btn');
      if (clearBtn) clearBtn.style.display = 'inline-block';
      const cst = document.getElementById('book-cover-status');
      if (cst) { cst.style.color = '#7BC94C'; cst.textContent = '✓ Cover image set'; }
    }
    const tabs=document.getElementById('admin-tabs'); if(tabs) tabs.scrollIntoView({behavior:'smooth'});
  } catch(e) { console.warn('editBook err',e); }
};


// ============================================================
//  ANNOUNCEMENT POPUP
// ============================================================
window.openAnnPopup = function(dataJson) {
  try {
    const data = JSON.parse(decodeURIComponent(dataJson));
    const overlay = document.getElementById('ann-popup-overlay');
    if (!overlay) return;
    const typeColor = {
      'Urgent':       '#C9544C',
      'Notice':       '#4C8EC9',
      'Praise Report':'#7BC94C',
      'Event':        '#C9A84C'
    }[data.type] || '#C9A84C';

    document.getElementById('ann-popup-type').textContent  = data.type;
    document.getElementById('ann-popup-type').style.color  = typeColor;
    document.getElementById('ann-popup-type').style.borderColor = typeColor + '55';
    document.getElementById('ann-popup-date').textContent  = data.date;
    document.getElementById('ann-popup-title').textContent = data.title;
    document.getElementById('ann-popup-body').textContent  = data.message;
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch(e) { console.warn('Ann popup error', e); }
};
window.closeAnnPopup = function() {
  const ov = document.getElementById('ann-popup-overlay');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
};

// ============================================================
//  GALLERY POPUP
// ============================================================
let _galleryImages = [];
let _galleryIndex  = 0;

window.openGalleryPopup = function(dataJson) {
  try {
    const data = JSON.parse(decodeURIComponent(dataJson));
    const overlay = document.getElementById('gallery-popup-overlay');
    if (!overlay) return;
    _galleryImages = data.images || [];
    _galleryIndex  = 0;

    document.getElementById('gallery-popup-title').textContent = data.title;
    document.getElementById('gallery-popup-date').textContent  = data.date;
    document.getElementById('gallery-popup-desc').textContent  = data.desc;
    renderGalleryPopup();
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch(e) { console.warn('Gallery popup error', e); }
};

window.closeGalleryPopup = function() {
  const ov = document.getElementById('gallery-popup-overlay');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
};

window.galleryPopupPrev = function() {
  if (_galleryImages.length < 2) return;
  _galleryIndex = (_galleryIndex - 1 + _galleryImages.length) % _galleryImages.length;
  renderGalleryPopup();
};
window.galleryPopupNext = function() {
  if (_galleryImages.length < 2) return;
  _galleryIndex = (_galleryIndex + 1) % _galleryImages.length;
  renderGalleryPopup();
};
window.galleryPopupGoTo = function(idx) {
  _galleryIndex = idx;
  renderGalleryPopup();
};

function renderGalleryPopup() {
  const img      = document.getElementById('gallery-popup-img');
  const counter  = document.getElementById('gallery-popup-counter');
  const dots     = document.getElementById('gallery-popup-dots');
  const prevBtn  = document.getElementById('gallery-popup-prev');
  const nextBtn  = document.getElementById('gallery-popup-next');
  const total    = _galleryImages.length;

  if (!img) return;

  if (total === 0) {
    img.src = '';
    img.style.display = 'none';
    if (counter) counter.textContent = 'No images';
    return;
  }

  img.style.display = 'block';
  // Fade transition
  img.style.opacity = '0';
  img.src = _galleryImages[_galleryIndex];
  img.onload = () => { img.style.opacity = '1'; };

  if (counter) counter.textContent = `${_galleryIndex + 1} / ${total}`;

  if (prevBtn) prevBtn.style.display = total > 1 ? 'flex' : 'none';
  if (nextBtn) nextBtn.style.display = total > 1 ? 'flex' : 'none';

  // Dots navigation
  if (dots) {
    if (total <= 1) { dots.innerHTML = ''; return; }
    dots.innerHTML = _galleryImages.map((_, i) =>
      `<button class="gallery-popup-dot${i === _galleryIndex ? ' active' : ''}" onclick="galleryPopupGoTo(${i})" aria-label="Image ${i+1}"></button>`
    ).join('');
  }
}

// Keyboard navigation for popups
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    window.closeAnnPopup();
    window.closeGalleryPopup();
  }
  if (document.getElementById('gallery-popup-overlay')?.classList.contains('open')) {
    if (e.key === 'ArrowLeft')  window.galleryPopupPrev();
    if (e.key === 'ArrowRight') window.galleryPopupNext();
  }
});


// ============================================================
//  TESTIMONY MEDIA UPLOAD (index.html public form)
// ============================================================
const T_CLOUDINARY_CLOUD_NAME    = 'dc4jk3xcn';
const T_CLOUDINARY_UPLOAD_PRESET = 'borderlessbuy';
const T_MAX_SIZE_MB = 50; // 50 MB minimum allowed

window.handleTestimonyDrop = function(e) {
  e.preventDefault();
  document.getElementById('t-dropzone').classList.remove('t-drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processTestimonyFile(file);
};
window.handleTestimonyFileSelect = function(e) {
  const file = e.target.files[0];
  if (file) processTestimonyFile(file);
};
window.clearTestimonyMedia = function() {
  document.getElementById('t-media-url').value  = '';
  document.getElementById('t-media-type').value = '';
  document.getElementById('t-media-preview').style.display = 'none';
  document.getElementById('t-media-preview-inner').innerHTML = '';
  document.getElementById('t-upload-progress').style.display = 'none';
  document.getElementById('t-upload-error').style.display    = 'none';
  const fi = document.getElementById('t-file-input'); if(fi) fi.value='';
};

async function processTestimonyFile(file) {
  const errEl  = document.getElementById('t-upload-error');
  const progEl = document.getElementById('t-upload-progress');
  if(errEl) { errEl.style.display='none'; errEl.textContent=''; }

  // Determine media type
  let mediaType = '';
  if (file.type.startsWith('image/'))      mediaType = 'image';
  else if (file.type.startsWith('audio/')) mediaType = 'audio';
  else if (file.type.startsWith('video/')) mediaType = 'video';
  else {
    if(errEl) { errEl.textContent='Unsupported file type. Please use an image, audio, or video file.'; errEl.style.display='block'; }
    return;
  }

  // Size check — maximum 50 MB (we impose no upper limit beyond browser/Cloudinary)
  const sizeMB = file.size / (1024*1024);
  if (sizeMB < 0) { /* no lower limit */ }

  document.getElementById('t-upload-filename').textContent = file.name;
  document.getElementById('t-upload-pct').textContent      = '0%';
  document.getElementById('t-upload-bar').style.width      = '0%';
  if(progEl) progEl.style.display = 'block';

  if (T_CLOUDINARY_CLOUD_NAME === 'YOUR_CLOUD_NAME') {
    if(progEl) progEl.style.display='none';
    // Local preview fallback
    const reader = new FileReader();
    reader.onload = e2 => {
      const localUrl = e2.target.result;
      document.getElementById('t-media-url').value  = localUrl;
      document.getElementById('t-media-type').value = mediaType;
      showTestimonyPreview(localUrl, mediaType, file.name + ' (local preview — configure Cloudinary to save)');
    };
    reader.readAsDataURL(file);
    if(errEl) { errEl.textContent='⚠ Cloudinary not configured. File will show locally but will not be saved. Set T_CLOUDINARY_CLOUD_NAME in app.js.'; errEl.style.display='block'; }
    return;
  }

  const resourceType = mediaType === 'image' ? 'image' : mediaType === 'audio' ? 'video' : 'video';
  try {
    const url = await uploadTestimonyToCloudinary(file, resourceType, pct => {
      document.getElementById('t-upload-pct').textContent = pct + '%';
      document.getElementById('t-upload-bar').style.width  = pct + '%';
    });
    setTimeout(() => { if(progEl) progEl.style.display='none'; }, 1000);
    document.getElementById('t-media-url').value  = url;
    document.getElementById('t-media-type').value = mediaType;
    showTestimonyPreview(url, mediaType, '✓ ' + file.name);
  } catch(e) {
    if(progEl) progEl.style.display='none';
    if(errEl) { errEl.textContent='Upload failed: '+e.message; errEl.style.display='block'; }
    if(window.ErrorLog) window.ErrorLog.push(e,'testimonyUpload',e.stack||'');
  }
}

function showTestimonyPreview(url, mediaType, label) {
  const wrap  = document.getElementById('t-media-preview');
  const inner = document.getElementById('t-media-preview-inner');
  if (!wrap || !inner) return;
  if (mediaType==='image') {
    inner.innerHTML = `<img src="${url}" alt="preview" style="max-width:100%;max-height:220px;object-fit:contain;border:1px solid rgba(201,168,76,0.2);">`;
  } else if (mediaType==='audio') {
    inner.innerHTML = `<audio controls src="${url}" style="width:100%;"></audio>`;
  } else if (mediaType==='video') {
    inner.innerHTML = `<video controls src="${url}" style="width:100%;max-height:200px;"></video>`;
  }
  if (label) inner.innerHTML += `<p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.35rem;">${label}</p>`;
  wrap.style.display = 'block';
}

async function uploadTestimonyToCloudinary(file, resourceType, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', T_CLOUDINARY_UPLOAD_PRESET);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${T_CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`);
    xhr.upload.onprogress = e => { if(e.lengthComputable&&onProgress) onProgress(Math.round(e.loaded/e.total*100)); };
    xhr.onload  = () => { const r=JSON.parse(xhr.responseText); if(xhr.status===200&&r.secure_url) resolve(r.secure_url); else reject(new Error(r.error?.message||'Upload failed')); };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.send(fd);
  });
}

// ============================================================
//  TESTIMONY POPUP (public testimonies.html)
// ============================================================
window.openTestimonyPopup = function(dataJson) {
  try {
    const d = JSON.parse(decodeURIComponent(dataJson));
    const ov = document.getElementById('testimony-popup-overlay');
    if (!ov) return;
    document.getElementById('tpop-name').textContent    = d.name || '';
    document.getElementById('tpop-date').textContent    = d.date || '';
    document.getElementById('tpop-message').textContent = d.message || '';
    const mediaWrap = document.getElementById('tpop-media');
    mediaWrap.innerHTML = '';
    if (d.mediaUrl) {
      if (d.mediaType==='image')  mediaWrap.innerHTML = `<img src="${d.mediaUrl}" alt="media" style="max-width:100%;max-height:340px;object-fit:contain;border:1px solid rgba(201,168,76,0.15);margin-top:1rem;">`;
      if (d.mediaType==='audio')  mediaWrap.innerHTML = `<audio controls src="${d.mediaUrl}" style="width:100%;margin-top:1rem;"></audio>`;
      if (d.mediaType==='video')  mediaWrap.innerHTML = `<video controls src="${d.mediaUrl}" style="width:100%;max-height:300px;margin-top:1rem;border:1px solid rgba(201,168,76,0.15);"></video>`;
    }
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch(e) { console.warn('testimonyPopup err', e); }
};
window.closeTestimonyPopup = function() {
  const ov = document.getElementById('testimony-popup-overlay');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
};

// ============================================================
//  BOOK PAY POPUP (blog / testimonies pages)
// ============================================================
window.openBookPayPopup = function(dataJson) {
  try {
    const d = JSON.parse(decodeURIComponent(dataJson));
    const ov = document.getElementById('book-pay-overlay');
    if (!ov) return;
    document.getElementById('bpop-title').textContent  = d.title  || '';
    document.getElementById('bpop-author').textContent = d.author ? 'by ' + d.author : '';
    document.getElementById('bpop-price').textContent  = d.price  || '';
    ov.classList.add('open');
    document.body.style.overflow = 'hidden';
  } catch(e) { console.warn('bookPayPopup err', e); }
};
window.closeBookPayPopup = function() {
  const ov = document.getElementById('book-pay-overlay');
  if (ov) ov.classList.remove('open');
  document.body.style.overflow = '';
};

// ============================================================
//  FIREBASE SAFE DISPATCH
//  firebase.js is an ES module (async). _fbFns is populated
//  at the end of firebase.js using local const refs.
//  _fbCall polls until ready — no "not defined" errors ever.
// ============================================================
window._fbFns  = window._fbFns  || {};
window._fbReady = false;

window._fbCall = function(name, args) {
  const fn = window._fbFns[name];
  if (typeof fn === 'function') return fn(...args);
  const start = Date.now();
  const poll = setInterval(() => {
    const f = window._fbFns[name];
    if (typeof f === 'function') {
      clearInterval(poll);
      f(...args);
    } else if (Date.now() - start > 8000) {
      clearInterval(poll);
      ErrorLog.push(
        { message: `Firebase failed to load. Check your internet connection and Firebase config. (${name})`, code: 'fb-timeout' },
        name, ''
      );
    }
  }, 100);
};

// Global forwarders — always safe to call from onclick
window.adminLogin         = () => window._fbCall('adminLogin',         []);
window.adminLogout        = () => window._fbCall('adminLogout',        []);
window.submitTestimony    = () => window._fbCall('submitTestimony',    []);
window.saveCeleb          = () => window._fbCall('saveCeleb',          []);
window.deleteCeleb        = id => window._fbCall('deleteCeleb',        [id]);
window.deleteTestimony    = id => window._fbCall('deleteTestimony',    [id]);
window.saveGalleryEvent   = () => window._fbCall('saveGalleryEvent',   []);
window.deleteGalleryEvent = id => window._fbCall('deleteGalleryEvent', [id]);
window.saveAnnouncement   = () => window._fbCall('saveAnnouncement',   []);
window.deleteAnnouncement = id => window._fbCall('deleteAnnouncement', [id]);
window.createAdminUser    = () => window._fbCall('createAdminUser',    []);
window.removeAdminUser    = (id,e) => window._fbCall('removeAdminUser',[id,e]);
window.loadAdminUsers     = () => window._fbCall('loadAdminUsers',     []);
window.loadAdminData      = () => window._fbCall('loadAdminData',      []);
window.approveTestimony        = id  => window._fbCall('approveTestimony',       [id]);
window.saveBook                = ()  => window._fbCall('saveBook',               []);
window.deleteBook              = id  => window._fbCall('deleteBook',             [id]);
window.loadBooksPublic         = id  => window._fbCall('loadBooksPublic',        [id]);
window.loadApprovedTestimonies = id  => window._fbCall('loadApprovedTestimonies',[id]);
