// Cloudflare Pages Function — proxy HLS equivalente ao hls-proxy.js local.
// Rotas: /api/proxy?url=<link HLS>  e  /api/ping (deteção pelo app.js)
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };

function resolveUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch (_) {
    return value;
  }
}

function rewritePlaylist(text, sourceUrl, origin) {
  const proxyUrl = u => `${origin}/api/proxy?url=${encodeURIComponent(u)}`;
  return text
    .split(/\r?\n/)
    .map(line => {
      if (!line || line.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri) => `URI="${proxyUrl(resolveUrl(uri, sourceUrl))}"`);
      }
      return proxyUrl(resolveUrl(line.trim(), sourceUrl));
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

  if (url.pathname.endsWith('/ping')) {
    return new Response('ok', { headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  const target = url.searchParams.get('url');
  let protocol = '';
  try {
    protocol = new URL(target || '').protocol;
  } catch (_) {}
  if (!target || !/^https?:$/i.test(protocol)) {
    return new Response('URL HLS invalida', { status: 400, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } });
  }

  try {
    const upstream = await fetch(target, { redirect: 'follow' });
    if (!upstream.ok) {
      return new Response(`Upstream HTTP ${upstream.status}`, {
        status: upstream.status,
        headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('mpegurl') || /\.m3u8?($|\?)/i.test(target)) {
      const playlist = rewritePlaylist(await upstream.text(), target, origin);
      return new Response(playlist, {
        headers: { ...CORS, 'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8', 'Cache-Control': 'no-store' },
      });
    }

    // Segmentos/media: streaming direto (sem buffer, sem custo de CPU)
    return new Response(upstream.body, {
      headers: { ...CORS, 'Content-Type': contentType || 'application/octet-stream', 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return new Response(`Falha no upstream: ${error.message}`, {
      status: 502,
      headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}