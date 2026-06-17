# Guia de Testes do Sistema

Este documento descreve como executar e validar as funcionalidades de segurança, autenticação e o sistema de turmas (EdTech).

## Pré-requisitos
Certifique-se de que as dependências estão instaladas:
```bash
pnpm install # ou npm install
```

## Executando os Testes

Você pode executar todos os testes relacionados às mudanças recentes com o comando:

```bash
npx vitest run server/auth.test.ts server/security.test.ts server/teacher.test.ts
```

### O que cada teste valida:

1.  **`server/auth.test.ts`**:
    *   Registro de novos usuários.
    *   Login e autenticação por senha.
    *   Validação de campos obrigatórios.

2.  **`server/security.test.ts`**:
    *   **RBAC**: Garante que usuários comuns não acessem painéis administrativos.
    *   **Moderadores**: Valida que moderadores (professores) acessam métricas, mas não funções de admin.
    *   **Propriedade**: Garante que um usuário não consiga ver sessões de jogo de outro usuário.
    *   **SQL Injection**: Valida a sanitização básica de inputs.

3.  **`server/teacher.test.ts`** (Novo):
    *   **Promoção**: Valida o fluxo de transformar um usuário em Moderador/Professor.
    *   **Turmas**: Criação de turmas e geração de códigos de convite únicos.
    *   **Vínculo**: Valida se o aluno é associado à turma correta ao usar um código no registro.
    *   **Privacidade**: Garante que um professor não veja dados de alunos de outros professores.

## Comandos Úteis

*   `npm test`: Executa todos os testes do projeto.
*   `npx vitest watch`: Executa os testes em modo de observação (re-executa ao salvar arquivos).
*   `npx vitest run --coverage`: Gera relatório de cobertura de código.
