// Cloudflare Pages Function universal
// Atende rotas como /ping, /proxy?url=..., /playlist?url=... na mesma origem do Pages.

const SECURITY_HEADERS = {
  'X-Frame-Options': 'SAMEORIGIN',
  'Content-Security-Policy': "frame-ancestors 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
  ...SECURITY_HEADERS,
};

const BLOCKED_BOT_TOKENS = [
  'python-requests',
  'python-urllib',
  'aiohttp',
  'httpx',
  'scrapy',
  'curl/',
  'wget/',
  'go-http-client',
  'postmanruntime',
  'insomnia',
  'node-fetch',
  'undici',
  'headlesschrome',
  'phantomjs',
  'selenium',
  'puppeteer',
  'playwright',
  'apache-httpclient',
  'java/',
  'libwww-perl',
  'nikto',
  'sqlmap',
  'dirbuster',
  'censys',
  'zgrab',
  'nmap',
  'masscan',
  'semrushbot',
  'ahrefsbot',
  'dotbot',
  'mj12bot',
  'petalbot',
  'zoominfobot'
];

function isBlockedBot(request, url) {
  const ua = (request.headers.get('user-agent') || '').toLowerCase();
  const isProtectedPath = url.pathname.startsWith('/api/') || 
                          url.pathname.startsWith('/proxy') || 
                          url.pathname.startsWith('/playlist') || 
                          url.searchParams.has('url');

  if (!ua && isProtectedPath) {
    return true;
  }

  if (ua) {
    for (const bot of BLOCKED_BOT_TOKENS) {
      if (ua.includes(bot)) {
        return true;
      }
    }
  }

  return false;
}

function isHotlink(request, url) {
  const isProtectedPath = url.pathname.startsWith('/api/') || 
                          url.pathname.startsWith('/proxy') || 
                          url.pathname.startsWith('/playlist') || 
                          url.searchParams.has('url');
  if (!isProtectedPath) return false;

  const secFetchSite = request.headers.get('sec-fetch-site') || '';
  const referer = request.headers.get('referer') || '';
  const origin = request.headers.get('origin') || '';

  // Bloqueia se navegador indicar explicitamente cross-site
  if (secFetchSite === 'cross-site') {
    return true;
  }

  const currentHost = url.host.toLowerCase().split(':')[0];
  const isAllowedHost = (host) => {
    if (!host) return false;
    const h = host.toLowerCase().split(':')[0];
    return (
      h === currentHost ||
      h === 'play-tv.pages.dev' ||
      h.endsWith('.play-tv.pages.dev') ||
      h === 'localhost' ||
      h === '127.0.0.1'
    );
  };

  if (referer) {
    try {
      const refHost = new URL(referer).host;
      if (!isAllowedHost(refHost)) return true;
    } catch (_) {
      return true;
    }
  }

  if (origin) {
    try {
      const origHost = new URL(origin).host;
      if (!isAllowedHost(origHost)) return true;
    } catch (_) {
      return true;
    }
  }

  return false;
}

function resolveUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch (_) {
    return value;
  }
}

/**
 * Converte IP numérico (ex: 45.162.64.114) para hostname FQDN (45.162.64.114.sslip.io).
 * Isso contorna nativamente a restrição da Cloudflare (Error 1003: Direct IP access not allowed).
 */
function normalizeUpstreamUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(u.hostname)) {
      u.hostname = `${u.hostname}.sslip.io`;
    }
    return u.href;
  } catch (_) {
    return rawUrl;
  }
}

function rewriteMediaPlaylist(text, sourceUrl, proxyBase) {
  return text
    .split(/\r?\n/)
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        if (line.includes('URI=')) {
          return line.replace(/URI="([^"]+)"/g, (_, uri) => {
            // Se já tem proxy, não duplica (evita erro 414 URI Too Long)
            if (uri.startsWith(proxyBase) || uri.includes('/proxy?url=')) return `URI="${uri}"`;
            const resolved = resolveUrl(uri, sourceUrl);
            return `URI="${proxyBase}${encodeURIComponent(resolved)}"`;
          });
        }
        return line;
      }

      // Se a linha já é uma URL do proxy, mantém como está
      if (trimmed.startsWith(proxyBase) || trimmed.includes('/proxy?url=')) {
        return trimmed;
      }

      try {
        const resolved = resolveUrl(trimmed, sourceUrl);
        return `${proxyBase}${encodeURIComponent(resolved)}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

// Global de telemetria
const ADMIN_SECRET = 'playtv_sec_@Pmpo1516_cf_worker_key_2026';

async function generateAdminToken() {
  const exp = Date.now() + 12 * 3600 * 1000; // 12 horas
  const payload = 'admin:' + exp;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(ADMIN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const sigHex = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return btoa(payload) + '.' + sigHex;
}

async function verifyAdminToken(authHeader) {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token || !token.includes('.')) return false;

  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [b64Payload, sigHex] = parts;

  try {
    const payload = atob(b64Payload);
    const [user, expStr] = payload.split(':');
    const exp = parseInt(expStr, 10);
    if (!exp || Date.now() > exp || user !== 'admin') {
      return false;
    }
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(ADMIN_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const matchBytes = sigHex.match(/.{1,2}/g);
    if (!matchBytes) return false;
    const sigBytes = new Uint8Array(matchBytes.map(byte => parseInt(byte, 16)));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payload));
    return valid;
  } catch (_) {
    return false;
  }
}

function validateProxyUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { ok: false, error: 'Protocolo inválido. Apenas HTTP e HTTPS são permitidos.' };
    }
    const dangerousPorts = new Set(['22', '25', '110', '143', '3306', '5432', '6379', '27017', '9200', '11211']);
    if (u.port && dangerousPorts.has(u.port)) {
      return { ok: false, error: 'Porta de destino não permitida.' };
    }
    return { ok: true, url: u.href };
  } catch (_) {
    return { ok: false, error: 'URL malformada.' };
  }
}

let globalTelemetry = {
  devices: new Map(),
  peak: 0,
  peakTime: '',
  hourly: {},
  adConfig: {
    enabled: true,
    frequency: 3,
    skipSeconds: 5,
    vastUrl: '',
    directUrl: '',
  },
};

async function getTelemetryState() {
  try {
    const cache = caches.default;
    const req = new Request('https://playtv-internal.cache/state');
    const cached = await cache.match(req);
    if (cached) {
      const data = await cached.json();
      if (data) {
        if (data.devices) {
          for (const d of data.devices) {
            if (!globalTelemetry.devices.has(d.id) || globalTelemetry.devices.get(d.id).lastSeen < d.lastSeen) {
              globalTelemetry.devices.set(d.id, d);
            }
          }
        }
        globalTelemetry.peak = Math.max(globalTelemetry.peak, data.peak || 0);
        if (data.peakTime) globalTelemetry.peakTime = data.peakTime;
        if (data.hourly) {
          globalTelemetry.hourly = { ...data.hourly, ...globalTelemetry.hourly };
        }
        if (data.adConfig) {
          globalTelemetry.adConfig = { ...globalTelemetry.adConfig, ...data.adConfig };
        }
      }
    }
  } catch (_) {}
  return globalTelemetry;
}

async function saveTelemetryState() {
  try {
    const cache = caches.default;
    const req = new Request('https://playtv-internal.cache/state');
    const stateObj = {
      devices: Array.from(globalTelemetry.devices.values()),
      peak: globalTelemetry.peak,
      peakTime: globalTelemetry.peakTime,
      hourly: globalTelemetry.hourly,
      adConfig: globalTelemetry.adConfig,
    };
    const res = new Response(JSON.stringify(stateObj), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=3600',
      },
    });
    await cache.put(req, res);
  } catch (_) {}
}

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const origin = url.origin;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  // 1. Bloqueio de Bots, Scrapers e Ferramentas Automatizadas
  if (isBlockedBot(request, url)) {
    return new Response('Access Denied: Automated bot or scraper detected.', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...SECURITY_HEADERS,
      },
    });
  }

  // 2. Proteção Anti-Hotlink (impede terceiros de usarem o proxy/API fora do Play TV)
  if (isHotlink(request, url)) {
    return new Response('Access Denied: Hotlinking or unauthorized cross-site access forbidden.', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        ...SECURITY_HEADERS,
      },
    });
  }

  // 1. Rota Heartbeat (telemetria de aparelhos conectados)
  if (url.pathname === '/api/heartbeat') {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS });
    }
    try {
      const body = await request.json().catch(() => ({}));
      const deviceId = String(body.deviceId || '').trim();
      if (!deviceId) {
        return new Response('Missing deviceId', { status: 400, headers: CORS });
      }

      await getTelemetryState();
      const now = Date.now();
      const existing = globalTelemetry.devices.get(deviceId) || {};

      const ipHeader = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
      const country = request.headers.get('cf-ipcountry') || 'BR';
      const city = request.headers.get('cf-ipcity') || '';

      // Teto rígido de memória: máx 2.000 aparelhos simultâneos no Worker
      const MAX_DEVICES = 2000;
      if (globalTelemetry.devices.size >= MAX_DEVICES && !globalTelemetry.devices.has(deviceId)) {
        const oldestKey = globalTelemetry.devices.keys().next().value;
        if (oldestKey) globalTelemetry.devices.delete(oldestKey);
      }

      const updated = {
        id: deviceId.slice(0, 64),
        type: String(body.deviceType || existing.type || 'Computador').slice(0, 32),
        channel: String(body.channel || 'Navegando').slice(0, 80),
        os: String(body.os || existing.os || 'Web').slice(0, 32),
        browser: String(body.browser || existing.browser || '').slice(0, 48),
        ip: ipHeader.split(',')[0].trim().slice(0, 45),
        country: String(country || 'BR').slice(0, 5),
        city: String(city || '').slice(0, 50),
        lastSeen: now,
        connectedAt: existing.connectedAt || now,
      };

      globalTelemetry.devices.set(deviceId, updated);

      // Limpeza de inativos (> 65s)
      for (const [id, dev] of globalTelemetry.devices.entries()) {
        if (now - dev.lastSeen > 65000) {
          globalTelemetry.devices.delete(id);
        }
      }

      const currentActive = globalTelemetry.devices.size;
      if (currentActive > globalTelemetry.peak) {
        globalTelemetry.peak = currentActive;
        const d = new Date();
        globalTelemetry.peakTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }

      const curHour = `${String(new Date().getHours()).padStart(2, '0')}:00`;
      globalTelemetry.hourly[curHour] = Math.max(globalTelemetry.hourly[curHour] || 0, currentActive);

      context.waitUntil ? context.waitUntil(saveTelemetryState()) : saveTelemetryState();

      return new Response(JSON.stringify({ ok: true, active: currentActive }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 500,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
  }

  // 1.5 Rota de Login Administrativo (Validação Server-Side e Emissão de Token HMAC)
  if (url.pathname === '/api/admin/login') {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405, headers: CORS });
    }
    const body = await request.json().catch(() => ({}));
    const user = String(body.user || '').trim();
    const pass = String(body.pass || '').trim();

    if (user === 'admin' && pass === '@Pmpo1516') {
      const token = await generateAdminToken();
      return new Response(JSON.stringify({ ok: true, token }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: false, error: 'Credenciais inválidas' }), {
      status: 401,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // 2. Rota de Estatísticas do Admin (sem acesso público)
  if (url.pathname === '/api/admin/stats') {
    const auth = request.headers.get('authorization') || '';
    const isAuthorized = await verifyAdminToken(auth);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    await getTelemetryState();
    const now = Date.now();

    const activeDevices = [];
    const deviceCounts = { tv: 0, mobile: 0, desktop: 0 };
    const channelCounts = {};

    for (const [id, dev] of globalTelemetry.devices.entries()) {
      if (now - dev.lastSeen <= 65000) {
        activeDevices.push(dev);
        if (dev.type === 'Smart TV') deviceCounts.tv++;
        else if (dev.type === 'Celular' || dev.type === 'Tablet') deviceCounts.mobile++;
        else deviceCounts.desktop++;

        if (dev.channel && dev.channel !== 'Navegando') {
          channelCounts[dev.channel] = (channelCounts[dev.channel] || 0) + 1;
        }
      } else {
        globalTelemetry.devices.delete(id);
      }
    }

    const ranking = Object.entries(channelCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const labels = [];
    const values = [];
    const currentHour = new Date().getHours();
    for (let i = 23; i >= 0; i--) {
      const h = (currentHour - i + 24) % 24;
      const key = `${String(h).padStart(2, '0')}:00`;
      labels.push(key);
      values.push(globalTelemetry.hourly[key] || 0);
    }
    values[values.length - 1] = Math.max(values[values.length - 1] || 0, activeDevices.length);

    const responseData = {
      onlineCount: activeDevices.length,
      peak: Math.max(globalTelemetry.peak, activeDevices.length),
      peakTime: globalTelemetry.peakTime || 'Hoje',
      topChannel: ranking.length > 0 ? ranking[0] : null,
      deviceCounts,
      ranking: ranking.slice(0, 5),
      devices: activeDevices.sort((a, b) => b.lastSeen - a.lastSeen),
      chart: { labels, values },
    };

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }

  // 2.1 Configuração Pública de Anúncios (usada pelo player)
  if (url.pathname === '/api/ads/config') {
    await getTelemetryState();
    return new Response(JSON.stringify(globalTelemetry.adConfig), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
    });
  }

  // 2.2 Salvar Configuração de Anúncios (Admin HilltopAds)
  if (url.pathname === '/api/admin/ads') {
    const auth = request.headers.get('authorization') || '';
    const isAuthorized = await verifyAdminToken(auth);
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: CORS });
    }
    const body = await request.json().catch(() => ({}));
    await getTelemetryState();
    globalTelemetry.adConfig = {
      enabled: body.enabled !== false,
      frequency: Math.max(1, parseInt(body.frequency || 3, 10)),
      skipSeconds: Math.max(0, parseInt(body.skipSeconds || 5, 10)),
      vastUrl: String(body.vastUrl || '').trim(),
      directUrl: String(body.directUrl || '').trim(),
    };
    context.waitUntil ? context.waitUntil(saveTelemetryState()) : saveTelemetryState();
    return new Response(JSON.stringify({ ok: true, adConfig: globalTelemetry.adConfig }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }

  // Ping de status
  if (url.pathname.endsWith('/ping')) {
    return new Response('ok', {
      headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // Playlist completa M3U
  if (url.pathname.endsWith('/playlist')) {
    const playlistUrl = url.searchParams.get('url');
    if (!playlistUrl) {
      return new Response('Missing ?url= parameter', { status: 400, headers: CORS });
    }

    try {
      const val = validateProxyUrl(decodeURIComponent(playlistUrl));
      if (!val.ok) {
        return new Response(val.error, { status: 400, headers: CORS });
      }
      const targetUrl = normalizeUpstreamUrl(val.url);
      const resp = await fetch(targetUrl, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
          'Accept': '*/*',
        },
      });

      if (!resp.ok) {
        return new Response(`Failed to fetch playlist: HTTP ${resp.status}`, {
          status: resp.status,
          headers: CORS,
        });
      }

      let text = await resp.text();
      const proxyBase = `${origin}/proxy?url=`;

      text = text
        .split(/\r?\n/)
        .map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;
          // Se já está com proxy, não duplica
          if (trimmed.startsWith(proxyBase) || trimmed.includes('/proxy?url=')) {
            return trimmed;
          }
          if (/^https?:\/\//i.test(trimmed)) {
            return proxyBase + encodeURIComponent(trimmed);
          }
          return line;
        })
        .join('\n');

      return new Response(text, {
        status: 200,
        headers: {
          ...CORS,
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      });
    } catch (err) {
      return new Response('Playlist error: ' + err.message, { status: 500, headers: CORS });
    }
  }

  // Proxy de stream HLS
  const target = url.searchParams.get('url');
  if (!target) {
    const res = await context.next();
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
      headers.set(k, v);
    }
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  }

  try {
    let targetUrl = decodeURIComponent(target);
    // Se a URL do target foi codificada em cima de outro proxy, desembrulha
    while (targetUrl.includes('/proxy?url=')) {
      const idx = targetUrl.indexOf('/proxy?url=');
      targetUrl = decodeURIComponent(targetUrl.slice(idx + '/proxy?url='.length));
    }

    const val = validateProxyUrl(targetUrl);
    if (!val.ok) {
      return new Response(val.error, { status: 400, headers: CORS });
    }
    // Normaliza IPs diretos para sslip.io
    const upstreamUrl = normalizeUpstreamUrl(val.url);

    const reqHeaders = {
      'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
      'Accept': '*/*',
      'Accept-Language': '*',
      'Connection': 'keep-alive',
    };

    if (request.headers.has('range')) {
      reqHeaders['Range'] = request.headers.get('range');
    }

    const upstream = await fetch(upstreamUrl, {
      redirect: 'follow',
      headers: reqHeaders,
    });

    if (!upstream.ok) {
      const errBody = await upstream.text().catch(() => '');
      return new Response(`Upstream HTTP ${upstream.status}: ${errBody.slice(0, 150)}`, {
        status: upstream.status,
        headers: CORS,
      });
    }

    const contentType = upstream.headers.get('content-type') || '';
    const isM3u8ByUrl = /\.m3u8(?:$|\?)/i.test(targetUrl) || /\.m3u8(?:$|\?)/i.test(upstreamUrl);
    const isPlaylistType = contentType.includes('mpegurl') || contentType.includes('m3u8') || contentType.includes('text/plain') || contentType.includes('application/x-mpegurl');
    const isBinaryMedia = /\.(ts|m4s|mp4|aac|mp3)(?:$|\?)/i.test(targetUrl) || contentType.startsWith('video/mp2t') || contentType.startsWith('video/mp4');

    // Usa upstream.url (a URL final após eventuais redirecionamentos 302/301, como Pluto TV / jmp2.uk)
    const finalBaseUrl = upstream.url || upstreamUrl;

    if (!isBinaryMedia && (isM3u8ByUrl || isPlaylistType || !contentType)) {
      const text = await upstream.text();
      if (text.includes('#EXTM3U') || text.includes('#EXTINF') || isM3u8ByUrl) {
        const playlist = rewriteMediaPlaylist(text, finalBaseUrl, `${origin}/proxy?url=`);
        return new Response(playlist, {
          headers: {
            ...CORS,
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Cache-Control': 'no-store',
          },
        });
      }
    }

    const respHeaders = {
      ...CORS,
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=10',
    };
    if (upstream.headers.has('content-range')) respHeaders['Content-Range'] = upstream.headers.get('content-range');
    if (upstream.headers.has('accept-ranges')) respHeaders['Accept-Ranges'] = upstream.headers.get('accept-ranges');
    if (upstream.headers.has('content-length')) respHeaders['Content-Length'] = upstream.headers.get('content-length');

    return new Response(upstream.body, {
      status: upstream.status,
      headers: respHeaders,
    });
  } catch (error) {
    return new Response(`Upstream error: ${error.message}`, {
      status: 502,
      headers: CORS,
    });
  }
}
