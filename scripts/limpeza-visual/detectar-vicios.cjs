const fs = require('node:fs');
const path = require('node:path');

const targets = process.argv.slice(2);
const files = [];

function collect(fileOrDir) {
  if (!fs.existsSync(fileOrDir)) return;
  const stat = fs.statSync(fileOrDir);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(fileOrDir)) collect(path.join(fileOrDir, entry));
  } else if (/\.(html|css|js)$/i.test(fileOrDir)) files.push(fileOrDir);
}

for (const target of targets.length ? targets : ['index.html', 'admin.html', 'styles.css', 'app.js', 'components']) {
  collect(target);
}

const allowed = [
  'tokens.css',
  `${path.sep}components${path.sep}ui${path.sep}`,
  `${path.sep}uikit.html`,
];

const patterns = [
  ['hex solto', /#[0-9a-f]{3,8}\b/gi],
  ['gradiente', /(linear|radial)-gradient|(?:^|\s)(?:from|via|to)-/gi],
  ['sombra', /box-shadow|(?:^|\s)shadow-/gi],
  ['raio grande', /(?:^|\s)rounded-(?:xl|2xl|3xl)/gi],
  ['cor direta do framework', /(?:text|bg|border|ring|fill|stroke)-(?:red|amber|yellow|orange|emerald|green|blue|sky|purple|indigo|violet|rose|teal|slate|gray|zinc|neutral|stone|cyan|pink|lime|fuchsia)-[0-9]+/gi],
];

const report = {};
for (const file of files) {
  const normalized = file.replaceAll('/', path.sep);
  if (allowed.some(item => normalized.endsWith(item))) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const [name, pattern] of patterns) {
    pattern.lastIndex = 0;
    const matches = [...text.matchAll(pattern)];
    if (matches.length) report[name] = (report[name] || 0) + matches.length;
  }
}

console.log('Placar de limpeza visual:');
for (const [name, count] of Object.entries(report).sort((a, b) => b[1] - a[1])) {
  console.log(`${count}\t${name}`);
}
if (!Object.keys(report).length) console.log('0\tviolações detectadas');
