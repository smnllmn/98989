  /* ---------- people ---------- */
  function mkUser(me) {
    var name = String(me.Title || '').replace(/\s*\([^)]*\)\s*$/, '').trim() || me.Email || 'You';
    var parts = name.split(/\s+/).filter(Boolean);
    var initials = (parts[0] || '?').charAt(0) + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '');
    return { key: 'sp' + me.Id, id: me.Id, name: name, first: parts[0] || name, initials: initials.toUpperCase(),
      email: me.Email || '', upn: me.UserPrincipalName || '', login: me.LoginName || '' };
  }

  function isListed(u, list) {
    var allow = (list || []).map(function (e) { return String(e).trim().toLowerCase(); });
    var login = (u.login || '').split('|').pop();
    return [u.email, u.upn, login].some(function (x) { return x && allow.indexOf(String(x).toLowerCase()) !== -1; });
  }

  /* Example reviewers so the demo's results screen has something to show. Never used on SharePoint. */
  function exampleVotes() {
    var appeal = { cat: .9, rocket: .75, coffee: .6, astronaut: .7, dahlia: .55, 'deep-field': .8, hopper: .65, motorcycle: .35, palace: .5, cameraman: .3 };
    var seed = 7, out = [];
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    ['A', 'B', 'C', 'D'].forEach(function (n, i) {
      S.photos.forEach(function (ph) {
        var a = appeal[ph.id] != null ? appeal[ph.id] : .5, r = rnd();
        out.push({ photo: ph.id, verdict: r < a * .22 ? 'hero' : r < a ? 'keep' : 'pass', ms: Math.round(900 + rnd() * 3200),
          user: 'example' + i, name: t('exampleName', { n: n }), example: true, seq: ++S.seq });
      });
    });
    return out;
  }

  /* ---------- chrome ---------- */
  function renderTop() {
    $('ps-name').textContent = appTitle();
    var u = S.user, av = $('ps-avatar');
    if (u && u.initials) av.textContent = u.initials; else av.innerHTML = icon(P.user);
    av.title = u ? u.name + (u.email ? ' · ' + u.email : '') : '';
    var sub = '';
    if (S.gate === 'loading') sub = t('gateLoading');
    else if (!S.gate && u) {
      var total = S.photos.length;
      var seen = S.photos.filter(function (p) { return S.done[p.id]; }).length;
      sub = (S.mode === 'demo' ? t('helloDemo') : t('hello', { name: u.first })) + (total ? ' · ' + t('progress', { done: seen, total: total }) : '');
    }
    $('ps-sub').textContent = sub;
  }

  function renderTabs() {
    $('ps-tab-manage').hidden = !S.admin;
    $('ps-tab-results').hidden = !canSeeResults();
    $('ps-tabs').hidden = !!S.gate || !S.admin;   // players only swipe: no tab bar at all
    ['swipe', 'results', 'manage'].forEach(function (v) {
      var b = $('ps-tab-' + v);
      b.setAttribute('aria-selected', String(S.view === v));
      b.tabIndex = S.view === v ? 0 : -1;
    });
  }

  function renderBanner() {
    var b = $('ps-banner'), html = '';
    if (!S.gate && S.view !== 'details') {
      if (S.asReviewer) {
        html = '<span>' + icon(P.eye) + ' ' + T('reviewerBanner') + '</span>' +
          '<button type="button" class="ps-btn ps-btn--white ps-btn--sm" data-act="as-reviewer" data-id="off">' + T('viewAsAdmin') + '</button>';
      } else if (S.mode === 'sharepoint' && S.lib.state === 'ok' && S.list.state === 'missing') {
        html = '<span>' + T('listMissing', { list: CONFIG.votesList }) + '</span>' +
          (S.admin ? '<button type="button" class="ps-btn ps-btn--white ps-btn--sm" data-act="setup">' + T('setupBtn') + '</button>' : '');
      } else if (S.mode === 'sharepoint' && S.list.state === 'error') {
        html = '<span>' + T('listError', { err: S.list.error || S.lastError }) + '</span>';
      }
    }
    b.innerHTML = html;
    b.hidden = !html;
  }

  function renderStatus() {
    var el = $('ps-status');
    if (!el) return;
    var parts = [];
    if (!S.gate && S.allowed && !(S.mode === 'sharepoint' && S.lib.state !== 'ok')) {
      if (S.store === 'sharepoint') {
        parts.push(S.queue.length ? '<span><span class="ps-dot ps-dot--busy"></span> ' + T('stSaving', { n: S.queue.length }) + '</span>'
          : '<span><span class="ps-dot"></span> ' + T('stSaved') + '</span>');
        if (S.failed.length) parts.push('<span>' + T('stFailed', { n: S.failed.length }) + '</span><button type="button" class="ps-linkbtn" data-act="retry">' + T('retry') + '</button>');
      } else {
        parts.push('<span>' + T(S.mode === 'demo' ? 'stDemo' : 'stLocal') + '</span>');
      }
    }
    el.innerHTML = parts.join('<span aria-hidden="true">·</span>');
  }

  function renderMenu() {
    var m = $('ps-menu');
    m.hidden = !S.menu;
    $('ps-menu-btn').setAttribute('aria-expanded', String(S.menu));
    if (!S.menu) return;
    m.innerHTML = '<div class="ps-menu-lang"><span>' + T('language') + '</span><div class="ps-seg" role="group" aria-label="' + T('language') + '">' +
      ['nl', 'fr', 'en'].map(function (l) {
        return '<button type="button" data-act="lang" data-id="' + l + '" aria-pressed="' + (S.lang === l) + '" lang="' + l + '">' + l.toUpperCase() + '</button>';
      }).join('') + '</div></div>' +
      (canFull() && canSeeResults() && !S.gate ? '<button type="button" class="ps-mi" data-act="present">' + icon(P.present) + T(isFull() ? 'exitPresent' : 'present') + '</button>' : '') +
      (S.realAdmin && !S.gate ? '<button type="button" class="ps-mi" data-act="as-reviewer" data-id="' + (S.asReviewer ? 'off' : 'on') + '">' + icon(P.eye) + T(S.asReviewer ? 'viewAsAdmin' : 'viewAsReviewer') + '</button>' +
        '<button type="button" class="ps-mi" data-act="preview-lock">' + icon(P.lock) + T('previewLock') + '</button>' : '') +
      (S.realAdmin || S.gate === 'error' ? '<button type="button" class="ps-mi" data-act="view" data-id="details">' + icon(P.info) + T('details') + '</button>' : '') +
      (S.allowed && !S.gate ? '<p class="ps-menu-keys">' + T('keys', { pass: L('pass'), keep: L('keep'), hero: L('hero') }) + '</p>' : '');
  }

  function renderGate() {
    var g = $('ps-gate');
    if (!S.gate) { g.innerHTML = ''; return; }
    if (S.gate === 'loading') {
      g.innerHTML = '<svg class="ps-spin" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 24A16 16 0 0 1 24 8"/><path d="M40 24A16 16 0 0 1 24 40"/></svg>' +
        '<h2>' + esc(S.gateText || t('gateChecking')) + '</h2>';
    } else if (S.gate === 'denied') {
      var u = S.user || {}, demo = S.mode === 'demo';
      var addr = demo ? 'colleague@belfius.be' : (u.email || u.upn || '?');
      g.innerHTML = '<span class="ps-round ps-gate-ic">' + icon(P.lock) + '</span><h2>' + T('deniedTitle') + '</h2>' +
        '<p>' + T('deniedText', { name: demo ? t('aColleague') : (u.name || t('aColleague')) }) + '</p>' +
        '<p>' + T('deniedAsk') + '</p><code id="ps-addr">' + esc(addr) + '</code>' +
        '<div class="ps-row"><button type="button" class="ps-btn ps-btn--white" data-act="copy">' + T('copy') + '</button>' +
        (S.previewLocked ? '<button type="button" class="ps-btn ps-btn--glass" data-act="end-preview">' + T('backToApp') + '</button>' : '') + '</div>' +
        (S.previewLocked ? '<p class="ps-small">' + T('previewNote') + '</p>' : '');
    } else if (S.gate === 'noaccess') {
      var who = S.user || {};
      g.innerHTML = '<span class="ps-round ps-gate-ic">' + icon(P.lock) + '</span><h2>' + T('noAccessTitle') + '</h2>' +
        '<p>' + T('noAccessText', { name: who.name || t('aColleague') }) + '</p><code id="ps-addr">' + esc(who.email || who.upn || '?') + '</code>' +
        '<div class="ps-row"><button type="button" class="ps-btn ps-btn--white" data-act="copy">' + T('copy') + '</button>' +
        '<button type="button" class="ps-btn ps-btn--glass" data-act="retry-boot">' + T('tryAgain') + '</button></div>';
    } else {
      g.innerHTML = '<span class="ps-round ps-gate-ic">' + icon(P.alert) + '</span><h2>' + T('errorTitle') + '</h2><p>' + esc(S.lastError) + '</p>' +
        '<p class="ps-small">' + T('errorHint', { site: SITE }) + '</p>' +
        '<button type="button" class="ps-btn ps-btn--white" data-act="retry-boot">' + T('tryAgain') + '</button>';
    }
  }

  function stateText(s) { return t({ ok: 'sOk', missing: 'sMissing', error: 'sError' }[s] || 'sUnknown'); }

  function renderDetails() {
    var u = S.user || {}, demo = S.mode === 'demo';
    var rows = [
      [t('dMode'), S.mode === 'sharepoint' ? t('dModeSp') : demo ? t('dModeDemo') : S.mode],
      [t('dSite'), SITE],
      [t('dUser'), u.name || '–'], [t('dEmail'), u.email || '–'], [t('dUpn'), u.upn || '–'],
      [t('dAllowed'), CONFIG.allowedEmails.join(', ')], [t('dAdmins'), CONFIG.adminEmails.join(', ')],
      [t('dAccess'), demo ? t('sNotChecked') : S.allowed ? t('dGranted') : S.user ? t('dDenied') : '–'],
      [t('dRole'), S.realAdmin ? t('dAdmin') + (S.asReviewer ? ' · ' + t('viewAsReviewer') : '') : S.allowed ? t('dReviewer') : '–'],
      [t('dPrivacy'), !CONFIG.anonymous ? t('sNotAnon') : S.list.readSecurity === 2 ? t('sLocked') : S.list.readSecurity === 1 ? t('sOpenList') : t('sAnon')],
      [t('dLib'), demo ? t('sNotUsed') : CONFIG.photoLibrary + ': ' + stateText(S.lib.state) + (S.lib.state === 'ok' ? ' · ' + nPhotos(S.photos.length) : '')],
      [t('dList'), demo ? t('sNotUsed') : CONFIG.votesList + ': ' + stateText(S.list.state)],
      [t('dSaved'), String(S.saved)], [t('dError'), S.lastError || '–'], [t('dVersion'), VERSION + ' · ' + S.lang]
    ];
    var acts = '';
    if (S.admin && S.mode === 'sharepoint' && (S.lib.state === 'missing' || S.list.state === 'missing')) acts += '<button type="button" class="ps-btn" data-act="setup">' + T('setupBtn') + '</button>';
    if (S.allowed && !S.gate) acts += '<button type="button" class="ps-btn ps-btn--soft" data-act="preview-lock">' + icon(P.lock) + T('previewLock') + '</button>';
    if (S.store === 'local' && S.allowed && !S.gate) acts += '<button type="button" class="ps-btn ps-btn--soft" data-act="clear-local">' + T('clearLocal') + '</button>';
    $('ps-view-details').innerHTML = '<div class="ps-head"><h2>' + T('dTitle') + '</h2><button type="button" class="ps-btn ps-btn--soft" data-act="back">' + T('back') + '</button></div>' +
      '<dl class="ps-dl">' + rows.map(function (r) { return '<dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>' +
      (acts ? '<div class="ps-row ps-row--start">' + acts + '</div>' : '');
  }

  function renderFrame() {
    var gate = !!S.gate && S.view !== 'details';
    $('ps-gate').hidden = !gate;
    $('ps-main').hidden = gate;
    renderGate(); renderTop(); renderTabs(); renderBanner(); renderMenu(); renderStatus();
  }

  function setView(v) {
    if ((v === 'manage' && !S.admin) || (v === 'results' && !canSeeResults())) v = 'swipe';
    if (v === 'details' && S.view !== 'details') S.prevView = S.view;
    if (v !== S.view) hideToast();
    S.view = v;
    if (v !== 'swipe') APP.classList.remove('is-rebel');
    S.menu = false;
    S.confirmRemove = null;
    ['swipe', 'results', 'manage', 'details'].forEach(function (x) { $('ps-view-' + x).hidden = x !== v; });
    renderFrame();
    if (v === 'swipe' && !S.gate) renderStack();
    else if (v === 'results') renderResults();
    else if (v === 'manage') renderManage();
    else if (v === 'details') renderDetails();
    syncLive();
  }

  function applyStatic() {
    APP.setAttribute('lang', S.lang);
    APP.setAttribute('data-shape', CONFIG.cardShape || 'auto');
    $('ps-tab-swipe').textContent = t('tabSwipe');
    $('ps-tab-results').textContent = t('tabResults');
    $('ps-tab-manage').textContent = t('tabManage');
    $('ps-menu-btn').setAttribute('aria-label', t('menu'));
    [['pass', '←'], ['hero', '↑'], ['keep', '→']].forEach(function (a) {
      var b = $('ps-btn-' + a[0]);
      b.setAttribute('aria-label', L(a[0]));
      b.querySelector('.ps-act-label').textContent = L(a[0]);
      b.querySelector('kbd').textContent = a[1];
    });
    $('ps-stack').setAttribute('aria-label', t('stackAria', { pass: L('pass'), keep: L('keep'), hero: L('hero') }));
  }

  function pickLang() {
    var saved = getStore('lang', null);
    if (saved && I18N[saved]) return saved;
    var forced = String(CONFIG.language || 'auto').toLowerCase();
    if (I18N[forced]) return forced;
    var cands = [CTX && CTX.currentUICultureName, CTX && CTX.currentCultureName, document.documentElement.lang]
      .concat(navigator.languages || [navigator.language]);
    for (var i = 0; i < cands.length; i++) {
      var two = String(cands[i] || '').slice(0, 2).toLowerCase();
      if (I18N[two]) return two;
    }
    return 'en';
  }

  function setLang(l) {
    if (!I18N[l]) return;
    S.lang = l;
    setStore('lang', l);
    applyStatic();
    cards().forEach(function (el) { el.remove(); });   // stamps carry the words: rebuild the cards
    setView(S.view);
    S.menu = true;
    renderMenu();
  }

  async function doSetup(btn) {
    if (btn) { btn.disabled = true; btn.textContent = t('setupBusy'); }
    try {
      await setupSharePoint();
      if (S.lib.state === 'ok') await loadSpPhotos();
      if (S.list.state === 'ok' && S.store !== 'sharepoint') {
        var local = S.votes.filter(function (v) { return !v.spId && !v.example; });
        setStore(localKey(), null);
        S.store = 'sharepoint';
        local.forEach(function (v) { v.job = { v: v, tries: 0 }; S.queue.push(v.job); });
        persistPending();
        flush();
      }
      buildDeck();
      toastText(t('setupDone'));
      setView(S.photos.length ? S.view : 'manage');
    } catch (e) {
      S.lastError = e.message;
      toastText(t('setupFail', { err: e.message }), 10000);
      await Promise.all([checkLib(), checkVotes()]);
      setView(S.view);
    }
  }

  async function copyAddr(btn) {
    var node = $('ps-addr');
    try { await navigator.clipboard.writeText(node.textContent); btn.textContent = t('copied'); }
    catch (e) {
      var r = document.createRange();
      r.selectNodeContents(node);
      var sel = getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      btn.textContent = t('selected');
    }
  }
