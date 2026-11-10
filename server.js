/* server.js — Servidor único Play TV (estáticos + proxy HLS na mesma origem).
   Serve ficheiros estáticos (index.html, app.js, styles.css, …) e os endpoints
   /api/ping + /api/proxy?url=... na mesma origem, para evitar depender de
   Cloudflare Functions e de funcionar com streams que bloqueiam datacenter.
   Uso:
     node server.js               → http://localhost:5500
     node server.js --port 8080   → porta customizada
*/
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = Number(process.env.PORT || 5500);
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const ALLOWED_ORIGINS = '*';

function proxyUrl(url) {
  return `${requestOrigin}/proxy?url=${encodeURIComponent(url)}`;
}

let requestOrigin = '';

function resolveUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch (_) {
    return value;
  }
}

function rewritePlaylist(text, sourceUrl, base) {
  return text
    .split(/\r?\n/)
    .map(line => {
      if (!line || line.startsWith('#')) {
        if (line.includes('URI=')) {
          return line.replace(/URI="([^"]+)"/g, (_, uri) => {
            const resolved = resolveUrl(uri, sourceUrl);
            return `URI="${base}${encodeURIComponent(resolved)}"`;
          });
        }
        return line;
      }
      if (!line.trim()) return line;
      if (/^https?:\/\//i.test(line)) {
        return `${base}${encodeURIComponent(line.trim())}`;
      }
      try {
        const resolved = resolveUrl(line.trim(), sourceUrl);
        return `${base}${encodeURIComponent(resolved)}`;
      } catch {
        return line;
      }
    })
    .join('\n');
}

async function handleProxy(req, res, origin) {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const targetParam = reqUrl.searchParams.get('url');

  if (!targetParam) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('URL HLS não fornecida');
    return;
  }

  let targetUrl;
  try {
    targetUrl = new URL(targetParam);
    if (!/^https?:?$/i.test(targetUrl.protocol)) {
      throw new Error('URL deve ser http ou https');
    }
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('URL HLS inválida: ' + e.message);
    return;
  }

  requestOrigin = origin;
  try {
    const upstream = await fetch(targetUrl.href, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'PlayTV-Proxy/1.0',
        'Accept': 'application/vnd.apple.mpegurl, */*',
      }
    });

    if (!upstream.ok) {
      res.writeHead(upstream.status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Upstream HTTP ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    const isM3u8ByUrl = /\.m3u8(?:$|\?)/i.test(targetUrl.href);
    const likelyPlaylist = contentType.includes('mpegurl') || isM3u8ByUrl;

    if (likelyPlaylist) {
      const text = await upstream.text();
      const isHls = text.includes('#EXTINF') || text.includes('#EXTM3U');
      if (isHls) {
        const base = `${origin}/proxy?url=`;
        const rewritten = rewritePlaylist(text, targetUrl.href, base);
        res.writeHead(200, {
          'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
          'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
          'Cache-Control': 'no-store',
        });
        res.end(rewritten);
        return;
      }
      res.writeHead(200, {
        'Content-Type': contentType || 'text/plain; charset=utf-8',
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
        'Cache-Control': 'no-store',
      });
      res.end(text);
      return;
    }

    const buffer = await upstream.arrayBuffer();
    if (!res.headersSent) {
      res.writeHead(200, {
        'Content-Type': contentType || 'application/octet-stream',
        'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
        'Cache-Control': 'no-store',
      });
      res.end(Buffer.from(buffer));
    }
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Erro do proxy: ' + err.message);
    }
  }
}

async function handlePlaylist(req, res, origin) {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);
  const playlistUrl = reqUrl.searchParams.get('url');
  if (!playlistUrl) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Missing ?url= parameter');
    return;
  }
  try {
    const upstream = await fetch(decodeURIComponent(playlistUrl), {
      redirect: 'follow',
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*',
      }
    });
    if (!upstream.ok) {
      res.writeHead(upstream.status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Upstream HTTP ${upstream.status}`);
      return;
    }
    let text = await upstream.text();
    const proxyBase = `${origin}/proxy?url=`;
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
    res.writeHead(200, {
      'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
      'Access-Control-Allow-Origin': ALLOWED_ORIGINS,
      'Cache-Control': 'public, max-age=300',
    });
    res.end(text);
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Playlist error: ' + err.message);
    }
  }
}

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://localhost:${PORT}`);

  response.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS);
  response.setHeader('Access-Control-Allow-Headers', '*');
  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  // Ping para deteção automática pelo app (/ping, /proxy/ping, /api/ping)
  if (requestUrl.pathname === '/ping' || requestUrl.pathname === '/proxy/ping' || requestUrl.pathname === '/api/ping') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('ok');
    return;
  }

  // Playlist completa M3U
  if (requestUrl.pathname === '/playlist' && requestUrl.searchParams.has('url')) {
    await handlePlaylist(request, response, `${requestUrl.origin}`);
    return;
  }

  // Proxy no mesmo padrão que o Worker/ app.js: /proxy?url=...
  if (requestUrl.pathname === '/proxy' && requestUrl.searchParams.has('url')) {
    await handleProxy(request, response, `${requestUrl.origin}`);
    return;
  }

  // Estáticos
  let urlPath = decodeURIComponent((request.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT)) {
    response.writeHead(403);
    response.end('Proibido');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Não encontrado');
      return;
    }
    response.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Play TV + Proxy HLS unificado na porta ${PORT}`);
  console.log('Endpoints:');
  console.log('  GET  /proxy/ping          - verifica se o proxy está ativo');
  console.log('  GET  /proxy?url=...       - proxy HLS (reescreve playlist + CORS)');
  console.log(`  -> neste PC:      http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  -> no telemóvel (mesma rede): http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('Para hospedar em Cloudflare Workers (proxy funciona de qualquer lugar):');
  console.log('  cd d:\\play_tv && npx wrangler deploy');
  console.log('  (o proxy passa a ser https://seu-worker.workers.dev/proxy?url=...)');
  console.log('Para expor local com HTTPS via túnel (streams que bloqueiam datacenter):');
  console.log('  npx wrangler pages dev . --port 5500');
  console.log('  ou: cloudflared tunnel --url http://localhost:5500');
});
