/**
 * Play TV — Servidor de thumbnails (solução "YouTube real").
 *
 * O que faz:
 *  1. Lê a lista M3U (PLAYLIST_URL).
 *  2. Para cada canal, captura 1 frame com FFmpeg (a "thumbnail" do momento).
 *  3. Envia a imagem para um bucket Cloudflare R2 (API S3-compatível).
 *  4. Gera e publica `thumbs.json` ({ idDoCanal: urlPublica }) no mesmo bucket.
 *  5. Repete a cada THUMB_INTERVAL_MIN minutos (ou corre 1x com --once).
 *
 * Configuração (variáveis de ambiente ou ficheiro .env junto a este script).
 * Como ativar o acesso público no R2: Dashboard → R2 → bucket → Settings →
 * Public access → "Allow Access" (r2.dev) ou liga um domínio próprio;
 * usa essa URL em R2_PUBLIC_BASE.
 */

const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// --- .env simples (sem dependências) ---
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const CFG = {
  playlistUrl: process.env.PLAYLIST_URL,
  accountId: process.env.R2_ACCOUNT_ID,
  accessKey: process.env.R2_ACCESS_KEY_ID,
  secretKey: process.env.R2_SECRET_ACCESS_KEY,
  bucket: process.env.R2_BUCKET,
  publicBase: (process.env.R2_PUBLIC_BASE || '').replace(/\/+$/, ''),
  intervalMin: Number(process.env.THUMB_INTERVAL_MIN || 60),
  concurrency: Number(process.env.THUMB_CONCURRENCY || 3),
  width: Number(process.env.THUMB_WIDTH || 320),
};

for (const [k, v] of Object.entries(CFG)) {
  if (!v && k !== 'intervalMin' && k !== 'concurrency' && k !== 'width') {
    console.error(`[erro] Falta a variável ${k.toUpperCase()} (ver .env)`);
    process.exit(1);
  }
}

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${CFG.accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: CFG.accessKey, secretAccessKey: CFG.secretKey },
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------- M3U (mesma lógica simplificada do Play TV) ---------- */
async function fetchM3U(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status} ao ler a M3U`);
  return res.text();
}
function parseM3U(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.startsWith('#EXTINF')) continue;
    const attr = (name) => {
      const m = l.match(new RegExp(`${name}="([^"]*)"`));
      return m ? m[1] : '';
    };
    const name = (l.split(',').pop() || '').trim();
    const url = (lines[i + 1] || '').trim();
    if (!url || url.startsWith('#')) continue;
    const id = (attr('tvg-id') || name).toUpperCase();
    out.push({ id, name, url, logo: attr('tvg-logo') });
  }
  // Uma thumb por canal (id único): fica com a 1ª URL encontrada
  const map = new Map();
  for (const c of out) if (!map.has(c.id)) map.set(c.id, c);
  return [...map.values()];
}

/* ---------- FFmpeg: captura 1 frame ---------- */
function snapFrame(streamUrl, outJpg, width) {
  return new Promise((resolve, reject) => {
    // -rw_timeout: aborta se o stream não responder (µs)
    const args = [
      '-hide_banner', '-loglevel', 'error', '-y',
      '-rw_timeout', String(12 * 1000 * 1000),
      '-i', streamUrl,
      '-frames:v', '1', '-q:v', '4',
      '-vf', `scale=${width}:-2`,
      outJpg,
    ];
    execFile('ffmpeg', args, { timeout: 25000 }, (err) => {
      if (err) reject(err); else resolve();
    });
  });
}

/* ---------- R2 upload ---------- */
async function upload(key, body, contentType) {
  await r2.send(new PutObjectCommand({ Bucket: CFG.bucket, Key: key, Body: body, ContentType: contentType }));
}

/* ---------- Ciclo principal ---------- */
async function captureAll() {
  const t0 = Date.now();
  console.log(`[${new Date().toISOString()}] Ciclo iniciado`);
  const channels = parseM3U(await fetchM3U(CFG.playlistUrl));
  console.log(`Canais na lista: ${channels.length}`);
  const thumbs = {};      // id -> url pública
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playtv-thumb-'));
  let ok = 0, fail = 0;

  const queue = [...channels];
  async function worker() {
    while (queue.length) {
      const ch = queue.shift();
      const file = path.join(tmpDir, `${ch.id.replace(/[^A-Za-z0-9_-]/g, '_')}.jpg`);
      try {
        await snapFrame(ch.url, file, CFG.width);
        const key = `thumbs/${ch.id.replace(/[^A-Za-z0-9._-]/g, '_')}.jpg`;
        await upload(key, fs.readFileSync(file), 'image/jpeg');
        thumbs[ch.id] = `${CFG.publicBase}/${key}`;
        ok++;
      } catch (_) {
        fail++; // stream offline/sem vídeo: não interrompe o ciclo
      } finally {
        try { fs.unlinkSync(file); } catch (_) {}
      }
    }
  }
  await Promise.all(Array.from({ length: CFG.concurrency }, worker));

  // Publica o mapa (o Play TV lê isto para mostrar as thumbs)
  await upload('thumbs.json', JSON.stringify(thumbs, null, 1), 'application/json');
  fs.rmSync(tmpDir, { recursive: true, force: true });
  console.log(`Ciclo concluído em ${Math.round((Date.now() - t0) / 1000)}s — ok: ${ok}, falhas: ${fail}`);
  console.log(`thumbs.json disponível em ${CFG.publicBase}/thumbs.json`);
}

async function main() {
  if (process.argv.includes('--once')) {
    await captureAll();
    return;
  }
  for (;;) {
    try { await captureAll(); } catch (e) { console.error('[erro]', e.message); }
    console.log(`Próximo ciclo em ${CFG.intervalMin} min`);
    await sleep(CFG.intervalMin * 60000);
  }
}
main();
