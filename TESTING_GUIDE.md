# Guia de Testes do Sistema — WordGame

Este documento descreve como executar e validar a suíte de testes automatizados (Vitest), a checagem de tipos e a verificação do modo demonstração standalone.

## Pré-requisitos

Certifique-se de que as dependências estão instaladas:

```bash
pnpm install # ou npm install
```

> **Nota:** Nenhuma variável de ambiente ou banco de dados MySQL externo é necessário para rodar os testes.

## Executando os Testes Automatizados

Execute toda a suíte (6 arquivos de teste / 32 testes) com:

```bash
pnpm test
# ou: npx vitest run
```

### O que cada suíte valida:

1. **`server/demo.test.ts`** (Modo Demonstração & Vercel):
   - Configuração de deploy estático e rewrite SPA no `vercel.json`.
   - Login em 1 clique como Aluno (`aluno@demo.com`), partida completa (`startSession`, `getQuestion`, `submitAnswer`, `endSession`), cálculo de pontuação e histórico detalhado (`getHistory`, `getSessionDetails`).
   - Registro de novo aluno com código de turma (`PORT6A`), gestão de turmas pelo Professor (`professor@demo.com`) e promoção de usuários pelo Admin (`admin@demo.com`).

2. **`server/auth.test.ts`**:
   - Hashing de senhas com bcrypt, registro de novos usuários, login e sanitização de perfil público (`toPublicUser`).

3. **`server/auth.logout.test.ts`**:
   - Limpeza de cookie de sessão no logout.

4. **`server/game.test.ts`**:
   - Fluxo de sessão de jogo no roteador do servidor, cálculo de pontuação, atualização de estatísticas e isolamento de sessão entre usuários.

5. **`server/security.test.ts`**:
   - **RBAC**: Bloqueio de usuários comuns em rotas administrativas e restrição de rotas exclusivas de admin para moderadores.
   - **Propriedade de Sessão**: Impede que um usuário acesse ou altere a sessão de jogo de outro usuário (`FORBIDDEN`).
   - **Prevenção de SQL Injection**: Validação de entradas maliciosas no registro.

6. **`server/teacher.test.ts`**:
   - Promoção de usuário para Professor (`moderator`), criação de turmas com códigos de convite, matrícula via `inviteCode` e isolamento de turmas entre professores.

## Comandos de Verificação de Build e Tipagem

- `pnpm check`: Executa `tsc --noEmit` para validar a tipagem de todo o projeto.
- `pnpm build:client`: Gera o bundle estático de produção em `dist/public` (mesmo comando usado pela Vercel).
- `pnpm build`: Gera o build estático do cliente e empacota o servidor Express em `dist/index.js`.
