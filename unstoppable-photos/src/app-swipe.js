  /* ---------- recording + saving swipes ---------- */
  function mkVote(photo, verdict, ms) {
    return { photo: photo, verdict: verdict, ms: Math.round(ms || 0), user: S.user.key, name: S.user.name,
      at: new Date().toISOString(), seq: 1e12 + (++S.seq) };
  }

  function record(photo, verdict, ms) {
    var v = mkVote(photo, verdict, ms);
    S.votes.push(v);
    S.done[photo] = true;
    S.history.push(v);
    if (S.history.length > 50) S.history.shift();
    if (S.store === 'sharepoint') {
      v.job = { v: v, tries: 0 };
      S.queue.push(v.job);
      persistPending();
      flush();
    } else {
      saveLocalVotes();
      S.saved++;
    }
    renderStatus();
    renderTop();
    return v;
  }

  function restorePending() {
    var list = getStore(pendingKey(), null);
    if (!Array.isArray(list) || !list.length) return;
    list.forEach(function (x) {
      if (!x || VERDICTS.indexOf(x.verdict) === -1) return;
      var v = mkVote(String(x.photo), x.verdict, x.ms);
      v.at = x.at || v.at;
      v.job = { v: v, tries: 0 };
      S.votes.push(v);
      S.queue.push(v.job);
    });
    flush();
  }

  var flushing = false;
  async function flush() {
    if (flushing) return;
    flushing = true;
    while (S.queue.length && alive()) {
      var job = S.queue[0];
      job.sending = true;
      try {
        var id = await spAddVote(job.v);
        job.v.spId = id;
        S.saved++;
        if (S.queue[0] === job) S.queue.shift();
        if (job.cancelled && id) { try { await spRecycle(votesPath(), id); } catch (e) { /* the next swipe on this photo overrides it anyway */ } }
      } catch (e) {
        job.tries++;
        S.lastError = e.message;
        var permanent = e.status >= 400 && e.status < 500 && [408, 409, 429].indexOf(e.status) === -1;
        if (permanent || job.tries >= 4) {
          if (S.queue[0] === job) S.queue.shift();
          if (!job.cancelled) S.failed.push(job.v);
        } else {
          job.sending = false;
          renderStatus();
          await sleep(1500 * Math.pow(2, job.tries));
        }
      }
      job.sending = false;
      persistPending();
      renderStatus();
    }
    flushing = false;
    renderStatus();
  }

  function retryFailed() {
    S.failed.forEach(function (v) { v.job = { v: v, tries: 0 }; S.queue.push(v.job); });
    S.failed = [];
    persistPending();
    flush();
  }

  function undo() {
    if (S.busy || S.gate) return;
    var v = S.history.pop();
    if (!v) return;
    S.votes = S.votes.filter(function (x) { return x !== v && !(v.spId && x.spId === v.spId); });
    if (S.store === 'sharepoint') {
      var job = v.job, qi = job ? S.queue.indexOf(job) : -1;
      if (qi !== -1 && !job.sending) S.queue.splice(qi, 1);
      else if (job && job.sending) job.cancelled = true;
      else if (v.spId) spRecycle(votesPath(), v.spId).catch(function (e) { S.lastError = e.message; });
      var fi = S.failed.indexOf(v);
      if (fi !== -1) S.failed.splice(fi, 1);
      persistPending();
    } else {
      saveLocalVotes();
      S.saved = Math.max(0, S.saved - 1);
    }
    delete S.done[v.photo];
    if (S.byId[v.photo]) {
      S.deck = S.deck.filter(function (id) { return id !== v.photo; });
      S.deck.unshift(v.photo);
    }
    hideToast();
    if (S.view !== 'swipe') setView('swipe');
    renderStack({ enter: v.verdict });
    renderStatus();
    renderTop();
  }

  /* ---------- deck ---------- */
  function latest(votes) {
    var m = {};
    votes.forEach(function (v) {
      var k = v.user + '|' + v.photo;
      if (!m[k] || (v.seq || 0) >= (m[k].seq || 0)) m[k] = v;
    });
    return Object.keys(m).map(function (k) { return m[k]; });
  }

  function myVotes() {
    var m = {};
    if (!S.user) return m;
    latest(S.votes).forEach(function (v) { if (v.user === S.user.key) m[v.photo] = v.verdict; });
    return m;
  }

  function buildDeck() {
    S.done = {};
    var mine = myVotes();
    Object.keys(mine).forEach(function (id) { if (S.byId[id]) S.done[id] = true; });
    S.deck = shuffle(S.photos.filter(function (p) { return !S.done[p.id]; }).map(function (p) { return p.id; }));
  }

  // Adds photos that appeared since the deck was built (new uploads, a refresh).
  function syncDeck() {
    var inDeck = {};
    S.deck.forEach(function (id) { inDeck[id] = true; });
    var fresh = S.photos.filter(function (p) { return !S.done[p.id] && !inDeck[p.id]; }).map(function (p) { return p.id; });
    S.deck = S.deck.concat(shuffle(fresh));
  }

  function restart() {
    S.done = {};
    S.history = [];
    S.deck = shuffle(S.photos.map(function (p) { return p.id; }));
    renderStack();
    renderTop();
  }

  var lastPhotoCheck = 0;
  async function checkNewPhotos() {
    if (S.mode !== 'sharepoint' || S.lib.state !== 'ok' || Date.now() - lastPhotoCheck < 15000) return;
    lastPhotoCheck = Date.now();
    var before = S.deck.length;
    try { await loadSpPhotos(); syncDeck(); } catch (e) { S.lastError = e.message; return; }
    if (S.deck.length !== before && S.view === 'swipe') renderStack();
    renderTop();
  }

  /* ---------- cards ---------- */
  function cardInner(p) {
    return '<div class="ps-card-inner"><div class="ps-card-bg"></div><div class="ps-card-skel"></div>' +
      '<img class="ps-card-img" alt="' + T('photoAlt', { n: S.photos.indexOf(p) + 1 }) + '" draggable="false">' +
      '<div class="ps-card-err">' + icon(P.image) + '<span>' + T('photoBroken') + '</span></div>' +
      '<div class="ps-tint ps-tint--keep"></div><div class="ps-tint ps-tint--pass"></div><div class="ps-tint ps-tint--hero"></div>' +
      '<span class="ps-stamp ps-stamp--keep">' + IC.keep + esc(L('keep')) + '</span>' +
      '<span class="ps-stamp ps-stamp--pass">' + IC.pass + esc(L('pass')) + '</span>' +
      '<span class="ps-stamp ps-stamp--hero">' + IC.hero + esc(L('hero')) + '</span></div>';
  }

  function makeCard(id) {
    var p = S.byId[id];
    var el = document.createElement('article');
    el.className = 'ps-card is-loading';
    el.dataset.id = id;
    el.setAttribute('aria-label', t('photoAlt', { n: S.photos.indexOf(p) + 1 }));
    el.innerHTML = cardInner(p);
    var img = el.querySelector('.ps-card-img');
    var ready = function () { el.classList.remove('is-loading'); fit(el); };
    img.addEventListener('load', ready);
    img.addEventListener('error', function () { el.classList.remove('is-loading'); el.classList.add('is-broken'); });
    img.src = p.src;
    if (img.complete && img.naturalWidth) ready();
    return el;
  }

  // Photos close to the card's shape fill it; others are shown whole on a blurred copy of themselves.
  function fit(el) {
    var img = el.querySelector('.ps-card-img');
    if (!img || !img.naturalWidth) return;
    var st = $('ps-stack');
    var box = st.offsetWidth && st.offsetHeight ? st.offsetWidth / st.offsetHeight : .75;
    var contain = Math.abs(Math.log((img.naturalWidth / img.naturalHeight) / box)) > .2;
    el.classList.toggle('is-contain', contain);
    var bg = el.querySelector('.ps-card-bg');
    if (contain && !bg.style.backgroundImage) bg.style.backgroundImage = 'url("' + img.src.replace(/["\\\n]/g, encodeURIComponent) + '")';
  }

  var preloaded = {};
  function preload(ids) {
    ids.forEach(function (id) {
      var p = S.byId[id];
      if (!p || preloaded[p.src]) return;
      var im = new Image();
      im.decoding = 'async';
      im.src = p.src;
      preloaded[p.src] = im;
    });
  }

  function cards() {
    return Array.prototype.filter.call($('ps-stack').children, function (el) {
      return el.classList.contains('ps-card') && !el.classList.contains('is-flying');
    });
  }
  function topCard() { return cards().filter(function (el) { return el.dataset.depth === '0'; })[0] || null; }
  function nextCard() { return cards().filter(function (el) { return el.dataset.depth === '1'; })[0] || null; }

  function outTransform(verdict, dx, dy) {
    var st = $('ps-stack'), w = st.offsetWidth || 360, h = st.offsetHeight || 480;
    if (verdict === 'keep') return 'translate(' + Math.round(w * 1.4 + Math.max(0, dx)) + 'px,' + Math.round(dy + 40) + 'px) rotate(22deg)';
    if (verdict === 'pass') return 'translate(' + Math.round(-w * 1.4 + Math.min(0, dx)) + 'px,' + Math.round(dy + 40) + 'px) rotate(-22deg)';
    return 'translate(' + Math.round(dx) + 'px,' + Math.round(-h * 1.5) + 'px) rotate(' + (dx * .03).toFixed(1) + 'deg)';
  }

  function renderStack(opts) {
    opts = opts || {};
    var stack = $('ps-stack');
    S.deck = S.deck.filter(function (id) { return S.byId[id]; });
    var want = S.deck.slice(0, 3);
    var have = cards();
    have.forEach(function (el) { if (want.indexOf(el.dataset.id) === -1) el.remove(); });
    var fresh = [], enter = null;
    want.forEach(function (id, d) {
      var el = have.filter(function (c) { return c.dataset.id === id && c.isConnected; })[0];
      if (!el) {
        el = makeCard(id);
        if (d === 0 && opts.enter) {
          enter = el;
          el.classList.add('is-dragging');
          el.style.transform = outTransform(opts.enter, 0, 0);
          el.style.opacity = '0';
        } else if (!opts.instant) {
          el.classList.add('is-new');
          fresh.push(el);
        }
        stack.insertBefore(el, stack.firstChild);
      } else if (el !== enter) {
        el.classList.remove('is-dragging', 'is-nudge');
        el.style.transform = '';
        el.style.opacity = '';
      }
      el.dataset.depth = String(d);
      if (d === 0) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', 'true');
    });
    if (enter || fresh.length) {
      void stack.offsetWidth;   // apply the start position before animating
      if (enter) { enter.classList.remove('is-dragging'); enter.style.transform = ''; enter.style.opacity = ''; }
      fresh.forEach(function (el) { el.classList.remove('is-new'); });
    }

    var top = want[0] || null;
    if (top !== S.topId) { S.topId = top; S.shownAt = performance.now(); }
    preload(S.deck.slice(3, 6));

    var state = stack.querySelector('.ps-state');
    var html = top ? '' : panelHtml();
    if (html) {
      if (!state) { state = document.createElement('div'); state.className = 'ps-state'; stack.appendChild(state); }
      state.innerHTML = html;
    } else if (state) state.remove();

    var intro = stack.querySelector('.ps-intro');
    if (S.intro && top) {
      if (!intro) { intro = document.createElement('div'); intro.className = 'ps-intro'; stack.appendChild(intro); }
      intro.innerHTML = introHtml();
    } else if (intro) intro.remove();

    var on = !!top && !S.intro;
    ['pass', 'hero', 'keep'].forEach(function (v) { $('ps-btn-' + v).disabled = !on; });
    var total = S.photos.length;
    var seen = S.photos.filter(function (p) { return S.done[p.id]; }).length;
    $('ps-progress-bar').style.width = total ? (seen / total * 100).toFixed(1) + '%' : '0%';
  }

  function panel(kind, ic, title, text, actions, kicker, extra) {
    return '<div class="ps-panel ps-panel--' + kind + '"><span class="ps-panel-ic">' + ic + '</span>' +
      (kicker ? '<span class="ps-kicker">' + esc(kicker) + '</span>' : '') +
      '<h2>' + esc(title) + '</h2>' + (text ? '<p>' + esc(text) + '</p>' : '') + (extra || '') +
      (actions ? '<div class="ps-row">' + actions + '</div>' : '') + '</div>';
  }

  // How I voted: 5 Top · 2 Unstoppable · 3 Flop
  function myTallyHtml() {
    var mine = myVotes(), n = { keep: 0, hero: 0, pass: 0 };
    S.photos.forEach(function (p) { if (mine[p.id]) n[mine[p.id]]++; });
    return '<div class="ps-tally">' + ['keep', 'hero', 'pass'].map(function (v) {
      return '<span class="ps-tally-i ps-tally-i--' + v + '"><b>' + n[v] + '</b>' + esc(L(v)) + '</span>';
    }).join('') + '</div>';
  }

  function panelHtml() {
    if (S.mode === 'sharepoint' && S.lib.state !== 'ok') {
      if (S.lib.state === 'error') return panel('error', icon(P.alert), t('libErrorTitle'), t('libError', { err: S.lib.error || S.lastError }), '');
      if (S.admin) return panel('setup', icon(P.setup), t('setupTitle'), t('setupText', { lib: CONFIG.photoLibrary, list: CONFIG.votesList }),
        '<button type="button" class="ps-btn" data-act="setup">' + T('setupBtn') + '</button>', t('setupKicker'));
      return panel('wait', icon(P.clock), t('notReadyTitle'), t('notReadyText'), '');
    }
    if (!S.photos.length) {
      if (S.admin) return panel('empty', icon(P.image), t('emptyTitle'), S.mode === 'demo' ? t('emptyDemo') : t('emptyAdmin', { lib: CONFIG.photoLibrary }),
        '<button type="button" class="ps-btn" data-act="view" data-id="manage">' + icon(P.upload) + T('addPhotos') + '</button>');
      return panel('empty', icon(P.image), t('emptyTitle'), t('emptyUser'), '');
    }
    if (!canSeeResults()) {
      return panel('done', icon(P.check), t('doneTitleThanks'), '',
        '<button type="button" class="ps-btn ps-btn--soft" data-act="restart">' + T('swipeAgain') + '</button>', t('doneKicker'), myTallyHtml());
    }
    return panel('done', icon(P.check), t('doneTitle'), '',
      '<button type="button" class="ps-btn" data-act="view" data-id="results">' + T('seeResults') + '</button>' +
      '<button type="button" class="ps-btn ps-btn--soft" data-act="restart">' + T('swipeAgain') + '</button>', t('doneKicker'), myTallyHtml());
  }

  function introHtml() {
    return '<div class="ps-panel ps-panel--intro"><span class="ps-kicker">' + T('introKicker') + '</span><h2>' + T('introTitle') + '</h2>' +
      '<ul class="ps-howto">' +
      '<li><span class="ps-howto-ic ps-howto-ic--keep">' + IC.keep + '</span><span><b>' + T('introRight') + '</b> = ' + esc(L('keep')) + '</span></li>' +
      '<li><span class="ps-howto-ic ps-howto-ic--pass">' + IC.pass + '</span><span><b>' + T('introLeft') + '</b> = ' + esc(L('pass')) + '</span></li>' +
      '<li><span class="ps-howto-ic ps-howto-ic--hero">' + IC.hero + '</span><span><b>' + T('introUp') + '</b> = ' + esc(L('hero')) + ', ' + T('introUpNote') + '</span></li>' +
      '</ul><p class="ps-small">' + T('introUndo') + '</p>' +
      '<button type="button" class="ps-btn" data-act="intro-start">' + T('introStart') + '</button></div>';
  }

  function dismissIntro() {
    S.intro = false;
    setStore('intro-seen', true);
    renderStack();
    try { $('ps-stack').focus({ preventScroll: true }); } catch (e) { /* old browsers */ }
  }

  /* ---------- swiping ---------- */
  function setMarks(card, k, p, h) {
    var q = function (s) { return card.querySelector(s); };
    q('.ps-stamp--keep').style.opacity = k; q('.ps-tint--keep').style.opacity = k;
    q('.ps-stamp--pass').style.opacity = p; q('.ps-tint--pass').style.opacity = p;
    q('.ps-stamp--hero').style.opacity = h; q('.ps-tint--hero').style.opacity = h;
  }

  function fly(verdict, drag) {
    var card = topCard();
    if (!card || S.busy || S.intro || S.gate) return;
    S.busy = true;
    var id = card.dataset.id;
    var ms = Math.min(600000, performance.now() - S.shownAt);
    setMarks(card, verdict === 'keep' ? 1 : 0, verdict === 'pass' ? 1 : 0, verdict === 'hero' ? 1 : 0);
    var go = function () {
      card.classList.remove('is-dragging', 'is-nudge');
      card.classList.add('is-flying');
      card.style.transform = outTransform(verdict, drag ? drag.dx : 0, drag ? drag.dy : 0);
      card.style.opacity = '0';
      setTimeout(function () { card.remove(); }, reduced() ? 30 : 520);
      var v = record(id, verdict, ms);
      S.deck.shift();
      S.busy = false;
      renderStack();
      voteToast(v);
      if (!S.deck.length) checkNewPhotos();
    };
    if (drag || reduced()) { go(); return; }
    // Buttons and keys: nudge the card and show the stamp for a moment, then let it fly.
    card.classList.add('is-nudge');
    card.style.transform = verdict === 'keep' ? 'translateX(26px) rotate(3deg)' : verdict === 'pass' ? 'translateX(-26px) rotate(-3deg)' : 'translateY(-26px)';
    setTimeout(go, 190);
  }

  var drag = null;
  function threshold() { return clamp($('ps-stack').offsetWidth * .26, 80, 150); }

  function onDown(e) {
    var card = topCard();
    if (!card || S.busy || S.intro || !card.contains(e.target) || (e.button != null && e.button !== 0)) return;
    var now = performance.now();
    drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, lx: e.clientX, ly: e.clientY, lt: now, vx: 0, vy: 0, card: card };
    card.classList.add('is-dragging');
    var next = nextCard();
    if (next) next.classList.add('is-dragging');
    try { card.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
  }

  function onMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var now = performance.now(), dt = Math.max(1, now - drag.lt);
    drag.vx = (e.clientX - drag.lx) / dt;
    drag.vy = (e.clientY - drag.ly) / dt;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    drag.card.style.transform = 'translate(' + drag.dx + 'px,' + drag.dy + 'px) rotate(' + (drag.dx * .05).toFixed(2) + 'deg)';
    var th = threshold();
    var up = -drag.dy > Math.abs(drag.dx) ? clamp(-drag.dy / th, 0, 1) : 0;
    setMarks(drag.card, up ? 0 : clamp(drag.dx / th, 0, 1), up ? 0 : clamp(-drag.dx / th, 0, 1), up);
    var p = clamp(Math.max(Math.abs(drag.dx), -drag.dy) / (th * 1.3), 0, 1);
    var next = nextCard();
    if (next) next.style.transform = 'translateY(' + (16 - 16 * p).toFixed(1) + 'px) scale(' + (.94 + .06 * p).toFixed(3) + ')';
  }

  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    var th = threshold();
    var upward = -d.dy > Math.abs(d.dx);
    if (upward && (-d.dy > th || (d.vy < -.7 && -d.dy > 40))) return fly('hero', d);
    if (!upward && (d.dx > th || (d.vx > .6 && d.dx > 40))) return fly('keep', d);
    if (!upward && (d.dx < -th || (d.vx < -.6 && d.dx < -40))) return fly('pass', d);
    d.card.classList.remove('is-dragging');
    d.card.style.transform = '';
    setMarks(d.card, 0, 0, 0);
    var next = nextCard();
    if (next) { next.classList.remove('is-dragging'); next.style.transform = ''; }
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function showToast(html, ms) {
    var el = $('ps-toast');
    el.innerHTML = html;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, ms || 4000);
  }
  function hideToast() { clearTimeout(toastTimer); var el = $('ps-toast'); if (el) el.classList.remove('is-on'); }
  function toastText(text, ms) { showToast('<span class="ps-toast-text">' + esc(text) + '</span>', ms); }
  function voteToast(v) {
    showToast('<span class="ps-toast-dot ps-toast-dot--' + v.verdict + '"></span><span class="ps-toast-text">' + esc(L(v.verdict)) +
      '</span><button type="button" data-act="undo" aria-label="' + T('undo') + '">' + icon(P.undo) + '<span class="ps-undo-label">' + T('undo') + '</span></button>');
  }
