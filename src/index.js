// Play TV HLS & Playlist Proxy – Cloudflare Worker
// Suporta reescrita de playlists (.m3u/.m3u8), segmentos HLS (.ts, .m4s) e ping de verificação.
// CORS completo ativado para consumo em qualquer origem.

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
  };
}

function resolveUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch (_) {
    return value;
  }
}

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
            if (uri.startsWith(proxyBase) || uri.includes('/proxy?url=')) return `URI="${uri}"`;
            const resolved = resolveUrl(uri, sourceUrl);
            return `URI="${proxyBase}${encodeURIComponent(resolved)}"`;
          });
        }
        return line;
      }

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // 2. Ping de status para o player verificar automaticamente se o proxy está ativo
    if (url.pathname === '/ping' || url.pathname === '/proxy/ping') {
      return new Response('ok', {
        status: 200,
        headers: {
          ...corsHeaders(),
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store',
        },
      });
    }

    // 2.1 Rota Heartbeat (telemetria de aparelhos conectados)
    if (url.pathname === '/api/heartbeat') {
      if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders() });
      }
      try {
        const body = await request.json().catch(() => ({}));
        const deviceId = String(body.deviceId || '').trim();
        if (!deviceId) return new Response('Missing deviceId', { status: 400, headers: corsHeaders() });

        const now = Date.now();
        const ipHeader = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '127.0.0.1';
        const country = request.headers.get('cf-ipcountry') || 'BR';
        const city = request.headers.get('cf-ipcity') || '';

        const updated = {
          id: deviceId,
          type: body.deviceType || 'Computador',
          channel: body.channel || 'Navegando',
          os: body.os || 'Web',
          browser: body.browser || '',
          ip: ipHeader.split(',')[0].trim(),
          country,
          city,
          lastSeen: now,
        };

        if (!globalThis._devices) globalThis._devices = new Map();
        globalThis._devices.set(deviceId, updated);

        for (const [id, dev] of globalThis._devices.entries()) {
          if (now - dev.lastSeen > 65000) globalThis._devices.delete(id);
        }

        const active = globalThis._devices.size;
        if (!globalThis._peak || active > globalThis._peak) {
          globalThis._peak = active;
          const d = new Date();
          globalThis._peakTime = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }

        return new Response(JSON.stringify({ ok: true, active }), {
          status: 200,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), {
          status: 500,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }
    }

    // 2.2 Rota de Estatísticas do Admin
    if (url.pathname === '/api/admin/stats') {
      const auth = request.headers.get('authorization') || '';
      if (!auth.includes('admin_authorized')) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), {
          status: 401,
          headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        });
      }

      if (!globalThis._devices) globalThis._devices = new Map();
      const now = Date.now();
      const activeDevices = [];
      const deviceCounts = { tv: 0, mobile: 0, desktop: 0 };
      const channelCounts = {};

      for (const [id, dev] of globalThis._devices.entries()) {
        if (now - dev.lastSeen <= 65000) {
          activeDevices.push(dev);
          if (dev.type === 'Fire TV / Apple TV' || dev.type === 'Roku' || dev.type === 'NVIDIA Shield' || dev.type === 'Xiaomi / Android TV' || dev.type === 'OnePlus' || dev.type === 'Humax' || dev.type === 'Popcorn / Ouya' || dev.type === 'Android TV / Box') deviceCounts.tv++;
          else if (dev.type === 'Celular' || dev.type === 'Tablet') deviceCounts.mobile++;
          else deviceCounts.desktop++;

          if (dev.channel && dev.channel !== 'Navegando') {
            channelCounts[dev.channel] = (channelCounts[dev.channel] || 0) + 1;
          }
        } else {
          globalThis._devices.delete(id);
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
        labels.push(`${String(h).padStart(2, '0')}:00`);
        values.push(0);
      }
      values[values.length - 1] = activeDevices.length;

      return new Response(JSON.stringify({
        onlineCount: activeDevices.length,
        peak: Math.max(globalThis._peak || 0, activeDevices.length),
        peakTime: globalThis._peakTime || 'Hoje',
        topChannel: ranking.length > 0 ? ranking[0] : null,
        deviceCounts,
        ranking: ranking.slice(0, 5),
        devices: activeDevices.sort((a, b) => b.lastSeen - a.lastSeen),
        chart: { labels, values },
      }), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      });
    }

    // 2.3 Configuração Pública de Anúncios (HilltopAds)
    if (url.pathname === '/api/ads/config') {
      if (!globalThis._adConfig) {
        globalThis._adConfig = {
          enabled: true,
          frequency: 3,
          skipSeconds: 5,
          vastUrl: '',
          directUrl: '',
        };
      }
      return new Response(JSON.stringify(globalThis._adConfig), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      });
    }

    // 2.4 Salvar Configuração de Anúncios (Admin HilltopAds)
    if (url.pathname === '/api/admin/ads') {
      const auth = request.headers.get('authorization') || '';
      if (!auth.includes('admin_authorized')) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders() });
      }
      const body = await request.json().catch(() => ({}));
      globalThis._adConfig = {
        enabled: body.enabled !== false,
        frequency: Math.max(1, parseInt(body.frequency || 3, 10)),
        skipSeconds: Math.max(0, parseInt(body.skipSeconds || 5, 10)),
        vastUrl: String(body.vastUrl || '').trim(),
        directUrl: String(body.directUrl || '').trim(),
      };
      return new Response(JSON.stringify({ ok: true, adConfig: globalThis._adConfig }), {
        status: 200,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      });
    }

    // 3. Rota /playlist?url=...: baixa a lista de canais M3U e reescreve links de streams
    if (url.pathname === '/playlist') {
      const playlistUrl = url.searchParams.get('url');
      if (!playlistUrl) {
        return new Response('Parâmetro ?url= em falta', {
          status: 400,
          headers: corsHeaders(),
        });
      }

      try {
        const targetUrl = normalizeUpstreamUrl(decodeURIComponent(playlistUrl));
        const resp = await fetch(targetUrl, {
          redirect: 'follow',
          headers: {
            'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
            'Accept': '*/*',
          },
        });

        if (!resp.ok) {
          return new Response(`Erro ao buscar playlist: HTTP ${resp.status}`, {
            status: resp.status,
            headers: corsHeaders(),
          });
        }

        let text = await resp.text();
        const proxyBase = `${url.origin}/proxy?url=`;

        text = text
          .split(/\r?\n/)
          .map(line => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return line;
            if (trimmed.startsWith(proxyBase) || trimmed.includes('/proxy?url=')) return trimmed;
            if (/^https?:\/\//i.test(trimmed)) {
              return proxyBase + encodeURIComponent(trimmed);
            }
            return line;
          })
          .join('\n');

        return new Response(text, {
          status: 200,
          headers: {
            ...corsHeaders(),
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Cache-Control': 'public, max-age=300',
          },
        });
      } catch (err) {
        return new Response('Playlist error: ' + err.message, {
          status: 500,
          headers: corsHeaders(),
        });
      }
    }

    // 4. Rota do Proxy de Stream individual: /proxy?url=... ou /?url=...
    const hasProxyPath = url.pathname === '/proxy' || url.pathname === '/';
    const targetParam = url.searchParams.get('url');

    if (hasProxyPath && targetParam) {
      let targetUrl;
      try {
        targetUrl = decodeURIComponent(targetParam);
        while (targetUrl.includes('/proxy?url=')) {
          const idx = targetUrl.indexOf('/proxy?url=');
          targetUrl = decodeURIComponent(targetUrl.slice(idx + '/proxy?url='.length));
        }
        const parsed = new URL(targetUrl);
        if (!/^https?:$/i.test(parsed.protocol)) {
          throw new Error('URL deve ser http ou https');
        }
      } catch (e) {
        return new Response('URL inválida: ' + e.message, {
          status: 400,
          headers: corsHeaders(),
        });
      }

      try {
        const upstreamUrl = normalizeUpstreamUrl(targetUrl);
        const reqHeaders = {
          'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
          'Accept': '*/*',
          'Accept-Language': '*',
          'Connection': 'keep-alive',
        };
        if (request.headers.has('range')) {
          reqHeaders['Range'] = request.headers.get('range');
        }

        const response = await fetch(upstreamUrl, {
          redirect: 'follow',
          headers: reqHeaders,
        });

        if (!response.ok) {
          const errBody = await response.text().catch(() => '');
          return new Response(`Upstream HTTP ${response.status}: ${errBody.slice(0, 150)}`, {
            status: response.status,
            headers: corsHeaders(),
          });
        }

        const contentType = response.headers.get('content-type') || '';
        const isM3u8ByUrl = /\.m3u8(?:$|\?)/i.test(targetUrl) || /\.m3u8(?:$|\?)/i.test(upstreamUrl);
        const isPlaylistType = contentType.includes('mpegurl') || contentType.includes('m3u8') || contentType.includes('text/plain') || contentType.includes('application/x-mpegurl');
        const isBinaryMedia = /\.(ts|m4s|mp4|aac|mp3)(?:$|\?)/i.test(targetUrl) || contentType.startsWith('video/mp2t') || contentType.startsWith('video/mp4');

        // Usa response.url (a URL final após eventuais redirecionamentos 302/301, como Pluto TV / jmp2.uk)
        const finalBaseUrl = response.url || upstreamUrl;

        if (!isBinaryMedia && (isM3u8ByUrl || isPlaylistType || !contentType)) {
          const text = await response.text();
          if (text.includes('#EXTM3U') || text.includes('#EXTINF') || isM3u8ByUrl) {
            const proxyBase = `${url.origin}/proxy?url=`;
            const rewritten = rewriteMediaPlaylist(text, finalBaseUrl, proxyBase);
            return new Response(rewritten, {
              status: 200,
              headers: {
                ...corsHeaders(),
                'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
                'Cache-Control': 'no-store',
              },
            });
          }
        }

        const respHeaders = {
          ...corsHeaders(),
          'Content-Type': contentType || 'application/octet-stream',
          'Cache-Control': 'public, max-age=10',
        };
        if (response.headers.has('content-range')) respHeaders['Content-Range'] = response.headers.get('content-range');
        if (response.headers.has('accept-ranges')) respHeaders['Accept-Ranges'] = response.headers.get('accept-ranges');
        if (response.headers.has('content-length')) respHeaders['Content-Length'] = response.headers.get('content-length');

        return new Response(response.body, {
          status: response.status,
          headers: respHeaders,
        });
      } catch (err) {
        return new Response('Proxy stream error: ' + err.message, {
          status: 502,
          headers: corsHeaders(),
        });
      }
    }

    // 5. Se houver Assets estáticos configurados (Workers Static Assets), repassa para o frontend
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    // 6. Mensagem de status padrão caso acesse a raiz sem parâmetros
    if (url.pathname === '/') {
      return new Response(
        'Play TV Proxy Ativo.\nEndpoints:\n  /ping\n  /proxy?url=STREAM_URL\n  /playlist?url=PLAYLIST_URL',
        { status: 200, headers: corsHeaders() }
      );
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders() });
  },
};
