/*
 * AI arama işçisi (Web Worker).
 *
 * Her işçi, ana iş parçacığının dağıttığı alt problemleri (kök hamle x boş hücre) çözer:
 * Expectimax araması, yaprakta N-Tuple ağıyla (veya heuristikle) değerlendirme,
 * transposition table (önbellek) ve olasılık budaması.
 */
'use strict';
// bitboard.js'in sürümlü adresi (?bb=) ai.js'ten gelir: yayından sonra işçi ile motor farklı sürümlerden yüklenmesin
(function () {
  var bb = new URLSearchParams(self.location.search).get('bb');
  importScripts(bb && /^\/2048\/js\/bitboard\.js(\?v=[0-9a-f]+)?$/.test(bb) ? bb : 'bitboard.js');
}());

// ---------------------------------------------------------------------------
// Değerlendirme fonksiyonları
// ---------------------------------------------------------------------------

var W = null;                       // N-Tuple ağırlıkları (Int16Array ya da Float32Array, genelde SharedArrayBuffer üzerinde)
var W_SCALE = 1;                    // 16 bitlik modelde ağırlık = tam sayı × ölçek (toplam bir kez çarpılır)
var FEAT_POS = null;                // Int32Array(nFeat * tupleLen): her özelliğin hücre konumları
var FEAT_BASE = null;               // Int32Array(nFeat): özelliğin ağırlık tablosundaki başlangıcı
var N_FEAT = 0;
var STAGES = 1;                     // çok aşamalı model: her aşamanın ayrı ağırlık seti vardır
var STAGE_EXP = 99;                 // en büyük taş bu üsse ulaşınca sonraki aşamaya geçilir
var STAGE_SIZE = 0;                 // bir aşamanın ağırlık sayısı
var CELLS = new Int32Array(16);

function isoPos(pos, t) {
  var r = pos >> 2, c = pos & 3;
  if (t >= 4) c = 3 - c;
  for (var i = 0; i < t % 4; i++) {
    var nr = c, nc = 3 - r;
    r = nr; c = nc;
  }
  return r * 4 + c;
}

function setupNetwork(patterns, tupleLen, stages, stageExp) {
  var nPat = patterns.length;
  N_FEAT = nPat * 8;
  STAGES = stages || 1;
  STAGE_EXP = STAGES > 1 ? stageExp : 99;
  STAGE_SIZE = nPat * Math.pow(16, tupleLen);
  FEAT_POS = new Int32Array(N_FEAT * tupleLen);
  FEAT_BASE = new Int32Array(N_FEAT);
  var size = Math.pow(16, tupleLen);
  for (var p = 0; p < nPat; p++) {
    for (var t = 0; t < 8; t++) {
      var k = p * 8 + t;
      FEAT_BASE[k] = p * size;
      for (var j = 0; j < tupleLen; j++) FEAT_POS[k * tupleLen + j] = isoPos(patterns[p][j], t);
    }
  }
}

/** Tahtanın aşaması: en büyük taşın üssüne göre hangi ağırlık setinin kullanılacağı. */
function stageOffset(hi, lo) {
  if (STAGES === 1) return 0;
  var m = ROW_MAX[hi & 0xffff];
  var x = ROW_MAX[hi >>> 16]; if (x > m) m = x;
  x = ROW_MAX[lo & 0xffff]; if (x > m) m = x;
  x = ROW_MAX[lo >>> 16]; if (x > m) m = x;
  if (m < STAGE_EXP) return 0;
  var s = m - STAGE_EXP + 1;
  return (s < STAGES ? s : STAGES - 1) * STAGE_SIZE;
}

/** 4x6-tuple ağ değerlendirmesi: 32 özelliğin ağırlık toplamı = beklenen gelecekteki skor. */
function evalNTuple(hi, lo) {
  var c = CELLS;
  c[0] = hi & 15; c[1] = (hi >>> 4) & 15; c[2] = (hi >>> 8) & 15; c[3] = (hi >>> 12) & 15;
  c[4] = (hi >>> 16) & 15; c[5] = (hi >>> 20) & 15; c[6] = (hi >>> 24) & 15; c[7] = (hi >>> 28) & 15;
  c[8] = lo & 15; c[9] = (lo >>> 4) & 15; c[10] = (lo >>> 8) & 15; c[11] = (lo >>> 12) & 15;
  c[12] = (lo >>> 16) & 15; c[13] = (lo >>> 20) & 15; c[14] = (lo >>> 24) & 15; c[15] = (lo >>> 28) & 15;
  var P = FEAT_POS, v = 0, off = stageOffset(hi, lo);
  for (var k = 0, o = 0; k < N_FEAT; k++, o += 6) {
    v += W[off + FEAT_BASE[k] + (c[P[o]] | (c[P[o + 1]] << 4) | (c[P[o + 2]] << 8) |
      (c[P[o + 3]] << 12) | (c[P[o + 4]] << 16) | (c[P[o + 5]] << 20))];
  }
  return v * W_SCALE;
}

// Heuristik: monotonluk, boş hücre, birleşme potansiyeli ve büyük taş cezası (satır başına tablo).
var HEUR = new Float32Array(65536);
(function buildHeuristic() {
  var LOST = 200000, W_EMPTY = 270, W_MERGE = 700, W_MONO = 47, P_MONO = 4, W_SUM = 11, P_SUM = 3.5;
  var line = [0, 0, 0, 0];
  for (var row = 0; row < 65536; row++) {
    for (var i = 0; i < 4; i++) line[i] = (row >> (4 * i)) & 15;
    var sum = 0, empty = 0, merges = 0, prev = 0, counter = 0;
    for (i = 0; i < 4; i++) {
      var rank = line[i];
      sum += Math.pow(rank, P_SUM);
      if (rank === 0) {
        empty++;
      } else {
        if (prev === rank) counter++;
        else if (counter > 0) { merges += 1 + counter; counter = 0; }
        prev = rank;
      }
    }
    if (counter > 0) merges += 1 + counter;
    var monoL = 0, monoR = 0;
    for (i = 1; i < 4; i++) {
      if (line[i - 1] > line[i]) monoL += Math.pow(line[i - 1], P_MONO) - Math.pow(line[i], P_MONO);
      else monoR += Math.pow(line[i], P_MONO) - Math.pow(line[i - 1], P_MONO);
    }
    HEUR[row] = LOST + W_EMPTY * empty + W_MERGE * merges - W_MONO * Math.min(monoL, monoR) - W_SUM * sum;
  }
})();

function evalHeuristic(hi, lo) {
  var r0 = hi & 0xffff, r1 = hi >>> 16, r2 = lo & 0xffff, r3 = lo >>> 16;
  var v = HEUR[r0] + HEUR[r1] + HEUR[r2] + HEUR[r3];
  for (var c = 0; c < 16; c += 4) {
    v += HEUR[((r0 >> c) & 15) | (((r1 >> c) & 15) << 4) | (((r2 >> c) & 15) << 8) | (((r3 >> c) & 15) << 12)];
  }
  return v;
}

// ---------------------------------------------------------------------------
// Expectimax arama
// ---------------------------------------------------------------------------

var mode = 'heuristic';
var baseEval = evalHeuristic;
var useReward = 0;
var CUTOFF = 1e-4;

// Yaprak değerlendirme önbelleği: arama aynı tahtaya farklı yollardan sık ulaşır. Değerlendirme,
// 256 MB'lık ağırlık tablosuna 32 rastgele erişim demektir (bellek darboğazı); L2'ye sığan bu küçük
// tablo tekrarlarda bu erişimleri tamamen atlar. Boş tahta (0,0) hiç değerlendirilmediği için boş işaretidir.
var LC_BITS = 16, lcHi, lcLo, lcVal;
var useLeafCache = true;
function allocLeafCache(bits) {
  LC_BITS = bits;
  lcHi = new Int32Array(1 << bits); lcLo = new Int32Array(1 << bits); lcVal = new Float64Array(1 << bits);
}
allocLeafCache(16);

function evaluate(hi, lo) {
  if (!useLeafCache) return baseEval(hi, lo);
  var h = (Math.imul(hi ^ (lo >>> 16), 0x9e3779b1) ^ Math.imul(lo, 0x85ebca77)) >>> (32 - LC_BITS);
  if (lcHi[h] === hi && lcLo[h] === lo) return lcVal[h];
  var v = baseEval(hi, lo);
  lcHi[h] = hi; lcLo[h] = lo; lcVal[h] = v;
  return v;
}

var TT_BITS = 20, TT_SIZE = 0, TT_MASK = 0;
var ttHi, ttLo, ttDepth, ttVal;
function allocTT(bits) {
  TT_BITS = bits; TT_SIZE = 1 << bits; TT_MASK = TT_SIZE - 1;
  ttHi = new Int32Array(TT_SIZE);
  ttLo = new Int32Array(TT_SIZE);
  ttDepth = new Int8Array(TT_SIZE).fill(-1);
  ttVal = new Float64Array(TT_SIZE);
}
allocTT(20);

var evals = 0, ttHits = 0, nodes = 0;
var ctrl = null;        // Int32Array (SharedArrayBuffer): aktif arama jetonu, iptal için
var abortArr = null;    // iptal kontrolünün okunduğu dizi (normal modda ctrl, turboda turbo kontrolü)
var abortIdx = 0;
var token = 0;
var ABORT = { aborted: true };

function setMode(m) {
  mode = (m === 'ntuple' && W) ? 'ntuple' : 'heuristic';
  baseEval = mode === 'ntuple' ? evalNTuple : evalHeuristic;
  useReward = mode === 'ntuple' ? 1 : 0;
  ttDepth.fill(-1);
  lcHi.fill(0); lcLo.fill(0);
}

function chanceNode(hi, lo, depth, prob) {
  if (depth <= 0 || prob < CUTOFF) {
    evals++;
    return evaluate(hi, lo);
  }
  if ((++nodes & 255) === 0 && abortArr !== null && Atomics.load(abortArr, abortIdx) !== token) throw ABORT;

  var h = Math.imul(hi ^ (lo >>> 15), 0x9e3779b1) ^ Math.imul(lo ^ (hi >>> 13), 0x85ebca77);
  h = (h ^ (h >>> 16)) & TT_MASK;
  if (ttHi[h] === hi && ttLo[h] === lo && ttDepth[h] >= depth) {
    ttHits++;
    return ttVal[h];
  }

  var eh = emptyMask(hi), el = emptyMask(lo);
  var n = popcount32(eh) + popcount32(el);
  if (n === 0) {
    evals++;
    return evaluate(hi, lo);
  }
  var p2 = prob * 0.9 / n, p4 = prob * 0.1 / n, sum = 0, bit;
  while (eh !== 0) {
    bit = eh & -eh;
    eh ^= bit;
    sum += 0.9 * maxNode(hi | bit, lo, depth - 1, p2) + 0.1 * maxNode(hi | (bit << 1), lo, depth - 1, p4);
  }
  while (el !== 0) {
    bit = el & -el;
    el ^= bit;
    sum += 0.9 * maxNode(hi, lo | bit, depth - 1, p2) + 0.1 * maxNode(hi, lo | (bit << 1), depth - 1, p4);
  }
  var v = sum / n;
  ttHi[h] = hi; ttLo[h] = lo; ttDepth[h] = depth; ttVal[h] = v;
  return v;
}

function maxNode(hi, lo, depth, prob) {
  var best = -Infinity;
  for (var d = 0; d < 4; d++) {
    var r = moveBoard(hi, lo, d);
    if (r < 0) continue;
    var v = useReward * r + chanceNode(MOVE_OUT[0], MOVE_OUT[1], depth, prob);
    if (v > best) best = v;
  }
  return best === -Infinity ? 0 : best; // hamle yok: oyun biter
}

/**
 * İş türleri:
 *  kind 0: kök afterstate'in doğrudan değeri (derinlik 0)
 *  kind 1: kök afterstate'te `cell` hücresine 2 (%90) veya 4 (%10) gelirse beklenen değer
 */
function runJob(job) {
  if (job.kind === 0) {
    evals++;
    return evaluate(job.hi, job.lo);
  }
  return runCellJob(job.hi, job.lo, job.cell, job.n, job.depth);
}

/** Kök afterstate'te `k` hücresine taş gelirse beklenen değer (derinlik D, n boş hücre). */
function runCellJob(hi, lo, k, n, D) {
  var d = D - 1, b2hi = hi, b2lo = lo, b4hi = hi, b4lo = lo;
  if (k < 8) { b2hi = hi | (1 << (4 * k)); b4hi = hi | (2 << (4 * k)); }
  else { b2lo = lo | (1 << (4 * (k - 8))); b4lo = lo | (2 << (4 * (k - 8))); }
  return 0.9 * maxNode(b2hi, b2lo, d, 0.9 / n) + 0.1 * maxNode(b4hi, b4lo, d, 0.1 / n);
}

// ---------------------------------------------------------------------------
// Turbo motoru
//
// Lider işçi (0 numaralı) oyunu kendisi oynar: arama + hamle + rastgele taş, sonuçları toplu
// paketler hâlinde ana iş parçacığına yollar. Derinlik >= 2 aramalarda kök alt problemleri
// paylaşımlı bellekteki bir iş kuyruğuna yazılır; yardımcı işçiler mesaj beklemeden (Atomics)
// işleri kapar. Böylece hamle başına mesaj gidiş-dönüşü tamamen ortadan kalkar.
// ---------------------------------------------------------------------------

var S_STATE = 0, S_SEQ = 1, S_NEXT = 2, S_COUNT = 3, S_DONE = 4, S_ABORT = 5;
var MAX_JOBS = 64;
var T = null;        // Int32Array: turbo kontrol yuvaları
var TJ = null;       // Int32Array(3 * MAX_JOBS): hi, lo, meta (hücre | n<<8 | derinlik<<16)
var TRES = null;     // Float64Array(MAX_JOBS): iş sonuçları (NaN = iptal)
var TSTAT = null;    // Float64Array(2 * işçi): işçi başına toplam değerlendirme / önbellek isabeti
var workerIndex = 0;

function claimJob() {
  for (;;) {
    var i = Atomics.load(T, S_NEXT);
    if (i >= Atomics.load(T, S_COUNT)) return -1;
    if (Atomics.compareExchange(T, S_NEXT, i, i + 1) === i) return i;
  }
}

function drainSharedJobs() {
  for (;;) {
    var i = claimJob();
    if (i < 0) return;
    abortArr = T; abortIdx = S_ABORT; token = Atomics.load(T, S_ABORT);
    var meta = TJ[2 * MAX_JOBS + i], v;
    try {
      v = runCellJob(TJ[i], TJ[MAX_JOBS + i], meta & 255, (meta >> 8) & 255, (meta >> 16) & 255);
    } catch (err) {
      if (err !== ABORT) console.error(err);
      v = NaN;
    }
    TRES[i] = v;
    TSTAT[workerIndex * 2] = evals;
    TSTAT[workerIndex * 2 + 1] = ttHits;
    if (Atomics.add(T, S_DONE, 1) + 1 >= Atomics.load(T, S_COUNT)) Atomics.notify(T, S_DONE);
  }
}

/** Yardımcı işçi: turbo açık olduğu sürece paylaşımlı kuyruktan iş çeker. */
function helperLoop(spinMs) {
  evals = 0; ttHits = 0; nodes = 0;
  TSTAT[workerIndex * 2] = 0;
  TSTAT[workerIndex * 2 + 1] = 0;
  while (Atomics.load(T, S_STATE) === 1) {
    drainSharedJobs();
    var spinUntil = performance.now() + spinMs;
    for (;;) {
      var seq = Atomics.load(T, S_SEQ); // önce oku: bildirim kaybolmasın
      if (Atomics.load(T, S_STATE) !== 1) break;
      if (Atomics.load(T, S_NEXT) < Atomics.load(T, S_COUNT)) break;
      if (performance.now() < spinUntil) continue; // kısa aktif bekleme: uyandırma gecikmesi yok
      Atomics.wait(T, S_SEQ, seq, 100);
    }
  }
  abortArr = ctrl; abortIdx = 0;
}

var turbo = null;
var turboTok = 0;
var SLICE_MS = 12, BATCH_CAP = 16384;
var R_HI = new Int32Array(4), R_LO = new Int32Array(4), R_DIR = new Int32Array(4), R_N = new Int32Array(4);
var R_START = new Int32Array(4), R_CELLS = new Int32Array(64), R_REW = new Float64Array(4);
var Q_TMP = new Float64Array(4), Q_BEST = new Float64Array(4);
var CV_TMP = new Float64Array(64), CV_BEST = new Float64Array(64);
var nRoots = 0;
var B_DIRS = new Uint8Array(BATCH_CAP), B_SPAWN = new Uint8Array(BATCH_CAP), B_DEPTH = new Int8Array(BATCH_CAP);
var B_QS = new Float32Array(BATCH_CAP * 4), B_TIME = new Float32Array(BATCH_CAP), B_EVALS = new Float64Array(BATCH_CAP);
var B_RISK = new Float32Array(BATCH_CAP * 16);

function helperEvals() {
  if (!TSTAT) return 0;
  var s = 0;
  for (var i = 1; i < turbo.workers; i++) s += TSTAT[i * 2];
  return s;
}

function computeRoots(hi, lo) {
  nRoots = 0;
  for (var d = 0; d < 4; d++) {
    var r = moveBoard(hi, lo, d);
    if (r < 0) continue;
    var i = nRoots++, ahi = MOVE_OUT[0], alo = MOVE_OUT[1], n = 0;
    R_HI[i] = ahi; R_LO[i] = alo; R_DIR[i] = d; R_REW[i] = r;
    var eh = emptyMask(ahi), el = emptyMask(alo);
    for (var k = 0; k < 8; k++) if (eh & (1 << (4 * k))) R_CELLS[i * 16 + n++] = k;
    for (k = 0; k < 8; k++) if (el & (1 << (4 * k))) R_CELLS[i * 16 + n++] = k + 8;
    R_N[i] = n;
  }
}

/** Tek derinlik seviyesini hesaplar; iptal edilirse false döner. */
function evalDepth(D) {
  var i, j;
  if (D === 0) {
    for (i = 0; i < nRoots; i++) {
      evals++;
      Q_TMP[i] = useReward * R_REW[i] + evaluate(R_HI[i], R_LO[i]);
    }
    return true;
  }
  var count = 0;
  for (i = 0; i < nRoots; i++) { R_START[i] = count; count += R_N[i]; }

  if (turbo.parallel && D >= turbo.parallelMinDepth) {
    if (Atomics.load(T, S_STATE) !== 1) return false;
    // Kuyruğu kapat, işleri yaz, aç, uyandır.
    Atomics.store(T, S_COUNT, 0);
    Atomics.store(T, S_NEXT, 0);
    Atomics.store(T, S_DONE, 0);
    Atomics.store(T, S_ABORT, ++turboTok);
    for (i = 0; i < nRoots; i++) {
      for (j = 0; j < R_N[i]; j++) {
        var idx = R_START[i] + j;
        TJ[idx] = R_HI[i];
        TJ[MAX_JOBS + idx] = R_LO[i];
        TJ[2 * MAX_JOBS + idx] = R_CELLS[i * 16 + j] | (R_N[i] << 8) | (D << 16);
      }
    }
    Atomics.store(T, S_COUNT, count);
    Atomics.add(T, S_SEQ, 1);
    Atomics.notify(T, S_SEQ);
    drainSharedJobs();
    var spinUntil = performance.now() + turbo.spinMs;
    for (;;) {
      var done = Atomics.load(T, S_DONE);
      if (done >= count) break;
      if (performance.now() < spinUntil) continue;
      Atomics.wait(T, S_DONE, done, 20);
    }
    for (i = 0; i < count; i++) {
      if (TRES[i] !== TRES[i]) return false;
      CV_TMP[i] = TRES[i];
    }
  } else {
    if (T) {
      if (Atomics.load(T, S_STATE) !== 1) return false;
      abortArr = T; abortIdx = S_ABORT; token = turboTok;
    }
    for (i = 0; i < nRoots; i++) {
      for (j = 0; j < R_N[i]; j++) {
        CV_TMP[R_START[i] + j] = runCellJob(R_HI[i], R_LO[i], R_CELLS[i * 16 + j], R_N[i], D);
      }
    }
  }
  for (i = 0; i < nRoots; i++) {
    var s = 0;
    for (j = 0; j < R_N[i]; j++) {
      CV_TMP[R_START[i] + j] += useReward * R_REW[i];
      s += CV_TMP[R_START[i] + j];
    }
    Q_TMP[i] = s / R_N[i];
  }
  return true;
}

/** Bir hamle oynar ve pakete yazar. 0 = tamam, 1 = oyun bitti, 2 = iptal. */
function turboMove(slot) {
  computeRoots(turbo.hi, turbo.lo);
  if (nRoots === 0) return 1;
  var t0 = performance.now();
  var ev0 = evals + helperEvals();
  var completed = -1, lastTook = 0, cvCount = 0;
  var startD = turbo.timeMs > 0 ? 0 : turbo.maxDepth;
  for (var D = startD; D <= turbo.maxDepth; D++) {
    var t1 = performance.now(), ok;
    try { ok = evalDepth(D); } catch (err) { if (err !== ABORT) throw err; ok = false; }
    if (!ok) break;
    for (var r = 0; r < nRoots; r++) Q_BEST[r] = Q_TMP[r];
    if (D > 0) {
      cvCount = R_START[nRoots - 1] + R_N[nRoots - 1];
      for (var c = 0; c < cvCount; c++) CV_BEST[c] = CV_TMP[c];
    }
    completed = D;
    var took = performance.now() - t1;
    if (nRoots === 1 && D >= turbo.minDepth) break;
    if (turbo.timeMs > 0 && D >= turbo.minDepth) {
      var ratio = lastTook > 0.05 ? took / lastTook : 12;
      var predicted = took * Math.min(60, Math.max(4, ratio));
      if (performance.now() - t0 + predicted > turbo.timeMs) break;
    }
    lastTook = took;
  }
  if (completed < 0) return 2;

  var b = 0;
  for (r = 1; r < nRoots; r++) if (Q_BEST[r] > Q_BEST[b]) b = r;
  var q = slot * 4, rk = slot * 16;
  B_QS[q] = B_QS[q + 1] = B_QS[q + 2] = B_QS[q + 3] = NaN;
  for (r = 0; r < nRoots; r++) B_QS[q + R_DIR[r]] = Q_BEST[r];
  B_RISK.fill(NaN, rk, rk + 16);
  if (completed > 0) {
    for (var j = 0; j < R_N[b]; j++) B_RISK[rk + R_CELLS[b * 16 + j]] = CV_BEST[R_START[b] + j];
    turbo.hasRisk = true;
  }
  B_DIRS[slot] = R_DIR[b];
  B_DEPTH[slot] = completed;
  B_EVALS[slot] = Math.max(0, evals + helperEvals() - ev0);

  // Hamleyi uygula ve rastgele taş koy (%90 "2", %10 "4").
  var hi = R_HI[b], lo = R_LO[b];
  var cells = R_N[b], pick = (Math.random() * cells) | 0;
  var cell = R_CELLS[b * 16 + pick], tile = Math.random() < 0.9 ? 1 : 2;
  if (cell < 8) hi |= tile << (4 * cell);
  else lo |= tile << (4 * (cell - 8));
  turbo.hi = hi | 0;
  turbo.lo = lo | 0;
  B_SPAWN[slot] = cell | (tile << 4);
  B_TIME[slot] = performance.now() - t0;
  return 0;
}

var tickChannel = new MessageChannel();
tickChannel.port1.onmessage = function () { turboSlice(); };

function endTurbo(reason) {
  turbo = null;
  abortArr = ctrl; abortIdx = 0;
  self.postMessage({ type: 'turbo-end', reason: reason });
}

function turboSlice() {
  if (!turbo) return;
  if (!turbo.running || (T && Atomics.load(T, S_STATE) !== 1)) { endTurbo('stopped'); return; }
  var n = 0, status = 0, t0 = performance.now();
  turbo.hasRisk = false;
  while (n < BATCH_CAP) {
    status = turboMove(n);
    if (status !== 0) break;
    n++;
    if (performance.now() - t0 >= SLICE_MS) break;
    if (T && Atomics.load(T, S_STATE) !== 1) { status = 2; break; }
  }
  if (n > 0 || status === 1) {
    var msg = {
      type: 'turbo-batch', count: n, gameOver: status === 1, mode: mode,
      dirs: B_DIRS.slice(0, n), spawns: B_SPAWN.slice(0, n), depth: B_DEPTH.slice(0, n),
      qs: B_QS.slice(0, n * 4), time: B_TIME.slice(0, n), evals: B_EVALS.slice(0, n),
      risk: turbo.hasRisk ? B_RISK.slice(0, n * 16) : null,
    };
    var transfer = [msg.dirs.buffer, msg.spawns.buffer, msg.depth.buffer, msg.qs.buffer, msg.time.buffer, msg.evals.buffer];
    if (msg.risk) transfer.push(msg.risk.buffer);
    self.postMessage(msg, transfer);
    turbo.outstanding++;
  }
  if (status === 1) { endTurbo('gameover'); return; }
  if (status === 2) { endTurbo('stopped'); return; }
  // Akış kontrolü: ana iş parçacığı en fazla 2 paket geride kalabilir.
  if (turbo.outstanding < 2) tickChannel.port2.postMessage(0);
  else turbo.waitingAck = true;
}

self.onmessage = function (e) {
  var msg = e.data;
  switch (msg.type) {
    case 'init':
      if (msg.buffer) {
        if (msg.wtype === 'i16') { W = new Int16Array(msg.buffer, msg.weightsOffset, msg.weightsCount); W_SCALE = msg.scale; }
        else { W = new Float32Array(msg.buffer, msg.weightsOffset, msg.weightsCount); W_SCALE = 1; }
        setupNetwork(msg.patterns, msg.tupleLen, msg.stages, msg.stageExp);
      }
      if (msg.ctrl) { ctrl = new Int32Array(msg.ctrl); abortArr = ctrl; abortIdx = 0; }
      if (msg.turboCtrl) {
        T = new Int32Array(msg.turboCtrl);
        TJ = new Int32Array(msg.turboJobs);
        TRES = new Float64Array(msg.turboRes);
        TSTAT = new Float64Array(msg.turboStats);
      }
      workerIndex = msg.index || 0;
      if (msg.cutoff) CUTOFF = msg.cutoff;
      setMode(msg.mode);
      self.postMessage({ type: 'ready', mode: mode });
      break;
    case 'mode':
      setMode(msg.mode);
      break;
    case 'cache-config':
      useLeafCache = msg.leafBits > 0;
      if (msg.leafBits > 0) allocLeafCache(msg.leafBits);
      if (msg.ttBits) allocTT(msg.ttBits);
      break;
    case 'turbo-helper':
      if (T) helperLoop(msg.spinMs ?? 1.5);
      self.postMessage({ type: 'turbo-helper-exit' });
      break;
    case 'turbo-start':
      turbo = {
        hi: msg.hi | 0, lo: msg.lo | 0, maxDepth: msg.maxDepth, minDepth: msg.minDepth, timeMs: msg.timeMs,
        parallel: !!(T && msg.helpers > 0), workers: msg.helpers + 1, running: true, outstanding: 0, waitingAck: false,
        hasRisk: false, parallelMinDepth: msg.parallelMinDepth ?? 2, spinMs: msg.spinMs ?? 1.5,
      };
      evals = 0; ttHits = 0; nodes = 0;
      if (T) Atomics.store(T, S_ABORT, ++turboTok);
      turboSlice();
      break;
    case 'turbo-ack':
      if (turbo) {
        turbo.outstanding--;
        if (turbo.waitingAck && turbo.outstanding < 2) { turbo.waitingAck = false; turboSlice(); }
      }
      break;
    case 'turbo-stop':
      if (turbo) {
        turbo.running = false;
        if (turbo.waitingAck) endTurbo('stopped');
      }
      break;
    case 'jobs': {
      abortArr = ctrl; abortIdx = 0;
      token = msg.token;
      evals = 0; ttHits = 0; nodes = 0;
      var results = new Float64Array(msg.jobs.length);
      try {
        for (var i = 0; i < msg.jobs.length; i++) results[i] = runJob(msg.jobs[i]);
        self.postMessage({ type: 'results', token: msg.token, batch: msg.batch, results: results, evals: evals, ttHits: ttHits, nodes: nodes });
      } catch (err) {
        if (err === ABORT) self.postMessage({ type: 'aborted', token: msg.token, batch: msg.batch, evals: evals });
        else self.postMessage({ type: 'error', token: msg.token, batch: msg.batch, message: String(err && err.stack || err) });
      }
      break;
    }
  }
};
