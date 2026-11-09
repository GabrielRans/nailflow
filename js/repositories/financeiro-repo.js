/**
 * Repositório Financeiro Supabase - NailFlow
 * Implementa operações CRUD para movimentações com isolamento por estudio_id via RLS
 */

import { supabase } from '../supabase-client.js';

const TABELA = 'movimentacoes';

/**
 * Obtém o estudio_id do usuário autenticado
 * @returns {Promise<{estudioId: string|null, userId: string|null}>}
 */
async function obterEstudioIdEUsuário() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return { estudioId: null, userId: null };

  const { data, error } = await supabase
    .from('usuarios')
    .select('estudio_id')
    .eq('id', session.user.id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return { estudioId: null, userId: session.user.id };
    throw error;
  }
  return { estudioId: data?.estudio_id ?? null, userId: session.user.id };
}

/**
 * Converte linha do banco para objeto de domínio
 * @param {Object} row
 * @returns {Object}
 */
function rowParaMovimentacao(row) {
  return {
    id: row.id,
    tipo: row.tipo,
    valor: Number(row.valor),
    descricao: row.descricao,
    categoria: row.categoria,
    data: row.data,
    observacao: row.observacao ?? '',
    estudio_id: row.estudio_id,
    usuario_id: row.usuario_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Cria repositório financeiro Supabase para o estudo atual
 * @returns {Object} Repositório com métodos assíncronos
 */
export async function criarFinanceiroRepository() {
  const { estudioId, userId } = await obterEstudioIdEUsuário();
  if (!estudioId) {
    throw new Error('Usuário não autenticado ou sem estúdio vinculado');
  }

  return {
    /**
     * Salva (insere ou atualiza) uma lista de movimentações
     * Usa upsert para evitar perda de dados (delete-all-reinsert é perigoso)
     * @param {Array} movimentacoes
     * @returns {Promise<void>}
     */
    async salvar(movimentacoes) {
      // Garantir estudio_id válido (defesa contra RLS 42501)
      if (!estudioId) {
        throw new Error('estudio_id não disponível - usuário sem estúdio vinculado');
      }

      if (!movimentacoes || movimentacoes.length === 0) return;

      const rows = movimentacoes.map(m => ({
        id: m.id,
        estudio_id: estudioId,
        usuario_id: userId,
        tipo: m.tipo,
        valor: m.valor,
        descricao: m.descricao,
        categoria: m.categoria,
        data: m.data,
        observacao: m.observacao ?? null
      }));

      console.log('[FinanceiroRepo] Salvando (upsert)', rows.length, 'movimentações com estudio_id:', estudioId, 'usuario_id:', userId);

      const { error } = await supabase
        .from(TABELA)
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        console.error('[FinanceiroRepo] Erro ao salvar:', error);
        throw error;
      }
    },

    /**
     * Lista todas as movimentações do estúdio
     * @returns {Promise<Array>}
     */
    async listar() {
      const { data, error } = await supabase
        .from(TABELA)
        .select('*')
        .eq('estudio_id', estudioId)
        .order('data', { ascending: false });

      if (error) throw error;
      return (data ?? []).map(rowParaMovimentacao);
    },

    /**
     * Busca movimentação por ID
     * @param {string} id
     * @returns {Promise<Object|null>}
     */
    async buscarPorId(id) {
      const { data, error } = await supabase
        .from(TABELA)
        .select('*')
        .eq('estudio_id', estudioId)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return rowParaMovimentacao(data);
    },

    /**
     * Adiciona uma nova movimentação
     * @param {Object} movimentacao
     * @returns {Promise<Object>} Movimentação criada
     */
    async adicionar(movimentacao) {
      // Garantir estudio_id válido (defesa contra RLS 42501)
      if (!estudioId) {
        throw new Error('estudio_id não disponível - usuário sem estúdio vinculado');
      }

      const row = {
        id: movimentacao.id,
        estudio_id: estudioId,
        usuario_id: userId,
        tipo: movimentacao.tipo,
        valor: movimentacao.valor,
        descricao: movimentacao.descricao,
        categoria: movimentacao.categoria,
        data: movimentacao.data,
        observacao: movimentacao.observacao ?? null
      };

      // Log para debug
      console.log('[FinanceiroRepo] Inserindo movimentação com estudio_id:', estudioId, 'usuario_id:', userId);

      const { data, error } = await supabase
        .from(TABELA)
        .insert(row)
        .select()
        .single();

      if (error) {
        console.error('[FinanceiroRepo] Erro ao inserir:', error);
        throw error;
      }
      return rowParaMovimentacao(data);
    },

    /**
     * Atualiza uma movimentação existente
     * @param {string} id
     * @param {Object} dadosAtualizados
     * @returns {Promise<Object>} Movimentação atualizada
     */
    async atualizar(id, dadosAtualizados) {
      const row = {
        tipo: dadosAtualizados.tipo,
        valor: dadosAtualizados.valor,
        descricao: dadosAtualizados.descricao,
        categoria: dadosAtualizados.categoria,
        data: dadosAtualizados.data,
        observacao: dadosAtualizados.observacao ?? null,
        atualizado_em: new Date().toISOString()
      };

      // Log para debug - ver o payload exato
      console.log('[FinanceiroRepo] Atualizando movimentação:', { id, estudioId, row });

      const { data, error } = await supabase
        .from(TABELA)
        .update(row)
        .eq('estudio_id', estudioId)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[FinanceiroRepo] Erro Supabase Update:', error);
        throw error;
      }

      if (!data) {
        const err = new Error('Nenhuma linha atualizada (verifique RLS ou ID inexistente)');
        console.error('[FinanceiroRepo] Update returned no data:', { id, estudioId });
        throw err;
      }

      console.log('[FinanceiroRepo] Movimentação atualizada com sucesso:', data);
      return rowParaMovimentacao(data);
    },

    /**
     * Exclui uma movimentação
     * @param {string} id
     * @returns {Promise<boolean>}
     */
    async excluir(id) {
      const { error, count } = await supabase
        .from(TABELA)
        .delete()
        .eq('estudio_id', estudioId)
        .eq('id', id)
        .select('id', { count: 'exact', head: true });

      if (error) throw error;
      return count > 0;
    },

    /**
     * Filtra movimentações por período
     * @param {string} dataInicial - Formato YYYY-MM-DD
     * @param {string} dataFinal - Formato YYYY-MM-DD
     * @returns {Promise<Array>}
     */
    async filtrarPorPeriodo(dataInicial, dataFinal) {
      let query = supabase
        .from(TABELA)
        .select('*')
        .eq('estudio_id', estudioId);

      if (dataInicial) {
        query = query.gte('data', dataInicial);
      }
      if (dataFinal) {
        query = query.lte('data', dataFinal);
      }

      query = query.order('data', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return (data ?? []).map(rowParaMovimentacao);
    }
  };
}

/**
 * Factory que retorna repositório Supabase se autenticado e autorizado
 * Lança erro se não autenticado/autorizado ou erro de configuração
 * Usado pelo adapter em app.js
 * @returns {Promise<Object>}
 * @throws {Error} Se usuário não autenticado, sem estúdio vinculado, ou erro de configuração
 */
export async function tentarCriarFinanceiroRepository() {
  return await criarFinanceiroRepository();
}