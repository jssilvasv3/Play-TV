// Play TV – Telemetria centralizada (Durable Object único).
// Todos os heartbeats e o admin passam por esta única instância, então não
// importa em qual datacenter (Wi-Fi, 4G, 5G) o aparelho entrou.

const ACTIVE_MS = 120000;      // aparelho sem heartbeat há mais que isso sai da lista
const MAX_DEVICES = 2000;
const TZ = 'America/Sao_Paulo';

const DEFAULT_ADS = { enabled: true, frequency: 3, skipSeconds: 5, vastUrl: '', directUrl: '' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Chave da hora no fuso do Brasil: "YYYY-MM-DD HH"
function hourKey(ms) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false,
  }).formatToParts(new Date(ms)).reduce((a, x) => (a[x.type] = x.value, a), {});
  const hh = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hh}`;
}

function clockLabel(ms) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(ms));
}

export class Telemetry {
  constructor(state) {
    this.state = state;
    this.devices = new Map();
    this.peak = 0;
    this.peakTime = '';
    this.hourly = {};
    this.adConfig = { ...DEFAULT_ADS };

    state.blockConcurrencyWhile(async () => {
      const s = await state.storage.get(['peak', 'peakTime', 'hourly', 'adConfig']);
      this.peak = s.get('peak') || 0;
      this.peakTime = s.get('peakTime') || '';
      this.hourly = s.get('hourly') || {};
      this.adConfig = { ...DEFAULT_ADS, ...(s.get('adConfig') || {}) };
    });
  }

  prune(now) {
    for (const [id, dev] of this.devices) {
      if (now - dev.lastSeen > ACTIVE_MS) this.devices.delete(id);
    }
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const body = await request.json().catch(() => ({}));
    const now = Date.now();

    if (path === '/heartbeat') {
      const id = String(body.id || '').trim();
      if (!id) return json({ error: 'Missing deviceId' }, 400);

      const existing = this.devices.get(id) || {};
      if (this.devices.size >= MAX_DEVICES && !this.devices.has(id)) {
        this.prune(now);
        if (this.devices.size >= MAX_DEVICES) {
          this.devices.delete(this.devices.keys().next().value);
        }
      }

      this.devices.set(id, {
        id,
        type: body.type || existing.type || 'Computador',
        channel: body.channel || 'Navegando',
        os: body.os || existing.os || 'Web',
        browser: body.browser || existing.browser || '',
        ip: body.ip || existing.ip || '',
        country: body.country || existing.country || 'BR',
        city: body.city || existing.city || '',
        lastSeen: now,
        connectedAt: existing.connectedAt || now,
      });

      this.prune(now);
      const active = this.devices.size;

      const writes = {};
      if (active > this.peak) {
        this.peak = active;
        this.peakTime = clockLabel(now);
        writes.peak = this.peak;
        writes.peakTime = this.peakTime;
      }
      const hk = hourKey(now);
      if ((this.hourly[hk] || 0) < active) {
        this.hourly[hk] = active;
        // mantém só as últimas 48h
        const keys = Object.keys(this.hourly).sort();
        while (keys.length > 48) delete this.hourly[keys.shift()];
        writes.hourly = this.hourly;
      }
      if (Object.keys(writes).length) await this.state.storage.put(writes);

      return json({ ok: true, active });
    }

    if (path === '/stats') {
      this.prune(now);
      const activeDevices = Array.from(this.devices.values());
      const deviceCounts = { tv: 0, mobile: 0, desktop: 0 };
      const deviceCountsDetailed = {};
      const channelCounts = {};
      for (const dev of activeDevices) {
        // Tipos de TV / Box são agrupados como tv
        const type = dev.type;
        deviceCountsDetailed[type] = (deviceCountsDetailed[type] || 0) + 1;
        if (type === 'Smart TV' || type === 'Roku' || type === 'NVIDIA Shield' || type === 'Fire TV / Apple TV' || type === 'OnePlus' || type === 'Xiaomi / Android TV' || type === 'Humax' || type === 'Popcorn / Ouya' || type === 'Android TV / Box') deviceCounts.tv++;
        else if (type === 'Celular' || type === 'Tablet') deviceCounts.mobile++;
        else deviceCounts.desktop++;
        if (dev.channel && dev.channel !== 'Navegando') {
          channelCounts[dev.channel] = (channelCounts[dev.channel] || 0) + 1;
        }
      }
      const ranking = Object.entries(channelCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const labels = [];
      const values = [];
      for (let i = 23; i >= 0; i--) {
        const t = now - i * 3600 * 1000;
        const hk = hourKey(t);
        labels.push(`${hk.slice(11, 13)}:00`);
        values.push(this.hourly[hk] || 0);
      }
      values[values.length - 1] = Math.max(values[values.length - 1], activeDevices.length);

      return json({
        onlineCount: activeDevices.length,
        peak: Math.max(this.peak, activeDevices.length),
        peakTime: this.peakTime || 'Hoje',
        topChannel: ranking[0] || null,
        deviceCounts,
        deviceCountsDetailed,
        ranking: ranking.slice(0, 5),
        devices: activeDevices.sort((a, b) => b.lastSeen - a.lastSeen),
        chart: { labels, values },
      });
    }

    if (path === '/ads/get') return json(this.adConfig);

    if (path === '/ads/set') {
      this.adConfig = {
        enabled: body.enabled !== false,
        frequency: Math.max(1, parseInt(body.frequency || 3, 10)),
        skipSeconds: Math.max(0, parseInt(body.skipSeconds || 5, 10)),
        vastUrl: String(body.vastUrl || '').trim(),
        directUrl: String(body.directUrl || '').trim(),
      };
      await this.state.storage.put('adConfig', this.adConfig);
      return json({ ok: true, adConfig: this.adConfig });
    }

    return json({ error: 'Not found' }, 404);
  }
}

export default {
  async fetch() {
    return new Response('playtv-telemetry: use via Durable Object binding', { status: 404 });
  },
};
