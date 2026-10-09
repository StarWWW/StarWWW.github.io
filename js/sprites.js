// 8-bit sprite'lar: her karakter bir piksel, renkler DB32 paletinden.
export const PAL = {
  k: '#222034', w: '#FFFFFF', p: '#F2EEE3', g: '#99E550', o: '#DF7126', m: '#D77BBA', c: '#5FCDE4',
  y: '#FBF236', s: '#CAB39D', z: '#9BADB7', r: '#AC3232', d: '#4B692F', b: '#000000', n: '#3F3F74',
  u: '#8F563B', v: '#663931',
};

export const SPRITES = {
  cursor: ['k...........', 'kk..........', 'kwk.........', 'kwwk........', 'kwwwk.......', 'kwwwwk......', 'kwwwwwk.....', 'kwwwwwwk....', 'kwwwwwwwk...', 'kwwwwwwwwk..', 'kwwwwwwwwwk.', 'kwwwwwwkkkkk', 'kwwwkwwk....', 'kwwk.kwwk...', 'kwk..kwwk...', 'kk....kwwk..', 'k.....kwwk..', '.......kk...'],
  sparkle: ['...k...', '...k...', '..kyk..', 'kkyyykk', '..kyk..', '...k...', '...k...'],
  star: ['....k....', '...kgk...', '...kgk...', 'kkkkgkkkk', '.kgggggk.', '..kgggk..', '..kgkgk..', '.kgk.kgk.', '.kk...kk.'],
  spray: ['....kk....', '...kggk.m.', '...kkkk..m', '..kzzzzk..', '.kkkkkkkk.', '.kowooook.', '.kowooook.', '.kkkkkkkk.', '.kggggggk.', '.kgkkgkgk.', '.kggggggk.', '.kkkkkkkk.', '.kowooook.', '.kowooook.', '.kkkkkkkk.'],
  pad: ['..kkkkkkkkkkkk..', '.kzzzzzzzzzzzzk.', 'kzzkzzzzzzzzozzk', 'kzkkkzzzzzzozgzk', 'kzzkzzzkkzzzmzzk', 'kzzzzzzzzzzzzzzk', 'kzzzzkkkkkkzzzzk', '.kzzk......kzzk.', '..kk........kk..'],
  jet: ['....kkkkkkkk....', '...kggggggggk...', '.kkgkgkkgkgggk..', 'kokggggggggggk..', '.kkkkkkkkkkkkkk.', '.kssssssssssssk.', '.kssssssssssssk.', '.kskkksssskkksk.', '.kssssssssssssk.', '.ksssskkkkssssk.', '.ksssskwwkssssk.', '.ksssskkkkssssk.', '..kssssssssssk..', '....kkkkkkkk....', '......kssk......', '..ookwwwwwwkoo..', '..ookwzwwzwkoo..', '..ookwwwwwwkoo..', '..kkkkkkkkkkkk..'],
  flame: ['..yy........yy..', '..oy........yo..', '..ro........or..', '...r........r...'],
  flame2: ['..oy........yo..', '..yy........yy..', '...o........o...', '................'],
  bug: ['..k...k..', '...kkk...', '..kmkmk..', 'k.kkkkk.k', '.kkrkrkk.', 'k.krkrk.k', '.kkrkrkk.', 'k.kkkkk.k', '...k.k...'],
  bug2: ['.k.....k.', '..k.k.k..', '..kmkmk..', '.kkkkkkk.', 'k.krkrk.k', '.kkrkrkk.', 'k.krkrk.k', '.kkkkkkk.', '..k...k..'],
  trophy: ['..kkkkkkkk..', 'kkkyyyyyykkk', 'k.kyywyyyk.k', 'k.kyywyyyk.k', '.kkyyyyyykk.', '...kyyyyk...', '....kyyk....', '.....kk.....', '....kyyk....', '...kkkkkk...', '...kyyyyk...', '...kkkkkk...'],
  lock: ['..kkkk..', '.k....k.', '.k....k.', 'kkkkkkkk', 'kzzzzzzk', 'kzzkkzzk', 'kzzkkzzk', 'kkkkkkkk'],
  hammer: ['kkkkkkkkkk', 'kzwzzzzzzk', 'kzzzzzzzzk', 'kkkkookkkk', '....kok...', '....kok...', '....kok...', '....kok...', '....kok...', '....kkk...'],
  gbomb: ['.......ky.', '......k.y.', '.....k....', '...kkkkk..', '..kmmcccck', '.kmwmcccck', '.kmmmcccck', '.kmmmcccck', '..kmmccck.', '...kkkkk..'],
  chat: ['.kkkkkkkkkk.', 'kcccccccccck', 'kccwccccwcck', 'kccwccccwcck', 'kcccccccccck', 'kcccwwwwccck', '.kkkkkkkkkk.', '..kck.......', '..kk........'],
  cross: ['...kkk...', '...kgk...', '...kgk...', 'kkkk.kkkk', 'kggg.gggk', 'kkkk.kkkk', '...kgk...', '...kgk...', '...kkk...'],
  skull: ['..kkkkkk..', '.kwwwwwwk.', 'kwwwwwwwwk', 'kwkkwwkkwk', 'kwkkwwkkwk', 'kwwwkkwwwk', '.kwwwwwwk.', '..kwkwkk..', '..kkkkkk..'],
  battery: ['.kkkkkk.', 'kkggggkk', 'kggggggk', 'kggwgggk', 'kggggggk', 'kggggggk', 'kggggggk', 'kkkkkkkk'],
  // envanter kategori ikonları (10x10)
  term: ['kkkkkkkkkk', 'kokykgkzzk', 'kkkkkkkkkk', 'kbbbbbbbbk', 'kbgbbbbbbk', 'kbbgbbbbbk', 'kbgbbggbbk', 'kbbbbbbbbk', 'kbbbbbbbbk', 'kkkkkkkkkk'],
  globe: ['...kkkk...', '..kcckck..', '.kccckcck.', 'kkkkkkkkkk', 'kcckccckck', 'kcckccckck', 'kkkkkkkkkk', '.kcckccck.', '..kckcck..', '...kkkk...'],
  db: ['.kkkkkkkk.', 'kooooooook', 'kkkkkkkkkk', 'kooooooook', 'kowooooook', 'kkkkkkkkkk', 'kooooooook', 'kowooooook', 'kkkkkkkkkk', '.kkkkkkkk.'],
  wrench: ['......kkk.', '.....kzzk.', '.....kzk..', '....kzzk.k', '...kzzzkzk', '..kzzzzzk.', '.kzzzkkk..', 'kzzzk.....', 'kzzk......', '.kk.......'],
  brush: ['.......kk.', '......kmk.', '.....kmk..', '....kmk...', '...kzk....', '..kzk.....', '.kook.....', 'kooook....', 'koook.....', '.kkk......'],
  cookie: ['..kkkkk...', '.ksssssk..', 'kssusssskk', 'ksssssuk..', 'kssssssk..', 'ksuss.sskk', 'ksssssussk', '.ksusssssk', '..kkkkkkk.'],
  note: ['...kk...', '...kck..', '...kcck.', '...kkcck', '...k.kck', '...k..kk', '...k....', '.kkk....', 'kyyyk...', 'kyyyk...', '.kkk....'],
  grass: ['kkkkkkkkkk', 'kggggdgggk', 'kgdggggdgk', 'kdgdguudgk', 'kuuvuuuuuk', 'kuuuuuvuuk', 'kuvuuuuuuk', 'kuuuuvuuuk', 'kuuuuuuuvk', 'kkkkkkkkkk'],
};

function rows(name) {
  const r = SPRITES[name];
  if (!r) throw new Error(`sprite yok: ${name}`);
  const w = Math.max(...r.map((x) => x.length));
  return { r: r.map((x) => x.padEnd(w, '.')), w, h: r.length };
}

export function spriteSVG(name, scale = 1) {
  const { r, w, h } = rows(name);
  let rects = '';
  r.forEach((row, y) => {
    for (let x = 0; x < w;) {
      const ch = row[x];
      if (ch === '.') { x++; continue; }
      const x0 = x;
      while (x < w && row[x] === ch) x++;
      rects += `<rect x="${x0}" y="${y}" width="${x - x0}" height="1" fill="${PAL[ch]}"/>`;
    }
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
}

export const spriteURI = (name, scale = 1) => `data:image/svg+xml,${encodeURIComponent(spriteSVG(name, scale))}`;

const canvasCache = new Map();
export function spriteCanvas(name, scale = 1) {
  const key = `${name}@${scale}`;
  if (canvasCache.has(key)) return canvasCache.get(key);
  const { r, w, h } = rows(name);
  const c = document.createElement('canvas');
  c.width = w * scale; c.height = h * scale;
  const ctx = c.getContext('2d');
  r.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    ctx.fillStyle = PAL[ch];
    ctx.fillRect(x * scale, y * scale, scale, scale);
  }));
  canvasCache.set(key, c);
  return c;
}

// <span class="spr" data-sprite="star" data-scale="3"> yer tutucularını doldurur
export function hydrateSprites(root = document) {
  root.querySelectorAll('.spr[data-sprite]:not([data-done])').forEach((el) => {
    el.innerHTML = spriteSVG(el.dataset.sprite, Number(el.dataset.scale) || 2);
    el.dataset.done = '1';
  });
}
