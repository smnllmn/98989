  /* ---------- actions ---------- */
  function onAction(act, id, btn) {
    switch (act) {
      case 'view': setView(id); break;
      case 'back': setView(S.prevView && S.prevView !== 'details' ? S.prevView : 'swipe'); break;
      case 'menu': S.menu = !S.menu; renderMenu(); break;
      case 'lang': setLang(id); break;
      case 'vote': fly(id); break;
      case 'undo': undo(); break;
      case 'intro-start': dismissIntro(); break;
      case 'restart': restart(); break;
      case 'retry': retryFailed(); break;
      case 'setup': doSetup(btn); break;
      case 'refresh': refreshAll(btn); break;
      case 'export': exportCsv(); break;
      case 'present': present(); break;
      case 'remove': S.confirmRemove = id; renderManage(); break;
      case 'remove-no': S.confirmRemove = null; renderManage(); break;
      case 'remove-yes': removePhoto(id); break;
      case 'shrink': shrink([id]); break;
      case 'shrink-all':
        shrink(S.photos.filter(function (p) { return p.jpeg && p.uid && p.size > LARGE; }).map(function (p) { return p.id; }));
        break;
      case 'clear-uploads':
        S.uploads = S.uploads.filter(function (u) { return u.status !== 'done' && u.status !== 'error'; });
        renderUploads();
        break;
      case 'clear-local':
        S.votes = S.votes.filter(function (v) { return v.example || v.spId; });
        setStore(localKey(), null);
        S.saved = 0;
        S.history = [];
        buildDeck();
        setView('swipe');
        break;
      case 'preview-lock':
        var back = S.view === 'details' ? (S.prevView && S.prevView !== 'details' ? S.prevView : 'swipe') : S.view;
        S.previewLocked = true;
        S.gate = 'denied';
        setView(back);
        APP.scrollIntoView({ block: 'nearest' });
        break;
      case 'as-reviewer': setReviewerView(id === 'on'); break;
      case 'lock-votes':
        if (btn) btn.disabled = true;
        lockVotes().then(function () { toastText(t('lockedDone')); }, function (e) {
          S.lastError = e.message;
          toastText(t('lockFail', { err: e.message }), 9000);
        }).then(function () { setView(S.view); });
        break;
      case 'end-preview': S.previewLocked = false; S.gate = null; setView(S.view); break;
      case 'copy': copyAddr(btn); break;
      case 'retry-boot': start(); break;
    }
  }

  function wire() {
    APP.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-act]') : null;
      if (!b || !APP.contains(b) || b.disabled) return;
      onAction(b.getAttribute('data-act'), b.getAttribute('data-id'), b);
    });

    document.addEventListener('click', function (e) {
      if (!alive() || !S.menu || !e.target.isConnected) return;   // a re-rendered menu button is no longer in the page
      if (!e.target.closest('#ps-menu') && !e.target.closest('#ps-menu-btn')) { S.menu = false; renderMenu(); }
    });

    // Manage: file picker, drag and drop, caption editing.
    var mv = $('ps-view-manage');
    mv.addEventListener('change', function (e) {
      if (e.target.id === 'ps-file') { addFiles(e.target.files); e.target.value = ''; }
    });
    var hasFiles = function (e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1; };
    ['dragenter', 'dragover'].forEach(function (ev) {
      mv.addEventListener(ev, function (e) {
        if (!hasFiles(e)) return;
        e.preventDefault();
        var d = $('ps-drop');
        if (d) d.classList.add('is-over');
      });
    });
    mv.addEventListener('dragleave', function (e) {
      var d = $('ps-drop');
      if (d && !mv.contains(e.relatedTarget)) d.classList.remove('is-over');
    });
    mv.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      var d = $('ps-drop');
      if (d) d.classList.remove('is-over');
      addFiles(e.dataTransfer.files);
    });
    mv.addEventListener('focusout', function (e) { if (e.target.classList && e.target.classList.contains('ps-cap-in')) saveCaption(e.target); });
    mv.addEventListener('keydown', function (e) {
      if (!e.target.classList || !e.target.classList.contains('ps-cap-in')) return;
      if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
      if (e.key === 'Escape') { var p = S.byId[e.target.dataset.id]; if (p) e.target.value = p.caption; e.target.blur(); }
    });

    var stack = $('ps-stack');
    stack.addEventListener('pointerdown', onDown);
    stack.addEventListener('pointermove', onMove);
    stack.addEventListener('pointerup', onUp);
    stack.addEventListener('pointercancel', onUp);
    if (window.ResizeObserver) new ResizeObserver(function () { cards().forEach(fit); }).observe(stack);

    document.addEventListener('keydown', function (e) {
      if (!alive()) return;
      if (e.key === 'Escape' && S.menu) { S.menu = false; renderMenu(); $('ps-menu-btn').focus(); return; }
      if (S.view !== 'swipe' || S.gate || e.altKey || e.ctrlKey || e.metaKey) return;
      var tg = e.target;
      if (tg && (tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName))) return;
      var r = APP.getBoundingClientRect();
      if (r.bottom < 80 || r.top > window.innerHeight - 80) return;   // app scrolled out of view: leave keys to the page
      if (S.intro) { if (e.key === 'Enter' && !(tg && tg.closest && tg.closest('button'))) { e.preventDefault(); dismissIntro(); } return; }
      var map = { ArrowLeft: 'pass', ArrowRight: 'keep', ArrowUp: 'hero' };
      if (map[e.key] && topCard()) { e.preventDefault(); fly(map[e.key]); }
      else if ((e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') && S.history.length) { e.preventDefault(); undo(); }
    });

    document.addEventListener('visibilitychange', function () { if (alive()) syncLive(); });
    var onFull = function () {
      if (!alive()) return;
      APP.classList.toggle('is-full', isFull() && (document.fullscreenElement || document.webkitFullscreenElement) === APP);
      if (S.view === 'results') renderResults();
      renderMenu();
    };
    document.addEventListener('fullscreenchange', onFull);
    document.addEventListener('webkitfullscreenchange', onFull);
    window.addEventListener('beforeunload', function (e) {
      if (!alive()) return;
      var busy = S.queue.length || S.uploads.some(function (u) { return u.status === 'waiting' || u.status === 'resizing' || u.status === 'uploading'; });
      if (busy) { e.preventDefault(); e.returnValue = ''; }
    });

    ['pass', 'hero', 'keep'].forEach(function (v) { $('ps-btn-' + v).querySelector('.ps-act-tile').innerHTML = IC[v]; });
    $('ps-menu-btn').innerHTML = icon(P.dots, 'ps-ic--fill');
  }

  /* ---------- start ---------- */
  async function start() {
    S.mode = 'loading'; S.gate = 'loading'; S.gateText = t('gateChecking');
    S.user = null; S.allowed = S.admin = S.realAdmin = false;
    renderFrame();
    var me = null, err = null;
    // Only ask SharePoint who we are when we're actually on SharePoint (or a site is configured).
    if (ON_SHAREPOINT || CONFIG.siteUrl) { try { me = await whoAmI(); } catch (e) { err = e; } }

    // The data lives on another site and this person has no access there (yet): find out who they are
    // from the page's own site, so they get a clear screen instead of a technical error.
    var pageWeb = CTX && CTX.webAbsoluteUrl ? String(CTX.webAbsoluteUrl).replace(/\/$/, '') : '';
    if (!me && err && (err.status === 401 || err.status === 403) && pageWeb && pageWeb.toLowerCase() !== SITE.toLowerCase()) {
      try {
        var here = await spGet(pageWeb + '/_api/web/currentuser?$select=Id,Title,Email,UserPrincipalName,LoginName');
        S.mode = 'sharepoint';
        S.user = mkUser(here);
        S.realAdmin = isListed(S.user, CONFIG.adminEmails);
        S.allowed = S.realAdmin || isListed(S.user, CONFIG.allowedEmails);
        S.lastError = err.message;
        S.gate = S.allowed ? 'noaccess' : 'denied';
        renderFrame();
        return;
      } catch (e2) { /* show the error screen below */ }
    }

    if (me) {
      S.mode = 'sharepoint';
      S.user = mkUser(me);
      S.realAdmin = isListed(S.user, CONFIG.adminEmails);
      S.allowed = S.realAdmin || isListed(S.user, CONFIG.allowedEmails);
      S.admin = S.realAdmin && !S.asReviewer;
      if (!S.allowed) { S.gate = 'denied'; renderFrame(); return; }
      S.gateText = t('gatePhotos');
      renderFrame();
      await Promise.all([checkLib(), checkVotes()]);
      if (S.lib.state === 'ok') {
        try { await loadSpPhotos(); } catch (e) { S.lib = { state: 'error', error: e.message }; S.lastError = e.message; }
      }
      if (S.list.state === 'ok') {
        S.store = 'sharepoint';
        S.votes = [];
        await loadVotesForRole();
        restorePending();
      } else {
        S.store = 'local';
        S.votes = loadLocalVotes();
      }
    } else if (ON_SHAREPOINT) {
      S.mode = 'sharepoint';
      S.lastError = err ? err.message : 'Unknown error';
      S.gate = 'error';
      renderFrame();
      return;
    } else {
      S.mode = 'demo'; S.store = 'local'; S.allowed = S.realAdmin = true;
      S.admin = !S.asReviewer;
      S.user = { key: 'demo-me', name: t('demoUser'), first: '', initials: '', email: '', upn: '', login: '' };
      setPhotos((window.PS_DEMO_PHOTOS || []).map(function (p) {
        return { id: String(p.id), name: p.file || p.id, caption: p.caption, credit: p.credit, folder: '', src: p.src, size: 0, jpeg: true };
      }));
      S.votes = exampleVotes().concat(loadLocalVotes());
      S.saved = S.votes.filter(function (v) { return !v.example; }).length;
    }

    buildDeck();
    S.gate = null;
    S.intro = S.deck.length > 0 && !getStore('intro-seen', false);
    setView(S.view);
  }

  // Players only ever load their own votes. Admins load every vote they can see.
  async function loadVotesForRole() {
    try {
      var r = await loadSpVotes(0);
      S.votes = r.votes.concat(S.votes.filter(function (v) { return !v.spId && !v.example; }));
      S.maxVoteId = r.maxId;
      S.updatedAt = new Date();
    } catch (e) { S.lastError = e.message; }
  }

  // Lets admins see exactly what players see: no Manage, no Results, only their own votes.
  async function setReviewerView(on) {
    S.asReviewer = !!on;
    S.admin = S.realAdmin && !S.asReviewer;
    S.menu = false;
    if (S.view === 'manage' && !S.admin) S.view = 'swipe';
    if (S.mode === 'sharepoint' && S.store === 'sharepoint') await loadVotesForRole();
    setView(S.view);
    toastText(t(on ? 'reviewerOn' : 'reviewerOff'));
  }

  function boot() {
    APP = document.getElementById('ps-app');
    if (!APP || APP.getAttribute('data-booted')) return;
    APP.setAttribute('data-booted', '1');
    S.lang = pickLang();
    applyStatic();
    wire();
    start();
  }

  // The markup comes first, but some script modules inject scripts before the HTML: wait for it.
  (function whenReady(n) {
    if (document.getElementById('ps-app')) boot();
    else if (n < 200) setTimeout(function () { whenReady(n + 1); }, 50);
  })(0);
