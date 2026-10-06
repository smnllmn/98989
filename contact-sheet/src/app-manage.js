  /* ---------- manage: upload, caption, remove, shrink ---------- */
  async function decode(blob) {
    if (typeof createImageBitmap === 'function') {
      try {
        var bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
        return { src: bmp, w: bmp.width, h: bmp.height, done: function () { if (bmp.close) bmp.close(); } };
      } catch (e) { /* fall back to an <img> */ }
    }
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob), img = new Image();
      img.onload = function () { resolve({ src: img, w: img.naturalWidth, h: img.naturalHeight, done: function () { URL.revokeObjectURL(url); } }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error(t('unsupported'))); };
      img.src = url;
    });
  }

  // Resizes to maxEdge on the long side as JPEG. Web-ready JPEGs are kept as they are.
  async function prepare(blob, maxEdge, force) {
    var d = await decode(blob);
    try {
      var s = Math.min(1, maxEdge / Math.max(d.w, d.h));
      var w = Math.max(1, Math.round(d.w * s)), h = Math.max(1, Math.round(d.h * s));
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      var ctx = c.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(d.src, 0, 0, w, h);
      var tc = document.createElement('canvas'), ts = 96 / Math.max(w, h);
      tc.width = Math.max(1, Math.round(w * ts)); tc.height = Math.max(1, Math.round(h * ts));
      tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height);
      var thumb = tc.toDataURL('image/jpeg', .7);
      if (!force && s === 1 && blob.type === 'image/jpeg' && blob.size <= 900 * 1024) return { blob: blob, thumb: thumb };
      var out = await new Promise(function (res, rej) {
        c.toBlob(function (b) { if (b) res(b); else rej(new Error(t('unsupported'))); }, 'image/jpeg', .85);
      });
      return { blob: out, thumb: thumb };
    } finally { d.done(); }
  }

  var upSeq = 0, upActive = 0;
  function addFiles(files) {
    var list = Array.prototype.slice.call(files || []);
    if (!list.length || !S.admin) return;
    if (S.view !== 'manage') setView('manage');
    list.forEach(function (f) { S.uploads.push({ key: ++upSeq, file: f, name: f.name, status: 'waiting' }); });
    pumpUploads();
  }

  function pumpUploads() {
    while (upActive < 2) {
      var u = S.uploads.filter(function (x) { return x.status === 'waiting'; })[0];
      if (!u) break;
      upActive++;
      u.status = 'resizing';
      processUpload(u).then(function () { upActive--; pumpUploads(); });
    }
    renderUploads();
  }

  async function processUpload(u) {
    try {
      var f = u.file;
      if (f.type && !/^image\//.test(f.type)) throw new Error(t('unsupported'));
      var r = await prepare(f, CONFIG.maxPhotoEdge, false);
      u.thumb = r.thumb;
      u.status = 'uploading';
      renderUploads();
      var caption = prettyName(f.name);
      var name = slug(f.name) + '-' + rand(4) + '.jpg';
      var p = S.mode === 'sharepoint' ? await spUpload(name, r.blob, caption)
        : { id: 'local-' + (++S.seq), name: name, caption: caption, folder: '', src: URL.createObjectURL(r.blob), size: r.blob.size, jpeg: true, local: true };
      S.photos.push(p);
      S.byId[p.id] = p;
      syncDeck();
      u.status = 'done';
    } catch (e) {
      u.status = 'error';
      u.msg = e.message;
      S.lastError = e.message;
    }
    u.file = null;
    renderUploads();
    renderGridSoon();
    renderTop();
    if (S.view === 'swipe') renderStack();
  }

  var gridTimer = null;
  function renderGridSoon() {
    clearTimeout(gridTimer);
    gridTimer = setTimeout(function () { if (S.view === 'manage') renderManage(); }, 250);
  }

  function renderUploads() {
    var el = $('ps-ups');
    if (!el) return;
    if (!S.uploads.length) { el.innerHTML = ''; return; }
    var done = S.uploads.filter(function (u) { return u.status === 'done'; }).length;
    var busy = S.uploads.some(function (u) { return u.status === 'waiting' || u.status === 'resizing' || u.status === 'uploading'; });
    var label = { waiting: 'upWaiting', resizing: 'upResizing', uploading: 'upUploading', done: 'upDone', error: 'upError' };
    el.innerHTML = '<li class="ps-ups-head"><span>' + T('upSummary', { done: done, n: S.uploads.length }) + '</span>' +
      (busy ? '' : '<button type="button" class="ps-linkbtn" data-act="clear-uploads">' + T('clearUploads') + '</button>') + '</li>' +
      S.uploads.slice().reverse().map(function (u) {
        return '<li class="ps-up is-' + u.status + '">' + (u.thumb ? '<img alt="" src="' + esc(u.thumb) + '">' : '<span class="ps-up-ph"></span>') +
          '<span class="ps-up-name">' + esc(u.name) + (u.msg ? '<small>' + esc(u.msg) + '</small>' : '') + '</span>' +
          '<span class="ps-up-st">' + T(label[u.status]) + '</span></li>';
      }).join('');
  }

  // Re-renders without losing the caption field someone is typing in.
  function keepFocus(container, html) {
    var a = document.activeElement, id = null, val = null, s0 = null, s1 = null;
    if (a && container.contains(a) && a.classList.contains('ps-cap-in')) { id = a.dataset.id; val = a.value; s0 = a.selectionStart; s1 = a.selectionEnd; }
    container.innerHTML = html;
    if (id == null) return;
    var n = container.querySelector('.ps-cap-in[data-id="' + cssId(id) + '"]');
    if (!n) return;
    n.value = val;
    n.focus({ preventScroll: true });
    try { n.setSelectionRange(s0, s1); } catch (e) { /* not a text field */ }
  }

  function phHtml(p, n) {
    var big = S.mode === 'sharepoint' && p.size > LARGE;
    var confirming = S.confirmRemove === p.id;
    return '<li class="ps-ph" data-id="' + esc(p.id) + '"><div class="ps-ph-img"><img alt="" loading="lazy" src="' + esc(p.src) + '">' +
      (confirming
        ? '<div class="ps-ph-confirm"><span>' + T('removeAsk') + '</span><div class="ps-row">' +
          '<button type="button" class="ps-btn ps-btn--sm" data-act="remove-yes" data-id="' + esc(p.id) + '">' + T('removeYes') + '</button>' +
          '<button type="button" class="ps-btn ps-btn--sm ps-btn--white" data-act="remove-no">' + T('removeNo') + '</button></div></div>'
        : '<button type="button" class="ps-ph-del" data-act="remove" data-id="' + esc(p.id) + '" aria-label="' + T('remove') + ': ' + esc(p.caption) + '" title="' + T('remove') + '">' + icon(P.trash) + '</button>') +
      '</div><input class="ps-cap-in" type="text" data-id="' + esc(p.id) + '" value="' + esc(p.caption) + '" maxlength="255" aria-label="' + T('caption') + '" placeholder="' + T('caption') + '">' +
      '<div class="ps-ph-meta"><span>' + esc(nVotes(n)) + '</span>' + (p.size ? '<span>' + fmtSize(p.size) + '</span>' : '') +
      (S.savedCaption === p.id ? '<span class="ps-saved">' + icon(P.check) + T('captionSaved') + '</span>' : '') +
      (big ? '<span class="ps-large">' + T('large') + '</span>' + (p.jpeg && p.uid && !S.shrinking ? '<button type="button" class="ps-linkbtn" data-act="shrink" data-id="' + esc(p.id) + '">' + T('shrink') + '</button>' : '') : '') +
      '</div></li>';
  }

  function renderManage() {
    var el = $('ps-view-manage');
    if (!S.admin) { el.innerHTML = ''; return; }
    var head = '<div class="ps-head"><div class="ps-head-text"><h2>' + T('manTitle') + '</h2><span class="ps-count">' + esc(nPhotos(S.photos.length)) + '</span></div>';
    if (S.mode === 'sharepoint' && S.lib.state !== 'ok') {
      el.innerHTML = head + '</div><div class="ps-empty">' + (S.lib.state === 'error' ? T('libError', { err: S.lib.error || S.lastError })
        : T('setupText', { lib: CONFIG.photoLibrary, list: CONFIG.votesList }) + '<div class="ps-row" style="margin-top:14px"><button type="button" class="ps-btn" data-act="setup">' + T('setupBtn') + '</button></div>') + '</div>';
      return;
    }
    var counts = {};
    latest(S.votes).forEach(function (v) { counts[v.photo] = (counts[v.photo] || 0) + 1; });
    var large = S.mode === 'sharepoint' ? S.photos.filter(function (p) { return p.jpeg && p.uid && p.size > LARGE; }) : [];
    var links = '';
    if (S.mode === 'sharepoint') {
      if (S.lib.url) links += '<a class="ps-btn ps-btn--soft ps-btn--sm" target="_blank" rel="noopener" href="' + esc(ORIGIN + encPath(S.lib.url)) + '">' + icon(P.ext) + T('openLib') + '</a>';
      if (S.list.url) links += '<a class="ps-btn ps-btn--soft ps-btn--sm" target="_blank" rel="noopener" href="' + esc(ORIGIN + encPath(S.list.url)) + '">' + icon(P.ext) + T('openList') + '</a>';
    }
    var bar = links + (S.shrinking ? '<span class="ps-count">' + T('shrinking', { i: S.shrinking.i, n: S.shrinking.n }) + '</span>'
      : large.length ? '<button type="button" class="ps-btn ps-btn--soft ps-btn--sm" data-act="shrink-all" title="' + T('shrinkNote') + '">' + icon(P.shrink) + T('shrinkAll', { n: large.length }) + '</button>' : '');
    var html = head + '</div>' +
      '<label class="ps-drop" id="ps-drop"><input type="file" class="ps-file" id="ps-file" multiple accept="image/*">' +
      '<span class="ps-drop-ic">' + icon(P.upload) + '</span><b>' + T('drop') + '</b><span class="ps-drop-or">' + T('dropOr') + '</span>' +
      '<small>' + T('dropHint', { px: CONFIG.maxPhotoEdge }) + '</small></label>' +
      '<ul class="ps-ups" id="ps-ups"></ul>' +
      (bar ? '<div class="ps-man-bar">' + bar + '</div>' : '') +
      (large.length && !S.shrinking ? '<p class="ps-note">' + T('shrinkNote') + '</p>' : '') +
      (S.mode === 'demo' ? '<p class="ps-note">' + T('demoPhotosNote') + '</p>' : '') +
      (S.skipped ? '<p class="ps-note">' + T('skippedFiles', { n: S.skipped }) + '</p>' : '') +
      '<ul class="ps-grid">' + S.photos.slice().reverse().map(function (p) { return phHtml(p, counts[p.id] || 0); }).join('') + '</ul>';
    keepFocus(el, html);
    renderUploads();
  }

  var captionTimer = null;
  async function saveCaption(input) {
    var p = S.byId[input.dataset.id];
    if (!p) return;
    var cap = input.value.replace(/\s+/g, ' ').trim().slice(0, 255);
    if (!cap) { input.value = p.caption; return; }
    if (cap === p.caption) return;
    var old = p.caption;
    p.caption = cap;
    try {
      if (S.mode === 'sharepoint') await spSetCaption(p.id, cap);
      S.savedCaption = p.id;
      clearTimeout(captionTimer);
      captionTimer = setTimeout(function () { S.savedCaption = null; if (S.view === 'manage') renderManage(); }, 2500);
    } catch (e) {
      p.caption = old;
      S.lastError = e.message;
      toastText(t('captionFail', { err: e.message }), 7000);
    }
    if (S.view === 'manage') renderManage();
  }

  async function removePhoto(id) {
    var p = S.byId[id];
    S.confirmRemove = null;
    if (!p) { renderManage(); return; }
    try {
      if (S.mode === 'sharepoint') await spRecycle(libPath(), p.id);
      else if (p.local) URL.revokeObjectURL(p.src);
      setPhotos(S.photos.filter(function (x) { return x.id !== id; }));
      delete S.done[id];
      toastText(t(S.mode === 'sharepoint' ? 'removed' : 'removedDemo', { name: p.caption }));
    } catch (e) {
      S.lastError = e.message;
      toastText(t('removeFail', { err: e.message }), 7000);
    }
    renderManage();
    renderTop();
  }

  async function shrink(ids) {
    var list = ids.map(function (id) { return S.byId[id]; }).filter(function (p) { return p && p.jpeg && p.uid; });
    if (!list.length || S.shrinking) return;
    S.shrinking = { i: 0, n: list.length };
    var ok = 0;
    for (var i = 0; i < list.length; i++) {
      S.shrinking.i = i + 1;
      renderManage();
      var p = list[i];
      try {
        var res = await fetch(p.src, { credentials: 'same-origin', cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        var blob = await res.blob();
        var out = await prepare(blob, CONFIG.maxPhotoEdge, true);
        if (out.blob.size < blob.size * .9) {
          await spReplace(p, out.blob);
          p.size = out.blob.size;
          p.src = p.src.replace(/\?v=.*$/, '') + '?v=' + Date.now();
          ok++;
        }
      } catch (e) { S.lastError = e.message; }
    }
    S.shrinking = null;
    renderManage();
    toastText(t('shrunk', { n: ok }));
  }
