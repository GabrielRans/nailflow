-- =============================================================================
-- NailFlow - Database Schema e Políticas RLS
-- Documentação para revisão técnica Issue #36
-- =============================================================================
-- Este arquivo documenta o schema esperado no Supabase (PostgreSQL)
-- para compatibilidade com os repositórios em js/repositories/
-- =============================================================================

-- =============================================================================
-- TABELA: usuarios (link user -> estudio)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índice para lookup rápido
CREATE INDEX IF NOT EXISTS idx_usuarios_estudio_id ON public.usuarios(estudio_id);

-- RLS: Usuário só vê seu próprio registro
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_select_own" ON public.usuarios
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "usuarios_insert_own" ON public.usuarios
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Trigger para updated_at (opcional)
-- CREATE TRIGGER set_usuarios_updated_at
--     BEFORE UPDATE ON public.usuarios
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABELA: estudios (opcional - para dados do estúdio)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.estudios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.estudios ENABLE ROW LEVEL SECURITY;

-- Usuário vê apenas seu estúdio (via link na tabela usuarios)
CREATE POLICY "estudios_select_own" ON public.estudios
    FOR SELECT USING (
        id IN (SELECT estudio_id FROM public.usuarios WHERE id = auth.uid())
    );

-- =============================================================================
-- TABELA: movimentacoes (financeiro)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.movimentacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
    valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
    descricao TEXT NOT NULL,
    categoria TEXT NOT NULL CHECK (categoria IN ('atendimento', 'material', 'outro')),
    data DATE NOT NULL,
    observacao TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance e RLS
CREATE INDEX IF NOT EXISTS idx_movimentacoes_estudio_id ON public.movimentacoes(estudio_id);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_data ON public.movimentacoes(data DESC);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_tipo ON public.movimentacoes(tipo);

-- RLS: Isolamento por estudio_id
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário vê apenas movimentações do seu estúdio
CREATE POLICY "movimentacoes_select_estudio" ON public.movimentacoes
    FOR SELECT USING (
        estudio_id IN (SELECT estudio_id FROM public.usuarios WHERE id = auth.uid())
    );

-- INSERT: usuário insere apenas no seu estúdio (estudio_id verificado no insert)
CREATE POLICY "movimentacoes_insert_estudio" ON public.movimentacoes
    FOR INSERT WITH CHECK (
        estudio_id IN (SELECT estudio_id FROM public.usuarios WHERE id = auth.uid())
    );

-- UPDATE: usuário atualiza apenas no seu estúdio
CREATE POLICY "movimentacoes_update_estudio" ON public.movimentacoes
    FOR UPDATE USING (
        estudio_id IN (SELECT estudio_id FROM public.usuarios WHERE id = auth.uid())
    );

-- DELETE: usuário deleta apenas no seu estúdio
CREATE POLICY "movimentacoes_delete_estudio" ON public.movimentacoes
    FOR DELETE USING (
        estudio_id IN (SELECT estudio_id FROM public.usuarios WHERE id = auth.uid())
    );

-- Trigger para updated_at (opcional)
-- CREATE TRIGGER set_movimentacoes_updated_at
--     BEFORE UPDATE ON public.movimentacoes
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- TABELA: materiais
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.materiais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    estudio_id UUID NOT NULL REFERENCES public.estudios(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    quantidade_disponivel NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantidade_disponivel >= 0),
    unidade TEXT NOT NULL,
    quantidade_minima NUMERIC(12,3) NOT NULL DEFAULT 0 CHECK (quantidade_minima >= 0),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_materiais_estudio_id ON public.materiais(estudio_id);
CREATE INDEX IF NOT EXISTS idx_materiais_nome ON public.materiais(nome);

-- RLS: Isolamento por estudio_id
ALTER TABLE public.materiais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "materiais_select_estudio" ON public.materiais
    FOR SELECT USING (
        estudio_id IN (SELECT estudio_id FROM public.usuarios WHERE id = auth.uid())
    );

CREATE POLICY "materiais_insert_estudio" ON public.materiais
    FOR INSERT WITH CHECK (
        estudio_id IN (SELECT estudio_id FROM public.usuarios WHERE id = auth.uid())
    );

CREATE POLICY "materiais_update_estudio" ON public.materiais
    FOR UPDATE USING (
        estudio_id IN (SELECT estudio_id FROM public.usuarios WHERE id = auth.uid())
    );

CREATE POLICY "materiais_delete_estudio" ON public.materiais
    FOR DELETE USING (
        estudio_id IN (SELECT estudio_id FROM public.usuarios WHERE id = auth.uid())
    );

-- Trigger para updated_at (opcional)
-- CREATE TRIGGER set_materiais_updated_at
--     BEFORE UPDATE ON public.materiais
--     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VERIFICAÇÃO DE COMPATIBILIDADE COM CÓDIGO
-- =============================================================================
--
-- Repositórios esperam:
--
-- financeiro-repo.js:
--   - INSERT: id, estudio_id, usuario_id, tipo, valor, descricao, categoria, data, observacao
--   - UPDATE: tipo, valor, descricao, categoria, data, observacao (SEM updated_at)
--   - SELECT: * com filtro estudio_id
--   - DELETE: filtro estudio_id + id
--
-- materiais-repo.js:
--   - INSERT/UPSERT: id, estudio_id, usuario_id, nome, quantidade_disponivel, unidade, quantidade_minima
--   - UPDATE (completo): nome, quantidade_disponivel, unidade, quantidade_minima (SEM updated_at)
--   - UPDATE (quantidade): quantidade_disponivel (SEM updated_at)
--   - SELECT: * com filtro estudio_id
--   - DELETE: filtro estudio_id + id
--
-- auth.js (buscarEstudioIdDoUsuario):
--   - SELECT estudio_id FROM usuarios WHERE id = auth.uid()
--
-- =============================================================================
-- NOTAS IMPORTANTES
-- =============================================================================
--
-- 1. COLUNA updated_at:
--    O código NÃO envia updated_at em INSERT/UPDATE (evita erro PGRST204).
--    Se houver trigger no banco, deve ser BEFORE UPDATE e não exigir valor no payload.
--
-- 2. COLUNA usuario_id (NOT NULL):
--    Obrigatória em INSERT (erro 23502 se omitida).
--    Repositórios incluem usuario_id = auth.uid() em todos os inserts.
--
-- 3. RLS E SERVICE ROLE:
--    Operações admin (criar vínculo usuario->estudio) requerem Service Role Key.
--    Frontend usa anon key + RLS.
--
-- 4. PRIMEIRO ACESSO:
--    Usuário autenticado sem registro em 'usuarios' recebe auth:unauthorized.
--    Admin deve inserir registro na tabela usuarios via Dashboard Supabase.
--
-- 5. BACKUP/PITR (Issue #32):
--    Supabase Free Tier: PITR 7 dias, backups diários retidos 30 dias.
--    Pro Tier+: PITR 30+ dias, backups mais frequentes.
--
-- =============================================================================