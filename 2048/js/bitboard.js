/*
 * Bitboard 2048 motoru (ana iş parçacığı ve Web Worker'lar tarafından paylaşılır).
 *
 * Tahta iki adet 32-bit tamsayı ile tutulur:
 *   hi = satır 0-1 (hücre 0..7), lo = satır 2-3 (hücre 8..15)
 * Hücre k'nın değeri 4 bitlik bir üsdür (0 = boş, n = 2^n). Rust eğiticisindeki
 * 64-bit düzenle birebir aynıdır: hi alt 32 bit, lo üst 32 bit.
 * Yönler: 0 yukarı, 1 sağ, 2 aşağı, 3 sol.
 */
'use strict';

var ROW_LEFT = new Uint16Array(65536);
var ROW_RIGHT = new Uint16Array(65536);
var SCORE_LEFT = new Float64Array(65536);
var SCORE_RIGHT = new Float64Array(65536);
var ROW_MAX = new Uint8Array(65536);
var MOVE_OUT = new Int32Array(2);

(function buildTables() {
  var t = [0, 0, 0, 0];
  for (var line = 0; line < 65536; line++) {
    var n = 0;
    for (var i = 0; i < 4; i++) {
      var v = (line >> (4 * i)) & 15;
      if (v) t[n++] = v;
    }
    var out = 0, o = 0, score = 0, j = 0;
    while (j < n) {
      // 32768 + 32768 bir nibble'a sığmaz: motor bu birleşmeyi yapmaz (Rust ile aynı).
      if (j + 1 < n && t[j] === t[j + 1] && t[j] < 15) {
        out |= (t[j] + 1) << (4 * o);
        score += 1 << (t[j] + 1);
        j += 2;
      } else {
        out |= t[j] << (4 * o);
        j += 1;
      }
      o++;
    }
    ROW_LEFT[line] = out;
    SCORE_LEFT[line] = score;
    ROW_MAX[line] = Math.max((line >> 12) & 15, (line >> 8) & 15, (line >> 4) & 15, line & 15);
  }
  for (var l = 0; l < 65536; l++) {
    var rev = reverseLine(l);
    ROW_RIGHT[l] = reverseLine(ROW_LEFT[rev]);
    SCORE_RIGHT[l] = SCORE_LEFT[rev];
  }
})();

function reverseLine(l) {
  return ((l >> 12) | ((l >> 4) & 0x00f0) | ((l << 4) & 0x0f00) | (l << 12)) & 0xffff;
}

/**
 * Hamleyi uygular. Geçersizse -1, geçerliyse kazanılan puanı döndürür;
 * yeni tahta MOVE_OUT[0] (hi) ve MOVE_OUT[1] (lo) içine yazılır.
 */
function moveBoard(hi, lo, dir) {
  var r0 = hi & 0xffff, r1 = hi >>> 16, r2 = lo & 0xffff, r3 = lo >>> 16;
  var n0 = 0, n1 = 0, n2 = 0, n3 = 0, score = 0;
  if (dir === 3) {
    n0 = ROW_LEFT[r0]; n1 = ROW_LEFT[r1]; n2 = ROW_LEFT[r2]; n3 = ROW_LEFT[r3];
    score = SCORE_LEFT[r0] + SCORE_LEFT[r1] + SCORE_LEFT[r2] + SCORE_LEFT[r3];
  } else if (dir === 1) {
    n0 = ROW_RIGHT[r0]; n1 = ROW_RIGHT[r1]; n2 = ROW_RIGHT[r2]; n3 = ROW_RIGHT[r3];
    score = SCORE_RIGHT[r0] + SCORE_RIGHT[r1] + SCORE_RIGHT[r2] + SCORE_RIGHT[r3];
  } else {
    var T = dir === 0 ? ROW_LEFT : ROW_RIGHT;
    var S = dir === 0 ? SCORE_LEFT : SCORE_RIGHT;
    for (var c = 0; c < 16; c += 4) {
      var line = ((r0 >> c) & 15) | (((r1 >> c) & 15) << 4) | (((r2 >> c) & 15) << 8) | (((r3 >> c) & 15) << 12);
      var m = T[line];
      score += S[line];
      n0 |= (m & 15) << c;
      n1 |= ((m >> 4) & 15) << c;
      n2 |= ((m >> 8) & 15) << c;
      n3 |= ((m >> 12) & 15) << c;
    }
  }
  var nh = n0 | (n1 << 16), nl = n2 | (n3 << 16);
  if (nh === hi && nl === lo) return -1;
  MOVE_OUT[0] = nh;
  MOVE_OUT[1] = nl;
  return score;
}

/** 32 bitlik yarıdaki boş hücreler: hücre k boşsa bit 4k set edilir. */
function emptyMask(x) {
  return ~(x | (x >>> 1) | (x >>> 2) | (x >>> 3)) & 0x11111111;
}

function popcount32(x) {
  x = x - ((x >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24);
}

/** 16 elemanlı üs dizisini (satır öncelikli) hi/lo çiftine çevirir. 15'ten büyük üsler 15'e sabitlenir. */
function expsToBoard(exps) {
  var hi = 0, lo = 0;
  for (var k = 0; k < 16; k++) {
    var v = exps[k] > 15 ? 15 : exps[k];
    if (k < 8) hi |= v << (4 * k);
    else lo |= v << (4 * (k - 8));
  }
  return [hi | 0, lo | 0];
}

function boardToExps(hi, lo) {
  var out = new Array(16);
  for (var k = 0; k < 8; k++) {
    out[k] = (hi >>> (4 * k)) & 15;
    out[k + 8] = (lo >>> (4 * k)) & 15;
  }
  return out;
}
