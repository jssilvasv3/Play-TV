// Cloudflare Pages Function universal
// Atende rotas como /ping, /proxy?url=..., /playlist?url=... na mesma origem do Pages.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': '*',
};

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

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const origin = url.origin;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
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
      const targetUrl = normalizeUpstreamUrl(decodeURIComponent(playlistUrl));
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
    return context.next();
  }

  try {
    let targetUrl = decodeURIComponent(target);
    // Se a URL do target foi codificada em cima de outro proxy, desembrulha
    while (targetUrl.includes('/proxy?url=')) {
      const idx = targetUrl.indexOf('/proxy?url=');
      targetUrl = decodeURIComponent(targetUrl.slice(idx + '/proxy?url='.length));
    }

    // Normaliza IPs diretos para sslip.io
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
