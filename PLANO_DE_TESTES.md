# 📝 Plano de Testes - Word Game App

Este documento serve como um roteiro passo a passo para verificar se a aplicação está funcionando perfeitamente antes de investigar bugs ou criar novas funcionalidades.

## 1. Testes Automatizados (Base do Código)

Abra o terminal na pasta raiz do projeto e execute os seguintes comandos:

- [ ] **Testes de Lógica (`pnpm test`)**
  *Verifica se o cálculo de senhas, pontuações do jogo e bloqueios de segurança estão funcionando como o esperado.*
- [ ] **Checagem de Tipagem (`pnpm check`)**
  *Garante que os dados enviados do Frontend para o Backend (e vice-versa) estão no formato correto, prevenindo quebras inesperadas.*

## 2. Testes de Banco de Dados e Ambiente

- [ ] **Sincronização (`pnpm db:push` ou `pnpm drizzle-kit migrate`)**
  *Se rodar sem erros, significa que a conexão com o banco (sua `DATABASE_URL` no `.env`) está correta e as tabelas estão prontas.*
- [ ] **Variáveis de Ambiente**
  *Certifique-se de que o seu arquivo `.env` (ou os painéis do Manus) contém as chaves secretas como `JWT_SECRET` e configurações do OAuth.*

## 3. Testes Manuais de Fluxo do Usuário (E2E)

Inicie o servidor de desenvolvimento com `pnpm dev` e abra o aplicativo no navegador (geralmente em `http://localhost:3000`). Faça as seguintes rotas:

### 🔐 Autenticação
- [ ] Criar uma nova conta com todos os dados preenchidos.
- [ ] Fazer logout.
- [ ] Tentar fazer login com uma senha errada (deve exibir erro).
- [ ] Fazer login com sucesso.

### 🎮 Gameplay (Core do App)
- [ ] Iniciar uma sessão de jogo.
- [ ] Verificar se uma palavra, definição e exemplo foram carregados corretamente (testa a integração com a *FreeDictionaryAPI*).
- [ ] Responder a uma pergunta de forma propositalmente errada.
- [ ] Responder a uma pergunta corretamente.
- [ ] Encerrar a sessão e navegar até a página de Histórico para conferir se as estatísticas foram salvas com sucesso.

### 🛡️ Permissões e Segurança
- [ ] Com a conta de usuário comum que você acabou de criar, tentar acessar o painel de administração (`/admin`). **O sistema deve bloquear**.
- [ ] (Opcional) No banco de dados, mudar a "role" do seu usuário para `admin` e tentar acessar `/admin` novamente. Dessa vez, os painéis e gráficos devem aparecer.
