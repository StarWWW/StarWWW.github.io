/*
 * Gerçek 2048 oyunu: orijinal kurallar (4x4, %90 ihtimalle 2, %10 ihtimalle 4,
 * her taş hamle başına en fazla bir kez birleşir). Taş değerleri üs olarak tutulur
 * ve üst sınır yoktur (65536 ve ötesi de desteklenir).
 */
'use strict';

const VECTORS = [
  { dr: -1, dc: 0 }, // 0 yukarı
  { dr: 0, dc: 1 },  // 1 sağ
  { dr: 1, dc: 0 },  // 2 aşağı
  { dr: 0, dc: -1 }, // 3 sol
];
const ORDER_FWD = [0, 1, 2, 3];
const ORDER_REV = [3, 2, 1, 0];

class Game {
  constructor() {
    this.nextId = 1;
    this.reset();
  }

  reset() {
    this.grid = new Array(16).fill(null);
    this.score = 0;
    this.moves = 0;
    this.over = false;
    this.maxExp = 0;
    this.lastSpawn = null;
    this.spawn();
    this.spawn();
    this.maxExp = Math.max(...this.exps());
  }

  exps() {
    return this.grid.map((t) => (t ? t.v : 0));
  }

  /** Oyunu verilen üs dizisinden kurar (geçmiş görüntüleme için). */
  loadExps(exps, score) {
    this.grid = exps.map((v, k) => (v ? this._tile(v, k >> 2, k & 3) : null));
    this.score = score;
    this.over = !this.canMove();
    this.maxExp = Math.max(...exps);
  }

  _tile(v, r, c) {
    return { id: this.nextId++, v, r, c, prevR: null, prevC: null, mergedFrom: null, isNew: false };
  }

  /** Rastgele taş koyar; `forced` verilirse ({cell, v}) o taşı koyar, hücre doluysa null döner. */
  spawn(forced) {
    if (forced) {
      if (this.grid[forced.cell]) return null;
      const t = this._tile(forced.v, forced.cell >> 2, forced.cell & 3);
      t.isNew = true;
      this.grid[forced.cell] = t;
      this.lastSpawn = { cell: forced.cell, v: forced.v };
      return this.lastSpawn;
    }
    const empty = [];
    for (let k = 0; k < 16; k++) if (!this.grid[k]) empty.push(k);
    if (empty.length === 0) return null;
    const k = empty[Math.floor(Math.random() * empty.length)];
    const v = Math.random() < 0.9 ? 1 : 2;
    const t = this._tile(v, k >> 2, k & 3);
    t.isNew = true;
    this.grid[k] = t;
    this.lastSpawn = { cell: k, v };
    return this.lastSpawn;
  }

  /**
   * Hamle yapar. Dönen nesne: { moved, gained, merges: [üs...], spawn, desync }
   * `forced` ({cell, v}) verilirse rastgele taş yerine o taş konur (turbo modu); hücre doluysa
   * rastgele taş konur ve desync = true döner.
   */
  move(dir, forced) {
    if (this.over) return { moved: false, gained: 0, merges: [], spawn: null, desync: false };
    const { dr, dc } = VECTORS[dir];
    for (const t of this.grid) {
      if (t) {
        t.prevR = t.r;
        t.prevC = t.c;
        t.mergedFrom = null;
        t.isNew = false;
      }
    }
    const rows = dr === 1 ? ORDER_REV : ORDER_FWD;
    const cols = dc === 1 ? ORDER_REV : ORDER_FWD;

    let moved = false, gained = 0;
    const merges = [];
    for (const r of rows) {
      for (const c of cols) {
        const t = this.grid[r * 4 + c];
        if (!t) continue;
        let nr = r, nc = c;
        for (;;) {
          const tr = nr + dr, tc = nc + dc;
          if (tr < 0 || tr > 3 || tc < 0 || tc > 3 || this.grid[tr * 4 + tc]) break;
          nr = tr;
          nc = tc;
        }
        const xr = nr + dr, xc = nc + dc;
        const next = xr >= 0 && xr <= 3 && xc >= 0 && xc <= 3 ? this.grid[xr * 4 + xc] : null;
        if (next && next.v === t.v && !next.mergedFrom) {
          const merged = this._tile(t.v + 1, xr, xc);
          merged.mergedFrom = [t, next];
          this.grid[r * 4 + c] = null;
          this.grid[xr * 4 + xc] = merged;
          t.r = xr;
          t.c = xc;
          gained += Math.pow(2, merged.v);
          merges.push(merged.v);
          if (merged.v > this.maxExp) this.maxExp = merged.v;
          moved = true;
        } else if (nr !== r || nc !== c) {
          this.grid[r * 4 + c] = null;
          this.grid[nr * 4 + nc] = t;
          t.r = nr;
          t.c = nc;
          moved = true;
        }
      }
    }
    if (!moved) return { moved: false, gained: 0, merges, spawn: null, desync: false };
    this.score += gained;
    this.moves++;
    let spawn = this.spawn(forced);
    let desync = false;
    if (forced && !spawn) {
      desync = true;
      spawn = this.spawn();
    }
    if (!this.canMove()) this.over = true;
    return { moved: true, gained, merges, spawn, desync };
  }

  canMove() {
    for (let k = 0; k < 16; k++) {
      const t = this.grid[k];
      if (!t) return true;
      const r = k >> 2, c = k & 3;
      if (c < 3 && this.grid[k + 1] && this.grid[k + 1].v === t.v) return true;
      if (r < 3 && this.grid[k + 4] && this.grid[k + 4].v === t.v) return true;
    }
    return false;
  }

  /** Hamlenin geçerli olup olmadığını tahtayı değiştirmeden kontrol eder. */
  canMoveDir(dir) {
    const { dr, dc } = VECTORS[dir];
    for (let k = 0; k < 16; k++) {
      const t = this.grid[k];
      if (!t) continue;
      const r = (k >> 2) + dr, c = (k & 3) + dc;
      if (r < 0 || r > 3 || c < 0 || c > 3) continue;
      const o = this.grid[r * 4 + c];
      if (!o || o.v === t.v) return true;
    }
    return false;
  }
}

function tileValue(exp) {
  return Math.pow(2, exp);
}
