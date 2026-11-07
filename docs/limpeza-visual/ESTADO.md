# Estado da limpeza visual
Fase atual: 1
Branch de integração: limpeza-visual | Commit de partida: b5298c221b5d43cd6b6b9985cb73472eb1feda6e | Tela de referência: Amazon Prime Video (sem alterar layout Play TV)
Placar inicial: 658 ocorrências | Placar atual: 658 ocorrências

| Área | Escopo | Estado | Commit | Placar antes e depois | Observações |
|---|---|---|---|---|---|
| fundacao-tokens | tokens.css, components/ui/*, uikit.html | concluída | pendente | 658 e 658 | Primitivos e tokens criados sem alterar telas existentes |
| area-player-shell | index.html (player, lock, header, footer) | pendente | - | - | - |
| area-catalogo-carrossel | styles.css, index.html (carrossel, cards 220px) | pendente | - | - | Preservar formato quadrado 220x220 |
| area-modais | modais LGPD, Atalhos, Todos os Canais | pendente | - | - | - |
| area-admin-dashboard | admin.html | pendente | - | - | - |

Matriz de cobertura (uma linha por tela ou estado do inventário):
| Tela ou estado | Papel | Tema | Largura | Situação | Motivo, se não capturada |
|---|---|---|---|---|---|
| Início (Catálogo / Shell) | visitante | claro | desktop | capturada | docs/limpeza-visual/capturas/antes/inicio-claro-desktop.png |
| Início (Catálogo / Shell) | visitante | claro | celular | capturada | docs/limpeza-visual/capturas/antes/inicio-claro-celular.png |
| Início (Catálogo / Shell) | visitante | escuro | desktop | capturada | docs/limpeza-visual/capturas/antes/inicio-escuro-desktop.png |
| Início (Catálogo / Shell) | visitante | escuro | celular | capturada | docs/limpeza-visual/capturas/antes/inicio-escuro-celular.png |
| Admin (Dashboard) | admin | claro | desktop | capturada | docs/limpeza-visual/capturas/antes/admin-html-claro-desktop.png |
| Admin (Dashboard) | admin | claro | celular | capturada | docs/limpeza-visual/capturas/antes/admin-html-claro-celular.png |
| Admin (Dashboard) | admin | escuro | desktop | capturada | docs/limpeza-visual/capturas/antes/admin-html-escuro-desktop.png |
| Admin (Dashboard) | admin | escuro | celular | capturada | docs/limpeza-visual/capturas/antes/admin-html-escuro-celular.png |
| Modal LGPD | visitante | claro e escuro | desktop e celular | capturada | Capturado junto ao início |

Decisões:
- Referência visual Amazon Prime Video com deep dark canvas e contraste semântico.
- Preservação estrita dos cartões quadrados 220px x 220px do Play TV.
- Trabalho restrito à branch limpeza-visual.

Dúvidas mantidas:
- Nenhuma dúvida bloqueante nesta fase.

Pendências:
- Executar a fase piloto (Fase P) em index.html.

Última atualização: 2026-11-06 22:38
