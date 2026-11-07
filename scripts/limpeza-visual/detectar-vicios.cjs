#!/usr/bin/env node
// Detector de vícios visuais de IA. Só Node, sem dependências, qualquer sistema operacional.
// Uso: node detectar-vicios.cjs [raiz] [--json] [--sem-ui] [--max N] [--escopo caminho ...]
// (sem raiz, usa a pasta atual; coloque --escopo por último, pois ele recolhe os caminhos que vêm depois)
// Lê o projeto (não altera nada) e mostra: o placar de 9 números para resumir_placar, os sinais que
// contagem simples não pega (ícone em caixa colorida, card dentro de card, selo, emoji, texto de IA)
// com arquivo e linha, os arquivos mais afetados e a contagem por pasta.
"use strict";
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const JSON_OUT = flag("--json");
const SEM_UI = flag("--sem-ui");
let MAX = 3;
const escopo = [];
let raiz = process.cwd();
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--max") MAX = Number(args[++i]) || 3;
  else if (args[i] === "--escopo") { while (args[i + 1] && !args[i + 1].startsWith("--")) escopo.push(args[++i]); }
  else if (!args[i].startsWith("--")) raiz = path.resolve(args[i]);
}

const IGNORAR = new Set(["node_modules", ".git", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit", ".turbo", ".cache", "coverage", "vendor", "__pycache__", ".venv", "venv", "target", ".idea", ".vscode"]);
const EXT = new Set([".tsx", ".jsx", ".ts", ".js", ".mjs", ".vue", ".svelte", ".astro", ".html", ".htm", ".css", ".scss", ".sass", ".less", ".mdx", ".json"]);
const LOCKS = /(?:package-lock|npm-shrinkwrap|composer\.lock|tsconfig[^/]*|\.eslintrc[^/]*)\.json$|(?:^|\/)(?:yarn|pnpm-lock)/;
const NEUTRAS = "slate|gray|zinc|neutral|stone";
const CORES = "red|amber|yellow|orange|emerald|green|blue|sky|purple|indigo|violet|rose|teal|slate|gray|zinc|neutral|stone|cyan|pink|lime|fuchsia";

function arquivos(inicio, acc) {
  let st;
  try { st = fs.statSync(inicio); } catch { return acc; }
  if (st.isFile()) { if (EXT.has(path.extname(inicio)) && st.size < 1_000_000 && !/\.min\./.test(inicio) && !LOCKS.test(inicio)) acc.push(inicio); return acc; }
  for (const e of fs.readdirSync(inicio, { withFileTypes: true })) {
    if (e.name.startsWith(".") && e.name !== ".") { if (IGNORAR.has(e.name) || e.isDirectory()) continue; }
    if (e.isDirectory()) {
      if (IGNORAR.has(e.name)) continue;
      const rel = path.relative(raiz, path.join(inicio, e.name)).split(path.sep).join("/");
      if (/^(docs\/limpeza-visual|scripts\/limpeza-visual)/.test(rel)) continue;
      if (SEM_UI && /(^|\/)components\/ui$/.test(rel)) continue;
      arquivos(path.join(inicio, e.name), acc);
    } else arquivos(path.join(inicio, e.name), acc);
  }
  return acc;
}

// ---------- o placar: mesmos nove números do método ----------
const PLACAR = {
  border: [/border-/g, /(?:^|[;{\s])border(?:-(?:top|right|bottom|left|width))?\s*:\s*(?!none|0\b|0;)[^;}]+/g],
  shadow: [/shadow-/g, /box-shadow\s*:\s*(?!none)[^;}]+/g, /drop-shadow\(/g],
  ring: [/ring-/g],
  rounded_xl: [/rounded-(?:xl|2xl|3xl)/g],
  gradient: [/bg-gradient|from-|via-|to-[a-z]/g, /(?:linear|radial|conic)-gradient\(/g],
  cor_direta: [new RegExp(`(?:text|bg|border|ring|fill|stroke)-(?:${CORES})-[0-9]+`, "g")],
  hex: [/(?<![\w&\/-])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b(?![-\w])/g],
  dark: [/\bdark:/g],
  var_token: [/var\(--/g],
};
const RAIO_CSS = /border-radius\s*:\s*([\d.]+)(px|rem)/g;

// ---------- sinais qualitativos ----------
const SINAIS = {
  icone_em_caixa: { nome: "Ícone dentro de caixa colorida", dica: "Caixa arredondada com fundo de cor e um ícone dentro. Vício clássico. Trocar por ícone monocromático solto, sem caixa, ou por texto." },
  card_aninhado: { nome: "Card dentro de card", dica: "Superfície com borda ou sombra dentro de outra. Remover o card interno e separar por espaço ou divisor fino." },
  card: { nome: "Possível card", dica: "Caixa com borda ou sombra, cantos arredondados e fundo. Em conteúdo (lista, feed) costuma ser desnecessário: deixar o item direto no fundo. Conferir o arquétipo do DESIGN.md." },
  selo: { nome: "Selo ou pílula colorida", dica: "Texto pequeno em pílula colorida (Novo, Pro, Beta, contador). Manter só se for status real; senão virar texto simples." },
  rotulo_caps: { nome: "Rótulo pequeno em caixa alta espaçada", dica: "Texto uppercase com tracking largo acima de títulos. Padrão decorativo de IA. Usar texto normal com peso." },
  emoji: { nome: "Emoji como ícone ou enfeite", dica: "Emoji na interface (foguete, brilho, lâmpada). Trocar por ícone monocromático ou remover." },
  texto_gradiente: { nome: "Texto com gradiente", dica: "Título com bg-clip-text. Trocar por cor sólida do token de texto." },
  vidro: { nome: "Efeito de vidro (blur)", dica: "backdrop-blur e translúcidos. Usar superfície sólida do token." },
  hover_levita: { nome: "Hover que levanta ou cresce o elemento", dica: "translate-y, scale e sombra no hover. Trocar por mudança sutil de fundo." },
  brilho_colorido: { nome: "Sombra colorida ou brilho (glow)", dica: "Sombra com cor ou box-shadow 0 0 Npx. Remover." },
  animacao_decorativa: { nome: "Animação decorativa", dica: "pulse, bounce e ping sem função. Remover, exceto indicador real de carregamento." },
  estilo_inline_cor: { nome: "Cor em estilo inline", dica: "style com color, background ou sombra. Mover para token." },
  fonte_generica: { nome: "Fonte padrão genérica", dica: "Inter, Roboto, Poppins, Open Sans, Montserrat ou fonte do sistema como única escolha. Definir a fonte no DESIGN.md (Fase 1b) e conferir se combina com a referência." },
  jargao_ia: { nome: "Texto com cara de IA (jargão de marketing)", dica: "Frases como Potencialize, Revolucione, Descubra, Eleve ao próximo nível, solução completa. Reescrever de forma direta e específica." },
  pontuacao_ia: { nome: "Travessão, aspas curvas ou barra vertical", dica: "Travessão (— –), aspas curvas e ' | ' separando texto. Trocar por ponto, vírgula, dois-pontos ou estrutura, e aspas retas." },
};

const RE_EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{2B06}\u{2705}\u{274C}\u{2728}]/u;
const RE_ICONE = /<svg\b|<[A-Z][A-Za-z0-9]*\s+[^>]*\b(?:size=|className="[^"]*\b(?:h|w|size)-\d)|\bfa[srb]?\s+fa-|material-icons|<i\s+class="[^"]*(?:icon|fa|bi)\b|<ion-icon|<Icon\b|<[A-Z][A-Za-z0-9]*Icon\b|lucide/;
const RE_JARGAO = /\b(potencialize\w*|revolucion\w+|transforme\w*|descubra|desbloqueie|eleve (?:o|a|seu|sua)\w*|turbine\w*|de ponta|next[- ]gen\w*|cutting[- ]edge|seamless\w*|unleash\w*|supercharge\w*|elevate\w*|empower\w*|game[- ]changer|solução completa|experiência (?:incrível|única|premium|perfeita)|tudo (?:o )?que você precisa|próximo nível|next level|sem complicações)\b/i;
const FONTES_GENERICAS = /^(?:inter|roboto|poppins|open sans|montserrat|lato|nunito|nunito sans|system-ui|-apple-system|blinkmacsystemfont|segoe ui|helvetica(?: neue)?|arial|sans-serif|ui-sans-serif)$/i;


// ---------- emoji: o que é, e por qual ícone trocar (nomes da biblioteca lucide; as outras têm equivalentes) ----------
const ICONE_DE = {
  "🚀": "Rocket", "✨": "Sparkles", "🔥": "Flame", "💡": "Lightbulb", "⚡": "Zap", "🎯": "Target", "📊": "BarChart3", "📈": "TrendingUp", "📉": "TrendingDown",
  "✅": "Check", "✔": "Check", "☑": "CheckSquare", "❌": "X", "✖": "X", "⚠": "TriangleAlert", "🔒": "Lock", "🔓": "LockOpen", "🔔": "Bell", "⭐": "Star", "🌟": "Star",
  "❤": "Heart", "💙": "Heart", "👍": "ThumbsUp", "👎": "ThumbsDown", "🎉": "PartyPopper", "💰": "Wallet", "💵": "Banknote", "💳": "CreditCard", "📧": "Mail", "✉": "Mail",
  "📱": "Smartphone", "💻": "Laptop", "🖥": "Monitor", "🌐": "Globe", "🌍": "Globe", "🔍": "Search", "⚙": "Settings", "🛠": "Wrench", "🔧": "Wrench", "👤": "User", "👥": "Users",
  "🏠": "Home", "📁": "Folder", "📂": "FolderOpen", "📄": "FileText", "📝": "SquarePen", "✏": "Pencil", "📅": "Calendar", "🗓": "Calendar", "⏰": "Clock", "🕒": "Clock", "⏳": "Hourglass",
  "📍": "MapPin", "🚚": "Truck", "🛒": "ShoppingCart", "🎁": "Gift", "🏆": "Trophy", "🧠": "Brain", "🤖": "Bot", "💬": "MessageSquare", "📞": "Phone", "📷": "Camera", "🎵": "Music",
  "🔗": "Link", "🗑": "Trash2", "➕": "Plus", "➖": "Minus", "📌": "Pin", "📦": "Package", "🌱": "Sprout", "🛡": "Shield", "🔑": "Key", "💎": "Gem", "📢": "Megaphone", "🏷": "Tag",
  "🧾": "Receipt", "🗂": "Folders", "📋": "ClipboardList", "🔄": "RefreshCw", "⬆": "ArrowUp", "⬇": "ArrowDown", "➡": "ArrowRight", "⬅": "ArrowLeft", "👀": "Eye", "🎨": "Palette",
  "🏢": "Building2", "🏥": "Hospital", "🍽": "UtensilsCrossed", "🚗": "Car", "✈": "Plane", "📚": "BookOpen", "🎓": "GraduationCap", "💼": "Briefcase", "📣": "Megaphone", "🔐": "LockKeyhole",
};
const SEM_ICONE = new Set(["👋", "😀", "😊", "🙂", "😍", "🤩", "🥳", "😎", "🙌", "👏", "🤝", "💪", "🎊"]);
const BIBLIOTECAS = [["lucide-react", "lucide-react"], ["lucide-vue-next", "lucide-vue-next"], ["lucide-svelte", "lucide-svelte"], ["@heroicons/react", "heroicons"], ["@tabler/icons-react", "tabler"], ["@phosphor-icons/react", "phosphor"], ["react-icons", "react-icons"], ["@radix-ui/react-icons", "radix-icons"], ["@mui/icons-material", "mui-icons"], ["@fortawesome/react-fontawesome", "fontawesome"], ["bootstrap-icons", "bootstrap-icons"]];
const RE_EMOJI_G = /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/gu;
function ehEmojiDeVerdade(e) {
  const cp = e.codePointAt(0);
  return cp >= 0x1f000 || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x2b00 && cp <= 0x2bff) || cp === 0x231a || cp === 0x231b || (cp >= 0x23e9 && cp <= 0x23fa);
}
const base = (e) => e.replace(/\uFE0F/g, "");
function bibliotecaDeIcones() {
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(raiz, "package.json"), "utf8"));
    const dep = { ...pj.dependencies, ...pj.devDependencies };
    return BIBLIOTECAS.filter(([pkg]) => dep[pkg]).map(([, nome]) => nome);
  } catch { return null; }
}
function classificarEmoji(l, e) {
  const i = l.indexOf(e);
  if (new RegExp(`\\b(?:icon|icone|emoji|avatar|symbol|logo|image)\\w*["']?\\s*[:=]\\s*["'\`]\\s*${e}`).test(l)) return "dado_de_icone";
  if (/^\s*[>"'`]?\s*$/.test(l.slice(0, i)) || /[>"'`]\s*$/.test(l.slice(0, i))) return "inicio_de_texto";
  return "enfeite";
}

const ind = (l) => l.length - l.trimStart().length;
const ehComentario = (l) => /^\s*(?:\/\/|\*|\/\*|<!--|#)/.test(l);

function analisar(arq) {
  const rel = path.relative(raiz, arq).split(path.sep).join("/");
  const linhas = fs.readFileSync(arq, "utf8").split(/\r?\n/);
  const placar = Object.fromEntries(Object.keys(PLACAR).map((k) => [k, 0]));
  const sinais = [];
  const add = (cat, i, trecho) => sinais.push({ categoria: cat, arquivo: rel, linha: i + 1, trecho: trecho.trim().replace(/\s+/g, " ").slice(0, 140) });
  const cards = [];
  const emojis = [];
  const ehMarkup = /\.(tsx|jsx|vue|svelte|astro|html|htm|mdx)$/.test(arq);
  const ehEstilo = /\.(css|scss|sass|less)$/.test(arq);
  const ehTpl = ehMarkup || /\.(ts|js|mjs)$/.test(arq);

  linhas.forEach((l, i) => {
    if (ehComentario(l)) return;
    if (/\.json$/.test(arq)) { /* json só entra na busca de emoji */ } else for (const [k, res] of Object.entries(PLACAR)) {
      if (k === "hex" && /href=["']#/.test(l)) continue;
      for (const re of res) { re.lastIndex = 0; const m = l.match(re); if (m) placar[k] += m.length; }
    }
    RAIO_CSS.lastIndex = 0;
    for (const m of l.matchAll(RAIO_CSS)) { const px = m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]); if (px >= 12 && px < 9999) placar.rounded_xl++; }

    const tw = /(?:class|className|@apply|tw`|cn\(|clsx\(|cva\()/.test(l) || /["'`][^"'`]*\b(?:rounded|bg|border|shadow|p|px)-/.test(l);
    const cardLike = tw && /\brounded(?:-(?:md|lg|xl|2xl|3xl))?\b/.test(l) && /\b(?:border(?!-0)|shadow)\b|\bborder-|\bshadow-/.test(l) && /\bbg-|\bp-\d|\bpx-\d/.test(l);
    if (cardLike) { cards.push({ i, ind: ind(l) }); add("card", i, l); }
    if (tw && new RegExp(`\\bbg-(?:(?!${NEUTRAS})[a-z]+)-(?:50|100|200|300|500|600)\\b|\\bbg-(?:primary|accent|secondary)\\/\\d+`).test(l) && /\brounded/.test(l) && /\b(?:p-\d|size-\d|w-\d+\s+h-\d+|h-\d+\s+w-\d+)/.test(l)) {
      const janela = linhas.slice(i, i + 4).join(" ");
      if (RE_ICONE.test(janela)) add("icone_em_caixa", i, l);
    }
    if (tw && /\brounded-full\b/.test(l) && /\bpx-\d/.test(l) && /\btext-(?:xs|\[1\d(?:px)?\])/.test(l) && /\bbg-/.test(l)) add("selo", i, l);
    if (tw && /\buppercase\b/.test(l) && /\btracking-(?:wide|wider|widest)\b/.test(l)) add("rotulo_caps", i, l);
    if ((ehTpl || /\.json$/.test(arq)) && !/console\./.test(l)) {
      for (const m of l.matchAll(RE_EMOJI_G)) {
        if (!ehEmojiDeVerdade(m[0])) continue;
        const b = base(m[0]);
        emojis.push({ arquivo: rel, linha: i + 1, emoji: b, tipo: classificarEmoji(l, m[0]), icone: ICONE_DE[b] || null, sem_icone: SEM_ICONE.has(b) });
        if (!sinais.some((x) => x.categoria === "emoji" && x.linha === i + 1 && x.arquivo === rel)) add("emoji", i, l);
      }
    }
    if (/bg-clip-text|text-transparent|-webkit-background-clip\s*:\s*text/.test(l)) add("texto_gradiente", i, l);
    if (/backdrop-blur|backdrop-filter\s*:\s*blur/.test(l)) add("vidro", i, l);
    if (/hover:-?translate-y|hover:scale-|:hover\s*\{[^}]*translateY\(-/.test(l) || (ehEstilo && /transform\s*:\s*translateY\(-/.test(l))) add("hover_levita", i, l);
    if (new RegExp(`shadow-(?:${CORES})-\\d+`).test(l) || /box-shadow\s*:[^;]*\b0\s+0\s+\d+px/.test(l)) add("brilho_colorido", i, l);
    if (/animate-(?:pulse|bounce|ping)\b|animation\s*:[^;]*\b(?:pulse|bounce|float|glow)\b/.test(l)) add("animacao_decorativa", i, l);
    if (/style=\{\{[^}]*(?:color|background|border|[sS]hadow)|style="[^"]*(?:color|background|box-shadow)/.test(l)) add("estilo_inline_cor", i, l);
    const fam = l.match(/font-family\s*:\s*([^;}{]+)|fontFamily\s*:\s*\[?\s*["']([^"']+)["']|\bfont-\[['"]?([A-Za-z ]+)/);
    if (fam) {
      const primeira = (fam[1] || fam[2] || fam[3] || "").split(",")[0].replace(/["']/g, "").trim();
      if (primeira && FONTES_GENERICAS.test(primeira)) add("fonte_generica", i, l);
    }
    if (/next\/font\/google|fonts\.googleapis\.com\/css/.test(l) && /Inter|Roboto|Poppins|Open\+Sans|Montserrat/.test(l)) add("fonte_generica", i, l);
    if (ehTpl && /["'`>]/.test(l) && RE_JARGAO.test(l)) add("jargao_ia", i, l);
    if (ehMarkup && (/[—–]/.test(l) || /[“”‘’]/.test(l) || />[^<>{}]*\s\|\s[^<>{}]*</.test(l) || /\btitle\s*[:=]\s*["'][^"']*\s\|\s/.test(l))) add("pontuacao_ia", i, l);
  });

  // card dentro de card: um card mais fundo, sem fechamento da tag do card anterior entre os dois
  for (const c of cards) {
    for (let j = cards.indexOf(c) - 1; j >= 0 && c.i - cards[j].i <= 80; j--) {
      const m = cards[j];
      if (m.ind >= c.ind) continue;
      let fechou = false;
      for (let k = m.i + 1; k < c.i; k++) { const t = linhas[k]; if (ind(t) <= m.ind && /^\s*(?:<\/|\)\}|\/>|\}\))/.test(t)) { fechou = true; break; } }
      if (!fechou) { add("card_aninhado", c.i, linhas[c.i]); break; }
    }
  }
  return { rel, placar, sinais, emojis, linhas: linhas.length };
}

// ---------- execução ----------
const alvos = (escopo.length ? escopo.map((e) => path.resolve(raiz, e)) : [raiz]).flatMap((a) => arquivos(a, []));
const resultados = alvos.map(analisar);
const total = Object.fromEntries(Object.keys(PLACAR).map((k) => [k, resultados.reduce((s, r) => s + r.placar[k], 0)]));
const sinais = resultados.flatMap((r) => r.sinais);
const todosEmojis = resultados.flatMap((r) => r.emojis);
const bibIcones = bibliotecaDeIcones();
const porCat = {};
for (const s of sinais) (porCat[s.categoria] ||= []).push(s);
const vicioArq = (r) => r.placar.border + r.placar.shadow + r.placar.ring + r.placar.rounded_xl + r.placar.gradient + r.placar.cor_direta + r.placar.hex + r.sinais.length;
const topo = resultados.map((r) => ({ arquivo: r.rel, pontos: vicioArq(r) })).filter((x) => x.pontos > 0).sort((a, b) => b.pontos - a.pontos);
const pasta = {};
for (const r of resultados) { const p = r.rel.split("/").slice(0, 2).join("/").replace(/\/[^/]*\.[a-z]+$/i, "") || "."; pasta[p] = (pasta[p] || 0) + vicioArq(r); }

if (JSON_OUT) {
  console.log(JSON.stringify({ raiz, arquivos_lidos: resultados.length, placar: total, biblioteca_de_icones: bibIcones, emojis: todosEmojis.slice(0, 2000), sinais_por_categoria: Object.fromEntries(Object.entries(porCat).map(([k, v]) => [k, v.length])), arquivos_mais_afetados: topo.slice(0, 20), por_pasta: pasta, itens: sinais.slice(0, 2000) }, null, 2));
  process.exit(0);
}

const out = [];
out.push(`DETECTOR DE VÍCIOS: ${resultados.length} arquivos lidos em ${raiz}${escopo.length ? ` (escopo: ${escopo.join(", ")})` : ""}`);
if (!resultados.length) { out.push("Nenhum arquivo de interface encontrado (tsx, jsx, vue, svelte, astro, html, css, scss, less). Confira a raiz e o escopo."); console.log(out.join("\n")); process.exit(2); }
out.push("", "PLACAR (entregue estes nove números a resumir_placar):", JSON.stringify(total));
const vic = total.border + total.shadow + total.ring + total.rounded_xl + total.gradient + total.cor_direta + total.hex;
out.push(`Total a limpar: ${vic}. Adoção de tokens: var(--) ${total.var_token} contra ${total.cor_direta} cores diretas e ${total.dark} usos de dark:.`);
out.push("", "SINAIS QUE A CONTAGEM NÃO MOSTRA (o que é, como corrigir, onde está):");
const ordem = Object.keys(SINAIS).filter((k) => porCat[k]);
if (!ordem.length) out.push("(nenhum sinal encontrado)");
for (const k of ordem) {
  const lista = porCat[k];
  const arqs = new Set(lista.map((s) => s.arquivo)).size;
  out.push("", `* ${SINAIS[k].nome}: ${lista.length} em ${arqs} arquivo(s)`, `  ${SINAIS[k].dica}`);
  for (const s of lista.slice(0, MAX)) out.push(`  ${s.arquivo}:${s.linha}: ${s.trecho}`);
  if (lista.length > MAX) out.push(`  ... e mais ${lista.length - MAX} (use --json para a lista completa)`);
}

out.push("", "EMOJIS NA INTERFACE (cada um precisa ser removido ou trocado por ícone):");
if (!todosEmojis.length) out.push("(nenhum emoji encontrado)");
else {
  out.push(bibIcones === null ? "Biblioteca de ícones: não foi possível ler o package.json na raiz." : bibIcones.length ? `Biblioteca de ícones do projeto: ${bibIcones.join(", ")}. Use ela; os nomes abaixo são da lucide, procure o equivalente.` : "Biblioteca de ícones: nenhuma encontrada no package.json. Adicionar dependência exige aprovação do usuário: pergunte se pode instalar lucide-react (ou use SVG inline).");
  out.push("Como decidir: dado_de_icone = campo que guarda o emoji (trocar por componente ou nome de ícone e ajustar quem lê o campo); inicio_de_texto = emoji colado no começo de um texto (remover do texto e, se for ação, navegação ou status, colocar ícone monocromático ao lado); enfeite = decoração (remover). Ícone sempre monocromático (currentColor), sem caixa colorida. Emoji de rosto ou saudação não tem ícone: remover.");
  const por = {};
  for (const e of todosEmojis) (por[e.emoji] ||= []).push(e);
  for (const [em, lista] of Object.entries(por).sort((a, b) => b[1].length - a[1].length)) {
    const ex = lista[0];
    const acao = ex.sem_icone ? "remover" : !ex.icone ? "escolher um ícone que represente a ação, ou remover" : lista.every((x) => x.tipo === "enfeite") ? `remover (se marcar ação, navegação ou status, trocar por ${ex.icone})` : `trocar por ${ex.icone}`;
    out.push(`  ${em}  ${lista.length}x  ${acao}  (${lista.slice(0, 3).map((x) => `${x.arquivo}:${x.linha} ${x.tipo}`).join("; ")}${lista.length > 3 ? "; ..." : ""})`);
  }
}
out.push("", "ARQUIVOS MAIS AFETADOS:");
for (const t of topo.slice(0, 10)) out.push(`  ${String(t.pontos).padStart(5)}  ${t.arquivo}`);
out.push("", "POR PASTA:");
for (const [p, n] of Object.entries(pasta).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 12)) out.push(`  ${String(n).padStart(5)}  ${p}`);
out.push("", "LIMITES: o detector lê o texto do código, não a tela. Ele não vê cor dentro de imagem, ícone decorativo sem nome de ícone, estado repetido na tela nem hierarquia ruim. Isso se confere olhando as capturas.");
console.log(out.join("\n"));
