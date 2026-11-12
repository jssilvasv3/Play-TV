# Segredos e Autenticação — Play TV

Este documento explica como gerenciar segredos (senhas, tokens, chaves) do **Play TV** no Cloudflare Pages e nas funções associadas.

---

## 1. Onde os segredos vivem

| Ambiente | Comando | Exemplo |
|----------|---------|---------|
| **Cloudflare Pages** (recomendado) | `wrangler pages secret put <CHAVE>` | `wrangler pages secret put ADMIN_SECRET --project-name play-tv` |
| **Cloudflare Worker** (se usado) | `wrangler secret put <CHAVE>` | `wrangler secret put ADMIN_SECRET` |
| **Local (desenvolvimento)** | Arquivo `.dev.vars` | `ADMIN_SECRET=sua-senha` |

> ⚠️ **Nunca** coloque segredos em:
> - `wrangler.toml` (fica em texto plano no repositório)
> - `app.js`, `admin.html`, `server.js` ou qualquer arquivo de código
> - Comentários no Git
> - `.env` commits

---

## 2. Segredos do Play TV

Estes são os segredos utilizados pelo sistema:

| Chave | Uso | Comando |
|-------|-----|---------|
| `ADMIN_SECRET` | Chave secreta do painel admin | `wrangler pages secret put ADMIN_SECRET --project-name play-tv` |
| `ADMIN_PASSWORD` | Senha de login do admin | `wrangler pages secret put ADMIN_PASSWORD --project-name play-tv` |
| `HMAC_SECRET` | Assinatura HMAC para tokens | `wrangler pages secret put HMAC_SECRET --project-name play-tv` |
| `VALID_PASS` | Validação de credenciais | `wrangler pages secret put VALID_PASS --project-name play-tv` |

---

## 3. Como gerenciar

### 3.1. Adicionar ou atualizar um segredo

```bash
# No Pages (projeto play-tv)
npx wrangler pages secret put ADMIN_SECRET --project-name play-tv

# No Worker (projeto play-tv-proxy)
npx wrangler secret put ADMIN_SECRET
```

O comando pede o valor interativamente (não fica no histórico do shell).

### 3.2. Listar segredos existentes

```bash
# Pages
npx wrangler pages secret list --project-name play-tv

# Worker
npx wrangler secret list
```

### 3.3. Remover um segredo

```bash
npx wrangler pages secret delete ADMIN_SECRET --project-name play-tv
```

---

## 4. Desenvolvimento local

Crie um arquivo `.dev.vars` (não commitado) com os mesmos nomes:

```env
ADMIN_SECRET=sua-senha-local
ADMIN_PASSWORD=sua-senha-local
HMAC_SECRET=sua-senha-local
VALID_PASS=sua-senha-local
```

Adicione `.dev.vars` ao `.gitignore`:

```
# .gitignore
.dev.vars
.env
*.pem
```

---

## 5. Segurança

- **Gere senhas fortes**: use `openssl rand -hex 32` ou um gerenciador de senhas.
- **Nunca faça commit** de segredos — o repositório é público.
- **Rotacione segredos** se suspeitar de exposição: `wrangler pages secret put <CHAVE>` com um novo valor.
- **Use variáveis de ambiente** do Cloudflare (Pages Secrets / Worker Secrets) em vez de hardcode.

---

## 6. Deploy

O `wrangler.toml` atual contém apenas configurações seguras:

```toml
name = "play-tv-proxy"
compatibility_date = "2026-09-14"
pages_build_output_dir = "."
```

Os segredos são injetados via Cloudflare, não via arquivo.

---

## 7. Comandos úteis

```bash
# Deploy Pages
npx wrangler pages deploy . --project-name play-tv --branch production

# Deploy Worker (se necessário)
npx wrangler deploy

# Ver segredos do Pages
npx wrangler pages secret list --project-name play-tv
```

---

*Documentação gerada automaticamente — mantenha atualizada.*