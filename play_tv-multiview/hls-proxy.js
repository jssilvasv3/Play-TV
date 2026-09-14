const http = require('http');
const { URL } = require('url');
const os = require('os');

const PORT = Number(process.env.PORT || 5501);
const ALLOWED_ORIGINS = '*';

function proxyUrl(url) {
  return `http://localhost:${PORT}/proxy?url=${encodeURIComponent(url)}`;
}

function resolveUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).href;
  } catch (_) {
    return value;
  }
}

function rewritePlaylist(text, sourceUrl) {
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

const server = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS);
  response.setHeader('Access-Control-Allow-Headers', '*');

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, `http://localhost:${PORT}`);
  // Ping de verificação (usado por app.js para detetar o proxy)
  if (requestUrl.pathname === '/ping') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('ok');
    return;
  }
  if (requestUrl.pathname !== '/proxy') {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('HLS proxy ativo');
    return;
  }

  const target = requestUrl.searchParams.get('url');
  if (!target || !/^https?:$/i.test(new URL(target).protocol)) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('URL HLS invalida');
    return;
  }

  try {
    const upstream = await fetch(target, { redirect: 'follow' });
    if (!upstream.ok) {
      response.writeHead(upstream.status);
      response.end(`Upstream HTTP ${upstream.status}`);
      return;
    }

    const contentType = upstream.headers.get('content-type') || '';
    if (contentType.includes('mpegurl') || /\.m3u8(?:$|\?)/i.test(target)) {
      const playlist = rewritePlaylist(await upstream.text(), target);
      response.writeHead(200, { 'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8', 'Cache-Control': 'no-store' });
      response.end(playlist);
      return;
    }

    response.writeHead(200, { 'Content-Type': contentType || 'application/octet-stream', 'Cache-Control': 'no-store' });
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`Falha no upstream: ${error.message}`);
  }
});

/* Bind 0.0.0.0: permite aceder a partir de telemóveis na mesma rede (Chrome Android). */
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Proxy HLS ativo em http://localhost:${PORT}`);
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`  -> na rede local: http://${net.address}:${PORT}`);
      }
    }
  }
});
