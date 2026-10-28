// Static site generator for the game portal. No dependencies.
// node scripts/build.mjs  ->  dist/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');
const DIST = path.join(ROOT, 'dist');
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));
if (process.env.SITE_URL) cfg.url = process.env.SITE_URL;
if (process.env.SITE_BASE !== undefined) cfg.base = process.env.SITE_BASE;
cfg.url = cfg.url.replace(/\/$/, '');
const B = cfg.base.replace(/\/$/, '');           // path prefix for links
const ABS = cfg.url + B;                          // absolute site root
const YEAR = new Date().getFullYear();
const BUILD_ID = Date.now().toString(36);

// ---------------------------------------------------------------- helpers
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', eacute: 'é', egrave: 'è', ecirc: 'ê', aacute: 'á', agrave: 'à', acirc: 'â', auml: 'ä', ouml: 'ö', uuml: 'ü', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', ccedil: 'ç', szlig: 'ß', trade: '™', copy: '©', reg: '®', deg: '°', times: '×', laquo: '«', raquo: '»' };
const decode = s => String(s ?? '')
  .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return ENT[e.toLowerCase()] ?? m;
  });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clean = s => decode(decode(s))
  .replace(/<[^>]*>/g, ' ')
  .replace(/\*\*|__/g, '')
  .replace(/\b(web\s*dev|website|visit|play more( games)? (at|on))\s*:?\s*https?:\/\/\S+/gi, ' ')
  .replace(/https?:\/\/\S+|www\.\S+/gi, ' ')
  .replace(/\s+/g, ' ').trim();
const slugify = s => decode(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70) || 'game';
const titleCase = s => s.replace(/\s+/g, ' ').trim();
const trunc = (s, n) => s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…';
// ---------------------------------------------------------------- languages
// The site is built once per language. English keeps the paths it always had; every other
// language lives under /<code>/ and reuses the same data with translated text layered on top.
// (readJSON below is a hoisted function declaration, so it can be used here.)
const LANGS = readJSON(path.join(ROOT, 'data/i18n/langs.json'), []);
const UI = {}, CATTR = {}, GAMETR = {};
for (const l of LANGS) {
  UI[l.code] = readJSON(path.join(ROOT, `data/i18n/ui/${l.code}.json`), {});
  CATTR[l.code] = readJSON(path.join(ROOT, `data/i18n/cats/${l.code}.json`), {});
  GAMETR[l.code] = readJSON(path.join(ROOT, `data/i18n/games/${l.code}.json`), {});
}
let LANG = 'en';
const uiLangs = () => LANGS.filter(l => Object.keys(UI[l.code] || {}).length >= 20).map(l => l.code);
const PFX = () => (LANG === 'en' ? '' : '/' + LANG);
// every phrase that reaches tr() is recorded, so scripts/translate.mjs always knows what to translate
const PHRASES = new Set();
const tr = s => { const k = String(s ?? ''); PHRASES.add(k); return LANG === 'en' ? k : (UI[LANG][k] || k); };
// a game's text in the current language; an untranslated game simply keeps its English text
const tgame = g => (LANG === 'en' ? null : (GAMETR[LANG] || {})[g.slug] || null);
const gDesc = g => { const t = tgame(g); return (t && t.description) || g.description; };
const gInstr = g => { const t = tgame(g); return (t && t.instructions) || g.instructions; };
const langsFor = g => LANGS.filter(l => (GAMETR[l.code] || {})[g.slug]);
const catTr = key => (LANG === 'en' ? null : (CATTR[LANG] || {})[key] || null);
const catIntro = slug => { const v = (catTr(slug) || {}).intro; return (Array.isArray(v) ? v.join(' ') : v) || CAT_INTRO[slug] || ''; };

const u = p => B + PFX() + p;                      // internal link (language aware)
const ur = p => B + p;                             // shared file at the site root (assets, icons)
const gHref = g => (LANG === 'en' || (GAMETR[LANG] || {})[g.slug]) ? u(`/games/${g.slug}/`) : ur(`/games/${g.slug}/`);
const cHref = slug => (LANG === 'en' || (CATTR[LANG] || {})[slug]) ? u(`/c/${slug}/`) : ur(`/c/${slug}/`);
const tHref = slug => (LANG === 'en' || (CATTR[LANG] || {})['topic:' + slug]) ? u(`/${slug}/`) : ur(`/${slug}/`);
const abs = p => ABS + PFX() + p;
const absIn = (lang, p) => ABS + (lang === 'en' ? '' : '/' + lang) + p;
function write(rel, content) {
  const f = path.join(DIST, LANG === 'en' ? rel : path.join(LANG, rel));
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
function readJSON(f, def) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; } }

// ---------------------------------------------------------------- content rules
// Games named after or copying famous brands/characters are skipped (trademark risk),
// as are adult-themed games.
const BLOCK = [
  'among us', 'amogus', 'impostor', 'imposter', 'crewmate', 'minecraft', 'mine-craft', 'minescraft', 'minecraf', 'herobrine', 'creeper', 'steve ',
  'skibidi', 'toilet', 'huggy', 'poppy', 'playtime', 'baldi', 'pou ', 'pou online', 'talking tom', 'tom & jerry', 'tom and jerry', 'squid game',
  'homescapes', 'gardenscapes', 'bitlife', 'temple run', 'subway surf', 'mario', 'luigi', 'sonic', 'candy crush', 'teen titans', 'spider man',
  'spiderman', 'spider-man', 'batman', 'superman', 'avengers', 'hulk', 'marvel', 'disney', 'pixar', 'frozen', 'elsa', 'barbie', 'barbee', 'ken doll',
  'pokemon', 'pokémon', 'pikachu', 'roblox', 'fortnite', 'gta', 'grand theft', 'pubg', 'free fire', 'call of duty', 'counter strike', 'cs:go', 'csgo',
  'stumble guys', 'fall guys', 'angry birds', 'cut the rope', 'fireboy', 'watergirl', 'red ball', 'paw patrol', 'peppa', 'hello kitty', 'fnaf',
  'five nights', 'freddy', 'sprunki', 'incredibox', 'shrek', 'naruto', 'dragon ball', 'one piece', 'pac-man', 'pacman', 'tetris', 'zelda', 'kirby',
  'bluey', 'cocomelon', 'spongebob', 'sponge bob', 'simpsons', 'scooby', 'smurf', 'minion', 'harry potter', 'hogwarts', 'star wars', 'jurassic',
  'transformers', 'lego', 'hot wheels', 'nerf', 'ferrari', 'lamborghini', 'bugatti', 'porsche', 'bentley', 'bmw', 'audi', 'mercedes', 'tesla',
  'fifa', 'uefa', 'world cup', 'worldcup', 'nba', 'nfl', 'mlb', 'nhl', 'wwe', 'olympic', 'pou', 'tiktok', 'youtube', 'mrbeast', 'mr beast',
  'messi', 'ronaldo', 'neymar', 'trump', 'biden', 'putin', 'wednesday addams', 'labubu', 'garten of banban', 'banban', 'rainbow friends',
  'doors roblox', 'bloxburg', 'brookhaven', 'blox', 'fruit ninja', 'flappy bird', 'geometry dash', 'slither', 'agar.io', 'paper.io', 'hole.io',
  'happy glass', 'love balls', 'hunter assassin', 'save the doge', 'helix jump', 'stack ball', 'bowmasters', 'clash of', 'brawl stars', 'plants vs',
  'pvz', 'zombie tsunami', 'cookie clicker', 'wordle', 'hearthstone', 'genshin', 'valorant', 'apex legends', 'overwatch', 'kick the buddy',
  'adult', 'sexy', 'sex', 'nsfw', 'nude', 'strip', 'hentai', 'bikini', 'lingerie', 'dating', 'kissing', 'kiss ', 'erotic', 'casino', 'slot machine',
  'gambling', 'poker', 'blackjack', 'roulette', 'bet ', 'drunk', 'beer', 'cigarette', 'weed', 'gore', 'bloody', 'killer clown', 'suicide', 'hitler', 'nazi',
  'unblocked', 'hacked', 'cheat'
];
BLOCK.push('amongus', 'among', 'shadowgun', 'plants vs zombies', 'pvz', 'sprunki', 'brainrot', 'tralalero', 'drunken', 'kiss', 'bet', 'double dragon', 'left dead', 'left 4 dead', 'mortal kombat', 'street fighter', 'tekken', 'resident evil', 'half-life', 'halo');
const BLOCK_RE = new RegExp('(^|[^a-z0-9])(' + [...new Set(BLOCK.map(w => w.trim()))].map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')(?=$|[^a-z0-9])', 'i');
const isBlocked = g => BLOCK_RE.test(g.title) || BLOCK_RE.test(g.tags.join(' , '));

const CATS = [
  { slug: 'action', name: 'Action', h1: 'Action Games', cats: ['action', 'fighting', 'boys'], tags: ['action', 'fighting', 'fight', 'battle', 'ninja'] },
  { slug: 'shooting', name: 'Shooting', h1: 'Shooting Games', cats: ['shooting'], tags: ['shooting', 'shooter', 'gun', 'sniper', 'fps', 'tank'] },
  { slug: 'racing', name: 'Car & Racing', h1: 'Car & Racing Games', cats: ['racing'], tags: ['racing', 'car', 'cars', 'driving', 'drift', 'bike', 'motorbike', 'truck', 'parking'] },
  { slug: 'puzzle', name: 'Puzzle', h1: 'Puzzle Games', cats: ['puzzles', 'puzzle', 'bejeweled'], tags: ['puzzle', 'logic', 'brain', 'match 3', 'match3', 'sudoku', 'mahjong', 'jigsaw', 'word', 'quiz'] },
  { slug: 'clicker-idle', name: 'Clicker & Idle', h1: 'Clicker & Idle Games', cats: ['clicker'], tags: ['clicker', 'idle', 'tycoon', 'incremental', 'merge'] },
  { slug: 'arcade', name: 'Arcade', h1: 'Arcade Games', cats: ['arcade'], tags: ['arcade', 'retro', 'classic'] },
  { slug: 'adventure', name: 'Adventure', h1: 'Adventure Games', cats: ['adventure'], tags: ['adventure', 'platform', 'platformer', 'parkour', 'obby', 'escape'] },
  { slug: 'sports', name: 'Sports', h1: 'Sports Games', cats: ['sports', 'soccer'], tags: ['sports', 'football', 'soccer', 'basketball', 'golf', 'tennis', 'baseball', 'pool', 'billiards', 'bowling'] },
  { slug: 'two-player', name: '2 Player', h1: '2 Player Games', cats: ['2 player'], tags: ['2 player', '2 players', 'two player', '2player', 'two players', 'local multiplayer', 'pvp'] },
  { slug: 'multiplayer', name: 'Multiplayer & .io', h1: 'Multiplayer & .io Games', cats: ['multiplayer', '.io'], tags: ['multiplayer', 'io', '.io', 'online multiplayer'] },
  { slug: 'girls', name: 'Girls', h1: 'Games for Girls', cats: ['girls'], tags: ['girls', 'dress up', 'dressup', 'makeup', 'fashion', 'princess', 'nail', 'hair salon', 'makeover'] },
  { slug: 'hypercasual', name: 'Casual', h1: 'Casual & Hypercasual Games', cats: ['hypercasual'], tags: ['hypercasual', 'casual', 'relaxing', 'satisfying'] },
  { slug: 'stickman', name: 'Stickman', h1: 'Stickman Games', cats: ['stickman'], tags: ['stickman', 'stick'] },
  { slug: 'zombie', name: 'Zombie', h1: 'Zombie Games', cats: [], tags: ['zombie', 'zombies', 'undead'] },
  { slug: '3d', name: '3D', h1: '3D Games', cats: ['3d'], tags: ['3d', 'webgl', 'unity3d'] },
  { slug: 'cooking', name: 'Cooking', h1: 'Cooking Games', cats: ['cooking'], tags: ['cooking', 'food', 'restaurant', 'cake', 'pizza', 'burger', 'chef'] },
  { slug: 'kids', name: 'Kids', h1: 'Games for Kids', cats: [], tags: ['kids', 'kid', 'children', 'educational', 'coloring', 'baby'] },
  { slug: 'mobile', name: 'Mobile', h1: 'Mobile Games', cats: [], tags: [] },
];
const CAT_BY = Object.fromEntries(CATS.map(c => [c.slug, c]));
const CAT_ICON = { action: '⚔️', shooting: '🎯', racing: '🏎️', puzzle: '🧩', 'clicker-idle': '👆', arcade: '🕹️', adventure: '🗺️', sports: '⚽', 'two-player': '👥', multiplayer: '🌐', girls: '👗', hypercasual: '✨', stickman: '🕴️', zombie: '🧟', '3d': '🧊', cooking: '🍳', kids: '🧸', mobile: '📱' };
const CAT_INTRO = {
  action: 'Fight, dodge and battle your way through fast-paced action games. Every game runs right in your browser on PC, tablet and phone.',
  shooting: 'Aim, fire and take down your targets. From sniper missions to tank battles, these free shooting games load instantly with no download.',
  racing: 'Hit the gas in free car and racing games: drift, park, race motorbikes and drive monster trucks straight from your browser.',
  puzzle: 'Train your brain with free puzzle games: logic, match-3, physics puzzles and brain teasers you can play in seconds.',
  'clicker-idle': 'Tap, upgrade and watch the numbers grow. Our clicker and idle games keep progressing, so every visit pays off.',
  arcade: 'Quick, addictive arcade games for a short break or a long session. Easy to learn, hard to put down.',
  adventure: 'Explore new worlds, jump through platform levels and escape tricky traps in free adventure games.',
  sports: 'Score goals, sink putts and shoot hoops. Play free sports games online with no sign-up.',
  'two-player': 'Grab a friend and play on the same keyboard or screen. The best free 2 player games for head-to-head fun.',
  multiplayer: 'Compete with real players in multiplayer and .io games. Jump in, grow, and climb the leaderboard.',
  girls: 'Dress up, design, style and create. Fun games for girls (and everyone) with fashion, makeup and makeovers.',
  hypercasual: 'Simple one-tap games that are instantly fun. Perfect for a quick break on your phone or computer.',
  stickman: 'Stickman fights, parkour and adventures. Free stickman games that run smoothly on any device.',
  zombie: 'Survive the undead in free zombie games: shoot, build defenses and escape the horde.',
  '3d': 'Free 3D games running right in your browser: racing, shooting, parkour and more, with no install needed.',
  cooking: 'Run restaurants, bake cakes and serve hungry customers in free cooking games.',
  kids: 'Friendly, colorful games for kids: coloring, simple puzzles and easy-to-play fun.',
  mobile: 'Free games that work great on your phone and tablet. Tap to play instantly in your browser on Android or iPhone — no app, no download.',
};

function catsFor(g) {
  const primary = g.rawCat.toLowerCase();
  const tags = g.tags.map(t => t.toLowerCase());
  const words = ' ' + g.title.toLowerCase().replace(/[^a-z0-9.]+/g, ' ') + ' ';
  const out = [];
  for (const c of CATS) {
    if (c.cats.includes(primary) || tags.some(t => c.tags.includes(t)) || c.tags.some(t => t.length > 3 && words.includes(' ' + t + ' '))) out.push(c.slug);
  }
  // primary first
  const p = CATS.find(c => c.cats.includes(primary));
  const main = p ? p.slug : (out[0] || 'arcade');
  return { main, all: [main, ...out.filter(s => s !== main)] };
}

// ---------------------------------------------------------------- load feeds
const RAW = path.join(ROOT, 'data/raw');
const list = n => readJSON(path.join(RAW, `gm-${n}.json`), []);
const feeds = { most: list('mostplayed'), hot: list('hotgames'), best: list('bestgames'), picks: list('editorpicks'), newest: list('newest') };
if (!feeds.most.length && !feeds.newest.length) { console.error('No feed data in data/raw. Run: node scripts/fetch-feeds.mjs'); process.exit(1); }
const rank = {};
for (const [k, arr] of Object.entries(feeds)) { rank[k] = new Map(); arr.forEach((g, i) => { if (!rank[k].has(g.id)) rank[k].set(String(g.id), i); }); }

const pool = new Map();
for (const arr of Object.values(feeds)) for (const g of arr) if (!pool.has(String(g.id))) pool.set(String(g.id), g);

function normalize(g, source) {
  const title = titleCase(clean(g.title));
  const tags = String(g.tags || '').split(',').map(t => clean(t)).filter(Boolean);
  return {
    id: source + '-' + g.id, srcId: String(g.id), source, title,
    description: clean(g.description), instructions: clean(g.instructions),
    embed: String(g.url || '').replace(/^http:/, 'https:'), thumb: String(g.thumb || '').replace(/^http:/, 'https:'),
    w: +g.width || 800, h: +g.height || 600, rawCat: clean(g.category), tags,
  };
}

let games = [];
const seenTitle = new Set();
const gmMobile = new Set(readJSON(path.join(RAW, 'gm-mobile.json'), []));
for (const g0 of pool.values()) {
  const g = normalize(g0, 'gm');
  // the mobile feed is capped, so a game is also mobile when its own text says it plays by touch
  g.mobile = gmMobile.size ? (gmMobile.has(g.srcId) || /\b(touch ?screen|touch controls?|mobile|phone|tablet|swipe|tap)\b/i.test(g.description + " " + (g.instructions || ""))) : true;
  if (!g.title || !g.embed.startsWith('https://') || !g.thumb || g.description.length < 30) continue;
  if (isBlocked(g)) continue;
  const key = g.title.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (seenTitle.has(key)) continue;
  const r = id => (rank[id].has(g.srcId) ? rank[id].get(g.srcId) : Infinity);
  g.score = Math.min(r('most'), r('hot') * 2, r('best') * 2.5, r('picks') * 4, r('newest') * 5);
  if (!Number.isFinite(g.score)) continue;
  g.r = { most: r('most'), hot: r('hot'), best: r('best'), newest: r('newest') };
  seenTitle.add(key);
  games.push(g);
}

// optional GameDistribution feed (publisher dashboard export), tolerant field mapping
const gd = readJSON(path.join(RAW, 'gd.json'), null);
if (Array.isArray(gd) || Array.isArray(gd?.data) || Array.isArray(gd?.result)) {
  const arr = Array.isArray(gd) ? gd : (gd.data || gd.result);
  arr.forEach((x, i) => {
    const pick = (...ks) => { for (const k of ks) if (x[k] != null && x[k] !== '') return x[k]; return ''; };
    const asset = [].concat(pick('Asset', 'assets', 'Assets', 'images') || []);
    const g = normalize({
      id: pick('Md5', 'md5', 'id', 'Id', 'gameId'), title: pick('Title', 'title', 'name'), description: pick('Description', 'description'),
      instructions: pick('Instructions', 'instructions'), url: pick('Url', 'url', 'embedUrl'),
      thumb: (asset.find(a => /512x384|512x512/.test(a)) || asset[0] || pick('thumb', 'image')),
      category: [].concat(pick('Category', 'category', 'categories'))[0] || '', tags: [].concat(pick('Tag', 'tags', 'Tags')).join(','),
      width: pick('Width', 'width'), height: pick('Height', 'height'),
    }, 'gd');
    if (!g.title || !g.embed.startsWith('https://') || !g.thumb || isBlocked(g)) return;
    const key = g.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenTitle.has(key)) return;
    seenTitle.add(key);
    g.score = i * 2; g.r = { most: Infinity, hot: Infinity, best: Infinity, newest: Infinity };
    games.push(g);
  });
}

// Playgama partner catalogue (embed URL carries our partner clid so revenue is attributed)
const pg = readJSON(path.join(RAW, 'pg.json'), []);
if (cfg.playgamaClid && pg.length) {
  const GENRE_MAP = { puzzle: 'Puzzles', match3: 'Puzzles', merge: 'Puzzles', mahjong: 'Puzzles', solitaire: 'Puzzles', cards: 'Puzzles', word: 'Puzzles', educational: 'Puzzles', racing: 'Racing', cars: 'Racing', shooter: 'Shooting', shooting: 'Shooting', sports: 'Sports', football: 'Soccer', soccer: 'Soccer', io: '.io', '2_player': '2 Player', 'two-player': '2 Player', girls: 'Girls', 'dress-up': 'Girls', cooking: 'Cooking', clicker: 'Clicker', idle: 'Clicker', action: 'Action', fighting: 'Action', adventure: 'Adventure', platformer: 'Adventure', arcade: 'Arcade', hypercasual: 'Hypercasual', casual: 'Hypercasual', stickman: 'Stickman', multiplayer: 'Multiplayer' };
  const nice = s => String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  pg.forEach((x, i) => {
    if (!(x.supportedLanguages || []).some(l => /^en/i.test(l))) return;
    const genres = (x.genres || []).map(String);
    const rawCat = (genres.map(gn => GENRE_MAP[gn.toLowerCase()]).find(Boolean)) || nice(genres[0] || 'Arcade');
    const paras = String(x.description || '').split(/\n+/).map(s => clean(s)).filter(Boolean);
    const g = {
      id: 'pg-' + x.id, srcId: String(x.id), source: 'pg', pgSlug: x.slug ? String(x.slug) : '', title: titleCase(clean(x.title)),
      description: paras.join(' '), paras, instructions: clean(x.howToPlayText || ''),
      embed: `${String(x.gameURL || '').replace(/^http:/, 'https:')}?clid=${encodeURIComponent(cfg.playgamaClid)}`,
      thumb: String((x.images || [])[0] || ''), w: x.screenOrientation?.vertical && !x.screenOrientation?.horizontal ? 600 : 1280,
      h: x.screenOrientation?.vertical && !x.screenOrientation?.horizontal ? 1000 : 720,
      rawCat, tags: genres.map(nice), mobile: (x.mobileReady || []).some(m => /android|ios/i.test(m)),
    };
    if (!g.title || !x.gameURL || !g.thumb || g.description.length < 30 || isBlocked(g)) return;
    const key = g.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenTitle.has(key)) return;
    seenTitle.add(key);
    // Playgama is our preferred partner: its ranking is boosted ahead of GameMonetize
    g.score = i * 0.5; g.r = { most: i * 0.7, hot: i * 0.7, best: i * 0.8, newest: Infinity };
    games.push(g);
  });
}

// GamePix publisher catalogue (embed URL carries our property sid)
const gpx = readJSON(path.join(RAW, 'gpx.json'), []);
if (cfg.gamepixSid && gpx.length) {
  const GPX_MAP = { puzzle: 'Puzzles', 'match-3': 'Puzzles', merge: 'Puzzles', mahjong: 'Puzzles', solitaire: 'Puzzles', cards: 'Puzzles', board: 'Puzzles', word: 'Puzzles', quiz: 'Puzzles', educational: 'Puzzles', racing: 'Racing', driving: 'Racing', shooter: 'Shooting', shooting: 'Shooting', sports: 'Sports', soccer: 'Soccer', football: 'Soccer', io: '.io', 'two-players': '2 Player', '2-player': '2 Player', girls: 'Girls', 'dress-up': 'Girls', cooking: 'Cooking', clicker: 'Clicker', idle: 'Clicker', action: 'Action', fighting: 'Action', adventure: 'Adventure', platform: 'Adventure', arcade: 'Arcade', casual: 'Hypercasual', hypercasual: 'Hypercasual', stickman: 'Stickman', multiplayer: 'Multiplayer', strategy: 'Puzzles', simulation: 'Arcade', 'tower-defense': 'Action', runner: 'Arcade', skill: 'Arcade', classics: 'Arcade', jigsaw: 'Puzzles', bubble: 'Puzzles' };
  const nice = s => String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  gpx.forEach((x, i) => {
    const cat = String(x.category || 'arcade').toLowerCase();
    const portrait = x.orientation === 'portrait';
    const g = {
      id: 'gpx-' + x.id, srcId: String(x.id), source: 'gpx', title: titleCase(clean(x.title)),
      description: clean(x.description || ''), instructions: '',
      embed: String(x.url || '').replace(/^http:/, 'https:'),
      thumb: String(x.banner || '').replace(/([?&])w=\d+/, '$1w=512'),
      w: portrait ? 600 : (x.width || 1280), h: portrait ? 1000 : (x.height || 720),
      rawCat: GPX_MAP[cat] || nice(cat), tags: [nice(cat)], mobile: true,
    };
    if (!g.title || !g.embed || !/sid=/.test(g.embed) || !g.thumb || g.description.length < 30 || isBlocked(g)) return;
    const key = g.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (seenTitle.has(key)) return;
    seenTitle.add(key);
    g.score = i * 0.6 + 0.3; g.r = { most: i * 0.8, hot: i * 0.8, best: i * 0.7, newest: Infinity };
    games.push(g);
  });
}

games.sort((a, b) => a.score - b.score);
// every filtered Playgama game stays; other sources fill the rest up to maxGames
{
  const pgCount = games.filter(g => g.source === 'pg' || g.source === 'gpx').length;
  let room = Math.max(0, cfg.maxGames - pgCount);
  games = games.filter(g => g.source === 'pg' || g.source === 'gpx' || room-- > 0);
}

// hand-written tips/FAQ for selected games (data/guides.json, keyed by slug)
const GUIDES = readJSON(path.join(ROOT, 'data/guides.json'), {});
// "where to start" picks and an FAQ for each collection page (data/topic-guides.json)
const TGUIDES = readJSON(path.join(ROOT, 'data/topic-guides.json'), {});

// our own games always first
const ours = readJSON(path.join(ROOT, 'data/our-games.json'), []).map(o => ({
  id: 'our-' + o.slug, own: true, slug: o.slug, title: o.title, description: o.description, instructions: o.instructions, short: o.short,
  embed: o.gmEmbedUrl || u(o.embed), thumb: u(o.thumb), cover: u(o.cover), video: o.video ? u(o.video) : null, screens: (o.screens || []).map(u),
  w: o.orientation === 'portrait' ? 600 : 1280, h: o.orientation === 'portrait' ? 1000 : 720, rawCat: o.category, tags: o.tags, studio: o.studio, studioUrl: o.studioUrl || null, promo: o.promo || null,
  score: -1, r: { most: -1, hot: -1, best: -1, newest: -1 }, cats: { main: o.category, all: [o.category] }, mobile: true,
}));

// games submitted by outside developers (data/community-games.json), embedded from their own site
const community = readJSON(path.join(ROOT, 'data/community-games.json'), []).map(o => ({
  id: 'com-' + o.slug, own: false, community: true, source: 'community', slug: o.slug, title: o.title, description: o.description, instructions: o.instructions, short: o.short,
  embed: o.embed, thumb: o.thumb, cover: o.cover || o.thumb, video: null, screens: o.screens || [],
  w: o.orientation === 'portrait' ? 600 : 1280, h: o.orientation === 'portrait' ? 1000 : 720, rawCat: o.category, tags: o.tags, studio: o.studio,
  score: 0.5, r: { most: 0.5, hot: 0.5, best: 0.5, newest: -0.5 }, cats: { main: o.category, all: [o.category, ...(o.extraCats || [])] }, mobile: true,
}));
games.unshift(...community);

// slugs
const usedSlugs = new Set([...ours, ...community].map(o => o.slug));
for (const g of games) {
  if (g.community) continue;
  let s = slugify(g.title);
  if (usedSlugs.has(s)) s = `${s}-${g.srcId}`.slice(0, 80);
  usedSlugs.add(s); g.slug = s; g.cats = catsFor(g);
}
const all = [...ours, ...games];
// game index for scripts/write-guides.mjs (not deployed; .cache/ is gitignored)
try {
  fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, '.cache/games.json'), JSON.stringify([...ours, ...games].map(g => ({
    slug: g.slug, title: g.title, source: g.source, cat: g.rawCat, tags: g.tags, score: g.score,
    description: g.description, instructions: g.instructions,
  }))));
} catch (e) { console.warn('games index not written: ' + e.message); }
const byCat = Object.fromEntries(CATS.map(c => [c.slug, []]));
for (const g of all) for (const c of g.cats.all) byCat[c]?.push(g);
byCat.mobile = all.filter(g => g.mobile);
const activeCats = CATS.filter(c => byCat[c.slug].length >= 8);
const top = (key, n) => games.filter(g => Number.isFinite(g.r[key])).sort((a, b) => a.r[key] - b.r[key]).slice(0, n);

// keyword collections ("mahjong", "escape room games"...): root-level SEO landing pages
const topics = readJSON(path.join(ROOT, 'data/topics.json'), []).map(t => {
  let list;
  if (t.match) {
    const re = new RegExp('(^|[^a-z0-9])(' + t.match + ')(?=$|[^a-z0-9])', 'i');
    list = all.filter(g => re.test(g.title) || (!t.titleOnly && re.test(g.tags.join(' , '))));
  } else {
    const seen = new Set(); list = [];
    for (const g of [...ours, ...top('best', 60), ...top('hot', 60), ...top('most', 60)]) if (!seen.has(g.id)) { seen.add(g.id); list.push(g); }
  }
  return { ...t, list: list.slice(0, 120) };
}).filter(t => t.list.length >= 8);

// ---------------------------------------------------------------- templates
const ICON_SVG = fs.readFileSync(path.join(ROOT, 'static/favicon.svg'), 'utf8').trim().replace('<svg ', '<svg aria-hidden="true" ');

function layout({ title, desc, canonical, body, jsonld = [], ogImage, noindex = false, bodyClass = '', preload = '', altPath = null, altLangs = null }) {
  if (title.length > 65) title = title.replace(` | ${cfg.name}`, '');
  if (title.length > 65) title = title.slice(0, 62).replace(/\s+\S*$/, '') + '…';
  // desc too short: pad with a generic but accurate sentence
  desc = String(desc || '');
  if (desc.length < 110) desc = (desc + (desc ? ' ' : '') + `Play free online at ${cfg.name}: no download, no sign-up, works on PC and mobile.`).slice(0, 160);
  const img = ogImage || abs('/assets/og.png');
  // hreflang: every language this exact page exists in, so Google serves the right one per country
  const langsHere = altPath ? ['en', ...(altLangs || LANGS.map(l => l.code))] : [];
  const alt = langsHere.length > 1
    ? langsHere.map(l => `<link rel="alternate" hreflang="${esc(l === 'en' ? 'en' : (LANGS.find(x => x.code === l) || {}).hreflang || l)}" href="${esc(absIn(l, altPath))}">`).join('\n')
      + `\n<link rel="alternate" hreflang="x-default" href="${esc(absIn('en', altPath))}">`
    : '';
  return `<!doctype html>
<html lang="${esc(LANG)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
${alt}
<meta name="robots" content="${noindex ? 'noindex,follow' : 'index,follow,max-image-preview:large,max-snippet:-1'}">
${preload ? `<link rel="preload" as="image" href="${esc(preload)}" fetchpriority="high">` : ''}
${cfg.ga4 ? `<script async src="https://www.googletagmanager.com/gtag/js?id=${esc(cfg.ga4)}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${esc(cfg.ga4)}');</script>` : ''}
${cfg.adsenseClient ? `<meta name="google-adsense-account" content="${esc(cfg.adsenseClient)}">\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(cfg.adsenseClient)}" crossorigin="anonymous"></script>` : ''}
<meta name="application-name" content="${esc(cfg.name)}">
<meta name="apple-mobile-web-app-title" content="${esc(cfg.shortName)}">
<link rel="apple-touch-icon" href="${ur('/assets/icon-180.png')}">
<meta property="og:locale" content="en_US">
<meta property="og:image:alt" content="${esc(title)}">${cfg.gsc ? `\n<meta name="google-site-verification" content="${esc(cfg.gsc)}">` : ''}${cfg.bing ? `\n<meta name="msvalidate.01" content="${esc(cfg.bing)}">` : ''}${cfg.ahrefs ? `\n<meta name="ahrefs-site-verification" content="${esc(cfg.ahrefs)}">` : ''}
<meta name="theme-color" content="#0f1020">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(cfg.name)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(img)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${ur('/favicon.svg')}" type="image/svg+xml">
<link rel="manifest" href="${ur('/manifest.webmanifest')}">
<link rel="preconnect" href="https://img.gamemonetize.com" crossorigin>
<link rel="stylesheet" href="${ur('/assets/style.css')}?v=${BUILD_ID}">
${jsonld.map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}
</head>
<body class="${bodyClass}">
<a class="skip" href="#main">${esc(tr('Skip to content'))}</a>
<header class="top">
  <button class="menu-btn" aria-label="${esc(tr('Open categories'))}" aria-expanded="false" data-menu>☰</button>
  <a class="logo" href="${u('/')}">${ICON_SVG}<span>${esc(cfg.name)}</span></a>
  <form class="search" action="${u('/search/')}" role="search">
    <input type="search" name="q" placeholder="${esc(tr('Search games'))}" aria-label="${esc(tr('Search games'))}" autocomplete="off">
  </form>
</header>
<div class="wrap">
<nav class="side" aria-label="${esc(tr('Categories'))}">
  <a href="${u('/')}"><i>🏠</i>${esc(tr('Home'))}</a>
  <a href="${u('/new/')}"><i>🆕</i>${esc(tr('New games'))}</a>
  <a href="${u('/popular/')}"><i>🔥</i>${esc(tr('Most played'))}</a>
  <a href="${ur('/our-games/')}"><i>🫧</i>${esc(tr('Our games'))}</a>
  <a href="${ur('/submit-game/')}"><i>&#128228;</i>${esc(tr('Submit your game'))}</a>
  <hr>
  ${activeCats.map(c => `<a href="${cHref(c.slug)}"><i>${CAT_ICON[c.slug] || '🎮'}</i>${esc((catTr(c.slug) || {}).name || c.name)}</a>`).join('\n  ')}
</nav>
<main id="main">
${body}
</main>
</div>
<footer class="foot">
  <p><strong>${esc(cfg.name)}</strong> — ${esc(cfg.slogan)} ${esc(cfg.tagline)}</p>
  <p><a href="${ur('/about/')}">${esc(tr('About'))}</a> · <a href="${ur('/contact/')}">${esc(tr('Contact'))}</a> &middot; <a href="${ur('/submit-game/')}">${esc(tr('Submit your game'))}</a> · <a href="${ur('/privacy/')}">${esc(tr('Privacy Policy'))}</a> · <a href="${ur('/terms/')}">Terms</a> · <a href="${u('/all/')}">All games</a> · <a href="#" data-consent-open>Cookie settings</a></p>
  ${langsHere.length > 1 ? `<p class="foot-langs">${langsHere.map(l => l === LANG ? `<strong>${esc(l === 'en' ? 'English' : (LANGS.find(x => x.code === l) || {}).name || l)}</strong>` : `<a href="${esc(absIn(l, altPath))}" hreflang="${esc(l)}">${esc(l === 'en' ? 'English' : (LANGS.find(x => x.code === l) || {}).name || l)}</a>`).join(' · ')}</p>` : ''}
  <p class="foot-topics">${topics.filter(t => LANG === 'en' || (CATTR[LANG] || {})['topic:' + t.slug]).slice(0, 14).map(t => `<a href="${tHref(t.slug)}">${esc((catTr('topic:' + t.slug) || {}).h1 || t.h1)}</a>`).join(' · ')}</p>
  <p class="muted">© ${YEAR} ${esc(cfg.name)} by ${esc(cfg.studio)}. All games are the property of their respective developers and are provided through official distribution partners.</p>
</footer>
${cfg.adsenseClient ? '' : `<div class="consent" hidden data-consent>
  <p>We and our game partners use cookies to run the site, show ads inside games and measure performance. You can accept or reject non-essential cookies. <a href="${u('/privacy/')}">Privacy Policy</a></p>
  <div><button class="btn ghost" data-consent-reject>Reject</button><button class="btn" data-consent-accept>Accept</button></div>
</div>`}
<script>window.SITE={base:${JSON.stringify(B)}};</script>
<script src="${ur('/assets/app.js')}?v=${BUILD_ID}" defer></script>
</body>
</html>`;
}

const card = (g, eager = false) => `<a class="card${g.own ? ' own' : ''}${g.mobile ? '' : ' dm'}" href="${gHref(g)}"><img src="${esc(g.thumb)}" alt="${esc(g.title)}" width="512" height="384" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"><span>${esc(g.title)}</span>${g.own ? '<b class="badge">Our game</b>' : ''}</a>`;
const row = (title, href, list, eager = false) => list.length ? `<section class="row"><div class="row-h"><h2>${esc(title)}</h2>${href ? `<a href="${href}">See all ›</a>` : ''}</div><div class="grid">${list.map(g => card(g, eager)).join('')}</div></section>` : '';
const crumbs = items => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });

function pager(baseHref, page, pages) {
  if (pages <= 1) return '';
  const href = p => p === 1 ? baseHref : `${baseHref}${p}/`;
  let h = '<nav class="pager" aria-label="Pages">';
  if (page > 1) h += `<a href="${href(page - 1)}" rel="prev">‹ Prev</a>`;
  for (let p = 1; p <= pages; p++) h += p === page ? `<span aria-current="page">${p}</span>` : `<a href="${href(p)}">${p}</a>`;
  if (page < pages) h += `<a href="${href(page + 1)}" rel="next">Next ›</a>`;
  return h + '</nav>';
}

const sitemap = [];
const addUrl = (p, prio = 0.5, image = null) => sitemap.push({ loc: abs(p), prio, image });

// ---------------------------------------------------------------- build
// empty dist without removing the folder itself (Windows may lock the folder handle)
fs.mkdirSync(DIST, { recursive: true });
for (const f of fs.readdirSync(DIST)) fs.rmSync(path.join(DIST, f), { recursive: true, force: true, maxRetries: 5 });
fs.cpSync(path.join(ROOT, 'static'), DIST, { recursive: true });

// Everything below is produced once per language: English at the root, each other language under /<code>/.
function emitContent() {
  // A language appears on the site only once its text exists. Until then it emits nothing,
  // so Google never sees an English page duplicated under /es/, /de/ and so on.
  if (LANG !== 'en' && Object.keys(UI[LANG] || {}).length < 20) return;
  const catOK = c => LANG === 'en' || !!catTr(c);
  const gameOK = g => LANG === 'en' || !!tgame(g);
  // HOME
  {
    const o = ours[0];
    const hero = o ? `<section class="hero">
    <div class="hero-media">
      ${o.video ? `<video src="${esc(o.video)}" poster="${esc(o.cover)}" muted loop playsinline preload="none" data-hover-play></video>` : `<img src="${esc(o.cover)}" alt="${esc(o.title)}">`}
    </div>
    <div class="hero-text">
      <p class="eyebrow">🫧 ${esc(tr('Our game'))} · ${esc(tr('by'))} ${esc(o.studio)}</p>
      <h2>${esc(o.title)}</h2>
      <p>${esc(o.short)}</p>
      <a class="btn big" href="${gHref(o)}">▶ ${esc(tr('Play now — free'))}</a>
    </div>
  </section>` : '';
    const catTiles = `<section class="row"><div class="row-h"><h2>${esc(tr('Categories'))}</h2></div><div class="cats">${activeCats.filter(c => catOK(c.slug)).map(c => `<a href="${cHref(c.slug)}"><i>${CAT_ICON[c.slug] || '🎮'}</i>${esc((catTr(c.slug) || {}).name || c.name)}<small>${byCat[c.slug].length}</small></a>`).join('')}</div></section>`;
    const body = `<header class="welcome"><h1>${esc(cfg.name)} <span>— ${esc(tr(cfg.slogan))}</span></h1><p>${all.length.toLocaleString('en')}+ ${esc(tr('free online games. Play instantly on PC, tablet and phone — no downloads, no sign-up.'))}</p><p class="dev-cta">${esc(tr('Made a web game?'))} <a href="${ur('/submit-game/')}">${esc(tr('Submit your game'))}</a> ${esc(tr('and reach new players for free.'))}</p></header>
  ${hero}
  <section class="row" data-recent hidden><div class="row-h"><h2>${esc(tr('Continue playing'))}</h2></div><div class="grid"></div></section>
  ${row('🔥 ' + tr('Trending now'), u('/popular/'), top('hot', 18), true)}
  ${row('⭐ ' + tr('Most played'), u('/popular/'), top('most', 18))}
  ${row('🆕 ' + tr('New games'), u('/new/'), top('newest', 18))}
  ${catTiles}
  <section class="row"><div class="row-h"><h2>${esc(tr('Popular collections'))}</h2></div><p class="chips">${topics.filter(t => catOK('topic:' + t.slug)).map(t => `<a class="chip" href="${tHref(t.slug)}">${esc((catTr('topic:' + t.slug) || {}).h1 || t.h1)}</a>`).join('')}</p></section>
  ${row('🏆 ' + tr('Best games'), null, top('best', 18))}
  ${activeCats.filter(c => catOK(c.slug)).map(c => row(`${CAT_ICON[c.slug] || ''} ${(catTr(c.slug) || {}).h1 || c.h1}`, cHref(c.slug), byCat[c.slug].slice(0, 12))).join('\n')}
  <section class="seo-text"><h2>${esc(tr('Free online games on'))} ${esc(cfg.name)}</h2><p>${esc(cfg.name)} ${esc(tr('is a hand-picked collection of'))} ${all.length.toLocaleString('en')} ${esc(tr('free browser games. Every game runs instantly on your computer, tablet or phone, with no downloads, no installs and no account. Play action, puzzle, racing, sports, clicker and 2 player games, and come back every day for new titles.'))}</p></section>`;
    write('index.html', layout({
      title: `${cfg.name} — ${tr('Free Online Games, Play Instantly')}`,
      desc: `${tr(cfg.slogan)} ${tr('Play')} ${all.length.toLocaleString('en')}+ ${tr('free online games: action, puzzle, racing, 2 player, clicker and more. No downloads, works on PC & mobile.')}`,
      canonical: abs('/'), body, altPath: '/', altLangs: LANGS.filter(l => Object.keys(UI[l.code] || {}).length >= 20).map(l => l.code),
      jsonld: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: cfg.name, alternateName: cfg.name.replace(/\s+/g, ''), url: abs('/'), potentialAction: { '@type': 'SearchAction', target: abs('/search/') + '?q={search_term_string}', 'query-input': 'required name=search_term_string' } },
        { '@context': 'https://schema.org', '@type': 'Organization', name: cfg.name, url: abs('/'), logo: abs('/assets/icon-512.png'), slogan: cfg.slogan, parentOrganization: { '@type': 'Organization', name: cfg.studio } }],
    }));
    addUrl('/', 1.0);
  }

  // LIST PAGES (category, popular, new, all)
  function listPages(basePath, list, { title, h1, intro, desc, altPath = null, altLangs = null }) {
    const size = cfg.gridPageSize;
    const pages = Math.max(1, Math.ceil(list.length / size));
    for (let p = 1; p <= pages; p++) {
      const slice = list.slice((p - 1) * size, p * size);
      const pagePath = p === 1 ? basePath : `${basePath}${p}/`;
      const body = `<nav class="crumbs"><a href="${u('/')}">${esc(tr('Home'))}</a> › <span>${esc(h1)}</span></nav>
  <header class="page-h"><h1>${esc(h1)}${p > 1 ? ` — ${tr('page')} ${p}` : ''}</h1>${p === 1 ? `<p>${esc(intro)}</p>` : ''}</header>
  <div class="grid">${slice.map((g, i) => card(g, i < 8)).join('')}</div>
  ${pager(u(basePath), p, pages)}`;
      write(path.join(pagePath, 'index.html'), layout({
        title: p === 1 ? title : `${h1} — ${tr('Page')} ${p} | ${cfg.name}`,
        desc, canonical: abs(pagePath), body,
        ...(p === 1 && altPath ? { altPath, altLangs } : {}),
        jsonld: [crumbs([[tr('Home'), abs('/')], [h1, abs(basePath)]]),
          { '@context': 'https://schema.org', '@type': 'CollectionPage', name: h1, url: abs(pagePath),
            mainEntity: { '@type': 'ItemList', numberOfItems: slice.length, itemListElement: slice.slice(0, 20).map((g, i) => ({ '@type': 'ListItem', position: (p - 1) * size + i + 1, url: abs(`/games/${g.slug}/`), name: g.title })) } }],
      }));
      addUrl(pagePath, p === 1 ? 0.8 : 0.4);
    }
  }
  for (const c of activeCats) {
    if (!catOK(c.slug)) continue;
    listPages(`/c/${c.slug}/`, byCat[c.slug], {
      title: `${(catTr(c.slug) || {}).h1 || c.h1} — ${tr('Play Free Online')} | ${cfg.name}`,
      h1: (catTr(c.slug) || {}).h1 || c.h1, intro: catIntro(c.slug),
      desc: trunc(`${tr('Play')} ${byCat[c.slug].length}+ ${tr('free')} ${((catTr(c.slug) || {}).h1 || c.h1).toLowerCase()} ${tr('online.')} ${catIntro(c.slug)}`, 158),
      altPath: `/c/${c.slug}/`, altLangs: LANGS.filter(l => (CATTR[l.code] || {})[c.slug]).map(l => l.code),
    });
  }
  listPages('/popular/', [...ours, ...top('most', 300)], { altPath: '/popular/', altLangs: uiLangs(), title: `${tr('Most Played Free Online Games')} | ${cfg.name}`, h1: tr('Most played games'), intro: tr('The games players love most right now. All free, all instant.'), desc: tr('The most played free online games right now. Play instantly in your browser, no download needed.') });
  listPages('/new/', top('newest', 192), { altPath: '/new/', altLangs: uiLangs(), title: `${tr('New Free Online Games')} | ${cfg.name}`, h1: tr('New games'), intro: tr('Fresh games added to the collection. Check back daily.'), desc: tr('Brand new free online games, added every day. Play instantly on PC and mobile.') });
  listPages('/all/', [...all].sort((a, b) => a.title.localeCompare(b.title)), { altPath: '/all/', altLangs: uiLangs(), title: `${tr('All Games A–Z')} | ${cfg.name}`, h1: tr('All games A–Z'), intro: `${tr('Every game on')} ${cfg.name}, ${tr('sorted alphabetically.')}`, desc: `${tr('Browse all')} ${all.length} ${tr('free online games on')} ${cfg.name} ${tr('from A to Z.')}` });

  // TOPIC PAGES
  const slugSet = new Set(all.map(g => g.slug));
  const topicOf = new Map();
  for (const t of topics) for (const g of t.list) if (!topicOf.has(g.id)) topicOf.set(g.id, t);
  for (const t of topics) {
    if (!catOK('topic:' + t.slug)) continue;
    const TT = catTr('topic:' + t.slug) || {};
    const TG0 = LANG === 'en' ? TGUIDES[t.slug] : ((catTr('topic:' + t.slug) || {}).guide || null);
    const TG = TG0 ? (() => { const picks = (TG0.picks || []).filter(p => slugSet.has(p.slug)); return picks.length >= 3 ? { ...TG0, picks } : null; })() : null;
    const th1 = TT.h1 || t.h1, tkw = TT.kw || t.kw;
    const tintro = Array.isArray(TT.intro) ? TT.intro : (typeof TT.intro === 'string' ? [TT.intro] : t.intro);
    const others = topics.filter(o => o.slug !== t.slug).slice(0, 12);
    const body = `<nav class="crumbs"><a href="${u('/')}">${esc(tr('Home'))}</a> › <span>${esc(th1)}</span></nav>
  <header class="page-h"><h1>${esc(th1)}</h1>${tintro.map(p => `<p>${esc(p)}</p>`).join('')}</header>
  ${t.promo && LANG === 'en' ? `<section class="topic-guide topic-promo">${t.promo}</section>` : ''}
  <div class="grid">${t.list.map((g, i) => card(g, i < 8)).join('')}</div>
  ${TG ? `<section class="topic-guide">
    <h2>${esc(tr('Where to start'))}</h2>
    <ul class="picks">${TG.picks.map(p => `<li><a href="${gHref({ slug: p.slug })}">${esc(p.title)}</a> — ${esc(p.line)}</li>`).join('')}</ul>
    <h2>${esc(tr('FAQ'))}</h2>${TG.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('')}
  </section>` : ''}
  <section class="row" style="margin-top:28px"><div class="row-h"><h2>${esc(tr('More collections'))}</h2></div><p class="chips">${others.map(o => `<a class="chip" href="${tHref(o.slug)}">${esc((catTr('topic:' + o.slug) || {}).h1 || o.h1)}</a>`).join('')}</p></section>`;
    write(`${t.slug}/index.html`, layout({
      title: `${th1} — ${tr('Play Free Online')} | ${cfg.name}`,
      desc: trunc(`${t.list.length}+ ${tr('free')} ${tkw}. ${tintro[0]}`, 158), canonical: abs(`/${t.slug}/`), body,
      altPath: `/${t.slug}/`, altLangs: LANGS.filter(l => (CATTR[l.code] || {})['topic:' + t.slug]).map(l => l.code),
      jsonld: [crumbs([[tr('Home'), abs('/')], [th1, abs(`/${t.slug}/`)]]),
        ...(TG && TG.faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: TG.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] : []),
        { '@context': 'https://schema.org', '@type': 'CollectionPage', name: th1, url: abs(`/${t.slug}/`), description: tintro[0],
          mainEntity: { '@type': 'ItemList', numberOfItems: t.list.length, itemListElement: t.list.slice(0, 20).map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: abs(`/games/${g.slug}/`), name: g.title })) } }],
    }));
    addUrl(`/${t.slug}/`, 0.8);
  }

  // GAME PAGES
  const catIndex = Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, new Map(v.map((g, i) => [g.id, i]))]));
  for (const g of all) {
    if (!gameOK(g)) continue;
    const main = CAT_BY[g.cats.main] || CATS[0];
    const pool = byCat[main.slug];
    const idx = catIndex[main.slug].get(g.id) ?? 0;
    const similar = [];
    for (let k = 1; similar.length < 12 && k < pool.length; k++) { const s = pool[(idx + k) % pool.length]; if (s.id !== g.id) similar.push(s); }
    if (!g.own && ours.length) similar.splice(1, 0, ours.find(o => o.cats.main === g.cats.main) || ours[0]);
    const sim = similar.slice(0, 12);

    const portrait = g.h > g.w * 1.05;
    const pageUrl = abs(`/games/${g.slug}/`);
    // pages with a guide get a more specific snippet (the guide intro) and a title that promises tips, which app-store results do not offer
    const GD = (tgame(g) || {}).guide || (LANG === 'en' ? GUIDES[g.slug] : null);
    const gdesc = gDesc(g), ginstr = gInstr(g);
    const desc = trunc(`${tr('Play')} ${g.title} ${tr('online for free.')} ${GD && GD.intro ? GD.intro + " " : ""}${gdesc}`, 158);
    const pageTitle = GD ? `${g.title} — ${tr('Play Free Online, Tips & FAQ')} | ${cfg.name}` : `${g.title} — ${tr('Play Online for Free')} | ${cfg.name}`;
    const tp = topicOf.get(g.id);
    const catLinks = (tp ? `<a class="chip" href="${tHref(tp.slug)}">${esc((catTr('topic:' + tp.slug) || {}).h1 || tp.h1)}</a>` : '') + g.cats.all.filter(c => CAT_BY[c]).map(c => `<a class="chip" href="${cHref(c)}">${esc((catTr(c) || {}).name || CAT_BY[c].name)}</a>`).join('');
    const tagText = g.tags.slice(0, 8).map(t => `<span class="chip ghost">${esc(t)}</span>`).join('');
    const body = `<nav class="crumbs"><a href="${u('/')}">${esc(tr('Home'))}</a> › <a href="${cHref(main.slug)}">${esc((catTr(main.slug) || {}).h1 || main.h1)}</a> › <span>${esc(g.title)}</span></nav>
  <section class="player${portrait ? ' portrait' : ''}" data-player data-src="${esc(g.embed)}" data-id="${esc(g.slug)}" data-title="${esc(g.title)}" data-thumb="${esc(g.thumb)}" style="--ar:${g.w}/${g.h}">
    <div class="stage">
      <img class="stage-bg" src="${esc(g.thumb)}" alt="" aria-hidden="true" fetchpriority="high">
      <div class="stage-ui">
        <img class="stage-thumb" src="${esc(g.thumb)}" alt="${esc(g.title)}" width="256" height="192">
        <h1>${esc(g.title)}</h1>
        <button class="btn big" data-play>▶ ${esc(tr('Play now'))}</button>${g.mobile ? '' : `\n      <p class="desk-note">💻 ${esc(tr('Best played on a computer with a keyboard'))}</p>`}
      </div>
    </div>
    <div class="bar">
      <strong>${esc(g.title)}</strong>
      <span class="spacer"></span>
      <button class="icon" data-like aria-label="${esc(tr('Add to favorites'))}" title="${esc(tr('Favorite'))}">♡</button>
      <button class="icon" data-share aria-label="${esc(tr('Share'))}" title="${esc(tr('Share'))}">↗</button>
      <button class="icon" data-fs aria-label="${esc(tr('Full screen'))}" title="${esc(tr('Full screen'))}">⛶</button>
    </div>
  </section>
  <div class="game-cols">
    <article class="about">
      <h2>${esc(tr('About'))} ${esc(g.title)}</h2>
      ${(LANG === 'en' && g.paras && g.paras.length > 1 ? g.paras : [gdesc]).map(p => `<p>${esc(p)}</p>`).join('\n    ')}
      ${ginstr ? `<h2>${esc(tr('How to play'))}</h2><p>${esc(ginstr)}</p>` : ''}
      ${GD ? `<h2>${esc(tr('Tips and tricks for'))} ${esc(g.title)}</h2>${GD.intro ? `<p>${esc(GD.intro)}</p>` : ''}<ul class="tips">${(GD.tips || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
      <p class="chips">${catLinks}${tagText}</p>
      <h2>${esc(tr('Game info'))}</h2>
      <dl class="info">
        <dt>${esc(tr('Genre'))}</dt><dd>${g.cats.all.filter(c => CAT_BY[c]).slice(0, 4).map(c => esc((catTr(c) || {}).name || CAT_BY[c].name)).join(', ')}</dd>
        <dt>${esc(tr('Platform'))}</dt><dd>${esc(g.mobile ? tr('Web browser (PC, Mac, Android, iPhone, tablet)') : tr('Web browser — best on PC / Mac'))}</dd>
        <dt>${esc(tr('Price'))}</dt><dd>${esc(tr('Free'))}</dd>
        <dt>${esc(tr('Screen'))}</dt><dd>${esc(portrait ? tr('Portrait — great on phones') : tr('Landscape'))}</dd>
        ${g.studio ? `<dt>${esc(tr('Developer'))}</dt><dd>${g.studioUrl ? `<a href="${esc(g.studioUrl)}" rel="noopener" target="_blank">${esc(g.studio)}</a>` : esc(g.studio)}</dd>` : ''}
        ${g.pgSlug ? `<dt>${esc(tr('Also on'))}</dt><dd><a href="https://playgama.com/game/${encodeURIComponent(g.pgSlug)}?clid=${encodeURIComponent(cfg.playgamaClid)}" rel="sponsored noopener" target="_blank">Playgama ↗</a></dd>` : ''}
      </dl>
      <h2>${esc(tr('FAQ'))}</h2>${GD ? (GD.faq || []).map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('') : ''}
      <h3>${esc(tr('Is this game free to play?'))}</h3><p>${esc(tr('Yes. It is completely free here. The game is supported by short ads.'))}</p>
      <h3>${esc(tr('Can I play this game on my phone?'))}</h3><p>${g.mobile ? tr('Yes. It runs in the browser on Android phones, iPhones and tablets as well as on PC and Mac — tap “Play now” and the game opens full screen.') : `${esc(g.title)} is made for computers and plays best with a keyboard and mouse. For phones, check out our <a href="${u('/c/mobile/')}">mobile games</a>.`}</p>
      <h3>${esc(tr('Do I need to download or sign up?'))}</h3><p>${esc(tr('No. There is nothing to install and no account needed. The game loads instantly in your browser.'))}</p>
      <p class="muted">${g.own ? `Made by ${g.studioUrl ? `<a href="${esc(g.studioUrl)}" rel="noopener" target="_blank">${esc(g.studio)}</a>` : esc(g.studio)} — the team behind ${esc(cfg.name)}.${g.promo && LANG === 'en' ? ` ${g.promo}` : ''}` : `${esc(tr('Like this game? Try more'))} <a href="${cHref(main.slug)}">${esc(((catTr(main.slug) || {}).h1 || main.h1).toLowerCase())}</a> or browse the <a href="${u('/popular/')}">most played games</a> on ${esc(cfg.name)}.`}</p>
    </article>
    <aside class="similar"><h2>${esc(tr('Similar games'))}</h2><div class="grid small">${sim.map(s => card(s)).join('')}</div></aside>
  </div>`;
    const ld = {
      '@context': 'https://schema.org', '@type': 'VideoGame', name: g.title, url: pageUrl, image: g.thumb.startsWith('http') ? g.thumb : abs(g.thumb.slice(B.length)),
      description: trunc(gdesc, 300), genre: g.cats.all.filter(c => CAT_BY[c]).map(c => CAT_BY[c].name), gamePlatform: ['Web browser', 'PC', 'Mobile'],
      applicationCategory: 'Game', operatingSystem: 'Any', playMode: g.cats.all.includes('two-player') || g.cats.all.includes('multiplayer') ? 'MultiPlayer' : 'SinglePlayer',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD', availability: 'https://schema.org/InStock' },
      ...(g.studio ? { author: { '@type': 'Organization', name: g.studio } } : {}),
    };
    write(`games/${g.slug}/index.html`, layout({
      title: pageTitle, desc, canonical: pageUrl, body, bodyClass: 'game-page', preload: g.thumb,
      altPath: `/games/${g.slug}/`, altLangs: langsFor(g).map(l => l.code),
      ogImage: g.thumb.startsWith('http') ? g.thumb : abs(g.thumb.slice(B.length)),
      jsonld: [ld, crumbs([['Home', abs('/')], [main.h1, abs(`/c/${main.slug}/`)], [g.title, pageUrl]])],
    }));
    addUrl(`/games/${g.slug}/`, g.own ? 0.9 : 0.6, { img: g.thumb.startsWith('http') ? g.thumb : abs(g.thumb.slice(B.length)), title: g.title });
  }

  // SEARCH
  if (LANG === 'en') write('search.json', JSON.stringify(all.map(g => [g.slug, g.title, g.thumb, g.cats.main, g.tags.slice(0, 6).join(' ')])));
  write('search/index.html', layout({
    title: `${tr('Search Games')} | ${cfg.name}`, desc: `${tr('Search')} ${all.length} ${tr('free online games.')}`, canonical: abs('/search/'), noindex: true,
    body: `<header class="page-h"><h1>${esc(tr('Search games'))}</h1></header><form class="search big" action="${u('/search/')}" role="search"><input type="search" name="q" placeholder="Type a game name or genre…" aria-label="Search" data-search-input autofocus></form><p class="muted" data-search-count></p><div class="grid" data-search-results></div>`,
  }));

}
for (const lang of ['en', ...LANGS.map(l => l.code)]) { LANG = lang; emitContent(); }
LANG = 'en';

// STATIC TEXT PAGES
const textPage = (slug, title, html, desc) => {
  write(`${slug}/index.html`, layout({ title: `${title} | ${cfg.name}`, desc, canonical: abs(`/${slug}/`), body: `<article class="text"><h1>${esc(title)}</h1>${html}</article>` }));
  addUrl(`/${slug}/`, 0.2);
};
const today = new Date().toISOString().slice(0, 10);
textPage('our-games', 'Our Games', `<p class="lead">Games made by ${esc(cfg.studio)}, the team behind ${esc(cfg.name)} and a real escape room studio from Novi Sad, Serbia. Free, no download, no sign-up.</p>
<div class="grid">${ours.map(o => card(o)).join('')}</div>
${ours.map(o => `<h2><a href="${u(`/games/${o.slug}/`)}">${esc(o.title)}</a></h2><p>${esc(o.short || '')}</p>`).join('')}`, `Free browser games made by ${cfg.studio}: ${ours.map(o => o.title).join(', ')}.`);

textPage('about', 'About us', `<p>${esc(cfg.name)} is a free online games website made by <strong>${esc(cfg.studio)}</strong>, an independent game studio from Novi Sad, Serbia. We build our own browser games (like <a href="${u('/games/bubble-wrap/')}">Bubble Wrap</a>) and hand-pick the best free HTML5 games from trusted distribution partners, so you can play instantly on any device.</p>
<h2>What makes us different</h2><ul><li><strong>Curated, not cluttered.</strong> We skip low-quality knock-offs and games that copy famous brands.</li><li><strong>Instant play.</strong> No downloads, no account, no installs.</li><li><strong>Fast on phones.</strong> The site is lightweight and works on slow connections.</li></ul>
<p>The games are free for you because they show short ads, which support the developers who make them and keep this site running.</p>
<p>Questions or ideas? <a href="${u('/contact/')}">Get in touch</a>.</p>`, `About ${cfg.name}: free online games by ${cfg.studio}.`);

{
  const subj = encodeURIComponent('Game submission: <your game title>');
  const body = encodeURIComponent('Game title:\nGame URL (HTML5, playable in an iframe):\nStudio / developer name:\nGenre:\nWorks on mobile? (yes/no):\nShort description (2-3 sentences):\nHow to play:\nThumbnail / cover image link (512x384 or larger):\nDo you own all rights to this game? (yes/no):\n');
  textPage('submit-game', 'Submit Your Game', `<p class="lead">Made an HTML5 game? Get it in front of new players on ${esc(cfg.name)}. Submitting is free.</p>
<p><a class="btn big" href="mailto:${esc(cfg.contactEmail)}?subject=${subj}&amp;body=${body}">&#9993; Submit your game by email</a></p>
<h2>What we are looking for</h2>
<ul><li>HTML5 / WebGL games that run in a browser and can be embedded in an iframe</li><li>Games you made yourself or have the rights to publish</li><li>Family-friendly content: no adult content, gambling or hate</li><li>Works on desktop; mobile support is a big plus</li><li>Your own ads inside the game (e.g. your publisher SDK) are fine, so you keep your revenue</li></ul>
<h2>How it works</h2>
<ol><li>Send us the link to your game and a short description using the button above, or email <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>.</li><li>We play it and check quality, performance and content, usually within a week.</li><li>If it is a good fit, we publish it with its own page, description and a link to your studio.</li></ol>
<h2>Good to know</h2>
<p>We do not host files: the game stays on your server or your distribution platform, and you can ask us to remove it at any time. Games from other people that you do not own will not be accepted.</p>`, `Submit your HTML5 game to ${cfg.name} and reach new players for free.`);
}
textPage('contact', 'Contact', `<p>We'd love to hear from you — feedback, bug reports, game suggestions or business inquiries.</p>
<p>Email: <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a></p>
<h2>Game developers</h2><p>Made a great HTML5 game? <a href="${ur('/submit-game/')}">Submit it here</a> and we'll take a look.</p>
<h2>Copyright concerns</h2><p>If you believe a game on this site infringes your rights, email us with the game URL and details, and we will review and remove it promptly.</p>`, `Contact ${cfg.name}.`);

textPage('privacy', 'Privacy Policy', `<p class="muted">Last updated: ${today}</p>
<p>This Privacy Policy explains how ${esc(cfg.name)} ("we", "us"), operated by ${esc(cfg.studio)}, handles information when you visit ${esc(cfg.url)}.</p>
<h2>1. Information we collect</h2><p>We do not ask you to create an account and we do not collect your name, email or other directly identifying information unless you contact us by email. Our website stores small amounts of data in your own browser (local storage), such as your recently played and favorite games and your cookie choice. This data never leaves your device.</p>
<h2>2. Games and advertising partners</h2><p>Games on this site are provided by third-party distribution platforms and shown inside embedded frames. These partners serve advertisements inside the games and may use cookies, device identifiers and similar technologies to deliver, measure and personalize ads and to prevent fraud. Our partners include:</p>
<ul>${cfg.adsenseClient ? '<li>Google AdSense — <a href="https://policies.google.com/privacy" rel="nofollow noopener" target="_blank">Privacy Policy</a></li>' : ''}<li>Playgama — <a href="https://playgama.com/privacy-policy" rel="nofollow noopener" target="_blank">Privacy Policy</a></li><li>GamePix — <a href="https://www.gamepix.com/privacy-policy" rel="nofollow noopener" target="_blank">Privacy Policy</a></li><li>GameMonetize — <a href="https://gamemonetize.com/privacypolicy" rel="nofollow noopener" target="_blank">Privacy Policy</a></li></ul>
<p>These partners act as independent data controllers for the data they collect. Please read their policies to learn how they process data and how to opt out of personalized advertising.</p>
<h2>3. Cookies and your choices</h2><p>Visitors in the EEA, UK and Switzerland are asked for consent through Google's certified consent tool before personalized ads are shown.${cfg.adsenseClient ? ' This site uses Google AdSense; Google uses cookies to serve ads based on your visits to this and other websites. You can opt out of personalized advertising in <a href="https://adssettings.google.com/" rel="nofollow noopener" target="_blank">Google Ads Settings</a>. Learn how <a href="https://policies.google.com/technologies/partner-sites" rel="nofollow noopener" target="_blank">Google uses data from partner sites</a>.' : ''} When you first visit, we may ask whether you accept non-essential cookies. You can change your choice at any time using "Cookie settings" in the footer. You can also block or delete cookies in your browser settings and opt out of personalized ads at <a href="https://www.youronlinechoices.eu/" rel="nofollow noopener" target="_blank">youronlinechoices.eu</a> or <a href="https://optout.aboutads.info/" rel="nofollow noopener" target="_blank">aboutads.info</a>.</p>
<h2>4. Hosting and logs</h2><p>Our hosting provider may process technical data such as IP address and browser type in server logs for security and performance purposes.</p>
<h2>5. Legal basis (GDPR)</h2><p>Where the GDPR applies, non-essential cookies and personalized advertising are based on your consent, which you can withdraw at any time. Essential storage is based on our legitimate interest in running the site.</p>
<h2>6. Children</h2><p>Our site is intended for a general audience. We do not knowingly collect personal information from children under 13 (or under 16 in the EEA). If you believe a child has provided us personal information, contact us and we will delete it.</p>
<h2>7. Your rights</h2><p>Depending on where you live, you may have the right to access, correct, delete or restrict processing of your personal data. Contact us at <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>.</p>
<h2>8. Changes</h2><p>We may update this policy. The date at the top shows the latest version.</p>`, `Privacy Policy of ${cfg.name}.`);

textPage('terms', 'Terms of Use', `<p class="muted">Last updated: ${today}</p>
<p>By using ${esc(cfg.name)} (the "Site") you agree to these Terms. If you do not agree, please do not use the Site.</p>
<h2>1. The service</h2><p>The Site offers free browser games. Most games are created by third-party developers and provided through official distribution partners under license. All games, names and trademarks belong to their respective owners.</p>
<h2>2. Acceptable use</h2><p>You agree not to misuse the Site, including attempting to disrupt it, scraping it in bulk, copying games from it, or using bots or automated traffic.</p>
<h2>3. Advertising</h2><p>Games may display advertisements served by our partners. We are not responsible for the content of third-party ads or websites they link to.</p>
<h2>4. Intellectual property</h2><p>The Site's design, text and our own games (made by ${esc(cfg.studio)}) are protected by copyright. If you believe content on the Site infringes your rights, contact us at <a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a> and we will respond promptly.</p>
<h2>5. No warranty</h2><p>The Site and games are provided "as is" without warranties of any kind. Games may be changed or removed at any time.</p>
<h2>6. Limitation of liability</h2><p>To the extent permitted by law, we are not liable for any damages arising from your use of the Site.</p>
<h2>7. Changes</h2><p>We may update these Terms at any time. Continued use of the Site means you accept the updated Terms.</p>`, `Terms of Use of ${cfg.name}.`);

write('404.html', layout({ title: `Page not found | ${cfg.name}`, desc: 'Page not found.', canonical: abs('/404.html'), noindex: true,
  body: `<article class="text center"><h1>404 — Game over?</h1><p>This page doesn't exist (anymore). But there are ${all.length} games that do.</p><p><a class="btn big" href="${u('/')}">Back to games</a></p></article>${row('Try one of these', null, top('hot', 12))}` }));

// SITEMAP / ROBOTS / MANIFEST
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${sitemap.map(s => `<url><loc>${esc(s.loc)}</loc><lastmod>${today}</lastmod><priority>${s.prio.toFixed(1)}</priority>${s.image ? `<image:image><image:loc>${esc(s.image.img)}</image:loc></image:image>` : ''}</url>`).join('\n')}\n</urlset>\n`);
write('robots.txt', `User-agent: *\nAllow: /\nDisallow: ${B}/search/\n\nSitemap: ${abs('/sitemap.xml')}\n`);
write('manifest.webmanifest', JSON.stringify({ name: cfg.name, short_name: cfg.shortName, start_url: u('/'), display: 'standalone', background_color: '#0f1020', theme_color: '#0f1020', description: `${cfg.slogan} ${cfg.tagline}`, icons: [{ src: u('/assets/icon-192.png'), sizes: '192x192', type: 'image/png' }, { src: u('/assets/icon-512.png'), sizes: '512x512', type: 'image/png', purpose: 'any maskable' }, { src: u('/favicon.svg'), sizes: 'any', type: 'image/svg+xml' }] }));
if (process.env.CNAME) write('CNAME', process.env.CNAME + '\n');
// ads.txt: AdSense line is added automatically once adsenseClient is set; partner lines come from config.adsTxt
{
  const lines = [...(cfg.adsTxt || [])];
  if (cfg.adsenseClient) lines.unshift(`google.com, ${cfg.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0`);
  // partner ads.txt blocks stored as files (e.g. GamePix property snippet)
for (const f of ['data/ads-gamepix.txt']) { const p = path.join(ROOT, f); if (fs.existsSync(p)) lines.push('', ...fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/).map(l => l.trimEnd())); }
if (lines.length) write('ads.txt', lines.join('\n') + '\n');
}
write('.nojekyll', '');

// what the translator needs to know: every UI phrase the pages actually use
try {
  fs.mkdirSync(path.join(ROOT, '.cache'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, '.cache/phrases.json'), JSON.stringify([...PHRASES].sort(), null, 1));
  fs.writeFileSync(path.join(ROOT, '.cache/topic-games.json'), JSON.stringify(topics.map(t => ({
    slug: t.slug, h1: t.h1, kw: t.kw,
    games: t.list.filter(g => !g.own).slice(0, 18).map(g => ({ slug: g.slug, title: g.title, description: g.description })),
  }))));
  fs.writeFileSync(path.join(ROOT, '.cache/cats.json'), JSON.stringify({
    cats: activeCats.map(c => ({ key: c.slug, name: c.name, h1: c.h1, intro: CAT_INTRO[c.slug] || '' })),
    topics: topics.map(t => ({ key: 'topic:' + t.slug, h1: t.h1, kw: t.kw, intro: t.intro })),
  }, null, 1));
} catch (e) { console.warn('phrase dump failed: ' + e.message); }

console.log(`Built ${all.length} games (${ours.length} ours), ${activeCats.length} categories, ${sitemap.length} URLs in sitemap -> dist/`);
