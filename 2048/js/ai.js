/*
 * AI kontrolcüsü (ana iş parçacığı).
 *
 * - Sayfa modelsiz (heuristik) açılır. İstenirse 16 bitlik N-Tuple modelini (model/ntuple16.json + parçalar) indirir;
 *   sayfa izoleyse (service worker, bkz. 2048/sw.js) model SharedArrayBuffer'dadır ve tüm işçiler aynı belleği paylaşır.
 * - Her karar için iteratif derinleştirmeli Expectimax: derinlik 0, 1, 2 ... süre bütçesi bitene kadar.
 * - Kök paralelleştirme: (kök hamle x boş hücre) alt problemleri işçilere dağıtılır.
 */
'use strict';

const DIR_LABELS = ['Yukarı', 'Sağ', 'Aşağı', 'Sol'];
const DIR_ARROWS = ['↑', '→', '↓', '←'];

// Sürümlü dosya adresi: yayinla.ps1'in sayfaya yazdığı import map'ten (yoksa düz adres)
function labAsset(path) {
  try {
    const map = JSON.parse(document.querySelector('script[type="importmap"]')?.textContent || '{}');
    return map.imports?.[path] || path;
  } catch (_) { return path; }
}

// Sıkıştırılmış parçanın gövdesi: GitHub Pages .gz dosyasını olduğu gibi gönderir (açmak bize düşer); sunucu
// Content-Encoding ile göndermişse tarayıcı zaten açmıştır. İlk iki bayt gzip imzasıysa (1f 8b) biz açarız.
async function gunzipBody(body) {
  const reader = body.getReader();
  const first = await reader.read();
  const head = first.value || new Uint8Array(0);
  const rest = new ReadableStream({
    start(ctl) { if (head.byteLength) ctl.enqueue(head); if (first.done) ctl.close(); },
    async pull(ctl) { const { done, value } = await reader.read(); if (done) ctl.close(); else ctl.enqueue(value); },
    cancel(reason) { return reader.cancel(reason); },
  });
  if (head[0] !== 0x1f || head[1] !== 0x8b) return rest;
  if (typeof DecompressionStream !== 'function') throw new Error('Tarayıcın sıkıştırılmış modeli açamıyor (DecompressionStream yok). Güncel bir Chrome, Edge, Firefox ya da Safari dene.');
  return rest.pipeThrough(new DecompressionStream('gzip'));
}

/**
 * 16 bitlik model (2048/model/donustur.mjs üretir): ntuple16.json + desen başına bir gzip parçası.
 * Parçalar paralel iner, açılırken doğrudan son belleğe (izoleyse SharedArrayBuffer) yazılır; ara kopya yok.
 */
async function loadModelParts(manifestUrl, isolated, onProgress) {
  const resp = await fetch(manifestUrl, { cache: 'no-cache' });
  if (!resp.ok) throw new Error(`Model bilgisi bulunamadı (${resp.status})`);
  const man = await resp.json();
  if (man.format !== 'n2tw-i16') throw new Error('Geçersiz model dosyası');
  const buffer = isolated ? new SharedArrayBuffer(man.count * 2) : new ArrayBuffer(man.count * 2);
  const out = new Uint8Array(buffer);
  const total = man.parts.reduce((a, p) => a + p.bytes, 0);
  let got = 0;
  const base = new URL(manifestUrl, location.href);
  await Promise.all(man.parts.map(async (p) => {
    const r = await fetch(new URL(p.file, base));
    if (!r.ok || !r.body) throw new Error(`Model parçası inemedi: ${p.file} (${r.status})`);
    const counted = r.body.pipeThrough(new TransformStream({
      transform(chunk, ctl) {
        got += chunk.byteLength;
        if (onProgress) onProgress(Math.min(1, got / total), Math.min(got, total), total);
        ctl.enqueue(chunk);
      },
    }));
    const reader = (await gunzipBody(counted)).getReader();
    let at = p.offset * 2;
    const end = at + p.count * 2;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (at + value.byteLength > end) throw new Error(`Model parçası bozuk: ${p.file}`);
      out.set(value, at);
      at += value.byteLength;
    }
    if (at !== end) throw new Error(`Model parçası eksik: ${p.file}`);
  }));
  return {
    buffer, wtype: 'i16', scale: man.scale, version: man.version, nPat: man.nPat, tupleLen: man.tupleLen,
    games: man.games, seconds: man.seconds, stages: man.stages, stageExp: man.stageExp, patterns: man.patterns,
    weightsOffset: 0, weightsCount: man.count, bytes: buffer.byteLength, download: total,
  };
}

class AIController {
  constructor() {
    this.workers = [];
    this.model = null;
    this.modelError = null;
    this.mode = 'heuristic';
    this.isolated = false;
    this.tokenSeq = 1;
    this.searchSeq = 0;
    this.run = null;
    this.ctrl = null;
    this.turboCtrl = null;
    this.turboRun = null;
    // Ölçüm: orta oyunda değerlendirme bellek sınırlı; 4 işçi, 11 işçiden ~1,7 kat hızlı.
    this.maxAnalysisWorkers = 4;
  }

  /** Sayfa açılınca: model olmadan (heuristik) hemen hazır. Tam model sonradan loadModel ile gelir. */
  async init() {
    this.isolated = self.crossOriginIsolated === true && typeof SharedArrayBuffer === 'function';
    const cores = navigator.hardwareConcurrency || 4;
    this.workerCount = this.isolated ? Math.max(1, Math.min(cores - 1, 12)) : 1;
    if (this.isolated) {
      this.ctrl = new Int32Array(new SharedArrayBuffer(4));
      // Turbo motoru: kontrol yuvaları, iş kuyruğu (64 iş), sonuçlar ve işçi istatistikleri.
      this.turboCtrl = new Int32Array(new SharedArrayBuffer(4 * 8));
      this.turboBuffers = {
        turboCtrl: this.turboCtrl.buffer,
        turboJobs: new SharedArrayBuffer(4 * 64 * 3),
        turboRes: new SharedArrayBuffer(8 * 64),
        turboStats: new SharedArrayBuffer(8 * 2 * this.workerCount),
      };
      this.turboStats = new Float64Array(this.turboBuffers.turboStats);
    }
    this.mode = 'heuristic';
    await this._spawn();
  }

  /** Tam modeli indirir (işçiler bu sırada heuristikle çalışmaya devam eder). */
  async downloadModel({ manifestUrl, onProgress }) {
    try {
      return await loadModelParts(manifestUrl, this.isolated, onProgress);
    } catch (err) {
      this.modelError = err.message || String(err);
      throw err;
    }
  }

  /** İnen modelle işçileri yeniden kurar (süren arama iptal edilir). */
  async useModel(model) {
    this.cancel();
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.run = null;
    this.model = model;
    this.modelError = null;
    this.mode = 'ntuple';
    await this._spawn();
    return model;
  }

  async _spawn() {
    const count = this.workerCount;
    const turboBuffers = this.turboBuffers || null;
    const wurl = labAsset('/2048/js/ai-worker.js');
    const workerUrl = `${wurl}${wurl.includes('?') ? '&' : '?'}bb=${encodeURIComponent(labAsset('/2048/js/bitboard.js'))}`;
    const ready = [];
    for (let i = 0; i < count; i++) {
      const w = new Worker(workerUrl);
      w.busy = false;
      w.index = i;
      ready.push(new Promise((resolve, reject) => {
        w.onmessage = (e) => {
          if (e.data.type === 'ready') {
            w.onmessage = (ev) => this._onMessage(w, ev.data);
            resolve();
          }
        };
        w.onerror = (e) => reject(new Error(e.message || 'İşçi başlatılamadı'));
      }));
      const init = { type: 'init', mode: this.mode, ctrl: this.ctrl ? this.ctrl.buffer : null, cutoff: 1e-4, index: i, ...turboBuffers };
      if (this.model) {
        Object.assign(init, {
          buffer: this.model.buffer,
          wtype: this.model.wtype,
          scale: this.model.scale,
          weightsOffset: this.model.weightsOffset,
          weightsCount: this.model.weightsCount,
          patterns: this.model.patterns,
          tupleLen: this.model.tupleLen,
          stages: this.model.stages,
          stageExp: this.model.stageExp,
        });
      }
      // İzole değilse ArrayBuffer tek işçiye kopyalanmadan devredilir.
      if (this.model && !this.isolated) w.postMessage(init, [this.model.buffer]);
      else w.postMessage(init);
      this.workers.push(w);
    }
    await Promise.all(ready);
  }

  setMode(mode) {
    if (mode === 'ntuple' && !this.model) mode = 'heuristic';
    this.cancel();
    this.mode = mode;
    for (const w of this.workers) w.postMessage({ type: 'mode', mode });
  }

  /** Devam eden aramayı ve turbo oyununu iptal eder (sonucu yok sayılır). */
  cancel() {
    this.searchSeq++;
    if (this.run && !this.run.done) this._finishRun(this.run, null);
    if (this.ctrl) Atomics.store(this.ctrl, 0, 0);
    if (this.turboRun) this.stopTurbo();
  }

  /**
   * Turbo: lider işçi oyunu kendisi oynar, hamleleri toplu paketlerle `onBatch`e yollar.
   * Oyun bitince ya da durdurulunca 'gameover' / 'stopped' ile çözülür.
   */
  turboPlay(exps, opts, onBatch) {
    this.cancel();
    const T = this.turboCtrl;
    const tune = Object.assign(AIController.turboDefaults(opts.maxDepth, this.workers.length), this.turboTuning, opts.tuning);
    const helpers = T ? this.workers.slice(1, 1 + Math.max(0, tune.helpers)) : [];
    if (T) {
      Atomics.store(T, 3, 0); // COUNT: kuyruk kapalı
      Atomics.store(T, 0, 1); // STATE: açık
    }
    for (const h of helpers) h.postMessage({ type: 'turbo-helper', spinMs: tune.spinMs });
    const [hi, lo] = expsToBoard(exps);
    let resolve;
    const done = new Promise((r) => { resolve = r; });
    const maxDepth = Math.max(0, opts.maxDepth);
    this.turboRun = { onBatch, resolve, done, lead: this.workers[0], stopping: false };
    this.workers[0].postMessage({
      type: 'turbo-start', hi, lo, maxDepth, minDepth: Math.min(Math.max(0, opts.minDepth ?? 1), maxDepth),
      timeMs: opts.timeMs > 0 ? opts.timeMs : 0, helpers: helpers.length,
      parallelMinDepth: tune.parallelMinDepth, spinMs: tune.spinMs,
    });
    return done;
  }

  /**
   * Derinliğe göre ölçülmüş en iyi turbo ayarları. Orta oyunda değerlendirme bellek bant genişliğiyle
   * sınırlıdır (256 MB tabloya rastgele erişim): 3-4 işçiden sonrası hız kazandırmaz, çekişme yaratır.
   */
  static turboDefaults(depth, workers) {
    const cap = Math.max(0, workers - 1);
    if (depth <= 0) return { helpers: 0, parallelMinDepth: 99, spinMs: 0 };
    if (depth === 1) return { helpers: Math.min(2, cap), parallelMinDepth: 1, spinMs: 0.3 };
    return { helpers: Math.min(3, cap), parallelMinDepth: 2, spinMs: 0 };
  }

  stopTurbo() {
    const run = this.turboRun;
    if (!run) return Promise.resolve(null);
    if (!run.stopping) {
      run.stopping = true;
      const T = this.turboCtrl;
      if (T) {
        Atomics.store(T, 0, 0);  // STATE kapalı
        Atomics.store(T, 5, -1); // süren aramaları iptal et
        Atomics.add(T, 1, 1);    // bekleyen yardımcıları uyandır
        Atomics.notify(T, 1);
        Atomics.notify(T, 4);
      }
      run.lead.postMessage({ type: 'turbo-stop' });
    }
    return run.done;
  }

  /**
   * Bir tahta konumunu analiz eder.
   * @param {number[]} exps 16 hücrelik üs dizisi
   * @param {{timeMs:number, maxDepth:number, minDepth:number}} opts  timeMs 0 = süre sınırı yok (sabit derinlik)
   */
  async analyze(exps, opts) {
    if (this.turboRun) await this.stopTurbo();
    this.cancel();
    const searchId = this.searchSeq;
    const [hi, lo] = expsToBoard(exps);
    const useReward = this.mode === 'ntuple' ? 1 : 0;
    const roots = [];
    const dirs = [];
    for (let d = 0; d < 4; d++) {
      const r = moveBoard(hi, lo, d);
      if (r < 0) {
        dirs.push({ dir: d, valid: false, reward: 0, q: null, afterExps: null });
        continue;
      }
      const ahi = MOVE_OUT[0], alo = MOVE_OUT[1];
      const cells = [];
      for (let k = 0; k < 16; k++) {
        const v = k < 8 ? (ahi >>> (4 * k)) & 15 : (alo >>> (4 * (k - 8))) & 15;
        if (v === 0) cells.push(k);
      }
      const root = { dir: d, reward: r, hi: ahi, lo: alo, cells };
      roots.push(root);
      dirs.push({ dir: d, valid: true, reward: r, q: null, afterExps: boardToExps(ahi, alo) });
    }
    if (roots.length === 0) return { gameOver: true, dirs };

    const t0 = performance.now();
    const maxDepth = Math.max(0, opts.maxDepth);
    const minDepth = Math.min(Math.max(0, opts.minDepth ?? 1), maxDepth);
    const budget = opts.timeMs > 0 ? opts.timeMs : Infinity;
    let lastTook = 0, completed = null, totalEvals = 0, totalHits = 0, depthTimes = [];

    for (let D = 0; D <= maxDepth; D++) {
      if (searchId !== this.searchSeq) return null;
      const tStart = performance.now();
      let timer = null;
      if (D > minDepth && this.ctrl && budget !== Infinity) {
        const remaining = t0 + budget * 2 - tStart;
        timer = setTimeout(() => { if (this.ctrl) Atomics.store(this.ctrl, 0, 0); }, Math.max(0, remaining));
      }
      const out = await this._runDepth(roots, D);
      if (timer) clearTimeout(timer);
      if (searchId !== this.searchSeq) return null;
      if (!out) break;

      totalEvals += out.evals;
      totalHits += out.ttHits;
      const qs = roots.map((root) => {
        if (D === 0) return useReward * root.reward + out.values[root.jobStart];
        let s = 0;
        for (let j = 0; j < root.cells.length; j++) s += out.values[root.jobStart + j];
        return useReward * root.reward + s / root.cells.length;
      });
      // Her boş hücre için "taş buraya gelirse" beklenen değer (risk haritası).
      const cellValues = D === 0 ? null
        : roots.map((root) => Float32Array.from(out.values.subarray(root.jobStart, root.jobStart + root.cells.length),
          (v) => useReward * root.reward + v));
      completed = { depth: D, qs, cellValues };
      const took = performance.now() - tStart;
      depthTimes.push(took);

      if (roots.length === 1 && D >= minDepth) break; // tek geçerli hamle: daha fazla düşünmeye gerek yok
      if (D >= minDepth) {
        const ratio = lastTook > 0.5 ? took / lastTook : 12;
        const predicted = took * Math.min(60, Math.max(4, ratio));
        if (performance.now() - t0 + predicted > budget) break;
      }
      lastTook = took;
    }
    if (!completed) return null;

    let best = -1, bestQ = -Infinity;
    roots.forEach((root, i) => {
      dirs[root.dir].q = completed.qs[i];
      dirs[root.dir].cells = root.cells;
      dirs[root.dir].cellValues = completed.cellValues ? completed.cellValues[i] : null;
      if (completed.qs[i] > bestQ) { bestQ = completed.qs[i]; best = root.dir; }
    });
    const timeMs = performance.now() - t0;
    return {
      gameOver: false,
      dirs,
      best,
      bestQ,
      depth: completed.depth,
      evals: totalEvals,
      ttHits: totalHits,
      timeMs,
      depthTimes,
      mode: this.mode,
      workers: this.workers.length,
    };
  }

  _runDepth(roots, D) {
    const jobs = [];
    for (const root of roots) {
      root.jobStart = jobs.length;
      if (D === 0) {
        jobs.push({ kind: 0, hi: root.hi, lo: root.lo });
      } else {
        const n = root.cells.length;
        for (const k of root.cells) jobs.push({ kind: 1, hi: root.hi, lo: root.lo, cell: k, n, depth: D });
      }
    }
    const pool = this.analysisPool();
    const nw = pool.length;
    const batchSize = D <= 1 ? Math.ceil(jobs.length / nw) : (D === 2 ? 3 : 1);
    return new Promise((resolve) => {
      const run = {
        token: ++this.tokenSeq, jobs, batchSize, next: 0, completed: 0, pending: 0,
        values: new Float64Array(jobs.length), evals: 0, ttHits: 0, done: false, resolve,
      };
      this.run = run;
      if (this.ctrl) Atomics.store(this.ctrl, 0, run.token);
      for (const w of pool) if (!w.busy) this._dispatch(run, w);
    });
  }

  /** Normal analizde iş dağıtılan işçiler. */
  analysisPool() {
    const n = Math.max(1, Math.min(this.workers.length, this.maxAnalysisWorkers || this.workers.length));
    return this.workers.slice(0, n);
  }

  _dispatch(run, w) {
    if (run.done || run.next >= run.jobs.length) return;
    const start = run.next;
    const end = Math.min(start + run.batchSize, run.jobs.length);
    run.next = end;
    run.pending++;
    w.busy = true;
    w.postMessage({ type: 'jobs', token: run.token, batch: start, jobs: run.jobs.slice(start, end) });
  }

  _finishRun(run, value) {
    if (run.done) return;
    run.done = true;
    run.resolve(value);
  }

  _onMessage(w, msg) {
    switch (msg.type) {
      case 'turbo-batch': {
        w.postMessage({ type: 'turbo-ack' });
        const run = this.turboRun;
        if (run && !run.stopping) run.onBatch(msg);
        return;
      }
      case 'turbo-end': {
        const run = this.turboRun;
        this.turboRun = null;
        const T = this.turboCtrl;
        if (T) {
          Atomics.store(T, 0, 0);
          Atomics.add(T, 1, 1);
          Atomics.notify(T, 1);
        }
        if (run) run.resolve(msg.reason);
        return;
      }
      case 'turbo-helper-exit':
        return;
    }
    w.busy = false;
    const run = this.run;
    if (!run || run.done || msg.token !== run.token) {
      if (run && !run.done && w.index < this.analysisPool().length) this._dispatch(run, w);
      return;
    }
    run.pending--;
    if (msg.type === 'results') {
      run.values.set(msg.results, msg.batch);
      run.completed += msg.results.length;
      run.evals += msg.evals;
      run.ttHits += msg.ttHits;
      if (run.completed === run.jobs.length) {
        this._finishRun(run, { values: run.values, evals: run.evals, ttHits: run.ttHits });
      } else {
        this._dispatch(run, w);
      }
    } else {
      if (msg.type === 'error') console.error('AI işçi hatası:', msg.message);
      this._finishRun(run, null);
    }
  }
}
