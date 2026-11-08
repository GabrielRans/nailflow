-- 1. CORREÇÃO DE SEGURANÇA: search_path mutável
-- Define um search_path seguro para evitar ataques de schema hijacking.
ALTER FUNCTION public.trigger_atualizar_atualizado_em() SET search_path = public, pg_temp;
ALTER FUNCTION public.obter_estudio_id_do_usuario_atual() SET search_path = public, pg_temp;

-- 2. CORREÇÃO DE SEGURANÇA: Funções SECURITY DEFINER expostas
-- Remove a permissão de execução via API para usuários anônimos e logados.
-- As políticas RLS continuarão funcionando internamente, mas ninguém poderá chamar a função diretamente via /rest/v1/rpc/...
REVOKE EXECUTE ON FUNCTION public.obter_estudio_id_do_usuario_atual() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM anon, authenticated;

-- 3. CORREÇÃO DE PERFORMANCE: Auth RLS InitPlan
-- Substitui a chamada da função por um subselect para que o Postgres a avalie apenas uma vez por consulta, e não por linha.
-- Atenção: Substitua os nomes das políticas abaixo pelos nomes reais que aparecem no seu banco.

-- Tabela movimentacoes
DROP POLICY IF EXISTS "movimentacoes_select_estudio" ON public.movimentacoes;
CREATE POLICY "movimentacoes_select_estudio" ON public.movimentacoes
  FOR SELECT USING (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()));

DROP POLICY IF EXISTS "movimentacoes_insert_estudio" ON public.movimentacoes;
CREATE POLICY "movimentacoes_insert_estudio" ON public.movimentacoes
  FOR INSERT WITH CHECK (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()));

DROP POLICY IF EXISTS "movimentacoes_update_estudio" ON public.movimentacoes;
CREATE POLICY "movimentacoes_update_estudio" ON public.movimentacoes
  FOR UPDATE USING (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()))
  WITH CHECK (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()));

DROP POLICY IF EXISTS "movimentacoes_delete_estudio" ON public.movimentacoes;
CREATE POLICY "movimentacoes_delete_estudio" ON public.movimentacoes
  FOR DELETE USING (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()));

-- Tabela materiais
DROP POLICY IF EXISTS "materiais_select_estudio" ON public.materiais;
CREATE POLICY "materiais_select_estudio" ON public.materiais
  FOR SELECT USING (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()));

DROP POLICY IF EXISTS "materiais_insert_estudio" ON public.materiais;
CREATE POLICY "materiais_insert_estudio" ON public.materiais
  FOR INSERT WITH CHECK (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()));

DROP POLICY IF EXISTS "materiais_update_estudio" ON public.materiais;
CREATE POLICY "materiais_update_estudio" ON public.materiais
  FOR UPDATE USING (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()))
  WITH CHECK (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()));

DROP POLICY IF EXISTS "materiais_delete_estudio" ON public.materiais;
CREATE POLICY "materiais_delete_estudio" ON public.materiais
  FOR DELETE USING (estudio_id = (SELECT public.obter_estudio_id_do_usuario_atual()));

-- Tabela estudios
-- (Nota: Se a política original for diferente, ajuste o USING de acordo)
DROP POLICY IF EXISTS "estudios_select_own" ON public.estudios;
CREATE POLICY "estudios_select_own" ON public.estudios
  FOR SELECT USING (id = (SELECT public.obter_estudio_id_do_usuario_atual()));

-- Tabela usuarios
DROP POLICY IF EXISTS "usuarios_select_policy" ON public.usuarios;
CREATE POLICY "usuarios_select_policy" ON public.usuarios
  FOR SELECT USING (id = (SELECT auth.uid()));

-- 4. CORREÇÃO DE PERFORMANCE: Políticas Permissivas Múltiplas
-- Remove políticas antigas que se sobrepõem e podem causar lentidão.
-- O ideal é ter apenas uma política por ação (SELECT, INSERT, etc).
DROP POLICY IF EXISTS "movimentacoes_insert_policy" ON public.movimentacoes;
-- (Se houver outras políticas duplicadas como "estudios_modify_admin", você deve removê-las ou consolidá-las manualmente)
