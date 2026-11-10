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

// Global de telemetria — lê segredo em runtime (env não existe no escopo do módulo)
function getAdminSecret() {
  return (typeof env !== 'undefined' && env.HMAC_SECRET) || 'playtv_sec_@Pmpo1516_cf_worker_key_2026';
}

function getAdminPassword() {
  return (typeof env !== 'undefined' && env.ADMIN_PASSWORD) || '@Pmpo1516';
}

function getValidPass() {
  return (typeof env !== 'undefined' && env.VALID_PASS) || '@Pmpo1516';
}

async function generateAdminToken() {
  const exp = Date.now() + 12 * 3600 * 1000; // 12 horas
  const payload = 'admin:' + exp;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(getAdminSecret()),
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
      enc.encode(getAdminSecret()),
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

const ANALYTICS_HOUR_MS = 60 * 60 * 1000;
const ANALYTICS_DAY_MS = 24 * ANALYTICS_HOUR_MS;
const ANALYTICS_LOCAL_DAY_OFFSET_MS = 3 * ANALYTICS_HOUR_MS;
const ANALYTICS_RETENTION_MS = 7 * ANALYTICS_DAY_MS;
let lastAnalyticsPruneAt = 0;

function analyticsDeviceCategory(type) {
  const value = String(type || '').toLowerCase();
  if (value.includes('tv') || value.includes('roku') || value.includes('shield')) return 'tv';
  if (value.includes('celular') || value.includes('tablet') || value.includes('mobile')) return 'mobile';
  return 'desktop';
}

function analyticsChannelName(value) {
  const name = String(value || '')
    .replace(/(?:https?:)?\/\/\S+|www\.\S+/gi, '')
    .replace(/(?:^|\s)(?:[a-z\d-]+\.)+[a-z]{2,}(?::\d+)?(?:\/[^\s]*)?/gi, ' ')
    .replace(/(?:^|\s)(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?(?:\/[^\s]*)?/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return name || 'Canal sem nome';
}

async function pruneAnalytics(db, now) {
  if (now - lastAnalyticsPruneAt < ANALYTICS_DAY_MS) return;
  const cutoff = Math.floor((now - ANALYTICS_RETENTION_MS) / ANALYTICS_HOUR_MS) * ANALYTICS_HOUR_MS;
  await db.batch([
    db.prepare('DELETE FROM analytics_hours WHERE hour_start < ?').bind(cutoff),
    db.prepare('DELETE FROM analytics_channels WHERE hour_start < ?').bind(cutoff),
  ]);
  lastAnalyticsPruneAt = now;
}

async function recordAnalytics(db, { now, activeDevices, previousDevice, channel }) {
  const counts = { tv: 0, mobile: 0, desktop: 0 };
  for (const device of activeDevices) counts[analyticsDeviceCategory(device.type)]++;

  const currentHour = Math.floor(now / ANALYTICS_HOUR_MS) * ANALYTICS_HOUR_MS;
  const statements = [
    db.prepare(`
      INSERT INTO analytics_hours
        (hour_start, peak_devices, peak_tv, peak_mobile, peak_desktop, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(hour_start) DO UPDATE SET
        peak_devices = MAX(peak_devices, excluded.peak_devices),
        peak_tv = MAX(peak_tv, excluded.peak_tv),
        peak_mobile = MAX(peak_mobile, excluded.peak_mobile),
        peak_desktop = MAX(peak_desktop, excluded.peak_desktop),
        updated_at = excluded.updated_at
    `).bind(currentHour, activeDevices.length, counts.tv, counts.mobile, counts.desktop, now),
  ];

  const previousSeen = Number(previousDevice.lastSeen || 0);
  const elapsed = previousSeen && now - previousSeen <= 65000
    ? Math.min(35, Math.max(0, Math.floor((now - previousSeen) / 1000)))
    : 0;
  const previousChannel = analyticsChannelName(previousDevice.channel);
  if (elapsed && previousDevice.channel && previousDevice.channel !== 'Navegando') {
    const previousHour = Math.floor(previousSeen / ANALYTICS_HOUR_MS) * ANALYTICS_HOUR_MS;
    statements.push(db.prepare(`
      INSERT INTO analytics_channels (hour_start, channel, sessions, watch_seconds)
      VALUES (?, ?, 0, ?)
      ON CONFLICT(hour_start, channel) DO UPDATE SET
        watch_seconds = watch_seconds + excluded.watch_seconds
    `).bind(previousHour, previousChannel, elapsed));
  }

  if (channel !== 'Navegando' && (
    !previousSeen ||
    now - previousSeen > 65000 ||
    analyticsChannelName(previousDevice.channel) !== channel
  )) {
    statements.push(db.prepare(`
      INSERT INTO analytics_channels (hour_start, channel, sessions, watch_seconds)
      VALUES (?, ?, 1, 0)
      ON CONFLICT(hour_start, channel) DO UPDATE SET
        sessions = sessions + 1
    `).bind(currentHour, channel));
  }

  await db.batch(statements);
  await pruneAnalytics(db, now);
}

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
      const db = context.env?.TELEMETRY_DB;
      if (!db) {
        return new Response(JSON.stringify({ error: 'Telemetry database is not configured' }), {
          status: 503,
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
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
        channel: analyticsChannelName(body.channel || 'Navegando'),
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

      let historicalAnalyticsStored = true;
      try {
        await recordAnalytics(db, {
          now,
          activeDevices: Array.from(globalTelemetry.devices.values()),
          previousDevice: existing,
          channel: updated.channel,
        });
      } catch (error) {
        historicalAnalyticsStored = false;
        console.error('Failed to store heartbeat analytics in D1:', error);
      }
      context.waitUntil ? context.waitUntil(saveTelemetryState()) : saveTelemetryState();

      return new Response(JSON.stringify({ ok: true, active: currentActive, historicalAnalyticsStored }), {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    } catch (e) {
      console.error('Heartbeat request failed:', e);
      return new Response(JSON.stringify({ error: 'Falha ao registrar heartbeat' }), {
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

    if (user === 'admin' && (pass === getAdminPassword() || '@Pmpo1516')) {
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

    const period = url.searchParams.get('period') || '24h';
    if (period !== '24h' && period !== '7d') {
      return new Response(JSON.stringify({ error: 'Período inválido. Use 24h ou 7d.' }), {
        status: 400,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }
    const db = context.env?.TELEMETRY_DB;
    if (!db) {
      return new Response(JSON.stringify({ error: 'Telemetry database is not configured' }), {
        status: 503,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    await getTelemetryState();
    const now = Date.now();
    const historyUnit = period === '7d' ? ANALYTICS_DAY_MS : ANALYTICS_HOUR_MS;
    const dayOffset = period === '7d' ? ANALYTICS_LOCAL_DAY_OFFSET_MS : 0;
    const currentBucket = Math.floor((now - dayOffset) / historyUnit) * historyUnit + dayOffset;
    const bucketCount = period === '7d' ? 7 : 24;
    const historyStart = currentBucket - (bucketCount - 1) * historyUnit;
    let metricRows;
    let channelRows;
    try {
      await pruneAnalytics(db, now);
      const metricsResult = await db.prepare(`
        SELECT hour_start, peak_devices, peak_tv, peak_mobile, peak_desktop
        FROM analytics_hours
        WHERE hour_start >= ? AND hour_start <= ?
        ORDER BY hour_start
      `).bind(historyStart, now).all();
      metricRows = metricsResult.results || [];
      const channelsResult = await db.prepare(`
        SELECT channel, SUM(sessions) AS sessions, SUM(watch_seconds) AS watch_seconds
        FROM analytics_channels
        WHERE hour_start >= ? AND hour_start <= ?
        GROUP BY channel
        ORDER BY watch_seconds DESC, sessions DESC
        LIMIT 10
      `).bind(historyStart, now).all();
      channelRows = channelsResult.results || [];
    } catch (error) {
      console.error('Failed to read weekly analytics from D1:', error);
      return new Response(JSON.stringify({ error: 'Não foi possível consultar o histórico de métricas.' }), {
        status: 503,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    const activeDevices = [];
    const deviceCounts = { tv: 0, mobile: 0, desktop: 0 };
    const deviceCountsDetailed = {};
    const channelCounts = {};

    for (const [id, dev] of globalTelemetry.devices.entries()) {
      if (now - dev.lastSeen <= 65000) {
        activeDevices.push(dev);
        
        // Contagem detalhada
        const type = dev.type || 'Desconhecido';
        deviceCountsDetailed[type] = (deviceCountsDetailed[type] || 0) + 1;

        deviceCounts[analyticsDeviceCategory(type)]++;

        if (dev.channel && dev.channel !== 'Navegando') {
          channelCounts[dev.channel] = (channelCounts[dev.channel] || 0) + 1;
        }
      } else {
        globalTelemetry.devices.delete(id);
      }
    }

    const activeRanking = Object.entries(channelCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const labels = [];
    const values = [];
    const metricByHour = new Map(metricRows.map(row => [Number(row.hour_start), row]));
    const metricByDay = new Map();
    metricRows.forEach(row => {
      const day = Math.floor((Number(row.hour_start) - ANALYTICS_LOCAL_DAY_OFFSET_MS) / ANALYTICS_DAY_MS)
        * ANALYTICS_DAY_MS + ANALYTICS_LOCAL_DAY_OFFSET_MS;
      const current = metricByDay.get(day) || 0;
      metricByDay.set(day, Math.max(current, Number(row.peak_devices) || 0));
    });
    for (let index = 0; index < bucketCount; index++) {
      const bucket = historyStart + index * historyUnit;
      if (period === '7d') {
        labels.push(new Date(bucket).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }));
        values.push(metricByDay.get(bucket) || 0);
      } else {
        labels.push(new Date(bucket).toLocaleTimeString('pt-BR', { hour: '2-digit', timeZone: 'America/Sao_Paulo' }));
        values.push(Number(metricByHour.get(bucket)?.peak_devices) || 0);
      }
    }

    const peakRow = metricRows.reduce((peak, row) =>
      !peak || Number(row.peak_devices) > Number(peak.peak_devices) ? row : peak, null);
    const historicalPeak = Number(peakRow?.peak_devices) || 0;
    const onlineCount = activeDevices.length;
    const currentIsPeak = onlineCount > historicalPeak;
    const peakTime = currentIsPeak
      ? now
      : peakRow ? Number(peakRow.hour_start) : null;
    const ranking = channelRows.map(row => ({
      name: row.channel,
      count: Number(row.sessions) || 0,
      watchSeconds: Number(row.watch_seconds) || 0,
    }));

    const responseData = {
      period,
      onlineCount,
      peak: Math.max(historicalPeak, onlineCount),
      peakTime,
      topChannel: activeRanking.length > 0 ? activeRanking[0] : null,
      deviceCounts,
      deviceCountsDetailed,
      ranking,
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
