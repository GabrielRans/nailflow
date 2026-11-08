/**
 * Módulo de Autenticação - NailFlow
 * Gerencia login Google OAuth, logout, sessão e estado global via CustomEvents
 *
 * Separação de responsabilidades:
 * - AUTENTICAÇÃO (AuthN): Identidade verificada via Google OAuth (sessão válida, usuário conhecido)
 * - AUTORIZAÇÃO (AuthZ): Acesso ao NailFlow requer vínculo com um estúdio (estudioId válido)
 *
 * Eventos disparados:
 * - auth:login       → detail: { usuario, estudioId, sessao } (após AuthN + AuthZ OK)
 * - auth:authenticated → detail: { usuario, sessao } (apenas AuthN OK, sem estudioId)
 * - auth:unauthorized  → detail: { usuario, sessao, mensagem } (AuthN OK, mas sem AuthZ)
 * - auth:logout      → detail: { motivo }
 * - auth:erro        → detail: { mensagem, erro }
 * - auth:pronto      → detail: { autenticado, autorizado } (estado inicial após init)
 * - auth:token-refresh → detail: { sessao }
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
  autenticado: false,    // AuthN: tem sessão válida + usuário
  autorizado: false,     // AuthZ: tem estudioId válido (vínculo com estúdio)
};

// Fallback síncrono para scripts clássicos (não ES modules)
// Objeto plano mutável - propriedades atualizadas diretamente
window.NailFlow = window.NailFlow || {};
window.NailFlow.auth = {
  sessao: null,
  usuario: null,
  estudioId: null,
  autenticado: false,    // AuthN
  autorizado: false,     // AuthZ
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
  const autenticado = !!sessao && !!usuario;
  const autorizado = autenticado && !!estudioId;

  estadoAuth.sessao = sessao;
  estadoAuth.usuario = usuario;
  estadoAuth.estudioId = estudioId;
  estadoAuth.inicializado = true;
  estadoAuth.autenticado = autenticado;
  estadoAuth.autorizado = autorizado;

  window.NailFlow.auth.sessao = sessao;
  window.NailFlow.auth.usuario = usuario;
  window.NailFlow.auth.estudioId = estudioId;
  window.NailFlow.auth.autenticado = autenticado;
  window.NailFlow.auth.autorizado = autorizado;
  window.NailFlow.auth.inicializado = true;
}

function limparEstadoAuth() {
  estadoAuth.sessao = null;
  estadoAuth.usuario = null;
  estadoAuth.estudioId = null;
  estadoAuth.inicializado = true;
  estadoAuth.autenticado = false;
  estadoAuth.autorizado = false;

  window.NailFlow.auth.sessao = null;
  window.NailFlow.auth.usuario = null;
  window.NailFlow.auth.estudioId = null;
  window.NailFlow.auth.autenticado = false;
  window.NailFlow.auth.autorizado = false;
  window.NailFlow.auth.inicializado = true;
}

function marcarInicializado(autenticado = false, autorizado = false) {
  estadoAuth.inicializado = true;
  estadoAuth.autenticado = autenticado;
  estadoAuth.autorizado = autorizado;

  window.NailFlow.auth.inicializado = true;
  window.NailFlow.auth.autenticado = autenticado;
  window.NailFlow.auth.autorizado = autorizado;
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
 * Realiza login com email e senha
 * @param {string} email - Email do usuário
 * @param {string} senha - Senha do usuário
 */
export async function loginComEmail(email, senha) {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    if (error) throw error;

    // onAuthStateChange('SIGNED_IN') disparará processarLoginAsync
    // Não precisamos fazer nada aqui, o fluxo segue pelo listener
  } catch (err) {
    console.error('[Auth] Erro ao fazer login com email:', err);

    // Mapear erros comuns do Supabase para mensagens amigáveis
    let mensagem = 'Erro ao fazer login. Verifique suas credenciais e tente novamente.';

    if (err.message) {
      const msg = err.message.toLowerCase();
      if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
        mensagem = 'E-mail ou senha incorretos. Tente novamente.';
      } else if (msg.includes('email not confirmed')) {
        mensagem = 'E-mail não confirmado. Verifique sua caixa de entrada.';
      } else if (msg.includes('too many requests')) {
        mensagem = 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
      }
    }

    dispararEvento('auth:erro', {
      mensagem,
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
 * AuthN: sessão + usuário válidos
 * @returns {boolean}
 */
export function estaAutenticado() {
  return estadoAuth.autenticado;
}

/**
 * Verifica se o usuário está autorizado (AuthN + AuthZ)
 * Requer sessão válida + estudioId (vínculo com estúdio)
 * @returns {boolean}
 */
export function estaAutorizado() {
  return estadoAuth.autorizado;
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
  // IMPORTANTE: Callback síncrono - NÃO fazer chamadas async/await aqui
  // O processamento assíncrono (buscar estudioId) é delegado para processarLoginAsync
  supabase.auth.onAuthStateChange((event, sessao) => {
    console.log('[Auth] Evento:', event, sessao ? 'com sessão' : 'sem sessão');

    switch (event) {
      case 'INITIAL_SESSION':
        // Sessão recuperada do storage ao carregar a página
        if (sessao?.user) {
          // Dispara processamento assíncrono sem bloquear o callback
          processarLoginAsync(sessao, sessao.user);
        } else {
          marcarInicializado(false, false);
          dispararEvento('auth:pronto', { autenticado: false, autorizado: false });
        }
        break;

      case 'SIGNED_IN':
        // Login bem-sucedido (após OAuth redirect)
        if (sessao?.user) {
          processarLoginAsync(sessao, sessao.user);
        }
        break;

      case 'SIGNED_OUT':
        // Logout
        processarLogout();
        break;

      case 'TOKEN_REFRESHED':
        // Token renovado automaticamente - mantém estado atual
        if (sessao?.user) {
          atualizarEstadoAuth(sessao, sessao.user, estadoAuth.estudioId);
          dispararEvento('auth:token-refresh', { sessao });
        }
        break;

      case 'USER_UPDATED':
        // Perfil atualizado - mantém estado atual
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
    await processarLoginAsync(session, session.user);
  } else {
    marcarInicializado(false, false);
    dispararEvento('auth:pronto', { autenticado: false, autorizado: false });
  }
}

/**
 * Processa login bem-sucedido de forma assíncrona (fora do callback onAuthStateChange)
 * Busca estudio_id e atualiza estado, disparando eventos apropriados
 */
async function processarLoginAsync(sessao, usuario) {
  try {
    // Buscar estudio_id vinculado a este usuário
    const estudioId = await buscarEstudioIdDoUsuario(usuario.id);

    const autenticado = true;
    const autorizado = !!estudioId;

    atualizarEstadoAuth(sessao, usuario, estudioId);

    console.log('[Auth] Login processado:', {
      userId: usuario.id,
      email: usuario.email,
      estudioId,
      autenticado,
      autorizado
    });

    // Sempre dispara auth:authenticated (AuthN OK)
    dispararEvento('auth:authenticated', {
      usuario,
      sessao
    });

    if (autorizado) {
      // AuthN + AuthZ OK - usuário pode acessar o app
      dispararEvento('auth:login', {
        usuario,
        estudioId,
        sessao
      });
    } else {
      // AuthN OK mas sem AuthZ - usuário autenticado mas sem estúdio vinculado
      dispararEvento('auth:unauthorized', {
        usuario,
        sessao,
        mensagem: 'Sua conta não está vinculada a nenhum estúdio. Entre em contato com o suporte: nailflow.suporte@outlook.com'
      });
      // Também dispara auth:pronto com autorizado=false para UI saber o estado
      dispararEvento('auth:pronto', { autenticado: true, autorizado: false });
    }
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
  get autenticado() { return estadoAuth.autenticado; },
  get autorizado() { return estadoAuth.autorizado; },
  get inicializado() { return estadoAuth.inicializado; },
};