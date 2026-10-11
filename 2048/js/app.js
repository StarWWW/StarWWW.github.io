/*
 * 2048 AI Laboratuvarı: arayüz ve oyun döngüsü.
 */
'use strict';

// 0 = süre sınırı yok: arama her hamlede tam olarak seçilen derinliğe iner.
const THINK_TIMES = [0, 10, 25, 50, 100, 200, 350, 500, 750, 1000, 1500, 2500, 4000];
const SPEEDS = [
  { name: 'Yavaş', anim: 180, delay: 650, pause: 2400 },
  { name: 'Normal', anim: 120, delay: 180, pause: 1600 },
  { name: 'Hızlı', anim: 80, delay: 30, pause: 1200 },
  { name: 'Çok hızlı', anim: 45, delay: 0, pause: 900 },
  { name: 'Anında', anim: 0, delay: 0, pause: 700 },
  // Turbo: AI işçilerin içinde kendi kendine oynar, hamleler toplu gelir, ekran kare başına bir kez çizilir.
  { name: 'Turbo', anim: 0, delay: 0, pause: 200, turbo: true },
];
// starwww.dev'in çerez onayına bağlı (js/consent.js): sadece "fonksiyonel" izin varsa tarayıcıya yazılır
const STORE_KEY = 'star.2048';
const MODEL_URL = 'model/ntuple16.json';
const MAX_HISTORY_ROWS = 400;
const MILESTONE_MIN = 11; // 2048
// Grafik işaretçileri koyu zeminde okunmalı (sitenin DB32 paletinden açık tonlar)
const TILE_COLORS = { 11: '#FBF236', 12: '#D77BBA', 13: '#76428A', 14: '#5FCDE4', 15: '#99E550', 16: '#DF7126', 17: '#FF6B6B' };

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const yieldTask = () => new Promise((resolve) => {
  const ch = new MessageChannel();
  ch.port1.onmessage = () => resolve();
  ch.port2.postMessage(0);
});
// Sekme gizliyken zamanlayıcılar kısıtlanır; AI'ın arka planda yavaşlamaması için beklemeyi atla.
const pause = (ms) => (document.hidden || ms <= 0 ? yieldTask() : sleep(ms));

const app = {
  game: new Game(),
  view: null,
  ai: new AIController(),
  aiReady: false,
  running: false,
  loopId: 0,
  gameId: 0,
  thinkToken: 0,
  stepping: false,
  settings: { mode: 'ntuple', timeIdx: 4, maxDepth: 5, speedIdx: 1, autoRestart: true, hint: true, settingsVersion: 2 },
  history: [],
  milestones: [],
  gameStart: performance.now(),
  humanMoves: 0,
  recorded: false,
  analysis: null,
  replayIdx: null,
  stats: { games: [], best: 0 },
  chartMode: 'score',
  rowEls: [],
  gameChart: null,
  turboActive: false,
  movesPlayed: 0,
};

// ---------------------------------------------------------------------------
// Kalıcı ayarlar ve istatistikler
// ---------------------------------------------------------------------------

// Ziyaretçi fonksiyonel depolamaya izin verdi mi (site geneli onay kaydı, 12 ay geçerli)
function storeAllowed() {
  try {
    const c = JSON.parse(localStorage.getItem('star.consent') || 'null');
    return Boolean(c && c.v === 1 && c.functional && Date.now() - Date.parse(c.ts) < 365 * 86400000);
  } catch (_) { return false; }
}

function loadStore() {
  if (!storeAllowed()) return;
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && s.settings) {
      if (!s.settings.settingsVersion && typeof s.settings.timeIdx === 'number') s.settings.timeIdx += 1;
      Object.assign(app.settings, s.settings, { settingsVersion: 2 });
      app.settings.timeIdx = Math.min(app.settings.timeIdx, THINK_TIMES.length - 1);
      app.settings.speedIdx = Math.min(app.settings.speedIdx, SPEEDS.length - 1);
    }
    if (s && s.stats && Array.isArray(s.stats.games)) app.stats = s.stats;
  } catch (_) { /* depolama kullanılamıyor */ }
}

function saveStore() {
  if (!storeAllowed()) return; // izin yoksa ayarlar ve istatistikler sadece bu sekmede yaşar
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ settings: app.settings, stats: app.stats }));
  } catch (_) { /* depolama kullanılamıyor */ }
}
// İzin sonradan verilirse o ana kadar birikeni kaydet (izin geri çekilince consent.js anahtarı kendisi siler)
document.addEventListener('consentchange', () => saveStore());

// ---------------------------------------------------------------------------
// Oyun akışı
// ---------------------------------------------------------------------------

function newGame() {
  app.ai.cancel();
  app.gameId++;
  app.game.reset();
  app.history = [];
  app.milestones = [];
  app.humanMoves = 0;
  app.recorded = false;
  app.analysis = null;
  app.gameStart = performance.now();
  app.replayIdx = null;
  $('replayBanner').hidden = true;
  $('overlay').hidden = true;
  $('histBody').replaceChildren();
  app.rowEls = [];
  app.view.render(app.game, true);
  scheduleRender('scores', 'history', 'chart', 'milestones', 'decision');
  if (!app.running) updateBoardDesc();
  maybeHint();
}

function doMove(dir, analysis, by) {
  const g = app.game;
  if (g.over) return false;
  const fresh = analysis && analysis.gameId === app.gameId && analysis.moveNo === g.moves ? analysis : null;
  const before = Uint8Array.from(g.exps());
  const res = g.move(dir);
  if (!res.moved) return false;
  if (by === 'human') app.humanMoves++;

  let margin = null;
  if (fresh) {
    const qs = fresh.dirs.filter((d) => d.valid).map((d) => d.q).sort((a, b) => b - a);
    if (qs.length > 1) margin = qs[0] - qs[1];
  }
  const risk = fresh && fresh.dirs[dir] && fresh.dirs[dir].cellValues
    ? { cells: fresh.dirs[dir].cells, values: fresh.dirs[dir].cellValues, q: fresh.dirs[dir].q } : null;
  const entry = {
    exps: before, dir, by, gained: res.gained, score: g.score, margin, milestone: null, risk,
    qs: fresh ? fresh.dirs.map((d) => d.q) : null,
    best: fresh ? fresh.best : null,
    bestQ: fresh ? fresh.bestQ : null,
    depth: fresh ? fresh.depth : null,
    timeMs: fresh ? fresh.timeMs : null,
    evals: fresh ? fresh.evals : null,
    ttHits: fresh ? fresh.ttHits : null,
    mode: fresh ? fresh.mode : null,
    workers: fresh ? fresh.workers : null,
  };
  for (const v of res.merges) {
    if (v >= MILESTONE_MIN && !app.milestones.some((m) => m.exp === v)) {
      app.milestones.push({ exp: v, move: g.moves, ms: performance.now() - app.gameStart });
      entry.milestone = v;
      showToast(v);
    }
  }
  app.history.push(entry);
  app.movesPlayed++;
  app.analysis = null;
  if (g.score > app.stats.best) app.stats.best = g.score;

  if (app.replayIdx === null && SPEEDS[app.settings.speedIdx].anim > 0) {
    app.view.render(g, true);
    if (res.gained > 0) flashDelta(res.gained);
  }
  scheduleRender('board', 'scores', 'history', 'chart', 'milestones', 'decision');
  if (g.over && !app.running) finishGame();
  return true;
}

function finishGame() {
  if (app.recorded) return;
  app.recorded = true;
  const g = app.game;
  if (app.history.length > 0 && app.humanMoves === 0) {
    const modes = app.history.map((e) => e.mode).filter(Boolean);
    app.stats.games.push({
      score: g.score,
      maxExp: g.maxExp,
      moves: g.moves,
      ms: Math.round(performance.now() - app.gameStart),
      mode: modes.length ? modes[modes.length - 1] : app.settings.mode,
      think: THINK_TIMES[app.settings.timeIdx],
      depth: app.settings.maxDepth,
      turbo: app.history.some((e) => e.turbo),
      date: Date.now(),
    });
    if (app.stats.games.length > 1000) app.stats.games.splice(0, app.stats.games.length - 1000);
  }
  saveStore();
  showOverlay();
  announce(`Oyun bitti: ${formatNumber(g.score)} puan, en büyük taş ${formatNumber(tileValue(g.maxExp))}.`);
  updateBoardDesc();
  // İnsan oynarken odağı "Yeni oyun"a taşı; AI kendi kendine oynarken odak çalınmaz.
  if (!app.running && app.replayIdx === null) setTimeout(() => $('overlayNew').focus(), 50);
  scheduleRender('stats', 'scores', 'decision');
}

function showOverlay() {
  const g = app.game;
  $('overlayTitle').textContent = 'Oyun bitti';
  const auto = app.running && app.settings.autoRestart;
  $('overlaySub').textContent = `${formatNumber(g.score)} puan · en büyük taş ${formatNumber(tileValue(g.maxExp))} · ${formatNumber(g.moves)} hamle` +
    (auto ? ' · yeni oyun başlıyor…' : '');
  $('overlay').hidden = app.replayIdx !== null;
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

function searchOptions() {
  const s = app.settings;
  return { timeMs: THINK_TIMES[s.timeIdx], maxDepth: s.maxDepth, minDepth: Math.min(1, s.maxDepth) };
}

async function analyzeCurrent() {
  const moveNo = app.game.moves;
  const gameId = app.gameId;
  const token = ++app.thinkToken;
  setThinking(true);
  const exps = app.game.exps();
  const score = app.game.score;
  const res = await app.ai.analyze(exps, searchOptions());
  if (token === app.thinkToken) setThinking(false);
  if (!res || gameId !== app.gameId || moveNo !== app.game.moves) return null;
  res.moveNo = moveNo;
  res.gameId = gameId;
  res.exps = exps;
  res.score = score;
  if (!res.gameOver) {
    app.analysis = res;
    scheduleRender('decision');
  }
  return res;
}

function startAI() {
  if (!app.aiReady || app.running) return;
  if (app.replayIdx !== null) exitReplay();
  clearTimeout(hintTimer);
  app.running = true;
  const id = ++app.loopId;
  updatePlayButton();
  announce(SPEEDS[app.settings.speedIdx].turbo ? 'AI turbo modda oynamaya başladı.' : 'AI oynamaya başladı.');
  aiLoop(id);
}

function stopAI() {
  if (!app.running) return;
  app.running = false;
  app.loopId++;
  app.ai.cancel();
  app.thinkToken++;
  setThinking(false);
  updatePlayButton();
  announce('AI durduruldu.');
  updateBoardDesc();
  scheduleRender('decision');
}

async function aiLoop(id) {
  const alive = () => app.running && id === app.loopId;
  while (alive()) {
    if (app.game.over) {
      finishGame();
      if (!app.settings.autoRestart) {
        stopAI();
        return;
      }
      await pause(SPEEDS[app.settings.speedIdx].pause);
      if (!alive()) return;
      newGame();
      await pause(SPEEDS[app.settings.speedIdx].anim + 60);
      continue;
    }
    if (SPEEDS[app.settings.speedIdx].turbo) {
      await runTurbo();
      if (!alive()) return;
      await yieldTask();
      continue;
    }
    const a = await analyzeCurrent();
    if (!alive()) return;
    if (!a) { await yieldTask(); continue; }
    if (a.gameOver) { app.game.over = true; continue; }
    doMove(a.best, a, 'ai');
    const sp = SPEEDS[app.settings.speedIdx];
    await pause(sp.anim + sp.delay);
  }
}

/** Turbo: oyun bitene, durdurulana ya da ayarlar değişene kadar işçilerde toplu oynar. */
async function runTurbo() {
  const gameId = app.gameId;
  app.turboActive = true;
  setThinking(true);
  try {
    return await app.ai.turboPlay(app.game.exps(), searchOptions(), (batch) => applyTurboBatch(batch, gameId));
  } finally {
    app.turboActive = false;
    setThinking(false);
  }
}

/** İşçiden gelen hamle paketini gerçek oyuna uygular (tahta kare başına bir kez çizilir). */
function applyTurboBatch(b, gameId) {
  if (gameId !== app.gameId || !app.running || app.replayIdx !== null) return;
  const g = app.game;
  const workers = app.ai.workers.length;
  for (let i = 0; i < b.count; i++) {
    if (g.over) break;
    const before = new Uint8Array(16);
    for (let k = 0; k < 16; k++) {
      const t = g.grid[k];
      before[k] = t ? t.v : 0;
    }
    const dir = b.dirs[i];
    const code = b.spawns[i];
    const res = g.move(dir, { cell: code & 15, v: code >> 4 });
    if (!res.moved) {
      app.ai.stopTurbo(); // yalnızca 65536+ taşlarda olası uyumsuzluk: gerçek tahtadan yeniden başlar
      break;
    }
    const qs = b.qs.subarray(i * 4, i * 4 + 4);
    const bestQ = qs[dir];
    let second = -Infinity;
    for (let d = 0; d < 4; d++) if (d !== dir && qs[d] === qs[d] && qs[d] > second) second = qs[d];
    const entry = {
      exps: before, dir, by: 'ai', gained: res.gained, score: g.score, milestone: null, turbo: true,
      margin: second > -Infinity ? bestQ - second : null,
      qs, best: dir, bestQ, depth: b.depth[i], timeMs: b.time[i], evals: b.evals[i], ttHits: null,
      mode: b.mode, workers, risk: null, riskGrid: b.risk ? b.risk.subarray(i * 16, i * 16 + 16) : null,
    };
    for (const v of res.merges) {
      if (v >= MILESTONE_MIN && !app.milestones.some((m) => m.exp === v)) {
        app.milestones.push({ exp: v, move: g.moves, ms: performance.now() - app.gameStart });
        entry.milestone = v;
        showToast(v);
      }
    }
    app.history.push(entry);
    app.movesPlayed++;
    if (res.desync) {
      app.ai.stopTurbo();
      break;
    }
  }
  app.analysis = null;
  if (g.score > app.stats.best) app.stats.best = g.score;
  scheduleRender('board', 'scores', 'history', 'chart', 'milestones', 'decision');
}

async function stepAI() {
  if (!app.aiReady || app.stepping || app.game.over) return;
  stopAI();
  if (app.replayIdx !== null) exitReplay();
  app.stepping = true;
  try {
    const a = app.analysis && app.analysis.gameId === app.gameId && app.analysis.moveNo === app.game.moves
      ? app.analysis : await analyzeCurrent();
    if (a && !a.gameOver) doMove(a.best, a, 'ai');
  } finally {
    app.stepping = false;
  }
  maybeHint();
}

let hintTimer = null;
function maybeHint() {
  clearTimeout(hintTimer);
  if (!app.aiReady || app.running || !app.settings.hint || app.game.over || app.replayIdx !== null) return;
  hintTimer = setTimeout(() => {
    if (!app.running && app.replayIdx === null) analyzeCurrent();
  }, SPEEDS[app.settings.speedIdx].anim + 40);
}

function humanMove(dir) {
  if (app.replayIdx !== null) exitReplay();
  if (app.game.over) return;
  if (!app.game.canMoveDir(dir)) return;
  stopAI();
  clearTimeout(hintTimer);
  const analysis = app.analysis;
  app.ai.cancel();
  doMove(dir, analysis, 'human');
  updateBoardDesc();
  maybeHint();
}

// ---------------------------------------------------------------------------
// Geçmişte gezinme
// ---------------------------------------------------------------------------

function enterReplay(i) {
  if (app.history.length === 0) return;
  i = Math.max(0, Math.min(i, app.history.length));
  if (i === app.history.length) {
    exitReplay();
    return;
  }
  stopAI();
  clearTimeout(hintTimer);
  app.ai.cancel();
  app.replayIdx = i;
  app.view.renderExps(app.history[i].exps);
  $('replayBanner').hidden = false;
  $('replayIdx').textContent = formatNumber(i + 1);
  $('overlay').hidden = true;
  scheduleRender('decision', 'selection');
}

function exitReplay() {
  if (app.replayIdx === null) return;
  app.replayIdx = null;
  app.view.render(app.game, false);
  $('replayBanner').hidden = true;
  if (app.game.over) showOverlay();
  scheduleRender('decision', 'selection');
  maybeHint();
}

// ---------------------------------------------------------------------------
// Çizim zamanlayıcısı
// ---------------------------------------------------------------------------

const dirty = new Set();
let rafPending = false;
let chartTimer = null;
let lastChartDraw = 0;
let historyTimer = null;
let lastHistoryDraw = 0;

let rafHandle = 0, rafFallback = 0;

function scheduleRender(...parts) {
  for (const p of parts) dirty.add(p);
  if (!rafPending) {
    rafPending = true;
    rafHandle = requestAnimationFrame(flushRender);
    // Sekme arka plandayken rAF çalışmaz; arayüz yine de güncel kalsın.
    rafFallback = setTimeout(flushRender, 150);
  }
}

function flushRender() {
  if (!rafPending) return;
  rafPending = false;
  cancelAnimationFrame(rafHandle);
  clearTimeout(rafFallback);
  const d = new Set(dirty);
  dirty.clear();
  if (d.has('board') && app.replayIdx === null) app.view.render(app.game, false);
  if (d.has('scores')) renderScores();
  if (d.has('decision')) renderDecision();
  if (d.has('history')) {
    const wait = app.turboActive ? 250 - (performance.now() - lastHistoryDraw) : 0;
    if (wait <= 0) { renderHistory(); renderSelection(); }
    else if (!historyTimer) historyTimer = setTimeout(() => { historyTimer = null; renderHistory(); renderSelection(); }, wait);
  } else if (d.has('selection')) {
    renderSelection();
  }
  if (d.has('milestones')) renderMilestones();
  if (d.has('stats')) renderStats();
  if (d.has('chart')) {
    const wait = 250 - (performance.now() - lastChartDraw);
    if (wait <= 0) drawGameChart();
    else if (!chartTimer) chartTimer = setTimeout(() => { chartTimer = null; drawGameChart(); }, wait);
  }
}

function renderScores() {
  const g = app.game;
  $('score').textContent = formatNumber(g.score);
  $('best').textContent = formatNumber(Math.max(app.stats.best || 0, g.score));
  $('moves').textContent = formatNumber(g.moves);
  $('maxTile').textContent = formatNumber(tileValue(g.maxExp));
  $('maxTileSwatch').className = `swatch ${tileClass(g.maxExp)}`;
}

function flashDelta(gained) {
  if (reducedMotion.matches) return;
  const el = $('scoreDelta');
  el.textContent = '+' + formatNumber(gained);
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function showToast(exp) {
  const el = document.createElement('div');
  el.className = `toast ${tileClass(exp)}`;
  el.innerHTML = `<i aria-hidden="true"></i>${formatNumber(tileValue(exp))} taşına ulaşıldı`;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

function setThinking(on) {
  $('decisionCard').classList.toggle('thinking', on);
  renderStatePill();
}

const PLAY_BUTTONS = ['btnPlay', 'btnPlayBar', 'btnPlayMini'];
function updatePlayButton() {
  for (const id of PLAY_BUTTONS) {
    const btn = $(id);
    btn.classList.toggle('is-running', app.running);
    btn.querySelector('span').textContent = app.running ? "AI'ı durdur" : "AI'ı başlat";
    btn.querySelector('use').setAttribute('href', app.running ? '#i-pause' : '#i-play');
  }
  renderStatePill();
}

/** Karar panelindeki durum hapı: metin + ton (renk tek başına anlam taşımaz). */
function renderStatePill() {
  const pill = $('decState');
  let tone = 'idle', text = 'Beklemede';
  if (!app.aiReady) { tone = 'idle'; text = 'Hazırlanıyor'; }
  else if (app.replayIdx !== null) { tone = 'replay'; text = 'Geçmiş'; }
  else if (app.game.over) { tone = 'over'; text = 'Oyun bitti'; }
  else if (app.turboActive) { tone = 'turbo'; text = 'Turbo'; }
  else if (app.running) { tone = 'live'; text = 'Oynuyor'; }
  else if ($('decisionCard').classList.contains('thinking')) { tone = 'think'; text = 'Düşünüyor'; }
  if (pill.dataset.tone !== tone) pill.dataset.tone = tone;
  if (pill.textContent !== text) pill.textContent = text;
}

// ---------------------------------------------------------------------------
// Karar analizi paneli
// ---------------------------------------------------------------------------

function buildDirCards() {
  const list = $('dirList');
  for (let d = 0; d < 4; d++) {
    const row = document.createElement('li');
    row.className = 'dir-row';
    row.innerHTML = `
      <div class="mini-board" aria-hidden="true"></div>
      <div class="dir-main">
        <div class="dir-top">
          <span class="dir-arrow" aria-hidden="true">${DIR_ARROWS[d]}</span>
          <span class="dir-name">${DIR_LABELS[d]}</span>
          <span class="dir-tag tag-best">En iyi</span>
          <span class="dir-tag tag-played">Oynandı</span>
          <span class="dir-reward num"></span>
        </div>
        <div class="bar" aria-hidden="true"><i></i></div>
      </div>
      <div class="dir-q">—<small>&nbsp;</small></div>`;
    list.appendChild(row);
  }
}

function riskOf(e) {
  if (e.risk) return e.risk;
  if (!e.riskGrid) return null;
  const cells = [], values = [];
  for (let k = 0; k < 16; k++) {
    const v = e.riskGrid[k];
    if (v === v) { cells.push(k); values.push(v); }
  }
  return cells.length ? { cells, values, q: e.bestQ } : null;
}

function currentDecisionSource() {
  if (app.replayIdx !== null) {
    const e = app.history[app.replayIdx];
    return { kind: 'replay', index: app.replayIdx, exps: e.exps, qs: e.qs, best: e.best, played: e.dir, by: e.by,
      bestQ: e.bestQ, depth: e.depth, timeMs: e.timeMs, evals: e.evals, ttHits: e.ttHits, mode: e.mode,
      workers: e.workers, score: e.score - e.gained, risk: riskOf(e), riskDir: e.dir };
  }
  const a = app.analysis;
  if (a && a.gameId === app.gameId && a.moveNo === app.game.moves) {
    const bd = a.dirs[a.best];
    return { kind: 'live', exps: a.exps, qs: a.dirs.map((d) => d.q), best: a.best, played: null, bestQ: a.bestQ,
      depth: a.depth, timeMs: a.timeMs, evals: a.evals, ttHits: a.ttHits, mode: a.mode, workers: a.workers, score: a.score,
      risk: bd && bd.cellValues ? { cells: bd.cells, values: bd.cellValues, q: bd.q } : null, riskDir: a.best };
  }
  if (app.history.length) {
    const i = app.history.length - 1;
    const e = app.history[i];
    return { kind: 'last', index: i, exps: e.exps, qs: e.qs, best: e.best, played: e.dir, by: e.by, bestQ: e.bestQ,
      depth: e.depth, timeMs: e.timeMs, evals: e.evals, ttHits: e.ttHits, mode: e.mode, workers: e.workers,
      score: e.score - e.gained, risk: riskOf(e), riskDir: e.dir };
  }
  return { kind: 'none', exps: app.game.exps(), qs: null, best: null, played: null, score: app.game.score };
}

function renderDecision() {
  const src = currentDecisionSource();
  const isModel = (src.mode || app.ai.mode) === 'ntuple';
  const model = app.ai.model;
  let stageTxt = '';
  if (isModel && model && model.stages > 1) {
    const maxExp = Math.max(...src.exps);
    const st = maxExp < model.stageExp ? 0 : Math.min(model.stages - 1, maxExp - model.stageExp + 1);
    stageTxt = ` · ${st + 1}. aşama`;
  }
  $('decMode').textContent = isModel ? `N-Tuple model${stageTxt}` : 'Heuristik';
  $('decMode').className = isModel ? 'badge' : 'badge blue';
  $('decMode').title = stageTxt
    ? `Bu konum ${model.stages} aşamalı modelin ${stageTxt.match(/\d+/)[0]}. ağırlık setiyle değerlendiriliyor (aşama eşiği ${formatNumber(Math.pow(2, model.stageExp))}).`
    : '';

  const [hi, lo] = expsToBoard(src.exps);
  const cards = $('dirList').children;
  const isQ = (q) => q !== null && q !== undefined && !Number.isNaN(q);
  const validQ = src.qs ? Array.from(src.qs).filter(isQ) : [];
  renderStatePill();
  const qMax = validQ.length ? Math.max(...validQ) : 0;
  const qMin = validQ.length ? Math.min(...validQ) : 0;

  for (let d = 0; d < 4; d++) {
    const card = cards[d];
    const r = moveBoard(hi, lo, d);
    const valid = r >= 0;
    const after = valid ? boardToExps(MOVE_OUT[0], MOVE_OUT[1]) : src.exps;
    const q = src.qs ? src.qs[d] : null;
    const hasQ = isQ(q);
    card.classList.toggle('invalid', !valid);
    card.classList.toggle('best', hasQ && d === src.best);
    card.classList.toggle('played', src.played !== null && src.played !== src.best && d === src.played);
    card.querySelector('.dir-reward').textContent = valid && r > 0 ? '+' + formatNumber(r) : '';
    renderMiniBoard(card.querySelector('.mini-board'), after);
    const pct = hasQ ? (qMax > qMin ? 12 + 88 * (q - qMin) / (qMax - qMin) : 100) : 0;
    card.querySelector('.bar i').style.transform = `scaleX(${pct / 100})`;
    const qEl = card.querySelector('.dir-q');
    if (!valid) {
      qEl.innerHTML = 'Geçersiz<small>tahta değişmez</small>';
    } else if (!hasQ) {
      qEl.innerHTML = '—<small>&nbsp;</small>';
    } else {
      const main = isModel ? formatNumber(q) : formatCompact(q);
      const sub = d === src.best ? (isModel ? 'beklenen ek puan' : 'heuristik değer')
        : (isModel ? `en iyiden −${formatNumber(qMax - q)}` : `en iyiden −${formatCompact(qMax - q)}`);
      qEl.innerHTML = `${main}<small>${sub}</small>`;
    }
  }

  const title = $('decTitle'), sub = $('decSub'), arrow = $('bigArrow');
  if (src.best !== null && src.best !== undefined) {
    arrow.textContent = DIR_ARROWS[src.best];
    const depthText = `${src.depth} derinlik · ${formatNumber(src.evals)} konum · ${formatMs(src.timeMs)}`;
    if (src.kind === 'live') {
      title.textContent = `Önerilen hamle: ${DIR_LABELS[src.best]}`;
      sub.textContent = depthText;
    } else {
      const who = src.by === 'human' ? 'Sen' : 'AI';
      title.textContent = `Hamle #${formatNumber(src.index + 1)} · ${who}: ${DIR_LABELS[src.played]}`;
      sub.textContent = src.played === src.best ? `AI'ın en iyi bulduğu hamle · ${depthText}`
        : `AI'ın önerisi ${DIR_LABELS[src.best]} idi · ${depthText}`;
    }
  } else if (src.kind === 'replay' || src.kind === 'last') {
    arrow.textContent = DIR_ARROWS[src.played];
    title.textContent = `Hamle #${formatNumber(src.index + 1)} · ${src.by === 'human' ? 'Sen' : 'AI'}: ${DIR_LABELS[src.played]}`;
    sub.textContent = 'Bu hamle için AI analizi yapılmamıştı.';
  } else {
    arrow.textContent = '·';
    if (!app.aiReady) {
      title.textContent = 'AI hazırlanıyor';
      sub.textContent = 'Birkaç saniye sürer.';
    } else if (app.game.over) {
      title.textContent = 'Oyun bitti';
      sub.textContent = 'Yeni oyun başlatabilir ya da geçmişte gezinebilirsin.';
    } else {
      title.textContent = app.settings.hint ? 'Düşünüyor…' : 'AI beklemede';
      sub.textContent = app.settings.hint ? 'Mevcut konum analiz ediliyor.' : "Başlatmak için “AI'ı başlat”a bas veya ok tuşlarıyla oyna.";
    }
  }
  if (app.game.over && src.kind === 'last') {
    title.textContent = 'Oyun bitti';
    sub.textContent = `Son hamle #${formatNumber(src.index + 1)}: ${DIR_LABELS[src.played]}`;
  }

  const predOk = isModel && src.bestQ !== null && src.bestQ !== undefined;
  $('predFinal').textContent = predOk ? formatNumber(src.score + src.bestQ) : '—';
  $('predBox').title = predOk ? `Mevcut skor ${formatNumber(src.score)} + beklenen ek puan ${formatNumber(src.bestQ)}` : 'Tahmin yalnızca N-Tuple modeliyle yapılır';

  renderRisk(src, isModel);

  const has = src.depth !== null && src.depth !== undefined;
  $('mDepth').textContent = has ? `${src.depth} · ${src.depth + 1} hamle` : '—';
  $('mDepth').title = has ? `${src.depth + 1} hamle ileri bakıldı` : '';
  $('mEvals').textContent = has ? formatNumber(src.evals) : '—';
  $('mTime').textContent = has ? formatMs(src.timeMs) : '—';
  $('mRate').textContent = has && src.timeMs > 0.05 ? formatCompact(src.evals / (src.timeMs / 1000)) : '—';
  $('mHits').textContent = has && src.ttHits !== null && src.ttHits !== undefined ? formatNumber(src.ttHits) : '—';
}

/**
 * Rastgele taş risk haritası: hamleden sonra oyunun koyacağı taş hangi hücreye düşerse
 * beklenen skorun nasıl değiştiğini gösterir. Değerler zaten aramada hesaplanmıştır.
 */
function renderRisk(src, isModel) {
  const box = $('riskBox');
  const risk = src.risk;
  if (!risk || !risk.values || !risk.values.length || src.riskDir === null || src.riskDir === undefined) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const [hi, lo] = expsToBoard(src.exps);
  const r = moveBoard(hi, lo, src.riskDir);
  const after = r >= 0 ? boardToExps(MOVE_OUT[0], MOVE_OUT[1]) : src.exps;
  const base = risk.q;
  const byCell = new Map();
  let worst = null, best = null;
  for (let i = 0; i < risk.cells.length; i++) {
    const d = risk.values[i] - base;
    byCell.set(risk.cells[i], d);
    if (worst === null || d < worst) worst = d;
    if (best === null || d > best) best = d;
  }
  const span = Math.max(Math.abs(worst), Math.abs(best), 1e-6);

  const board = $('riskBoard');
  if (!board._cells) {
    board._cells = [];
    for (let i = 0; i < 16; i++) {
      const c = document.createElement('div');
      board.appendChild(c);
      board._cells.push(c);
    }
  }
  const fmt = (v) => formatCompact(Math.abs(v));
  for (let k = 0; k < 16; k++) {
    const cell = board._cells[k];
    if (after[k]) {
      cell.className = `risk-cell filled ${tileClass(after[k])}`;
      cell.textContent = after[k] >= 10 ? Math.pow(2, after[k]) / 1024 + 'k' : tileText(after[k]);
      cell.style.background = '';
      cell.title = '';
      continue;
    }
    const d = byCell.get(k);
    cell.className = 'risk-cell';
    if (d === undefined) {
      cell.textContent = '';
      cell.style.background = '';
      cell.title = '';
      continue;
    }
    const t = d / span;
    const alpha = 0.12 + 0.55 * Math.abs(t);
    cell.style.background = t >= 0 ? `rgba(74, 222, 128, ${alpha})` : `rgba(248, 113, 113, ${alpha})`;
    cell.textContent = (d >= 0 ? '+' : '−') + fmt(d);
    cell.title = `Buraya taş gelirse beklenen değer: ${formatNumber(risk.values[risk.cells.indexOf(k)])} (fark ${d >= 0 ? '+' : ''}${formatNumber(d)})`;
  }
  $('riskText').innerHTML = `<b>${DIR_LABELS[src.riskDir]}</b> hamlesinden sonra oyun boş hücrelerden birine taş koyar ` +
    `(%90 “2”, %10 “4”). Renkler, taşın oraya gelmesi hâlinde beklentinin ne kadar değiştiğini gösterir. ` +
    `En kötü ihtimal <b style="color:var(--red)">${(worst >= 0 ? '+' : '−') + fmt(worst)}</b>, ` +
    `en iyisi <b style="color:var(--green)">${(best >= 0 ? '+' : '−') + fmt(best)}</b>` +
    `${isModel ? ' puan' : ''}. Ortalamaları hamlenin değerini verir.`;
}

/** Türkçe yüzde biçimi: 0.604 → "%60,4". */
function formatPct(v) {
  return `%${((v || 0) * 100).toLocaleString('tr-TR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
}

function formatMs(ms) {
  const digits = ms < 1 ? 2 : ms < 10 ? 1 : 0;
  return `${ms.toLocaleString('tr-TR', { minimumFractionDigits: digits, maximumFractionDigits: digits })} ms`;
}

/** Oyun hızı (hamle/sn): son ~2 saniyedeki hamle sayısından. */
const speedSamples = [];
function updateSpeed() {
  const now = performance.now();
  speedSamples.push([now, app.movesPlayed]);
  while (speedSamples.length > 2 && now - speedSamples[0][0] > 2000) speedSamples.shift();
  const [t0, m0] = speedSamples[0];
  const rate = now - t0 > 300 ? ((app.movesPlayed - m0) * 1000) / (now - t0) : 0;
  $('mSpeed').textContent = app.running || rate > 0.5 ? `${formatNumber(rate)} hamle/sn` : '—';
}

// ---------------------------------------------------------------------------
// Hamle geçmişi
// ---------------------------------------------------------------------------

function renderHistory() {
  lastHistoryDraw = performance.now();
  const body = $('histBody');
  const h = app.history;
  $('histCount').textContent = formatNumber(h.length);
  $('histEmpty').hidden = h.length > 0;
  $('histWrap').hidden = h.length === 0;
  $('rngHist').max = String(h.length);
  if ($('pane-history').hidden) return; // gizli sekmede satır üretme
  const n = app.rowEls.length;
  if (h.length < n) {
    body.replaceChildren();
    app.rowEls = [];
  }
  const frag = document.createDocumentFragment();
  const firstNew = Math.max(app.rowEls.length, h.length - (app.turboActive ? 60 : MAX_HISTORY_ROWS));
  for (let i = h.length - 1; i >= firstNew; i--) {
    const e = h[i];
    const tr = document.createElement('tr');
    tr.dataset.i = i;
    if (e.milestone) tr.className = 'ms-row';
    tr.innerHTML =
      `<td>${formatNumber(i + 1)}</td>` +
      `<td>${DIR_ARROWS[e.dir]} ${DIR_LABELS[e.dir]}${e.by === 'human' ? '<span class="human">sen</span>' : ''}</td>` +
      `<td class="r num"><span class="gain">${e.gained ? '+' + formatNumber(e.gained) : ''}</span>` +
        `${e.milestone ? ` <span class="ms-tag ${tileClass(e.milestone)}">${formatNumber(tileValue(e.milestone))}</span>` : ''}</td>` +
      `<td class="r num">${formatNumber(e.score)}</td>` +
      `<td class="r num">${e.depth ?? '—'}</td>` +
      `<td class="r num">${e.timeMs !== null ? formatMs(e.timeMs) : '—'}</td>` +
      `<td class="r num">${e.margin !== null ? formatCompact(e.margin) : '—'}</td>`;
    frag.appendChild(tr);
  }
  for (let i = app.rowEls.length; i < h.length; i++) app.rowEls[i] = null;
  // yeni satırlar en üste
  const newRows = Array.from(frag.children);
  body.prepend(frag);
  for (const tr of newRows) app.rowEls[Number(tr.dataset.i)] = tr;
  while (body.children.length > MAX_HISTORY_ROWS) {
    const last = body.lastElementChild;
    app.rowEls[Number(last.dataset.i)] = null;
    last.remove();
  }
  const rng = $('rngHist');
  rng.max = String(h.length);
}

let selectedRow = null;
function renderSelection() {
  const rng = $('rngHist');
  rng.value = String(app.replayIdx ?? app.history.length);
  if (selectedRow) selectedRow.classList.remove('is-selected');
  selectedRow = null;
  if (app.replayIdx !== null) {
    const tr = app.rowEls[app.replayIdx];
    if (tr) {
      tr.classList.add('is-selected');
      tr.scrollIntoView({ block: 'nearest' });
      selectedRow = tr;
    }
  }
}

function renderMilestones() {
  const box = $('milestones');
  box.replaceChildren(...app.milestones.map((m) => {
    const el = document.createElement('li');
    el.className = `chip ${tileClass(m.exp)}`;
    const secs = Math.round(m.ms / 1000);
    const time = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
    el.innerHTML = `<span class="swatch" aria-hidden="true"></span><b>${formatNumber(tileValue(m.exp))}</b> hamle ${formatNumber(m.move)} · ${time}`;
    return el;
  }));
}

// ---------------------------------------------------------------------------
// Grafik
// ---------------------------------------------------------------------------

function drawGameChart() {
  lastChartDraw = performance.now();
  if ($('pane-chart').hidden || currentView !== 'canli') return; // gizliyken çizme
  const all = app.history;
  const chart = app.gameChart;
  // En fazla ~1500 nokta: grafik zaten piksel başına 2 noktadan fazlasını çizemez.
  const stride = Math.max(1, Math.ceil(all.length / 1500));
  const idx = [];
  for (let i = 0; i < all.length; i += stride) idx.push(i);
  if (all.length && idx[idx.length - 1] !== all.length - 1) idx.push(all.length - 1);
  const h = { map: (fn) => idx.map((i) => fn(all[i], i)) };
  let series;
  switch (app.chartMode) {
    case 'value':
      chart.opts.yFormat = formatCompact;
      series = [{ name: 'Beklenen ek puan', color: '#5FCDE4', fill: true,
        data: h.map((e, i) => [i + 1, e.mode === 'ntuple' && e.bestQ !== null ? e.bestQ : NaN]) }];
      chart.opts.emptyText = 'Beklenti yalnızca N-Tuple modeliyle hesaplanır';
      break;
    case 'think':
      chart.opts.yFormat = (v) => `${Math.round(v)} ms`;
      series = [{ name: 'Düşünme süresi', color: '#DF7126', fill: true, format: (v) => `${Math.round(v)} ms`,
        data: h.map((e, i) => [i + 1, e.timeMs !== null ? e.timeMs : NaN]) }];
      chart.opts.emptyText = 'Henüz AI hamlesi yok';
      break;
    case 'depth':
      chart.opts.yFormat = (v) => String(Math.round(v));
      series = [{ name: 'Arama derinliği', color: '#D77BBA', format: (v) => String(v),
        data: h.map((e, i) => [i + 1, e.depth !== null ? e.depth : NaN]) }];
      chart.opts.emptyText = 'Henüz AI hamlesi yok';
      break;
    default:
      chart.opts.yFormat = formatCompact;
      series = [
        { name: 'Skor', color: '#FBF236', fill: true, format: formatNumber, data: h.map((e, i) => [i + 1, e.score]) },
        { name: 'Tahmini final', color: '#5FCDE4', dashed: true, format: formatNumber,
          data: h.map((e, i) => [i + 1, e.mode === 'ntuple' && e.bestQ !== null ? e.score - e.gained + e.bestQ : NaN]) },
      ];
      chart.opts.emptyText = 'Oyun başladığında skor burada çizilir';
  }
  const markers = app.milestones.map((m) => ({ x: m.move, label: formatCompact(tileValue(m.exp)), color: TILE_COLORS[m.exp] || '#FBF236' }));
  chart.setData(series, markers);
  renderGameLegend(series);
  renderChartSummary(series, all.length);
}

function renderGameLegend(series) {
  const key = series.map((s) => s.name + s.dashed).join('|');
  const box = $('gameLegend');
  if (box.dataset.key === key) return;
  box.dataset.key = key;
  box.innerHTML = series.map((s) =>
    `<li><i class="lg-line${s.dashed ? ' dashed' : ''}" style="--c:${s.color}" aria-hidden="true"></i>${s.name}${s.dashed ? ' (kesik çizgi)' : ''}</li>`).join('');
}

function renderChartSummary(series, n) {
  const el = $('chartSummary');
  if (!n) { el.textContent = 'Oyun başladığında grafik burada çizilir.'; return; }
  const parts = [];
  for (const s of series) {
    for (let i = s.data.length - 1; i >= 0; i--) {
      const y = s.data[i][1];
      if (Number.isFinite(y)) { parts.push(`${s.name}: ${(s.format || formatCompact)(y)}`); break; }
    }
  }
  const ms = app.milestones.length ? ` · ulaşılan: ${app.milestones.map((m) => formatNumber(tileValue(m.exp))).join(', ')}` : '';
  el.textContent = `${formatNumber(n)} hamle · son değerler: ${parts.join(', ') || 'yok'}${ms}`;
}

// ---------------------------------------------------------------------------
// İstatistikler
// ---------------------------------------------------------------------------

function renderStats() {
  const games = app.stats.games;
  const n = games.length;
  $('sGames').textContent = formatNumber(n);
  $('sAvg').textContent = n ? formatNumber(games.reduce((acc, g) => acc + g.score, 0) / n) : '—';
  $('sBest').textContent = n ? formatNumber(Math.max(...games.map((g) => g.score))) : '—';
  $('sMoves').textContent = n ? formatNumber(games.reduce((acc, g) => acc + g.moves, 0) / n) : '—';
  $('statsEmpty').hidden = n > 0;
  $('statsBody').hidden = n === 0;
  if (!n) return;

  $('reachBars').replaceChildren(...[11, 12, 13, 14, 15, 16].map((exp) => {
    const cnt = games.filter((g) => g.maxExp >= exp).length;
    const pct = (cnt / n) * 100;
    const row = document.createElement('li');
    row.className = `reach-row ${tileClass(exp)}`;
    row.innerHTML = `<span class="tile-label"><span class="swatch" aria-hidden="true"></span>${formatNumber(tileValue(exp))}</span>` +
      `<span class="track" aria-hidden="true"><i style="transform:scaleX(${pct / 100})"></i></span>` +
      `<span class="pct">%${pct.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} <small>(${cnt})</small></span>`;
    return row;
  }));

  $('recentGames').replaceChildren(...games.slice(-8).reverse().map((g) => {
    const row = document.createElement('li');
    row.className = `recent-row ${tileClass(g.maxExp)}`;
    const t = tileValue(g.maxExp);
    const how = `${g.mode === 'ntuple' ? 'model' : 'heuristik'} · ${g.turbo ? 'turbo · ' : ''}${g.think ? g.think + ' ms' : 'derinlik ' + (g.depth ?? '?')}`;
    row.innerHTML = `<span class="rswatch" title="En büyük taş ${formatNumber(t)}">${t >= 1024 ? t / 1024 + 'k' : t}</span>` +
      `<span><b class="num">${formatNumber(g.score)}</b> <span class="meta">· ${formatNumber(g.moves)} hamle · ${how}</span></span>` +
      `<span class="when">${relativeTime(g.date)}</span>`;
    return row;
  }));
}

function relativeTime(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'az önce';
  if (s < 3600) return `${Math.floor(s / 60)} dk önce`;
  if (s < 86400) return `${Math.floor(s / 3600)} sa önce`;
  return new Date(ts).toLocaleDateString('tr-TR');
}

// ---------------------------------------------------------------------------
// Model ve eğitim sekmesi
// ---------------------------------------------------------------------------

let trainScoreChart = null, trainReachChart = null, trainTimer = null;
const REACH_SERIES = [
  { key: '2048', color: '#FBF236' },
  { key: '4096', color: '#DF7126' },
  { key: '8192', color: '#D77BBA' },
  { key: '16384', color: '#5FCDE4' },
  { key: '32768', color: '#99E550' },
];

function formatDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h} sa ${m} dk` : `${m} dk ${Math.floor(sec % 60)} sn`;
}

function renderModelInfo() {
  const m = app.ai.model;
  const kpis = $('modelKpis');
  if (!m) {
    $('modelBadge').textContent = modelJob ? 'İniyor…' : 'Yüklenmedi';
    const state = modelJob ? 'Model iniyor…' : (app.ai.modelError ? `İnemedi: ${app.ai.modelError}` : 'Yüklenmedi · AI heuristikle oynuyor');
    kpis.innerHTML = `<div class="kpi kpi-wide"><dt class="kpi-label">Durum</dt><dd class="kpi-value"></dd></div>`;
    kpis.querySelector('dd').textContent = state;
    $('patterns').replaceChildren();
    return;
  }
  $('modelBadge').textContent = `${m.nPat}×${m.tupleLen}-tuple${m.stages > 1 ? ` · ${m.stages} aşama` : ''}`;
  const kpi = (label, value, wide) =>
    `<div class="kpi${wide ? ' kpi-wide' : ''}"><dt class="kpi-label">${label}</dt><dd class="kpi-value num">${value}</dd></div>`;
  kpis.innerHTML =
    kpi('Ağırlık', formatCompact(m.weightsCount)) +
    kpi('Bellekte · 16 bit', `${Math.round(m.bytes / 1048576)} MB`) +
    kpi('Eğitim oyunu', formatCompact(m.games)) +
    kpi('Eğitim süresi', formatDuration(m.seconds)) +
    (m.stages > 1 ? kpi('Aşamalar', `${m.stages} ağırlık seti · eşik ${formatNumber(Math.pow(2, m.stageExp))}`, true) : '');
  $('patterns').replaceChildren(...m.patterns.map((p, i) => {
    const el = document.createElement('li');
    el.className = 'pattern';
    const cells = Array.from({ length: 16 }, (_, k) => `<div class="${p.includes(k) ? 'on' : ''}"></div>`).join('');
    el.innerHTML = `<div class="pgrid" role="img" aria-label="Desen ${i + 1}: hücreler ${p.map((k) => k + 1).join(', ')}">${cells}</div>Desen ${i + 1}`;
    return el;
  }));
}

async function loadTrainingData() {
  renderModelInfo();
  let entries = [];
  try {
    const resp = await fetch('model/training-log.jsonl', { cache: 'no-cache' });
    if (resp.ok) {
      entries = (await resp.text()).split('\n').filter((l) => l.trim()).map((l) => {
        try { return JSON.parse(l); } catch (_) { return null; }
      }).filter(Boolean);
    }
  } catch (_) { /* günlük yok */ }

  if (!trainScoreChart) {
    trainScoreChart = new LineChart($('chartTrainScore'), { height: 240, xLabel: 'Oyun', yMinFixed: 0, emptyText: 'Eğitim günlüğü bulunamadı' });
    trainReachChart = new LineChart($('chartTrainReach'), { height: 240, xLabel: 'Oyun', yMinFixed: 0, yMaxFixed: 100,
      yFormat: (v) => `%${Math.round(v)}`, emptyText: 'Eğitim günlüğü bulunamadı' });
    $('reachLegend').innerHTML = REACH_SERIES.map((rs) => `<li><i class="lg-line" style="--c:${rs.color}" aria-hidden="true"></i>${formatNumber(Number(rs.key))}</li>`).join('');
  }
  const markers = [];
  entries.forEach((e, i) => {
    if (i > 0 && e.phase !== entries[i - 1].phase) markers.push({ x: e.games, label: e.phase, color: '#9BADB7' });
  });
  trainScoreChart.setData([
    { name: 'Ortalama skor', color: '#FBF236', fill: true, format: formatNumber, data: entries.map((e) => [e.games, e.avgScore]) },
  ], markers);
  trainReachChart.setData(REACH_SERIES.map((s) => ({
    name: s.key, color: s.color, format: (v) => formatPct(v / 100),
    data: entries.map((e) => [e.games, (e.reach[s.key] || 0) * 100]),
  })), markers);

  const last = entries[entries.length - 1];
  $('trainLive').hidden = !(last && Date.now() / 1000 - last.time < 180);
  $('logInfo').textContent = last ? `${formatNumber(entries.length)} kayıt · son: ${new Date(last.time * 1000).toLocaleTimeString('tr-TR')}` : '';
  const pct = formatPct;
  $('logBody').innerHTML = entries.slice().reverse().map((e) =>
    `<tr><td>${e.phase}</td><td class="r">${formatNumber(e.games)}</td><td class="r">${formatDuration(e.totalSec)}</td><td class="r">${formatNumber(e.avgScore)}</td>` +
    `<td class="r">${formatNumber(e.maxScore)}</td><td class="r">${pct(e.reach['2048'])}</td><td class="r">${pct(e.reach['8192'])}</td><td class="r">${pct(e.reach['16384'])}</td>` +
    `<td class="r">${pct(e.reach['32768'])}</td><td class="r">${formatCompact(e.movesPerSec)}</td></tr>`).join('');

  let bench = null;
  try {
    const resp = await fetch('model/benchmarks.json', { cache: 'no-cache' });
    if (resp.ok) bench = await resp.json();
  } catch (_) { /* kıyaslama yok */ }
  const box = $('benchBox');
  if (!bench || !bench.results || !bench.results.length) {
    box.innerHTML = '<p class="empty-state">Henüz kıyaslama sonucu yok. Rust kıyaslama aracıyla ölçülür.</p>';
  } else {
    box.innerHTML = `<div class="table-wrap"><table class="data-table"><caption class="sr-only">Arama derinliğine göre kıyaslama</caption>` +
      `<thead><tr><th scope="col">Arama</th><th scope="col" class="r">Oyun</th><th scope="col" class="r">Ort. skor</th><th scope="col" class="r">8192</th><th scope="col" class="r">16384</th><th scope="col" class="r">32768</th></tr></thead><tbody>` +
      bench.results.map((r) => `<tr><td>${r.label}</td><td class="r">${formatNumber(r.games)}</td><td class="r">${formatNumber(r.avgScore)}</td>` +
        `<td class="r">${pct(r.reach['8192'])}</td><td class="r">${pct(r.reach['16384'])}</td><td class="r">${pct(r.reach['32768'])}</td></tr>`).join('') +
      `</tbody></table></div>${bench.note ? `<p class="note-text">${bench.note}</p>` : ''}`;
  }
}

// ---------------------------------------------------------------------------
// Arayüz bağlantıları
// ---------------------------------------------------------------------------

/** Radyo grubunda değeri seçili yapar. */
function setChoice(id, value) {
  for (const input of $(id).querySelectorAll('input[type="radio"]')) input.checked = input.value === value;
}

const PRESETS = {
  watch: { timeIdx: 3, maxDepth: 4, speedIdx: 0 },
  balanced: { timeIdx: 4, maxDepth: 5, speedIdx: 1 },
  strong: { timeIdx: 9, maxDepth: 9, speedIdx: 3 },
  turbo: { timeIdx: 0, maxDepth: 2, speedIdx: 5 },
};

const SPEED_HINTS = {
  4: 'Her hamle ayrı ayrı analiz edilir ve çizilir; risk haritası dahil her şey hamle hamle görünür.',
  5: 'Turbo: AI işçilerin içinde kendi kendine oynar, ekran kare başına bir kez güncellenir. Hızı derinlik belirler (süre “Sabit” iken): 0 → ~146 bin, 1 → ~25 bin, 2 → ~1.700 hamle/sn.',
};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

function applySettingsToUI() {
  const s = app.settings;
  const preset = Object.keys(PRESETS).find((k) =>
    Object.entries(PRESETS[k]).every(([key, v]) => s[key] === v));
  setChoice('segPreset', preset || '');
  $('presetCustom').hidden = !!preset;
  setChoice('segMode', s.mode);
  setChoice('segChart', app.chartMode);

  const timeText = formatThink(THINK_TIMES[s.timeIdx]);
  $('rngTime').value = s.timeIdx;
  $('outTime').textContent = THINK_TIMES[s.timeIdx] === 0 ? 'Sabit' : timeText;
  $('rngTime').setAttribute('aria-valuetext', timeText);

  $('rngDepth').value = s.maxDepth;
  $('outDepth').textContent = s.maxDepth === 0 ? '0 · yalnız model' : `${s.maxDepth} · ${s.maxDepth + 1} hamle`;
  $('rngDepth').setAttribute('aria-valuetext', s.maxDepth === 0 ? 'derinlik 0, yalnızca model' : `derinlik ${s.maxDepth}, ${s.maxDepth + 1} hamle ileri`);

  const speed = SPEEDS[s.speedIdx];
  $('rngSpeed').value = s.speedIdx;
  $('outSpeed').textContent = speed.name;
  $('rngSpeed').setAttribute('aria-valuetext', speed.name);
  $('speedHint').textContent = SPEED_HINTS[s.speedIdx] || '';
  $('speedHint').hidden = !SPEED_HINTS[s.speedIdx];

  $('chkAuto').checked = s.autoRestart;
  $('chkHint').checked = s.hint;
  app.view.setAnimation(reducedMotion.matches ? 0 : speed.anim);
}

function formatThink(ms) {
  if (ms === 0) return 'Sabit (süre sınırı yok)';
  return ms >= 1000 ? `${(ms / 1000).toLocaleString('tr-TR')} sn` : `${ms} ms`;
}

function settingsChanged() {
  saveStore();
  applySettingsToUI();
  // Turbo yeni ayarlarla (veya normal modda) yeniden başlasın.
  if (app.turboActive) app.ai.stopTurbo();
}

// ---------------------------------------------------------------------------
// Duyurular ve erişilebilir açıklamalar
// ---------------------------------------------------------------------------

function announce(text) {
  const el = $('announcer');
  el.textContent = '';
  setTimeout(() => { el.textContent = text; }, 30);
}

function updateBoardDesc() {
  const g = app.game;
  const empty = g.grid.filter((t) => !t).length;
  $('boardDesc').textContent = `Skor ${formatNumber(g.score)}, en büyük taş ${formatNumber(tileValue(g.maxExp))}, ` +
    `${empty} boş hücre${g.over ? ', oyun bitti' : ''}.`;
}

// ---------------------------------------------------------------------------
// Sayfa yönlendirme (#canli, #model, #nasil)
// ---------------------------------------------------------------------------

const ROUTES = { canli: '2048 AI Laboratuvarı — STAR', model: 'Model ve eğitim · 2048 AI Laboratuvarı — STAR', nasil: 'Nasıl çalışır? · 2048 AI Laboratuvarı — STAR' };
let currentView = 'canli';

function route(opts = {}) {
  const hash = location.hash.replace('#', '');
  if (hash && !ROUTES[hash]) return; // #main gibi sayfa içi bağlantılar görünümü değiştirmez
  const name = ROUTES[hash] ? hash : 'canli';
  currentView = name;
  for (const v of document.querySelectorAll('.view')) v.hidden = v.dataset.view !== name;
  for (const a of document.querySelectorAll('.nav-link')) {
    if (a.dataset.route === name) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  document.body.dataset.view = name;
  document.title = ROUTES[name];
  clearInterval(trainTimer);
  if (name === 'model') {
    loadTrainingData();
    trainTimer = setInterval(loadTrainingData, 30000);
  }
  if (name === 'canli') scheduleRender('chart', 'history');
  if (opts.focus) {
    window.scrollTo(0, 0);
    const target = name === 'canli' ? $('board') : document.querySelector(`#view-${name} .view-title`);
    if (target) target.focus({ preventScroll: true });
  }
  updateMiniPlay();
}

// ---------------------------------------------------------------------------
// İçgörü sekmeleri (WAI-ARIA tablist)
// ---------------------------------------------------------------------------

function selectInsightTab(tab, focus) {
  for (const t of $('insightTabs').querySelectorAll('[role="tab"]')) {
    const on = t === tab;
    t.setAttribute('aria-selected', on ? 'true' : 'false');
    t.tabIndex = on ? 0 : -1;
    $(t.getAttribute('aria-controls')).hidden = !on;
  }
  if (focus) tab.focus();
  if (tab.id === 'tab-chart') drawGameChart();
  if (tab.id === 'tab-history') { renderHistory(); renderSelection(); }
  if (tab.id === 'tab-stats') renderStats();
}

// Başlıktaki küçük oynat butonu: ana kontroller ekrandan çıkınca görünür (tek birincil eylem görünür kalır).
let controlsVisible = true;
function updateMiniPlay() {
  $('btnPlayMini').hidden = !(app.aiReady && currentView === 'canli' && !controlsVisible);
}

// ---------------------------------------------------------------------------
// Arayüz bağlantıları
// ---------------------------------------------------------------------------

function bindUI() {
  document.querySelectorAll('[data-load-model]').forEach((b) => b.addEventListener('click', () => loadFullModel()));
  const togglePlay = () => (app.running ? stopAI() : startAI());
  for (const id of PLAY_BUTTONS) $(id).addEventListener('click', togglePlay);
  for (const id of ['btnStep', 'btnStepBar']) $(id).addEventListener('click', stepAI);
  for (const id of ['btnNew', 'btnNewBar']) $(id).addEventListener('click', newGame);
  $('overlayNew').addEventListener('click', () => { newGame(); $('board').focus({ preventScroll: true }); });
  $('btnLive').addEventListener('click', exitReplay);
  $('btnPrev').addEventListener('click', () => enterReplay((app.replayIdx ?? app.history.length) - 1));
  $('btnNext').addEventListener('click', () => { if (app.replayIdx !== null) enterReplay(app.replayIdx + 1); });
  $('rngHist').addEventListener('input', (e) => enterReplay(Number(e.target.value)));
  $('histBody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (tr) enterReplay(Number(tr.dataset.i));
  });
  $('btnResetStats').addEventListener('click', () => {
    if (!confirm('Oturum istatistikleri kalıcı olarak silinsin mi?')) return;
    app.stats = { games: [], best: 0 };
    saveStore();
    announce('İstatistikler sıfırlandı.');
    scheduleRender('stats', 'scores');
  });

  $('segMode').addEventListener('change', (e) => {
    app.settings.mode = e.target.value;
    app.ai.setMode(app.settings.mode);
    app.analysis = null;
    settingsChanged();
    scheduleRender('decision');
    maybeHint();
  });
  $('segPreset').addEventListener('change', (e) => {
    Object.assign(app.settings, PRESETS[e.target.value]);
    settingsChanged();
  });
  $('segChart').addEventListener('change', (e) => {
    app.chartMode = e.target.value;
    drawGameChart();
  });
  $('rngTime').addEventListener('input', (e) => { app.settings.timeIdx = Number(e.target.value); settingsChanged(); });
  $('rngDepth').addEventListener('input', (e) => { app.settings.maxDepth = Number(e.target.value); settingsChanged(); });
  $('rngSpeed').addEventListener('input', (e) => { app.settings.speedIdx = Number(e.target.value); settingsChanged(); });
  $('chkAuto').addEventListener('change', (e) => { app.settings.autoRestart = e.target.checked; settingsChanged(); });
  $('chkHint').addEventListener('change', (e) => {
    app.settings.hint = e.target.checked;
    settingsChanged();
    if (app.settings.hint) maybeHint();
    else if (!app.running) { app.ai.cancel(); app.analysis = null; setThinking(false); scheduleRender('decision'); }
  });

  // Fareyle kullanılan kontroller odağı bırakır: ok tuşları ve boşluk yeniden oyunu kontrol eder.
  // Klavyeyle gelen kullanıcıda odak korunur (pointerup yalnızca işaretçi etkileşiminde tetiklenir).
  document.addEventListener('pointerup', () => {
    const el = document.activeElement;
    if (el && el.matches('button, input[type="range"], input[type="radio"], input[type="checkbox"], summary')) {
      setTimeout(() => el.blur(), 0);
    }
  });

  // Sayfa yönlendirme ve içeriğe geç bağlantısı
  window.addEventListener('hashchange', () => route({ focus: true }));
  document.querySelector('.skip-link').addEventListener('click', (e) => {
    e.preventDefault();
    const target = currentView === 'canli' ? $('board') : document.querySelector(`#view-${currentView} .view-title`);
    (target || $('main')).focus();
  });

  // İçgörü sekmeleri: tıklama + ok tuşları, Home/End
  const tablist = $('insightTabs');
  tablist.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) selectInsightTab(tab, false);
  });
  tablist.addEventListener('keydown', (e) => {
    const tabs = [...tablist.querySelectorAll('[role="tab"]')];
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) {
      e.preventDefault();
      selectInsightTab(next, true);
    }
  });

  // Oyun klavye kısayolları
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
    if (currentView !== 'canli') return;
    const t = e.target;
    const inControl = t.closest && t.closest('input, select, textarea, summary, [role="tablist"]');
    if (inControl && e.key !== 'Escape') return; // form kontrolleri ve sekmeler kendi tuşlarını kullanır
    const onButton = t.closest && t.closest('button, a[href]');
    const dirs = { ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3 };
    if (app.replayIdx !== null && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      enterReplay(app.replayIdx + (e.key === 'ArrowRight' ? 1 : -1));
      return;
    }
    if (e.key in dirs) {
      e.preventDefault();
      humanMove(dirs[e.key]);
    } else if (e.key === ' ') {
      if (onButton) return; // odaktaki butonu etkinleştirsin
      e.preventDefault();
      togglePlay();
    } else if (e.key === 's' || e.key === 'S') {
      stepAI();
    } else if (e.key === 'n' || e.key === 'N') {
      newGame();
    } else if (e.key === 'Escape') {
      exitReplay();
    }
  });

  // Dokunmatik kaydırma
  let start = null;
  const wrap = $('boardWrap');
  wrap.addEventListener('pointerdown', (e) => { start = { x: e.clientX, y: e.clientY }; });
  wrap.addEventListener('pointerup', (e) => {
    if (!start) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    start = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 28) return;
    if (e.target.closest('button')) return;
    humanMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 1 : 3) : (dy > 0 ? 2 : 0));
  });

  reducedMotion.addEventListener('change', applySettingsToUI);
  new IntersectionObserver((entries) => {
    controlsVisible = entries[0].isIntersecting;
    updateMiniPlay();
  }, { rootMargin: '-64px 0px 0px 0px' }).observe($('gameControls'));
}

function setStatus(state, text) {
  $('status').dataset.state = state;
  $('statusText').textContent = text;
  $('status').title = text;
}

async function main() {
  loadStore();
  app.view = new BoardView($('board'));
  buildDirCards();
  app.gameChart = new LineChart($('chartGame'), { height: 200, xLabel: 'Hamle' });
  applySettingsToUI();
  bindUI();
  route();
  newGame();
  renderStats();
  updatePlayButton();
  updateBoardDesc();
  setInterval(updateSpeed, 400);

  // AI modelsiz (heuristik) hemen hazır olur; tam model sadece istenirse iner
  try {
    await app.ai.init();
  } catch (err) {
    setStatus('error', 'AI başlatılamadı');
    $('decSub').textContent = String(err.message || err);
    console.error(err);
    return;
  }
  app.aiReady = true;
  app.settings.mode = 'heuristic'; // model gelince N-Tuple'a geçer
  app.ai.setMode('heuristic');
  syncModelUI();
  applySettingsToUI();
  if (!app.ai.isolated) console.info('[2048] sayfa izole değil (SharedArrayBuffer yok): AI tek işçiyle çalışıyor.');

  for (const id of ['btnPlay', 'btnStep', 'btnPlayBar', 'btnStepBar', 'btnPlayMini']) $(id).disabled = false;
  updateMiniPlay();
  renderStatePill();
  scheduleRender('decision');
  maybeHint();
  // daha önce tam modeli yüklediyse (ve tercihlerin hatırlanmasına izin verdiyse) kendiliğinden gelsin
  if (app.settings.fullModel) loadFullModel();
}

// ---------------------------------------------------------------------------
// Tam model (16 bit, ~53 MB): "tam modeli yükle"ye basınca iner, tarayıcı önbelleğinde kalır
// ---------------------------------------------------------------------------

let modelJob = null;

function syncModelUI() {
  const m = app.ai.model;
  const ntuple = $('segMode').querySelector('input[value="ntuple"]');
  ntuple.disabled = !m;
  ntuple.closest('label').title = m ? '' : 'Önce tam modeli yükle';
  document.querySelectorAll('[data-load-model]').forEach((b) => { b.hidden = Boolean(m); b.disabled = Boolean(modelJob); });
  const workers = app.ai.workers.length;
  const cores = `${workers} işçi${app.ai.isolated ? '' : ' (tek çekirdek)'}`;
  if (m) setStatus('ready', `Tam model · ${formatCompact(m.games)} oyunla eğitildi · ${cores}`);
  else if (!modelJob) setStatus('idle', `Heuristik mod · ${cores}`);
  renderModelInfo();
}

function loadFullModel() {
  if (app.ai.model || modelJob || !app.aiReady) return modelJob;
  $('loadBar').classList.remove('done');
  modelJob = (async () => {
    await null; // aşağıdaki syncModelUI modelJob atandıktan sonra çalışsın
    try {
      const model = await app.ai.downloadModel({
        manifestUrl: MODEL_URL,
        onProgress: (f, rec, tot) => {
          $('loadBarFill').style.transform = `scaleX(${f})`;
          $('loadBar').setAttribute('aria-valuenow', String(Math.round(f * 100)));
          setStatus('loading', `Model iniyor %${Math.round(f * 100)} · ${Math.round(rec / 1048576)}/${Math.round(tot / 1048576)} MB`);
        },
      });
      // işçiler değişirken AI bir an durur, sonra kaldığı yerden devam eder
      const wasRunning = app.running;
      if (wasRunning) stopAI();
      await app.ai.useModel(model);
      app.settings.mode = 'ntuple';
      app.settings.fullModel = true;
      app.ai.setMode('ntuple');
      saveStore();
      $('loadBarFill').style.transform = 'scaleX(1)';
      $('loadBar').classList.add('done');
      announce('Tam model yüklendi. AI artık eğitilmiş ağla oynuyor.');
      modelJob = null;
      syncModelUI();
      applySettingsToUI();
      scheduleRender('decision');
      if (wasRunning) startAI();
    } catch (err) {
      console.error('[2048] model', err);
      modelJob = null;
      $('loadBar').classList.add('done');
      syncModelUI();
      setStatus('error', `Model inemedi: ${err.message || err}`);
    }
  })();
  syncModelUI();
  setStatus('loading', 'Model iniyor…');
  return modelJob;
}

main();
