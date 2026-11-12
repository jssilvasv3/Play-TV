const fs = require('node:fs');
const path = require('node:path');

const roots = process.argv.slice(2);
const files = [];

function walk(entry) {
  const stat = fs.statSync(entry);
  if (stat.isDirectory()) {
    for (const name of fs.readdirSync(entry)) walk(path.join(entry, name));
  } else if (/\.(html|css|js)$/i.test(entry)) {
    files.push(entry);
  }
}

for (const root of roots) {
  if (fs.existsSync(root)) walk(root);
}

const patterns = [
  ['hex solto', /#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi],
  ['gradiente', /(?:linear|radial)-gradient|bg-gradient|(?:^|\s)(?:from|via|to)-[a-z]/gi],
  ['sombra CSS', /box-shadow\s*:|(?:^|\s)shadow-(?:sm|md|lg|xl|2xl)\b/gi],
  ['raio excessivo', /rounded-(?:xl|2xl|3xl)\b/gi],
  ['dark: direto', /\bdark:/gi],
  ['cor CSS direta', /(?:^|[^-])(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*(?:#[0-9a-f]{3,8}|rgba?\(|hsla?\()/gi],
];

let total = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const [name, pattern] of patterns) {
    const matches = text.match(pattern) || [];
    if (matches.length) {
      console.log(`${file}: ${matches.length} ${name}`);
      total += matches.length;
    }
  }
}

console.log(`Placar de vicios: ${total}`);
