/**
 * Módulo de Autenticação - NailFlow
 * Gerencia login Google OAuth, logout, sessão e estado global via CustomEvents
 *
 * Eventos disparados:
 * - auth:login   → detail: { usuario, estudioId, sessao }
 * - auth:logout  → detail: { motivo }
 * - auth:erro    → detail: { mensagem, erro }
 */

import { supabase } from './supabase-client.js';

// =============================================================================
// Estado Global Reactivo (via window.NailFlow.auth para acesso síncrono)
// =============================================================================

const estadoAuth = {
  sessao: null,
  usuario: null,
  estudioId: null,
  inicializado: false,
};

// Fallback síncrono para scripts clássicos (não ES modules)
// Objeto plano mutável - propriedades atualizadas diretamente
window.NailFlow = window.NailFlow || {};
window.NailFlow.auth = {
  sessao: null,
  usuario: null,
  estudioId: null,
  autenticado: false,
  inicializado: false,
};

// =============================================================================
// Helpers de Eventos Customizados
// =============================================================================

function dispararEvento(nome, detail = {}) {
  window.dispatchEvent(new CustomEvent(nome, { detail }));
}

// =============================================================================
// Buscar estudio_id do usuário autenticado na tabela usuarios
// =============================================================================

async function buscarEstudioIdDoUsuario(userId) {
  try {
    const { data, error } = await supabase
      .from('usuarios')
      .select('estudio_id')
      .eq('id', userId)
      .single();

    if (error) {
      // Se não encontrar registro, pode ser primeiro acesso - não é erro fatal
      if (error.code === 'PGRST116') {
        console.warn('[Auth] Usuário não vinculado a nenhum estúdio ainda:', userId);
        return null;
      }
      throw error;
    }
    return data?.estudio_id ?? null;
  } catch (err) {
    console.error('[Auth] Erro ao buscar estudio_id:', err);
    return null;
  }
}

// =============================================================================
// Atualizar estado interno e window.NailFlow.auth (síncrono)
// =============================================================================

function atualizarEstadoAuth(sessao, usuario, estudioId) {
  estadoAuth.sessao = sessao;
  estadoAuth.usuario = usuario;
  estadoAuth.estudioId = estudioId;
  estadoAuth.inicializado = true;

  window.NailFlow.auth.sessao = sessao;
  window.NailFlow.auth.usuario = usuario;
  window.NailFlow.auth.estudioId = estudioId;
  window.NailFlow.auth.autenticado = !!sessao && !!usuario;
  window.NailFlow.auth.inicializado = true;
}

function limparEstadoAuth() {
  estadoAuth.sessao = null;
  estadoAuth.usuario = null;
  estadoAuth.estudioId = null;
  estadoAuth.inicializado = true;

  window.NailFlow.auth.sessao = null;
  window.NailFlow.auth.usuario = null;
  window.NailFlow.auth.estudioId = null;
  window.NailFlow.auth.autenticado = false;
  window.NailFlow.auth.inicializado = true;
}

function marcarInicializado(autenticado = false) {
  estadoAuth.inicializado = true;
  window.NailFlow.auth.inicializado = true;
  window.NailFlow.auth.autenticado = autenticado;
}

// =============================================================================
// API Pública
// =============================================================================

/**
 * Inicia o fluxo de login com Google OAuth
 * Redireciona para o Google; ao retornar, onAuthStateChange trata a sessão
 */
export async function loginComGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // Redireciona dinamicamente para o domínio atual (produção ou localhost)
        // Evita redirecionamento fixo para localhost em produção (Cloudflare Pages)
        redirectTo: window.location.origin,
        // Solicita acesso ao email e perfil
        scopes: 'email profile',
      },
    });

    if (error) throw error;
    // Não retorna aqui - o navegador redireciona para Google
  } catch (err) {
    console.error('[Auth] Erro ao iniciar login Google:', err);
    dispararEvento('auth:erro', {
      mensagem: 'Não foi possível iniciar o login com Google. Tente novamente.',
      erro: err
    });
    throw err;
  }
}

/**
 * Realiza logout do usuário atual
 */
export async function logout() {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    // onAuthStateChange('SIGNED_OUT') limpará o estado
  } catch (err) {
    console.error('[Auth] Erro ao fazer logout:', err);
    dispararEvento('auth:erro', {
      mensagem: 'Erro ao sair. Tente novamente.',
      erro: err
    });
    throw err;
  }
}

/**
 * Retorna a sessão atual (ou null se não autenticado)
 * @returns {Promise<{sessao, usuario, estudioId} | null>}
 */
export async function obterSessaoAtual() {
  if (estadoAuth.sessao && estadoAuth.usuario) {
    return {
      sessao: estadoAuth.sessao,
      usuario: estadoAuth.usuario,
      estudioId: estadoAuth.estudioId
    };
  }
  return null;
}

/**
 * Verifica se há sessão válida no momento (síncrono, para uso imediato)
 * @returns {boolean}
 */
export function estaAutenticado() {
  return !!estadoAuth.sessao && !!estadoAuth.usuario;
}

/**
 * Obtém o estudio_id do usuário atual (síncrono, após inicialização)
 * @returns {string | null}
 */
export function getEstudioId() {
  return estadoAuth.estudioId;
}

// =============================================================================
// Inicialização: Listener de Mudanças de Auth + Sessão Inicial
// =============================================================================

let listenerRegistrado = false;

export async function inicializarAuth() {
  if (listenerRegistrado) return;
  listenerRegistrado = true;

  console.log('[Auth] Inicializando sistema de autenticação...');

  // 1. Listener para mudanças de estado (login, logout, refresh token)
  supabase.auth.onAuthStateChange(async (event, sessao) => {
    console.log('[Auth] Evento:', event, sessao ? 'com sessão' : 'sem sessão');

    switch (event) {
      case 'INITIAL_SESSION':
        // Sessão recuperada do storage ao carregar a página
        if (sessao?.user) {
          await processarLogin(sessao, sessao.user);
        } else {
          marcarInicializado(false);
          dispararEvento('auth:pronto', { autenticado: false });
        }
        break;

      case 'SIGNED_IN':
        // Login bem-sucedido (após OAuth redirect)
        if (sessao?.user) {
          await processarLogin(sessao, sessao.user);
        }
        break;

      case 'SIGNED_OUT':
        // Logout
        processarLogout();
        break;

      case 'TOKEN_REFRESHED':
        // Token renovado automaticamente
        if (sessao?.user) {
          atualizarEstadoAuth(sessao, sessao.user, estadoAuth.estudioId);
          dispararEvento('auth:token-refresh', { sessao });
        }
        break;

      case 'USER_UPDATED':
        // Perfil atualizado
        if (sessao?.user) {
          atualizarEstadoAuth(sessao, sessao.user, estadoAuth.estudioId);
        }
        break;

      default:
        console.log('[Auth] Evento não tratado:', event);
    }
  });

  // 2. Tentar recuperar sessão existente ao carregar
  // (onAuthStateChange com INITIAL_SESSION já faz isso, mas garantimos)
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await processarLogin(session, session.user);
  } else {
    marcarInicializado(false);
    dispararEvento('auth:pronto', { autenticado: false });
  }
}

/**
 * Processa login bem-sucedido: busca estudio_id e atualiza estado
 */
async function processarLogin(sessao, usuario) {
  try {
    // Buscar estudio_id vinculado a este usuário
    const estudioId = await buscarEstudioIdDoUsuario(usuario.id);

    atualizarEstadoAuth(sessao, usuario, estudioId);

    console.log('[Auth] Login processado:', {
      userId: usuario.id,
      email: usuario.email,
      estudioId
    });

    dispararEvento('auth:login', {
      usuario,
      estudioId,
      sessao
    });
  } catch (err) {
    console.error('[Auth] Erro ao processar login:', err);
    dispararEvento('auth:erro', {
      mensagem: 'Erro ao finalizar login. Recarregue a página.',
      erro: err
    });
  }
}

/**
 * Processa logout: limpa estado
 */
function processarLogout(motivo = 'logout') {
  const usuarioAnterior = estadoAuth.usuario;
  limparEstadoAuth();

  console.log('[Auth] Logout processado:', { motivo, usuarioAnterior: usuarioAnterior?.id });

  dispararEvento('auth:logout', { motivo, usuarioAnterior });
}

// =============================================================================
// Auto-inicialização quando o módulo carrega
// =============================================================================

// Garante que inicializa antes dos scripts clássicos (navegacao.js, app.js)
// que dependem de window.NailFlow.auth
inicializarAuth().catch(err => {
  console.error('[Auth] Falha na inicialização:', err);
  dispararEvento('auth:erro', {
    mensagem: 'Falha ao inicializar autenticação.',
    erro: err
  });
});

// =============================================================================
// Exporta estado para debug (somente leitura via getters)
// =============================================================================

export const authState = {
  get sessao() { return estadoAuth.sessao; },
  get usuario() { return estadoAuth.usuario; },
  get estudioId() { return estadoAuth.estudioId; },
  get autenticado() { return !!estadoAuth.sessao && !!estadoAuth.usuario; },
  get inicializado() { return estadoAuth.inicializado; },
};