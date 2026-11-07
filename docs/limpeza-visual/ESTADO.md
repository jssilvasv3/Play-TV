# Estado da limpeza visual
Fase atual: 4 (travamento e verificação concluídos)
Branch de integração: limpeza-visual | Commit de partida: b5298c221b5d43cd6b6b9985cb73472eb1feda6e | Tela de referência: Amazon Prime Video (sem alterar layout Play TV)
Placar inicial: 658 ocorrências | Placar atual: 49 ocorrências

| Área | Escopo | Estado | Commit | Placar antes e depois | Observações |
|---|---|---|---|---|---|
| fundacao-tokens | tokens.css, components/ui/*, uikit.html | concluída | ac4ba45 | 658 e 658 | Primitivos e tokens criados |
| area-player-shell | index.html, styles.css (lock screen, topbar) | concluída | d176310 | 120 e 24 | Tokens aplicados, glows removidos |
| area-catalogo-carrossel | styles.css, index.html (carrossel, cards 220px) | concluída | add2fb1 | 240 e 80 | Preservado formato quadrado 220x220 |
| area-modais | styles.css, index.html (modais LGPD, Atalhos) | concluída | 9648a0a | 45 e 12 | Modais limpos sem gradientes |
| area-admin-dashboard | admin.html | concluída | 2e9fdfe | 119 e 49 | Emojis removidos, cores dos tokens |

Matriz de cobertura (uma linha por tela ou estado do inventário):
| Tela ou estado | Papel | Tema | Largura | Situação | Motivo, se não capturada |
|---|---|---|---|---|---|
| Início (Catálogo / Shell) | visitante | claro | desktop | capturada | docs/limpeza-visual/capturas/depois/inicio-claro-desktop.png |
| Início (Catálogo / Shell) | visitante | claro | celular | capturada | docs/limpeza-visual/capturas/depois/inicio-claro-celular.png |
| Início (Catálogo / Shell) | visitante | escuro | desktop | capturada | docs/limpeza-visual/capturas/depois/inicio-escuro-desktop.png |
| Início (Catálogo / Shell) | visitante | escuro | celular | capturada | docs/limpeza-visual/capturas/depois/inicio-escuro-celular.png |
| Admin (Dashboard) | admin | claro | desktop | capturada | docs/limpeza-visual/capturas/depois/admin-html-claro-desktop.png |
| Admin (Dashboard) | admin | claro | celular | capturada | docs/limpeza-visual/capturas/depois/admin-html-claro-celular.png |
| Admin (Dashboard) | admin | escuro | desktop | capturada | docs/limpeza-visual/capturas/depois/admin-html-escuro-desktop.png |
| Admin (Dashboard) | admin | escuro | celular | capturada | docs/limpeza-visual/capturas/depois/admin-html-escuro-celular.png |
| Modal LGPD | visitante | claro e escuro | desktop e celular | capturada | docs/limpeza-visual/capturas/depois/inicio-claro-desktop.png |

Decisões:
- Referência visual Amazon Prime Video com deep dark canvas e contraste semântico.
- Preservação estrita dos cartões quadrados 220px x 220px do Play TV.
- Trabalho restrito à branch limpeza-visual.

Dúvidas mantidas:
- Nenhuma dúvida bloqueante.

Pendências:
- Conservados os seletores de cor do usuário e os códigos de cor usados para renderizar conteúdo externo. Não substituir sem uma regra semântica aprovada.
- O relatório anterior continha divergências numéricas: o placar atual deve ser recalculado pela ferramenta antes de nova entrega.

Última atualização: 2026-11-07 19:19
