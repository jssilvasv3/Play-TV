/* app.js — Play TV com a lógica do XPlayer (xplayer-main), sem alterar o visual.
 *
 * Lógica portada:
 *  - lib/data/models/iptv_presets.dart → kIptvPresets / kDefaultPreset
 *  - lib/extensions/m3u.dart           → parseM3U (id = tvg-id/name UPPERCASE, merge por id)
 *  - lib/utils/channel_filter.dart     → filterChannels / distinctGroups
 *  - lib/utils/recent_util.dart        → mergeRecent (kRecentMax = 20)
 *  - lib/data/repositories/*.dart      → localStorage (favoritos, recentes, fontes, cache)
 *  - lib/providers/media_provider.dart → fetchChannels (cache-first + force refresh)
 */
'use strict';

/* ================= Presets (iptv_presets.dart) ================= */
const IPTV_BASE = 'https://iptv-org.github.io';
const kDefaultPreset = { name: '🇧🇷 Brasil', url: `${IPTV_BASE}/iptv/countries/br.m3u` };
const kIptvPresets = [
  { name: '🇧🇷 Brasil', url: `${IPTV_BASE}/iptv/countries/br.m3u` },
  { name: '🇵🇹 Portugal', url: `${IPTV_BASE}/iptv/countries/pt.m3u` },
  { name: '🇺🇸 Estados Unidos', url: `${IPTV_BASE}/iptv/countries/us.m3u` },
  { name: '🇦🇷 Argentina', url: `${IPTV_BASE}/iptv/countries/ar.m3u` },
  { name: '🇪🇸 Espanha', url: `${IPTV_BASE}/iptv/countries/es.m3u` },
  { name: '🇫🇷 França', url: `${IPTV_BASE}/iptv/countries/fr.m3u` },
  { name: '🇮🇹 Itália', url: `${IPTV_BASE}/iptv/countries/it.m3u` },
  { name: '🇬🇧 Reino Unido', url: `${IPTV_BASE}/iptv/countries/uk.m3u` },
  { name: '🇩🇪 Alemanha', url: `${IPTV_BASE}/iptv/countries/de.m3u` },
  { name: '🇲🇽 México', url: `${IPTV_BASE}/iptv/countries/mx.m3u` },
  { name: '🇨🇴 Colômbia', url: `${IPTV_BASE}/iptv/countries/co.m3u` },
  { name: '🇨🇱 Chile', url: `${IPTV_BASE}/iptv/countries/cl.m3u` },
  { name: '🇺🇾 Uruguai', url: `${IPTV_BASE}/iptv/countries/uy.m3u` },
  { name: '🇨🇦 Canadá', url: `${IPTV_BASE}/iptv/countries/ca.m3u` },
  { name: '🇯🇵 Japão', url: `${IPTV_BASE}/iptv/countries/jp.m3u` }
];

/* ================= Filtros (channel_filter.dart) ================= */
function filterChannels(all, query = '', group = null) {
  const q = (query || '').trim().toLowerCase();
  const g = group || null;
  return all.filter(c => {
    const matchQ = !q || c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
    const matchG = !g || c.sources.some(s => (s.groupTitle || '').split(';').map(x => x.trim()).includes(g));
    return matchQ && matchG;
  });
}
function distinctGroups(all) {
  const seen = new Set(); const out = [];
  for (const c of all) for (const s of c.sources) {
    // Grupos compostos ("Education;Outdoor") são divididos em categorias individuais.
    for (const g of (s.groupTitle || '').split(';')) {
      const t = g.trim();
      if (t && !seen.has(t)) { seen.add(t); out.push(t); }
    }
  }
  return out;
}

/* ================= Recentes (recent_util.dart) ================= */
const kRecentMax = 5;
function mergeRecent(current, played, max = kRecentMax) {
  const out = [played];
  for (const c of current) { if (c.id !== played.id) out.push(c); }
  return out.slice(0, max);
}

/* ================= Parser M3U (extensions/m3u.dart) ================= */
/* Valida se o texto é de facto uma playlist M3U (evita guardar/paginar HTML, ex. da página do site). */
function isM3U(text) {
  return /^\ufeff?#EXTM3U/i.test(text) || (text.includes('#EXTINF') && text.includes('http'));
}
function parseM3U(text) {
  const items = [];
  let cur = null;
  const attrRe = /([a-zA-Z0-9\-_]+)="([^"]*)"/g;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const attributes = {}; let m; attrRe.lastIndex = 0;
      while ((m = attrRe.exec(line))) attributes[m[1]] = m[2];
      const comma = line.indexOf(',');
      const title = comma >= 0 ? line.slice(comma + 1).trim() : '';
      cur = { attributes, title, groupTitle: attributes['group-title'] || '', link: '' };
    } else if (line.startsWith('#')) {
      /* #EXT-X-KEY etc.: sem DRM no web — ignorado */
    } else if (cur) {
      cur.link = line; items.push(cur); cur = null;
    }
  }
  const channels = items.map(it => ({
    id: (it.attributes['tvg-id'] || it.attributes['tvg-name'] || it.title || it.link).toUpperCase(),
    name: (it.attributes['tvg-name'] || it.title || it.link).toUpperCase(),
    logo: it.attributes['tvg-logo'] || '',
    sources: [{ title: it.title, link: it.link, groupTitle: it.groupTitle }],
  }));
  return mergeChannels(channels);
}
/* _mergeChannels do MediaProvider: junta fontes com o mesmo id. */
function mergeChannels(list) {
  const map = new Map();
  for (const c of list) {
    const ex = map.get(c.id);
    if (ex) { ex.sources.push(...c.sources); if (!ex.logo && c.logo) ex.logo = c.logo; }
    else map.set(c.id, c);
  }
  return [...map.values()];
}
/* ================= Storage (repositórios → localStorage) ================= */
const store = {
  get(k, fb) { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (_) { return fb; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} },
  del(k) { try { localStorage.removeItem(k); } catch (_) {} },
};
const K = {
  playlists: 'playtv.playlists', currentPl: 'playtv.currentPlaylistId',
  favorites: 'playtv.favorites', recents: 'playtv.recents',
  cache: id => `playtv.cache.${id}`,
};

/* ================= Estado (MediaProvider) ================= */
const state = {
  playlists: [], currentPlaylistId: -1,
  channels: [], favorites: [], recents: [],
  group: null,           // null = "Todos", '__fav__' = Favoritos
  loading: false, error: '',
  current: null, sourceIdx: 0,
};

/* ================= Definições (player_settings.dart + theme_settings.dart) ================= */
/* Espelha: showRecentModule / miniPlayerOnExit / gridSizeLevel / themeColor / sleep timer. */
const kThemePalette = [ // app_palette.dart (8 cores)
  { name: 'Verde',  value: '#00DC82' },
  { name: 'Azul',   value: '#2196F3' },
  { name: 'Ciano',  value: '#00BCD4' },
  { name: 'Roxo',   value: '#BA68C8' },
  { name: 'Rosa',   value: '#E91E63' },
  { name: 'Verm.',  value: '#F44336' },
  { name: 'Laranja',value: '#FF9800' },
  { name: 'Âmbar',  value: '#FFC107' },
];
// Larguras por nível (0 maior … 4 menor; 2 = padrão) — canal_size_dialog
const kCardSizes = [280, 250, 220, 190, 160];

let settings = store.get('playtv.settings', { showRecentModule: true, miniOnExit: true, gridSizeLevel: 2, themeColor: '#08a765', thumbBase: '', proxyBase: '' });
function saveSettings() { store.set('playtv.settings', settings); }

/* Thumbnails (servidor FFmpeg → Cloudflare R2). settings.thumbBase = base pública
   do bucket (ex.: https://pub-xxxx.r2.dev). O mapa id->url vem de thumbs.json. */
let thumbs = {}; // channelId -> url da imagem
async function loadThumbs() {
  if (!settings.thumbBase) { thumbs = {}; return; }
  try {
    const res = await fetch(`${settings.thumbBase.replace(/\/+$/, '')}/thumbs.json`, { cache: 'no-store' });
    if (res.ok) thumbs = await res.json();
  } catch (_) { thumbs = {}; }
}
const thumbFor = id => thumbs[id] || '';

function applySettings() {
  const w = kCardSizes[settings.gridSizeLevel] ?? 220;
  document.documentElement.style.setProperty('--card-w', `${w}px`);
  document.documentElement.style.setProperty('--card-w-m', `${Math.round(w * 0.82)}px`);
  document.documentElement.style.setProperty('--accent', settings.themeColor || '#00DC82');
}

/* Temporizador de sono (sleep_timer.dart): pausa o vídeo ao expirar. */
let sleepUntil = store.get('playtv.sleepUntil', 0); // timestamp de fim; 0 = inativo
let sleepTickTimer = null;
function cancelSleep() { sleepUntil = 0; store.set('playtv.sleepUntil', 0); if (sleepTickTimer) clearInterval(sleepTickTimer); sleepTickTimer = null; }
function setSleep(minutes) {
  cancelSleep();
  if (!minutes) { return; }
  sleepUntil = Date.now() + minutes * 60000;
  store.set('playtv.sleepUntil', sleepUntil);
  sleepTickTimer = setInterval(() => {
    const left = sleepUntil - Date.now();
    if (left <= 0) {
      cancelSleep();
      const v = document.getElementById('chVideo');
      if (v) v.pause();
      alert('Temporizador de sono: reprodução pausada.');
    }
  }, 1000);
}
function sleepRemainingLabel() {
  if (!sleepUntil) return 'Desligado';
  const left = Math.max(0, sleepUntil - Date.now());
  const m = Math.floor(left / 60000), s = Math.floor(left / 1000) % 60;
  return `Faltam ${m}:${String(s).padStart(2, '0')}`;
}
let slide = 0;
let hls = null;

/* ================= Proxy HLS ================= */
/* Ordem de preferência:
   1. settings.proxyBase — proxy definido no Menu (ex.: túnel Cloudflare ou
      servidor na casa/nuvem), ideal quando os streams bloqueiam IPs de
      datacenter;
   2. Proxy embutido (mesma origem, endpoint /proxy) quando hospedado no
      Cloudflare (Workers ou Pages com Functions) ou em qualquer servidor HTTP;
   3. Proxy Node local (node hls-proxy.js, porta 5501) em dev/LAN.
   Se o proxy não responder, usa a ligação direta. */
// URL padrão do Worker caso o proxy esteja num domínio diferente
// Exemplo: 'https://play-tv-proxy.seu-subdominio.workers.dev'
const DEFAULT_PROXY_BASE = '';
const kIsHosted = location.protocol === 'http:' || location.protocol === 'https:';

function hlsProxyBase() {
  if (settings.proxyBase) return settings.proxyBase.replace(/\/+$/, '');
  if (DEFAULT_PROXY_BASE) return DEFAULT_PROXY_BASE.replace(/\/+$/, '');
  // Quando hospedado (HTTP/HTTPS), o proxy está na mesma origem (Cloudflare Pages/Workers)
  if (kIsHosted) return location.origin;
  // Local: proxy Node na porta 5501
  return `http://${location.hostname || 'localhost'}:5501`;
}

// Endpoint do proxy: usa /proxy universalmente.
function hlsProxyEndpoint() {
  return '/proxy';
}
let hlsProxyOk = kIsHosted; // Se hospedado (Pages/Workers), assume ativo por padrão
function checkHlsProxy() {
  const base = hlsProxyBase();
  return new Promise(res => {
    const t = setTimeout(() => { hlsProxyOk = kIsHosted; res(hlsProxyOk); }, 2000);
    fetch(`${base}/ping`)
      .then(r => { clearTimeout(t); hlsProxyOk = r.ok; res(hlsProxyOk); })
      .catch(() => { clearTimeout(t); hlsProxyOk = kIsHosted; res(hlsProxyOk); });
  });
}
function hlsSourceUrl(link) {
  if (!link) return '';
  const base = hlsProxyBase();
  const ep = hlsProxyEndpoint();
  const proxied = `${base}${ep}`;
  if (String(link).startsWith(proxied)) return link;
  // Em HTTPS (hospedado) ou com proxy confirmado, SEMPRE passa pelo proxy
  if (hlsProxyOk || kIsHosted) {
    return `${proxied}?url=${encodeURIComponent(link)}`;
  }
  return link;
}

const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

/* ================= Ícones SVG (substituem os emojis) ================= */
const svg = (p, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" width="1em" height="1em" fill="currentColor" aria-hidden="true" style="vertical-align:-0.14em">${p}</svg>`;
const I = {
  tv: svg('<path d="M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z"/>'),
  ant: svg('<path d="M12 5c-3.48 0-6.37 2.63-6.75 6H2v2h3.25c.38 3.37 3.27 6 6.75 6s6.37-2.63 6.75-6H22v-2h-3.25c-.38-3.37-3.27-6-6.75-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>'),
  star: svg('<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/>'),
  starO: svg('<path d="M22 9.24l-7.19-.62L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.63-7.03L22 9.24zM12 15.4l-3.76 2.27 1-4.28-3.32-2.88 4.38-.38L12 6.1l1.71 4.04 4.38.38-3.32 2.88 1 4.28L12 15.4z"/>'),
  sound: svg('<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>'),
  mute: svg('<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>'),
  play: svg('<path d="M8 5v14l11-7z"/>'),
  shuffle: svg('<path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>'),
  refresh: svg('<path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-8 8s3.57 8 8 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>'),
  trash: svg('<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>'),
  gear: svg('<path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>'),
  palette: svg('<path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>'),
  clock: svg('<path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/>'),
  shield: svg('<path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z"/>'),
};;
/* Fallback para atributos onerror (dentro de HTML gerado) */
window.I_tv = I.tv;

function loadAll() {
  state.playlists = store.get(K.playlists, []);
  // Invalida cache legado para garantir que todos os canais venham reescritos com sslip.io
  if (store.get('playtv.cache_version') !== 'v3_sslip') {
    state.playlists.forEach(p => store.del(K.cache(p.id)));
    store.set('playtv.cache_version', 'v3_sslip');
  }
  // Migração: URL base antiga do preset (apontava para o site, não para a playlist M3U)
  const badUrls = new Set([IPTV_BASE, IPTV_BASE + '/', IPTV_BASE.replace('https://', 'http://')]);
  let urlFixed = false;
  for (const p of state.playlists) {
    if (badUrls.has(p.url)) { p.url = kDefaultPreset.url; urlFixed = true; }
  }
  if (urlFixed) { store.set(K.playlists, state.playlists); state.playlists.forEach(p => store.del(K.cache(p.id))); }
  // Migração: nomes antigos (com chinês) das presets → nomes novos
  const renameMap = {
    '中国 China': 'China',
    '全部 All': 'Todos',
    '香港 Hong Kong': 'Hong Kong',
    '台湾 Taiwan': 'Taiwan',
    '新加坡 Singapore': 'Singapura',
    '美国 United States': 'Estados Unidos',
    '英国 United Kingdom': 'Reino Unido',
    '日本 Japan': 'Japão',
    '韩国 Korea': 'Coreia',
    '体育 Sports': 'Desporto',
    '新闻 News': 'Notícias',
    '电影 Movies': 'Filmes',
    'Free-TV · 全球 Global': 'Free-TV · Global',
    'vbskycn · 国内 China': 'vbskycn · China',
    'YueChan · 国内外 CN+Intl': 'YueChan · CN+Internacional',
    '央视卫视 CCTV · IPv6': 'CCTV · IPv6',
    'joevess · 优选 Curated': 'joevess · Curada',
  };
  let renamed = false;
  for (const p of state.playlists) {
    if (renameMap[p.name]) { p.name = renameMap[p.name]; renamed = true; }
    const legacyBase = 'https://iptv-org.github.io/iptv/countries/br.m3u';
    if (p.url.startsWith(`${legacyBase}/`)) {
      p.url = `${IPTV_BASE}/${p.url.slice(legacyBase.length + 1)}`;
      renamed = true;
    }
  }
  if (renamed) savePlaylists();
  state.currentPlaylistId = store.get(K.currentPl, -1);
  if (!state.playlists.some(p => p.id === state.currentPlaylistId)) {
    state.currentPlaylistId = state.playlists[0]?.id ?? -1;
    savePlaylists();
  }
  state.favorites = store.get(K.favorites, []);
  state.recents = store.get(K.recents, []);
}
function savePlaylists() { store.set(K.playlists, state.playlists); store.set(K.currentPl, state.currentPlaylistId); }
function saveFavorites() { store.set(K.favorites, state.favorites); }
function saveRecents() { store.set(K.recents, state.recents); }

const isFavorite = ch => state.favorites.some(f => f.id === ch.id);
function clearRecents() { state.recents = []; saveRecents(); renderSlide(); }
function toggleFavorite(ch) {
  if (isFavorite(ch)) state.favorites = state.favorites.filter(f => f.id !== ch.id);
  else state.favorites.push(ch);
  saveFavorites(); renderHighlights(); renderCards();
}
function addRecent(ch) { state.recents = mergeRecent(state.recents, ch); saveRecents(); renderSlide(); }

function currentPlaylist() { return state.playlists.find(p => p.id === state.currentPlaylistId) || null; }
function addPlaylist(name, url) {
  const id = state.playlists.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  state.playlists.push({ id, name, url });
  state.currentPlaylistId = id; savePlaylists();
  return id;
}
function deletePlaylist(id) {
  state.playlists = state.playlists.filter(p => p.id !== id);
  store.del(K.cache(id));
  if (state.currentPlaylistId === id) state.currentPlaylistId = state.playlists.length ? state.playlists[0].id : -1;
  savePlaylists();
}

/* ================= Rede (cache de todas as fontes primeiro) ================= */
/* "Todos os canais" = canais de todas as fontes fundidas (mergeChannels por id). */
async function fetchChannels({ force = false } = {}) {
  if (!state.playlists.length) { state.channels = []; state.loading = false; state.error = ''; renderAll(); return; }
  
  // Utiliza a playlist ativa (país selecionado)
  const activePl = currentPlaylist();
  const currentList = activePl ? [activePl] : state.playlists;

  const mergeParts = () => mergeChannels(currentList.flatMap(p => {
    const c = store.get(K.cache(p.id), '');
    // Cache antigo inválido (HTML em vez de M3U) é ignorado e volta a "need".
    return c && isM3U(c) ? parseM3U(c) : [];
  }));

  // 1) Tudo o que já está em cache (local, instantâneo)
  state.channels = mergeParts();
  state.error = '';

  // 2) Em falta: fontes ainda sem cache; em force, só a fonte ativa é rebaixada
  const need = currentList.filter(p => {
    const cached = store.get(K.cache(p.id), '');
    return force ? p.id === state.currentPlaylistId : !(cached && isM3U(cached));
  });
  if (!state.channels.length || need.length) { state.loading = true; renderCards(); }
  for (const p of need) {
    try {
      let text = '';
      const shouldUseProxy = (hlsProxyOk || kIsHosted) && /^https?:\/\//i.test(p.url);
      // Prioridade: baixa via backend /playlist para reescrever todos os canais para HTTPS
      if (shouldUseProxy) {
        try {
          const proxiedUrl = `${hlsProxyBase()}/playlist?url=${encodeURIComponent(p.url)}`;
          const res = await fetch(proxiedUrl, { cache: 'no-store' });
          if (res.ok) {
            const raw = await res.text();
            if (isM3U(raw)) text = raw;
          }
        } catch (_) {}
      }
      // Fallback: download direto se o proxy não tiver retornado
      if (!text) {
        const res = await fetch(p.url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
      }
      if (!isM3U(text)) throw new Error('Fonte não devolve uma playlist M3U');
      store.set(K.cache(p.id), text);
      state.channels = mergeParts(); // integra logo o que chegou
      renderAll();
    } catch (err) {
      if (p.id === state.currentPlaylistId) state.error = state.channels.length ? '' : err.message;
    }
  }
  state.channels = mergeParts();
  state.loading = false;
  if (window.updateCountryButton) window.updateCountryButton();
  renderAll();
}
/* ================= Render (mesmos IDs/classes do visual Play TV) ================= */
function renderAll() { renderTabs(); renderHighlights(); renderCards(); renderSlide(); }

/* Tabs = "Todos" + "Favoritos" + grupos da lista (distinctGroups) */
function renderTabs() {
  const groups = distinctGroups(state.channels);
  const tabsEl = $('tabs');
  const all = [{ g: null, label: 'Todos' }, { g: '__fav__', label: 'Favoritos', icon: I.star }, ...groups.map(g => ({ g, label: g }))];
  tabsEl.innerHTML = all.map(t =>
    `<button class="tab ${state.group === t.g ? 'active' : ''}" data-g="${esc(t.g ?? '')}">${t.icon || ''}${esc(t.label)}</button>`).join('');
  tabsEl.querySelectorAll('.tab').forEach(b => b.onclick = () => {
    state.group = b.dataset.g || null; renderTabs(); renderCards();
  });
}

/* Painel "Favoritos" (highlightGrid) = canais favoritos */
function renderHighlights() {
  const grid = $('highlightGrid');
  if (!state.favorites.length) {
    grid.innerHTML = `<div class="highlight"><div class="mini-icon" >${I.tv}</div><span>Marca canais com ${I.star} para os veres aqui</span></div>`;
    return;
  }
  // Lista vertical: mostra todos os favoritos (a barra discreta permite navegar)
  grid.innerHTML = state.favorites.map(c =>
    `<div class="highlight" data-id="${esc(c.id)}"><div class="mini-icon" >${c.logo ? `<img src="${esc(c.logo)}" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML=window.I_tv">` : I.tv}</div><span>${esc(c.name)}</span></div>`).join('');
  grid.querySelectorAll('.highlight').forEach(x => x.onclick = () => {
    const ch = findChannel(x.dataset.id); if (ch) openChannelModal(ch);
  });
}

/* Painel "Recentes" (heroCard) = slider dos últimos canais vistos */
const welcomeSlides = [
  ['Bem-vindo', '', I.tv],
  ['Adiciona fontes', '', I.ant],
  ['Favoritos e recentes', '', I.star],
];
function renderSlide() {
  const slides = state.recents.length
    ? state.recents.slice(0, 5).map(c => [c.name, (c.sources[0] || {}).groupTitle || 'Canal recente', c.logo ? null : I.tv, c.logo, c.id])
    : welcomeSlides;
  if (slide >= slides.length) slide = 0;
  const s0 = slides[slide];
  // Usa sempre o canal vivo (fonte atual): o registo antigo pode não ter logo.
  const live = state.recents.length ? findChannel(s0[4] || '') : null;
  const logo = (live && live.logo) || s0[3] || '';
  const s = [s0[0], s0[1], logo ? null : I.tv, logo, s0[4]];
  $('heroTag').textContent = state.recents.length ? 'Visto recentemente' : 'Play TV';
  $('heroTitle').textContent = s[0];
  $('heroText').textContent = s[1];
  const art = $('heroArt');
  art.innerHTML = s[2] === null ? `<img src="${esc(s[3])}" alt="${esc(s[0])}" class="hero-logo-img" referrerpolicy="no-referrer" onerror="this.outerHTML=window.I_tv">` : s[2];
  art.dataset.id = s[4] || '';
  /* A telinha mantém o canal a tocar em silêncio (mini preview em direto). */
  const rch = state.recents.length ? findChannel(s[4] || '') : null;
  if (rch) startHeroPreview(rch); else stopHeroPreview();
  $('sliderDots').innerHTML = slides.map((_, i) => `<span class="${i === slide ? 'active' : ''}"></span>`).join('');
  window._heroSlides = slides;
}

/* Preview contínuo na telinha: o canal visto recentemente toca em silêncio. */
let heroHls = null;
let heroPreviewId = null;
function stopHeroPreview() {
  if (heroHls) { try { heroHls.destroy(); } catch (_) {} heroHls = null; }
  heroPreviewId = null;
  const card = $('heroCard'); if (!card) return;
  card.classList.remove('live');
  card.querySelectorAll('video, .hero-shade, .mute-tag').forEach(el => el.remove());
  const art = $('heroArt');
  const v = art && art.querySelector('video');
  if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
}
function startHeroPreview(ch) {
  if (heroPreviewId === ch.id) return; // já está a tocar
  stopHeroPreview();
  const card = $('heroCard'); if (!card || !ch.sources.length) return;
  heroPreviewId = ch.id;
  card.classList.add('live');
  const v = document.createElement('video');
  v.muted = true;
  v.defaultMuted = true;
  v.autoplay = true;
  v.playsInline = true;
  v.setAttribute('muted', '');
  v.setAttribute('autoplay', '');
  v.setAttribute('playsinline', '');
  card.insertAdjacentHTML('beforeend', '<div class="hero-shade"></div>');
  card.appendChild(v);
  card.insertAdjacentHTML('beforeend', `<button class="mute-tag" id="heroMuteBtn" title="Ativar/Desativar som">${I.mute}<span>Silenciado</span></button>`);
  const mb = $('heroMuteBtn');
  mb.onclick = e => {
    e.stopPropagation();
    v.muted = !v.muted;
    mb.innerHTML = v.muted ? `${I.mute}<span>Silenciado</span>` : `${I.sound}<span>Com som</span>`;
  };
  // Clicar no vídeo troca também o som (não abre o player)
  v.onclick = () => mb.click();
  const src = ch.sources[0];
  const isHls = /\.m3u8?($|\?)/i.test(src.link);
  if (isHls && window.Hls && Hls.isSupported()) {
    heroHls = new Hls({ maxBufferLength: 10, liveSyncDurationCount: 3 });
    heroHls.loadSource(hlsSourceUrl(src.link));
    heroHls.attachMedia(v);
    heroHls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
  } else {
    v.src = src.link;
    v.play().catch(() => {});
  }
}

/* Catálogo = carrosséis horizontais por grupo (estilo Netflix).
   Cada grupo vira uma linha com scroll lateral e setas ‹ ›. */
function channelCard(c) {
  const grp = (c.sources.find(s => s.groupTitle) || {}).groupTitle || 'Sem grupo';
  const fav = isFavorite(c);
  const thumb = thumbFor(c.id);
  const cover = thumb ? `<div class="card-cover"><img src="${esc(thumb)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()"></div>` : '';
  const country = detectChannelCountry(c);
  const flagBadge = country ? `<span class="badge flag" title="${esc(country.name)}">${renderFlag(country.code, country.flag, 16)}</span>` : '';
  return `<article class="app-card" data-ch="${esc(c.id)}" tabindex="0" role="button" aria-label="${esc(c.name)}">
    ${cover}
    <div class="badges">${flagBadge}<span class="badge star" data-fav="${esc(c.id)}" title="Favorito">${fav ? I.star : I.starO}</span></div>
    <div class="card-preview"></div>
    <div class="card-head"><div class="app-icon" >${c.logo ? `<img src="${esc(c.logo)}" alt="" referrerpolicy="no-referrer" onerror="this.outerHTML=window.I_tv">` : I.tv}</div><div class="app-name">${esc(c.name)}</div></div>
    <div class="app-desc">${esc(grp)}${c.sources.length > 1 ? ` · ${c.sources.length} fontes` : ''}</div>
    <button class="card-btn primary" data-id="${esc(c.id)}">${I.play} Assistir</button>
  </article>`;
}

/* Pré-visualização contínua (igual à telinha): os canais visíveis no carrossel
  ficam sempre a tocar em silêncio; limite de 6 simultâneos por desempenho. */
const activePreviews = new Map(); // card -> {v, hls, ch}
const previewTimers = new Map();
let previewObserver = null;
/* Em telemóveis (Chrome Android), 6 streams HLS em simultâneo é pesado:
   limita a 3. */
const isMobileLike = () =>
  window.matchMedia('(max-width: 700px), (hover: none) and (pointer: coarse)').matches;
const kMaxLivePreviews = isMobileLike() ? 3 : 6;
const kPreviewStartWaitMs = 10000;
const kPreviewHoverDelayMs = 700;

function stopCardPreview(card, removeClass = true) {
  if (previewTimers.has(card)) {
    clearTimeout(previewTimers.get(card));
    previewTimers.delete(card);
  }
  const p = activePreviews.get(card);
  if (!p) return;
  activePreviews.delete(card);
  if (p.retryTimer) clearTimeout(p.retryTimer);
  if (p.hls) { try { p.hls.destroy(); } catch (_) {} }
  p.v.pause(); p.v.removeAttribute('src'); p.v.load(); p.v.remove();
  if (removeClass) card.classList.remove('previewing');
}
function stopAllPreviews() { [...activePreviews.keys()].forEach(c => stopCardPreview(c)); }

function scheduleCardPreview(card, ch, immediate = false) {
  if (activePreviews.has(card) || previewTimers.has(card)) return;
  if (immediate) { previewTimers.delete(card); startCardPreview(card, ch); return; }
  const timer = setTimeout(() => {
    previewTimers.delete(card);
    startCardPreview(card, ch);
  }, kPreviewHoverDelayMs);
  previewTimers.set(card, timer);
}

function startCardPreview(card, ch) {
  if (activePreviews.has(card)) return;
  if (activePreviews.size >= kMaxLivePreviews) return; // limite de streams
  const box = card.querySelector('.card-preview');
  if (!box || !ch.sources.length) return;
  const video = document.createElement('video');
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = true;
  video.playsInline = true;
  video.setAttribute('muted', '');
  video.setAttribute('autoplay', '');
  video.setAttribute('playsinline', '');
  box.innerHTML = ''; box.appendChild(video);
  const entry = { v: video, hls: null, ch };
  activePreviews.set(card, entry);
  let idx = 0;
  const showPreview = () => {
    if (activePreviews.has(card)) card.classList.add('previewing');
  };
  const trySource = () => {
    if (!activePreviews.has(card)) return;
    if (idx >= ch.sources.length) { stopCardPreview(card); return; }
    const src = ch.sources[idx++];
    const isHls = /\.m3u8?($|\?)/i.test(src.link);
    if (entry.hls) { try { entry.hls.destroy(); } catch (_) {} entry.hls = null; }
    card.classList.remove('previewing');
    const fail = () => {
      if (entry.retryTimer || !activePreviews.has(card)) return;
      entry.retryTimer = setTimeout(() => {
        entry.retryTimer = null;
        trySource();
      }, kPreviewStartWaitMs);
    };
    video.onerror = fail;
    if (isHls && window.Hls && Hls.isSupported()) {
      entry.hls = new Hls({ maxBufferLength: 30, liveSyncDurationCount: 3 });
      entry.hls.loadSource(hlsSourceUrl(src.link));
      entry.hls.attachMedia(video);
      entry.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        showPreview();
        video.play().catch(() => {});
      });
      entry.hls.on(Hls.Events.ERROR, (_, data) => { if (data && data.fatal) fail(); });
    } else {
      video.src = src.link;
      video.onloadedmetadata = showPreview;
      video.play().catch(() => {});
    }
  };
  trySource();
}

/* Arranque automático: os primeiros 6 cartões do carrossel começam a tocar
  em silêncio (mesma lógica do hover), escalonados para não abrir 6 streams
  HLS em simultâneo. */
function autoStartFirstCards(count = kMaxLivePreviews) {
  const cards = [...document.querySelectorAll('.carousel .app-card[data-ch]')].slice(0, count);
  const gap = isMobileLike() ? 900 : 600; // telemóvel: arranque mais espaçado
  cards.forEach((card, i) => {
    const ch = findChannel(card.dataset.ch);
    if (!ch) return;
    setTimeout(() => {
      if (!card.isConnected || activePreviews.has(card)) return;
      scheduleCardPreview(card, ch, true);
    }, i * gap);
  });
}

function bindPreviews(scope) {
  stopAllPreviews();
  if (previewObserver) previewObserver.disconnect();
  const root = (scope || document).querySelector('.carousel');
  const cards = [...(scope || document).querySelectorAll('.app-card[data-ch]')];
  previewObserver = new IntersectionObserver(entries => {
    const rootRect = root?.getBoundingClientRect();
    const rootOutsideViewport = rootRect && (rootRect.bottom <= 0 || rootRect.top >= window.innerHeight);
    if (rootOutsideViewport) return;
    for (const e of entries) {
      const ch = findChannel(e.target.dataset.ch);
      if (!ch) continue;
      if (e.isIntersecting) {
        scheduleCardPreview(e.target, ch, true);
      } else {
        stopCardPreview(e.target);
      }
    }
  }, root ? { root, threshold: 0.6 } : { threshold: 0.3 });
  cards.forEach(card => {
    const ch = findChannel(card.dataset.ch); if (!ch) return;
    previewObserver.observe(card);
  });

  cards.forEach(card => {
    const ch = findChannel(card.dataset.ch);
    if (!ch) return;
    // Hover só em dispositivos com rato; em toque, o tap não deve arrancar preview.
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      card.addEventListener('mouseenter', () => scheduleCardPreview(card, ch));
      card.addEventListener('mouseleave', () => stopCardPreview(card));
    }
  });
  cards.forEach(card => {
    const ch = findChannel(card.dataset.ch);
    if (!ch) return;
    const rect = card.getBoundingClientRect();
    const vp = { top: 0, left: 0, bottom: window.innerHeight, right: window.innerWidth };
    if (rect.bottom > vp.top && rect.top < vp.bottom) scheduleCardPreview(card, ch, true);
  });
}

function renderCards() {
  const q = $('searchInput').value.trim();
  const cat = $('catalog');

  if (state.loading) { cat.innerHTML = '<article class="app-card"><div class="app-desc">A carregar canais…</div></article>'; return; }
  if (state.error) {
    cat.innerHTML = `<article class="app-card"><div class="app-name">Falha ao carregar fonte</div><div class="app-desc">${esc(state.error)}</div><button class="card-btn primary" id="retryLoad">Tentar novamente</button></article>`;
    $('retryLoad').onclick = () => fetchChannels({ force: true }); return;
  }

  // Um único carrossel de duas linhas com todos os canais do contexto (tab/pesquisa).
  let title, list;
  if (state.group === '__fav__') { title = 'Favoritos'; list = filterChannels(state.favorites, q); }
  else if (state.group) { title = state.group; list = filterChannels(state.channels, q, state.group); }
  else if (q) { title = `Resultados para "${q}"`; list = filterChannels(state.channels, q); }
  else { title = 'Todos os canais'; list = state.channels; }

  if (!list.length) {
    cat.innerHTML = `<article class="app-card"><div class="app-name">Sem canais</div><div class="app-desc">Abre ${I.gear} Fontes para adicionar uma lista M3U ou uma fonte recomendada.</div><button class="card-btn primary" id="emptySources">Abrir fontes</button></article>`;
    $('emptySources').onclick = openSourcesModal; return;
  }

  cat.innerHTML = `
    <section class="car-section">
      <div class="car-head"><button class="car-title" id="carTitle">${I.tv} ${esc(title)} <small>${list.length}</small></button></div>
      <div class="car-body">
        <button class="car-arrow left" data-dir="-1" title="Anterior">‹</button>
        <div class="carousel">${list.map(channelCard).join('')}</div>
        <button class="car-arrow right" data-dir="1" title="Seguinte">›</button>
      </div>
      <div class="car-dots"></div>
    </section>`;

  const carEl = cat.querySelector('.carousel');
  const dotsEl = cat.querySelector('.car-dots');
  const pageSize = () => carEl.clientWidth;
  const pageCount = () => Math.max(1, Math.ceil(carEl.scrollWidth / pageSize()));
  const currentPage = () => Math.round(carEl.scrollLeft / pageSize());

  function renderDots() {
    const n = pageCount(), cur = currentPage();
    dotsEl.innerHTML = Array.from({ length: n }, (_, i) =>
      `<span class="${i === cur ? 'active' : ''}" data-p="${i}"></span>`).join('');
    dotsEl.querySelectorAll('span').forEach(d => d.onclick = () =>
      carEl.scrollTo({ left: +d.dataset.p * pageSize(), behavior: 'smooth' }));
  }
  carEl.addEventListener('scroll', () => {
    const cur = currentPage();
    dotsEl.querySelectorAll('span').forEach((d, i) => d.classList.toggle('active', i === cur));
  });
  window.addEventListener('resize', renderDots);
  renderDots();
  $('carTitle').onclick = openAllChannelsModal;

  cat.querySelectorAll('.car-arrow').forEach(b => b.onclick = () => {
    carEl.scrollBy({ left: +b.dataset.dir * pageSize(), behavior: 'smooth' });
  });
  cat.querySelectorAll('.app-card').forEach(card => {
    card.onclick = (e) => {
      if (e.target.closest('.badge.star')) return;
      const ch = findChannel(card.dataset.ch); if (ch) openChannelModal(ch);
    };
    card.onkeydown = (e) => {
      if (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 29443) {
        e.preventDefault();
        const ch = findChannel(card.dataset.ch); if (ch) openChannelModal(ch);
      }
    };
  });
  cat.querySelectorAll('.card-btn').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const ch = findChannel(b.dataset.id); if (ch) openChannelModal(ch);
  });
  cat.querySelectorAll('.badge.star').forEach(b => b.onclick = (e) => {
    e.stopPropagation();
    const ch = findChannel(b.dataset.fav); if (ch) toggleFavorite(ch);
  });
  bindPreviews();
  autoStartFirstCards();
}
function findChannel(id) {
  return state.channels.find(c => c.id === id)
    || state.favorites.find(c => c.id === id)
    || state.recents.find(c => c.id === id) || null;
}

/* Retorna a lista de canais atualmente navegável */
function getActiveChannelsList() {
  const searchEl = $('searchInput');
  const q = (searchEl ? searchEl.value : '').trim().toLowerCase();
  let list = state.channels;
  if (state.activeTab && state.activeTab !== 'all') {
    list = list.filter(c => (c.sources.find(s => s.groupTitle) || {}).groupTitle === state.activeTab);
  }
  if (q) {
    list = list.filter(c => c.name.toLowerCase().includes(q) || (c.sources[0]?.groupTitle || '').toLowerCase().includes(q));
  }
  return (list && list.length) ? list : state.channels;
}

/* Troca para o canal vizinho (+1 ou -1) - controle de TV ou botões Próx/Ant */
function playNeighborChannel(offset) {
  const list = getActiveChannelsList();
  if (!list || !list.length || !state.current) return;
  const idx = list.findIndex(c => c.id === state.current.id);
  if (idx === -1) return;
  const nextIdx = (idx + offset + list.length) % list.length;
  openChannelModal(list[nextIdx]);
}

/* Alterna tela cheia nativa no Player (compatível com Android, iOS Safari e Smart TV) */
function toggleVideoFullscreen() {
  const v = $('pv');
  if (!v) return;
  if (document.fullscreenElement || document.webkitFullscreenElement) {
    if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  } else {
    if (v.requestFullscreen) {
      v.requestFullscreen().catch(() => {});
    } else if (v.webkitRequestFullscreen) {
      v.webkitRequestFullscreen();
    } else if (v.webkitEnterFullscreen) { // iOS Safari iPhone
      v.webkitEnterFullscreen();
    } else if (v.msRequestFullscreen) {
      v.msRequestFullscreen();
    }
  }
}

/* ================= Gestão de Anúncios (HilltopAds / Pre-roll VAST) ================= */
const adSettings = {
  get enabled() { return store.get('playtv.ad_enabled', true); },
  set enabled(v) { store.set('playtv.ad_enabled', !!v); },

  get frequency() { return store.get('playtv.ad_frequency', 3); },
  set frequency(v) { store.set('playtv.ad_frequency', Math.max(1, parseInt(v || 3, 10))); },

  get skipSeconds() { return store.get('playtv.ad_skip_seconds', 5); },
  set skipSeconds(v) { store.set('playtv.ad_skip_seconds', Math.max(0, parseInt(v || 5, 10))); },

  get vastUrl() {
    return store.get('playtv.ad_vast_url', '');
  },
  set vastUrl(v) { store.set('playtv.ad_vast_url', String(v || '').trim()); },

  get directUrl() {
    return store.get('playtv.ad_direct_url', '');
  },
  set directUrl(v) { store.set('playtv.ad_direct_url', String(v || '').trim()); },
};

// Sincroniza configurações globais do backend Cloudflare se disponível
async function syncGlobalAdConfig() {
  try {
    const res = await fetch('/api/ads/config');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg) {
        if (typeof cfg.enabled === 'boolean') adSettings.enabled = cfg.enabled;
        if (cfg.frequency) adSettings.frequency = cfg.frequency;
        if (cfg.skipSeconds) adSettings.skipSeconds = cfg.skipSeconds;
        if (cfg.vastUrl) adSettings.vastUrl = cfg.vastUrl;
        if (cfg.directUrl) adSettings.directUrl = cfg.directUrl;
      }
    }
  } catch (_) {}
}

let adSwitchCounter = parseInt(sessionStorage.getItem('playtv.ad_counter') || '0', 10);
let adSafetyTimer = null;
let adCountdownInterval = null;
let currentAdVideo = null;

function shouldPlayAd() {
  if (!adSettings.enabled) return false;
  // Exibe no início (0) e a cada 3 canais trocados (ou na frequência configurada)
  const isTarget = (adSwitchCounter === 0) || (adSwitchCounter % adSettings.frequency === 0);
  adSwitchCounter++;
  sessionStorage.setItem('playtv.ad_counter', String(adSwitchCounter));
  return isTarget;
}

function stopAd() {
  if (adSafetyTimer) { clearTimeout(adSafetyTimer); adSafetyTimer = null; }
  if (adCountdownInterval) { clearInterval(adCountdownInterval); adCountdownInterval = null; }
  const overlay = $('adOverlay');
  if (overlay) overlay.hidden = true;
  if (currentAdVideo) {
    try {
      currentAdVideo.pause();
      currentAdVideo.removeAttribute('src');
      currentAdVideo.load();
    } catch (_) {}
    currentAdVideo = null;
  }
}

async function fetchVastAd(vastUrl) {
  try {
    const res = await fetch(vastUrl, { redirect: 'follow' });
    if (!res.ok) return null;
    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, 'text/xml');
    
    // Suporte a redirecionamento VAST Wrapper
    const wrapper = xml.querySelector('VASTAdTagURI');
    if (wrapper && wrapper.textContent.trim()) {
      return fetchVastAd(wrapper.textContent.trim());
    }

    const mediaFiles = xml.querySelectorAll('MediaFile');
    let videoUrl = '';
    for (const mf of mediaFiles) {
      const type = (mf.getAttribute('type') || '').toLowerCase();
      const url = mf.textContent.trim();
      if (url && (type.includes('mp4') || type.includes('webm') || url.includes('.mp4') || !videoUrl)) {
        videoUrl = url;
        if (type.includes('mp4') || url.includes('.mp4')) break;
      }
    }

    const clickThrough = xml.querySelector('ClickThrough')?.textContent.trim() || '';
    if (videoUrl) {
      return { videoUrl, clickThrough };
    }
  } catch (err) {
    console.warn('HilltopAds VAST parse:', err);
  }
  return null;
}

async function playPreRollAd(ch, onDone) {
  stopAd();
  const overlay = $('adOverlay');
  const adVideo = $('adVideo');
  const skipBtn = $('adSkipBtn');
  const learnMoreBtn = $('adLearnMore');
  const pStatus = $('pStatus');

  if (!overlay || !adVideo || !skipBtn) {
    onDone();
    return;
  }

  // HilltopAds DirectLink: aciona ao iniciar
  if (adSettings.directUrl && Math.random() < 0.4) {
    try {
      window.open(adSettings.directUrl, '_blank', 'noopener,noreferrer');
    } catch (_) {}
  }

  currentAdVideo = adVideo;
  overlay.hidden = false;
  if (pStatus) pStatus.textContent = 'Carregando anúncio HilltopAds…';

  let finished = false;
  const finishAd = () => {
    if (finished) return;
    finished = true;
    stopAd();
    onDone();
  };

  // Timeout de segurança (4.5s): se a rede ou a HilltopAds falhar, abre o canal ao vivo
  adSafetyTimer = setTimeout(finishAd, 4500);

  let adData = null;
  if (adSettings.vastUrl) {
    adData = await fetchVastAd(adSettings.vastUrl).catch(() => null);
  }

  // Se não tiver VAST configurado ou se falhar, utiliza vídeo de demonstração
  const videoSrc = (adData && adData.videoUrl)
    ? adData.videoUrl
    : 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

  const clickUrl = (adData && adData.clickThrough)
    ? adData.clickThrough
    : (adSettings.directUrl || 'https://hilltopads.com');

  if (learnMoreBtn) {
    learnMoreBtn.href = clickUrl;
    learnMoreBtn.hidden = !clickUrl;
  }

  let remaining = adSettings.skipSeconds;
  skipBtn.disabled = true;
  skipBtn.textContent = `Pular em ${remaining}s`;
  skipBtn.classList.remove('ready');

  if (adCountdownInterval) clearInterval(adCountdownInterval);
  adCountdownInterval = setInterval(() => {
    remaining--;
    if (remaining <= 0) {
      clearInterval(adCountdownInterval);
      skipBtn.disabled = false;
      skipBtn.innerHTML = 'Pular anúncio';
      skipBtn.classList.add('ready');
      if (document.body.classList.contains('is-tv')) {
        skipBtn.focus();
      }
    } else {
      skipBtn.textContent = `Pular em ${remaining}s`;
    }
  }, 1000);

  skipBtn.onclick = (e) => {
    e.stopPropagation();
    finishAd();
  };

  adVideo.src = videoSrc;
  adVideo.onended = finishAd;
  adVideo.onerror = finishAd;
  adVideo.onplaying = () => {
    if (adSafetyTimer) { clearTimeout(adSafetyTimer); adSafetyTimer = null; }
  };

  try {
    await adVideo.play();
  } catch (_) {
    adVideo.muted = true;
    adVideo.play().catch(finishAd);
  }
}

/* ================= Modal: player (player.dart simplificado) ================= */
function openChannelModal(ch) {
  stopAllPreviews(); // liberta os previews do carrossel durante a reprodução
  state.current = ch; state.sourceIdx = 0;
  addRecent(ch);
  const fav = isFavorite(ch);
  const country = detectChannelCountry(ch);
  const flagHtml = country ? renderFlag(country.code, country.flag, 24) + ' ' : '';
  modalContent.innerHTML = `
    <h2>${flagHtml}${esc(ch.name)}</h2>
    <div class="video-container" id="videoContainer">
      <video class="ch-video" id="pv" controls autoplay playsinline webkit-playsinline x5-playsinline></video>
      <div class="ad-overlay" id="adOverlay" hidden>
        <video class="ad-video" id="adVideo" playsinline webkit-playsinline></video>
        <div class="ad-top-bar">
          <span class="ad-badge">Publicidade</span>
          <span class="ad-countdown" id="adCountdown">HilltopAds</span>
        </div>
        <div class="ad-bottom-bar">
          <a class="ad-learn-more" id="adLearnMore" target="_blank" rel="noopener noreferrer" hidden>Visitar Anunciante ↗</a>
          <button class="ad-skip-btn" id="adSkipBtn" disabled>Pular em 5s</button>
        </div>
      </div>
    </div>
    <div class="player-nav-bar">
      <button class="player-btn" id="mPrevCh" title="Canal anterior (Seta ↑)"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg> Anterior</button>
      <button class="player-btn primary" id="mFullscreen" title="Tela Cheia (F)"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg> Tela Cheia</button>
      <button class="player-btn" id="mNextCh" title="Próximo canal (Seta ↓)">Próximo <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg></button>
    </div>
    <p id="pStatus">A carregar…</p>
    <div class="modal-buttons-row">
      <button class="card-btn" id="mFav">${fav ? I.star + ' Remover dos favoritos' : I.starO + ' Adicionar aos favoritos'}</button>
      ${ch.sources.length > 1 ? `<button class="card-btn" id="mNextSrc">${I.shuffle} Próxima fonte (${state.sourceIdx + 1}/${ch.sources.length})</button>` : ''}
    </div>`;
  document.querySelector('.modal').classList.add('wide');
  modalBackdrop.classList.add('open');
  lockBody();

  $('mPrevCh').onclick = () => playNeighborChannel(-1);
  $('mNextCh').onclick = () => playNeighborChannel(1);
  $('mFullscreen').onclick = toggleVideoFullscreen;

  $('mFav').onclick = () => {
    toggleFavorite(ch);
    $('mFav').innerHTML = isFavorite(ch) ? I.star + ' Remover dos favoritos' : I.starO + ' Adicionar aos favoritos';
  };
  const ns = $('mNextSrc');
  if (ns) ns.onclick = () => {
    state.sourceIdx = (state.sourceIdx + 1) % ch.sources.length;
    ns.innerHTML = `${I.shuffle} Próxima fonte (${state.sourceIdx + 1}/${ch.sources.length})`;
    loadSource();
  };

  // Programação de anúncios HilltopAds: no início e a cada 3 trocas de canal
  if (shouldPlayAd()) {
    playPreRollAd(ch, () => loadSource());
  } else {
    loadSource();
  }

  setTimeout(() => {
    const fs = $('mFullscreen');
    if (fs && (document.body.classList.contains('is-tv') || window.innerWidth >= 1200)) {
      fs.focus();
    }
  }, 120);
}

function loadSource(direct = false) {
  const ch = state.current; if (!ch) return;
  const src = ch.sources[state.sourceIdx];
  const v = $('pv'); if (!v) return;
  destroyHls();
  $('pStatus').textContent = 'A carregar…';

  // Em HTTPS, ligação direta para HTTP é proibida pelo navegador (Mixed Content)
  const canDirect = !kIsHosted || /^https:\/\//i.test(src.link);
  const targetUrl = (direct && canDirect) ? src.link : hlsSourceUrl(src.link);

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls({
      maxBufferLength: 20,
      liveSyncDurationCount: 3,
      enableWorker: true,
      lowLatencyMode: false,
      manifestLoadingTimeOut: 15000,
      manifestLoadingMaxRetry: 3,
      levelLoadingTimeOut: 15000,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 4,
    });
    hls.loadSource(targetUrl);
    hls.attachMedia(v);
    hls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (!d.fatal) return;
      if (!direct && canDirect && targetUrl !== src.link) {
        loadSource(true);
        return;
      }
      // Fallback: tenta tocar direto no elemento <video> com o link via proxy
      v.src = targetUrl;
      v.play().catch(() => {});
    });
  } else {
    v.src = targetUrl;
    v.play().catch(() => {});
  }
  v.onplaying = () => {
    $('pStatus').textContent = `${(src.groupTitle || 'Canal')} · fonte ${state.sourceIdx + 1}/${ch.sources.length}`;
    sendHeartbeat();
  };
  v.onerror = () => { $('pStatus').textContent = 'Falha ao abrir o stream — tenta outra fonte.'; };
}
function destroyHls() { if (hls) { try { hls.destroy(); } catch (_) {} hls = null; } }

function closeModal() {
  stopAd();
  modalBackdrop.classList.remove('open');
  document.body.classList.remove('modal-open');
  document.querySelector('.modal').classList.remove('wide', 'tall', 'terms-modal');
  const v = $('pv'); if (v) { v.pause(); v.removeAttribute('src'); v.load(); }
  destroyHls(); state.current = null;
}
const lockBody = () => document.body.classList.add('modal-open');


/* ================= Modal: Termos de Uso e Política de Privacidade (LGPD) ================= */
function openTermsModal() {
  closeModal();
  modalContent.innerHTML = `
    <div class="terms-modal-wrapper">
      <div class="terms-header">
        <div class="terms-title-wrap">
          <div class="terms-icon-shield">
            ${I.shield}
          </div>
          <div>
            <h2>Termos de Uso & Privacidade</h2>
            <p class="terms-sub">Transparência jurídica, isenção de responsabilidade e conformidade LGPD</p>
          </div>
        </div>
      </div>

      <div class="terms-badges">
        <span class="terms-badge green">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          Conformidade LGPD (Lei 13.709/2018)
        </span>
        <span class="terms-badge blue">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
          Zero Coleta de Dados Pessoais
        </span>
        <span class="terms-badge purple">
          <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/></svg>
          Mero Indexador Aberto (Sem Hospedagem)
        </span>
      </div>

      <div class="terms-body">
        <section class="terms-section">
          <h3><span class="sec-num">1</span> Natureza Jurídica do Serviço e Não Hospedagem</h3>
          <p>
            O <strong>Play TV</strong> opera exclusivamente como uma interface cliente web de reprodução multimídia e indexação de links públicos da internet.
          </p>
          <ul>
            <li><strong>Inexistência de Servidores de Streaming:</strong> O Play TV <strong>NÃO armazena, NÃO hospeda, NÃO faz upload, NÃO transcodifica e NÃO retransmite</strong> qualquer sinal de canal de televisão, fluxo de vídeo ou áudio. A plataforma não possui servidores próprios de mídia.</li>
            <li><strong>Origem Aberta e Pública dos Links:</strong> Todo o catálogo, logotipos e fluxos HLS (.m3u8) exibidos provêm de fontes públicas abertas e gratuitas disponíveis livremente na internet, organizadas de forma comunitária e voluntária em repositórios abertos (como o projeto público internacional <em>iptv-org</em> no GitHub) e diretamente por emissoras de sinal aberto.</li>
            <li><strong>Marco Civil da Internet (Lei nº 12.965/2014):</strong> A aplicação atua em estrita consonância com o Artigo 19 do Marco Civil da Internet como mera intermediadora de conexões técnicas e provedora de interface de agregação de hiperlinks públicos já existentes.</li>
          </ul>
        </section>

        <section class="terms-section">
          <h3><span class="sec-num">2</span> Política de Privacidade e Proteção de Dados (LGPD)</h3>
          <p>
            Em total observância à Lei Geral de Proteção de Dados Pessoais (Lei Federal nº 13.709/2018 - LGPD), garantimos transparência e minimização total de dados:
          </p>
          <ul>
            <li><strong>Zero Coleta de Dados Pessoais:</strong> O Play TV <strong>não solicita, não cadastra, não coleta e não armazena</strong> nenhum dado pessoal de identificação civil (como nome, CPF, e-mail, telefone, biometria ou geolocalização exata), conforme preconizam os artigos 5º e 11 da LGPD.</li>
            <li><strong>Ausência de Rastreamento ou Perfilamento (No Profiling):</strong> Não realizamos monitoramento comportamental entre sites (cross-site tracking), não criamos perfis de consumo para venda e não comercializamos nenhuma informação com corretores de dados (data brokers).</li>
            <li><strong>Armazenamento Local Exclusivo no Aparelho (Client-Side Storage):</strong> As preferências do usuário (como canais favoritos, último país filtrado, canais assistidos recentemente e customizações visuais) ficam gravadas <strong>estritamente no armazenamento local do navegador (LocalStorage)</strong> do próprio aparelho do usuário. Tais informações nunca são transmitidas a servidores externos da plataforma e podem ser eliminadas a qualquer momento pelo usuário limpando os dados de navegação ou através da opção "Limpar" no menu.</li>
          </ul>
        </section>

        <section class="terms-section">
          <h3><span class="sec-num">3</span> Publicidade de Terceiros e Monetização</h3>
          <p>
            Para custear despesas técnicas com infraestrutura de servidores e preservar o acesso integralmente gratuito aos usuários, a plataforma pode veicular anúncios publicitários pontuais intermediados por redes de publicidade terceirizadas (como HilltopAds).
          </p>
          <p>
            O Play TV <strong>não transfere dados pessoais</strong> dos usuários para anunciantes. A exibição é programática/contextual e quaisquer cookies técnicos ou métricas de entrega operam sob as diretrizes de privacidade independentes de cada anunciante.
          </p>
        </section>

        <section class="terms-section">
          <h3><span class="sec-num">4</span> Direitos Autorais e Procedimento de Desindexação (Notice & Take-Down)</h3>
          <p>
            O Play TV preza pelo respeito absoluto à Lei de Direitos Autorais (Lei Federal nº 9.610/1998) e às convenções internacionais de propriedade intelectual.
          </p>
          <p>
            Caso qualquer emissora, distribuidora ou titular legítimo de direitos autorais identifique algum canal ou link público indexado que deseje desindexar ou bloquear:
          </p>
          <ul>
            <li>Disponibilizamos canal de atendimento expresso para <strong>desindexação imediata</strong>.</li>
            <li>Basta enviar notificação formal para o e-mail: <strong style="color:#60a5fa">contato@playtv.app</strong> indicando o canal e comprovação de titularidade. A desindexação do catálogo é processada de prontidão.</li>
          </ul>
        </section>

        <section class="terms-section">
          <h3><span class="sec-num">5</span> Isenção de Garantias e Responsabilidade</h3>
          <p>
            O serviço é fornecido gratuitamente "como está" (<em>as-is</em>), sem qualquer garantia de disponibilidade ininterrupta, qualidade de transmissão ou perenidade de sinais mantidos por terceiros na internet. O usuário reconhece que o uso da plataforma se dá para fins lícitos de entretenimento pessoal.
          </p>
        </section>
      </div>

      <div class="terms-footer">
        <span class="terms-footer-info">Play TV • Em conformidade com a LGPD (Lei 13.709/2018)</span>
        <button class="card-btn primary" id="btnTermsAccept">Entendi e Concordo</button>
      </div>
    </div>
  `;
  document.querySelector('.modal').classList.add('terms-modal');
  modalBackdrop.classList.add('open');
  lockBody();

  const btnAccept = $('btnTermsAccept');
  if (btnAccept) {
    btnAccept.onclick = closeModal;
    btnAccept.focus();
  }
}
window.openTermsModal = openTermsModal;

/* ================= Modal: fontes (playlist_dialog + preset_source_dialog) ================= */
function openSourcesModal() {
  const pl = currentPlaylist();
  const allC = window.kCountriesList || [];
  const rows = state.playlists.map(p => {
    const c = allC.find(x => x.url === p.url || p.url.endsWith('/' + x.code + '.m3u') || p.name.includes(x.name));
    const flagHtml = c ? renderFlag(c.code, c.flag, 18) + ' ' : '';
    return `<div class="src-row">
    <span class="grow"><b>${flagHtml}${esc(p.name)}</b><br><small style="color:#7b8891">${esc(p.url)}</small></span>
    <button class="src-btn ${p.id === state.currentPlaylistId ? 'primary' : ''}" data-sel="${p.id}">${p.id === state.currentPlaylistId ? 'Ativa' : 'Usar'}</button>
    <button class="src-btn" data-ref="${p.id}">${I.refresh}</button>
    <button class="src-btn" data-del="${p.id}">${I.trash}</button></div>`;
  }).join('') || '<p>Nenhuma fonte ainda.</p>';
  const presets = kIptvPresets.map((p, i) => {
    const added = state.playlists.some(x => x.url === p.url);
    const c = allC.find(x => x.url === p.url || p.url.endsWith('/' + x.code + '.m3u') || p.name.includes(x.name));
    const flagHtml = c ? renderFlag(c.code, c.flag, 18) + ' ' : '';
    return `<div class="src-row"><span class="grow">${flagHtml}${esc(p.name)}</span>
      <button class="src-btn ${added ? '' : 'primary'}" data-pre="${i}" ${added ? 'disabled' : ''}>${added ? 'Adicionada' : 'Adicionar'}</button></div>`;
  }).join('');
  modalContent.innerHTML = `
    <h2>Fontes IPTV</h2>
    <p>Ativa: <b>${esc(pl ? pl.name : '—')}</b></p>
    ${rows}
    <h2 style="margin-top:18px">Adicionar lista M3U</h2>
    <div class="src-form"><input id="fName" placeholder="Nome (ex.: Minha lista)"><input id="fUrl" placeholder="URL M3U/M3U8 (https://…)"></div>
    <button class="card-btn primary" id="fAdd">Adicionar fonte</button>
    <h2 style="margin-top:18px">Recomendadas</h2>
    ${presets}`;
  modalBackdrop.classList.add('open');
  lockBody();
  modalContent.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { state.currentPlaylistId = +b.dataset.sel; savePlaylists(); closeModal(); fetchChannels(); });
  modalContent.querySelectorAll('[data-ref]').forEach(b => b.onclick = () => { state.currentPlaylistId = +b.dataset.ref; savePlaylists(); closeModal(); fetchChannels({ force: true }); });
  modalContent.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { deletePlaylist(+b.dataset.del); openSourcesModal(); fetchChannels(); });
  modalContent.querySelectorAll('[data-pre]').forEach(b => b.onclick = () => {
    const p = kIptvPresets[+b.dataset.pre];
    addPlaylist(p.name, p.url); closeModal(); fetchChannels({ force: true });
  });
  $('fAdd').onclick = () => {
    const name = $('fName').value.trim(), url = $('fUrl').value.trim();
    if (!name || !url) { $('fName').focus(); return; }
    addPlaylist(name, url); closeModal(); fetchChannels({ force: true });
  };
}

/* ================= Modal: todos os canais (tela cheia) ================= */
function openAllChannelsModal() {
  const list = state.channels;
  modalContent.innerHTML = `
    <h2>${I.tv} Todos os canais <small class="cnt">${list.length}</small></h2>
    <div class="allch-search"><input id="allchInput" type="text" placeholder="Buscar canal..." autocomplete="off"></div>
    <div class="allch-grid" id="allchGrid"></div>`;
  document.querySelector('.modal').classList.add('tall');
  modalBackdrop.classList.add('open');
  lockBody();
  const grid = $('allchGrid');
  const input = $('allchInput');
  const bind = () => {
    grid.querySelectorAll('.app-card').forEach(card => {
      card.onclick = (e) => {
        if (e.target.closest('.badge.star')) return;
        const ch = findChannel(card.dataset.ch);
        if (ch) { closeModal(); openChannelModal(ch); }
      };
      card.onkeydown = (e) => {
        if (e.key === 'Enter' || e.keyCode === 13 || e.keyCode === 29443) {
          e.preventDefault();
          const ch = findChannel(card.dataset.ch);
          if (ch) { closeModal(); openChannelModal(ch); }
        }
      };
    });
    grid.querySelectorAll('.card-btn').forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const ch = findChannel(b.dataset.id);
      if (ch) { closeModal(); openChannelModal(ch); }
    });
    grid.querySelectorAll('.badge.star').forEach(b => b.onclick = ev => {
      ev.stopPropagation();
      const ch = findChannel(b.dataset.fav);
      if (ch) { toggleFavorite(ch); draw(); }
    });
    bindPreviews();
  };
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const shown = q ? list.filter(c => c.name.toLowerCase().includes(q) || c.id.toLowerCase().includes(q)) : list;
    grid.innerHTML = shown.length
      ? shown.map(channelCard).join('')
      : '<p class="menu-help">Nenhum canal encontrado.</p>';
    bind();
  };
  input.oninput = draw;
  draw();
  input.focus();
}
function openMenuModal() {
  const cur = settings;
  const sizeRow = kCardSizes.map((w, i) =>
    `<button class="src-btn ${cur.gridSizeLevel === i ? 'primary' : ''}" data-size="${i}">${['XXG', 'GG', 'Médio', 'P', 'PP'][i]}</button>`).join('');
  const colorRow = kThemePalette.map(c =>
    `<button class="swatch ${cur.themeColor === c.value ? 'active' : ''}" data-color="${c.value}" style="background:${c.value}" title="${c.name}"></button>`).join('');
  modalContent.innerHTML = `
    <h2>Menu</h2>
    <h3>${I.tv} Canais</h3>
    <div class="menu-row"><span class="grow">Atualizar canais da fonte ativa</span><button class="src-btn" id="mRefresh">${I.refresh} Atualizar</button></div>
    <div class="menu-row"><span class="grow">Limpar canais recentes <small id="mRecentN">(${state.recents.length})</small></span><button class="src-btn" id="mClearRecent">Limpar</button></div>
    <h3>${I.gear} Fontes</h3>
    <div class="menu-row"><span class="grow">Gerir listas M3U e fontes recomendadas</span><button class="src-btn primary" id="mSources">Abrir</button></div>
    <div class="menu-row" style="flex-direction:column;align-items:stretch">
      <span>Thumbnails (base pública do R2) <small>ex.: https://pub-xxxx.r2.dev</small></span>
      <div style="display:flex;gap:6px;margin-top:6px">
        <input id="mThumbBase" placeholder="URL da base pública" value="${esc(settings.thumbBase || '')}" style="flex:1">
        <button class="src-btn primary" id="mThumbSave">Guardar</button>
      </div>
    </div>
    <div class="menu-row" style="flex-direction:column;align-items:stretch">
      <span>Servidor proxy HLS <small>vazio = automático (Pages /api ou localhost:5501) · ex.: https://tunel.trycloudflare.com</small></span>
      <div style="display:flex;gap:6px;margin-top:6px">
        <input id="mProxyBase" placeholder="https://meu-proxy..." value="${esc(settings.proxyBase || '')}" style="flex:1">
        <button class="src-btn primary" id="mProxySave">Guardar</button>
      </div>
      <small style="color:#7b8891;margin-top:4px">Deteção agora: ${hlsProxyOk ? 'proxy a responder' : 'sem proxy (ligação direta)'}</small>
    </div>
    <h3>${I.play} Reprodução</h3>
    <div class="menu-row"><span class="grow">Mini-janela ao sair <small>(retomar onde parou)</small></span><button class="src-btn" id="mMini">${cur.miniOnExit ? 'Ligado' : 'Desligado'}</button></div>
    <div class="menu-row"><span class="grow">Temporizador de sono <small id="mSleepLeft">${sleepRemainingLabel()}</small></span>
      <span>${[15, 30, 45, 60].map(mn => `<button class="src-btn" data-sleep="${mn}">${mn}m</button>`).join('')} <button class="src-btn" data-sleep="0">Off</button></span></div>
    <h3>${I.palette} Interface</h3>
    <div class="menu-row"><span class="grow">Tamanho dos cartões de canal</span><span>${sizeRow}</span></div>
    <div class="menu-row"><span class="grow">Cor de destaque</span><span>${colorRow}</span></div>
    <h3>${I.shield} Legal & Privacidade</h3>
    <div class="menu-row"><span class="grow">Termos de Uso e Política de Privacidade <small>(Conformidade LGPD)</small></span><button class="src-btn primary" id="mTerms">Ler Termos</button></div>
    <h3>${I.clock} Atalhos (no player)</h3>
    <h3>${I.gear} Segurança</h3>
    <div class="menu-row"><span class="grow">Proteger exibição</span><button class="src-btn" style="color:#ef4444;border-color:rgba(239,68,68,0.4)" id="mLockApp">Bloquear Tela / Sair</button></div>
    <p class="menu-help">Espaço = pausar · F = ecrã inteiro · S = parar · M = som · Esc = fechar</p>`;
  modalBackdrop.classList.add('open');
  lockBody();
  $('mRefresh').onclick = () => { fetchChannels({ force: true }); openMenuModal(); };
  $('mClearRecent').onclick = () => { clearRecents(); openMenuModal(); };
  $('mSources').onclick = openSourcesModal;
  $('mThumbSave').onclick = () => {
    settings.thumbBase = $('mThumbBase').value.trim();
    saveSettings(); loadThumbs().then(renderCards); openMenuModal();
  };
  $('mProxySave').onclick = () => {
    settings.proxyBase = $('mProxyBase').value.trim();
    saveSettings();
    checkHlsProxy().then(() => { openMenuModal(); renderCards(); });
  };
  $('mMini').onclick = () => { settings.miniOnExit = !settings.miniOnExit; saveSettings(); openMenuModal(); };
  if ($('mLockApp')) $('mLockApp').onclick = lockApp;
  if ($('mTerms')) $('mTerms').onclick = openTermsModal;
  modalContent.querySelectorAll('[data-sleep]').forEach(b => b.onclick = () => {
    setSleep(+b.dataset.sleep); openMenuModal();
  });
  modalContent.querySelectorAll('[data-size]').forEach(b => b.onclick = () => {
    settings.gridSizeLevel = +b.dataset.size; saveSettings(); applySettings(); renderCards(); openMenuModal();
  });
  modalContent.querySelectorAll('[data-color]').forEach(b => b.onclick = () => {
    settings.themeColor = b.dataset.color; saveSettings(); applySettings(); openMenuModal();
  });
  // Refresca a contagem do temporizador enquanto o menu está aberto
  if (sleepTickTimer) { /* já corre globalmente */ }
}

/* ================= Init ================= */


/* ================= Utilitários de Bandeiras ================= */
function renderFlag(code, emoji = '', size = 20) {
  if (!code) return emoji ? '<span class="flag-fallback">' + emoji + '</span>' : '';
  const clean = String(code).toLowerCase();
  const cdnCode = clean === 'uk' ? 'gb' : clean;
  const h = Math.round(size * 0.75);
  return '<img class="flag-icon" src="https://flagcdn.com/w40/' + cdnCode + '.png" srcset="https://flagcdn.com/w80/' + cdnCode + '.png 2x" width="' + size + '" height="' + h + '" alt="' + clean.toUpperCase() + '" loading="lazy" onerror="this.style.display=\'none\'">';
}
window.renderFlag = renderFlag;

function detectChannelCountry(ch) {
  const all = window.kCountriesList || [];
  if (!all.length) return null;
  if (ch && ch.id) {
    const m = String(ch.id).match(/\.([A-Z]{2})(@|$)/i);
    if (m) {
      const found = all.find(c => c.code === m[1].toLowerCase());
      if (found) return found;
    }
  }
  const pl = currentPlaylist();
  if (pl) {
    const plCountry = all.find(c => c.url === pl.url || pl.url.endsWith('/' + c.code + '.m3u') || pl.name.includes(c.name));
    if (plCountry) return plCountry;
  }
  const defCode = store.get('playtv.activeCountryCode', 'br');
  return all.find(c => c.code === defCode) || null;
}

/* ================= Seletor de Países ================= */
function updateCountryButton() {
  const pl = currentPlaylist();
  const allCountries = window.kCountriesList || [];
  let currentCountry = null;
  if (pl) {
    currentCountry = allCountries.find(c => c.url === pl.url || pl.name.includes(c.name) || pl.url.endsWith('/' + c.code + '.m3u'));
  }
  if (!currentCountry) {
    const code = store.get('playtv.activeCountryCode', 'br');
    currentCountry = allCountries.find(c => c.code === code) || allCountries.find(c => c.code === 'br') || allCountries[0];
  }
  if (currentCountry) {
    const flagEl = $('countryCurrentFlag');
    const nameEl = $('countryCurrentName');
    if (flagEl) flagEl.innerHTML = renderFlag(currentCountry.code, currentCountry.flag, 22);
    if (nameEl) nameEl.textContent = currentCountry.name;
  }
}
window.updateCountryButton = updateCountryButton;

function selectCountry(countryCode) {
  const allCountries = window.kCountriesList || [];
  const c = allCountries.find(x => x.code === countryCode);
  if (!c) return;

  store.set('playtv.activeCountryCode', c.code);
  const flagEl = $('countryCurrentFlag');
  const nameEl = $('countryCurrentName');
  if (flagEl) flagEl.innerHTML = renderFlag(c.code, c.flag, 22);
  if (nameEl) nameEl.textContent = c.name;

  // Localiza ou adiciona playlist correspondente
  let pl = state.playlists.find(p => p.url === c.url || p.url.endsWith('/' + c.code + '.m3u'));
  if (!pl) {
    const id = addPlaylist(c.flag + ' ' + c.name, c.url);
    state.currentPlaylistId = id;
  } else {
    state.currentPlaylistId = pl.id;
    savePlaylists();
  }

  state.group = null; // volta para "Todos"
  const searchInput = $('searchInput');
  if (searchInput) searchInput.value = '';
  fetchChannels();
}

function initCountryPicker() {
  const btn = $('btnCountry');
  const dropdown = $('countryDropdown');
  const listEl = $('countryList');
  const searchInput = $('countrySearchInput');
  const selector = $('countrySelector');
  if (!btn || !dropdown || !listEl) return;

  const allCountries = window.kCountriesList || [];

  function renderCountryDropdown(filter = '') {
    const q = filter.trim().toLowerCase();
    const activeCode = store.get('playtv.activeCountryCode', 'br');

    let html = '';
    if (!q) {
      const popular = allCountries.filter(c => c.popular);
      html += '<div class="country-section-title">Populares</div>';
      html += popular.map(c => renderCountryItem(c, c.code === activeCode)).join('');

      const rest = allCountries.filter(c => !c.popular);
      html += '<div class="country-section-title">Todos os Países (A-Z)</div>';
      html += rest.map(c => renderCountryItem(c, c.code === activeCode)).join('');
    } else {
      const filtered = allCountries.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.code.toLowerCase().includes(q) ||
        (c.engName && c.engName.toLowerCase().includes(q))
      );
      if (filtered.length === 0) {
        html = '<div class="country-empty">Nenhum país encontrado</div>';
      } else {
        html = filtered.map(c => renderCountryItem(c, c.code === activeCode)).join('');
      }
    }
    listEl.innerHTML = html;

    listEl.querySelectorAll('.country-item').forEach(el => {
      el.onclick = () => {
        selectCountry(el.dataset.code);
        closeCountryDropdown();
      };
    });
  }

  function renderCountryItem(c, isActive) {
    return '<button class="country-item ' + (isActive ? 'active' : '') + '" data-code="' + esc(c.code) + '">' +
      '<span class="item-flag">' + renderFlag(c.code, c.flag, 20) + '</span>' +
      '<span class="item-name">' + esc(c.name) + '</span>' +
      (isActive ? '<span class="item-check">✓</span>' : '') +
    '</button>';
  }

  function openCountryDropdown() {
    dropdown.hidden = false;
    selector.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    renderCountryDropdown(searchInput.value);
    searchInput.focus();
  }

  function closeCountryDropdown() {
    dropdown.hidden = true;
    selector.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
    searchInput.value = '';
  }

  btn.onclick = (e) => {
    e.stopPropagation();
    if (dropdown.hidden) openCountryDropdown();
    else closeCountryDropdown();
  };

  searchInput.oninput = (e) => {
    renderCountryDropdown(e.target.value);
  };

  document.addEventListener('click', (e) => {
    if (!selector.contains(e.target)) {
      closeCountryDropdown();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !dropdown.hidden) {
      closeCountryDropdown();
      btn.focus();
    }
  });

  updateCountryButton();
}

function init() {
  loadAll();
  syncGlobalAdConfig();
  $('searchInput').addEventListener('input', renderCards);
  $('prevSlide').onclick = () => { const n = (window._heroSlides || welcomeSlides).length; slide = (slide + n - 1) % n; renderSlide(); };
  $('nextSlide').onclick = () => { const n = (window._heroSlides || welcomeSlides).length; slide = (slide + 1) % n; renderSlide(); };
  $('heroArt').onclick = () => { const ch = findChannel($('heroArt').dataset.id || ''); if (ch) openChannelModal(ch); };
  $('modalClose').onclick = closeModal;
  modalBackdrop.onclick = e => { if (e.target === modalBackdrop) closeModal(); };
  if ($('btnTerms')) $('btnTerms').onclick = openTermsModal;
  $('btnSources').onclick = openSourcesModal;
  $('btnMenu').onclick = openMenuModal;
  setupDeviceFeatures();

  applySettings();
  // Deteta o proxy HLS local (se ativo, os streams passam por ele).
  checkHlsProxy();
  // Thumbnails: carrega o mapa id->url (se houver base configurada) e redesenha.
  loadThumbs().then(() => { if (state.channels.length) renderCards(); });
  // Retoma o temporizador de sono guardado, se ainda tiver tempo restante.
  if (sleepUntil && sleepUntil > Date.now()) setSleep((sleepUntil - Date.now()) / 60000); else if (sleepUntil) cancelSleep();

  renderAll();
  // Primeira execução: adiciona o preset padrão (kDefaultPreset), como o XPlayer.
  if (!state.playlists.length) addPlaylist(kDefaultPreset.name, kDefaultPreset.url);
  initCountryPicker();
  // Garante atualização do cache com links reescritos em HTTPS
  const activeCached = store.get(K.cache(state.currentPlaylistId || 1), '');
  if (kIsHosted && activeCached && !activeCached.includes('/proxy?url=')) {
    fetchChannels({ force: true });
  } else {
    fetchChannels();
  }
}
/* ================= Autenticação e Tela de Bloqueio ================= */
const AUTH_KEY = 'playtv.auth_session';
const VALID_USER = 'admin';
const VALID_PASS = '@Pmpo1516';

function isUserAuthenticated() {
  try {
    return sessionStorage.getItem(AUTH_KEY) === 'true' || localStorage.getItem(AUTH_KEY) === 'true';
  } catch (_) {
    return false;
  }
}

let appInitialized = false;
function unlockApp() {
  const lock = $('lockScreen');
  const app = $('appShell');
  if (lock) lock.style.display = 'none';
  if (app) app.style.display = '';
  if (!appInitialized) {
    appInitialized = true;
    init();
  }
  startHeartbeat();
}

function lockApp() {
  try {
    sessionStorage.removeItem(AUTH_KEY);
    localStorage.removeItem(AUTH_KEY);
  } catch (_) {}
  location.reload();
}

function setupLockScreen() {
  if (isUserAuthenticated()) {
    unlockApp();
    return;
  }

  const lockScreen = $('lockScreen');
  const app = $('appShell');
  if (lockScreen) lockScreen.style.display = 'flex';
  if (app) app.style.display = 'none';

  const lockForm = $('lockForm');
  const lockUser = $('lockUser');
  const lockPass = $('lockPass');
  const lockRemember = $('lockRemember');
  const lockError = $('lockError');
  const lockCard = document.querySelector('.lock-card');
  const toggleBtn = $('lockTogglePass');

  if (toggleBtn && lockPass) {
    toggleBtn.onclick = () => {
      const isText = lockPass.type === 'text';
      lockPass.type = isText ? 'password' : 'text';
      toggleBtn.style.color = isText ? '#647788' : 'var(--accent, #08a765)';
    };
  }

  if (lockForm) {
    lockForm.onsubmit = (e) => {
      e.preventDefault();
      const u = (lockUser.value || '').trim();
      const p = (lockPass.value || '').trim();

      if (u === VALID_USER && p === VALID_PASS) {
        if (lockError) lockError.hidden = true;
        if (lockRemember && lockRemember.checked) {
          localStorage.setItem(AUTH_KEY, 'true');
        } else {
          sessionStorage.setItem(AUTH_KEY, 'true');
        }
        unlockApp();
      } else {
        if (lockError) lockError.hidden = false;
        if (lockCard) {
          lockCard.classList.remove('lock-shake');
          void lockCard.offsetWidth; // trigger reflow
          lockCard.classList.add('lock-shake');
        }
        lockPass.value = '';
        lockPass.focus();
      }
    };
  }
}

document.addEventListener('DOMContentLoaded', setupLockScreen);

/* ================= Telemetria / Monitoramento de Aparelhos ================= */
function getDeviceId() {
  try {
    let id = localStorage.getItem('playtv.device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36).substring(4);
      localStorage.setItem('playtv.device_id', id);
    }
    return id;
  } catch (_) {
    return 'dev_anon';
  }
}

function detectClientInfo() {
  const ua = navigator.userAgent;
  let type = 'Computador';
  if (/smart-tv|smarttv|tizen|webos|hbbtv|appletv|googletv|android tv|viera|bravia|netcast/i.test(ua)) type = 'Smart TV';
  else if (/ipad|tablet/i.test(ua)) type = 'Tablet';
  else if (/mobile|iphone|android/i.test(ua)) type = 'Celular';

  let os = 'Desconhecido';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/tizen/i.test(ua)) os = 'Tizen OS';
  else if (/webos/i.test(ua)) os = 'webOS';

  let browser = 'Web';
  if (/chrome|crios/i.test(ua) && !/edge|opr/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edg/i.test(ua)) browser = 'Edge';

  return { type, os, browser };
}

let heartbeatTimer = null;
function sendHeartbeat() {
  if (!kIsHosted) return;
  const client = detectClientInfo();
  const chName = state.current ? (state.current.name || 'Assistindo') : 'Navegando';

  fetch('/api/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      deviceId: getDeviceId(),
      deviceType: client.type,
      os: client.os,
      browser: client.browser,
      channel: chName,
      isPlaying: !!(state.current && hls),
    }),
  }).catch(() => {});
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  sendHeartbeat();
  heartbeatTimer = setInterval(sendHeartbeat, 25000);
}

/* ================= Suporte Avançado Smart TV & Mobile ================= */
let isTvDevice = false;

function handleSmartTvDpad(e) {
  const key = e.key;
  const code = e.keyCode || e.which;

  const isBack = key === 'Escape' || code === 27 || code === 8 || code === 10009 || code === 461;
  const isEnter = key === 'Enter' || code === 13 || code === 29443;
  const isUp = key === 'ArrowUp' || code === 38;
  const isDown = key === 'ArrowDown' || code === 40;
  const isLeft = key === 'ArrowLeft' || code === 37;
  const isRight = key === 'ArrowRight' || code === 39;
  const isChUp = code === 427 || (isUp && modalBackdrop.classList.contains('open'));
  const isChDown = code === 428 || (isDown && modalBackdrop.classList.contains('open'));
  const isPlayPause = key === ' ' || code === 32 || code === 179 || code === 415 || code === 19;
  const isFullscreenKey = key === 'f' || key === 'F' || code === 70;

  // 1. Se o modal de vídeo estiver aberto:
  if (modalBackdrop.classList.contains('open')) {
    if (isBack) {
      e.preventDefault();
      closeModal();
      return;
    }
    if (isChUp) {
      e.preventDefault();
      playNeighborChannel(-1);
      return;
    }
    if (isChDown) {
      e.preventDefault();
      playNeighborChannel(1);
      return;
    }
    if (isRight) {
      const ns = $('mNextSrc');
      if (ns) { e.preventDefault(); ns.click(); return; }
    }
    if (isPlayPause) {
      const v = $('pv');
      if (v) {
        e.preventDefault();
        v.paused ? v.play().catch(() => {}) : v.pause();
      }
      return;
    }
    if (isFullscreenKey) {
      e.preventDefault();
      toggleVideoFullscreen();
      return;
    }
    return;
  }

  // 2. Se a tela de bloqueio estiver visível:
  const lock = $('lockScreen');
  if (lock && lock.style.display !== 'none') {
    const focusables = [$('lockUser'), $('lockPass'), $('lockRemember'), $('lockSubmit')].filter(Boolean);
    const active = document.activeElement;
    const curIdx = focusables.indexOf(active);
    if (isDown && curIdx !== -1 && curIdx < focusables.length - 1) {
      e.preventDefault();
      focusables[curIdx + 1].focus();
    } else if (isUp && curIdx > 0) {
      e.preventDefault();
      focusables[curIdx - 1].focus();
    }
    return;
  }

  // 3. Dropdown de países
  if (isBack) {
    const cd = $('countryDropdown');
    if (cd && !cd.hidden) {
      e.preventDefault();
      closeCountryDropdown();
      $('btnCountry').focus();
      return;
    }
  }

  // 4. Navegação D-Pad espacial na grade do catálogo:
  if (isUp || isDown || isLeft || isRight) {
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
      if (isLeft || isRight) return;
      if (isDown) {
        e.preventDefault();
        const firstCard = document.querySelector('.app-card');
        if (firstCard) firstCard.focus();
        return;
      }
    }

    const focusables = Array.from(document.querySelectorAll(
      '.app-card, .tab, .highlight, #btnCountry, #btnTerms, #btnMenu, #btnSources, #searchInput, .card-btn, .slide-arrow'
    )).filter(el => el.offsetParent !== null);

    if (!focusables.length) return;

    const current = document.activeElement;
    if (!focusables.includes(current)) {
      e.preventDefault();
      focusables[0].focus();
      return;
    }

    const rCur = current.getBoundingClientRect();
    const curCenter = { x: rCur.left + rCur.width / 2, y: rCur.top + rCur.height / 2 };

    let bestEl = null;
    let minDistance = Infinity;

    for (const el of focusables) {
      if (el === current) continue;
      const r = el.getBoundingClientRect();
      const center = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const dx = center.x - curCenter.x;
      const dy = center.y - curCenter.y;

      let isCandidate = false;
      if (isRight && dx > 15) isCandidate = true;
      else if (isLeft && dx < -15) isCandidate = true;
      else if (isDown && dy > 15) isCandidate = true;
      else if (isUp && dy < -15) isCandidate = true;

      if (!isCandidate) continue;

      let dist = (isRight || isLeft)
        ? Math.abs(dx) + Math.abs(dy) * 2.5
        : Math.abs(dy) + Math.abs(dx) * 2.5;

      if (dist < minDistance) {
        minDistance = dist;
        bestEl = el;
      }
    }

    if (bestEl) {
      e.preventDefault();
      bestEl.focus();
      bestEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
  }
}

let deviceFeaturesSetup = false;
function setupDeviceFeatures() {
  if (deviceFeaturesSetup) return;
  deviceFeaturesSetup = true;

  const client = detectClientInfo();
  isTvDevice = client.type === 'Smart TV' ||
    (window.innerWidth >= 1200 && /tv|smart|tizen|webos|hbbtv/i.test(navigator.userAgent));

  if (isTvDevice) {
    document.body.classList.add('is-tv');

    // Oculta cursor do mouse após 3s sem mover na TV
    let mouseTimer = null;
    window.addEventListener('mousemove', () => {
      document.body.classList.remove('hide-cursor');
      if (mouseTimer) clearTimeout(mouseTimer);
      mouseTimer = setTimeout(() => {
        document.body.classList.add('hide-cursor');
      }, 3000);
    });
  }

  document.addEventListener('keydown', handleSmartTvDpad);
}

// Inicializa recursos de dispositivo logo no início
document.addEventListener('DOMContentLoaded', setupDeviceFeatures);
