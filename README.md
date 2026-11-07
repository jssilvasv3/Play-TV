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

## Verificação de Qualidade Visual

```bash
node scripts/limpeza-visual/detectar-vicios.cjs .
```
