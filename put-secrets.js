//!/usr/bin/env node
// Helper para enviar secrets no Worker Cloudflare de forma não interativa.
// Uso: node put-secrets.js <nome-do-worker>
const { execSync } = require("child_process");
const os = require("os");
const path = require("path");

const worker = process.argv[2] || "play-tv-proxy";

// Os segredos podem ser definidos via env ou hardcoded localmente para uso
// apenas em ambiente de desenvolvimento; NUNCA commitear valores reais.
const secrets = {
  ADMIN_SECRET: process.env.ADMIN_SECRET || "46ce1bae0b9394c3d4369d816c2901ec65f89c470051b17fbaa28c637cf68c25",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "46ce1bae0b9394c3d4369d816c2901ec65f89c470051b17fbaa28c637cf68c25",
  HMAC_SECRET: process.env.HMAC_SECRET || "46ce1bae0b9394c3d4369d816c2901ec65f89c470051b17fbaa28c637cf68c25",
  VALID_PASS: process.env.VALID_PASS || "46ce1bae0b9394c3d4369d816c2901ec65f89c470051b17fbaa28c637cf68c25",
};

// O `wrangler secret put` lê o valor da stdin quando não interativo.
// Usamos stdin pipe com -o text para forçar saída simples.
for (const [key, value] of Object.entries(secrets)) {
  const input = Buffer.from(value + "\n");
  try {
    execSync(`npx wrangler secret put ${key} -n ${worker}`, {
      input,
      stdio: ["pipe", "inherit", "inherit"],
      env: { ...process.env, CI: "true", NONINTERACTIVE: "1" },
    });
    console.log(`[OK] ${key} enviado`);
  } catch (e) {
    console.error(`[FAIL] ${key}: ${e.message}`);
    process.exit(1);
  }
}

console.log("\nTodos os segredos configurados no Worker Cloudflare.");
console.log("Lembrete: nunca comite esses valores no repositório.");
