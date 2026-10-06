  /* ---------- results ---------- */
  function tally() {
    var votes = latest(S.votes).filter(function (v) { return S.byId[v.photo]; });
    var users = {}, totalMs = 0, examples = false, per = {}, nVotes = 0, sum = useSummary() ? S.summary : null;
    S.photos.forEach(function (p) { per[p.id] = { p: p, n: 0, keep: 0, hero: 0, pass: 0, ms: 0, mine: null, mineAt: null }; });
    votes.forEach(function (v) {
      var r = per[v.photo];
      if (S.user && v.user === S.user.key) { r.mine = v.verdict; r.mineAt = v.at; }
      if (sum) return;
      users[v.user] = true;
      totalMs += v.ms || 0;
      nVotes++;
      if (v.example) examples = true;
      r.n++; r[v.verdict]++; r.ms += v.ms || 0;
    });
    if (sum) {
      Object.keys(sum.photos || {}).forEach(function (id) {
        var r = per[id], a = sum.photos[id];
        if (!r) return;
        r.n = a[0]; r.keep = a[1]; r.hero = a[2]; r.pass = a[3]; r.ms = a[4];
        nVotes += a[0]; totalMs += a[4];
      });
    }
    var rows = Object.keys(per).map(function (k) {
      var r = per[k];
      r.rate = r.n ? (r.keep + r.hero) / r.n : -1;
      r.avg = r.n ? r.ms / r.n : 0;
      return r;
    }).sort(function (a, b) {
      return (b.rate - a.rate) || (b.hero - a.hero) || (b.n - a.n) || String(a.p.caption).localeCompare(String(b.p.caption));
    });
    var voted = rows.filter(function (r) { return r.n > 0; });

    // How often my verdict matches the majority of everyone else.
    var agree = 0, compared = 0;
    voted.forEach(function (r) {
      var mineIn = !!r.mine && (!sum || (r.mineAt && Date.parse(r.mineAt) <= Date.parse(sum.updated)));
      var others = r.n - (mineIn ? 1 : 0);
      if (!r.mine || others < 1) return;
      var yes = r.keep + r.hero - (mineIn && r.mine !== 'pass' ? 1 : 0);
      var share = yes / others;
      if (share === .5) return;
      compared++;
      if ((share > .5) === (r.mine !== 'pass')) agree++;
    });
    var reviewers = sum ? sum.reviewers : Object.keys(users).length;
    var hero = voted.slice().sort(function (a, b) { return (b.hero - a.hero) || (b.rate - a.rate); })[0];
    var minN = reviewers >= 3 ? 3 : 2;
    var split = voted.filter(function (r) { return r.n >= minN; })
      .sort(function (a, b) { return (Math.abs(a.rate - .5) - Math.abs(b.rate - .5)) || (b.n - a.n); })[0];
    return {
      rows: rows, voted: voted, reviewers: reviewers, votes: nVotes, avgMs: nVotes ? totalMs / nVotes : 0, examples: examples,
      taste: compared >= 3 ? agree / compared : null,
      hero: hero && hero.hero ? hero : null,
      split: split && Math.abs(split.rate - .5) <= .2 ? split : null
    };
  }

  function isFull() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }
  function canFull() { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); }

  function liveHtml() {
    var anon = CONFIG.anonymous ? '<span class="ps-anon">' + icon(P.lock) + T('anonymous') + '</span>' : '';
    if (S.store !== 'sharepoint') return '<span class="ps-live is-off"><i></i>' + T(S.mode === 'demo' ? 'liveDemo' : 'liveLocal') + '</span>' + anon;
    var at = S.updatedAt ? S.updatedAt.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '–';
    var on = CONFIG.liveSeconds > 0;
    return '<span class="ps-live' + (on ? '' : ' is-off') + '" id="ps-live"><i></i>' + (on ? T('live') + ' · ' : '') + T('updated', { time: at }) + '</span>' + anon;
  }

  function kpi(label, value) { return '<div class="ps-kpi"><span>' + esc(label) + '</span><b>' + esc(value) + '</b></div>'; }

  function podHtml(r, i) {
    return '<figure class="ps-pod ps-pod--' + (i + 1) + '"><div class="ps-pod-ph"><img alt="" src="' + esc(r.p.src) + '">' +
      '<span class="ps-medal">' + (i + 1) + '</span>' + (r.hero ? '<span class="ps-pod-hero">' + IC.hero + r.hero + '</span>' : '') + '</div>' +
      '<figcaption><span class="ps-pod-cap" title="' + esc(r.p.caption) + '">' + esc(r.p.caption) + '</span><span class="ps-pod-score"><b>' + pct(r.rate) +
      '</b><span>' + esc(L('keep')) + ' · ' + esc(nVotes(r.n)) + '</span></span></figcaption></figure>';
  }

  function highHtml(media, label, title, text) {
    return '<div class="ps-high">' + media + '<div><span class="ps-high-label">' + esc(label) + '</span><strong title="' + esc(title) + '">' + esc(title) + '</strong><small>' + esc(text) + '</small></div></div>';
  }

  function highlights(R) {
    var out = [];
    if (R.hero) out.push(highHtml('<img alt="" src="' + esc(R.hero.p.src) + '">', t('hlHero', { hero: L('hero') }), R.hero.p.caption, t('hlHeroText', { n: R.hero.hero, hero: L('hero') })));
    if (R.split) out.push(highHtml('<img alt="" src="' + esc(R.split.p.src) + '">', t('hlSplit'), R.split.p.caption, t('hlSplitText', { pct: pct(R.split.rate), keep: L('keep'), votes: nVotes(R.split.n) })));
    if (R.taste != null) out.push(highHtml('<span class="ps-high-ic">' + esc(pct(R.taste)) + '</span>', t('hlTaste'), S.user ? S.user.name : '', t('hlTasteText', { pct: pct(R.taste) })));
    return out.length ? '<div class="ps-highs">' + out.join('') + '</div>' : '';
  }

  function rowHtml(r, i) {
    var split = r.n >= 3 && r.rate >= .4 && r.rate <= .6;
    return '<li class="ps-rrow"><span class="ps-rrow-n">' + (i + 1) + '</span><img class="ps-rrow-th" alt="" loading="lazy" src="' + esc(r.p.src) + '">' +
      '<div class="ps-rrow-mid"><strong title="' + esc(r.p.caption) + '">' + esc(r.p.caption) + '</strong>' +
      '<div class="ps-bar" aria-hidden="true"><i class="k" style="width:' + (r.n ? r.keep / r.n * 100 : 0).toFixed(1) + '%"></i>' +
      '<i class="h" style="width:' + (r.n ? r.hero / r.n * 100 : 0).toFixed(1) + '%"></i></div>' +
      '<div class="ps-meta"><span>' + esc(nVotes(r.n)) + (r.n ? ' · ' + secs(r.avg) : '') + '</span>' +
      (r.mine ? '<span class="ps-chip ps-chip--' + r.mine + '">' + T('you', { verdict: L(r.mine) }) + '</span>' : '') +
      (r.hero ? '<span class="ps-chip ps-chip--hero">' + r.hero + '× ' + esc(L('hero')) + '</span>' : '') +
      (split ? '<span class="ps-chip ps-chip--split">' + T('split') + '</span>' : '') + '</div></div>' +
      '<div class="ps-rrow-pct">' + (r.n ? pct(r.rate) : '–') + '<small>' + esc(L('keep')) + '</small></div></li>';
  }

  function renderResults() {
    var el = $('ps-view-results');
    var R = tally();
    var tools = (canFull() ? '<button type="button" class="ps-btn ps-btn--soft" data-act="present">' + icon(P.present) + T(isFull() ? 'exitPresent' : 'present') + '</button>' : '') +
      (R.voted.length ? '<button type="button" class="ps-btn ps-btn--soft" data-act="export">' + icon(P.download) + T('exportCsv') + '</button>' : '') +
      (S.store === 'sharepoint' ? '<button type="button" class="ps-btn ps-btn--soft ps-btn--icon" data-act="refresh" aria-label="' + T('refresh') + '" title="' + T('refresh') + '">' + icon(P.refresh) + '</button>' : '');
    var html = '<div class="ps-head"><div class="ps-head-text"><h2>' + T('resTitle') + '</h2><div class="ps-live-row">' + liveHtml() + '</div></div><div class="ps-tools">' + tools + '</div></div>' +
      '<div class="ps-kpis">' + kpi(t('kPhotos'), S.photos.length) + kpi(t('kReviewers'), R.reviewers) + kpi(t('kVotes'), R.votes) +
      kpi(t('kAvg'), R.votes ? secs(R.avgMs) : '–') + '</div>';
    if (R.examples) html += '<p class="ps-note">' + T('exampleNote') + '</p>';
    if (!R.voted.length) {
      el.innerHTML = html + '<div class="ps-empty">' + T(useSummary() && !S.summary ? 'noSummary' : 'noVotes') + '</div>';
      return;
    }
    html += '<div class="ps-res-grid"><div><div class="ps-podium">' + R.voted.slice(0, 3).map(podHtml).join('') + '</div>' + highlights(R) + '</div>' +
      '<div><h3>' + T('fullRanking') + '</h3><ol class="ps-rank">' + R.rows.map(rowHtml).join('') + '</ol>' +
      '<div class="ps-legend"><span><i style="background:var(--b-raspberry)"></i>' + esc(L('keep')) + '</span>' +
      '<span><i style="background:linear-gradient(90deg,#C27FCD,#FC02B3)"></i>' + T('legendHero', { hero: L('hero'), keep: L('keep') }) + '</span>' +
      '<span><i style="background:var(--b-track)"></i>' + esc(L('pass')) + '</span></div></div></div>';
    el.innerHTML = html;
  }

  /* Live results: while the Results tab is open, fetch new swipes every few seconds. */
  var liveTimer = null, livePolls = 0;
  function syncLive() {
    var feeding = CONFIG.anonymous && seesAll() && S.admin;   // an admin's screen keeps the published totals fresh
    var want = alive() && (S.view === 'results' || feeding) && !S.gate && S.store === 'sharepoint' && CONFIG.liveSeconds > 0 && !document.hidden;
    if (want && !liveTimer) liveTimer = setInterval(livePoll, Math.max(3, CONFIG.liveSeconds) * 1000);
    if (!want && liveTimer) { clearInterval(liveTimer); liveTimer = null; }
  }

  function voteSig() { return S.votes.length + ':' + S.votes.reduce(function (a, v) { return a + (v.spId || 0); }, 0); }

  async function livePoll() {
    if (!alive()) { syncLive(); return; }
    if (S.polling) return;
    S.polling = true;
    try {
      var full = ++livePolls % 6 === 0;   // every 6th poll: full reload, which also picks up undos and new photos
      var before = voteSig() + '|' + S.photos.length + '|' + (S.summary ? S.summary.updated : '');
      if (useSummary()) {
        await loadSummary();
      } else {
        var r = await loadSpVotes(full ? 0 : S.maxVoteId);
        mergeVotes(r.votes, full);
        S.maxVoteId = Math.max(S.maxVoteId, r.maxId);
        S.updatedAt = new Date();
      }
      if (full && S.lib.state === 'ok') { await loadSpPhotos(); syncDeck(); }
      schedulePublish();
      if (S.view === 'results') {
        if (voteSig() + '|' + S.photos.length + '|' + (S.summary ? S.summary.updated : '') !== before) renderResults();
        else { var live = $('ps-live'); if (live) live.outerHTML = liveHtml().replace(/<span class="ps-anon">[\s\S]*$/, ''); }
      }
    } catch (e) {
      S.lastError = e.message;
    }
    S.polling = false;
  }

  /* The published totals: counts per photo, no names. Admins who see every vote write them; others read them. */
  var lastPublished = '', publishTimer = null;
  function canPublish() {
    return CONFIG.anonymous && S.mode === 'sharepoint' && S.admin && seesAll() && S.lib.state === 'ok' && S.store === 'sharepoint';
  }
  function schedulePublish() {
    if (!canPublish()) return;
    clearTimeout(publishTimer);
    publishTimer = setTimeout(publishSummary, 2500);
  }
  function buildSummary() {
    var photos = {}, users = {}, votes = 0, ms = 0;
    latest(S.votes).forEach(function (v) {
      if (!S.byId[v.photo] || v.example) return;
      var a = photos[v.photo] || (photos[v.photo] = [0, 0, 0, 0, 0]);
      a[0]++; a[{ keep: 1, hero: 2, pass: 3 }[v.verdict]]++; a[4] += v.ms || 0;
      users[v.user] = true; votes++; ms += v.ms || 0;
    });
    return { reviewers: Object.keys(users).length, votes: votes, photos: photos };
  }
  async function publishSummary() {
    if (!canPublish() || !alive()) return;
    if (S.queue.length) { schedulePublish(); return; }        // wait until my own swipes are saved
    var sum = buildSummary(), sig = JSON.stringify(sum);
    if (sig === lastPublished) return;
    sum.app = 'photo-swipe';
    sum.updated = new Date().toISOString();
    try {
      await spSend(libPath() + "/RootFolder/Files/add(url='" + SUMMARY_FILE + "',overwrite=true)", { body: JSON.stringify(sum), what: CONFIG.photoLibrary });
      lastPublished = sig;
    } catch (e) { S.lastError = e.message; }
  }
  async function loadSummary() {
    if (S.lib.state !== 'ok') return;
    var res = await spFetch(ORIGIN + encPath(S.lib.url + '/' + SUMMARY_FILE));
    if (res.status === 404) { S.summary = null; return; }
    if (!res.ok) throw await httpError(res, CONFIG.photoLibrary);
    var j = JSON.parse(await res.text());
    if (!j || typeof j.photos !== 'object') throw new Error(SUMMARY_FILE + ': ?');
    S.summary = j;
    S.updatedAt = new Date(j.updated);
  }

  async function refreshAll(btn) {
    if (S.mode !== 'sharepoint') return;
    if (btn) btn.classList.add('is-spinning');
    try {
      if (S.lib.state === 'ok') { await loadSpPhotos(); syncDeck(); }
      if (S.store === 'sharepoint') {
        var r = await loadSpVotes(0);
        mergeVotes(r.votes, true);
        S.maxVoteId = Math.max(S.maxVoteId, r.maxId);
        if (useSummary()) await loadSummary(); else S.updatedAt = new Date();
        schedulePublish();
      }
    } catch (e) {
      S.lastError = e.message;
      toastText(e.message, 6000);
    }
    setView(S.view);
  }

  function csvCell(v) {
    var s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // keep spreadsheet formulas from running
    return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    var R = tally();
    var dec = function (n) { return n.toLocaleString(locale(), { maximumFractionDigits: 1, useGrouping: false }); };
    var lines = [[t('csvRank'), t('csvCaption'), t('csvFile'), t('csvVotes'), L('keep'), L('hero'), L('pass'), t('csvPct', { keep: L('keep') }), t('csvAvg')]];
    R.rows.forEach(function (r, i) {
      lines.push([i + 1, r.p.caption, r.p.name || r.p.id, r.n, r.keep, r.hero, r.pass, r.n ? Math.round(r.rate * 100) : '', r.n ? dec(r.avg / 1000) : '']);
    });
    // Semicolons and a BOM: what Excel expects with Belgian regional settings.
    var csv = '﻿' + lines.map(function (l) { return l.map(csvCell).join(';'); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = slug(appTitle()) + '-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
    toastText(t('exported'));
  }

  function present() {
    S.menu = false;
    renderMenu();
    if (isFull()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    if (S.view !== 'results') setView('results');
    var el = APP, req = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!req) return;
    try { var p = req.call(el); if (p && p.catch) p.catch(function () { /* refused: stay inline */ }); } catch (e) { /* ignore */ }
  }
