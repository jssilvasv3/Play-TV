const { spawnSync } = require('node:child_process');

const result = spawnSync(process.execPath, [
  'scripts/limpeza-visual/detectar-vicios.cjs',
  'index.html',
  'admin.html',
  'app.js',
  'styles.css',
], { stdio: 'inherit' });

process.exit(result.status ?? 1);
