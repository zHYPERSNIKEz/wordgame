# Documentação de Variáveis de Ambiente — WordGame

## 1. Modo Demonstração Standalone (Padrão — Vercel / Portfólio)

Por padrão, o **WordGame** roda **100% standalone no navegador** usando `demoTrpcLink` e `demoStore` (`localStorage`).

> **Nenhuma variável de ambiente é obrigatória** para executar o projeto localmente (`npm run dev`) ou para publicá-lo na **Vercel** (`pnpm run build:client`).

| Variável | Obrigatória no Modo Demo? | Padrão | Descrição |
|----------|---------------------------|--------|-----------|
| `VITE_USE_BACKEND` | ❌ Não | `false` | Quando omitida ou diferente de `"true"`, ativa o modo demonstração standalone no navegador |

---

## 2. Modo Full-Stack Opcional (Servidor Express + MySQL/TiDB)

Caso deseje conectar o frontend ao backend Express (`/api/trpc`) com banco de dados MySQL/TiDB real, defina `VITE_USE_BACKEND=true` e configure as variáveis abaixo:

| Variável | Obrigatória no Modo Backend? | Descrição | Exemplo |
|----------|------------------------------|-----------|---------|
| `VITE_USE_BACKEND` | ✅ Sim | Direciona o cliente tRPC para `/api/trpc` via HTTP | `true` |
| `DATABASE_URL` | ✅ Sim | String de conexão MySQL/TiDB (se omitida no servidor, `server/db.ts` usa fallback em memória para sessões de jogo) | `mysql://user:pass@localhost:3306/wordgame` |
| `JWT_SECRET` | ✅ Sim | Chave secreta para assinatura de cookies JWT | `chave-secreta-com-pelo-menos-32-caracteres` |
| `PORT` | ❌ Não | Porta do servidor Express local (padrão `3000`) | `3000` |
| `NODE_ENV` | ❌ Não | `development` ou `production` | `production` |

### Variáveis OAuth / Integrações Opcionais (Legado Manus)

Utilizadas apenas quando integrado ao portal OAuth externo:

| Variável | Obrigatória? | Descrição |
|----------|--------------|-----------|
| `VITE_OAUTH_PORTAL_URL` | ❌ Não | URL do portal OAuth externo (se ausente, o app usa a rota local `/login`) |
| `VITE_APP_ID` | ❌ Não | ID da aplicação OAuth |
| `OAUTH_SERVER_URL` | ❌ Não | URL do servidor OAuth no backend |
| `OWNER_OPEN_ID` | ❌ Não | OpenID do proprietário para atribuição automática de role `admin` |
