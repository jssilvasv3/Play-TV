const fs = require('node:fs');
const cp = require('node:child_process');

const roots = ['index.html', 'admin.html', 'styles.css', 'components/ui', 'tokens.css', 'app.js'];
const forbidden = [
  ['gradiente CSS ou Tailwind', /(linear|radial)-gradient|(?:^|\s)(?:from|via|to)-/gi],
  ['sombra CSS ou Tailwind', /box-shadow:\s*(?:rgba?|#[0-9a-f]|-?[0-9.]+px)|(?:^|\s)shadow-(?:sm|md|lg|xl|2xl)/gi],
  ['raio Tailwind fora do sistema', /(?:^|\s)rounded-(?:xl|2xl|3xl)/gi],
];

let failures = 0;
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const stat = fs.statSync(root);
  const files = stat.isDirectory()
    ? fs.readdirSync(root).filter(name => /\.(css|html|js)$/.test(name)).map(name => `${root}/${name}`)
    : [root];
  for (const file of files) {
    if (/tokens\.css$|components\/ui\//.test(file) || /uikit\.html$/.test(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const [name, pattern] of forbidden) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        console.log(`FALHA: ${name} em ${file}`);
        failures++;
      }
    }
  }
}

try {
  cp.execFileSync('node', ['scripts/limpeza-visual/detectar-vicios.cjs', ...roots], { stdio: 'inherit' });
} catch {
  failures++;
}

if (failures) {
  console.log(`${failures} checagem(ns) com falha`);
  process.exit(1);
}
console.log('OK: nenhuma violação crítica');
