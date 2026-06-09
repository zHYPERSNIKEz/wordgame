# Environment Variables Documentation

## Word Game App - Complete Environment Configuration

### Database Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `DATABASE_URL` | ✅ Yes | MySQL/TiDB connection string | `mysql://user:password@localhost:3306/word_game_db` |

### Authentication & Security

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `JWT_SECRET` | ✅ Yes | Secret key for JWT signing (min 32 chars) | `your-super-secret-jwt-key-min-32-characters-long` |
| `SESSION_TIMEOUT_MS` | ❌ No | Session timeout in milliseconds | `3600000` (1 hour) |
| `SESSION_COOKIE_SECURE` | ❌ No | HTTPS only cookies | `true` |
| `SESSION_COOKIE_HTTP_ONLY` | ❌ No | Prevent JS access to cookies | `true` |
| `SESSION_COOKIE_SAME_SITE` | ❌ No | CSRF protection | `Strict` |

### Manus OAuth Configuration (Auto-Injected)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_APP_ID` | ✅ Yes | Manus OAuth application ID |
| `OAUTH_SERVER_URL` | ✅ Yes | Manus OAuth backend URL |
| `VITE_OAUTH_PORTAL_URL` | ✅ Yes | Manus login portal URL |
| `OWNER_NAME` | ✅ Yes | Owner's display name |
| `OWNER_OPEN_ID` | ✅ Yes | Owner's Manus OpenID |

### Manus Built-in APIs (Auto-Injected)

| Variable | Required | Description |
|----------|----------|-------------|
| `BUILT_IN_FORGE_API_URL` | ✅ Yes | Manus Forge API endpoint |
| `BUILT_IN_FORGE_API_KEY` | ✅ Yes | Server-side Forge API key |
| `VITE_FRONTEND_FORGE_API_URL` | ✅ Yes | Frontend Forge API endpoint |
| `VITE_FRONTEND_FORGE_API_KEY` | ✅ Yes | Frontend Forge API key |

### Analytics (Auto-Injected)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_ANALYTICS_ENDPOINT` | ✅ Yes | Analytics service endpoint |
| `VITE_ANALYTICS_WEBSITE_ID` | ✅ Yes | Website ID for analytics |

### Application Configuration

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `VITE_APP_TITLE` | ❌ No | Application title | `Jogo de Palavras` |
| `VITE_APP_LOGO` | ❌ No | Application logo URL | - |
| `NODE_ENV` | ❌ No | Environment (development/production) | `production` |

### Admin Configuration

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `ADMIN_EMAIL` | ❌ No | Initial admin email | `admin@example.com` |
| `ADMIN_PASSWORD` | ❌ No | Initial admin password | `secure-admin-password` |

### Feature Flags

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENABLE_ADMIN_DASHBOARD` | ❌ No | `true` | Enable admin dashboard |
| `ENABLE_USER_REGISTRATION` | ❌ No | `true` | Allow new user registration |
| `ENABLE_GAME_HISTORY` | ❌ No | `true` | Show game history to users |

### Rate Limiting

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RATE_LIMIT_WINDOW_MS` | ❌ No | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | ❌ No | `100` | Max requests per window |

### Logging

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `LOG_LEVEL` | ❌ No | `info` | Logging level (debug/info/warn/error) |
| `LOG_FORMAT` | ❌ No | `json` | Log format (json/text) |

## Setup Instructions

### 1. Database Setup

```bash
# Create MySQL database
mysql -u root -p
> CREATE DATABASE word_game_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
> CREATE USER 'wordgame'@'localhost' IDENTIFIED BY 'secure_password';
> GRANT ALL PRIVILEGES ON word_game_db.* TO 'wordgame'@'localhost';
> FLUSH PRIVILEGES;
```

### 2. Environment Variables

1. Copy `.env.example` to `.env.local` (local development)
2. Update all required variables
3. For production, use Manus Secrets management

### 3. Admin Setup

After first deployment:

```bash
# Login with initial admin credentials
# Email: admin@example.com
# Password: (set in ADMIN_PASSWORD)
```

## Security Best Practices

- ✅ Always use HTTPS in production
- ✅ Rotate JWT_SECRET regularly
- ✅ Use strong admin passwords
- ✅ Enable HTTPS-only cookies
- ✅ Set appropriate rate limits
- ✅ Monitor logs for suspicious activity
- ✅ Keep dependencies updated
- ✅ Use environment-specific secrets

## Troubleshooting

### Database Connection Error
- Check `DATABASE_URL` format
- Verify database server is running
- Ensure user has correct permissions

### Authentication Issues
- Verify `JWT_SECRET` is set
- Check OAuth credentials are correct
- Ensure session cookies are enabled

### Admin Dashboard Not Loading
- Verify user role is set to `admin`
- Check `ENABLE_ADMIN_DASHBOARD` is `true`
- Review logs for errors
