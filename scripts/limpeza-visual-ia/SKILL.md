---
name: limpeza-visual-ia
description: Remove o visual genérico de IA (cards, bordas, ícones coloridos, gradientes) de um projeto web existente. Garante antes PRODUCT.md, SPEC.md e DESIGN.md, depois audita, cria tokens e primitivos, migra por área e trava no build.
---

# Limpeza visual de projeto web

Use quando o usuário tem um projeto web que já funciona e quer tirar o visual típico de interface gerada por IA: tudo em card, borda e sombra, ícones coloridos, cor em todo lugar, gradientes, badges promocionais e textos de apresentação dentro de caixas. O método troca correção tela a tela por um sistema visual pequeno e obrigatório, escrito em documentos, aplicado por áreas e travado no build.

Arquivos desta skill:
- `templates/PRODUCT.md`, `templates/SPEC.md`, `templates/DESIGN.md`: modelos dos três documentos de base.
- `templates/README-snippet.md`: trecho para linkar os documentos no README.
- `templates/pull_request_template.md`: checklist de pull request para UI.

## Princípios
1. Documentos primeiro. O agente só aplica regra que está escrita, e o DESIGN.md é a fonte de verdade visual. Os mesmos documentos servem a quem ler o repositório no GitHub.
2. Descrever o destino, não só proibir. Sem uma referência visual, o agente troca um vício por outro.
3. Atacar a causa: poucos tokens e primitivos primeiro, migração mecânica depois.
4. Um passe, um escopo. Nunca limpar tudo de uma vez.
5. Não mudar comportamento. Em dúvida entre decoração e informação, manter e listar como dúvida.
6. Conferir olhando a tela nos temas claro e escuro. O relatório do agente não substitui isso.

## Fase A: levantamento
Perguntar apenas o necessário (e propor um padrão se o usuário não responder): referência visual (ex.: YouTube, Linear, Stripe docs, Notion), temas (claro, escuro ou ambos), cor de destaque, idioma dos documentos. Detectar sozinho: framework de estilo (Tailwind, CSS Modules, styled-components), biblioteca de componentes (shadcn/Radix), biblioteca de gráficos, como o tema é alternado, e onde estão PRODUCT.md, SPEC.md e DESIGN.md (raiz ou docs/).

## Fase B: base documental (PRODUCT.md, SPEC.md, DESIGN.md)
Sem os três arquivos, a skill não passa para a auditoria. Cada um responde uma pergunta e não repete o conteúdo dos outros:

| Arquivo | Responde | Em conflito |
|---|---|---|
| PRODUCT.md | Por que existe e para quem: público, propósito, marca, princípios | Manda no que é o produto |
| SPEC.md | Como funciona: comandos, dados, API, comportamento de cada tela, critérios de aceite | Manda no comportamento |
| DESIGN.md | Como parece: referência, tokens, regras, componentes, acessibilidade, como contribuir | Manda em tudo que for visual |

Procedimento:
1. Localizar os três (raiz e docs/). Ler por inteiro os que existem.
2. Criar os que faltam a partir de `templates/`. Preencher só com o que se verifica no código (package.json, rotas, schema, tailwind.config, index.css) ou que o usuário disse. O restante fica marcado como `A definir:` e vira pergunta curta ao usuário: finalidade, público, nome e tom da marca, referência visual, cor de destaque. Nunca inventar missão, público ou métricas.
3. Nos que já existem, procurar lacunas e conflitos: trechos que incentivam o vício ("cards compactos", várias cores de destaque sem regra de uso), regras visuais espalhadas em PRODUCT.md ou SPEC.md, nomes de token diferentes dos do código, regras de cor contraditórias. Se SPEC.md ou PRODUCT.md já tiver uma seção visual, mover o conteúdo para o DESIGN.md e deixar só um link. Não apagar conteúdo de produto sem listar a mudança ao usuário.
4. O DESIGN.md nasce com valores provisórios onde dependem da auditoria (mapa de hex). Completar depois da Fase 0 e atualizar ao fim de cada fase: é documento vivo, e os nomes de token nele são os do código.
5. PARAR e pedir ao usuário que aprove o DESIGN.md (referência, paleta, cor de destaque, temas) antes da Fase 1.

Escritos para quem lê no GitHub:
- No idioma do projeto, em linguagem direta, sem jargão interno ("passe", "agente", "prompt").
- Cada arquivo abre com 2 a 3 linhas dizendo para que serve e quando ler; sumário se passar de uns 150 linhas.
- Links relativos entre os três e a partir do README (`templates/README-snippet.md`).
- Sem segredos: chaves, tokens, valores de .env, IDs de conta, e-mails pessoais. Exemplos com valores fictícios.
- Tokens e componentes em tabelas markdown. Regras de uma frase e testáveis ("no máximo um botão primary por área"), não adjetivos ("visual limpo").
- Regras que são só deste projeto (ex.: proibir travessões, política de toasts) ficam no SPEC.md ou DESIGN.md do projeto, nunca como padrão da skill.

## Fase 0: auditoria (somente leitura)
Não editar nada. Ler os três documentos e comparar o código com o DESIGN.md. Entregar: contagem por pasta, os 10 arquivos mais afetados, padrões repetidos que deveriam ser componentes (botões e quantas variações, ícone em caixa colorida, cards de seção, badges, cabeçalhos de página, KPIs, abas), cores fora da paleta, hex de cinza soltos por frequência, e componentes de UI existentes e subutilizados. Placar (usar a mesma expressão no projeto todo, mudando só o caminho):

```
P=src
rg -o 'border-|shadow-|ring-|rounded-(xl|2xl|3xl)|bg-gradient|from-|to-|(text|bg|border)-(red|amber|yellow|orange|emerald|green|blue|sky|purple|indigo|violet|rose|teal)-|#[0-9a-fA-F]{3,8}' $P | wc -l
```

Adaptar ao stack. Em CSS puro, contar sombras, gradientes, border-radius e hex. Com o resultado, preencher o apêndice "mapa de migração" do DESIGN.md (hex solto para token, por frequência).

## Fase 1: fundação
1. Tokens semânticos como variáveis CSS com valores para tema claro e escuro, mapeados no tema do framework e iguais à tabela do DESIGN.md. Componentes usam classes semânticas (bg-surface, text-content), nunca prefixo dark: nem cor fixa. Reaproveitar nomes de token que já existam. Não remover a paleta padrão do framework ainda.
2. Reaproveitar componentes existentes. Criar os que faltam: Button (primary, secondary, ghost, destructive), Chip, StatusText, Tabs, PageHeader, Stat, Section, Input, Textarea, Select, Switch, Table, ProgressBar. Poucas variantes, comentário de uso de 2 a 3 linhas no topo, e registrar pendência em vez de inventar variante.
3. O destructive não pode ter o mesmo preenchimento do primary quando erro e destaque são a mesma cor: texto na cor de erro sobre fundo neutro, sólido só no botão de confirmação dentro de um Dialog.
4. Gráficos que recebem cor como string (Chart.js e similares) leem os tokens em runtime com getComputedStyle e recriam ao trocar o tema.
5. Não migrar nenhuma página nesta fase.
6. Criar página temporária UiKit com todos os componentes e estados. PARAR e pedir ao usuário que revise nos dois temas: foco por teclado, contraste de placeholder e rótulos, Switch ligado e desligado, Table, erro de campo, largura de celular. Só seguir depois de aprovado.
7. Atualizar o DESIGN.md: tokens reais, tabela de componentes com o caminho de cada arquivo.

## Fase 2: migração por área
Ordem: layout global, telas de maior alcance (home e listagens), telas centrais, autenticação, áreas de gestão, admin (uma aba por passe). Arquivos com mais de 400 linhas: por seção, com commit por seção. Uma branch por passe.

Prompt de cada passe (trocar escopo e notas da área):

```
Leia PRODUCT.md, SPEC.md e DESIGN.md. O DESIGN.md é a fonte de verdade visual. Use os tokens e primitivos de components/ui.
Escopo deste passe: [arquivos]. Fora do escopo: todo o resto.
Notas desta área: [particularidades].
1. Diagnóstico: liste o que fere o DESIGN.md no escopo.
2. Trocar hex e cores diretas por tokens, seguindo o mapa de migração do DESIGN.md.
3. Substituir markup solto pelos primitivos. Se faltar variante, registrar pendência. Não criar variantes novas.
4. Cada estado uma vez por tela. Ícones monocromáticos e só em ação, navegação e status. Sem gradiente.
5. Gráficos: ler cores dos tokens em runtime.
6. Não alterar lógica, handlers, rotas, API nem textos. Não corrigir acentos neste passe.
7. O que parecer informação ou função: não remover, listar como dúvida.
Validar nos temas claro e escuro, rodar o build e reportar: arquivos alterados, o que foi removido, pendências e contagem antes e depois (mesmo comando do placar).
```

Verificação de cada passe: abrir a tela nos dois temas e em largura de celular; decidir as dúvidas listadas; revisar o diff atrás de mudanças além de classes (onClick, useEffect, fetch, rotas); fazer merge e usar a tela aprovada como exemplo no passe seguinte. Se o passe revelar regra faltando, atualizar o DESIGN.md no mesmo pull request.

## Fase 3: passe de texto (sozinho e por último)
Corrigir acentuação e remover travessões (se o projeto proíbe) só em strings exibidas (JSX, placeholder, aria-label, title, toast, erro). Não tocar em strings usadas como chave, id, rota, valor de select, comparação, nome de aba em estado, campo de payload ou resposta de API. Depois, procurar acento dentro de lógica:

```
git diff -U0 -- src | rg '^[-+].*(===|!==|case |value=|href=|to=|navigate[(]|fetch[(]|api[.]|body:)'
```

Reverter o que aparecer em comparação, rota ou payload.

## Fase 4: travar e publicar
1. Placar no projeto inteiro: alvo zero fora de components/ui.
2. Script no build ou hook de commit que falha se achar gradiente, sombra, raios grandes, cor direta do framework ou hex fora de components/ui e do arquivo de tokens.
3. No fim da migração (nunca antes), trocar a extensão de cores do framework por apenas os tokens semânticos.
4. Remover o apêndice "mapa de migração" do DESIGN.md e conferir que tokens e componentes do documento batem com o código.
5. Linkar os três documentos no README (`templates/README-snippet.md`) e adicionar `templates/pull_request_template.md` em `.github/`.
6. Registrar no SPEC.md que UI nova usa components/ui e tokens, e que o build falha se não usar.
7. Se uma regra de lint (como react-refresh/only-export-components) reclamar dos primitivos, abrir exceção só para a pasta de primitivos.
8. Revisar os três arquivos como um leitor novo do GitHub: sem segredos, sem jargão interno, links funcionando.

## Armadilhas já vistas
- Regras visuais só no prompt: o próximo agente não as conhece. Escreva no DESIGN.md.
- Regras visuais duplicadas em SPEC.md e DESIGN.md: duas fontes de verdade que divergem.
- Nomes de token no documento diferentes dos do código: o próximo agente cria tokens duplicados.
- Documento escrito só para o agente: ilegível para quem chega pelo GitHub.
- Inventar missão, público ou métricas para preencher o PRODUCT.md: usar `A definir:` e perguntar.
- O agente migra páginas durante a fundação: repetir "não migrar nenhuma página nesta tarefa".
- O tema claro só quebra quando alguém olha: tokens incompletos, text-white fixo, hex em áreas como o admin.
- Correção de acentos quebrando lógica quando a string era chave ou comparação.
- Gráficos ilegíveis no tema claro porque a biblioteca não lê classes CSS.
- Remoção de bloco que era informação (badges de estado, resumos): sempre listar como dúvida.
- Destaque e erro com a mesma cor: o destructive fica idêntico ao primário.
- Pedir tudo de uma vez: diff impossível de revisar.
