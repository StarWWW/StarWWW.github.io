// ERİME — DRUG modunda bir süre hiçbir şey yapmayınca ekran gerçekten erir.
// O an görünen ekranın birebir resmi alınır (snap.js), bir WebGL shader'ında akıtılır: piksel sütunları farklı
// hızlarda aşağı süzülür, balmumu gibi uzar, arkasında boya izi bırakır, ıslak kenarı parlar.
// Fare, klavye, dokunma ya da kaydırma → boya geri akar ve sayfa kaldığı gibi döner.
import { snapshotViewport } from './snap.js';

const VERT = `attribute vec2 p;
varying vec2 uv;
void main() { uv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `precision highp float;
varying vec2 uv;
uniform sampler2D tex;
uniform vec2 res;
uniform float m;
uniform float time;
uniform float crop;
uniform float px;

float h1(float n) { return fract(sin(n * 127.1) * 43758.5453); }
float n1(float x) { float i = floor(x); float f = fract(x); f = f * f * (3. - 2. * f); return mix(h1(i), h1(i + 1.), f); }
float fbm(float x) { return .5 * n1(x) + .3 * n1(x * 2.1 + 7.3) + .2 * n1(x * 4.3 + 1.7); }
vec3 hue(vec3 c, float a) {
  const vec3 k = vec3(.57735);
  float ca = cos(a);
  return c * ca + cross(k, c) * sin(a) + k * dot(k, c) * (1. - ca);
}
vec3 samp(vec2 q) { return texture2D(tex, vec2(clamp(q.x, 0., 1.) * crop, clamp(q.y, 0., 1.))).rgb; }

void main() {
  vec2 p = uv * res;
  float col = floor(p.x / px);                    // piksel sütunları (8-bit his)
  float x = col * px / res.x;
  float broad = fbm(x * 3.4 + 3.);                // geniş, yavaş akıntılar
  float drip = pow(n1(x * 22. + 11.), 6.);        // ince, hızlı damlalar (yuvarlak uçlu)
  float lag = .2 * n1(x * 1.9 + 4.);             // bazı yerler geç başlar
  float mm = max(0., m - lag);
  float d = pow(mm, 1.6) * (.05 + 1.1 * pow(broad, 1.4)) + pow(mm, 1.4) * 1.3 * drip;   // kayma (ekran yüksekliği cinsinden)
  float stretch = .42 + .58 * uv.y;               // balmumu gibi uzama: aşağısı daha çok kayar
  float sy = uv.y - d * stretch;
  float wob = sin(uv.y * 18. + time * 2.2) * .0016 * min(1., m * 2.);
  // ekrandan taşacak boya altta bir gölcükte toplanır
  float pz = min(.24, d * .3);
  float yTop = 1. - pz;
  float f = 0.;
  if (pz > .002 && uv.y > yTop) {
    f = (uv.y - yTop) / pz;
    float syTop = yTop - d * (.42 + .58 * yTop);
    sy = mix(syTop, 1., pow(f, .55));
    wob += sin(f * 14. - time * 3. + x * 40.) * .004;
  }
  vec2 sp = vec2(uv.x + wob, sy);

  vec3 bg = vec3(.02, .016, .035);
  float grid = max(step(fract(p.x / 48.), 1. / 48.), step(fract(p.y / 48.), 1. / 48.));
  bg += vec3(.6, .9, .31) * .06 * grid;

  vec3 c;
  if (sy < 0.) {
    // içeriğin geçtiği yerde kalan boya izi: üstteki renkler aşağı sürüklenmiş gibi
    float edgeY = d * .42;
    float tail = clamp(-sy / max(edgeY, .015), 0., 1.);
    vec3 smear = samp(vec2(uv.x, .015 + uv.y * .25));
    float keep = .22 + .78 * drip + .35 * broad;
    float k = 1. - smoothstep(0., keep, tail);
    vec3 streak = mix(smear, hue(smear, time * .9 + uv.y * 4.), .5) * (.55 + .45 * k);
    c = mix(bg, streak, k * k * .9);
    c += vec3(1.) * .2 * step(tail, .01 + .02 * drip) * step(.01, d);   // ince ıslak çizgi
  } else {
    float ca = .0045 * min(1., m * 1.4);
    c = vec3(samp(sp + vec2(ca, 0.)).r, samp(sp).g, samp(sp - vec2(ca, 0.)).b);
    float e = 1. - smoothstep(0., .018, sy);       // ön kenardaki parlama (ıslak boya)
    c += e * .28 * step(.004, d);
    c *= 1. - smoothstep(0., 1.2, d) * .2;
    c = mix(c, hue(c, time * .6 + uv.y * 2.5), clamp(d * .5, 0., .4));
    if (f > 0.) {                                  // gölcük: parlak üst çizgi + karışan renkler
      c = mix(c, hue(c, time * 1.2 + f * 3.), .35 * f);
      c += vec3(1.) * .22 * (1. - smoothstep(0., .06, f));
    }
  }
  gl_FragColor = vec4(c, 1.);
}`;

export function createMelt() {
  let cv = null; let gl = null; let prog = null; let texObj = null; let U = {};
  let raf = 0; let m = 0; let r0 = 0; let r0t = 0; let t0 = 0; let state = 'off'; let token = 0;
  let onDone = null;

  function setup() {
    if (gl) return true;
    cv = document.createElement('canvas');
    cv.className = 'melt-gl';
    cv.setAttribute('aria-hidden', 'true');
    gl = cv.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false })
      || cv.getContext('experimental-webgl');
    if (!gl) return false;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['tex', 'res', 'm', 'time', 'crop', 'px'].forEach((k) => { U[k] = gl.getUniformLocation(prog, k); });
    texObj = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texObj);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(U.tex, 0);
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); hide(); gl = null; cv.remove(); cv = null; });
    return true;
  }

  function render(now) {
    if (!gl) return;
    gl.viewport(0, 0, cv.width, cv.height);
    gl.uniform2f(U.res, cv.clientWidth || cv.width, cv.clientHeight || cv.height);
    gl.uniform1f(U.m, m);
    gl.uniform1f(U.time, (now - t0) / 1000);
    gl.uniform1f(U.px, 3);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function loop(now) {
    raf = 0;
    if (state === 'melting') {
      // yavaş başlar, hızlanır; ~12 sn sonra durur
      const t = (now - t0) / 1000;
      m = Math.min(1.2, t / 10);
    } else if (state === 'reform') {
      // süreye bağlı (kare hızı düşse de ~0.45 sn'de biter)
      const k = Math.min(1, (now - r0t) / 450);
      m = r0 * (1 - k) * (1 - k);
      if (k >= 1) { hide(); return; }
    }
    render(now);
    if (state === 'melting' && m >= 1.2) return; // tamamen eridi, sabit kal
    raf = requestAnimationFrame(loop);
  }

  function hide() {
    cancelAnimationFrame(raf); raf = 0;
    state = 'off'; m = 0;
    if (cv) cv.remove();
    const cb = onDone; onDone = null;
    cb?.();
  }

  // ekranı yakala ve erimeye başla; olmazsa false (çağıran yedek efekti kullanır)
  async function start({ cancelled = () => false } = {}) {
    if (state !== 'off') return true;
    const my = ++token;
    try {
      if (!setup()) return false;
      // doku boyutu ekran kartının sınırını aşmasın (geniş monitörler)
      const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
      const scale = Math.min(2, window.devicePixelRatio || 1, maxTex / window.innerWidth, maxTex / window.innerHeight);
      const shot = await snapshotViewport({ scale });
      if (my !== token || cancelled()) return true;
      gl.bindTexture(gl.TEXTURE_2D, texObj);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, shot.img);
      gl.uniform1f(U.crop, shot.width / shot.fullWidth);
      const dpr = Math.min(1.5, window.devicePixelRatio || 1);
      cv.width = Math.round(shot.width * dpr); cv.height = Math.round(shot.height * dpr);
      document.body.append(cv);
      state = 'melting'; m = 0; t0 = performance.now();
      render(t0);
      raf = requestAnimationFrame(loop);
      return true;
    } catch (err) {
      console.warn('[erime]', err?.message || err);
      hide();
      return false;
    }
  }

  // boya geri akar, sayfa döner
  function stop(cb) {
    token++;
    if (state === 'off') { cb?.(); return; }
    onDone = cb || null;
    if (document.hidden || state === 'reform') { if (document.hidden) hide(); return; }
    state = 'reform'; r0 = m; r0t = performance.now();
    if (!raf) raf = requestAnimationFrame(loop);
  }

  return { start, stop, active: () => state !== 'off', _frame: (v) => { m = v; render(performance.now()); } };
}
