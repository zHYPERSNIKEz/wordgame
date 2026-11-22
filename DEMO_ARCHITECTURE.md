# Arquitetura e Adaptação Standalone para Vercel — `word-game-app` (Modo Demonstração)

Este documento consolida a análise completa da arquitetura original do `word-game-app`, o mapeamento de suas dependências externas e as adaptações implementadas para execução **100% standalone no navegador** (sem banco de dados, servidor Express ou credenciais OAuth externos) com deploy estático na **Vercel**.

---

## 1. Visão Geral da Arquitetura Original

O projeto segue um monorepo full-stack TypeScript organizado em três camadas principais:

### 1.1 Frontend SPA (`client/`)
- **Stack**: React 19, Vite 7, TailwindCSS v4 (`@tailwindcss/vite`), Wouter (`wouter@3.7.1` com patch `patches/wouter@3.7.1.patch` que registra rotas em `window.__WOUTER_ROUTES__`), shadcn/ui (Radix UI), Recharts, TanStack Query (`@tanstack/react-query`) e tRPC v11 (`@trpc/client` + `@trpc/react-query` + `superjson`).
- **Rotas definidas em `client/src/App.tsx`**:
  - `/` (`Home`)
  - `/register` (`RegisterPage`)
  - `/login` (`LoginPage`)
  - `/game` (`GamePage`)
  - `/history` (`HistoryPage`)
  - `/admin` (`AdminDashboardPage`)
  - `/404` e fallback (`NotFound`)

### 1.2 Camada Compartilhada (`shared/`)
- `shared/const.ts`: Constantes de sessão/erros (`COOKIE_NAME`, `ONE_YEAR_MS`, `UNAUTHED_ERR_MSG`, `NOT_ADMIN_ERR_MSG`).
- `shared/_core/errors.ts`: Helpers de erro HTTP compartilhados.
- `shared/types.ts`: Re-exporta tipos inferidos de `drizzle/schema.ts`.
- `shared/questionGenerator.ts`: Gerador puro em TypeScript (sem APIs Node.js) das questões de português.

### 1.3 Backend Express + Drizzle (`server/` e `drizzle/`)
- **Servidor HTTP (`server/_core/index.ts`)**: Express servindo `/manus-storage/*` (`storageProxy.ts`), `/api/oauth/callback` (`oauth.ts`), `/api/trpc` (`createExpressMiddleware`) e arquivos estáticos/Vite (`vite.ts`).
- **Schema Drizzle MySQL (`drizzle/schema.ts`) — 6 tabelas reais**:
  1. `users` (`id`, `openId`, `name`, `email`, `passwordHash`, `loginMethod`, `role`: `'user' | 'admin' | 'moderator'`, `age`, `school`, `classId`, timestamps)
  2. `classes` (`id`, `name`, `teacherId`, `inviteCode`, timestamps)
  3. `game_sessions` (`id`, `userId`, `difficulty`: `'easy' | 'medium' | 'hard'`, `startedAt`, `endedAt`, `totalScore`, `totalAnswers`, `correctAnswers`, `incorrectAnswers`, `durationSeconds`, `isCompleted`, `createdAt`)
  4. `game_answers` (`id`, `sessionId`, `userId`, `word`, `questionType`, `question`, `difficulty`, `correctOption`, `option1..option4`, `userSelectedOption`, `isCorrect`, `pointsEarned`, `timeSpentSeconds`, `createdAt`)
  5. `user_stats` (`id`, `userId`, `totalSessions`, `totalScore`, `totalAnswers`, `correctAnswers`, `incorrectAnswers`, `averageAccuracy`, `totalPlayTimeSeconds`, `averageSessionDuration`, `updatedAt`)
  6. `admin_metrics` (`id`, `metricType`, `metricKey`, `metricValue`, `userCount`, `sessionCount`, `updatedAt`)
- **API tRPC (`server/routers.ts` + `server/_core/systemRouter.ts`) — 20 procedures em 6 routers**:
  - `system`: `health` (public query), `notifyOwner` (admin mutation)
  - `auth`: `me` (public query), `register` (public mutation), `login` (public mutation), `logout` (public mutation)
  - `game`: `startSession` (protected mutation), `getSession` (protected query), `getQuestion` (protected mutation), `submitAnswer` (protected mutation), `endSession` (protected mutation), `getHistory` (protected query), `getSessionDetails` (protected query)
  - `user`: `updateProfile` (protected mutation)
  - `teacher`: `createClass` (moderator/admin mutation), `getMyClasses` (moderator/admin query), `getClassStudents` (moderator/admin query)
  - `admin`: `getMetrics` (moderator/admin query), `getAllUsers` (admin query), `promoteToModerator` (admin mutation)
- **Observação sobre `server/dictionary.ts`**: Embora exista um módulo `server/dictionary.ts` integrando `FreeDictionaryAPI`, ele **não é importado por nenhum arquivo** em `server/` ou `client/`. O fluxo real de jogo utiliza exclusivamente o banco local de 20 palavras em português e 5 tipos de questão (`syllables`, `grammar`, `meaning`, `accent`, `gender`) com 3 níveis de dificuldade (`easy`: 10 pts, `medium`: 20 pts, `hard`: 30 pts).

---

## 2. Dependências Externas e Pontos de Acoplamento Mapeados

1. **Banco de Dados MySQL/TiDB (`DATABASE_URL`)**:
   - Exigido por `server/db.ts` (`drizzle-orm/mysql2`) e `drizzle.config.ts`. Sem `DATABASE_URL`, chamadas ao banco no servidor lançam erro `"Database not available"`.
2. **Autenticação OAuth Manus & JWT (`OAUTH_SERVER_URL`, `VITE_OAUTH_PORTAL_URL`, `VITE_APP_ID`, `JWT_SECRET`, `OWNER_OPEN_ID`)**:
   - No backend: `server/_core/oauth.ts`, `sdk.ts`, `env.ts`, cookies `app_session_id` via `jose`.
   - No frontend:
     - `client/src/const.ts` executava `new URL(\`${oauthPortalUrl}/app-auth\`)`, lançando `TypeError: Invalid URL` quando `VITE_OAUTH_PORTAL_URL` estava indefinido.
     - `client/src/_core/hooks/useAuth.ts` usava `redirectPath = getLoginUrl()` como padrão e gravava `JSON.stringify(meQuery.data)` sem tratamento de `undefined`/erro.
     - `client/src/main.tsx` direcionava `trpcClient` exclusivamente para `/api/trpc` via `httpBatchLink` e redirecionava erros `UNAUTHORIZED` para `getLoginUrl()`.
3. **Analytics & Plugins Vite**:
   - `client/index.html` continha `<script defer src="%VITE_ANALYTICS_ENDPOINT%/umami" ...>`, gerando requisições quebradas quando `VITE_ANALYTICS_ENDPOINT` não estava definido.
   - `vite.config.ts` inclui `vitePluginManusDebugCollector` (desativado automaticamente em `NODE_ENV=production`) e `vite-plugin-manus-runtime`.
4. **Storage / Forge Proxy (`BUILT_IN_FORGE_API_URL`, `BUILT_IN_FORGE_API_KEY`, `VITE_FRONTEND_FORGE_API_*`)**:
   - `server/_core/storageProxy.ts` e `notification.ts` dependem de credenciais Forge; no frontend, `client/src/components/Map.tsx` não é montado em nenhuma rota da aplicação.

---

## 3. Arquitetura Standalone no Navegador (Modo Demonstração)

Para rodar integralmente na Vercel como SPA estática sem backend nem banco externo, o cliente opera por padrão em **modo demonstração local** (ativado sempre que `import.meta.env.VITE_USE_BACKEND !== "true"`):

### 3.1 Gerador de Questões Compartilhado (`shared/questionGenerator.ts`)
- Movido para `shared/questionGenerator.ts` sem dependências Node.js, com re-exportação em `server/questionGenerator.ts` para manter compatibilidade integral com o servidor e testes.
- Exporta `QuestionType`, `Difficulty`, `Question`, `generateQuestion`, `calculatePoints` e `getPointsForDifficulty`.
- Correções aplicadas:
  - `countSyllables`: inclusão de `ã`, `õ`, `à` na regex vocálica (ex.: `"maçã"` agora contabiliza 2 sílabas).
  - `generateSyllableQuestion`: geração segura de 4 distratores únicos mesmo quando `correctSyllables <= 1`.
  - `getAccentPosition` e `generateAccentQuestion`: correção de ramo morto/tautologia na classificação da sílaba tônica (`"última" | "penúltima" | "antepenúltima" | "primeira"`) e garantia de 4 opções distintas com `correctOption` em `1..4`.

### 3.2 Repositório Local em `localStorage` (`client/src/lib/demoStore.ts`)
- Persiste o estado completo na chave `wordgame_demo_state_v1`, com fallback em memória caso `localStorage` esteja restrito/cheio e recuperação automática de JSON corrompido.
- **Seed determinístico (`createSeedState()` via PRNG Mulberry32)**:
  - **Contas de demonstração** (senha padrão `"demo123"`):
    - **Aluno (`role: "user"`)**: `aluno@demo.com` / `demo123`
    - **Professor / Moderador (`role: "moderator"`)**: `professor@demo.com` / `demo123`
    - **Administrador (`role: "admin"`)**: `admin@demo.com` / `demo123`
  - **2 turmas iniciais** (`PORT6A`, `LIT202`) vinculadas ao professor demo.
  - **35 alunos de exemplo** distribuídos pelas 5 faixas etárias (`5-12`, `13-17`, `18-24`, `25-34`, `35+`) e 5 escolas, com sessões concluídas, respostas detalhadas e estatísticas (`averageAccuracy` padronizado na escala percentual `0..100`).
- Mantém `currentUserId` persistido entre recarregamentos até `logout()` ou `resetDemoData()`.
- Protege `endSession` contra divisão por zero quando `totalAnswers === 0`, evitando `NaN` nas métricas.

### 3.3 Transporte tRPC In-Browser (`client/src/lib/demoTrpcLink.ts`)
- Implementa `createDemoTrpcLink(): TRPCLink<AppRouter>` compatível com `@trpc/client` v11 e `@trpc/server/observable`.
- Despacha todas as **20 procedures** de `AppRouter` localmente contra `demoStore`, validando entradas com Zod, aplicando guards de autenticação e papel (`UNAUTHORIZED` com `UNAUTHED_ERR_MSG`, `FORBIDDEN` com `NOT_ADMIN_ERR_MSG`, `BAD_REQUEST`, `CONFLICT`, `NOT_FOUND`) e retornando objetos com instâncias reais de `Date` (sem depender de `superjson` sobre HTTP).
- Em `client/src/main.tsx`, `createDemoTrpcLink()` é selecionado por padrão quando `import.meta.env.VITE_USE_BACKEND !== "true"`; definindo `VITE_USE_BACKEND="true"`, o cliente volta a usar `httpBatchLink` em `/api/trpc`.

### 3.4 Desacoplamento de OAuth, Redirecionamentos e Analytics
- `client/src/const.ts`: `getLoginUrl()` retorna `"/login"` com segurança quando variáveis OAuth estão ausentes ou o backend não está habilitado.
- `client/src/_core/hooks/useAuth.ts`: `redirectPath` padronizado para `"/login"` e gravação protegida em `localStorage`.
- `client/src/main.tsx`: `redirectToLoginIfUnauthorized` evita loops de redirecionamento em `/login` e `/register`.
- `client/index.html`: removida a tag `<script>` com `%VITE_ANALYTICS_ENDPOINT%/umami`.

### 3.5 Configuração de Deploy na Vercel (`vercel.json` e `package.json`)
- `package.json`: script `"build:client": "vite build"` gera os artefatos estáticos em `dist/public`.
- `vercel.json`:
  - `"buildCommand": "pnpm run build:client"`
  - `"outputDirectory": "dist/public"`
  - `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` — garante que recarregamentos diretos em `/game`, `/history`, `/admin`, `/login` e `/register` sejam servidos pela SPA sem erro 404.
