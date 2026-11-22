# WordGame — Jogo Educativo de Palavras em Português

Aplicação web interativa (EdTech) para aprendizado de Língua Portuguesa com múltiplos níveis de dificuldade, histórico detalhado de partidas, sistema de turmas para professores e dashboard analítico administrativo.

Projetado para rodar **100% standalone no navegador em Modo Demonstração** (ideal para publicação estática na **Vercel** e demonstração de portfólio, sem exigir banco de dados ou servidor externo) e também compatível com execução full-stack (**Express + tRPC + Drizzle ORM / MySQL**).

---

## ✨ Destaques do Modo Demonstração (Portfólio / Vercel)

- **Zero Configuração Externa**: Roda diretamente no navegador usando um motor tRPC local (`demoTrpcLink` + `demoStore` persistido no `localStorage`). Não requer `DATABASE_URL` nem servidor OAuth para funcionar.
- **Acesso Rápido em 1 Clique (`/login`)**:
  - 👨‍🎓 **Aluno Demo**: `aluno@demo.com` / `demo123`
  - 👩‍🏫 **Professor Demo (Moderador)**: `professor@demo.com` / `demo123`
  - 🛡️ **Admin Demo**: `admin@demo.com` / `demo123`
- **Dados de Exemplo Pré-populados**:
  - **35 alunos** distribuídos em 5 faixas etárias (`5-12`, `13-17`, `18-24`, `25-34`, `35+`) e 5 escolas.
  - **2 turmas ativas** com código de convite (`PORT6A` e `LIT202`) vinculadas ao Professor Demo.
  - Histórico de sessões e respostas detalhadas prontos para exploração.
- **Restauração Instantânea**: Botão **"Resetar Dados Demo"** na página inicial para restaurar o estado original a qualquer momento.

---

## 🎮 Funcionalidades Principais

1. **Jogo de Palavras (`/game`)**
   - 3 níveis de dificuldade: **Fácil** (10 pts), **Médio** (20 pts) e **Difícil** (30 pts).
   - 5 categorias de perguntas sobre palavras da língua portuguesa:
     - Contagem de Sílabas (`syllables`)
     - Classe Gramatical (`grammar`)
     - Significado (`meaning`)
     - Sílaba Tônica / Acentuação (`accent`)
     - Gênero e Número (`gender`)
   - Cronômetro em tempo real, feedback imediato e contabilização automática de acurácia.

2. **Histórico e Detalhes de Sessão (`/history`)**
   - Cards de resumo com total de sessões, pontuação acumulada, acurácia percentual e total de respostas.
   - Modal **"Ver Detalhes"** em cada partida exibindo questão por questão, alternativa escolhida, gabarito, tempo gasto e pontos obtidos.

3. **Painel do Professor e Gestão de Turmas (`/admin`)**
   - Criação de novas turmas com geração automática de código de convite de 6 caracteres.
   - Consulta de alunos matriculados por turma.
   - Vínculo automático de novos alunos que informam o código da turma (`PORT6A`, `LIT202`, etc.) no cadastro (`/register`).

4. **Dashboard Administrativo (`/admin`)**
   - Gráfico de atividade por faixa etária (usuários vs. sessões).
   - Ranking das escolas mais ativas (usuários, sessões, duração média e acurácia).
   - Tabela de desempenho de pontuação por faixa etária (média, máxima, mínima e acurácia).
   - Gestão de usuários com promoção de contas de Aluno para Professor (`Moderador`).

---

## 🏗️ Arquitetura e Stack Tecnológica

- **Frontend**: React 19, TypeScript, Vite 7, TailwindCSS 4, Wouter (rotas SPA), shadcn/ui (Radix UI), Recharts, Sonner.
- **Camada de Dados / API**: TanStack React Query + tRPC 11.
  - **Modo Demo Standalone (Padrão)**: `client/src/lib/demoTrpcLink.ts` intercepta todas as 20 procedures do `AppRouter` no navegador e opera sobre `client/src/lib/demoStore.ts` (`localStorage`).
  - **Modo Full-Stack (Opcional, `VITE_USE_BACKEND=true`)**: `httpBatchLink` apontando para `/api/trpc` no servidor Express + Drizzle ORM (MySQL/TiDB).
- **Testes Automatizados**:
  - **Vitest** (`server/*.test.ts`): 6 suítes / 32 testes cobrindo autenticação, mecânica do jogo, RBAC/segurança, gestão de turmas e modo demonstração standalone.
  - **Runner E2E** (`e2e/run-e2e.mjs`): 71 verificações automatizadas de navegador distribuídas em 4 tiers.

### Estrutura de Pastas

```text
wordgame/
├── client/                      # Aplicação Frontend React (SPA)
│   ├── src/
│   │   ├── pages/               # Home, Auth (Login/Register), Game, History, AdminDashboard
│   │   ├── components/          # Componentes de UI (shadcn/ui)
│   │   ├── lib/
│   │   │   ├── demoStore.ts     # Banco de dados local (localStorage) + seed determinístico
│   │   │   ├── demoTrpcLink.ts  # Interceptador tRPC standalone no navegador
│   │   │   └── trpc.ts          # Hook/cliente tRPC tipado
│   │   └── main.tsx             # Ponto de entrada e seleção automática Demo vs Backend
│   └── index.html
├── shared/                      # Código compartilhado entre cliente e servidor
│   ├── questionGenerator.ts     # Gerador de questões de português (browser & server safe)
│   ├── const.ts                 # Constantes compartilhadas
│   └── types.ts                 # Tipos inferidos do schema
├── server/                      # Backend Express + tRPC + testes Vitest
│   ├── routers.ts               # Definição das 20 procedures do AppRouter
│   ├── db.ts                    # Consultas Drizzle MySQL + fallback em memória
│   ├── auth.ts                  # Hashing bcrypt e validação de usuários
│   └── *.test.ts                # 6 suítes de testes automatizados (Vitest)
├── drizzle/                     # Schema MySQL (users, classes, game_sessions, game_answers, user_stats)
├── e2e/                         # Suíte E2E standalone para verificação do build de produção
├── DEMO_ARCHITECTURE.md         # Documentação técnica detalhada da arquitetura standalone
└── vercel.json                  # Configuração pronta para deploy estático na Vercel
```

---

## 🚀 Como Executar Localmente

Não é necessário configurar banco de dados nem arquivo `.env` para rodar o projeto.

1. **Instalar as dependências**
   ```bash
   pnpm install
   # ou: npm install
   ```

2. **Iniciar o servidor de desenvolvimento**
   ```bash
   npm run dev
   # ou: pnpm dev
   ```

3. **Acessar no navegador**
   - Abra `http://localhost:3000`
   - Use os botões de **Acesso Rápido (1 Clique)** na tela de login (`/login`) ou crie uma nova conta em `/register`.

---

## ☁️ Como Publicar na Vercel (Modo Demonstração)

O repositório já inclui o arquivo [`vercel.json`](./vercel.json) pré-configurado para servir a SPA estática com suporte a recarregamento direto em qualquer rota (`/game`, `/history`, `/admin`, `/login`, `/register`):

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "pnpm run build:client",
  "outputDirectory": "dist/public",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Passo a passo na Vercel:
1. Suba o repositório para o GitHub.
2. Na Vercel, clique em **Add New... → Project** e importe o repositório.
3. Defina o **Project Name** como `wordgame` (para gerar a URL `wordgame.vercel.app`).
4. Clique em **Deploy** (nenhuma variável de ambiente é necessária para o modo demonstração).

---

## 🧪 Verificação e Testes

```bash
# Checagem de tipos TypeScript
pnpm check

# Suíte de testes unitários e de integração (Vitest - 6 suítes / 32 testes)
pnpm test

# Build estático para a Vercel (gera dist/public)
pnpm build:client

# Build completo (frontend + bundle do servidor Express)
pnpm build
```

Para mais detalhes técnicos sobre a arquitetura standalone e as rotas tRPC, consulte [`DEMO_ARCHITECTURE.md`](./DEMO_ARCHITECTURE.md), [`TESTING_GUIDE.md`](./TESTING_GUIDE.md) e [`ENV_DOCUMENTATION.md`](./ENV_DOCUMENTATION.md).

---

## 📄 Licença

MIT
