#!/usr/bin/env node
// Capturas de tela SEM npm e SEM Playwright: usa o Chrome, Edge ou Chromium que já estão instalados
// (controlado pelo protocolo DevTools, exige Node 22 ou superior; em Node mais antigo cai num modo reduzido).
// Uso: node capturar-simples.cjs <antes|depois> --base http://localhost:5173 [--rotas / /login] [--pasta docs/limpeza-visual/capturas]
//        [--espera 1500] [--classe-escuro dark] [--storage chave=claro,escuro]
// Para cada rota salva um PNG por tema (claro, escuro) e tela (desktop 1280x800, celular 390x844):
//   <pasta>/<antes|depois>/<rota>-<tema>-<tela>.png   e   capturas-resultado.json ao lado da pasta
// Tema escuro: emula prefers-color-scheme. Se o app troca de tema por classe no <html>, use --classe-escuro dark;
// se troca por localStorage, use --storage tema=claro,escuro (chave=valorClaro,valorEscuro).
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const args = process.argv.slice(2);
const fase = args[0];
if (!["antes", "depois"].includes(fase)) { console.error("Uso: node capturar-simples.cjs <antes|depois> --base URL [--rotas ...] [--pasta DIR] [--espera MS] [--classe-escuro dark] [--storage chave=claro,escuro]"); process.exit(1); }
const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : d; };
const base = (opt("--base", "") || "").replace(/\/$/, "");
if (!base) { console.error("Informe --base, por exemplo --base http://localhost:5173 (o app precisa estar rodando)."); process.exit(1); }
const i0 = args.indexOf("--rotas");
let rotas = ["/"];
if (i0 >= 0) { rotas = []; for (let k = i0 + 1; k < args.length && !args[k].startsWith("--"); k++) rotas.push(args[k]); if (!rotas.length) rotas = ["/"]; }
const pasta = opt("--pasta", "docs/limpeza-visual/capturas");
const espera = Number(opt("--espera", "1500"));
const classeEscuro = opt("--classe-escuro", "");
const storage = (opt("--storage", "") || "").match(/^([^=]+)=([^,]+),(.+)$/);
const TELAS = [["desktop", 1280, 800, false], ["celular", 390, 844, true]];
const TEMAS = ["claro", "escuro"];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function achaNavegador() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const c = [];
  if (process.platform === "win32") {
    for (const b of [process.env.PROGRAMFILES, process.env["PROGRAMFILES(X86)"], process.env.LOCALAPPDATA].filter(Boolean)) {
      c.push(path.join(b, "Google/Chrome/Application/chrome.exe"), path.join(b, "Microsoft/Edge/Application/msedge.exe"), path.join(b, "Chromium/Application/chrome.exe"));
    }
  } else if (process.platform === "darwin") {
    c.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge", "/Applications/Chromium.app/Contents/MacOS/Chromium");
  } else {
    for (const d of (process.env.PATH || "").split(":")) for (const n of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "microsoft-edge", "chrome"]) c.push(path.join(d, n));
    try { const cache = path.join(os.homedir(), ".cache/ms-playwright"); for (const d of fs.readdirSync(cache)) if (d.startsWith("chromium")) for (const sub of ["chrome-linux/chrome", "chrome-linux64/chrome"]) c.push(path.join(cache, d, sub)); } catch {}
  }
  return c.find((p) => fs.existsSync(p));
}
const nav = achaNavegador();
if (!nav) { console.error("Não encontrei Chrome, Edge nem Chromium. Defina CHROME_PATH com o caminho do executável, ou use o navegador do agente."); process.exit(1); }

const destino = path.join(pasta, fase);
fs.mkdirSync(destino, { recursive: true });
const slug = (r) => (r === "/" ? "inicio" : r.replace(/^\/+|\/+$/g, "").replace(/[^a-zA-Z0-9]+/g, "-").slice(0, 60)) || "inicio";
const nome = (rota, tema, tela) => path.join(destino, `${slug(rota)}-${tema}-${tela}.png`);
const resultado = [];
const avisos = [];
const perfil = fs.mkdtempSync(path.join(os.tmpdir(), "lvia-chrome-"));
const registrar = (rota, tema, tela, arquivo, ok, erro) => {
  resultado.push({ rota, tema, tela, arquivo: arquivo.split(path.sep).join("/"), ok, erro });
  console.log(`${ok ? "ok    " : "FALHOU"} ${arquivo}${erro ? "  (" + erro + ")" : ""}`);
};

// ---------- modo completo: protocolo DevTools ----------
async function comDevTools() {
  const flags = ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${perfil}`, "about:blank"];
  const proc = spawn(nav, flags, { stdio: "ignore" });
  try {
    let porta;
    for (let t = 0; t < 100 && !porta; t++) {
      await dormir(100);
      try { porta = fs.readFileSync(path.join(perfil, "DevToolsActivePort"), "utf8").split("\n")[0]; } catch {}
    }
    if (!porta) throw new Error("o navegador não abriu a porta de controle");
    let alvo;
    for (let t = 0; t < 50 && !alvo; t++) {
      try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json/list`)).json()).find((x) => x.type === "page"); } catch {}
      if (!alvo) await dormir(100);
    }
    if (!alvo) throw new Error("não achei a aba do navegador");
    const ws = new WebSocket(alvo.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error("falha ao conectar no navegador")); });
    let n = 0;
    const pend = new Map();
    const ouvintes = [];
    ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && pend.has(d.id)) { const { res, rej } = pend.get(d.id); pend.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
      else if (d.method) for (const o of ouvintes) o(d);
    };
    const cmd = (method, params = {}) => new Promise((res, rej) => { const id = ++n; pend.set(id, { res, rej }); ws.send(JSON.stringify({ id, method, params })); });
    const carregar = async (url) => {
      const pronto = new Promise((res) => { const o = (d) => { if (d.method === "Page.loadEventFired") { ouvintes.splice(ouvintes.indexOf(o), 1); res(); } }; ouvintes.push(o); setTimeout(res, 20000); });
      await cmd("Page.navigate", { url });
      await pronto;
      await dormir(espera);
    };
    await cmd("Page.enable");
    await cmd("Runtime.enable");
    for (const rota of rotas) for (const tema of TEMAS) for (const [tela, w, h, movel] of TELAS) {
      const arquivo = nome(rota, tema, tela);
      try {
        await cmd("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: movel });
        await cmd("Emulation.setEmulatedMedia", { features: [{ name: "prefers-color-scheme", value: tema === "escuro" ? "dark" : "light" }] });
        if (storage) {
          await carregar(base + rota);
          await cmd("Runtime.evaluate", { expression: `localStorage.setItem(${JSON.stringify(storage[1])}, ${JSON.stringify(tema === "escuro" ? storage[3] : storage[2])})` });
        }
        await carregar(base + rota);
        if (classeEscuro) await cmd("Runtime.evaluate", { expression: `document.documentElement.classList.${tema === "escuro" ? "add" : "remove"}(${JSON.stringify(classeEscuro)})` });
        await dormir(200);
        const lm = await cmd("Page.getLayoutMetrics");
        const alt = Math.min(Math.ceil(lm.cssContentSize?.height || lm.contentSize.height), 6000);
        const shot = await cmd("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.max(alt, h), scale: 1 } });
        fs.writeFileSync(arquivo, Buffer.from(shot.data, "base64"));
        registrar(rota, tema, tela, arquivo, true);
      } catch (e) { registrar(rota, tema, tela, arquivo, false, String(e.message).slice(0, 160)); }
    }
    ws.close();
  } finally { try { proc.kill(); } catch {} }
}

// ---------- modo reduzido: linha de comando (Node antigo). O escuro depende do navegador aceitar a preferência ----------
function modoReduzido() {
  avisos.push("Modo reduzido (Node sem WebSocket): o tema escuro NÃO é garantido e as opções --classe-escuro e --storage são ignoradas. Atualize para Node 22 ou use o navegador do agente.");
  for (const rota of rotas) for (const tema of TEMAS) for (const [tela, w, h] of TELAS) {
    const arquivo = nome(rota, tema, tela);
    spawnSync(nav, ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", `--user-data-dir=${perfil}`, `--window-size=${w},${h}`, `--virtual-time-budget=${Math.max(espera, 3000)}`, `--screenshot=${arquivo}`, base + rota], { timeout: 60000 });
    const ok = fs.existsSync(arquivo) && fs.statSync(arquivo).size > 1000;
    registrar(rota, tema, tela, arquivo, ok, ok ? undefined : "sem arquivo");
  }
}

(async () => {
  try {
    if (typeof WebSocket === "function") await comDevTools(); else modoReduzido();
  } catch (e) {
    console.error("Erro: " + e.message);
    process.exit(1);
  } finally { try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {} }

  // Escuro idêntico ao claro: o app provavelmente não segue a preferência do sistema.
  for (const rota of rotas) for (const [tela] of TELAS) {
    const a = nome(rota, "claro", tela), b = nome(rota, "escuro", tela);
    if (fs.existsSync(a) && fs.existsSync(b) && fs.readFileSync(a).equals(fs.readFileSync(b))) avisos.push(`${rota} (${tela}): o tema escuro saiu idêntico ao claro. Se o app troca de tema por classe, use --classe-escuro; por localStorage, use --storage; senão capture pelo navegador do agente.`);
  }
  const resumo = path.join(path.dirname(path.resolve(pasta)), "capturas-resultado.json");
  fs.writeFileSync(resumo, JSON.stringify({ fase, navegador: nav, capturas: resultado, avisos }, null, 2));
  for (const a of avisos) console.log("AVISO: " + a);
  const falhas = resultado.filter((x) => !x.ok).length;
  console.log(`\n${resultado.length - falhas} de ${resultado.length} capturas salvas em ${destino}`);
  process.exit(falhas ? 1 : 0);
})();
