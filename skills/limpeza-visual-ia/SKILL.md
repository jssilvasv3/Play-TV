---
name: "limpeza-visual-ia"
description: "Remove o visual genérico de IA de um projeto web existente: cards, bordas, ícones coloridos, fontes e jargão padrão. Perguntas só no início, piloto aprovado, execução autônoma com verificador em script, agente novo por área e matriz de cobertura."
---

# Limpeza visual de projeto web

Use quando o usuário tem um projeto web que já funciona e quer tirar o visual típico de interface gerada por IA: tudo em card, borda e sombra, ícones coloridos, cor em todo lugar, gradientes, badges promocionais e textos de apresentação dentro de caixas. O método troca correção tela a tela por um sistema visual pequeno e obrigatório, aplicado por áreas e travado no build. Funciona com qualquer referência visual e começa garantindo PRODUCT.md, SPEC.md e DESIGN.md, que servem ao agente e a quem lê o repositório.

## Princípios
1. Descrever o destino, não só proibir. Sem uma referência visual, o agente troca um vício por outro.
2. Atacar a causa: poucos tokens e primitivos primeiro, migração mecânica depois.
3. Um passe, um escopo. Nunca limpar tudo de uma vez.
4. Não mudar comportamento. Em dúvida entre decoração e informação, manter e listar como dúvida.
5. Conferir olhando a tela nos temas claro e escuro. O relatório do agente não substitui isso: o agente captura e inspeciona as telas ele mesmo, e o usuário revisa as capturas na entrega final.
6. A fundação não muda nenhuma tela. Estilos globais (fonte, tema padrão, filtros, peso do texto) mudam todas as telas de uma vez e têm etapa própria.
7. Calcular, não supor: contagens, contraste e promessas dos documentos são conferidos por comando ou script, com arquivo e linha como evidência.
8. Dizer o que não foi verificado (build não rodado, tela não aberta) em vez de dar a entender que foi.
9. Provar o sistema em uma página, com prévia aprovada pelo usuário, antes de aplicar no projeto todo. Tudo no piloto precisa poder ser desfeito.
10. Perguntar no início, executar até o fim. Depois do piloto aprovado, nenhuma confirmação por tela: verificações automáticas fazem o papel de porta e o usuário revisa tudo de uma vez na entrega.
11. As regras não ficam na memória do agente. Sessões longas degradam, então o que dá para checar vira script (verificador), o progresso vira arquivo (estado) e cada área roda em contexto novo.

## Modo de execução: perguntas no início, autonomia depois
O usuário é consultado em dois momentos e em mais nenhum:
1. Início (Fases A e B): todas as perguntas de levantamento de uma vez, em uma única mensagem (com AskUserQuestion, se existir), e a aprovação do DESIGN.md. Se o usuário não responder ou estiver ausente, assumir os padrões propostos e dizer quais foram.
2. Piloto (Fase P): prévia de uma página e decisão de aprovar, ajustar ou desfazer. A prévia mostra também os tokens, os componentes e os estilos globais, então ela substitui a revisão do UiKit e dos globais.

Depois da aprovação do piloto, executar as Fases 2, 3 e 4 até o fim, sem pedir confirmação. Regras de autonomia:
- Porta automática no lugar da aprovação humana. Cada área só é dada como concluída quando passam: build, placar menor que o de antes, grep de classes proibidas vazio no escopo, diff sem mudança de lógica (onClick, useEffect, fetch, rotas), contraste calculado, capturas de tela feitas e inspecionadas nos temas claro e escuro e em largura de celular, sem rolagem horizontal, e matriz de cobertura da área com situação em todas as linhas.
- Se uma porta falhar, corrigir e repetir até 2 vezes. Persistindo, reverter só aquela área, registrar em pendências e seguir para a próxima. Nunca parar tudo por causa de uma área.
- Dúvidas (informação ou decoração, variante que falta, texto ambíguo): decidir pela regra conservadora (manter) e listar no relatório final. Não perguntar.
- Trabalhar em uma branch de integração (ex.: `limpeza-visual`) com um commit por área. Nunca fazer merge na branch principal: a entrega é um pull request, ou a branch pronta, para o usuário revisar.
- Interromper só por bloqueio real: o app não compila antes de começar, falta acesso ao repositório ou ao ambiente, ou uma ação destrutiva fora do escopo. Nesse caso, dizer o que falta e o que já está pronto.
- As portas são executadas pelo script verificador, não pela avaliação do agente (seção Verificador, estado e contexto novo por área). O agente principal só coordena: cada área roda em um agente novo, e o estado fica em `docs/limpeza-visual/ESTADO.md`.
- Acompanhamento pela lista de tarefas, uma tarefa por área, sem narrar cada passo.
- O usuário pode interromper a qualquer momento. O agente para e relata o estado.

## Fase A: levantamento
Perguntar apenas o necessário (e propor um padrão se o usuário não responder): referência visual (ex.: YouTube, Linear, Stripe docs, Notion), temas (claro, escuro ou ambos), cor de destaque, e se existe spec de produto ou design (PRODUCT.md, SPEC.md, DESIGN.md). Detectar sozinho: framework de estilo (Tailwind, CSS Modules, styled-components), biblioteca de componentes (shadcn/Radix), biblioteca de gráficos e como o tema é alternado.

Detectar também: a versão do Tailwind (v3 usa tailwind.config; v4 define os tokens com @theme no CSS); se o tema tem mais de um mecanismo (classe, data-attribute, media query) e qual é o padrão; se existe backend ou o projeto é só front-end (dados em localStorage); e o arquétipo de superfície da referência.

Perguntar na mesma mensagem, para não voltar a perguntar depois: se o usuário escolhe a página-piloto ou delega ao agente, se há áreas ou telas fora do escopo, e se prefere a entrega como pull request ou como branch pronta.

## Arquétipo de superfície
A referência define como as superfícies se comportam. As regras de superfície do DESIGN.md vêm do arquétipo escolhido, nunca copiadas de outro projeto:
- Conteúdo em primeiro lugar (YouTube, Netflix): item de conteúdo sem card, direto no fundo; card só em modal, formulário, tabela e gráfico.
- Feed de cartões (Facebook, LinkedIn): fundo cinza e um cartão claro por unidade do feed (publicação, caixa de publicar, resumo de perfil, modal, menu). Barras laterais sem cartão. Botões de ícone em círculo neutro.
- Produto denso (Linear, Notion, Stripe docs): painéis planos separados por divisor de 1px, sem cartão de métrica e sem sombra.

Valem em todos: nunca card dentro de card; borda ou sombra, nunca as duas; ícones monocromáticos; cor só quando significa algo; hierarquia por tamanho, peso e espaço.

## Fase B: base documental (PRODUCT.md, SPEC.md, DESIGN.md)
Sem os três arquivos, não passar para a auditoria. Cada um responde uma pergunta e não repete o conteúdo dos outros:

| Arquivo | Responde | Em conflito |
|---|---|---|
| PRODUCT.md | Por que existe e para quem: público, propósito, marca, princípios | Manda no que é o produto |
| SPEC.md | Como funciona: comandos, dados, API, telas, critérios de aceite, lacunas conhecidas | Manda no comportamento |
| DESIGN.md | Como parece: referência, tokens, regras, componentes, acessibilidade, como contribuir | Manda em tudo que for visual |

Procedimento:
1. Localizar os três (raiz e docs/). Ler por inteiro os que existem.
2. Criar os que faltam. Preencher só com o que se verifica no código (package.json, rotas, schema, CSS) ou que o usuário disse. O restante fica como `A definir:` e vira pergunta curta. Nunca inventar missão, público ou métricas.
3. Nos que já existem, procurar lacunas e conflitos: trechos que incentivam o vício ("cards compactos", várias cores de destaque sem regra de uso), regras visuais espalhadas em PRODUCT.md ou SPEC.md (mover para o DESIGN.md e deixar um link), nomes de token diferentes dos do código, e cores diferentes entre documento e código. Neste último caso, perguntar ao usuário qual vale e seguir a resposta.
4. Compatibilidade documentos e código: para cada promessa (recursos, LGPD, textos legais), buscar no código a evidência (arquivo e linha) e classificar como implementada, parcial ou não implementada. Promessa sem código vai para "Lacunas conhecidas" do SPEC.md e é sinalizada no PRODUCT.md e nos textos legais. Nunca apagar a promessa sem avisar. Achados de segurança ou privacidade fora do escopo (ex.: usuário administrador criado no front-end, e-mail pessoal no código) são reportados à parte e não corrigidos sem pedido.
5. Esqueletos dos documentos:
   - PRODUCT.md: Plataforma, Público, Propósito, Posicionamento, Contexto operacional, Capacidades e restrições, Marca, Princípios do produto.
   - SPEC.md: Visão geral (com o estado atual: protótipo ou produção), Comandos, Dados, API, Interface e comportamento por tela, Critérios de aceite, Lacunas conhecidas.
   - DESIGN.md: Princípio, Referência (o que adotamos e o que não), Tokens, Layout, Regras, Componentes, Padrões de tela, Acessibilidade (com contrastes calculados), Temas, Tipografia e vocabulário (fontes, pesos, glossário de termos), Como contribuir com UI, e dois apêndices temporários: diferenças entre o código atual e o alvo, e mapa de migração.
6. O DESIGN.md nasce com valores provisórios onde dependem da auditoria e é completado depois da Fase 0. É documento vivo: os nomes de token nele são os do código.
7. PARAR e pedir ao usuário que aprove o DESIGN.md (referência, arquétipo, paleta, cor de destaque, temas e, se a auditoria já existir, fontes e glossário de vocabulário) antes da Fase 1. O glossário pode chegar depois da Fase 0; nesse caso é aprovado junto com a prévia do piloto, sem nova parada.

Escritos para quem lê no GitHub: no idioma do projeto, em linguagem direta e sem jargão interno ("passe", "agente", "prompt"); cada arquivo abre com 2 a 3 linhas dizendo para que serve; links relativos entre eles; sem segredos, chaves, IDs de conta ou e-mails pessoais; tokens e componentes em tabelas; regras de uma frase e testáveis ("no máximo um botão primário por área"), não adjetivos ("visual limpo"). Regras que são só do projeto (ex.: política de toasts) ficam nos documentos do projeto, nunca como padrão da skill. Travessão e aspas curvas não são regra do projeto: são marca de texto de IA e a skill trata como padrão (seção Padrões de texto de IA em interface).

## Fase 0: auditoria (somente leitura)
Não editar nada. Ler os três documentos e comparar o código com o DESIGN.md. Entregar: contagem por pasta, os 10 arquivos mais afetados, padrões repetidos que deveriam ser componentes (botões e quantas variações, ícone em caixa colorida, cards de seção, badges, cabeçalhos de página, KPIs, abas), cores fora da paleta, hex de cinza soltos por frequência, e componentes de UI existentes e subutilizados. Placar (usar a mesma expressão no projeto todo, mudando só o caminho). No ripgrep use `-I` para omitir o nome do arquivo; `-h` mostra a ajuda:

```
P=src
for pat in 'border-' 'shadow-' 'ring-' 'rounded-(xl|2xl|3xl)' 'bg-gradient|from-|via-|to-[a-z]' \
  '(text|bg|border|ring|fill|stroke)-(red|amber|yellow|orange|emerald|green|blue|sky|purple|indigo|violet|rose|teal|slate|gray|zinc|neutral|stone|cyan|pink|lime|fuchsia)-[0-9]+' \
  '#[0-9a-fA-F]{3,8}\b' 'dark:' 'var\(--'; do
  echo "$(rg -oI -e "$pat" $P | wc -l)  $pat"; done
```

Adaptar ao stack. Em CSS puro, contar sombras, gradientes, border-radius e hex. A expressão antiga não contava slate, gray, zinc, neutral e stone, que costumam ser a maioria das cores diretas.

Medir também:
- Adoção de tokens: `var(--` e `dark:` contra as classes de cor diretas. Tokens definidos e sem uso são sinal de que documento e código divergem.
- Papel de cada hex solto, para mapear por papel e não só por frequência:
  ```
  rg -oI -i '(dark:)?(bg|border|text|ring|divide|from|to|via|placeholder)-\[#[0-9a-f]{3,8}\]' $P | sed -E 's/^dark://' | tr 'A-F' 'a-f' | sort | uniq -c | sort -rn | head -20
  ```
- Contraste dos tokens existentes (script da Fase 1).
- Mecanismo e padrão do tema, e o par "sistema escuro com app claro".
- Estilos globais que afetam todas as telas: fonte, filtros em imagens, peso do texto no tema escuro, fonte raiz no celular, regras de prefers-contrast e prefers-reduced-motion.
- Se há backend ou se os dados ficam no navegador.
- Tipografia: quais fontes existem e de onde vêm, e como o peso e o tamanho são usados:
  ```
  rg -oI 'font-family:[^;}]+' src index.html | sort | uniq -c | sort -rn
  rg -oI 'fonts\.googleapis\.com/css2\?family=[^"&]+|@font-face|@fontsource[^"'"'"']*' src index.html package.json | sort | uniq -c
  rg -oI '\bfont-(thin|extralight|light|medium|semibold|bold|extrabold|black)\b|\btracking-(tighter|tight|wide|wider|widest)\b|\buppercase\b|text-\[[0-9]+px\]' src | sort | uniq -c | sort -rn
  ```
  Sinais de padrão de IA: fonte escolhida por moda e não pela referência (Inter, Space Grotesk, Poppins, Plus Jakarta Sans, DM Sans, Roboto sem que a referência use), mais de duas famílias, negrito e extranegrito em quase tudo, rótulos em caixa alta com espaçamento largo, textos de 10 a 11 px. A fonte é julgada contra a referência do DESIGN.md: se a referência usa Roboto, Roboto está certo.
- Vocabulário: levantar os textos exibidos (JSX, placeholder, title, aria-label, toast, erro, páginas legais) e marcar termos técnicos para o público do PRODUCT.md (API, token, payload, endpoint, workspace, dashboard, insights, deploy, "algo deu errado" sem dizer o quê) e frases de modelo de IA ("Eleve", "Descubra", "Transforme", "sem complicações", "poderoso", "robusto", "experiência perfeita", "Bem-vindo de volta!", emoji e ponto de exclamação em excesso). Usar a lista de padrões da seção Padrões de texto de IA em interface. Inventário de frases suspeitas nos textos exibidos (lista de partida, ampliar com o que a leitura achar):
  ```
  rg -nIi 'bem-vind[oa] de volta|vamos (mergulhar|começar)|pronto para|prepare-se|descubra|desbloqueie|potencialize|eleve (seu|sua)|transforme|revolucion|sem complicaç|experiência (perfeita|única|incrível)|poderos[oa]|robust[oa]|inovador|intuitiv[oa]|jornada|ecossistema|solução (completa|definitiva)|simples assim|algo deu errado|ops!|espero ter ajudado|ótima pergunta' src index.html
  ```
  Montar o glossário: termo atual, termo proposto, onde aparece. Os termos que o próprio público usa (por exemplo, "API" num produto para desenvolvedores) ficam fora.
- Inventário de cobertura: a lista de todas as telas, modais, menus, estados e papéis do produto, tirada do mapa de telas do SPEC.md, das rotas e da pasta de componentes (seção Cobertura e capturas por estado). É a base da matriz do ESTADO.md.

Com o resultado, completar os apêndices do DESIGN.md (diferenças entre o código atual e o alvo, e mapa de migração).

## Fase 1: especificação e fundação
1. Escrever ou atualizar a seção de regras visuais do spec, no DESIGN.md (modelo abaixo). Corrigir trechos do spec que incentivem o vício, como 'cards compactos' ou várias cores de destaque sem regra de uso.
2. Tokens semânticos como variáveis CSS com valores para tema claro e escuro, mapeados no tema do framework. Componentes usam classes semânticas (bg-surface, text-content), nunca prefixo dark: nem cor fixa. Reaproveitar nomes de token que já existam e manter os mesmos nomes no spec. Não remover a paleta padrão do framework ainda.
   - Tailwind v4: bloco `@theme inline` que aponta para as variáveis (`--color-surface: var(--surface);`, `--radius-panel: 8px;`, `--shadow-card: var(--card-shadow);`). Os valores do tema escuro ficam no mesmo seletor que o projeto já usa. Tailwind v3: `theme.extend.colors` com `'var(--surface)'`.
   - Não definir a fonte nesta fase: ela muda o projeto inteiro.
   - Remover variáveis antigas só depois de confirmar com rg que nada as referencia. Preservar as regras globais existentes.
   - Validar cada par de texto (4,5:1) e a borda de campo (3:1) por cálculo antes de gravar os valores. Se falhar, ajustar o token, não a regra:
     ```
     python3 -I - <<'EOF'
     def L(h):
         c = [int(h[i:i+2], 16) / 255 for i in (1, 3, 5)]
         c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
         return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
     def R(a, b):
         x, y = sorted((L(a), L(b)), reverse=True)
         return (x + 0.05) / (y + 0.05)
     for nome, a, b, minimo in [("texto secundário / superfície", "#65676B", "#FFFFFF", 4.5)]:
         r = R(a, b); print(f"{r:.2f}:1", "OK" if r >= minimo else "FALHA", nome)
     EOF
     ```
3. Mapa dos hex soltos para tokens, derivado da auditoria por frequência e por papel (border, bg, text), escrito no prompt para o agente não escolher.
4. Reaproveitar componentes existentes. Criar os que faltam: Button (primary, secondary, ghost, destructive), Chip, StatusText, Tabs, PageHeader, Stat, Section, Input, Textarea, Select, Switch, Table, ProgressBar. Poucas variantes, comentário de uso de 2 a 3 linhas no topo, e registrar pendência em vez de inventar variante. Acrescentar Card, IconButton, NavItem e Avatar quando o arquétipo pedir. Sem dependência nova (Radix, CVA, clsx): variantes por objeto de classes. Dialog e DropdownMenu exigem foco e teclado: se não houver biblioteca, ficam como pendência para a etapa de layout.
5. O destructive não pode ter o mesmo preenchimento do primary quando erro e destaque são a mesma cor: texto na cor de erro sobre fundo neutro, sólido só no botão de confirmação dentro de um Dialog.
6. Gráficos que recebem cor como string (Chart.js e similares) leem os tokens em runtime com getComputedStyle e recriam ao trocar o tema.
7. Criar página temporária UiKit com todos os componentes e estados, como entrada separada fora do build (ex.: uikit.html e src/uikit.tsx, sem alterar a navegação do app), com amostras dos tokens e um seletor claro, escuro e sistema. Revisar o UiKit sozinho, nos dois temas e em largura de celular, e corrigir o que falhar: foco por teclado, contraste de placeholder e rótulos, Switch ligado e desligado, Table, erro de campo. Capturar o UiKit para a prévia do piloto. Só seguir quando essas verificações passarem; o usuário vê o resultado na Fase P.
8. Conferir que nenhuma tela existente mudou: `git diff --stat` só com documentos, arquivo de tokens, components/ui, UiKit e utilitários. Nos componentes novos, o grep de classes proibidas (dark:, hex, cor direta do framework, gradiente, raios e sombras fora dos tokens) deve voltar vazio.
9. Criar a infraestrutura de verificação: o verificador em `scripts/limpeza-visual/verificar.sh` (testá-lo: deve acusar uma tela antiga e passar em um arquivo limpo), o `docs/limpeza-visual/ESTADO.md`, o cartão de regras, a matriz de cobertura, o roteiro de capturas e a marca do commit de partida (`git tag limpeza-visual-base`). Detalhes na seção Verificador, estado e contexto novo por área.

## Fase 1b: estilos globais
Depois do UiKit verificado e antes da migração por área. São os estilos que mudam todas as telas de uma vez: fonte, tema padrão (forçado ou segue o sistema), filtro em imagens, peso do texto no tema escuro, fonte raiz no celular, regras de prefers-contrast e prefers-reduced-motion. Cada um em commit próprio e verificado olhando duas telas nos dois temas, com captura para a prévia do piloto. Ao trocar a fonte, remover o carregamento antigo no mesmo commit.

Fonte: vem da referência do DESIGN.md, não de gosto do agente. Uma família para o texto (no máximo duas, com a segunda justificada), de preferência a da própria referência ou a pilha do sistema; no máximo três pesos (normal, médio, negrito); tamanhos em escala fixa, sem `text-[11px]` solto; rótulos em caixa normal. Carregar só os pesos usados e com `font-display: swap`, para não criar salto de layout. Definir a família e a escala como tokens e registrar no DESIGN.md. Se a referência usa fonte proprietária (YouTube Sans, Facebook Sans), escolher a substituta pública mais próxima e dizer isso no DESIGN.md.

## Fase P: página-piloto
Depois da fundação (Fase 1) e dos estilos globais (Fase 1b), e antes de migrar o restante. Aplica o sistema em uma única página, mostra o resultado e só segue com a aprovação do usuário. É a última aprovação humana antes da execução automática.

1. Escolha da página, conforme a resposta dada na Fase A (o usuário escolhe ou delega ao agente).
   - Se o usuário escolhe, usar a página dele e avisar caso seja um mau piloto (muito grande, sem os padrões principais).
   - Se o agente escolhe, propor 3 candidatas com uma linha de motivo cada e indicar a preferida. Critérios: tela muito vista, com vários padrões juntos (cabeçalho, lista ou feed, formulário, abas, badges), de tamanho médio (até uns 400 linhas) e sem lógica sensível ou em mudança. Evitar login e telas de admin pouco usadas.
2. Preparar o desfazer. Criar uma branch própria (ex.: `piloto-visual`), registrar o commit de partida e fazer a migração em um único commit. Desfazer tem que ser um comando.
3. Aplicar o prompt de passe da Fase 2 só nessa página.
4. Gerar a prévia, na ordem de preferência:
   - Abrir a página no navegador do ambiente e capturar telas nos temas claro e escuro e em largura de celular, com antes e depois lado a lado. Incluir uma captura do UiKit. Salvar conforme a seção Capturas e relatório.
   - Se o app não rodar no ambiente (sem dados, login, variáveis), dizer isso e dar ao usuário o comando exato para abrir a página localmente. Nunca inventar captura nem descrever como se tivesse visto.
5. Relatório curto: o que mudou, dúvidas listadas (o que parecia informação e foi mantido), contagem do placar na página antes e depois, e o que não foi verificado.
6. Pedir a decisão ao usuário, com três saídas:
   - Aprovar: registrar a página no DESIGN.md como tela de referência (caminho do arquivo), para servir de exemplo nos passes seguintes, e fazer o merge na branch de integração (nunca na principal).
   - Ajustar: o usuário descreve em texto livre o que quer diferente. Classificar o pedido antes de mexer:
     - Vale só para esta página: ajustar a página.
     - Mexe em regra, token ou componente (ex.: "o azul está forte", "os cartões estão colados"): corrigir no DESIGN.md e no primitivo primeiro, recalcular o contraste se for cor, e depois reaplicar na página. Corrigir só a página esconderia o problema para as outras telas.
     - Gerar nova prévia a cada ajuste. Depois de 3 rodadas sem aprovação, parar e voltar ao DESIGN.md: a referência ou o arquétipo pode estar errado.
   - Desfazer: reverter a branch ao commit de partida, confirmar com `git diff` vazio em relação a ele e perguntar o que não agradou. Se o problema for a referência, o arquétipo ou a paleta, voltar à Fase B em vez de tentar outra página.
7. Só passar para a Fase 2 com o piloto aprovado e a página-piloto registrada no DESIGN.md. A partir daqui, o agente segue sozinho até a entrega final.

## Modelo da seção de regras visuais
Adaptar referência, valores e nomes de token ao projeto. A linha de Superfícies vem do arquétipo escolhido; abaixo está a do arquétipo conteúdo em primeiro lugar e, depois do bloco, as outras duas.

```
### Sistema visual
Princípio: o conteúdo é o elemento visual; a interface em volta é neutra, densa e silenciosa. Hierarquia por tamanho, peso e espaço, nunca por cor, caixa ou ícone. Referência: [produto de referência], usada como inspiração de estrutura, sem copiar marca ou ícones.
Tokens: fundo, superfície, elevada, divisor, texto, texto secundário, destaque, estados (sucesso, aviso, erro), raios (painel, campo, pílula). Proibido valor solto em componente.
Superfícies: item de conteúdo sem card; card só quando agrupa uma unidade (modal, formulário, tabela, gráfico); nunca card dentro de card; borda ou sombra, nunca as duas; cabeçalhos e parágrafos soltos na página; sem texto promocional dentro do painel, no máximo uma linha de apoio por tela.
Cor: destaque só em ação principal, estado ativo e progresso; no máximo um botão primário por área; cores de estado só quando o estado existe; proibido gradiente e cores fora da paleta.
Ícones: monocromáticos, na cor do texto; sem caixa colorida; sem ícone decorativo; só em ação, navegação e status; sem emoji.
Estado único: cada estado aparece uma vez por tela; não resumir em cards o que a navegação já mostra; badge só para estado real, nunca de marketing ou plano.
Gráficos: linhas finas, sem preenchimento de área, cinzas mais destaque; cores nos tokens.
Componentes: toda tela usa os primitivos de components/ui; proibido montar botão, chip, aba, badge ou cabeçalho com classes soltas.
Texto: rótulos em caixa normal; acentuação correta; sem travessões (— e –), sem barra vertical como separador e sem aspas curvas (“ ” ‘ ’), salvo se os textos do próprio projeto já usam de forma consistente.
```

Superfícies no arquétipo feed de cartões: cartão é a unidade do feed (publicação, caixa de publicar, resumo de perfil, modal, menu); barras laterais sem cartão; nunca cartão dentro de cartão; sombra ou borda, nunca as duas; fundo neutro atrás dos cartões; botão de ícone em círculo neutro, sem cor.
Superfícies no arquétipo produto denso: painéis planos separados por divisor de 1px; sem cartão de métrica; sem sombra.

## Fase 2: migração por área
Só começa com a página-piloto aprovada (Fase P) e segue sozinha, área por área, sem pedir confirmação (veja Modo de execução). Ordem: layout global, telas de maior alcance (home e listagens), telas centrais, autenticação, áreas de gestão, admin (uma aba por passe). Arquivos com mais de 400 linhas: por seção, com commit por seção. Passes pequenos: até uns 8 arquivos ou 400 linhas por passe, dividindo as áreas maiores. Cada passe roda em um agente novo, com o briefing da seção Verificador, estado e contexto novo por área. Uma branch por passe, com merge na branch de integração quando as portas passam.

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
Validar nos temas claro e escuro, rodar o build e reportar: arquivos alterados, o que foi removido, pendências, contagem antes e depois (mesmo comando do placar) e o que não foi verificado.
```

Verificação automática de cada passe: abrir a tela nos dois temas e em largura de celular e capturar (salvar conforme a seção Capturas e relatório); decidir as dúvidas listadas pela regra conservadora (manter); revisar o diff atrás de mudanças além de classes (onClick, useEffect, fetch, rotas); passando todas as portas (o verificador sai com 0 quando rodado pelo coordenador), fazer o commit na branch de integração, atualizar o ESTADO.md e usar a tela concluída, junto com a página-piloto, como exemplo no passe seguinte. Se o passe revelar regra faltando, atualizar o DESIGN.md no mesmo pull request.

Projeto com backend ou novas funcionalidades em andamento: migrar o visual da tela antes de ligá-la à API, para não gerar conflito. Em arquivos centrais muito grandes (mil linhas ou mais), o estado fica fora do escopo do passe.

## Fase 3: passe de texto (sozinho e por último)
Duas partes. Primeiro, vocabulário e tom: aplicar o glossário aprovado junto com o DESIGN.md e os padrões da seção Padrões de texto de IA em interface, nas strings exibidas, usando as palavras do público do PRODUCT.md e o tom da seção Marca. Termo fora do glossário que pareça jargão não é trocado: vai para a lista de dúvidas do relatório. Mensagem de erro passa a dizer o que houve e o que fazer. Depois de aplicar, procurar os termos que sobraram nos textos exibidos (`rg -nIiw 'termo1|termo2' src`) e revisar cada ocorrência, porque o mesmo termo em nome de variável ou de rota não pode mudar. Segundo, a acentuação.

Corrigir acentuação, remover travessões e trocar barra vertical de separador por pontuação ou estrutura, trocar aspas curvas por retas (padrão 15 da seção anterior; fica como está só se os textos do próprio projeto já usam de forma consistente) só em strings exibidas (JSX, placeholder, aria-label, title, toast, erro). Não tocar em strings usadas como chave, id, rota, valor de select, comparação, nome de aba em estado, campo de payload ou resposta de API. Depois, procurar acento dentro de lógica:

```
git diff -U0 -- src | rg '^[-+].*(===|!==|case |value=|href=|to=|navigate[(]|fetch[(]|api[.]|body:)'
```

Reverter o que aparecer em comparação, rota ou payload.

## Padrões de texto de IA em interface
Adaptado da skill pública humanizer (github.com/blader/humanizer, licença MIT, baseada na página "Signs of AI writing" da Wikipédia), que trata prosa em inglês. Aqui ficam só os padrões que aparecem em texto de interface, em português, na ordem de força. Os três primeiros justificam a troca com uma ocorrência; os marcados como fracos precisam de companhia de outros sinais na mesma tela. Serve para as strings exibidas e para os documentos que o agente escreve (PRODUCT.md, SPEC.md, DESIGN.md, README, RELATORIO.md).

1. Contraste sem opositor: "Mais que um app, uma experiência", "Não é só X, é Y". Dizer a coisa direto.
2. Frase de efeito ou fecho que repete: "Simples assim.", "E o melhor:", fila de fragmentos ("Rápido. Seguro. Seu."). Cortar o que não traz fato novo.
3. Frase que soa profunda: "No fundo", "O coração do produto", "a linguagem da confiança". Trocar pela afirmação específica.
4. Abertura de palco: "Vamos mergulhar", "Aqui está o que você precisa saber", "Pronto para começar?", "Prepare-se". Tirar a abertura e dizer o ponto.
5. Polêmica com ninguém: "Não se preocupe", "Não é complicado", "Você pode pensar que". Remover a defesa; manter só se o texto responde a uma dúvida real.
6. Tríades forçadas: "Rápido, seguro e intuitivo", "Conecte, compartilhe e cresça". Manter três itens só se houver três coisas distintas.
7. Palavras de IA, em qualquer lugar: poderoso, robusto, inovador, transformador, perfeito, intuitivo, sem fricção, jornada, ecossistema, solução completa, experiência única, potencialize, desbloqueie, eleve, descubra, revolucione. Trocar pelo que a coisa faz.
8. Significado inflado e linguagem de venda: "O futuro chegou", "a melhor forma de", "líder em". Dizer o que o produto é e faz. Sem selo nem superlativo sem fonte.
9. Evitar "é" e "tem": "serve como", "atua como", "oferece", "conta com". Usar "é", "tem".
10. Enfeite de formatação: negrito em todo rótulo, título em caixa alta ou com cada palavra maiúscula, emoji e seta decorativa, "Bem-vindo de volta! 👋". Caixa normal, sem emoji (regra do DESIGN.md).
11. Resíduo de chatbot: "Claro!", "Ótima pergunta!", "Espero ter ajudado", "Posso ajudar em algo mais?". Remover o invólucro e manter o conteúdo.
12. Texto sobre a própria tela: "Aqui você pode ver…", "Esta seção mostra…", título repetido na primeira frase. Cortar: o leitor vê a tela.
13. Dúvida empilhada (fraco): "talvez possa eventualmente". Manter só o que a fonte sustenta.
14. Mensagens de erro e de estado vazio genéricas: "Algo deu errado", "Ops!", "Nada por aqui ainda ✨". Dizer o que houve ou o que falta e o que fazer em seguida. Botão com verbo e objeto ("Salvar alterações"), não "Enviar" ou "OK" soltos quando houver contexto.

15. Travessão, barra vertical e aspas curvas, os sinais mais comuns de todos. Agentes colocam travessão (— e –) como conector universal, barra vertical como separador ("Início | Sobre", "Risesek | Vitrine de serviços" no título da página, "Nome | Cargo" em rótulo) e aspas curvas (“ ” ‘ ’) em qualquer texto, mesmo quando o projeto não usa. Trocar travessão por ponto, vírgula, dois-pontos ou parênteses, ou reescrever a frase; trocar a barra vertical por dois-pontos, vírgula ou hífen simples no título ("Vitrine de serviços: Risesek" ou só o nome da página), ou por estrutura de verdade (itens de menu separados por espaçamento, não por barra); trocar aspas curvas por retas ("" e ''). Um sinal sozinho é fraco, mas em texto gerado costuma aparecer em quantidade. Exceções: os textos do próprio projeto usam de forma consistente (então manter na mesma proporção), diálogo e citação, tabelas em Markdown nos documentos (a barra faz parte da sintaxe), e código, comandos, caminhos e URLs, que não se tocam. O operador `|` e `||` do código não é texto e nunca se troca.

Regras de aplicação:
- Não inventar nada. Nenhum fato, número, recurso, prazo ou promessa (LGPD, segurança, desempenho) que não esteja no código, no PRODUCT.md ou no que o usuário disse. Texto que precisa de um dado que falta fica como está e vai para as dúvidas.
- O tom vem da seção Marca do PRODUCT.md e de textos que o próprio usuário escreveu, que valem mais que a lista. Textos de produto para público técnico mantêm o vocabulário técnico (ver glossário).
- Respeitar o tamanho: o texto novo cabe onde o antigo cabia, conferido nas capturas em celular.
- Não mexer em citações, nomes próprios, texto legal revisado por pessoa, nem em strings usadas como chave, rota ou comparação.
- Em documentos, mudar só a prosa. Código, comandos, caminhos e links ficam como estão.
- Depois de reescrever, reler procurando de novo os padrões 1, 2, 6 e 10, que mais sobrevivem à reescrita, e conferir que nenhum fato foi acrescentado nem perdido.
- Uma frase que parece padrão de IA mas é escolha clara do projeto (pessoa explica o porquê) fica. A lista é indício, não sentença.

## Fase 4: travar
1. Placar no projeto inteiro: alvo zero fora de components/ui.
2. Script no build ou hook de commit que falha se achar gradiente, sombra, raios grandes, cor direta do framework ou hex fora de components/ui e do arquivo de tokens. O verificador já existe desde a Fase 1: ligá-lo ao build (`--build`) ou ao hook de commit.
3. No fim da migração (nunca antes), trocar a extensão de cores do framework por apenas os tokens semânticos.
4. Registrar no spec que UI nova usa components/ui e tokens, e que o build falha se não usar.
5. Se uma regra de lint (como react-refresh/only-export-components) reclamar dos primitivos, abrir exceção só para a pasta de primitivos.
6. Remover os apêndices temporários do DESIGN.md, conferir que tokens e componentes do documento batem com o código e recalcular o contraste.
7. Linkar os três documentos no README e adicionar um modelo de pull request com o checklist de UI.
8. Revisar os três arquivos como um leitor novo do GitHub: sem segredos, sem jargão interno, links funcionando.
9. Entrega final: abrir o pull request (ou deixar a branch pronta) com um relatório consolidado, salvo em `docs/limpeza-visual/RELATORIO.md` (seção Capturas e relatório): resumo; placar antes e depois, total e por área; capturas antes e depois de cada área nos dois temas; dúvidas mantidas; pendências (áreas revertidas, variantes que faltaram); achados de segurança ou privacidade fora do escopo; o que não foi verificado, incluindo as telas e estados da matriz de cobertura sem captura, com o motivo e onde conferir à mão; e como desfazer tudo (reverter o pull request).

## Pontos de parada
O usuário aprova apenas em dois pontos: o DESIGN.md (fim da Fase B) e a página-piloto com prévia (Fase P), que também mostra o UiKit e os estilos globais. Depois disso não há mais pontos de parada: a entrega final é um pull request para revisão, não uma pergunta. Cada passe termina com um relatório, que vai para a lista de tarefas e para o relatório final: arquivos alterados, decisões, pendências, números das verificações (contagem antes e depois, build, contraste) e o que não foi verificado.

## Verificador, estado e contexto novo por área
Sessões longas degradam: o contexto enche, as regras do início ficam distantes e o agente passa a imitar o que fez nas últimas telas. Por isso as regras não ficam na memória do agente. Ficam em script, em arquivo e em contextos curtos.

### Verificador em script
Criado na Fase 1, antes de qualquer migração, em `scripts/limpeza-visual/verificar.sh`. Roda o que dá para checar por máquina e sai com código 1 se achar violação. O agente não decide se passou: passa quando o script sai com 0. O coordenador roda o script de novo depois de cada área, sem confiar no relatório de quem a executou. Ajustar `UI_DIR` e `TOKENS` ao projeto.

```
#!/usr/bin/env bash
# Verificador da limpeza visual. Uso: scripts/limpeza-visual/verificar.sh [--build] [caminho ...]
# Sem caminho, verifica src/. Sai com 1 se houver violação. Ajustar as três variáveis abaixo ao projeto.
# Com --texto, também falha com travessão (— –), barra vertical separando texto e aspas curvas (“ ” ‘ ’). Usar na Fase 3 e na entrega final.
# Fora do alcance de script (conferir na revisão): card dentro de card, ícone decorativo,
# mais de um botão primário por área, estado repetido na tela, cores dentro de imagens.
UI_DIR="src/components/ui"; TOKENS="src/index.css"; BASE="${BASE:-limpeza-visual-base}"

BUILD=0; TEXTO=0; ALVOS=()
for a in "$@"; do case "$a" in --build) BUILD=1;; --texto) TEXTO=1;; *) ALVOS+=("$a");; esac; done
if [ ${#ALVOS[@]} -eq 0 ]; then ALVOS=(src); for extra in index.html public; do [ -e "$extra" ] && ALVOS+=("$extra"); done; fi
EXCL=(-g "!$UI_DIR/**" -g "!$TOKENS" -g "!src/uikit.tsx")
falhas=0

checa() { # nome, padrão
  local saida; saida=$(rg -nIH "${EXCL[@]}" -e "$2" "${ALVOS[@]}" 2>/dev/null)
  if [ -n "$saida" ]; then
    echo "FALHA: $1 ($(echo "$saida" | wc -l) ocorrências)"; echo "$saida" | head -15; echo
    falhas=$((falhas + 1))
  fi
}

checa "cor direta do framework" '(text|bg|border|ring|fill|stroke|divide|from|to|via|placeholder)-(red|amber|yellow|orange|emerald|green|blue|sky|purple|indigo|violet|rose|teal|slate|gray|zinc|neutral|stone|cyan|pink|lime|fuchsia)-[0-9]+'
checa "hex solto" '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b'
checa "gradiente" 'bg-gradient|\bfrom-|\bvia-|\bto-[a-z]'
checa "prefixo dark: em componente" '\bdark:'
checa "raio ou sombra fora dos tokens" 'rounded-(xl|2xl|3xl)|shadow-(sm|md|lg|xl|2xl)\b'
checa "cor em estilo inline" 'style=\{\{[^}]*(color|background|border|fill|stroke|[sS]hadow)'
checa "cor em função (rgb, hsl)" '\brgba?\(|\bhsla?\('
checa "cor nomeada em atributo de SVG" '(fill|stroke)="(red|orange|yellow|green|blue|purple|pink|teal|cyan|indigo|violet|gray|grey|black|white)"'
checa "classe de cor montada por código" '\b(bg|text|border|ring|fill|stroke|from|to)-\$\{'
checa "gradiente ou sombra em CSS ou estilo" '(^|[^-])(linear|radial)-gradient|box-shadow:'
checa "borda e sombra no mesmo elemento" 'className="[^"]*\bborder\b[^"]*\bshadow|className="[^"]*\bshadow[^"]*\bborder\b'
if [ "$TEXTO" = 1 ]; then
  checa "travessão (— ou –)" '[—–]'
  checa "aspas curvas" '[“”‘’]'
  checa "barra vertical como separador de texto" '>[^<>{}|]*[[:alnum:]] [|│¦] [[:alnum:]][^<>{}]*<|(title|placeholder|aria-label|alt|label)="[^"|]*[[:alnum:]] [|│¦] [[:alnum:]][^"]*"|[│¦‖｜]'
fi

# Lógica: o inventário de handlers e chamadas não pode mudar em relação ao commit de partida.
inventario() { # [rev]
  if [ -n "${1:-}" ]; then git grep -hoE 'on[A-Z][A-Za-z]*=\{[^}]*\}|useEffect\(|fetch\(|navigate\(' "$1" -- "${ALVOS[@]}" 2>/dev/null | sort
  else git grep -hoE 'on[A-Z][A-Za-z]*=\{[^}]*\}|useEffect\(|fetch\(|navigate\(' -- "${ALVOS[@]}" 2>/dev/null | sort; fi
}
if git rev-parse -q --verify "$BASE" >/dev/null 2>&1; then
  dif=$(diff <(inventario "$BASE") <(inventario) | head -15)
  if [ -n "$dif" ]; then echo "FALHA: handlers ou chamadas mudaram em relação a $BASE"; echo "$dif"; echo; falhas=$((falhas + 1)); fi
else echo "AVISO: ref $BASE não existe; checagem de lógica ignorada"; fi

[ -f scripts/limpeza-visual/contraste.py ] && { python3 -I scripts/limpeza-visual/contraste.py || falhas=$((falhas + 1)); }
[ "$BUILD" = 1 ] && { npm run build --silent >/dev/null 2>&1 || { echo "FALHA: build"; falhas=$((falhas + 1)); }; }

if [ "$falhas" -eq 0 ]; then echo "OK: nenhuma violação"; exit 0; fi
echo "$falhas checagem(ns) com falha"; exit 1
```

Notas de uso:
- Marcar o commit de partida antes de começar (`git tag limpeza-visual-base`), para a checagem de lógica ter com o que comparar.
- A checagem de lógica compara handlers (`onClick={...}` e similares), `useEffect(`, `fetch(` e `navigate(` com o commit de partida. Arquivo novo com handler novo também falha: justificar no relatório ou mover para fora do escopo.
- Além de classes e hex, o verificador pega cor em estilo inline (`style={{ color... }}`), `rgb()` e `hsl()`, cor nomeada em atributo de SVG, classes de cor montadas por código (`bg-${cor}-500`), gradientes e `box-shadow` em CSS ou estilo, e também varre `index.html` e `public/`. Estilo inline só de layout (largura, transform) não é acusado. Ele não vê cores dentro de imagens (logos, ícones em PNG).
- O hex pode acusar âncoras como `href="#add-user"`. Ajustar o padrão ao projeto em vez de ignorar o aviso.
- `contraste.py` é opcional: o script de contraste da Fase 1 com os pares do DESIGN.md, saindo com 1 se algum falhar.
- Em CSS puro ou outro framework, adaptar os padrões ao stack, mantendo a regra de sair com 1.
- `--texto` liga a checagem de travessão, barra vertical separando texto (em texto de JSX, em title, placeholder, aria-label, alt e label) e aspas curvas. Ela não acusa `|` e `||` do código nem uniões de tipos. Ela olha também comentários de código; ignorar ou trocar essas ocorrências. Projeto que usa essas marcas de propósito (padrão 15) roda sem a flag.
- Testar o script antes de usar: ele deve acusar uma tela antiga, passar em um arquivo limpo e acusar um handler removido. Com `--texto`, deve acusar um arquivo com travessão, outro com barra vertical no texto, outro com aspas curvas, e passar em um arquivo cheio de `||`, `|` e tipos como `A | B`.

### Arquivo de estado
`docs/limpeza-visual/ESTADO.md`, criado na Fase 1 e atualizado ao fim de cada área, é a memória do processo. Se o contexto for resumido ou a sessão cair, nada se perde. Ao iniciar, se o arquivo existir, retomar dele em vez de recomeçar. Entra nos commits de documentação, na mesma pasta do relatório, então sai junto se o usuário excluir a pasta.

```
# Estado da limpeza visual
Fase atual: [A, B, 0, 1, 1b, P, 2, 3, 4]
Branch de integração: limpeza-visual | Commit de partida: [hash] | Tela de referência: [caminho]
Placar inicial: [números] | Placar atual: [números]

| Área | Escopo | Estado | Commit | Placar antes e depois | Observações |
|---|---|---|---|---|---|
| layout global | [arquivos] | pendente, em andamento, concluída ou revertida | [hash] | [n] e [n] | [curtas] |

Matriz de cobertura (uma linha por tela ou estado do inventário):
| Tela ou estado | Papel | Tema | Largura | Situação | Motivo, se não capturada |
|---|---|---|---|---|---|
| modal de cadastro | visitante | claro e escuro | desktop e celular | capturada, não capturada ou impossível | [curto] |

Decisões: [lista, uma linha cada]
Dúvidas mantidas: [lista]
Pendências: [lista]
Última atualização: [data e hora]
```

### Cartão de regras
Resumo de no máximo 12 linhas, gerado do DESIGN.md, com as regras que mais escapam. Vai no briefing de cada área e é relido antes de commitar. Padrão, a adaptar ao arquétipo escolhido:
- Nunca card dentro de card; borda ou sombra, nunca as duas.
- Ícone só em ação, navegação e status, monocromático, sem caixa colorida.
- Um botão primário por área. Cor de destaque só em ação principal, estado ativo e progresso.
- Cada estado uma vez por tela. Badge só para estado real.
- Sem texto promocional dentro de painel. No máximo uma linha de apoio por tela.
- Só tokens e primitivos de components/ui. Sem dark:, hex, cor direta ou gradiente.
- Não mudar lógica, handlers, rotas nem textos neste passe.
- Na dúvida entre informação e decoração: manter e listar.

### Coordenador e contexto novo por área
Na Fase 2, o agente principal só coordena e não edita telas. Para cada área, em sequência:
1. Ler `ESTADO.md` e escolher a próxima área pendente.
2. Disparar um agente novo (subagente) só para essa área, com o briefing abaixo.
3. Quando ele terminar, rodar o verificador sobre o escopo, sem confiar no relatório recebido. Se passar, inspecionar as capturas, commitar na branch de integração e atualizar o `ESTADO.md`.
4. Se falhar, devolver a saída do verificador ao mesmo agente para corrigir, no máximo 2 vezes. Persistindo, reverter a área e registrar a pendência.

Briefing da área (autocontido; o agente novo não vê a conversa):

```
Você vai limpar UMA área de um projeto web. Seu contexto é novo: não assuma nada além disto.
1. Leia docs/limpeza-visual/ESTADO.md, o DESIGN.md (tokens, regras e mapa de migração) e a tela de referência: [caminho].
2. Escopo: [arquivos, no máximo uns 8 ou 400 linhas]. Fora do escopo: todo o resto.
3. Cartão de regras: [as linhas do cartão].
4. Prompt do passe: [prompt da Fase 2 com as notas desta área].
5. Termine só quando `scripts/limpeza-visual/verificar.sh [escopo]` sair com código 0 e as capturas estiverem salvas conforme a seção Capturas e relatório. Se falhar 2 vezes, pare e reporte sem commitar.
6. Reporte: arquivos alterados, saída do verificador, placar antes e depois, dúvidas, pendências e o que não foi verificado.
```

### Cobertura e capturas por estado
O agente só vê o que consegue abrir. Para que nenhuma parte do produto fique de fora sem ninguém saber:
1. Inventário. Na Fase 0, listar todas as telas, modais, menus, estados e papéis, a partir do mapa de telas do SPEC.md, das rotas e da pasta de componentes. Estados que costumam ser esquecidos: modais, menus suspensos, hover e foco, toasts, vazio, carregando, erro, texto muito longo, telas que só aparecem para certos papéis (administrador, moderador) e telas com e sem login.
2. Matriz. O inventário vira a matriz de cobertura do ESTADO.md: cada linha tem situação capturada, não capturada ou impossível, com o motivo. Nenhuma linha pode ficar sem situação.
3. Roteiro de capturas. Descrever cada captura em `docs/limpeza-visual/roteiro.json` e rodar `scripts/limpeza-visual/capturar.cjs`, que abre cada modal e menu, aciona os passos e salva as imagens nos dois temas e nas duas larguras. Quando o app só roda no navegador (dados em localStorage), simular o papel gravando o estado de exemplo antes de abrir a tela (campo `armazenamento`). Usar dados de exemplo, nunca dados reais. O script e o formato do roteiro estão logo abaixo.
4. O que não der para abrir (tela atrás de login ou de dados que não existem no ambiente, componente de terceiros que não renderiza) vira `impossível`, com o motivo, e entra no relatório final como não verificado, com a indicação de onde o usuário deve conferir à mão. Nunca marcar como capturada o que não foi aberto.
5. Porta de cobertura: a área só conclui se as linhas da matriz dentro do escopo dela tiverem situação. A entrega final lista as linhas `não capturada` e `impossível`.

Exemplo de `docs/limpeza-visual/roteiro.json` (`nome` vira o prefixo do arquivo; `acoes` são executadas em ordem: `clicar`, `digitar`, `esperar` por um seletor e `pausa` em milissegundos; `tema.classeEscuro` é a classe que o app usa no tema escuro, ou `tema.localStorage` com a chave e os valores `claro` e `escuro`):

```
{
  "base": "http://localhost:5173",
  "tema": { "classeEscuro": "dark" },
  "capturas": [
    { "nome": "feed", "url": "/" },
    { "nome": "feed-modal-publicar", "url": "/", "acoes": [{ "clicar": "text=Publicar" }, { "esperar": "[role=dialog]" }] },
    { "nome": "painel-admin", "url": "/", "armazenamento": { "app_user": "{\"role\":\"ADMIN\"}" }, "acoes": [{ "clicar": "text=Painel Admin" }] }
  ]
}
```

`scripts/limpeza-visual/capturar.cjs` (`node scripts/limpeza-visual/capturar.cjs [antes|depois] [filtro-de-nome]`):

```
// Captura telas e estados conforme docs/limpeza-visual/roteiro.json.
// Uso: node scripts/limpeza-visual/capturar.cjs [antes|depois] [filtro-de-nome]
// Requer o playwright SEM entrar no package.json (npm i --no-save playwright && npx playwright install chromium) e o app rodando em "base".
// Cada ação espera no máximo 5 s. Sai com 1 se alguma captura falhar ou se a página rolar na horizontal. Gera capturas-resultado.json.
const { chromium } = require('playwright');
const fs = require('node:fs'); const path = require('node:path');
const fase = process.argv[2] || 'depois'; const filtro = process.argv[3] || '';
const cfg = JSON.parse(fs.readFileSync('docs/limpeza-visual/roteiro.json', 'utf8'));
const larguras = { desktop: { width: 1280, height: 800 }, celular: { width: 390, height: 844 } };
const pasta = 'docs/limpeza-visual/capturas'; fs.mkdirSync(pasta, { recursive: true });

(async () => {
  const browser = await chromium.launch(); const resultado = [];
  for (const item of cfg.capturas) {
    if (filtro && !item.nome.includes(filtro)) continue;
    for (const tema of ['claro', 'escuro']) for (const [lnome, viewport] of Object.entries(larguras)) {
      const arquivo = `${item.nome}-${tema}-${lnome}-${fase}.png`;
      const ctx = await browser.newContext({ viewport, colorScheme: tema === 'claro' ? 'light' : 'dark' });
      const t = cfg.tema || {};
      if (t.localStorage) await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [t.localStorage.chave, t.localStorage[tema]]);
      if (item.armazenamento) await ctx.addInitScript(o => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, item.armazenamento);
      const page = await ctx.newPage(); page.setDefaultTimeout(5000);
      try {
        await page.goto(cfg.base + item.url, { waitUntil: 'networkidle' });
        if (t.classeEscuro && tema === 'escuro') await page.evaluate(k => document.documentElement.classList.add(k), t.classeEscuro);
        for (const a of item.acoes || []) {
          if (a.clicar) await page.click(a.clicar);
          if (a.digitar) await page.fill(a.digitar.seletor, a.digitar.texto);
          if (a.esperar) await page.waitForSelector(a.esperar);
          if (a.pausa) await page.waitForTimeout(a.pausa);
        }
        const rolagemHorizontal = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        await page.screenshot({ path: path.join(pasta, arquivo), fullPage: !!item.paginaInteira });
        resultado.push({ arquivo, ok: !rolagemHorizontal, motivo: rolagemHorizontal ? 'rolagem horizontal' : '' });
      } catch (e) { resultado.push({ arquivo, ok: false, motivo: String(e.message).split('\n')[0] }); }
      await ctx.close();
    }
  }
  await browser.close();
  fs.writeFileSync('docs/limpeza-visual/capturas-resultado.json', JSON.stringify(resultado, null, 2));
  console.table(resultado);
  process.exit(resultado.every(r => r.ok) ? 0 : 1);
})();
```

Notas de uso:
- Instalar o Playwright sem alterar o `package.json` (`npm i --no-save playwright` e `npx playwright install chromium`), porque dependência nova exige aprovação. Se não der para instalar ou o app não subir, tudo vira `impossível` na matriz, com o motivo.
- Cada ação espera no máximo 5 segundos. Uma ação que não acha o seletor registra a captura como falha com o motivo, sem travar as outras.
- O resultado fica em `docs/limpeza-visual/capturas-resultado.json`. Cada linha da matriz de cobertura vem desse arquivo: `ok` vira `capturada`; falha ou rolagem horizontal vira `não capturada` até ser corrigida ou justificada.
- A aplicação do tema escuro, o estado do modal e o preenchimento dos campos devem ser conferidos olhando ao menos uma imagem gerada.
- Testar o script antes de usar: com uma ação de seletor inexistente, ele deve terminar em segundos e sair com código 1.

### Revisor independente
Para áreas de maior alcance (layout global, home, listagens) e para a página-piloto, um agente novo recebe só o diff, o DESIGN.md e o cartão de regras, e lista as violações com arquivo e linha, incluindo o que o script não detecta (card dentro de card, ícone decorativo, estado repetido). Ele não viu o trabalho ser feito, então não herda os vícios de quem o executou. Uma rodada de correção por área.

### Sem subagentes
Se o ambiente não permitir agentes separados, o mesmo agente segue, com estas compensações: gravar o `ESTADO.md` e commitar a cada área; a cada 3 áreas, ou quando a sessão ficar longa, reler SKILL.md, DESIGN.md e o cartão de regras antes de continuar; rodar o verificador a cada área sem exceção. Se o usuário estiver presente e o ambiente permitir, sugerir encerrar e retomar em uma sessão nova com o pedido "continue a limpeza visual a partir de docs/limpeza-visual/ESTADO.md".

## Capturas e relatório
As capturas ficam no repositório, junto do relatório, e o usuário decide se mantém ou exclui.
- Pasta: `docs/limpeza-visual/` na branch de integração, com `RELATORIO.md` e `capturas/`. O relatório linka as imagens por caminho relativo. Nada fora dessa pasta aponta para ela (DESIGN.md, SPEC.md e README não a referenciam), para que apagá-la não quebre nada. A descrição do pull request repete o resumo com links.
- Nomes: `<area>-<tema>-<largura>-<antes|depois>.png`, com tema `claro` ou `escuro` e largura `desktop` ou `celular`. O piloto usa o prefixo `piloto-` e o UiKit `uikit-<tema>.png`.
- Peso: comprimir (PNG otimizado ou WebP), largura máxima de uns 1280 px, de preferência até uns 300 KB por arquivo e no máximo uns 60 arquivos. Acima disso, priorizar as telas principais e dizer no relatório o que ficou de fora.
- Commits próprios: capturas e relatório entram em commits separados dos de código (ex.: "docs: capturas e relatório da limpeza visual"), para poderem ser removidos ou revertidos sem tocar no código.
- Dados pessoais: antes de commitar, inspecionar as capturas atrás de dados reais (e-mails, nomes, telefones, tokens na tela). Havendo, usar dados de exemplo ou desfocar. Se não der, não commitar a captura e dizer no relatório.
- Manter ou excluir é decisão do usuário. O agente não apaga sozinho. O relatório traz o comando pronto: `git rm -r docs/limpeza-visual && git commit -m "docs: remove capturas da limpeza visual"`, e o agente apaga se o usuário pedir. As imagens continuam no histórico do git. Só reescrever o histórico se o usuário pedir expressamente.
- Sem navegador ou com o app sem rodar: não há capturas. A pasta leva só o `RELATORIO.md`, que diz isso e traz os comandos para o usuário abrir as telas.

## Armadilhas já vistas
- O agente migra páginas durante a fundação: repetir 'não migrar nenhuma página nesta tarefa'.
- O tema claro só quebra quando alguém olha: tokens incompletos, text-white fixo, hex em áreas como o admin.
- Correção de acentos quebrando lógica quando a string era chave ou comparação.
- Gráficos ilegíveis no tema claro porque a biblioteca não lê classes CSS.
- Remoção de bloco que era informação (badges de estado, resumos): sempre listar como dúvida.
- Destaque e erro com a mesma cor: o destructive fica idêntico ao primário.
- Nomes de token no spec diferentes dos do código: o próximo agente cria tokens duplicados.
- Pedir tudo de uma vez: diff impossível de revisar.
- Tokens definidos e sem uso nos componentes: documento e código divergem sem ninguém notar. Medir a adoção na auditoria.
- Documento e código com cores diferentes (ex.: índigo no documento, teal no código): perguntar qual vale.
- Placar que ignora slate, gray, zinc, neutral e stone: subestima o problema. No ripgrep, `-h` é ajuda e `-I` omite o nome do arquivo.
- Estilos globais alterados na fundação: todas as telas mudam sem revisão.
- Regras de superfície copiadas de outra referência (o "sem card" do YouTube aplicado a um feed estilo Facebook).
- Cor escolhida de cabeça: o azul de link sobre fundo tonal escuro falhou em contraste até ser calculado.
- Promessa legal ou de privacidade no texto sem código por trás: reportar, não apagar nem ignorar.
- Achado de segurança fora do escopo: reportar à parte, sem corrigir sem pedido.
- Dependência nova (Radix, CVA, clsx) sem aprovação.
- Verificação visual não feita e não declarada.
- Aplicar no projeto todo sem provar em uma página: o erro de regra ou de token aparece em todas as telas de uma vez.
- Ajustar só a página-piloto quando o problema é do token ou do componente: a próxima tela repete o defeito.
- Prévia descrita sem ter sido vista: se não deu para abrir a página, dizer e entregar o comando para o usuário abrir.
- Pedir confirmação a cada tela: o processo fica repetitivo e o usuário deixa de ler. Depois do piloto, as portas automáticas decidem.
- Autonomia sem porta de qualidade: seguir adiante depois de um passe que falhou no build ou no placar. Reverter a área e registrar.
- Decidir sozinho uma dúvida removendo o bloco: na dúvida, manter e listar no relatório final.
- Merge direto na branch principal: a entrega é sempre um pull request ou uma branch para revisão.
- Capturas misturadas aos commits de código, ou linkadas a partir de outros documentos: apagar a pasta depois quebra links e mexe no código.
- Capturas com dados pessoais reais commitadas no repositório.
- Sessão longa sem estado em disco: o contexto é resumido, o agente esquece decisões e regras. Gravar o ESTADO.md a cada área.
- Conferir as regras de cabeça: o agente diz que passou e não passou. Quem decide é o script verificador, rodado pelo coordenador.
- Um agente só para o projeto inteiro: o contexto enche e o drift começa. Um agente novo por área, com briefing autocontido.
- Verificador que nunca foi testado: ele passa tudo e dá falsa segurança. Testar contra uma tela antiga e um arquivo limpo antes de usar.
- Capturar só a tela principal: modais, menus, estados vazios, de erro e telas por papel escapam sem ninguém perceber. Inventário e matriz de cobertura.
- Marcar como capturado o que não foi aberto: a lista de "não verificado" no relatório é o que protege o usuário.
- Verificador que só olha classes: estilo inline, rgb(), SVG e classes montadas por código passam. Ampliar os padrões e varrer index.html e public/.
- Fonte escolhida por moda e não pela referência: a interface parece de IA mesmo com tokens e componentes certos. Decidir a fonte no DESIGN.md, contra a referência.
- Julgar jargão sozinho e em silêncio: trocar termos sem glossário aprovado muda o sentido do produto. Glossário aprovado, o que sobrar vai para a lista de dúvidas.
- Trocar o termo técnico em nome de variável, rota ou chave: a busca por termo só vale para texto exibido, revisada ocorrência por ocorrência.
- Reescrever texto de interface acrescentando promessa que o produto não cumpre ("100% seguro", "em conformidade com a LGPD"): cada afirmação precisa de evidência no código.
- Trocar uma expressão de IA por outra: "poderoso" vira "completo". Dizer o que a coisa faz em vez de adjetivar.
- Texto novo maior que o antigo: quebra botão e menu no celular. Conferir nas capturas.
