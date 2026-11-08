# NailFlow

Aplicação web desenvolvida para auxiliar na gestão financeira e no controle de materiais de um empreendimento de Nail Art.

## Tecnologias

- HTML5
- CSS3
- JavaScript (ES Modules via CDN)
- Supabase (PostgreSQL + Auth v2 + Realtime)
- Web Storage API (apenas para testes - injeção de dependência)

## Status

Projeto em desenvolvimento.

## Arquitetura de Persistência e Resiliência (Issues #32 e #36)

A integração com Supabase (Issue #36) substitui o armazenamento exclusivo em `localStorage` por um banco PostgreSQL gerenciado na nuvem, trazendo:

- **Isolamento multi-tenant via RLS**: Cada estúdio acessa apenas seus dados através de políticas Row Level Security vinculadas ao `auth.uid()` via tabela `usuarios` (link `usuario_id` → `estudio_id`).
- **Autenticação OAuth (Google)**: Fluxo seguro com `detectSessionInUrl: true`, `autoRefreshToken: true` e persistência de sessão no `localStorage` do navegador. Redirecionamento dinâmico via `window.location.origin` (funciona em localhost e produção Cloudflare Pages).
- **Resiliência e backup nativo (Issue #32)**: O PostgreSQL do Supabase provê backups automatizados com Point-in-Time Recovery (PITR) de 7 dias no plano gratuito, replicação síncrona e alta disponibilidade. **Nota**: O PITR permite restauração para qualquer segundo nos últimos 7 dias; backups completos diários são mantidos por 30 dias. Isso elimina o risco de perda de dados inerente ao `localStorage` (limpeza de cache, mudança de dispositivo, limites de armazenamento).
- **API Dual (Sync/Async)**: 
  - **Produção**: API exclusivamente assíncrona contra Supabase (sem fallback automático para localStorage)
  - **Testes**: API síncrona via repositório em memória injetado (injeção de dependência), garantindo isolamento total entre testes
- **Sem fallback silencioso**: Em produção, falhas de conexão/auth geram erro explícito na UI - não há escrita oculta em localStorage.

## Autenticação e Autorização (Issue #36)

### Separação AuthN / AuthZ
- **Autenticação (AuthN)**: Identidade verificada via Google OAuth (sessão válida, usuário conhecido)
- **Autorização (AuthZ)**: Acesso ao NailFlow requer vínculo com um estúdio (`estudioId` válido na tabela `usuarios`)

### Fluxo de Eventos
- `auth:authenticated` → AuthN OK (usuário logado, mas pode não ter estúdio)
- `auth:login` → AuthN + AuthZ OK (usuário logado E tem estúdio vinculado) → app acessível
- `auth:unauthorized` → AuthN OK, mas sem AuthZ (sem estúdio) → redireciona para login com mensagem
- `auth:logout` → Limpa estado completo
- `auth:erro` → Erro de autenticação/autorização
- `auth:pronto` → Estado inicial após init (`{ autenticado, autorizado }`)
- `auth:token-refresh` → Token renovado automaticamente

### Rotas Protegidas
Todas as rotas (`dashboard`, `financeiro`, `movimentacao`, `materiais`, `cadastro-material`) exigem **AMBAS** condições:
1. `window.NailFlow.auth.autenticado === true` (AuthN)
2. `window.NailFlow.auth.autorizado === true` (AuthZ = estudioId válido)

## OAuth - Configuração Google Cloud Console

1. Criar projeto no [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials → Create Credentials → OAuth Client ID
3. Application type: Web application
4. Authorized JavaScript origins: `https://seu-dominio.pages.dev` (produção) + `http://localhost:3000` (dev)
5. Authorized redirect URIs: `https://seu-dominio.pages.dev/` (produção) + `http://localhost:3000/` (dev)
   - **Nota**: O código usa `redirectTo: window.location.origin` dinamicamente, funcionando em qualquer domínio
6. Copiar Client ID e Client Secret para o Supabase Dashboard → Authentication → Providers → Google

## Limitações Conhecidas

1. **Primeiro acesso**: Usuários autenticados sem vínculo na tabela `usuarios` recebem `auth:unauthorized` - administrador deve vincular manualmente no Supabase Dashboard
2. **Offline**: Não há suporte a modo offline - requer conexão para operações CRUD
3. **RLS e Service Role**: Operações administrativas (criar vínculo usuário-estúdio) requerem Service Role Key (não exposta no frontend)
4. **Testes de integração**: Requerem Supabase local ou projeto de teste configurado - testes atuais usam repositório em memória
5. **Navegadores antigos**: Requer suporte a ES Modules, `crypto.randomUUID`, `CustomEvent` (navegadores modernos OK)

## Deploy

Configurado para **Cloudflare Pages** com headers de segurança em `_headers`:

- `X-Frame-Options: DENY` — previne clickjacking
- `X-Content-Type-Options: nosniff` — previne MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — controle de informação de referência

## Testes

```bash
npm test           # Executa todos os testes (Node.js native test runner)
npm run test:watch # Modo watch
```

- Testes unitários: `test/app.test.js` (financeiro), `test/materiais.test.js` (materiais)
- Isolamento total via `vm` contexts + repositórios em memória injetados
- Sem dependência de Supabase/localStorage nos testes
