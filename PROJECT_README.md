# WordGame — Documentação do Projeto

Consulte o [`README.md`](./README.md) principal para instruções rápidas de uso, contas de demonstração e deploy na Vercel, e o [`DEMO_ARCHITECTURE.md`](./DEMO_ARCHITECTURE.md) para o mapeamento técnico completo da arquitetura standalone no navegador.

---

## Resumo dos Modos de Execução

| Modo | Como ativar | Armazenamento | Ideal para |
|------|-------------|---------------|------------|
| **Modo Demonstração Standalone (Padrão)** | Padrão (`VITE_USE_BACKEND` não definido ou `false`) | `localStorage` no navegador (`wordgame_demo_state_v1`) | Portfólio, deploy estático gratuito na Vercel e testes locais imediatos |
| **Modo Full-Stack (Backend Express + MySQL)** | `VITE_USE_BACKEND=true` + `DATABASE_URL` | MySQL / TiDB via Drizzle ORM | Ambiente escolar conectado a banco de dados centralizado |

---

## Contas do Modo Demonstração

| Perfil | Role | Email | Senha | Acesso principal |
|--------|------|-------|-------|------------------|
| **Aluno Demo** | `user` | `aluno@demo.com` | `demo123` | Jogo (`/game`) e Histórico (`/history`) |
| **Professor Demo** | `moderator` | `professor@demo.com` | `demo123` | Gestão de Turmas (`PORT6A`, `LIT202`) e Métricas (`/admin`) |
| **Admin Demo** | `admin` | `admin@demo.com` | `demo123` | Dashboard Completo, Turmas e Promoção de Usuários (`/admin`) |
