# Design

> Sistema visual de **[Nome do projeto]**. Leia antes de criar ou alterar qualquer tela. Em conflito visual com o PRODUCT.md ou o SPEC.md, este arquivo vale.
>
> Modelo da skill limpeza-visual-ia. Troque cada `A definir:` por um valor confirmado e apague estas instruções.

Sumário: [1. Princípio](#1-princípio) · [2. Referência](#2-referência) · [3. Tokens](#3-tokens) · [4. Regras](#4-regras) · [5. Componentes](#5-componentes) · [6. Padrões de tela](#6-padrões-de-tela) · [7. Acessibilidade](#7-acessibilidade) · [8. Temas](#8-temas) · [9. Como contribuir com UI](#9-como-contribuir-com-ui)

## 1. Princípio

O conteúdo (`A definir:` vídeo, dado, texto) é o elemento visual. A interface em volta é neutra, densa e silenciosa. A hierarquia vem de tamanho, peso e espaço, nunca de cor, caixa ou ícone.

## 2. Referência

- Produto de referência: `A definir:` (ex.: YouTube, Linear, Stripe docs, Notion).
- Usado como inspiração de estrutura e proporção. Não copiar marca, logotipo nem ícones proprietários.
- O que adotamos: `A definir:` (lista curta, ex.: item de conteúdo sem caixa, chips em pílula, abas com sublinhado).
- O que não adotamos: `A definir:`.

## 3. Tokens

Definidos em `A definir:` (ex.: `src/index.css` e `tailwind.config.js`). Componentes usam classes semânticas, nunca valores soltos.

| Token | Classe | Claro | Escuro | Uso |
|---|---|---|---|---|
| canvas | `bg-canvas` | `A definir:` | `A definir:` | Fundo da página |
| surface | `bg-surface` | `A definir:` | `A definir:` | Painéis, modais, formulários |
| elevated | `bg-elevated` | `A definir:` | `A definir:` | Chips, hover, trilho de progresso |
| divider | `border-divider` | `A definir:` | `A definir:` | Divisor de 1px |
| content | `text-content` | `A definir:` | `A definir:` | Texto principal |
| content-secondary | `text-content-secondary` | `A definir:` | `A definir:` | Metadados, rótulos, placeholder |
| primary | `bg-primary` | `A definir:` | `A definir:` | Ação principal, estado ativo, progresso |
| status.success | `text-status-success` | `A definir:` | `A definir:` | Sucesso, conectado |
| status.warning | `text-status-warning` | `A definir:` | `A definir:` | Aviso, pendente |
| status.error | `text-status-error` | `A definir:` | `A definir:` | Erro, crítico |

Use os nomes de token que já existem no código. Se o projeto usa outros nomes, troque a tabela por eles.

**Raios:** painel `A definir:` px, campo `A definir:` px, pílula 9999px. Nenhum outro raio.

**Tipografia:** família `A definir:`. Título de página `A definir:` px, título de seção `A definir:` px, corpo `A definir:` px, metadados `A definir:` px. Numerais tabulares em métricas e durações.

**Espaçamento:** escala `A definir:` (ex.: múltiplos de 4px).

## 4. Regras

### 4.1 Superfícies
- Item de conteúdo não usa card: imagem, título e metadados direto sobre o fundo.
- Card ou painel só quando agrupa uma unidade: modal, formulário, tabela, gráfico, item de lista com ações.
- Nunca card dentro de card.
- Borda ou sombra, nunca as duas. Preferir espaçamento; divisor de 1px só quando o espaço não separar o suficiente.
- Cabeçalhos de página e de seção e parágrafos ficam soltos na página, sem caixa.
- Sem texto promocional dentro do painel. No máximo uma linha de apoio por tela.

### 4.2 Cor
- `primary` só em ação principal, estado ativo e progresso. No máximo um botão `primary` por área da tela.
- Cores de estado só aparecem quando o estado existe, com significado fixo (sucesso, aviso, erro). Nunca como enfeite ou categoria.
- Proibido gradiente em qualquer superfície, texto, botão, gráfico ou preenchimento de área.
- Proibido usar cores fora da tabela de tokens.

### 4.3 Ícones
- Monocromáticos, herdando a cor do texto.
- Sem caixa, círculo ou fundo colorido atrás do ícone.
- Sem ícone decorativo ao lado de títulos, rótulos e itens de lista.
- Ícone só em ação (botão), navegação e para substituir texto que não cabe.
- Sem emoji como ícone.

### 4.4 Estado único
- Cada estado do sistema aparece em um único lugar por tela.
- Não resumir em cards o que a navegação da própria tela já mostra.
- Badge só para estado real e variável. Sem badge de marketing ou de plano.

### 4.5 Gráficos
- Linhas de 2px, sem pontos permanentes e sem preenchimento de área.
- Cinzas e `primary`. Cor de estado só quando a série representa um estado.
- Rosca e pizza em tons de cinza, com `primary` na fatia principal.
- As cores vêm dos tokens, lidas em runtime. Nunca fixas na configuração do gráfico.

### 4.6 Texto
- Rótulos em caixa normal, sem caixa alta com espaçamento entre letras.
- Acentuação correta.
- `A definir:` regras de escrita específicas do projeto (ex.: sem travessões).

## 5. Componentes

Toda tela usa os componentes de `A definir:` (ex.: `src/components/ui/`). Não monte botão, chip, aba, badge ou cabeçalho com classes soltas dentro de páginas.

| Componente | Variantes | Use quando | Arquivo |
|---|---|---|---|
| Button | primary, secondary, ghost, destructive | Toda ação clicável | `A definir:` |
| Chip | padrão, ativo | Filtros e categorias | `A definir:` |
| StatusText | sucesso, aviso, erro | Estado real, com ponto de 6px e texto | `A definir:` |
| Tabs | padrão | Navegação entre seções da mesma tela | `A definir:` |
| PageHeader | padrão | Título da página com ações à direita | `A definir:` |
| Stat | padrão | Métrica: rótulo, número, apoio | `A definir:` |
| Section | padrão | Agrupar conteúdo com título, sem caixa | `A definir:` |
| Input, Textarea, Select | padrão, erro, desabilitado | Campos de formulário | `A definir:` |
| Switch | ligado, desligado | Ativar ou pausar algo | `A definir:` |
| Table | padrão | Listas com várias colunas | `A definir:` |
| ProgressBar | 0 a 100 | Progresso de tarefa | `A definir:` |
| Dialog, DropdownMenu | padrão | Modais e menus | `A definir:` |

Notas de uso:
- `destructive` não usa o mesmo preenchimento do `primary`: texto na cor de erro sobre fundo neutro. Preenchimento sólido só no botão de confirmação dentro de um Dialog.
- Falta uma variante? Abra uma issue descrevendo o caso. Não crie variante por conta própria.

## 6. Padrões de tela

- **Item de conteúdo:** imagem com raio de painel, título até 2 linhas, metadados em cinza. Sem caixa.
- **Cabeçalho de página:** `PageHeader`, título à esquerda, no máximo uma ação `primary` à direita.
- **Formulário:** campos com `Input`, `Select` e `Textarea`, rótulo acima, mensagem de erro em texto abaixo do campo.
- **Tabela:** `Table`, sem zebra e sem borda externa, números alinhados e tabulares.
- **Vazio, carregando e erro:** toda lista tem os três estados. Carregando usa skeleton, não spinner solto.

## 7. Acessibilidade

- Contraste de texto de pelo menos 4,5:1 nos dois temas.
- Foco visível por teclado em todo elemento interativo, com o mesmo estilo.
- Alvo de toque de pelo menos 40px.
- Estado nunca depende só de cor: acompanhe de texto ou posição.
- Botão só com ícone tem `aria-label`. Campo tem rótulo associado.
- Respeitar `prefers-reduced-motion`.

## 8. Temas

- Alternância: `A definir:` (classe no `html`, atributo `data-theme` ou preferência do sistema).
- Todo token tem valor nos dois temas. Não use `dark:` nem cores fixas nos componentes.
- Gráficos leem os tokens em runtime e são recriados ao trocar o tema.
- Teste toda tela nos dois temas e em largura de celular antes de abrir o pull request.

## 9. Como contribuir com UI

Checklist para o pull request:

- [ ] Usei só componentes e tokens deste documento.
- [ ] Nenhum hex, gradiente, sombra ou cor direta do framework fora da pasta de componentes.
- [ ] No máximo um botão `primary` por área.
- [ ] Cada estado aparece uma vez na tela.
- [ ] Ícones monocromáticos e só em ação, navegação ou status.
- [ ] Testei nos temas claro e escuro e em largura de celular.
- [ ] Atualizei este documento se criei ou mudei uma regra.

Verificação automática: `A definir:` (comando do script que falha o build, ex.: `npm run check:visual`).

## Apêndice: mapa de migração (remover ao concluir a migração)

Valores soltos encontrados no código e o token que os substitui. Preenchido a partir da auditoria, por frequência.

| Valor encontrado | Ocorrências | Vira |
|---|---|---|
| `A definir:` | | `canvas` |
| `A definir:` | | `surface` |
| `A definir:` | | `elevated` |
| `A definir:` | | `divider` |

Regras para cores fora da paleta: azul de ação vira `primary`. Azul, roxo, rosa e teal decorativos viram `content-secondary`, salvo se representarem estado (aí `status.*`). Verde fora do token vira `status.success`.
