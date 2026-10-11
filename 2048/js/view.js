/*
 * Tahta görünümü: CSS geçişleriyle kayma, birleşme ve belirme animasyonları.
 */
'use strict';

function formatNumber(n) {
  return Math.round(n).toLocaleString('tr-TR');
}

function formatCompact(n) {
  const a = Math.abs(n);
  if (a >= 1e6) return (n / 1e6).toLocaleString('tr-TR', { maximumFractionDigits: 2 }) + ' Mn';
  if (a >= 1e4) return (n / 1e3).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' B';
  return formatNumber(n);
}

function tileClass(v) {
  return v <= 17 ? `t-${v}` : 't-super';
}

function tileText(v) {
  return String(Math.pow(2, v));
}

class BoardView {
  constructor(root) {
    this.root = root;
    this.animMs = 110;
    root.classList.add('board');
    const cells = document.createElement('div');
    cells.className = 'board-cells';
    for (let i = 0; i < 16; i++) {
      const c = document.createElement('div');
      c.className = 'board-cell';
      cells.appendChild(c);
    }
    this.layer = document.createElement('div');
    this.layer.className = 'board-tiles';
    root.append(cells, this.layer);
  }

  setAnimation(ms) {
    this.animMs = ms;
    this.root.style.setProperty('--anim', `${ms}ms`);
    this.root.classList.toggle('no-anim', ms <= 0);
  }

  _el(v, r, c, extra) {
    const el = document.createElement('div');
    const text = tileText(v);
    el.className = `tile ${tileClass(v)}${extra ? ' ' + extra : ''}`;
    el.dataset.digits = String(text.length);
    el.style.setProperty('--r', r);
    el.style.setProperty('--c', c);
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    return el;
  }

  /** Oyunun anlık durumunu çizer; animate=true ise son hamlenin hareketlerini canlandırır. */
  render(game, animate) {
    const anim = animate && this.animMs > 0;
    const frag = document.createDocumentFragment();
    const moves = [];
    for (const t of game.grid) {
      if (!t) continue;
      if (anim && t.mergedFrom) {
        for (const src of t.mergedFrom) {
          const el = this._el(src.v, src.prevR, src.prevC, 'moving');
          frag.appendChild(el);
          moves.push([el, t.r, t.c]);
        }
        frag.appendChild(this._el(t.v, t.r, t.c, 'merged'));
      } else if (anim && t.prevR !== null && (t.prevR !== t.r || t.prevC !== t.c)) {
        const el = this._el(t.v, t.prevR, t.prevC, 'moving');
        frag.appendChild(el);
        moves.push([el, t.r, t.c]);
      } else {
        frag.appendChild(this._el(t.v, t.r, t.c, anim && t.isNew ? 'new' : ''));
      }
    }
    this.layer.replaceChildren(frag);
    if (moves.length) {
      void this.layer.offsetWidth; // başlangıç konumlarını uygula, sonra geçişi başlat
      for (const [el, r, c] of moves) {
        el.style.setProperty('--r', r);
        el.style.setProperty('--c', c);
      }
    }
  }

  /** Üs dizisinden animasyonsuz çizim (geçmiş görüntüleme). */
  renderExps(exps) {
    const frag = document.createDocumentFragment();
    exps.forEach((v, k) => {
      if (v) frag.appendChild(this._el(v, k >> 2, k & 3, ''));
    });
    this.layer.replaceChildren(frag);
  }
}

/** Küçük statik tahta (hamle önizlemeleri için). */
function renderMiniBoard(el, exps) {
  if (!el._cells) {
    el.classList.add('mini-board');
    el._cells = [];
    for (let i = 0; i < 16; i++) {
      const c = document.createElement('div');
      el.appendChild(c);
      el._cells.push(c);
    }
  }
  for (let k = 0; k < 16; k++) {
    const c = el._cells[k];
    const v = exps ? exps[k] : 0;
    c.className = v ? `mini-tile ${tileClass(v)}` : 'mini-tile empty';
    c.textContent = v ? (v >= 10 ? (Math.pow(2, v) / 1024) + 'k' : tileText(v)) : '';
  }
}
