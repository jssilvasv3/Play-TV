// Captura telas e estados conforme docs/limpeza-visual/roteiro.json.
// Uso: node scripts/limpeza-visual/capturar.cjs [antes|depois] [filtro-de-nome]
// Requer o playwright SEM entrar no package.json (npm i --no-save playwright && npx playwright install chromium) e o app rodando em "base".
// Cada ação espera no máximo 5 s. Sai com 1 se alguma captura falhar ou se a página rolar na horizontal. Gera capturas-resultado.json.
const { chromium } = require('playwright');
const fs = require('node:fs'); const path = require('node:path');
const fase = process.argv[2] || 'depois'; const filtro = process.argv[3] || '';
const cfg = JSON.parse(fs.readFileSync('docs/limpeza-visual/roteiro.json', 'utf8'));
const larguras = { desktop: { width: 1280, height: 800 }, celular: { width: 390, height: 844 } };
const pasta = 'docs/limpeza-visual/capturas'; fs.mkdirSync(pasta, { recursive: true });

(async () => {
  const browser = await chromium.launch(); const resultado = [];
  for (const item of cfg.capturas) {
    if (filtro && !item.nome.includes(filtro)) continue;
    for (const tema of ['claro', 'escuro']) for (const [lnome, viewport] of Object.entries(larguras)) {
      const arquivo = `${item.nome}-${tema}-${lnome}-${fase}.png`;
      const ctx = await browser.newContext({ viewport, colorScheme: tema === 'claro' ? 'light' : 'dark' });
      const t = cfg.tema || {};
      if (t.localStorage) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [t.localStorage.chave, t.localStorage[tema]]);
      if (item.armazenamento) await ctx.addInitScript(o => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, item.armazenamento);
      const page = await ctx.newPage(); page.setDefaultTimeout(5000);
      try {
        await page.goto(cfg.base + item.url, { waitUntil: 'networkidle' });
        if (t.classeEscuro && tema === 'escuro') await page.evaluate(k => document.documentElement.classList.add(k), t.classeEscuro);
        for (const a of item.acoes || []) {
          if (a.clicar) await page.click(a.clicar);
          if (a.digitar) await page.fill(a.digitar.seletor, a.digitar.texto);
          if (a.esperar) await page.waitForSelector(a.esperar);
          if (a.pausa) await page.waitForTimeout(a.pausa);
        }
        const rolagemHorizontal = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        await page.screenshot({ path: path.join(pasta, arquivo), fullPage: !!item.paginaInteira });
        resultado.push({ arquivo, ok: !rolagemHorizontal, motivo: rolagemHorizontal ? 'rolagem horizontal' : '' });
      } catch (e) { resultado.push({ arquivo, ok: false, motivo: String(e.message).split('\n')[0] }); }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync('docs/limpeza-visual/capturas-resultado.json', JSON.stringify(resultado, null, 2));
  console.table(resultado);
  process.exit(resultado.every(r => r.ok) ? 0 : 1);
})();
