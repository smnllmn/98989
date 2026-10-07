  /* ---------- constants ---------- */
  var VERSION = '2.0';
  var NOMETA = 'application/json;odata=nometadata';
  var VERBOSE = 'application/json;odata=verbose';
  var CTX = window._spPageContextInfo || null;
  var ON_SHAREPOINT = !!CTX || /\.sharepoint(-df)?\.(com|us|cn|de)$/i.test(location.hostname);
  // The page's own site. Script modules often leave out _spPageContextInfo, so the address is the fallback.
  var PAGE_WEB = String((CTX && CTX.webAbsoluteUrl) ||
    (location.origin + ((location.pathname.match(/^\/(sites|teams)\/[^/]+/i) || [''])[0]))).replace(/\/$/, '');
  var SITE = (CONFIG.siteUrl || PAGE_WEB).replace(/\/$/, '');
  var ORIGIN = (function () { try { return new URL(SITE).origin; } catch (e) { return location.origin; } })();
  var KEY = 'unstoppable-photos:v2:';
  var IMG_RE = /\.(jpe?g|png|webp|gif|avif)$/i;
  var LARGE = 1.5 * 1024 * 1024;
  var VERDICTS = ['keep', 'pass', 'hero'];
  var LOCALES = { nl: 'nl-BE', fr: 'fr-BE', en: 'en-GB' };

  var APP = null;
  var MEM = {};
  function $(id) { return APP ? APP.querySelector('#' + id) : document.getElementById(id); }
  function alive() { return !!(APP && APP.isConnected); }

  var S = {
    mode: 'loading',          // loading | sharepoint | demo
    store: 'local',           // where swipes are saved: sharepoint | local
    gate: 'loading',          // loading | denied | error | null (app is usable)
    gateText: '',
    lang: 'en',
    user: null, allowed: false, admin: false, realAdmin: false, asReviewer: false,
    lib: { state: 'unknown' },
    list: { state: 'unknown', fields: {} },
    photos: [], byId: {}, skipped: 0,
    votes: [], maxVoteId: 0, seq: 0,
    done: {}, deck: [], history: [], topId: null, shownAt: 0, busy: false, intro: false,
    view: 'swipe', prevView: 'swipe', menu: false,
    queue: [], failed: [], saved: 0, lastError: '',
    uploads: [], confirmRemove: null, shrinking: null, savedCaption: null,
    uploadCat: null, manageCat: 'all', resultsCat: 'all', chapterOn: false, chaptersShown: {},
    updatedAt: null, polling: false, previewLocked: false
  };

  /* ---------- small helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var x = a[i]; a[i] = a[j]; a[j] = x; }
    return a;
  }
  function t(key, vars) {
    var d = I18N[S.lang] || I18N.en;
    var s = d[key] != null ? d[key] : (I18N.en[key] != null ? I18N.en[key] : key);
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] != null ? vars[k] : m; }) : s;
  }
  function T(key, vars) { return esc(t(key, vars)); }
  function L(code) {
    var set = (CONFIG.labels && (CONFIG.labels[S.lang] || CONFIG.labels.en)) || {};
    return set[code] || code;
  }
  function locale() { return LOCALES[S.lang] || 'en-GB'; }
  function cats() { return (CONFIG.categories && CONFIG.categories.length ? CONFIG.categories : [{ id: 'all', name: '' }]); }
  function catById(id) { return cats().filter(function (c) { return c.id === id; })[0] || cats()[0]; }
  function catOf(p) { return catById(p && p.cat); }
  function catIndex(id) { var i = cats().indexOf(catById(id)); return i < 0 ? 0 : i; }
  function catsInUse() { var m = {}; S.photos.forEach(function (p) { m[catOf(p).id] = true; }); return cats().filter(function (c) { return m[c.id]; }); }
  function appTitle() {
    var x = CONFIG.title;
    return String((x && typeof x === 'object' ? x[S.lang] || x.en || x[Object.keys(x)[0]] : x) || 'Unstoppable Photos');
  }
  function pct(x) { var n = Math.round(x * 100); return S.lang === 'fr' ? n + '\u202f%' : n + '%'; }
  function secs(ms) { return (ms / 1000).toLocaleString(locale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '\u00a0s'; }
  function fmtSize(b) {
    return b >= 1048576 ? (b / 1048576).toLocaleString(locale(), { maximumFractionDigits: 1 }) + '\u00a0MB'
      : Math.max(1, Math.round(b / 1024)) + '\u00a0KB';
  }
  function nVotes(n) { return t(n === 1 ? 'votes1' : 'votesN', { n: n }); }
  function nPhotos(n) { return t(n === 1 ? 'photos1' : 'photosN', { n: n }); }
  function prettyName(name) {
    var s = String(name || '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
  }
  function slug(name) {
    var s = String(name || '').replace(/\.[^.]+$/, '');
    if (s.normalize) s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50).replace(/-+$/, '');
    return s || 'photo';
  }
  function rand(n) {
    var abc = 'abcdefghijkmnpqrstuvwxyz23456789', out = '';
    var a = new Uint32Array(n);
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < n; i++) out += abc[a[i] % abc.length];
    return out;
  }
  function cssId(id) { return window.CSS && CSS.escape ? CSS.escape(id) : String(id).replace(/["\\]/g, '\\$&'); }
  function getStore(k, d) {
    if (Object.prototype.hasOwnProperty.call(MEM, k)) return MEM[k];
    try { var raw = localStorage.getItem(KEY + k); if (raw != null) return JSON.parse(raw); } catch (e) { /* storage blocked */ }
    return d;
  }
  function setStore(k, v) {
    MEM[k] = v;
    try { if (v == null) localStorage.removeItem(KEY + k); else localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* keep in memory */ }
  }
  // Results are for admins only. Players never see them and only ever load their own votes.
  function canSeeResults() { return !!S.admin; }
  function seesAll() { return !!S.admin && S.list.seeAll !== false; }

  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

  /* ---------- icons ---------- */
  function icon(d, cls) { return '<svg class="ps-ic' + (cls ? ' ' + cls : '') + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + d + '</svg>'; }
  var P = {
    user: '<circle cx="12" cy="8.5" r="3.6"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>',
    dots: '<circle cx="12" cy="5.6" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="12" cy="18.4" r="1.7"/>',
    undo: '<path d="M8.5 4.5L4 9l4.5 4.5"/><path d="M4.5 9H14a5.5 5.5 0 0 1 0 11h-3"/>',
    upload: '<path d="M12 15.5V4.5M7.5 9L12 4.5 16.5 9"/><path d="M4.5 15v3a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3"/>',
    trash: '<path d="M4.5 7h15M9.5 7V4.8h5V7M6.5 7l.9 12a2 2 0 0 0 2 1.8h5.2a2 2 0 0 0 2-1.8l.9-12M10 11v6M14 11v6"/>',
    ext: '<path d="M14 4.5h5.5V10M19.5 4.5L11 13M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10"/>',
    download: '<path d="M12 4.5v11M7.5 11l4.5 4.5 4.5-4.5M5 19.5h14"/>',
    refresh: '<path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"/><path d="M19.5 4.5v4.8h-4.8"/>',
    present: '<path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15"/>',
    info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.5M12 7.8v.1"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="3"/><circle cx="9" cy="10" r="1.7"/><path d="M20.5 15.5l-4.8-4.8L6.5 19"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    lock: '<rect x="5" y="10.5" width="14" height="10" rx="2.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/>',
    setup: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M6 18l2.1-2.1M15.9 8.1L18 6"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    alert: '<path d="M12 4.2l8.8 15.3H3.2z"/><path d="M12 10v4M12 16.8v.1"/>',
    shrink: '<path d="M4.5 9.5h5v-5M19.5 14.5h-5v5M4.5 4.5l5 5M19.5 19.5l-5-5"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>'
  };
  var IC = {
    pass: icon('<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', 'ps-ic--bold'),
    keep: icon('<path d="M12 20.3s-7.7-4.6-7.7-10.3A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.7 2.6c0 5.7-7.7 10.3-7.7 10.3z"/>', 'ps-ic--fill'),
    hero: icon('<path d="M13.4 2.6L5.2 13.3h5.9l-1.4 8.1 8.2-10.6H12z"/>', 'ps-ic--fill')
  };

  /* ---------- SharePoint REST ---------- */
  function spUrl(path) { return /^https?:\/\//i.test(path) ? path : SITE + path; }

  function spFetch(path, o) {
    o = o || {};
    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, o.timeout || 20000) : null;
    return fetch(spUrl(path), {
      method: o.method || 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: o.headers || { Accept: NOMETA }, body: o.body, signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) { clearTimeout(timer); return res; }, function (e) {
      clearTimeout(timer);
      throw new Error(e && e.name === 'AbortError' ? t('errTimeout') : t('errNetwork'));
    });
  }

  async function readJson(res) {
    var type = res.headers.get('content-type') || '';
    if (type.indexOf('json') === -1) throw new Error(t('errNotJson', { type: type || '–', status: res.status }));
    return res.json();
  }

  async function httpError(res, what) {
    var msg = '';
    try {
      var j = await res.json();
      var e = j['odata.error'] || j.error || {};
      msg = (e.message && (e.message.value || e.message)) || '';
    } catch (err) { /* not JSON */ }
    var out = new Error((what ? what + ': ' : '') + 'HTTP ' + res.status + (msg ? ' – ' + msg : ''));
    out.status = res.status;
    return out;
  }

  async function spGet(path, what) {
    var res = await spFetch(path);
    if (!res.ok) throw await httpError(res, what);
    return readJson(res);
  }

  async function spGetAll(path, what) {
    var out = [], next = path, pages = 0;
    while (next && pages++ < 100) {
      var j = await spGet(next, what);
      out = out.concat(j.value || []);
      next = j['odata.nextLink'] || j['@odata.nextLink'] || null;
    }
    return out;
  }

  var digest = { value: null, until: 0 };
  async function getDigest(fresh) {
    if (!fresh && digest.value && Date.now() < digest.until) return digest.value;
    var res = await spFetch('/_api/contextinfo', { method: 'POST', headers: { Accept: NOMETA } });
    if (!res.ok) throw await httpError(res, 'contextinfo');
    var j = await readJson(res);
    digest = { value: j.FormDigestValue, until: Date.now() + Math.max(120, (j.FormDigestTimeoutSeconds || 1800) - 120) * 1000 };
    return digest.value;
  }

  // POST with a request digest; retries once with a fresh digest if SharePoint says it expired.
  async function spSend(path, o) {
    o = o || {};
    for (var attempt = 0; attempt < 2; attempt++) {
      var headers = { Accept: NOMETA, 'X-RequestDigest': await getDigest(attempt > 0) };
      if (o.json !== undefined) headers['Content-Type'] = VERBOSE;
      if (o.headers) Object.keys(o.headers).forEach(function (k) { headers[k] = o.headers[k]; });
      var res = await spFetch(path, { method: 'POST', headers: headers, body: o.json !== undefined ? JSON.stringify(o.json) : o.body, timeout: o.timeout });
      if (res.ok) return res;
      var err = await httpError(res, o.what);
      if (attempt === 0 && res.status === 403 && /security validation|digest/i.test(err.message)) continue;
      throw err;
    }
  }

  function listPath(title) { return "/_api/web/lists/GetByTitle('" + encodeURIComponent(String(title).replace(/'/g, "''")) + "')"; }
  function libPath() { return listPath(CONFIG.photoLibrary); }
  function votesPath() { return listPath(CONFIG.votesList); }
  function encPath(p) { return String(p).split('/').map(encodeURIComponent).join('/'); }

  function whoAmI() { return spGet('/_api/web/currentuser?$select=Id,Title,Email,UserPrincipalName,LoginName'); }

  async function checkLib() {
    try {
      var j = await spGet(libPath() + '?$select=Id,BaseTemplate,ListItemEntityTypeFullName,RootFolder/ServerRelativeUrl&$expand=RootFolder');
      if ([101, 109, 851].indexOf(j.BaseTemplate) === -1) throw new Error(t('errNotLibrary', { name: CONFIG.photoLibrary }));
      S.lib = { state: 'ok', entityType: j.ListItemEntityTypeFullName, url: (j.RootFolder && j.RootFolder.ServerRelativeUrl) || '', hasCat: false };
    } catch (e) {
      S.lib = { state: e.status === 404 ? 'missing' : 'error', error: e.message };
      if (e.status !== 404) S.lastError = e.message;
      return;
    }
    await ensureCategoryField();
  }

  // The photo library gets a Category column; admins create it the first time they open the app.
  async function ensureCategoryField() {
    try {
      var f = await spGet(libPath() + "/fields?$select=InternalName&$filter=InternalName eq 'Category'");
      S.lib.hasCat = (f.value || []).length > 0;
      if (!S.lib.hasCat && S.realAdmin) {
        await spSend(libPath() + '/fields', { json: { __metadata: { type: 'SP.FieldText' }, FieldTypeKind: 2, Title: 'Category' } });
        S.lib.hasCat = true;
        try { await spSend(libPath() + "/DefaultView/ViewFields/addViewField('Category')"); } catch (e) { /* optional */ }
      }
    } catch (e) { S.lastError = e.message; }
  }

  async function checkVotes() {
    try {
      var j = await spGet(votesPath() + '?$select=Id,ListItemEntityTypeFullName,RootFolder/ServerRelativeUrl&$expand=RootFolder');
      var f = await spGet(votesPath() + "/fields?$select=InternalName&$filter=InternalName eq 'Verdict' or InternalName eq 'DwellMs' or InternalName eq 'PhotoName'");
      var have = {};
      (f.value || []).forEach(function (x) { have[x.InternalName] = true; });
      S.list = { state: 'ok', entityType: j.ListItemEntityTypeFullName, url: (j.RootFolder && j.RootFolder.ServerRelativeUrl) || '', fields: have };
      if (S.realAdmin && !(have.Verdict && have.DwellMs && have.PhotoName)) {
        try { await ensureVoteFields(); } catch (e) { S.lastError = e.message; }
      }
      if (!S.list.fields.Verdict) { S.list.state = 'error'; S.list.error = t('errNoVerdict', { list: CONFIG.votesList }); }
      await checkVotePrivacy();
    } catch (e) {
      S.list = { state: e.status === 404 ? 'missing' : 'error', error: e.message, fields: {} };
      if (e.status !== 404) S.lastError = e.message;
    }
  }

  // ReadSecurity 2 = people can only read their own rows (item-level permissions). With that on, only
  // people with the "Override List Behaviors" permission (site owners) see every row.
  async function checkVotePrivacy() {
    try { S.list.readSecurity = (await spGet(votesPath() + '?$select=ReadSecurity')).ReadSecurity; } catch (e) { S.list.readSecurity = null; }
    S.list.seeAll = true;
    if (S.realAdmin && S.list.readSecurity === 2) {
      try { S.list.seeAll = !!(Number((await spGet(votesPath() + '/EffectiveBasePermissions')).Low) & 0x100); } catch (e) { /* assume yes */ }
    }
  }

  // Item-level permissions on the votes list: people read and edit only their own rows. Needs Manage Lists rights.
  async function lockVotes() {
    await spSend(votesPath(), {
      json: { __metadata: { type: 'SP.List' }, ReadSecurity: 2, WriteSecurity: 2 },
      headers: { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, what: CONFIG.votesList
    });
    await checkVotePrivacy();
  }

  // Adds the columns the app writes. Older lists (from v1) get PhotoName added here.
  async function ensureVoteFields() {
    var have = S.list.fields;
    var defs = [['Verdict', 'SP.FieldText', 2], ['DwellMs', 'SP.FieldNumber', 9], ['PhotoName', 'SP.FieldText', 2]];
    for (var i = 0; i < defs.length; i++) {
      if (have[defs[i][0]]) continue;
      await spSend(votesPath() + '/fields', { json: { __metadata: { type: defs[i][1] }, FieldTypeKind: defs[i][2], Title: defs[i][0] } });
      have[defs[i][0]] = true;
      try { await spSend(votesPath() + "/DefaultView/ViewFields/addViewField('" + defs[i][0] + "')"); } catch (e) { /* view tweaks are optional */ }
    }
  }

  async function setupSharePoint() {
    if (S.lib.state === 'missing') {
      await spSend('/_api/web/lists', { json: { __metadata: { type: 'SP.List' }, Title: CONFIG.photoLibrary, BaseTemplate: 101, Description: t('libDescription', { title: appTitle() }) } });
      await checkLib();
    }
    if (S.list.state === 'missing') {
      await spSend('/_api/web/lists', { json: { __metadata: { type: 'SP.List' }, Title: CONFIG.votesList, BaseTemplate: 100, Description: t('listDescription', { title: appTitle() }) } });
      S.list = { state: 'ok', fields: {} };
      await ensureVoteFields();
      for (var f of ['Author', 'Created']) {
        try { await spSend(votesPath() + "/DefaultView/ViewFields/addViewField('" + f + "')"); } catch (e) { /* optional */ }
      }
      if (CONFIG.anonymous) { try { await lockVotes(); } catch (e) { S.lastError = e.message; } }
      await checkVotes();
    }
  }

  async function loadSpPhotos() {
    var rows = await spGetAll(libPath() + '/items?$select=Id,Title,FileLeafRef,FileRef,Modified,File/Length,File/UniqueId' + (S.lib.hasCat ? ',Category' : '') + '&$expand=File' +
      '&$filter=FSObjType eq 0&$orderby=Id asc&$top=1000', CONFIG.photoLibrary);
    var root = (S.lib.url || '').replace(/\/$/, '').toLowerCase();
    var photos = [], skipped = 0;
    rows.forEach(function (r) {
      var name = r.FileLeafRef || '';
      if (!IMG_RE.test(name)) { skipped++; return; }
      var ref = r.FileRef || '';
      var inLib = root && ref.toLowerCase().indexOf(root + '/') === 0 ? ref.slice(root.length + 1) : name;
      var title = String(r.Title || '').trim();
      photos.push({
        id: String(r.Id), uid: r.File && r.File.UniqueId, name: name,
        caption: title || prettyName(name), folder: inLib.split('/').slice(0, -1).join(' / '), cat: catById(r.Category).id,
        src: ORIGIN + encPath(ref) + '?v=' + (Date.parse(r.Modified) || 0),
        size: Number(r.File && r.File.Length) || 0, jpeg: /\.jpe?g$/i.test(name)
      });
    });
    setPhotos(photos);
    S.skipped = skipped;
  }

  function setPhotos(list) {
    S.photos = list;
    S.byId = {};
    list.forEach(function (p) { S.byId[p.id] = p; });
    S.deck = S.deck.filter(function (id) { return S.byId[id]; });
  }

  async function loadSpVotes(sinceId) {
    var filter = [];
    if (!seesAll()) filter.push('AuthorId eq ' + Number(S.user.id));
    if (sinceId) filter.push('Id gt ' + Number(sinceId));
    var rows = await spGetAll(votesPath() + '/items?$select=Id,Title,Verdict,DwellMs,Created,AuthorId,Author/Title&$expand=Author' +
      (filter.length ? '&$filter=' + filter.join(' and ') : '') + '&$orderby=Id asc&$top=2000', CONFIG.votesList);
    var maxId = sinceId || 0, votes = [];
    rows.forEach(function (it) {
      if (it.Id > maxId) maxId = it.Id;
      if (VERDICTS.indexOf(it.Verdict) === -1) return;
      votes.push({ photo: String(it.Title), verdict: it.Verdict, ms: Number(it.DwellMs) || 0, user: 'sp' + it.AuthorId,
        name: (it.Author && it.Author.Title) || '?', at: it.Created, spId: it.Id, seq: it.Id });
    });
    return { votes: votes, maxId: maxId };
  }

  // Server votes replace (full) or extend (incremental) what we have; unsaved local swipes are kept.
  function mergeVotes(server, full) {
    if (full) {
      var pending = S.votes.filter(function (v) { return !v.spId && !v.example; });
      S.votes = server.concat(pending);
      return;
    }
    var have = {};
    S.votes.forEach(function (v) { if (v.spId) have[v.spId] = true; });
    server.forEach(function (v) { if (!have[v.spId]) S.votes.push(v); });
  }

  async function spAddVote(v) {
    var body = { __metadata: { type: S.list.entityType }, Title: v.photo, Verdict: v.verdict };
    if (S.list.fields.DwellMs) body.DwellMs = v.ms;
    if (S.list.fields.PhotoName) body.PhotoName = String((S.byId[v.photo] || {}).name || '').slice(0, 255);
    var res = await spSend(votesPath() + '/items', { json: body, what: CONFIG.votesList });
    var j = await readJson(res);
    return j.Id || j.ID;
  }

  function spRecycle(path, id) { return spSend(path + '/items(' + Number(id) + ')/recycle()'); }

  async function spUpload(name, blob, caption, cat) {
    var res = await spSend(libPath() + "/RootFolder/Files/add(url='" + encodeURIComponent(name.replace(/'/g, "''")) + "',overwrite=false)",
      { body: blob, timeout: 120000, what: CONFIG.photoLibrary });
    var f = await readJson(res);
    var item = await spGet("/_api/web/GetFileById('" + f.UniqueId + "')/ListItemAllFields?$select=Id,Modified");
    var fields = {};
    if (caption) fields.Title = caption;
    if (S.lib.hasCat) fields.Category = cat;
    if (Object.keys(fields).length) await spSetFields(item.Id, fields);
    return {
      id: String(item.Id), uid: f.UniqueId, name: f.Name, caption: caption || prettyName(f.Name), folder: '', cat: catById(cat).id,
      src: ORIGIN + encPath(f.ServerRelativeUrl) + '?v=' + (Date.parse(item.Modified) || Date.now()),
      size: Number(f.Length) || blob.size, jpeg: true
    };
  }

  function spSetFields(id, fields) {
    var body = { __metadata: { type: S.lib.entityType } };
    Object.keys(fields).forEach(function (k) { body[k] = fields[k]; });
    return spSend(libPath() + '/items(' + Number(id) + ')', {
      json: body, headers: { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }, what: CONFIG.photoLibrary
    });
  }
  function spSetCaption(id, caption) { return spSetFields(id, { Title: caption }); }

  // Replaces a file's content in place: same item, same ID, so its votes stay attached.
  function spReplace(p, blob) {
    return spSend("/_api/web/GetFileById('" + p.uid + "')/$value", { body: blob, headers: { 'X-HTTP-Method': 'PUT' }, timeout: 120000, what: CONFIG.photoLibrary });
  }

  /* ---------- swipes kept in the browser (demo, or no votes list yet) ---------- */
  function localKey() { return S.mode === 'demo' ? 'demo-votes' : 'votes@' + SITE + '|' + (S.user ? S.user.key : ''); }
  function loadLocalVotes() {
    var saved = getStore(localKey(), []);
    return (Array.isArray(saved) ? saved : []).filter(function (v) { return v && VERDICTS.indexOf(v.verdict) !== -1; }).map(function (v) {
      return { photo: String(v.photo), verdict: v.verdict, ms: v.ms || 0, at: v.at, user: S.user.key, name: S.user.name, seq: 1e12 + (++S.seq) };
    });
  }
  function saveLocalVotes() {
    setStore(localKey(), S.votes.filter(function (v) { return !v.example && !v.spId; })
      .map(function (v) { return { photo: v.photo, verdict: v.verdict, ms: v.ms, at: v.at }; }));
  }

  // Swipes waiting for SharePoint survive a reload: they're sent next time the page opens.
  function pendingKey() { return 'pending@' + SITE + '|' + CONFIG.votesList + '|' + (S.user ? S.user.key : ''); }
  function persistPending() {
    if (S.store !== 'sharepoint') return;
    var list = S.queue.filter(function (j) { return !j.cancelled; }).map(function (j) { return j.v; }).concat(S.failed)
      .map(function (v) { return { photo: v.photo, verdict: v.verdict, ms: v.ms, at: v.at }; });
    setStore(pendingKey(), list.length ? list : null);
  }
