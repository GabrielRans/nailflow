/**
 * Repositório de Materiais Supabase - NailFlow
 * Implementa operações CRUD para materiais com isolamento por estudio_id via RLS
 */

import { supabase } from '../supabase-client.js';

const TABELA = 'materiais';

/**
 * Obtém o estudio_id e user_id do usuário autenticado
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
function rowParaMaterial(row) {
  return {
    id: row.id,
    nome: row.nome,
    quantidadeDisponivel: Number(row.quantidade_disponivel),
    unidade: row.unidade,
    quantidadeMinima: Number(row.quantidade_minima),
    estudio_id: row.estudio_id,
    usuario_id: row.usuario_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

/**
 * Converte objeto de domínio para linha do banco
 * @param {Object} material
 * @param {string} estudioId
 * @param {string} userId
 * @returns {Object}
 */
function materialParaRow(material, estudioId, userId) {
  return {
    id: material.id,
    estudio_id: estudioId,
    usuario_id: userId,
    nome: material.nome,
    quantidade_disponivel: material.quantidadeDisponivel,
    unidade: material.unidade,
    quantidade_minima: material.quantidadeMinima
  };
}

/**
 * Cria repositório de materiais Supabase para o estudo atual
 * @returns {Object} Repositório com métodos assíncronos
 */
export async function criarMateriaisRepository() {
  const { estudioId, userId } = await obterEstudioIdEUsuário();
  if (!estudioId) {
    throw new Error('Usuário não autenticado ou sem estúdio vinculado');
  }

  return {
    /**
     * Salva (insere ou atualiza) um material
     * @param {Object} material
     * @returns {Promise<void>}
     */
    async salvar(material) {
      const row = materialParaRow(material, estudioId, userId);

      const { error } = await supabase
        .from(TABELA)
        .upsert(row, { onConflict: 'id' });

      if (error) throw error;
    },

    /**
     * Lista todos os materiais do estúdio
     * @returns {Promise<Array>}
     */
    async listar() {
      const { data, error } = await supabase
        .from(TABELA)
        .select('*')
        .eq('estudio_id', estudioId)
        .order('nome', { ascending: true });

      if (error) throw error;
      return (data ?? []).map(rowParaMaterial);
    },

    /**
     * Busca material por ID
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
      return rowParaMaterial(data);
    },

    /**
     * Atualiza apenas a quantidade de um material
     * @param {string} id
     * @param {number} quantidade
     * @returns {Promise<Object|null>} Material atualizado ou null se não encontrado
     */
    async atualizarQuantidade(id, quantidade) {
      const { data, error } = await supabase
        .from(TABELA)
        .update({
          quantidade_disponivel: quantidade
        })
        .eq('estudio_id', estudioId)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }
      return rowParaMaterial(data);
    },

    /**
     * Adiciona um novo material
     * @param {Object} material
     * @returns {Promise<Object>} Material criado
     */
    async adicionar(material) {
      const row = materialParaRow(material, estudioId, userId);

      const { data, error } = await supabase
        .from(TABELA)
        .insert(row)
        .select()
        .single();

      if (error) throw error;
      return rowParaMaterial(data);
    },

    /**
     * Atualiza um material completamente
     * @param {string} id
     * @param {Object} dadosAtualizados
     * @returns {Promise<boolean>}
     */
    async atualizar(id, dadosAtualizados) {
      const row = {
        nome: dadosAtualizados.nome,
        quantidade_disponivel: dadosAtualizados.quantidadeDisponivel,
        unidade: dadosAtualizados.unidade,
        quantidade_minima: dadosAtualizados.quantidadeMinima
      };

      const { error, count } = await supabase
        .from(TABELA)
        .update(row)
        .eq('estudio_id', estudioId)
        .eq('id', id)
        .select('id', { count: 'exact', head: true });

      if (error) throw error;
      return count > 0;
    },

    /**
     * Exclui um material
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
    }
  };
}

/**
 * Factory que retorna repositório Supabase se autenticado e autorizado
 * Lança erro se não autenticado/autorizado ou erro de configuração
 * Usado pelo adapter em materiais.js
 * @returns {Promise<Object>}
 * @throws {Error} Se usuário não autenticado, sem estúdio vinculado, ou erro de configuração
 */
export async function tentarCriarMateriaisRepository() {
  return await criarMateriaisRepository();
}