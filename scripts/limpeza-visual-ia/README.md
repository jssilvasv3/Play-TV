# limpeza-visual-ia

Skill para remover o visual genérico de interface gerada por IA de um projeto web que já funciona: tudo em card, borda e sombra, ícones coloridos, cor em todo lugar, gradientes e badges promocionais. Também trata a fonte e o texto: jargão técnico, frases típicas de IA, travessão, barra vertical e aspas curvas.

Ela não redesenha o produto nem muda o comportamento. Define um sistema visual pequeno, com tokens e componentes, prova esse sistema em uma página-piloto que você aprova e, depois disso, aplica no restante do projeto sozinha. No fim, trava as regras no build e entrega tudo em um pull request para você revisar.

## Para quem é

- Quem tem uma plataforma pronta e sente que ela "parece feita por IA".
- Quem quer usar uma referência visual real (YouTube, Facebook, Linear, Notion...) como destino.
- Quem usa um agente de código e quer um método repetível em vez de pedir "melhore o design" e torcer.

## Como funciona, em resumo

Você participa em **dois momentos**. O resto roda sozinho.

1. **Início.** A skill faz todas as perguntas de uma vez: referência visual, temas, cor de destaque, quem escolhe a página-piloto, áreas fora do escopo e formato da entrega. Depois você aprova o DESIGN.md.
2. **Piloto.** A skill aplica o sistema em uma página e mostra a prévia (tema claro, tema escuro e celular, com antes e depois). Você aprova, pede ajustes em texto livre ou desfaz tudo.
3. **Execução automática.** Com o piloto aprovado, a skill migra o projeto área por área, corrige os textos e trava as regras no build, sem pedir confirmação a cada tela.
4. **Entrega.** Um pull request com relatório e capturas de todas as áreas. Nada é enviado à branch principal.

## Etapas

| Etapa | O que acontece | Quem decide |
|---|---|---|
| **A. Levantamento** | Perguntas iniciais. Detecta framework, versão do Tailwind e mecanismo de tema. | Você |
| **B. Documentos** | Garante PRODUCT.md, SPEC.md e DESIGN.md. Confere as promessas dos documentos contra o código. | **Você aprova o DESIGN.md** |
| **0. Auditoria** | Somente leitura. Conta os vícios, lista os arquivos mais afetados e mede o uso de tokens. Levanta fontes, vocabulário e o inventário de telas e estados. | Automático |
| **1. Fundação** | Tokens (claro e escuro), contraste calculado, componentes base e página UiKit. Nenhuma tela existente muda. | Automático |
| **1b. Estilos globais** | Fonte (vinda da referência), tema padrão, filtros e peso do texto, um por vez. | Automático |
| **P. Página-piloto** | Aplica o sistema em uma página e gera a prévia. | **Você aprova a prévia** |
| **2. Migração por área** | Uma área por vez, com verificação automática antes de seguir. | Automático |
| **3. Texto** | Vocabulário e tom, travessão, barra vertical, aspas curvas e acentuação, só em strings exibidas, sem tocar em lógica. | Automático |
| **4. Trava e entrega** | Script no build que falha se o vício voltar, limpeza dos documentos e pull request. | Você revisa o pull request |

## A página-piloto

Antes de aplicar o sistema no projeto todo, a skill prova em uma única página.

- **Escolha.** Você escolhe a página ou deixa a skill escolher. Se ela escolher, propõe 3 candidatas com o motivo de cada.
- **Desfazer garantido.** O piloto roda em uma branch própria, a partir de um commit de partida registrado.
- **Prévia.** Capturas nos dois temas e em largura de celular, com antes e depois lado a lado. Se o app não rodar no ambiente, a skill avisa e dá o comando para você abrir a página localmente.
- **Sua decisão:**
  - **Aprovar:** a página vira a tela de referência no DESIGN.md.
  - **Ajustar:** você descreve o que quer diferente. Se o pedido mexe em regra, token ou componente, a correção é feita no sistema e não só na página. Depois de 3 rodadas sem aprovação, a skill volta ao DESIGN.md para rever a referência.
  - **Desfazer:** a branch volta ao ponto de partida.

## Como ela trabalha sozinha

Sessões longas fazem o agente esquecer regras: o contexto enche e ele passa a imitar o que fez nas últimas telas. Por isso a skill não confia na memória do agente. Ela usa três mecanismos:

- **Verificador em script.** `scripts/limpeza-visual/verificar.sh` é criado antes de qualquer migração. Ele acusa cor direta, hex solto, gradiente, `dark:`, raios e sombras fora dos tokens, borda com sombra no mesmo elemento, cor em estilo inline, `rgb()` e `hsl()`, cor nomeada em SVG, classe de cor montada por código (`bg-${cor}-500`) e mudanças em handlers ou chamadas (`onClick`, `useEffect`, `fetch`, `navigate`). Varre também `index.html` e `public/`. Com a opção `--texto`, falha ainda com travessão, barra vertical separando texto e aspas curvas. A área só passa quando o script sai com código 0, e quem roda o script é o coordenador, não o agente que fez a área.
- **Um agente novo por área.** O agente principal só coordena. Cada área vai para um agente com contexto limpo e um briefing curto: escopo, regras do DESIGN.md, resumo das regras que mais escapam e o comando do verificador. Quando o ambiente não permite agentes separados, o mesmo agente segue, relê as regras a cada 3 áreas e grava o progresso.
- **Estado em arquivo.** `docs/limpeza-visual/ESTADO.md` guarda a fase atual, as áreas concluídas, as decisões e as pendências. Se a sessão cair ou o contexto for resumido, a skill retoma dali.

Para as áreas de maior alcance (layout global, home, listagens) e para o piloto, um revisor independente, também com contexto limpo, olha só o diff e aponta o que o script não pega, como card dentro de card e ícone decorativo.

O verificador não cobre regras de julgamento (hierarquia, estado repetido na tela), cores dentro de imagens, nem se uma fonte "parece de IA" ou se um texto soa genérico. Essas dependem do cartão de regras, do revisor, da sua aprovação e das capturas que você vê no pull request.

Depois do piloto, o que substitui a sua aprovação são **portas automáticas**. Uma área só é dada como concluída quando passam:

- o build;
- o placar de vícios, menor que o anterior;
- o verificador, sem violações no escopo (classes proibidas, hex, gradientes);
- o diff, sem mudança de lógica (onClick, useEffect, fetch, rotas);
- o cálculo de contraste;
- as capturas nos dois temas e em celular, sem rolagem horizontal;
- a matriz de cobertura da área, com situação em todas as linhas.

Se uma porta falhar, a skill corrige e tenta de novo, até 2 vezes. Se ainda falhar, reverte só aquela área, registra como pendência e segue para a próxima.

Dúvidas (algo que parece informação e pode ser decoração) são resolvidas mantendo o elemento e listando no relatório final. A skill só interrompe por bloqueio real, como o app não compilar antes de começar ou falta de acesso ao repositório. Você pode interromper a qualquer momento.

## O que a skill consegue ver

O agente só enxerga o que consegue abrir. Para a tela principal ser capturada e o modal, o menu ou a tela de administrador não ficarem de fora sem ninguém saber, a skill faz o seguinte:

- **Inventário.** Na auditoria, lista telas, modais, menus, estados (vazio, carregando, erro, texto longo, hover e foco) e papéis (visitante, usuário, administrador), a partir do mapa de telas do SPEC.md, das rotas e da pasta de componentes.
- **Matriz de cobertura.** Cada item vira uma linha em `ESTADO.md` com situação `capturada`, `não capturada` ou `impossível`, com o motivo. Nenhuma linha fica sem situação.
- **Roteiro de capturas.** Você não precisa escrever script de navegação. A skill descreve cada captura em `docs/limpeza-visual/roteiro.json` (abrir a página, clicar, digitar, esperar um elemento) e roda `scripts/limpeza-visual/capturar.cjs`, que gera as imagens nos dois temas e em desktop e celular. Quando os dados ficam no navegador, ela simula o papel gravando um estado de exemplo antes de abrir a tela. Cada ação espera no máximo 5 segundos, e uma falha é registrada sem travar as demais.
- **Honestidade no relatório.** O que não puder ser aberto (tela atrás de login ou de dados que não existem no ambiente) aparece no relatório como **não verificado**, com a indicação de onde você deve conferir à mão. Nunca é marcado como capturado.

Isso reduz os pontos cegos, mas não garante cobertura total. Uma tela que o roteiro não abre continua sem ser vista, e por isso a lista de não verificados é parte da entrega.

## Fontes e textos

Fonte e texto também denunciam interface de IA, e a skill trata os dois.

**Fontes.** A auditoria lista as famílias, os pesos, os rótulos em caixa alta com espaçamento largo e os textos de 10 a 11 px, e marca os sinais comuns: fonte de moda que a referência não usa, mais de duas famílias, negrito em quase tudo. A fonte é julgada contra a referência do DESIGN.md: se a referência usa Roboto, Roboto está certo. Na etapa de estilos globais ela vira token, com uma família, no máximo três pesos e escala fixa.

**Termos técnicos e frases de IA.** A skill levanta os textos exibidos e monta um glossário (termo atual, termo proposto, onde aparece), que você aprova junto com o DESIGN.md ou com a prévia do piloto. Termos que o próprio público usa ficam fora. Ela também reconhece 15 padrões de texto de IA em interface, como:

- "Mais que um app, uma experiência" e frases de efeito ("Simples assim.");
- aberturas como "Vamos mergulhar" e "Pronto para começar?";
- trios forçados ("rápido, seguro e intuitivo") e palavras como "poderoso", "robusto" e "inovador";
- mensagens genéricas ("Algo deu errado", "Ops!", "Bem-vindo de volta! 👋");
- travessão, barra vertical separando texto (`Início | Sobre`) e aspas curvas.

Regras que protegem o projeto:

- Nenhum fato, número, recurso ou promessa é inventado. Uma frase como "em conformidade com a LGPD" só fica se houver código por trás.
- O tom vem da seção Marca do PRODUCT.md e dos textos que você mesmo escreveu, que valem mais que a lista.
- O texto novo precisa caber onde o antigo cabia, conferido nas capturas de celular.
- Chaves, rotas, valores de comparação, citações e texto legal revisado por pessoa não são tocados.
- Se o próprio projeto usa travessão ou aspas curvas de forma consistente, a skill mantém.

A lista de padrões é adaptada, para o português e para texto de interface, da skill pública [humanizer](https://github.com/blader/humanizer) (licença MIT), que por sua vez se baseia na página "Signs of AI writing" da Wikipédia. A lista de palavras em português é um ponto de partida: serve de indício, e quem decide é o tom do PRODUCT.md e a sua aprovação.

## A entrega

Tudo vai para uma branch de integração, com um commit por área, e a skill abre um pull request (ou deixa a branch pronta, se você preferir). O relatório inclui:

- placar antes e depois, no total e por área;
- capturas antes e depois de cada área, nos dois temas (veja [Capturas e relatório](#capturas-e-relatório));
- dúvidas mantidas;
- pendências (áreas revertidas, variantes que faltaram);
- achados de segurança ou privacidade fora do escopo, reportados à parte;
- o que não foi verificado, incluindo telas e estados da matriz de cobertura sem captura, com o motivo;
- como desfazer tudo (reverter o pull request).

## Capturas e relatório

As capturas de tela ficam no repositório, junto do relatório, e **você decide se mantém ou exclui**.

```
docs/limpeza-visual/
├── RELATORIO.md      relatório consolidado, com as imagens linkadas
├── ESTADO.md         progresso e matriz de cobertura
├── roteiro.json      roteiro das capturas (telas, modais, papéis)
└── capturas/         ex.: feed-escuro-celular-depois.png
```

- Entram em commits próprios, separados dos de código, e nada fora dessa pasta aponta para ela. Apagar a pasta não quebra nada.
- As imagens são comprimidas e limitadas em quantidade, para não pesar no repositório.
- Antes de commitar, a skill confere se há dados pessoais reais na tela. Se houver, usa dados de exemplo ou desfoca.
- A skill não apaga nada sozinha. Para excluir depois da revisão:

  ```
  git rm -r docs/limpeza-visual && git commit -m "docs: remove capturas da limpeza visual"
  ```

  As imagens continuam no histórico do git. Reescrever o histórico só acontece se você pedir.
- Se o app não rodar no ambiente, não há capturas: a pasta leva só o relatório, com os comandos para você abrir as telas.

## Os três documentos

A skill só avança quando o projeto tem os três arquivos. Eles servem ao agente e a quem lê o repositório.

| Arquivo | Responde |
|---|---|
| [PRODUCT.md](PRODUCT.md) | Por que o produto existe e para quem |
| [SPEC.md](SPEC.md) | Como ele funciona: comandos, dados, telas, lacunas conhecidas |
| [DESIGN.md](DESIGN.md) | Como ele parece: referência, tokens, regras, componentes, acessibilidade |

Se algum faltar, a skill cria o arquivo só com o que dá para verificar no código ou o que você informar. O restante fica marcado como `A definir:`.

## Arquétipos de superfície

A referência escolhida define como as superfícies se comportam:

- **Conteúdo em primeiro lugar** (YouTube, Netflix): conteúdo direto no fundo, sem card.
- **Feed de cartões** (Facebook, LinkedIn): um cartão por unidade do feed, barras laterais sem cartão.
- **Produto denso** (Linear, Notion, Stripe docs): painéis planos separados por divisor de 1px.

Em todos: nunca card dentro de card, borda ou sombra (nunca as duas), ícones monocromáticos e cor só quando significa algo.

## Como usar

1. Instale a skill [instruções do seu ambiente].
2. Abra o projeto no seu agente e peça, por exemplo:

   > Use a skill limpeza-visual-ia neste projeto. A referência visual é o Facebook, com tema claro e escuro.

3. Responda às perguntas iniciais e aprove o DESIGN.md e a prévia do piloto.
4. Aguarde o pull request e revise as capturas.

## Princípios

- Descrever o destino, não só proibir.
- Atacar a causa (tokens e componentes), não tela por tela.
- Um passe, um escopo.
- Não mudar comportamento. Na dúvida, manter e listar.
- Calcular em vez de supor: contagens, contraste e promessas são conferidos por comando, com arquivo e linha.
- Dizer o que não foi verificado.
- Perguntar no início, executar até o fim.

## O que ela não faz

- Não troca a stack, não refatora lógica e não corrige bugs.
- Não adiciona dependências (Radix, CVA, clsx) sem aprovação.
- Não faz merge na branch principal.
- Não corrige problemas de segurança ou privacidade que encontrar. Reporta à parte.
- Não decide sozinha o que remover na dúvida: mantém e lista.
- Não garante ver todas as telas e estados: o que não consegue abrir fica listado como não verificado.
- Não julga fonte nem tom de texto por script: isso depende da referência, do glossário e da sua aprovação.

## Requisitos

- Projeto web com CSS utilitário (Tailwind v3 ou v4) ou CSS próprio.
- Git, para as branches de piloto e de integração.
- ripgrep (`rg`), bash e Python 3 para o verificador e os comandos de auditoria e contraste.
- Um navegador disponível ao agente para gerar as capturas. A skill usa o Playwright, instalado sem alterar o `package.json` (`npm i --no-save playwright` e `npx playwright install chromium`). Sem navegador, ou com o app sem rodar, tudo vira "impossível" na matriz e a revisão visual fica por sua conta.

## Problemas comuns

| Sintoma | Causa provável |
|---|---|
| Tema claro quebrado | Tokens incompletos, `text-white` fixo ou cores soltas em áreas como o admin |
| Texto quebrou depois da correção de acentos | A string era chave, rota ou comparação |
| Gráfico ilegível em um dos temas | A biblioteca recebe cor como string e não lê classes CSS |
| Todas as telas mudaram de uma vez | Um estilo global foi alterado na fundação |
| Uma área aparece como pendência | Uma porta automática falhou duas vezes e a área foi revertida |
| O verificador acusa um handler novo | Arquivo novo com `onClick` ou `fetch` não existia no commit de partida: justificar no relatório ou tirar do escopo |
| O verificador com `--texto` acusa um travessão em comentário | A checagem também olha comentários de código: trocar ou ignorar. Projeto que usa essas marcas de propósito roda sem a opção |
| Uma captura aparece como "não capturada" | A ação do roteiro não achou o elemento em 5 segundos: ver o motivo em `capturas-resultado.json` e corrigir o seletor |
| Uma tela aparece como "impossível" | Depende de login ou de dados que não existem no ambiente: conferir à mão, conforme o relatório |
| Sessão interrompida no meio | Retomar pedindo "continue a limpeza visual a partir de docs/limpeza-visual/ESTADO.md" |

A lista completa está no final do [SKILL.md](SKILL.md).

## Estrutura

```
limpeza-visual-ia/
├── SKILL.md        instruções que o agente segue (inclui o script verificador)
├── README.md       este arquivo
├── templates/      modelos de PRODUCT.md, SPEC.md, DESIGN.md, do pull request e do trecho de README
└── scripts/        verificar.sh, capturar.cjs e roteiro.exemplo.json (cópias dos scripts do SKILL.md)

No projeto, a skill cria:
scripts/limpeza-visual/verificar.sh   verificador de regras
scripts/limpeza-visual/capturar.cjs   capturas de telas e estados, a partir do roteiro
docs/limpeza-visual/ESTADO.md         progresso e matriz de cobertura, para retomar a sessão
docs/limpeza-visual/roteiro.json      roteiro das capturas
docs/limpeza-visual/RELATORIO.md      relatório e capturas, no fim
```

## Licença

[a definir]. A lista de padrões de texto adapta o humanizer, de Siqi Chen, sob licença MIT.
