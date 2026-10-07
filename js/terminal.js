import { $, esc, API, copyText, toast } from './util.js';
import { t, getLang, setLang } from './i18n.js';
import { CONFIG, hasSupabase } from './config.js';

const en = () => getLang() === 'en';
const L = (tr, enS) => (en() ? enS : tr);

const FILES = {
  'about.txt': () => L(
    'star — 21 — bilgisayar mühendisliği öğrencisi.\nUltraTurk\'ün baş geliştiricisi ve çevirmeni.\noyun oynar, müzik dinler, piksel çizer.',
    'star — 21 — computer engineering student.\nlead developer & translator of UltraTurk.\nplays games, listens to music, draws pixels.'),
  'cow.txt': () => L('C.O.W. = ????\ndosya boş. hiçbir anlamı yok. sorma.', 'C.O.W. = ????\nfile is empty. it means nothing. don\'t ask.'),
  'readme.md': () => L(
    '# dijital oda\n- duvara sprey sık (herkes görür, pazartesi silinir)\n- deftere not bırak\n- mp3 çalarda müzik dinle\n- oyun rafındaki kutuları aç\n- ...ve belki daha fazlası',
    '# digital room\n- spray the wall (everyone sees it, wiped on mondays)\n- leave a note in the guestbook\n- listen on the mp3 player\n- open the cases on the game shelf\n- ...and maybe more'),
  'secret.txt': () => '↑ ↑ ↓ ↓ ← → ← → B A',
  'ultraturk.txt': () => L(
    'ULTRATURK — ULTRAKILL için dublajlı Türkçe yama\nrol: baş geliştirici + çevirmen · ekip: star, sstoney\nthunderstore.io/c/ultrakill/p/UltraTurk/UltraTurk',
    'ULTRATURK — dubbed Turkish translation for ULTRAKILL\nrole: lead developer + translator · team: star, sstoney\nthunderstore.io/c/ultrakill/p/UltraTurk/UltraTurk'),
};

const DIRS = { oda: 'oda', room: 'oda', projeler: 'projeler', projects: 'projeler', envanter: 'envanter', inventory: 'envanter', skills: 'envanter', raf: 'raf', games: 'raf', shelf: 'raf', muzik: 'muzik', müzik: 'muzik', music: 'muzik', duvar: 'duvar', wall: 'duvar', iletisim: 'iletisim', contact: 'iletisim', '~': 'top', '..': 'top', top: 'top' };

export function initTerminal() {
  const term = $('#terminal');
  const out = $('#termOut');
  const input = $('#termInput');
  const form = $('#termForm');
  if (!term) return;
  const history = [];
  let hIdx = 0;
  let opened = false;
  let lastFocus = null;

  const print = (html, cls = '') => {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.innerHTML = html;
    out.append(d);
    out.scrollTop = out.scrollHeight;
  };
  const say = (text, cls = '') => print(esc(text), cls);

  function open() {
    lastFocus = document.activeElement;
    if (term.hidden) API.sfx?.play('open');
    term.hidden = false;
    if (!opened) {
      opened = true;
      say(L('star@oda gizli terminaline hoş geldin. "help" yaz.', 'welcome to star@room\'s hidden terminal. type "help".'), 'ok');
    }
    setTimeout(() => input.focus(), 0);
  }
  function close() {
    if (!term.hidden) API.sfx?.play('close');
    term.hidden = true;
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  }
  const toggle = () => (term.hidden ? open() : close());

  const goto = (id) => {
    close();
    if (API.fx?.scrollTo) API.fx.scrollTo(`#${id}`); else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  const COMMANDS = {
    help() {
      say(L('komutlar:', 'commands:'), 'y');
      say('  whoami · ls · cat <dosya> · cd <bölüm> · games · music · play [n] · pause · next · prev');
      say('  spray · drug · real · lang tr|en · fx tam|az · vol 0-10 · ses aç|kapat|0-10 · cowsay <yazı> · github · discord');
      say('  date · echo · history · clear · exit · login · admin', 'd');
    },
    whoami() {
      say(L('kimlik ..... star  /  seviye ..... 21', 'id ..... star  /  level ..... 21'));
      say(L('sınıf ...... bilgisayar mühendisi (çırak)', 'class ...... computer engineer (apprentice)'));
      say(L('ana görev .. UltraTurk (baş geliştirici + çevirmen)', 'main quest .. UltraTurk (lead dev + translator)'));
      print(`${esc(L('konum', 'location'))} ..... <span class="err">[${esc(L('GİZLİ', 'CLASSIFIED'))}]</span>`);
    },
    ls(args) {
      const d = (args[0] || '').replace(/\/$/, '');
      if (d === 'projects' || d === 'projeler' || d === './projects') {
        const repos = [...document.querySelectorAll('#repoList .repo-row a')].map((a) => a.textContent);
        print(`<span class="y">${['ultraturk/', '2048/', ...repos].map(esc).join('   ')}</span>`);
        return;
      }
      print(`<span class="y">projects/  games/  music/  wall/</span>   about.txt  cow.txt  readme.md  ultraturk.txt  <span class="d">.secret.txt</span>`);
    },
    cat(args) {
      const f = (args[0] || '').replace(/^\.\//, '').replace(/^\./, '');
      if (!f) return say(L('kullanım: cat <dosya>', 'usage: cat <file>'), 'err');
      const fn = FILES[f];
      if (!fn) return say(`cat: ${f}: ${L('böyle bir dosya yok', 'no such file')}`, 'err');
      fn().split('\n').forEach((l) => say(l));
    },
    cd(args) {
      const id = DIRS[(args[0] || '~').toLowerCase()];
      if (!id) return say(`cd: ${args[0]}: ${L('böyle bir bölüm yok', 'no such section')}`, 'err');
      goto(id);
    },
    games() {
      const list = API.games?.list() || [];
      if (!list.length) return say(L('raf boş', 'shelf is empty'), 'd');
      list.forEach((g, i) => print(`${String(i + 1).padStart(2, '0')}  <span class="y">${esc(g.name)}</span>  <span class="d">${esc(String(g.released || '').slice(0, 4))}${g.now_playing ? ` · ${esc(t('gm.now'))}` : ''}</span>`));
    },
    music() {
      const list = API.music?.list() || [];
      const c = API.music?.current();
      list.forEach((tr, i) => print(`${String(i + 1).padStart(2, '0')}  ${tr === c ? '<span class="ok">▶</span>' : ' '} <span class="y">${esc(tr.title)}</span> — ${esc(tr.artist)}`));
      say(L('"play 2" ile çal', 'use "play 2" to play'), 'd');
    },
    np() { const c = API.music?.current(); say(c ? `♪ ${c.title} — ${c.artist}${API.music.isPlaying() ? '' : L(' (duraklatıldı)', ' (paused)')}` : '—'); },
    play(args) { API.music?.play(args[0] ? Number(args[0]) : undefined); setTimeout(() => COMMANDS.np(), 300); },
    pause() { API.music?.pause(); say('❚❚'); },
    next() { API.music?.next(); setTimeout(() => COMMANDS.np(), 300); },
    prev() { API.music?.prev(); setTimeout(() => COMMANDS.np(), 300); },
    ses(args) {
      const a = (args[0] || '').toLowerCase();
      const on = { aç: true, ac: true, on: true, açık: true, kapat: false, kapa: false, off: false, kapalı: false };
      if (!API.sfx) return say(L('ses efektleri yüklenmedi', 'sound effects are not loaded'), 'err');
      if (/^\d+$/.test(a)) API.sfx.volume(Math.min(10, Number(a)));
      else if (a in on) API.sfx.set(on[a]); else if (!a) API.sfx.toggle();
      else return say(L('kullanım: ses aç | ses kapat | ses 0-10', 'usage: sfx on | sfx off | sfx 0-10'), 'd');
      const lv = API.sfx.volume();
      say(API.sfx.enabled() ? `${L('ses efektleri açık ♪', 'sound effects on ♪')}  ${'▮'.repeat(lv)}${'▯'.repeat(10 - lv)}` : L('ses efektleri kapalı', 'sound effects off'), 'ok');
    },
    vol(args) {
      if (!API.music) return say('—', 'd');
      if (args[0] === 'mute' || args[0] === 'sessiz') { API.music.mute(); return say(L('ses aç/kapa', 'mute toggled'), 'ok'); }
      const n = Number(args[0]);
      if (!args.length || Number.isNaN(n)) return say(`vol ${API.music.volume()} / 10 — ${L('kullanım: vol 0-10 | vol mute', 'usage: vol 0-10 | vol mute')}`, 'd');
      API.music.volume(n);
      say(`vol ${API.music.volume()} / 10 ${'▮'.repeat(API.music.volume())}${'▯'.repeat(10 - API.music.volume())}`, 'ok');
    },
    spray() { close(); API.wall?.focus(); },
    drug() { if (document.documentElement.dataset.mode !== 'drug') API.flipMode?.(); say(L('hapı yuttun.', 'you took the pill.'), 'ok'); },
    real() { if (document.documentElement.dataset.mode === 'drug') API.flipMode?.(); say(L('gerçekliğe dönüldü.', 'back to reality.'), 'ok'); },
    fx(args) {
      const want = (args[0] || '').toLowerCase();
      const map = { tam: 'full', full: 'full', on: 'full', az: 'reduce', low: 'reduce', off: 'reduce' };
      if (!map[want]) return say(`fx ${document.documentElement.dataset.motion === 'reduce' ? 'az' : 'tam'} — ${L('kullanım: fx tam | fx az', 'usage: fx full | fx low')}`, 'd');
      say(L('animasyonlar ayarlanıyor, sayfa yenileniyor...', 'adjusting animations, reloading...'), 'ok');
      setTimeout(() => { try { localStorage.setItem('star.motion', map[want]); sessionStorage.setItem('star.booted', '1'); } catch { /* yok */ } location.reload(); }, 400);
    },
    lang(args) { const l = (args[0] || '').toLowerCase(); if (l !== 'tr' && l !== 'en') return say('lang tr | lang en', 'err'); setLang(l); say(`lang = ${l}`, 'ok'); },
    destroy() { close(); API.startGame?.(); },
    trip() {
      if (document.documentElement.dataset.mode !== 'drug') { say(L('önce hapı yut. (drug)', 'take the pill first. (drug)'), 'err'); return; }
      const [n, total] = API.drug?.count?.() || [0, 13];
      say(L(`sırlar: ${n}/${total}`, `secrets: ${n}/${total}`), 'y');
      (API.drug?.list?.() || []).forEach((e) => print(e.found ? `<span class="ok">✓ ${esc(e.name)}</span>` : `<span class="d">? ??? — ${esc(e.hint)}</span>`));
    },
    uyan() { if (!API.drug?.trigger('uyan')) say(L('rüya görmüyorsun. henüz.', 'you are not dreaming. yet.'), 'd'); else close(); },
    ters() { if (!API.drug?.trigger('ters')) say(L('dünya zaten ters.', 'the world is already upside down.'), 'd'); else close(); },
    asit() { if (!API.drug?.trigger('asit')) say(L('kimya dersi değil bu.', 'this is not chemistry class.'), 'd'); else close(); },
    konami() { COMMANDS.destroy(); },
    cowsay(args) {
      const msg = args.join(' ') || 'C.O.W.';
      const line = '-'.repeat(msg.length + 2);
      say(` ${line}\n< ${msg} >\n ${line}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`);
    },
    github() { print(`<a href="https://github.com/${CONFIG.githubUser}" target="_blank" rel="noopener">github.com/${CONFIG.githubUser}</a>`); },
    discord() { copyText(CONFIG.discord).then(() => toast(t('ft.copied'))); say(`discord: ${CONFIG.discord} ${L('(kopyalandı)', '(copied)')}`, 'ok'); },
    date() { say(new Date().toLocaleString(en() ? 'en-GB' : 'tr-TR')); },
    echo(args) { say(args.join(' ')); },
    history() { history.forEach((h, i) => say(`${String(i + 1).padStart(3, ' ')}  ${h}`)); },
    clear() { out.innerHTML = ''; },
    exit() { close(); },
    sudo(args) {
      if (args.join(' ').startsWith('rm -rf')) {
        say(`[sudo] ${L('star için parola', 'password for star')}: ********`);
        setTimeout(() => say(L('güzel denemeydi. bu olay rapor edilecek.', 'nice try. this incident will be reported.'), 'err'), 600);
        return;
      }
      say(L('star sudoers dosyasında değil. ', 'star is not in the sudoers file. ') + L('(ironik)', '(ironic)'), 'err');
    },
    rm(args) { if (args.includes('-rf')) return COMMANDS.sudo(['rm', '-rf']); say(L('rm: izin reddedildi', 'rm: permission denied'), 'err'); },
    selam() { say('every hello comes with a goodbye.', 'y'); },
    hello() { COMMANDS.selam(); },
    login() {
      if (!hasSupabase()) return say(L('Supabase ayarlanmamış (js/config.js). README\'ye bak.', 'Supabase is not configured (js/config.js). See README.'), 'err');
      say(L('kontrol odası açılıyor...', 'opening the control room...'), 'ok');
      setTimeout(() => { close(); API.openAdmin?.(); }, 250);
    },
    admin() { COMMANDS.login(); },
    logout() { API.adminLogout?.().then(() => say(L('çıkış yapıldı', 'logged out'), 'ok')); },
  };
  COMMANDS.yoket = COMMANDS.destroy;
  COMMANDS.sfx = COMMANDS.ses;
  COMMANDS.wake = COMMANDS.uyan;
  COMMANDS.flip = COMMANDS.ters;
  COMMANDS.acid = COMMANDS.asit;
  COMMANDS.temizle = COMMANDS.clear;
  COMMANDS.yardım = COMMANDS.help;
  COMMANDS.yardim = COMMANDS.help;

  function run(line) {
    const raw = line.trim();
    print(`<span class="ln-cmd"><span class="acc">star@oda</span>:<span class="cy">~</span>$ ${esc(raw)}</span>`);
    if (!raw) return;
    history.push(raw);
    hIdx = history.length;
    const [cmd, ...args] = raw.split(/\s+/);
    const fn = COMMANDS[cmd.toLowerCase()];
    if (fn) {
      try { fn(args); } catch (err) { say(String(err), 'err'); }
    } else {
      API.sfx?.play('error');
      say(`${cmd}: ${L('komut bulunamadı. "help" dene.', 'command not found. try "help".')}`, 'err');
    }
  }

  form.addEventListener('submit', (e) => { e.preventDefault(); API.sfx?.play('enter'); run(input.value); input.value = ''; });
  // tuş vuruşu sesi (yazı tuşları ve silme)
  input.addEventListener('keydown', (e) => { if ((e.key.length === 1 || e.key === 'Backspace') && !e.ctrlKey && !e.metaKey) API.sfx?.play('type', { k: e.key === ' ' ? 'deep' : '' }); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { e.preventDefault(); hIdx = Math.max(0, hIdx - 1); input.value = history[hIdx] || ''; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx = Math.min(history.length, hIdx + 1); input.value = history[hIdx] || ''; }
    else if (e.key === 'Tab') {
      e.preventDefault();
      const v = input.value;
      const parts = v.split(/\s+/);
      if (parts.length === 1) {
        const m = Object.keys(COMMANDS).filter((c) => c.startsWith(parts[0]));
        if (m.length === 1) input.value = `${m[0]} `;
        else if (m.length) say(m.join('  '), 'd');
      } else if (parts[0] === 'cat') {
        const m = Object.keys(FILES).filter((f) => f.startsWith(parts[1]));
        if (m.length === 1) input.value = `cat ${m[0]}`;
      } else if (parts[0] === 'cd') {
        const m = Object.keys(DIRS).filter((f) => f.startsWith(parts[1]));
        if (m.length === 1) input.value = `cd ${m[0]}`;
      }
    } else if (e.key === 'Escape') { e.preventDefault(); close(); }
    e.stopPropagation();
  });
  $('#termClose').addEventListener('click', close);

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Backquote' || e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = document.activeElement?.tagName;
    if ((tag === 'INPUT' || tag === 'TEXTAREA') && document.activeElement !== input) return;
    if (API.gameRunning?.()) return;
    e.preventDefault();
    toggle();
  });

  API.terminal = { open, close, toggle, run };
}
