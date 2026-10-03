import { store } from './util.js';

// TR varsayılan dil: statik metinlerin Türkçesi HTML'in kendisinde durur, ilk açılışta hafızaya alınır.
// EN çevirileri ve JS'in ürettiği metinlerin her iki dili burada.
const EN = {
  skip: 'Skip to content',
  'nav.label': 'Sections', 'nav.oda': '01 ROOM', 'nav.projeler': '02 PROJECTS', 'nav.envanter': '03 INVENTORY', 'nav.raf': '04 GAME SHELF', 'nav.muzik': '05 MUSIC', 'nav.duvar': '06 WALL', 'nav.menu': 'Menu',
  'mode.label': 'Switch mode: REAL / DRUG',
  'hero.entry': '[00] ENTRY // GİRİŞ', 'hero.sys': 'system:', 'hero.note': 'that\'s me. yes, just "star".',
  'hero.m1': 'PLAY. TRANSLATE. CODE.', 'hero.m2': 'REPEAT.',
  'hero.sub': '21-year-old computer engineering student. This is my digital room — touch, paint, break things. I\'ll clean up later.',
  'cta.spray': 'SPRAY MODE', 'cta.term': 'TERMINAL',
  'hero.pill': 'take the pill, go DRUG mode', 'hero.avReal': 'star\'s pixel avatar: a character with a green cap and closed eyes', 'hero.avDrug': 'psychedelic, color-cycling version of star\'s avatar', 'hero.avCap': '480×480 · HAND-MADE PIXELS',
  'st.playing': 'PLAYING', 'st.listening': 'LISTENING', 'st.where': 'LOCATION', 'st.whereVal': 'probably in a game',
  'oda.title': 'ROOM', 'oda.note': 'about.txt — read before opening', 'oda.card': 'CHARACTER CARD', 'oda.class': 'CLASS: ENGINEER (APPRENTICE)',
  'oda.k1': 'LEVEL', 'oda.k2': 'MAJOR', 'oda.k3': 'MAIN QUEST', 'oda.k4': 'SIDE QUEST', 'oda.k5': 'WEAKNESS', 'oda.k6': 'STATUS',
  'oda.v2': 'Computer Engineering', 'oda.v5': '"one more round"', 'oda.v6': 'online',
  'oda.hello': 'hi, i\'m star',
  'oda.p1': 'I\'m 21 and I study computer engineering. Most of my free time goes into games; the rest goes into UltraTurk, the dubbed Turkish translation of ULTRAKILL <span class="hand">(lead developer + translator)</span>.',
  'oda.p2': 'LoL, Minecraft, Cyberpunk, ULTRAKILL, VALORANT, Undertale, Outer Wilds… the list goes on. I\'ve played <mark>way too many</mark> games.',
  'oda.p3': 'I can\'t code without music. And I can\'t look at an empty canvas without drawing pixels on it.',
  'oda.todo': 'THINGS TO DO HERE → SPRAY THE WALL · POKE THE TERMINAL · LISTEN TO MUSIC · SIGN THE GUESTBOOK · (MAYBE THERE IS MORE)',
  'oda.cow': 'note: the C.O.W. on the cap means nothing. no idea why i wrote it. don\'t ask.',
  'oda.bio': '— GITHUB BIO', 'oda.likesT': 'interests:', 'oda.likes': '✓ games (a lot)<br>✓ music (a lot a lot)<br>✓ pixel art<br>✓ translation / patches',
  'pr.title': 'PROJECTS', 'pr.ut.kind': 'PROJECT_01 // TRANSLATION + DUB', 'pr.main': 'MAIN QUEST ★', 'pr.ut.logoAlt': 'UltraTurk logo: a red ULTRAKILL revolver with Turkish flag motif',
  'pr.ut.cap': '// ULTRAKILL OPENING SCREEN', 'pr.ut.kicker': 'DUBBED TURKISH TRANSLATION FOR ULTRAKILL',
  'pr.ut.desc': 'The whole game is translated into Turkish and every voiced character has a Turkish dub. Text and textures stay as true to the original as possible; built with the UltrakULL library.',
  'pr.ut.role': 'MY ROLE: LEAD DEVELOPER + TRANSLATOR', 'pr.ut.team': 'TEAM: STAR · SSTONEY', 'pr.ut.mix': 'Mixing',
  'pr.ut.dl': '5,000+ DOWNLOADS', 'pr.ut.dlw': 'DOWNLOADS', totop: 'Back to top', 'pr.ut.full': '100% TRANSLATED', 'pr.ut.dub': 'FULL DUB',
  'pr.g.kind': 'PROJECT_02 // AI', 'pr.side': 'SIDE QUEST', 'pr.g.slogan': 'it taught itself to play.', 'pr.g.desc': 'An AI trained to reach the highest tiles in 2048, plus a site where you can watch every decision live. It learned by playing millions of games against itself with TD learning, and runs a parallel Expectimax search on every core in the browser.', 'pr.g.tag': 'GAME', 'pr.g.play': 'PLAY ↗', 'pr.g.code': 'CODE ↗',
  'pr.repos': 'terminal — ~/repos — OTHER REPOS (automatic)', 'pr.loading': 'loading...',
  'sk.title': 'INVENTORY', 'sk.note': 'LV = the score I gave myself (1–10)', 'sk.char': 'CHARACTER // STAR', 'sk.cats': 'Categories', 'sk.inv': 'INVENTORY — EVERYTHING ELSE',
  'sk.c.veri': 'DATA', 'sk.c.arac': 'TOOLS', 'sk.c.oyun': 'GAMES+ART',
  'gm.title': 'GAME SHELF', 'gm.note': 'just the ones i remembered', 'gm.list': 'Games', 'gm.msg': 'i\'ve played way too many games.<br>this shelf is just the tip of the iceberg.',
  'mu.title': 'MUSIC', 'mu.note': 'my pocket mp3 — no code without music', 'mu.player': 'MP3 player', 'mu.stopped': 'STOPPED', 'mu.seek': 'Position', 'mu.preview': 'PREVIEW 0:30',
  'mu.volUp': 'Volume up', 'mu.prev': 'Previous track', 'mu.play': 'Play', 'mu.next': 'Next track', 'mu.volDown': 'Volume down',
  'mu.hint': "spotify's 30-sec preview,<br>full song ↗ on spotify ♪",
  'mu.fwd': '10 seconds forward', 'mu.back': '10 seconds back', 'mu.filter': 'FILTER', 'mu.filterPh': 'song, artist, album...',
  'mu.th.art': 'Cover', 'mu.th.song': 'SONG', 'mu.th.album': 'ALBUM', 'mu.th.year': 'YEAR', 'mu.th.genre': 'GENRE', 'mu.th.dur': 'TIME', 'mu.th.act': 'Actions',
  'mu.legend': '▶ = 30-SEC PREVIEW · ↗ = FULL SONG ON SPOTIFY', 'mu.legend2': 'COVERS AUTO-CONVERTED TO 8-BIT',
  'wl.title': 'WALL', 'wl.note': 'everyone\'s wall · buffed every monday', 'wl.canvas': 'Visitors\' spray paintings', 'wl.can': 'SPRAY CAN', 'wl.color': 'Color', 'wl.size': 'Nozzle size',
  'wl.thin': 'THIN', 'wl.mid': 'MEDIUM', 'wl.thick': 'FAT', 'wl.toggle': 'SPRAY MODE', 'wl.off': 'OFF', 'wl.buffIn': 'BUFF IN', 'wl.archive': '← OLD WALLS (ARCHIVE)', 'wl.archiveT': 'OLD WALLS',
  'gb.title': 'GUEST<br>BOOK', 'gb.name': 'NICKNAME', 'gb.msg': 'MESSAGE (MAX 140)', 'gb.ph': 'stick something on the wall...', 'gb.send': 'STICK IT ↘',
  'ft.label': '[07] CONTACT // EXIT', 'ft.copy': 'COPY', 'ft.copy2': '© 2026 STAR · HOSTED ON GITHUB PAGES · HAND-MADE, NO TEMPLATES', 'ft.hint': '` = TERMINAL', 'ft.now': 'NOW',
  'term.label': 'Hidden terminal', 'term.title': '~/room — HIDDEN TERMINAL', 'term.close': 'Close terminal', close: 'Close',
  // --- v3 ---
  'cta.tour': 'EXPLORE THE ROOM',
  'pr.g.live': 'AI IS PLAYING', 'pr.g.kicker': 'ARTIFICIAL INTELLIGENCE LAB',
  'pr.g.s1': '16384 tile', 'pr.g.s2': 'Avg. score', 'pr.g.s3': 'Best', 'pr.g.s4': 'Model', 'pr.g.s4v': '67M weights',
  'pr.g.s5': 'Training', 'pr.g.s5v': '8.8M games', 'pr.g.s6v': '~146k moves/s', 'pr.g.td': 'TD LEARNING',
  'pr.g.soon': 'source code & live demo coming soon ↗',
  'sk.cls': 'ENGINEER · APPRENTICE', 'sk.radar': 'SKILL MAP', 'sk.radarLabel': 'Average level per category',
  'sk.equip': 'EQUIPPED', 'sk.equipNote': 'best of each class', 'sk.sort': 'Sort',
  'gm.hint': 'click a case — it spins, read the back',
  'gb.legal': 'your note is public and stored on a server · <a href="gizlilik.html">privacy</a>',
  'ld.inv': 'OPENING THE INVENTORY…', 'ld.shelf': 'STACKING THE SHELF…', 'ld.lib': 'LOADING THE LIBRARY…',
  'ft.roomHint': 'night mode: click things in the room',
  'ft.cont': 'CONTINUE?', 'ft.contBtn': 'YES ↑ BACK TO TOP', 'ft.map': 'MAP', 'ft.status': 'ROOM STATUS', 'ft.privacy': 'PRIVACY POLICY', 'ft.cookies': 'COOKIE SETTINGS',
  'mu.volG': 'Volume', 'mu.pvBadge': 'SPOTIFY · 30-SEC PREVIEW', 'mu.mute': 'Mute', 'mu.volLevel': 'Volume level',
};

// JS'in ürettiği metinler (iki dil)
const DYN = {
  'sk.c.diller': ['DİLLER', 'LANGUAGES'],
  'sk.c.web': ['WEB', 'WEB'],
  'sk.c.veri2': ['VERİ', 'DATA'],
  'sk.c.arac2': ['ARAÇLAR', 'TOOLS'],
  'sk.c.oyun2': ['OYUN + SANAT', 'GAMES + ART'],
  'sk.count': ['{n} öğe puanlandı', '{n} items rated'],
  'sk.empty': ['BU KATEGORİDE HENÜZ PUANLANMIŞ BİR ŞEY YOK. YAKINDA.', 'NOTHING RATED IN THIS CATEGORY YET. SOON.'],
  'sk.invEmpty': ['ENVANTER BOŞ — PUANLAR YOLDA.', 'INVENTORY EMPTY — SCORES INCOMING.'],
  'gm.detail': ['KARTUŞ DETAYI', 'CARTRIDGE INFO'],
  'gm.auto': ['VERİ: OTOMATİK', 'DATA: AUTOMATIC'],
  'gm.dev': ['GELİŞTİRİCİ', 'DEVELOPER'], 'gm.pub': ['YAYINCI', 'PUBLISHER'], 'gm.rel': ['ÇIKIŞ', 'RELEASED'],
  'gm.genre': ['TÜR', 'GENRE'], 'gm.plat': ['PLATFORM', 'PLATFORM'], 'gm.meta': ['METACRITIC', 'METACRITIC'],
  'gm.status': ['DURUM', 'STATUS'], 'gm.note': ['notum', 'my note'], 'gm.now': ['ŞU AN', 'NOW'], 'gm.store': ['MAĞAZA ↗', 'STORE ↗'],
  'gm.empty': ['Raf şimdilik boş.', 'The shelf is empty for now.'],
  'gm.break': ['ara veriyorum', 'taking a break'],
  'st.oynuyorum': ['OYNUYORUM', 'PLAYING'], 'st.oynadım': ['OYNADIM', 'PLAYED'], 'st.bitirdim': ['BİTİRDİM', 'FINISHED'], 'st.bıraktım': ['BIRAKTIM', 'DROPPED'], 'st.favori': ['FAVORİ', 'FAVORITE'],
  'mu.lib': ['KİTAPLIK — {n} PARÇA · {t}', 'LIBRARY — {n} TRACKS · {t}'],
  'mu.track': ['parça {a} / {b}', 'track {a} / {b}'],
  'mu.playing': ['▶ ÇALIYOR · {i}/{n}', '▶ PLAYING · {i}/{n}'],
  'mu.paused': ['❚❚ DURAKLADI · {i}/{n}', '❚❚ PAUSED · {i}/{n}'],
  'mu.stopped2': ['■ DURDU', '■ STOPPED'],
  'mu.pause': ['Duraklat', 'Pause'], 'mu.playT': ['Çal', 'Play'],
  'mu.playRow': ['{t} önizlemesini çal', 'Play preview of {t}'],
  'mu.open': ['Apple Music\'te aç', 'Open in Apple Music'],
  'mu.openSp': ['Spotify\'da aç', 'Open in Spotify'],
  'mu.noPreview': ['Bu şarkının önizlemesi yok.', 'No preview for this track.'],
  'mu.vol': ['SES {v}', 'VOLUME {v}'],
  'mu.empty': ['Kitaplık boş.', 'Library is empty.'],
  'wl.on': ['AÇIK', 'ON'], 'wl.off2': ['KAPALI', 'OFF'],
  'wl.live': ['● CANLI · {n} KİŞİ', '● LIVE · {n} HERE'],
  'wl.offline': ['○ ÇEVRİMDIŞI', '○ OFFLINE'],
  'wl.week': ['HAFTA {w} · {y} · DUVAR', 'WEEK {w} · {y} · WALL'],
  'wl.timer': ['{d}G {h}S {m}DK', '{d}D {h}H {m}M'],
  'wl.localNote': ['ÇEVRİMDIŞI MOD: SUPABASE AYARLANANA KADAR DUVAR SADECE SENİN TARAYICINDA DURUR.', 'OFFLINE MODE: UNTIL SUPABASE IS SET UP, THE WALL ONLY LIVES IN YOUR BROWSER.'],
  'wl.sprayHint': ['Sprey modu açık — duvara çiz!', 'Spray mode on — paint the wall!'],
  'wl.slow': ['Yavaş! Sprey kutun soğusun.', 'Slow down! Let the can cool off.'],
  'wl.noArchive': ['Henüz arşivlenmiş duvar yok.', 'No archived walls yet.'],
  'wl.archWeek': ['HAFTA {w} · {n} ÇİZGİ', 'WEEK {w} · {n} STROKES'],
  'wl.archBuff': ['BUFF · {d} · {n} ÇİZGİ', 'BUFFED · {d} · {n} STROKES'],
  'wl.archErr': ['Arşiv şu an açılamadı, birazdan tekrar dene.', 'Could not open the archive right now, try again soon.'],
  'wl.visitor': ['ziyaretçi_{n}', 'visitor_{n}'],
  'gb.sent': ['YAPIŞTIRILDI ✓', 'STUCK ✓'],
  'gb.err': ['Gönderilemedi, birazdan tekrar dene.', 'Could not send, try again soon.'],
  'gb.local': ['Çevrimdışı mod: not sadece senin tarayıcında görünür.', 'Offline mode: the note is only visible in your browser.'],
  'gb.more': ['+ {n} NOT DAHA<br>TÜMÜNÜ GÖR →', '+ {n} MORE NOTES<br>SEE ALL →'],
  'gb.empty': ['İlk notu sen bırak.', 'Be the first to leave a note.'],
  'gb.ago.s': ['{n}SN ÖNCE', '{n}S AGO'], 'gb.ago.m': ['{n}DK ÖNCE', '{n}M AGO'], 'gb.ago.h': ['{n}S ÖNCE', '{n}H AGO'], 'gb.ago.d': ['{n}G ÖNCE', '{n}D AGO'],
  'ft.copied': ['Discord adı kopyalandı: stariscrazy', 'Discord name copied: stariscrazy'],
  'mode.real': ['REAL moda dönüldü.', 'Back to REAL mode.'],
  'mode.drug': ['Hapı yuttun. DRUG mod.', 'You took the pill. DRUG mode.'],
  'repo.none': ['// başka public repo yok', '// no other public repos'],
  'repo.err': ['// GitHub API şu an cevap vermiyor', '// GitHub API is not responding right now'],
  'repo.note': ['// GitHub API\'den canlı çekilir — yeni repo açınca burada belirir', '// fetched live from the GitHub API — new repos show up here automatically'],
  // --- envanter ---
  'sk.all': ['TÜMÜ', 'ALL'],
  'sk.r0': ['PUANLANMADI', 'UNRATED'], 'sk.r1': ['SIRADAN', 'COMMON'], 'sk.r2': ['SEYREK', 'UNCOMMON'], 'sk.r3': ['NADİR', 'RARE'], 'sk.r4': ['EPİK', 'EPIC'], 'sk.r5': ['EFSANEVİ', 'LEGENDARY'],
  'sk.st.items': ['ÖĞE', 'ITEMS'], 'sk.st.rated': ['PUANLANAN', 'RATED'], 'sk.st.avg': ['ORT. LV', 'AVG. LV'], 'sk.st.top': ['EN GÜÇLÜ', 'STRONGEST'],
  'sk.f.diller': ['Makineyle konuşma sanatı.', 'The art of talking to machines.'],
  'sk.f.web': ['Tarayıcıda yaşayan büyüler.', 'Spells that live in the browser.'],
  'sk.f.veri': ['Hiçbir şeyi unutmayan kutular.', 'Boxes that never forget.'],
  'sk.f.arac': ['Ustanın alet çantası.', "The craftsman's toolbox."],
  'sk.f.oyun': ['Piksel, oyun ve çeviri işleri.', 'Pixels, games and translation work.'],
  'sk.eq.diller': ['ANA SİLAH', 'MAIN WEAPON'], 'sk.eq.web': ['KALKAN', 'SHIELD'], 'sk.eq.veri': ['TILSIM', 'AMULET'], 'sk.eq.arac': ['ALET ÇANTASI', 'TOOLKIT'], 'sk.eq.oyun': ['BÜYÜ', 'SPELL'],
  'sk.eq.empty': ['BOŞ', 'EMPTY'],
  'sk.in.pick': ['Bir öğeye tıkla ya da üstüne gel.', 'Click or hover an item.'],
  'sk.in.unrated': ['Bu öğe henüz puanlanmadı.', 'This item is not rated yet.'],
  'sk.in.class': ['SINIF', 'CLASS'], 'sk.in.rarity': ['NADİRLİK', 'RARITY'], 'sk.in.level': ['SEVİYE', 'LEVEL'],
  'sk.radarEmpty': ['puanlar gelince dolacak', 'fills up once rated'],
  // --- oyun rafı ---
  'gm.count': ['RAFTA {n} OYUN', '{n} GAMES ON THE SHELF'],
  'gm.flip': ['ÇEVİR', 'FLIP'], 'gm.close': ['KAPAT', 'CLOSE'], 'gm.prev': ['Önceki oyun', 'Previous game'], 'gm.next': ['Sonraki oyun', 'Next game'],
  'gm.front': ['ÖN KAPAK', 'FRONT'], 'gm.back': ['ARKA KAPAK', 'BACK'], 'gm.keys': ['Esc kapat · Boşluk çevir · ← → gez', 'Esc close · Space flip · ← → browse'],
  'gm.open': ['{n} kutusunu aç', 'Open the {n} case'],
  'gm.nowCard': ['ŞU AN OYNUYOR', 'NOW PLAYING'], 'gm.lastAdded': ['RAFTAKİ İLK OYUN', 'FIRST ON THE SHELF'],
  'gm.disc': ['DİSK 1', 'DISC 1'],
  // --- müzik ---
  'mu.muted': ['SES KAPALI', 'MUTED'],
  'pr.loadingD': ['yükleniyor...', 'loading...'],
  'ft.over': ['OYUN BİTTİ', 'GAME OVER'], 'ft.coin': ['JETON AT ↻', 'INSERT COIN ↻'], 'ft.credit': ['KREDİ 01 · DEVAM?', 'CREDIT 01 · CONTINUE?'],
  'ft.clock': ['İSTANBUL', 'ISTANBUL'], 'ft.playing': ['ÇALIYOR', 'PLAYING'], 'ft.gaming': ['OYUNDA', 'IN GAME'], 'ft.wall': ['DUVAR', 'WALL'], 'ft.notes': ['DEFTER', 'GUESTBOOK'],
  'ft.wallN': ['bu hafta {n} çizgi', '{n} strokes this week'], 'ft.notesN': ['{n} not', '{n} notes'], 'ft.silence': ['sessizlik', 'silence'], 'ft.paused': ['(duraklatıldı)', '(paused)'],
  'ft.mq': ['GÖRÜŞÜRÜZ|HOŞÇA KAL|BYE|OYUN BİTTİ?|BİR DAHAKİ SEFERE|ODANIN IŞIKLARI AÇIK KALSIN|SEE YA', 'SEE YA|GOODBYE|BYE|GAME OVER?|UNTIL NEXT TIME|LEAVE THE LIGHTS ON|LATER'],
  'pr.ut.tr': ['ULTRATURK (TR)', 'ULTRATURK (TR)'], 'pr.ut.en': ['ORİJİNAL (EN)', 'ORIGINAL (EN)'],
  'mu.dockD': ['ŞİMDİ ÇALIYOR', 'NOW PLAYING'], 'mu.dockReady': ['ÇALMAYA HAZIR', 'READY TO PLAY'],
  'mu.src30': ['SPOTIFY · 30SN', 'SPOTIFY · 30S'], 'mu.srcNone': ['ÖNİZLEME YOK', 'NO PREVIEW'],
  'mu.full': ['TAMAMI {d}', 'FULL {d}'],
  'mu.noPv': ['Bu şarkının Spotify önizlemesi yok — tamamını Spotify\'da dinle.', 'No Spotify preview for this song — listen to it on Spotify.'],
  'mu.openFull': ['TAMAMINI SPOTIFY\'DA DİNLE ↗', 'LISTEN ON SPOTIFY ↗'],
  'mu.vizHint': ['▶ PLAĞA TIKLA, ÇALSIN', '▶ CLICK THE RECORD TO PLAY'],
  'mu.preparing': ['♪ HAZIRLANIYOR…', '♪ PREPARING…'],
  'mu.pvFail': ['Önizleme şu an alınamadı — tamamını Spotify\'da dinleyebilirsin.', 'Could not load the preview right now — you can listen on Spotify.'],
  'gm.legal': ['Kapak görselleri ve markalar sahiplerine aittir. Bu bir hayran rafıdır.', 'Cover art and trademarks belong to their owners. This is a fan shelf.'],
};

let lang = document.documentElement.lang === 'en' ? 'en' : 'tr';
const originals = new WeakMap();
const listeners = new Set();

export const getLang = () => lang;

export function t(key, vars = {}) {
  let s;
  if (DYN[key]) s = DYN[key][lang === 'en' ? 1 : 0];
  else if (lang === 'en' && EN[key] != null) s = EN[key];
  else s = key;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
}

function remember(el) {
  if (originals.has(el)) return originals.get(el);
  const o = { text: el.textContent, html: el.innerHTML, attrs: {} };
  (el.dataset.i18nAttr || '').split(';').filter(Boolean).forEach((pair) => {
    const [attr] = pair.split(':');
    o.attrs[attr] = el.getAttribute(attr);
  });
  originals.set(el, o);
  return o;
}

export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n], [data-i18n-html], [data-i18n-attr]').forEach((el) => {
    const o = remember(el);
    if (el.dataset.i18n) el.textContent = lang === 'en' && EN[el.dataset.i18n] != null ? EN[el.dataset.i18n] : o.text;
    if (el.dataset.i18nHtml) el.innerHTML = lang === 'en' && EN[el.dataset.i18nHtml] != null ? EN[el.dataset.i18nHtml] : o.html;
    (el.dataset.i18nAttr || '').split(';').filter(Boolean).forEach((pair) => {
      const [attr, key] = pair.split(':');
      const v = lang === 'en' && EN[key] != null ? EN[key] : o.attrs[attr];
      if (v != null) el.setAttribute(attr, v);
    });
  });
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

export function setLang(next) {
  lang = next === 'en' ? 'en' : 'tr';
  store.set('star.lang', lang);
  applyI18n();
  listeners.forEach((fn) => fn(lang));
}

export const onLang = (fn) => listeners.add(fn);
