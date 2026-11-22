# 📝 Plano de Testes — WordGame (Modo Demonstração & Full-Stack)

Roteiro prático para validar o funcionamento completo do **WordGame** localmente ou após o deploy na **Vercel**.

---

## 1. Verificações Automatizadas (Terminal)

Na raiz do projeto, execute:

- [x] **Checagem de Tipagem (`pnpm check`)**
  *Valida que todo o código TypeScript (`client`, `shared` e `server`) compila sem erros.*
- [x] **Suíte de Testes (`pnpm test`)**
  *Executa as 6 suítes Vitest (32 testes) cobrindo modo demonstração standalone, autenticação, jogo, segurança/RBAC e turmas.*
- [x] **Build de Produção para a Vercel (`pnpm build:client`)**
  *Gera os arquivos estáticos da SPA em `dist/public`.*

---

## 2. Testes Manuais no Navegador (`npm run dev` ou URL da Vercel)

Inicie o projeto com `npm run dev` (disponível em `http://localhost:3000`) ou abra a URL publicada na Vercel:

### 🏠 Página Inicial (`/`)
- [x] Verificar a exibição do banner **"Modo Demonstração (Portfólio)"**.
- [x] Testar o botão **"Resetar Dados Demo"** e confirmar a notificação de restauração dos dados iniciais.

### 🔐 Acesso Rápido em 1 Clique e Cadastro (`/login` e `/register`)
- [x] Em `/login`, testar os 3 botões de **Acesso Rápido (1 Clique)**:
  - **Aluno Demo** (`aluno@demo.com` / `demo123`) → redireciona para `/game`.
  - **Professor Demo** (`professor@demo.com` / `demo123`) → redireciona para `/admin`.
  - **Admin Demo** (`admin@demo.com` / `demo123`) → redireciona para `/admin`.
- [x] Em `/register`, criar uma nova conta preenchendo o código de turma opcional `PORT6A` e fazer login com ela.

### 🎮 Gameplay (`/game`)
- [x] Clicar em **"Começar Jogo"** e escolher um nível de dificuldade (**Fácil**, **Médio** ou **Difícil**).
- [x] Selecionar uma das 4 alternativas e clicar em **"Responder"** (verificar feedback de acerto/erro e atualização da pontuação).
- [x] Clicar em **"Finalizar Sessão"** e confirmar o redirecionamento para `/history`.

### 📊 Histórico e Detalhes (`/history`)
- [x] Conferir os cards de estatísticas (Sessões, Pontuação Total, Acurácia e Respostas).
- [x] Clicar em **"Ver Detalhes"** em uma sessão para abrir o modal com todas as perguntas respondidas.

### 👩‍🏫 Painel do Professor e Dashboard Admin (`/admin`)
- [x] Logado como **Professor Demo** ou **Admin Demo**, criar uma nova turma e copiar o código de convite gerado.
- [x] Clicar em **"Ver Alunos"** na turma `PORT6A` para visualizar a lista de estudantes matriculados.
- [x] Verificar o gráfico **Atividade por Faixa Etária** e as tabelas **Escolas Mais Ativas** e **Desempenho de Pontuação por Faixa Etária**.
- [x] Logado como **Admin Demo**, promover um usuário comum a **Professor** na seção **"Gerenciar Professores e Usuários"**.
