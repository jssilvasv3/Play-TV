# Play TV

Web app de canais de TV ao vivo gratuitos e abertos, otimizado para navegadores desktop, mobile e Smart TV.

## Documentação do Projeto

- [PRODUCT.md](PRODUCT.md): Visão do produto, público-alvo, diretrizes e proposta de valor.
- [SPEC.md](SPEC.md): Especificação funcional, arquitetura, rotas, inventário de telas e integração HLS.
- [DESIGN.md](DESIGN.md): Sistema de design, tokens semânticos, paleta cinemática inspirada no Amazon Prime Video e regras visuais.

## Como Executar

```bash
# Iniciar o servidor local unificado com proxy HLS
node server.js
```
Acesse em: `http://localhost:5500` ou no painel administrativo em `http://localhost:5500/admin.html`.

Quando houver pelo menos dois canais em “Visto recentemente”, o destaque alterna entre eles automaticamente a cada 20 segundos. As setas e o gesto de deslizar continuam disponíveis.

## Carregamento de imagens

Os logotipos M3U, thumbnails e bandeiras são carregados progressivamente conforme se aproximam da tela. O gerenciador deduplica URLs durante o carregamento, limita a concorrência e a reduz enquanto há previews de vídeo ativos. A cascata de imagens dos cartões tenta a thumbnail configurada, o logo M3U e, para IDs compatíveis, a thumbnail do YouTube.

O navegador mantém em `localStorage` um índice LRU limitado a 400 URLs, com sucesso e falhas temporárias; os arquivos de imagem continuam sujeitos ao cache HTTP normal do navegador. Falhas expiram em dois minutos e os registros de sucesso em 30 dias.

## Métricas do painel administrativo

O painel grava no Cloudflare D1 agregados horários de pico de aparelhos, sessões por canal e duração estimada de audiência (incrementos entre heartbeats limitados a 35 segundos). O histórico não armazena IPs, identificadores de aparelhos nem URLs de transmissão; os nomes de canais são sanitizados antes da gravação. Os dados mais antigos que sete dias são removidos quando há atividade e não aparecem nas consultas do painel. Use o seletor do gráfico para alternar entre as últimas 24 horas e os últimos 7 dias.

Para configurar um ambiente, aplique as migrations D1 antes de publicar:

```bash
npx wrangler d1 migrations apply play-tv-analytics --remote
```

## Verificação de Qualidade Visual

```bash
node scripts/limpeza-visual/detectar-vicios.cjs .
```
