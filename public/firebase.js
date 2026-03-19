// ============================================================
//  God's Celebrities — firebase.js
//  All functions declared as local consts first, then
//  registered into window._fbFns (used by app.js dispatcher)
//  AND assigned to window.X for legacy compatibility.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, updateDoc, serverTimestamp,
  query, orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInWithEmailAndPassword,
  signOut, onAuthStateChanged,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ---------- Firebase Config ----------
const firebaseConfig = {
  apiKey:            "AIzaSyBbAu27RCUnU2Bd7dUhjpHCQpaV6i_UHDg",
  authDomain:        "modanmic-ai-power-exams.firebaseapp.com",
  projectId:         "modanmic-ai-power-exams",
  storageBucket:     "modanmic-ai-power-exams.firebasestorage.app",
  messagingSenderId: "592742880638",
  appId:             "1:592742880638:web:ff788ba10a3a6e889e4f2f"
};

// ---------- Init ----------
const app          = initializeApp(firebaseConfig);
const db           = getFirestore(app);
const auth         = getAuth(app);
const secondaryApp = initializeApp(firebaseConfig, 'secondary');
const secondaryAuth = getAuth(secondaryApp);

// ---------- Helpers ----------
const showEl  = (id)      => { const e = document.getElementById(id); if (e) e.style.display = 'block'; };
const hideEl  = (id)      => { const e = document.getElementById(id); if (e) e.style.display = 'none'; };
const val     = (id)      => { const e = document.getElementById(id); return e ? e.value : ''; };
const setVal  = (id, v)   => { const e = document.getElementById(id); if (e) e.value = v; };
const setText = (id, t)   => { const e = document.getElementById(id); if (e) e.textContent = t; };
const errLog  = (e, src)  => { if (window.ErrorLog) window.ErrorLog.push(e, src, e?.stack || ''); };

// ---------- Auth State ----------
onAuthStateChanged(auth, (user) => {
  window._currentUser = user;
  if (user) {
    if (typeof window._adminPageShowDashboard === 'function') {
      window._adminPageShowDashboard(user.email);
    }
    // Use setTimeout(0) so all module-level consts are fully initialised before calling
    setTimeout(() => {
      if (typeof _loadAdminData === 'function') _loadAdminData();
    }, 0);
  } else {
    if (typeof window._adminPageShowLogin === 'function') {
      window._adminPageShowLogin();
    }
  }
});

// ============================================================
//  AUTH FUNCTIONS
// ============================================================

const _adminLogin = async () => {
  const email = val('admin-email');
  const pass  = val('admin-pass');
  const errEl = document.getElementById('login-error');
  const btn   = document.getElementById('login-btn');

  if (errEl) { errEl.textContent = ''; errEl.style.color = '#C9544C'; }
  if (!email || !pass) {
    if (errEl) errEl.textContent = 'Please enter your email and password.';
    return;
  }
  if (btn) { btn.disabled = true; btn.textContent = 'Signing in…'; }

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged handles the redirect — no manual DOM change needed here
  } catch (e) {
    errLog(e, 'adminLogin');
    const code = e.code || '';
    const msg =
      (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found')
        ? 'Incorrect email or password. Please try again.'
      : code === 'auth/invalid-email'
        ? 'Please enter a valid email address.'
      : code === 'auth/too-many-requests'
        ? 'Too many failed attempts. Please wait a moment and try again.'
      : code === 'auth/network-request-failed'
        ? 'Network error. Check your internet connection and try again.'
      : code === 'auth/user-disabled'
        ? 'This account has been disabled. Contact your administrator.'
      : 'Sign in failed: ' + e.message;
    if (errEl) errEl.textContent = msg;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Sign In →'; }
  }
};

const _adminLogout = async () => {
  await signOut(auth);
  // Redirect back to login screen on the admin page
  if (typeof window._adminPageShowLogin === 'function') window._adminPageShowLogin();
};

// ============================================================
//  ADMIN DATA LOADING
// ============================================================

const _loadAdminData = async () => {
  try {
    // Celebrities
    const csnap = await getDocs(query(collection(db, 'celebrities'), orderBy('createdAt', 'desc')));
    const list  = document.getElementById('admin-celeb-list');
    if (list) {
      list.innerHTML = '';
      csnap.forEach(d => {
        const data = d.data();
        list.innerHTML += `
          <div class="admin-item" id="item-${d.id}">
            <div class="admin-item-info">
              <strong>${data.name}</strong><span>${data.title}</span>
            </div>
            <div class="admin-item-actions">
              <button onclick="editCeleb('${d.id}','${data.name}','${data.title}','${data.scripture}','${encodeURIComponent(data.story)}','${data.sphere}')" class="btn-edit">Edit</button>
              <button onclick="deleteCeleb('${d.id}')" class="btn-del">Delete</button>
            </div>
          </div>`;
      });
    }

    // Testimonies
    const tsnap = await getDocs(query(collection(db, 'testimonies'), orderBy('createdAt', 'desc')));
    const tlist = document.getElementById('admin-testimony-list');
    if (tlist) {
      tlist.innerHTML = '';
      const filterMode = typeof window._getTCurrentFilter === 'function' ? window._getTCurrentFilter() : 'all';
      let shown = 0;
      tsnap.forEach(d => {
        const data = d.data();
        const isApproved = !!data.approved;
        if (filterMode === 'pending'  &&  isApproved) return;
        if (filterMode === 'approved' && !isApproved) return;
        shown++;
        const mediaIcon = data.mediaType === 'image' ? '🖼' : data.mediaType === 'audio' ? '🎵' : data.mediaType === 'video' ? '🎬' : '';
        const previewData = encodeURIComponent(JSON.stringify({
          id: d.id, name: data.name, message: data.message,
          mediaUrl: data.mediaUrl||'', mediaType: data.mediaType||'',
          approved: isApproved,
          date: data.createdAt?.toDate ? data.createdAt.toDate().toLocaleDateString() : ''
        }));
        tlist.innerHTML += `
          <div class="admin-item" id="titem-${d.id}">
            <div class="admin-item-info">
              <strong>${data.name} ${mediaIcon}</strong>
              <span style="display:flex;align-items:center;gap:0.5rem;">
                <span style="font-size:0.68rem;padding:0.15rem 0.5rem;border-radius:2px;border:1px solid ${isApproved?'rgba(123,201,76,0.4)':'rgba(201,132,76,0.4)'};color:${isApproved?'#7BC94C':'#C9844C'};">${isApproved?'Approved':'Pending'}</span>
                ${data.message.substring(0,55)}…
              </span>
            </div>
            <div class="admin-item-actions">
              <button onclick="openTPreview('${previewData}')" class="btn-edit">Preview</button>
              ${!isApproved ? `<button onclick="approveTestimony('${d.id}')" class="save-btn" style="padding:0.3rem 0.7rem;font-size:0.75rem;">✓ Approve</button>` : ''}
              <button onclick="deleteTestimony('${d.id}')" class="btn-del">Delete</button>
            </div>
          </div>`;
      });
      if (shown === 0) tlist.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;padding:1rem 0;">No testimonies in this category.</p>';
    }

    // Gallery
    const gsnap = await getDocs(query(collection(db, 'gallery'), orderBy('createdAt', 'desc')));
    const glist = document.getElementById('admin-gallery-list');
    if (glist) {
      glist.innerHTML = '';
      gsnap.forEach(d => {
        const data = d.data();
        glist.innerHTML += `
          <div class="admin-item">
            <div class="admin-item-info">
              <strong>${data.title}</strong><span>${data.date || ''}</span>
            </div>
            <div class="admin-item-actions">
              <button onclick="editGalleryEvent('${d.id}','${data.title}','${data.date||String()}','${data.image||String()}','${encodeURIComponent(data.desc||String())}')" class="btn-edit">Edit</button>
              <button onclick="deleteGalleryEvent('${d.id}')" class="btn-del">Delete</button>
            </div>
          </div>`;
      });
    }

    // Announcements
    const asnap = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')));
    const alist = document.getElementById('admin-ann-list');
    if (alist) {
      alist.innerHTML = '';
      asnap.forEach(d => {
        const data = d.data();
        alist.innerHTML += `
          <div class="admin-item">
            <div class="admin-item-info">
              <strong>${data.title}</strong><span>${data.date||''} · ${data.type||''}</span>
            </div>
            <div class="admin-item-actions">
              <button onclick="editAnnouncement('${d.id}','${data.title}','${data.date||String()}','${encodeURIComponent(data.message||String())}','${data.type||String("Event")}')" class="btn-edit">Edit</button>
              <button onclick="deleteAnnouncement('${d.id}')" class="btn-del">Delete</button>
            </div>
          </div>`;
      });
    }

    // Books admin list
    const bsnap = await getDocs(query(collection(db,'books'), orderBy('createdAt','desc')));
    const blist  = document.getElementById('admin-books-list');
    if (blist) {
      blist.innerHTML = '';
      bsnap.forEach(d => {
        const b = d.data();
        blist.innerHTML += `
          <div class="admin-item">
            <div class="admin-item-info">
              <strong>${b.title}</strong>
              <span>${b.author||''} · <span style="color:${b.access==='paid'?'#C9844C':'#7BC94C'}">${b.access==='paid'?'Paid':'Free'}</span></span>
            </div>
            <div class="admin-item-actions">
              <button onclick="editBook('${d.id}','${encodeURIComponent(JSON.stringify(b))}')" class="btn-edit">Edit</button>
              <button onclick="deleteBook('${d.id}')" class="btn-del">Delete</button>
            </div>
          </div>`;
      });
    }
    _loadPublicData();
    if (document.getElementById('admin-users-list')) _loadAdminUsers();
  } catch (e) {
    errLog(e, 'loadAdminData');
    console.warn('Firebase error in loadAdminData:', e.message);
  }
};

// ============================================================
//  CELEBRITIES
// ============================================================

const _saveCeleb = async () => {
  const name      = val('celeb-name');
  const title     = val('celeb-title');
  const scripture = val('celeb-scripture');
  const story     = val('celeb-story');
  const sphere    = val('celeb-sphere');
  const editId    = val('celeb-edit-id');
  if (!name || !title) { alert('Name and title are required.'); return; }
  try {
    if (editId) await updateDoc(doc(db,'celebrities',editId), {name,title,scripture,story,sphere});
    else        await addDoc(collection(db,'celebrities'), {name,title,scripture,story,sphere,createdAt:serverTimestamp()});
    if (window.clearCelebForm) window.clearCelebForm();
    _loadAdminData();
  } catch(e) { errLog(e,'saveCeleb'); alert('Error: '+e.message); }
};

const _deleteCeleb = async (id) => {
  if (!confirm('Delete this celebrity?')) return;
  try { await deleteDoc(doc(db,'celebrities',id)); _loadAdminData(); }
  catch(e) { errLog(e,'deleteCeleb'); alert('Error: '+e.message); }
};

const _deleteTestimony = async (id) => {
  if (!confirm('Delete this testimony?')) return;
  try { await deleteDoc(doc(db,'testimonies',id)); _loadAdminData(); }
  catch(e) { errLog(e,'deleteTestimony'); alert('Error: '+e.message); }
};

// ============================================================
//  GALLERY
// ============================================================

const _saveGalleryEvent = async () => {
  const title  = val('gallery-title');
  const date   = val('gallery-date');
  const desc   = val('gallery-desc');
  const editId = val('gallery-edit-id');
  // Collect all image URLs from the multi-image manager
  const imageEls = document.querySelectorAll('.gallery-img-entry-url');
  const images   = Array.from(imageEls).map(el => el.value.trim()).filter(Boolean);

  const errEl = document.getElementById('gallery-form-error');
  const okEl  = document.getElementById('gallery-form-success');
  if (errEl) { errEl.style.display = 'none'; errEl.textContent = ''; }
  if (okEl)  { okEl.style.display  = 'none'; okEl.textContent  = ''; }

  if (!title) {
    if (errEl) { errEl.textContent = 'Event title is required.'; errEl.style.display = 'block'; }
    return;
  }

  const btn = document.querySelector('#panel-gallery-admin .save-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  try {
    if (editId) {
      await updateDoc(doc(db,'gallery',editId), {title,date,images,desc});
    } else {
      await addDoc(collection(db,'gallery'), {title,date,images,desc,createdAt:serverTimestamp()});
    }
    if (okEl) { okEl.textContent = `✦ "${title}" saved with ${images.length} image(s).`; okEl.style.display = 'block'; setTimeout(() => (okEl.style.display='none'), 4000); }
    if (window.clearGalleryForm) window.clearGalleryForm();
    _loadAdminData();
  } catch(e) {
    errLog(e,'saveGalleryEvent');
    if (errEl) { errEl.textContent = 'Error saving: ' + e.message; errEl.style.display = 'block'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Save Event'; }
  }
};

const _deleteGalleryEvent = async (id) => {
  if (!confirm('Delete this gallery event?')) return;
  try { await deleteDoc(doc(db,'gallery',id)); _loadAdminData(); }
  catch(e) { errLog(e,'deleteGalleryEvent'); alert('Error: '+e.message); }
};

// ============================================================
//  ANNOUNCEMENTS
// ============================================================

const _saveAnnouncement = async () => {
  const title   = val('ann-title');
  const date    = val('ann-date');
  const message = val('ann-message');
  const type    = val('ann-type');
  const editId  = val('ann-edit-id');
  if (!title || !message) { alert('Title and message are required.'); return; }
  try {
    if (editId) await updateDoc(doc(db,'announcements',editId), {title,date,message,type});
    else        await addDoc(collection(db,'announcements'), {title,date,message,type,createdAt:serverTimestamp()});
    if (window.clearAnnForm) window.clearAnnForm();
    _loadAdminData();
  } catch(e) { errLog(e,'saveAnnouncement'); alert('Error: '+e.message); }
};

const _deleteAnnouncement = async (id) => {
  if (!confirm('Delete this announcement?')) return;
  try { await deleteDoc(doc(db,'announcements',id)); _loadAdminData(); }
  catch(e) { errLog(e,'deleteAnnouncement'); alert('Error: '+e.message); }
};

// ============================================================
//  TESTIMONY SUBMISSION (public)
// ============================================================

const _submitTestimony = async () => {
  const name     = val('t-name');
  const message  = val('t-message');
  const mediaUrl = val('t-media-url');
  const mediaType= val('t-media-type');

  if (!name || !message) { alert('Please fill in your name and testimony.'); return; }

  const btn = document.getElementById('t-submit-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

  try {
    await addDoc(collection(db,'testimonies'), {
      name, message,
      mediaUrl:  mediaUrl  || '',
      mediaType: mediaType || '',
      approved:  false,
      createdAt: serverTimestamp()
    });
    setVal('t-name',''); setVal('t-message','');
    setVal('t-media-url',''); setVal('t-media-type','');
    // Clear media preview
    const prev = document.getElementById('t-media-preview'); if(prev) prev.style.display='none';
    const drop = document.getElementById('t-dropzone'); if(drop) { drop.classList.remove('t-drag-over'); }
    const pErr = document.getElementById('t-upload-error'); if(pErr) pErr.style.display='none';
    const pProg= document.getElementById('t-upload-progress'); if(pProg) pProg.style.display='none';
    const finp = document.getElementById('t-file-input'); if(finp) finp.value='';
    const s = document.getElementById('testimony-success');
    if (s) { s.style.display='block'; setTimeout(()=>(s.style.display='none'),4000); }
  } catch(e) { errLog(e,'submitTestimony'); alert('Error submitting: '+e.message); }
  finally { if (btn) { btn.disabled = false; btn.textContent = 'Submit Testimony'; } }
};

// ============================================================
//  PUBLIC DATA LOADERS
// ============================================================

const _loadPublicData = async () => {
  try {
    const snap = await getDocs(query(collection(db,'celebrities'), orderBy('createdAt','desc')));
    const container = document.getElementById('dynamic-celebrities');
    if (container && !snap.empty) {
      container.innerHTML = '';
      snap.forEach(d => {
        const data = d.data();
        container.innerHTML += `
          <div class="legend-card">
            <div class="legend-crown">✦</div>
            <h3>${data.name}</h3>
            <p class="legend-role">${data.title}</p>
            <p class="legend-scripture">${data.scripture}</p>
            <p class="legend-story">${data.story}</p>
            <span class="sphere-badge">${data.sphere}</span>
          </div>`;
      });
    }
  } catch(e) { /* Firebase not configured — static cards stay */ }
};

const _loadGalleryPublic = async (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const snap = await getDocs(query(collection(db,'gallery'), orderBy('createdAt','desc')));
    if (snap.empty) return;
    container.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      // Support both legacy single image and new multi-image array
      const imgs = data.images && data.images.length ? data.images
                 : data.image ? [data.image] : [];
      const thumbSrc = imgs[0] || '';
      const imgCount = imgs.length;
      const dataJson = encodeURIComponent(JSON.stringify({
        title: data.title, date: data.date||'', desc: data.desc||'', images: imgs
      }));
      container.innerHTML += `
        <div class="gallery-card" onclick="openGalleryPopup('${dataJson}')" style="cursor:pointer;">
          ${thumbSrc
            ? `<div class="gallery-img-wrap" style="position:relative;">
                <img src="${thumbSrc}" alt="${data.title}" loading="lazy">
                ${imgCount > 1 ? `<span class="gallery-img-count">🖼 ${imgCount} photos</span>` : ''}
               </div>`
            : '<div class="gallery-img-placeholder">✦</div>'}
          <div class="gallery-card-body">
            <p class="gallery-date">${data.date||''}</p>
            <h4 class="gallery-card-title">${data.title}</h4>
            <p class="gallery-card-desc">${data.desc||''}</p>
            <span class="gallery-view-btn">View Gallery →</span>
          </div>
        </div>`;
    });
  } catch(e) { errLog(e,'loadGalleryPublic'); }
};

const _loadAnnouncementsPublic = async (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const snap = await getDocs(query(collection(db,'announcements'), orderBy('createdAt','desc')));
    if (snap.empty) return;
    container.innerHTML = '';
    snap.forEach(d => {
      const data = d.data();
      const typeClass = (data.type||'Event').toLowerCase().replace(/\s+/g,'-');
      const annData = encodeURIComponent(JSON.stringify({
        title: data.title, date: data.date||'', message: data.message, type: data.type||'Event'
      }));
      const preview = data.message.length > 140 ? data.message.substring(0,140) + '…' : data.message;
      container.innerHTML += `
        <div class="ann-card ann-type-${typeClass}">
          <div class="ann-card-header">
            <span class="ann-type-badge">${data.type||'Event'}</span>
            <span class="ann-card-date">${data.date||''}</span>
          </div>
          <h4 class="ann-card-title">${data.title}</h4>
          <p class="ann-card-msg">${preview}</p>
          ${data.message.length > 140 ? `<button class="ann-read-more-btn" onclick="openAnnPopup('${annData}')">Read Full Announcement →</button>` : `<button class="ann-read-more-btn" onclick="openAnnPopup('${annData}')">View Details →</button>`}
        </div>`;
    });
  } catch(e) { errLog(e,'loadAnnouncementsPublic'); }
};

// ============================================================
//  ADMIN USERS
// ============================================================

const _loadAdminUsers = async () => {
  const listEl = document.getElementById('admin-users-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--text-muted);font-size:0.9rem;">Loading…</div>';
  try {
    const snap = await getDocs(query(collection(db,'adminUsers'), orderBy('createdAt','desc')));
    if (snap.empty) {
      listEl.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);border:1px dashed rgba(201,168,76,0.15);"><div style="font-size:2rem;margin-bottom:0.75rem;opacity:0.3;">👤</div><p style="font-size:0.88rem;">No admin users found.</p></div>`;
      return;
    }
    const cu = window._currentUser;
    let html = '';
    snap.forEach(d => {
      const u = d.data();
      const isMe = cu && cu.email === u.email;
      const rc = {'super-admin':'#C9A84C','moderator':'#4C8EC9','editor':'#7BC94C'}[u.role]||'#9A8C70';
      html += `
        <div class="admin-item" id="au-${d.id}" style="align-items:center;">
          <div style="width:42px;height:42px;border-radius:50%;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.25);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">
            ${u.name ? u.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div class="admin-item-info" style="flex:1;margin-left:1rem;">
            <strong style="display:flex;align-items:center;gap:0.5rem;">
              ${u.name||'(unnamed)'}
              ${isMe?'<span style="font-size:0.65rem;padding:0.2rem 0.5rem;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.3);color:var(--gold);border-radius:2px;">YOU</span>':''}
            </strong>
            <span>${u.email}</span>
            <span style="font-size:0.72rem;color:${rc};letter-spacing:0.08em;text-transform:uppercase;margin-top:0.2rem;display:block;">${u.role||'editor'}</span>
          </div>
          <div class="admin-item-actions">
            ${!isMe?`<button onclick="removeAdminUser('${d.id}','${u.email}')" class="btn-del">Remove</button>`:'<span style="font-size:0.75rem;color:var(--text-muted);">Active session</span>'}
          </div>
        </div>`;
    });
    listEl.innerHTML = html;
  } catch(e) {
    errLog(e,'loadAdminUsers');
    listEl.innerHTML = `<p style="color:#C9544C;font-size:0.88rem;">Error loading users: ${e.message}</p>`;
  }
};

const _createAdminUser = async () => {
  const name        = val('new-admin-name').trim();
  const email       = val('new-admin-email').trim();
  const pass        = val('new-admin-pass');
  const passConfirm = val('new-admin-pass-confirm');
  const role        = val('new-admin-role');
  const errEl = document.getElementById('new-admin-error');
  const okEl  = document.getElementById('new-admin-success');
  if (errEl) { errEl.style.display='none'; errEl.textContent=''; }
  if (okEl)  { okEl.style.display='none';  okEl.textContent=''; }

  const fail = (msg) => { if (errEl) { errEl.textContent=msg; errEl.style.display='block'; } };
  if (!name)              return fail('Please enter a full name.');
  if (!email)             return fail('Please enter an email address.');
  if (!pass)              return fail('Please enter a password.');
  if (pass.length < 6)   return fail('Password must be at least 6 characters.');
  if (pass !== passConfirm) return fail('Passwords do not match.');

  const btn = document.querySelector('#panel-admin-users .save-btn');
  if (btn) { btn.disabled=true; btn.textContent='Creating…'; }
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    await signOut(secondaryAuth);
    await addDoc(collection(db,'adminUsers'), {
      uid: cred.user.uid, name, email, role,
      createdBy: window._currentUser ? window._currentUser.email : 'unknown',
      createdAt: serverTimestamp()
    });
    ['new-admin-name','new-admin-email','new-admin-pass','new-admin-pass-confirm'].forEach(id=>setVal(id,''));
    setVal('new-admin-role','editor');
    if (okEl) { okEl.textContent=`✦ Admin user "${name}" (${email}) created successfully.`; okEl.style.display='block'; setTimeout(()=>(okEl.style.display='none'),5000); }
    _loadAdminUsers();
  } catch(e) {
    errLog(e,'createAdminUser');
    const msg = e.code==='auth/email-already-in-use' ? 'This email is already registered.'
      : e.code==='auth/invalid-email' ? 'Please enter a valid email address.'
      : 'Error creating user: '+e.message;
    fail(msg);
  } finally {
    if (btn) { btn.disabled=false; btn.textContent='✦ Create Admin User'; }
  }
};

const _removeAdminUser = async (docId, email) => {
  if (!confirm(`Remove "${email}" from admin users?\n\nNote: Also delete them in Firebase Console → Authentication → Users to fully revoke access.`)) return;
  try {
    await deleteDoc(doc(db,'adminUsers',docId));
    const el = document.getElementById('au-'+docId);
    if (el) el.remove();
    const listEl = document.getElementById('admin-users-list');
    if (listEl && !listEl.querySelector('.admin-item')) _loadAdminUsers();
  } catch(e) { errLog(e,'removeAdminUser'); alert('Error: '+e.message); }
};

// ============================================================
//  APPROVE TESTIMONY
// ============================================================
const _approveTestimony = async (id) => {
  try {
    await updateDoc(doc(db,'testimonies',id), { approved: true });
    // Update in DOM immediately
    const item = document.getElementById('titem-' + id);
    if (item) {
      const badge = item.querySelector('span[style*="border"]');
      if (badge) { badge.textContent = 'Approved'; badge.style.color='#7BC94C'; badge.style.borderColor='rgba(123,201,76,0.4)'; }
      const approveBtn = item.querySelector('.save-btn');
      if (approveBtn) approveBtn.remove();
    }
  } catch(e) { errLog(e,'approveTestimony'); alert('Error: '+e.message); }
};

// ============================================================
//  BOOKS / PDF MANAGEMENT
// ============================================================
const _saveBook = async () => {
  const title   = val('book-title');
  const author  = val('book-author');
  const desc    = val('book-desc');
  const cover   = val('book-cover');
  const access  = val('book-access');
  const price   = val('book-price');
  const pdfUrl  = val('book-pdf-url');
  const editId  = val('book-edit-id');
  const errEl   = document.getElementById('book-form-error');
  const okEl    = document.getElementById('book-form-success');
  if (errEl) { errEl.style.display='none'; errEl.textContent=''; }
  if (okEl)  { okEl.style.display='none';  okEl.textContent=''; }
  if (!title) { if(errEl){errEl.textContent='Book title is required.';errEl.style.display='block';} return; }
  if (!pdfUrl && access === 'free') { if(errEl){errEl.textContent='Please upload or paste a PDF URL for free books.';errEl.style.display='block';} return; }
  const btn = document.querySelector('#panel-books-admin .save-btn');
  if (btn) { btn.disabled=true; btn.textContent='Saving…'; }
  try {
    const bookData = {title,author,desc,cover,access,price,pdfUrl};
    if (editId) await updateDoc(doc(db,'books',editId), bookData);
    else        await addDoc(collection(db,'books'), {...bookData, createdAt:serverTimestamp()});
    if (okEl) { okEl.textContent=`✦ "${title}" saved.`; okEl.style.display='block'; setTimeout(()=>(okEl.style.display='none'),4000); }
    if (window.clearBookForm) window.clearBookForm();
    _loadAdminData();
  } catch(e) { errLog(e,'saveBook'); if(errEl){errEl.textContent='Error: '+e.message;errEl.style.display='block';} }
  finally { if(btn){btn.disabled=false;btn.textContent='Save Book';} }
};

const _deleteBook = async (id) => {
  if (!confirm('Delete this book?')) return;
  try { await deleteDoc(doc(db,'books',id)); _loadAdminData(); }
  catch(e) { errLog(e,'deleteBook'); alert('Error: '+e.message); }
};

const _loadBooksPublic = async (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const snap = await getDocs(query(collection(db,'books'), orderBy('createdAt','desc')));
    if (snap.empty) return;
    container.innerHTML = '';
    snap.forEach(d => {
      const b = d.data();
      const isFree = b.access !== 'paid';
      container.innerHTML += `
        <div class="book-card">
          ${b.cover ? `<div class="book-cover-wrap"><img src="${b.cover}" alt="${b.title}" loading="lazy"></div>` : '<div class="book-cover-placeholder">📖</div>'}
          <div class="book-card-body">
            <h4 class="book-card-title">${b.title}</h4>
            ${b.author ? `<p class="book-card-author">by ${b.author}</p>` : ''}
            ${b.desc   ? `<p class="book-card-desc">${b.desc}</p>` : ''}
            <div class="book-card-footer">
              <span class="book-access-badge ${isFree?'book-free':'book-paid'}">${isFree?'Free Download':'Paid — '+b.price}</span>
              ${isFree && b.pdfUrl
                ? `<a href="${b.pdfUrl}" download target="_blank" class="book-download-btn">⬇ Download PDF</a>`
                : !isFree
                ? `<button class="book-download-btn book-paid-btn" onclick="openBookPayPopup('${encodeURIComponent(JSON.stringify({title:b.title,price:b.price,author:b.author}))}')">Get This Book →</button>`
                : ''}
            </div>
          </div>
        </div>`;
    });
  } catch(e) { errLog(e,'loadBooksPublic'); }
};

const _loadApprovedTestimonies = async (containerId) => {
  const container = document.getElementById(containerId);
  if (!container) return;
  try {
    const snap = await getDocs(query(collection(db,'testimonies'), orderBy('createdAt','desc')));
    const approved = [];
    snap.forEach(d => { if(d.data().approved) approved.push({id:d.id,...d.data()}); });
    if (!approved.length) { container.innerHTML='<p style="color:var(--text-muted);text-align:center;padding:2rem;">No testimonies yet. Be the first to share!</p>'; return; }
    container.innerHTML = '';
    approved.forEach(t => {
      const date = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '';
      const previewData = encodeURIComponent(JSON.stringify({
        id:t.id, name:t.name, message:t.message, mediaUrl:t.mediaUrl||'', mediaType:t.mediaType||'', approved:true, date
      }));
      const preview = t.message.length>180 ? t.message.substring(0,180)+'…' : t.message;
      container.innerHTML += `
        <div class="testimony-pub-card">
          <div class="testimony-pub-header">
            <div class="testimony-pub-avatar">${t.name.charAt(0).toUpperCase()}</div>
            <div>
              <strong class="testimony-pub-name">${t.name}</strong>
              <span class="testimony-pub-date">${date}</span>
            </div>
            ${t.mediaType ? `<span class="testimony-pub-media-badge">${t.mediaType==='image'?'🖼 Photo':t.mediaType==='audio'?'🎵 Audio':'🎬 Video'}</span>` : ''}
          </div>
          <p class="testimony-pub-text">${preview}</p>
          <button class="ann-read-more-btn" onclick="openTestimonyPopup('${previewData}')">Read Full Testimony →</button>
        </div>`;
    });
  } catch(e) { errLog(e,'loadApprovedTestimonies'); }
};

// ============================================================
//  REGISTER INTO _fbFns  ← uses LOCAL const refs, never window.X
//  This runs LAST in the module, after all consts are defined.
// ============================================================
window._fbFns = {
  // Auth
  adminLogin:              _adminLogin,
  adminLogout:             _adminLogout,
  // Admin data
  loadAdminData:           _loadAdminData,
  loadAdminUsers:          _loadAdminUsers,
  // Celebrities
  saveCeleb:               _saveCeleb,
  deleteCeleb:             _deleteCeleb,
  // Testimonies
  deleteTestimony:         _deleteTestimony,
  approveTestimony:        _approveTestimony,
  submitTestimony:         _submitTestimony,
  loadApprovedTestimonies: _loadApprovedTestimonies,
  // Gallery
  saveGalleryEvent:        _saveGalleryEvent,
  deleteGalleryEvent:      _deleteGalleryEvent,
  // Announcements
  saveAnnouncement:        _saveAnnouncement,
  deleteAnnouncement:      _deleteAnnouncement,
  // Books
  saveBook:                _saveBook,
  deleteBook:              _deleteBook,
  loadBooksPublic:         _loadBooksPublic,
  // Public loaders
  loadPublicData:          _loadPublicData,
  loadGalleryPublic:       _loadGalleryPublic,
  loadAnnouncementsPublic: _loadAnnouncementsPublic,
  // Admin users
  createAdminUser:         _createAdminUser,
  removeAdminUser:         _removeAdminUser,
};
window._fbReady = true;

// Also alias key functions onto window for direct access
window.loadGalleryPublic       = _loadGalleryPublic;
window.loadAnnouncementsPublic = _loadAnnouncementsPublic;

// Load public data on page ready
document.addEventListener('DOMContentLoaded', () => {
  try { _loadPublicData(); } catch(e) {}
});
