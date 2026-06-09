# Word Game App - Jogo Educativo de Palavras

Uma aplicação web moderna para aprendizado interativo de vocabulário em português, com suporte a múltiplos usuários, rastreamento de progresso e dashboard administrativo.

## 🎯 Visão Geral

O Word Game App é um jogo educativo que apresenta palavras em português com definições e exemplos, permitindo que os usuários adivinhem a palavra correta. A aplicação rastreia pontuação, tempo de sessão e fornece análises detalhadas para administradores.

### Recursos Principais

- ✅ **Autenticação Segura**: Registro e login com email/senha usando bcrypt
- ✅ **Jogo Interativo**: Adivinhe palavras baseado em definições
- ✅ **Rastreamento de Progresso**: Histórico de sessões com estatísticas
- ✅ **Dashboard Admin**: Análises por idade, escola e desempenho
- ✅ **Banco de Dados SQL**: Armazenamento seguro de dados do usuário
- ✅ **API de Dicionário**: Integração com FreeDictionaryAPI para palavras em português
- ✅ **Controle de Acesso**: Roles de admin e usuário com permissões

## 🏗️ Arquitetura

### Stack Tecnológico

- **Frontend**: React 19 + TailwindCSS 4 + Vite
- **Backend**: Node.js + Express + tRPC 11
- **Banco de Dados**: MySQL/TiDB
- **ORM**: Drizzle ORM
- **Autenticação**: Manus OAuth + Email/Senha com bcrypt
- **Testes**: Vitest

### Estrutura de Pastas

```
word-game-app/
├── client/                 # Frontend React
│   ├── src/
│   │   ├── pages/         # Páginas (Home, Auth, Game, History, AdminDashboard)
│   │   ├── components/    # Componentes reutilizáveis
│   │   ├── lib/           # Utilitários (tRPC client)
│   │   └── App.tsx        # Roteamento principal
│   └── index.html         # HTML de entrada
├── server/                # Backend Node.js
│   ├── routers.ts         # Procedimentos tRPC
│   ├── db.ts              # Helpers de banco de dados
│   ├── auth.ts            # Autenticação e hashing
│   ├── dictionary.ts      # Cliente da API de dicionário
│   ├── *.test.ts          # Testes Vitest
│   └── _core/             # Infraestrutura interna
├── drizzle/               # Schema e migrações
│   └── schema.ts          # Definição de tabelas
└── package.json           # Dependências
```

## 🚀 Começando

### Pré-requisitos

- Node.js 22+
- pnpm 10+
- Banco de dados MySQL/TiDB (fornecido pelo Manus)

### Instalação

1. **Instalar dependências**
   ```bash
   pnpm install
   ```

2. **Configurar variáveis de ambiente**
   
   As seguintes variáveis são injetadas automaticamente pelo Manus:
   - `DATABASE_URL`: Conexão MySQL
   - `JWT_SECRET`: Chave para assinatura de sessão
   - `VITE_APP_ID`: ID da aplicação OAuth
   - `OAUTH_SERVER_URL`: URL do servidor OAuth
   - `VITE_OAUTH_PORTAL_URL`: URL do portal de login

3. **Executar migrações de banco de dados**
   ```bash
   pnpm drizzle-kit generate
   pnpm drizzle-kit migrate
   ```

4. **Iniciar servidor de desenvolvimento**
   ```bash
   pnpm dev
   ```

   O servidor estará disponível em `http://localhost:3000`

## 📊 Banco de Dados

### Tabelas Principais

#### `users`
Armazena informações de usuários com autenticação.

```sql
- id: INT (PK)
- openId: VARCHAR (único, para OAuth)
- email: VARCHAR (único)
- passwordHash: VARCHAR (bcrypt)
- name: TEXT
- age: INT
- school: VARCHAR (opcional)
- role: ENUM('user', 'admin')
- loginMethod: VARCHAR
- createdAt: TIMESTAMP
- updatedAt: TIMESTAMP
- lastSignedIn: TIMESTAMP
```

#### `game_sessions`
Rastreia cada sessão de jogo do usuário.

```sql
- id: INT (PK)
- userId: INT (FK → users)
- startedAt: TIMESTAMP
- endedAt: TIMESTAMP
- totalScore: INT
- correctAnswers: INT
- totalAnswers: INT
- durationSeconds: INT
```

#### `game_answers`
Armazena respostas individuais dentro de uma sessão.

```sql
- id: INT (PK)
- sessionId: INT (FK → game_sessions)
- word: VARCHAR
- definition: TEXT
- userAnswer: VARCHAR
- isCorrect: BOOLEAN
- pointsEarned: INT
- timeSpentSeconds: INT
```

#### `user_stats`
Cache de estatísticas para consultas rápidas.

```sql
- id: INT (PK)
- userId: INT (FK → users)
- totalSessions: INT
- totalScore: INT
- avgAccuracy: DECIMAL
- totalTimeSpent: INT
- lastUpdated: TIMESTAMP
```

#### `admin_metrics`
Dados agregados para o dashboard administrativo.

```sql
- id: INT (PK)
- metricType: VARCHAR
- ageGroup: VARCHAR
- school: VARCHAR
- value: DECIMAL
- timestamp: TIMESTAMP
```

## 🔐 Segurança

### Autenticação

- **Registro**: Email único, senha mínima 6 caracteres, validação de idade (5-120)
- **Login**: Verificação de email/senha com bcrypt
- **Sessão**: Cookie seguro com token de sessão
- **Logout**: Limpeza de cookie e invalidação de sessão

### Proteção de Dados

- **ORM**: Drizzle ORM previne SQL injection automaticamente
- **Validação**: Todos os inputs são validados com Zod
- **CORS**: Headers de segurança configurados
- **Roles**: Controle de acesso baseado em roles (admin/user)

### Endpoints Protegidos

- **Públicos**: `/auth/register`, `/auth/login`, `/game/getRandomWord`
- **Protegidos (usuário)**: `/game/*`, `/user/getProfile`, `/game/getHistory`
- **Protegidos (admin)**: `/admin/*` (dashboard, métricas)

## 📡 API (tRPC)

### Autenticação

```typescript
// Registro
auth.register({
  name: string
  email: string
  age: number (5-120)
  school?: string
  password: string (min 6)
  passwordConfirm: string
})

// Login
auth.login({
  email: string
  password: string
})

// Logout
auth.logout()

// Perfil atual
auth.me() → User
```

### Jogo

```typescript
// Iniciar sessão
game.startSession() → { sessionId: number }

// Obter palavra aleatória
game.getRandomWord() → { word: string, definition: string, example?: string }

// Enviar resposta
game.submitAnswer({
  sessionId: number
  word: string
  definition: string
  userAnswer: string
  timeSpentSeconds: number
}) → { isCorrect: boolean, pointsEarned: number, totalScore: number, accuracy: string }

// Encerrar sessão
game.endSession({ sessionId: number }) → GameSession

// Histórico
game.getHistory() → GameSession[]
```

### Admin

```typescript
// Dashboard resumido
admin.getDashboardSummary() → {
  ageMetrics: Array
  schoolMetrics: Array
  scoreMetrics: Array
  timestamp: Date
}

// Métricas por faixa etária
admin.getAgeGroupMetrics() → Array

// Métricas por escola
admin.getSchoolMetrics() → Array

// Desempenho de pontuação
admin.getScorePerformance() → Array
```

## 🧪 Testes

### Executar Testes

```bash
pnpm test
```

### Cobertura de Testes

- ✅ Autenticação (hashing, registro, login)
- ✅ Mecânica de jogo (sessões, respostas, pontuação)
- ✅ Controle de acesso (admin, usuário)
- ✅ Prevenção de SQL injection
- ✅ Segurança de sessão

**Resultado**: 22+ testes passando

## 🎨 Interface do Usuário

### Páginas

1. **Home** (`/`)
   - Landing page com informações sobre o jogo
   - Links para registro/login ou jogo direto

2. **Registro** (`/register`)
   - Formulário com validação
   - Campos: nome, idade, escola (opcional), email, senha

3. **Login** (`/login`)
   - Autenticação com email/senha
   - Link para registro

4. **Jogo** (`/game`)
   - Interface de jogo com definição
   - Input para resposta
   - Pontuação em tempo real
   - Timer de sessão

5. **Histórico** (`/history`)
   - Lista de sessões passadas
   - Estatísticas agregadas
   - Acurácia por sessão

6. **Dashboard Admin** (`/admin`)
   - Gráficos de atividade por idade
   - Tabela de escolas mais ativas
   - Desempenho de pontuação por idade
   - Métricas de duração média

## 🌐 Integração com API de Dicionário

O app usa **FreeDictionaryAPI.com** para obter palavras em português.

### Fallback

Se a API estiver indisponível, usa lista local de palavras em português.

### Formato de Resposta

```json
{
  "word": "casa",
  "definition": "Edifício para moradia",
  "example": "A casa é grande e bonita."
}
```

## 📈 Métricas do Dashboard Admin

1. **Atividade por Faixa Etária**
   - Número de usuários por idade
   - Número de sessões por idade

2. **Escolas Mais Ativas**
   - Usuários por escola
   - Sessões por escola
   - Duração média
   - Acurácia média

3. **Desempenho de Pontuação**
   - Pontuação média por idade
   - Pontuação máxima e mínima
   - Acurácia por idade

4. **Tempo de Uso**
   - Duração média de sessão
   - Tempo total gasto

## 🚢 Deployment

### Preparar para Produção

1. Verificar variáveis de ambiente
2. Executar testes completos
3. Criar checkpoint no Manus
4. Clicar em "Publish" na UI do Manus

### Hospedagem

O app é hospedado automaticamente pelo Manus com:
- SSL/HTTPS automático
- Domínio customizável
- Backup automático de banco de dados
- Escalabilidade automática

## 📝 Guias de Usuário

### Para Usuários Regulares

1. **Criar Conta**
   - Acesse `/register`
   - Preencha nome, idade, escola (opcional), email e senha
   - Clique em "Cadastrar"

2. **Jogar**
   - Acesse `/game`
   - Leia a definição
   - Adivinhe a palavra
   - Ganhe pontos por respostas corretas

3. **Ver Histórico**
   - Acesse `/history`
   - Veja todas as suas sessões
   - Acompanhe sua pontuação e acurácia

### Para Administradores

1. **Acessar Dashboard**
   - Acesse `/admin` (requer role de admin)
   - Visualize métricas de uso

2. **Interpretar Dados**
   - **Atividade por Idade**: Veja qual faixa etária mais usa o app
   - **Escolas Ativas**: Identifique instituições mais engajadas
   - **Desempenho**: Veja quais idades têm melhor/pior pontuação

## 🐛 Troubleshooting

### Erro: "Database connection failed"
- Verifique se `DATABASE_URL` está configurada
- Verifique conectividade com o banco de dados

### Erro: "Invalid credentials"
- Verifique email e senha
- Certifique-se de que a conta foi criada

### Erro: "Access denied"
- Apenas admins podem acessar `/admin`
- Verifique seu role no banco de dados

## 📞 Suporte

Para problemas ou sugestões, entre em contato através da plataforma Manus.

## 📄 Licença

MIT

---

**Desenvolvido com ❤️ para educadores e alunos**
