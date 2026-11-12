const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const fase = process.argv[2] || 'depois';
const filtro = process.argv[3] || '';
const cfg = JSON.parse(fs.readFileSync('docs/limpeza-visual/roteiro.json', 'utf8'));
const larguras = {
  desktop: { width: 1280, height: 800 },
  celular: { width: 390, height: 844 },
};
const pasta = 'docs/limpeza-visual/capturas';
fs.mkdirSync(pasta, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const resultado = [];
  for (const item of cfg.capturas) {
    if (filtro && !item.nome.includes(filtro)) continue;
    for (const tema of ['claro', 'escuro']) {
      for (const [lnome, viewport] of Object.entries(larguras)) {
        const arquivo = `${item.nome}-${tema}-${lnome}-${fase}.png`;
        const ctx = await browser.newContext({
          viewport,
          colorScheme: tema === 'claro' ? 'light' : 'dark',
        });
        const t = cfg.tema || {};
        if (t.localStorage) {
          await ctx.addInitScript(
            ([key, value]) => localStorage.setItem(key, value),
            [t.localStorage.chave, t.localStorage[tema]],
          );
        }
        if (item.armazenamento) {
          await ctx.addInitScript(
            (values) => {
              for (const [key, value] of Object.entries(values)) {
                localStorage.setItem(key, value);
              }
            },
            item.armazenamento,
          );
        }
        const page = await ctx.newPage();
        page.setDefaultTimeout(5000);
        try {
          await page.goto(cfg.base + item.url, { waitUntil: 'domcontentloaded' });
          if (t.classeEscuro && tema === 'escuro') {
            await page.evaluate((key) => document.documentElement.classList.add(key), t.classeEscuro);
          }
          for (const action of item.acoes || []) {
            if (action.clicar) await page.click(action.clicar);
            if (action.digitar) await page.fill(action.digitar.seletor, action.digitar.texto);
            if (action.esperar) await page.waitForSelector(action.esperar);
            if (action.pausa) await page.waitForTimeout(action.pausa);
          }
          const rolagemHorizontal = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          );
          await page.screenshot({
            path: path.join(pasta, arquivo),
            fullPage: !!item.paginaInteira,
          });
          resultado.push({
            arquivo,
            ok: !rolagemHorizontal,
            motivo: rolagemHorizontal ? 'rolagem horizontal' : '',
          });
        } catch (error) {
          resultado.push({
            arquivo,
            ok: false,
            motivo: String(error.message).split('\n')[0],
          });
        }
        await ctx.close();
      }
    }
  }
  await browser.close();
  fs.writeFileSync(
    'docs/limpeza-visual/capturas-resultado.json',
    JSON.stringify(resultado, null, 2),
  );
  console.table(resultado);
  process.exit(resultado.every((item) => item.ok) ? 0 : 1);
})();
