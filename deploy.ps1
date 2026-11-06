# Play TV - Script de Deploy para Cloudflare Workers

# 1. Deploy do Worker Cloudflare (proxy HLS)
# 2. Instruções para hospedar o frontend

$ErrorActionPreference = 'Stop'

function Test-Command($cmd) {
  return (Get-Command $cmd -ErrorAction SilentlyContinue) -ne $null
}

function DeployWorker() {
  Write-Host ''
  Write-Host '===== 1. Deploy do Worker Cloudflare =====' -ForegroundColor Cyan
  
  if (-not (Test-Command 'wrangler')) {
    Write-Host "[!] wrangler não encontrado." -ForegroundColor Yellow
    Write-Host "    Instala: npm install -g wrangler" -ForegroundColor White
    return
  }
  
  $cwd = Get-Location
  if ($cwd.Path -ne 'd:\play_tv') {
    Set-Location 'd:\play_tv'
    Write-Host "Diretório mudado para d:\play_tv" -ForegroundColor Yellow
  }
  
  Write-Host ''
  Write-Host 'Para fazer login no Cloudflare:' -ForegroundColor Yellow
  Write-Host '  npx wrangler login' -ForegroundColor White
  Write-Host ''
  Write-Host 'Para fazer deploy do Worker:' -ForegroundColor Yellow
  Write-Host '  npx wrangler deploy' -ForegroundColor White
  Write-Host ''
  
  $reply = Read-Host 'Pretende executar o deploy agora? (s/n)'
  if ($reply -eq 's' -or $reply -eq 'S') {
    Write-Host ''
    Write-Host 'A iniciar login...' -ForegroundColor Gray
    Start-Process 'npx' -ArgumentList 'wrangler', 'login' -Wait
    Write-Host ''
    Write-Host 'A fazer deploy do Worker...' -ForegroundColor Gray
    $proc = Start-Process 'npx' -ArgumentList 'wrangler', 'deploy' -NoNewWindow -Wait -PassThru
    if ($proc.ExitCode -eq 0) {
      Write-Host '[✓] Worker deployado com sucesso!' -ForegroundColor Green
    } else {
      Write-Host "[✗] Erro no deploy (código $($proc.ExitCode))" -ForegroundColor Red
    }
  } else {
    Write-Host 'Deploy cancelado.' -ForegroundColor Yellow
  }
}

function MostrarInstrucoes() {
  Write-Host ''
  Write-Host '===== 2. Como hospedar o Frontend =====' -ForegroundColor Cyan
  Write-Host ''
  Write-Host 'O frontend pode ser hospedado em:' -ForegroundColor White
  Write-Host ''
  Write-Host 'Opção A: Cloudflare Pages (grátis, recomendado)' -ForegroundColor Yellow
  Write-Host '  1. Cria um repositório GitHub com os ficheiros' -ForegroundColor White
  Write-Host '  2. No dashboard Cloudflare: Workers & Pages → Create → Pages' -ForegroundColor White
  Write-Host '  3. Conecta ao GitHub, seleciona o repositório' -ForegroundColor White
  Write-Host '  4. Build command: (vazio)' -ForegroundColor White
  Write-Host '  5. Output directory: / (raiz)' -ForegroundColor White
  Write-Host '  6. Deploy automático em cada push' -ForegroundColor White
  Write-Host ''
  Write-Host 'Opção B: GitHub Pages / Netlify / Vercel (também grátis)' -ForegroundColor Yellow
  Write-Host '  - Basta subir index.html, app.js, styles.css' -ForegroundColor White
  Write-Host ''
  Write-Host 'Opção C: Servidor local (dev)' -ForegroundColor Yellow
  Write-Host '  node server.js' -ForegroundColor White
  Write-Host '  → http://localhost:5500 (ou IP na rede local)' -ForegroundColor White
  Write-Host ''
  Write-Host 'Após hospedar o frontend:' -ForegroundColor Yellow
  Write-Host '  1. Copia a URL do Worker: npx wrangler deployments' -ForegroundColor White
  Write-Host '  2. No menu da app → Fontes → Servidor proxy HLS' -ForegroundColor White
  Write-Host '     coloca: https://seu-worker.workers.dev' -ForegroundColor White
  Write-Host '  3. Clica em Guardar' -ForegroundColor White
  Write-Host '  4. A app usa o proxy automaticamente' -ForegroundColor White
  Write-Host ''
}

function Resumo() {
  Write-Host ''
  Write-Host '===== Resumo da Configuração =====' -ForegroundColor Cyan
  Write-Host ''
  Write-Host 'Ficheiros:' -ForegroundColor Yellow
  Write-Host '  - src/index.js    → Worker Cloudflare (proxy HLS)' -ForegroundColor White
  Write-Host '  - app.js          → Detecção automática de proxy' -ForegroundColor White
  Write-Host '  - server.js       → Servidor local unificado (/proxy)' -ForegroundColor White
  Write-Host '  - wrangler.toml   → Configuração do Worker' -ForegroundColor White
  Write-Host ''
  Write-Host 'Endpoints do proxy:' -ForegroundColor Yellow
  Write-Host '  Quando hospedado:     https://{origin}/proxy?url=...' -ForegroundColor White
  Write-Host '  Quando local:        http://localhost:5500/proxy?url=...' -ForegroundColor White
  Write-Host '  Worker Cloudflare:   https://seu-worker.workers.dev/proxy?url=...' -ForegroundColor White
  Write-Host ''
  Write-Host 'Deteção automática no app.js:' -ForegroundColor Yellow
  Write-Host '  HTTP/HTTPS → usa location.origin + /proxy' -ForegroundColor White
  Write-Host '  file://    → usa localhost:5501 + /proxy' -ForegroundColor White
  Write-Host '  proxyBase  → usa o definido no menu' -ForegroundColor White
}

# Executar
Write-Host ''
Write-Host '╔═════════════════════════════════════════════════════════════╗' -ForegroundColor Cyan
Write-Host '║           Play TV — Script de Deploy                        ║' -ForegroundColor Cyan
Write-Host '╚═════════════════════════════════════════════════════════════╝' -ForegroundColor Cyan
Write-Host ''

DeployWorker
MostrarInstrucoes
Resumo
