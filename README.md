# NailFlow

Aplicação web desenvolvida para auxiliar na gestão financeira e no controle de materiais de um empreendimento de Nail Art.

## Tecnologias

- HTML5
- CSS3
- JavaScript (ES Modules)
- Supabase (PostgreSQL + Auth + Realtime)
- Web Storage API (fallback local para testes)

## Status

Projeto em desenvolvimento.

## Arquitetura de Persistência e Resiliência (Issues #32 e #36)

A integração com Supabase (Issue #36) substitui o armazenamento exclusivo em `localStorage` por um banco PostgreSQL gerenciado na nuvem, trazendo:

- **Isolamento multi-tenant via RLS**: Cada estúdio acessa apenas seus dados através de políticas Row Level Security vinculadas ao `auth.uid()`.
- **Autenticação OAuth (Google)**: Fluxo seguro com `detectSessionInUrl`, `autoRefreshToken` e persistência de sessão.
- **Resiliência e backup nativo (Issue #32)**: O PostgreSQL do Supabase provê backups automatizados (point-in-time recovery), replicação e alta disponibilidade, eliminando o risco de perda de dados inerente ao `localStorage` (limpeza de cache, mudança de dispositivo, limites de armazenamento). A nuvem garante a durabilidade dos dados financeiros e de materiais do negócio.
- **API Dual (Sync/Async)**: Mantém compatibilidade com testes existentes via API síncrona baseada em cache local, enquanto a aplicação usa exclusivamente a API assíncrona contra o Supabase.

## Deploy

Configurado para **Cloudflare Pages** com headers de segurança em `_headers`:

- `X-Frame-Options: DENY` — previne clickjacking
- `X-Content-Type-Options: nosniff` — previne MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin` — controle de informação de referência
