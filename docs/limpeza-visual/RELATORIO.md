# Relatório do piloto visual: Termos de Uso & Privacidade

Este relatório registra a execução limitada à área dos Termos de Uso e Privacidade.
O piloto foi aprovado e não houve migração das demais áreas do Play TV.

## Resultado

- Referência: Amazon Prime Video.
- Tema desta área: escuro.
- Destaque: azul monocromático.
- Texto jurídico, handlers e comportamento preservados.
- Texto do corpo aumentado de 12,5 px para 14 px.
- Overflow horizontal corrigido em 390 px: largura do documento passou de 396 px para 390 px.
- A primeira seção fica visível ao abrir o modal, sem rolagem inicial no corpo.
- Contraste medido do azul `#1399ff` sobre a superfície `#1a242f`: 5,26:1.
- `git diff --check` passou. `npm test` terminou com código 0; o contador geral do projeto reportou 124 ocorrências, sem comparação histórica do projeto inteiro.
- Não existe script de build configurado no `package.json`.

## Capturas

| Viewport | Antes | Depois |
|---|---|---|
| Desktop, 1280 px | [Antes](./capturas/piloto/termos/termos-desktop-antes.png) | [Depois](./capturas/piloto/termos/termos-desktop-depois.png) |
| Celular, 390 px | [Antes](./capturas/piloto/termos/termos-celular-antes.png) | [Depois](./capturas/piloto/termos/termos-celular-depois.png) |

## Dúvida mantida

Os Termos afirmam que a plataforma não coleta dados pessoais. No código, o heartbeat envia um ID de dispositivo, canal assistido e informações do cliente; a função de backend registra IP e dados de cidade/país para telemetria exibida no painel administrativo. A página também declara que cookies de anunciantes operam sob as regras dos terceiros. O texto foi mantido conforme o escopo visual; as afirmações precisam de revisão de produto/jurídico.

## Limites da verificação

As capturas foram abertas e inspecionadas em Chromium, em tema escuro e nos dois viewports listados. Outros navegadores, dispositivos físicos e estados além da abertura do modal não foram verificados.
