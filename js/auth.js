/**
 * Módulo de Autenticação - NailFlow
 * Gerencia login por e-mail/senha, logout, sessão e estado global via CustomEvents
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
// Helpers de Fluxo Especial (convite / recuperação de senha)
// =============================================================================

/**
 * Verifica se a URL atual indica fluxo de convite ou recuperação de senha.
 * Deve ser chamado ANTES de qualquer limpeza do hash.
 * @returns {boolean}
 */
function isFluxoConviteOuRecovery() {
  try {
    const hash = window?.location?.hash?.substring(1);
    if (!hash) return false;
    const params = new URLSearchParams(hash);
    const type = params.get('type');
    return type === 'invite' || type === 'recovery';
  } catch {
    // Em ambientes sem window.location (ex: testes), assume fluxo normal
    return false;
  }
}

/**
 * Verifica se já detectamos um fluxo especial (invite/recovery) nesta sessão.
 * Esta variável é definida UMA VEZ na inicialização e NÃO depende do hash da URL.
 * Isso permite que os guards funcionem mesmo após o hash ser limpo pelo navegacao.js.
 * @returns {boolean}
 */
function isFluxoEspecialDetectado() {
  return estadoAuth._fluxoEspecialDetectado === true;
}

/**
 * Captura a intenção de fluxo especial (invite/recovery) na inicialização.
 * - Define flag interna persistente (_fluxoEspecialDetectado)
 * - Opcionalmente salva em sessionStorage para sobreviver a F5 (apenas navegação, NÃO autorização)
 * - Deve ser chamado ANTES de qualquer processamento assíncrono que possa limpar o hash
 */
function capturarIntencaoFluxoEspecial() {
  const fluxoEspecial = isFluxoConviteOuRecovery();
  if (fluxoEspecial) {
    console.log('[Auth] Fluxo especial detectado na inicialização (invite/recovery)');
    estadoAuth._fluxoEspecialDetectado = true;
    estadoAuth.emRedefinicaoSenha = true;
    window.NailFlow.auth.emRedefinicaoSenha = true;

    // Persistir apenas a INTENÇÃO DE NAVEGAÇÃO (não autorização) para sobreviver a F5
    // Isso permite que, após reload, a UI saiba mostrar a tela de redefinição de senha
    // O Supabase ainda precisa validar o token/sessão - o sessionStorage NÃO substitui isso
    try {
      sessionStorage.setItem('nailflow_fluxo_especial', 'true');
    } catch {
      // Ignorar erros de sessionStorage (ex: navegação privada)
    }
  } else {
    // Verificar se há intenção salva em sessionStorage (após F5)
    // Só usar isso para DECIDIR QUAL TELA MOSTRAR, nunca para autorizar
    try {
      const salvo = sessionStorage.getItem('nailflow_fluxo_especial');
      if (salvo === 'true') {
        console.log('[Auth] Intenção de fluxo especial restaurada do sessionStorage (pós-F5)');
        estadoAuth._fluxoEspecialDetectado = true;
        estadoAuth.emRedefinicaoSenha = true;
        window.NailFlow.auth.emRedefinicaoSenha = true;
        // NÃO disparar auth:password-recovery aqui — pode acontecer antes dos listeners do navegacao.js
        // O estado será refletido via auth:pronto (que inclui emRedefinicaoSenha)
        // e o PASSWORD_RECOVERY real do Supabase disparará o evento quando processar o token
      }
    } catch {
      // Ignorar
    }
  }
}

/**
 * Limpa o estado de fluxo especial (após sucesso da redefinição de senha, logout, etc.)
 * Remove flag interna e sessionStorage.
 */
function limparFluxoEspecial() {
  estadoAuth._fluxoEspecialDetectado = false;
  estadoAuth.emRedefinicaoSenha = false;
  window.NailFlow.auth.emRedefinicaoSenha = false;
  try {
    sessionStorage.removeItem('nailflow_fluxo_especial');
  } catch {
    // Ignorar
  }
}

/**
 * Limpa o estado de fluxo especial por ABANDONO do usuário.
 * Diferente de limparFluxoEspecial(), esta função é chamada quando o usuário
 * sai do fluxo sem concluir (ex: navega para outra tela, link expirado, login convencional).
 * NÃO deve ser chamada enquanto o fluxo especial ainda estiver sendo processado pelo Supabase.
 */
export function abandonarFluxoEspecial(motivo) {
  if (!estadoAuth._fluxoEspecialDetectado) return;

  console.log('[Auth] Fluxo especial abandonado:', motivo);
  limparFluxoEspecial();

  // Dispara evento para UI saber que saiu do fluxo de redefinição
  // (ex: navegacao.js pode redirecionar para login se necessário)
  dispararEvento('auth:special-flow-abandoned', { motivo });
}

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
  // Fluxo de redefinição de senha
  emRedefinicaoSenha: false,
  // Fluxo especial detectado (invite/recovery) - persistente, não depende do hash
  _fluxoEspecialDetectado: false,
  // Deduplicação: último userId processado com sucesso (limpo no logout)
  _ultimoUserIdProcessado: null,
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
  emRedefinicaoSenha: false,
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
    // NÃO mascarar erros reais (rede, RLS, etc.) como "sem vínculo"
    // PGRST116 já foi tratado acima; outros erros devem propagar
    console.error('[Auth] Erro ao buscar estudio_id:', err);
    throw err;
  }
}

// =============================================================================
// Atualizar estado interno e window.NailFlow.auth (síncrono)
// =============================================================================

function atualizarEstadoAuth(sessao, usuario, estudioId, emRedefinicaoSenha = false) {
  const autenticado = !!sessao && !!usuario;
  const autorizado = autenticado && !!estudioId;

  estadoAuth.sessao = sessao;
  estadoAuth.usuario = usuario;
  estadoAuth.estudioId = estudioId;
  estadoAuth.inicializado = true;
  estadoAuth.autenticado = autenticado;
  estadoAuth.autorizado = autorizado;
  estadoAuth.emRedefinicaoSenha = emRedefinicaoSenha;

  window.NailFlow.auth.sessao = sessao;
  window.NailFlow.auth.usuario = usuario;
  window.NailFlow.auth.estudioId = estudioId;
  window.NailFlow.auth.autenticado = autenticado;
  window.NailFlow.auth.autorizado = autorizado;
  window.NailFlow.auth.inicializado = true;
  window.NailFlow.auth.emRedefinicaoSenha = emRedefinicaoSenha;
}

function limparEstadoAuth() {
  estadoAuth.sessao = null;
  estadoAuth.usuario = null;
  estadoAuth.estudioId = null;
  estadoAuth.inicializado = true;
  estadoAuth.autenticado = false;
  estadoAuth.autorizado = false;
  estadoAuth.emRedefinicaoSenha = false;
  estadoAuth._ultimoUserIdProcessado = null; // Limpa deduplicação para permitir novo login

  window.NailFlow.auth.sessao = null;
  window.NailFlow.auth.usuario = null;
  window.NailFlow.auth.estudioId = null;
  window.NailFlow.auth.autenticado = false;
  window.NailFlow.auth.autorizado = false;
  window.NailFlow.auth.inicializado = true;
  window.NailFlow.auth.emRedefinicaoSenha = false;
}

function marcarInicializado(autenticado = false, autorizado = false, emRedefinicaoSenha = false) {
  estadoAuth.inicializado = true;
  estadoAuth.autenticado = autenticado;
  estadoAuth.autorizado = autorizado;
  estadoAuth.emRedefinicaoSenha = emRedefinicaoSenha;

  window.NailFlow.auth.inicializado = true;
  window.NailFlow.auth.autenticado = autenticado;
  window.NailFlow.auth.autorizado = autorizado;
  window.NailFlow.auth.emRedefinicaoSenha = emRedefinicaoSenha;
}

// =============================================================================
// API Pública
// =============================================================================

/**
 * Realiza login com email e senha
 * @param {string} email - Email do usuário
 * @param {string} senha - Senha do usuário
 */
export async function loginComEmail(email, senha) {
  // Iniciar login convencional abandona qualquer fluxo especial pendente
  // (ex: usuário clicou em link de convite mas depois fez login normal)
  abandonarFluxoEspecial('login-convencional');

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
 * Atualiza a senha do usuário (usado no fluxo de recuperação de senha)
 * @param {string} novaSenha - Nova senha do usuário
 */
export async function atualizarSenha(novaSenha) {
  try {
    // REQUER sessão válida do Supabase (token de recuperação ativo).
    // O sessionStorage NÃO substitui a validação do Supabase.
    // Se não houver sessão válida, o Supabase retornará erro.
    const { error, data } = await supabase.auth.updateUser({
      password: novaSenha
    });
    if (error) throw error;

    // updateUser() retorna o usuário atualizado em data.user
    // A sessão não é retornada pelo updateUser(); precisamos buscá-la com getSession()
    const usuario = data?.user;
    if (!usuario) {
      throw new Error('Usuário não retornado pelo Supabase após atualização de senha');
    }

    // Recuperar a sessão atual para confirmar autenticação
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;

    const sessao = sessionData?.session;

    // Determinar estado de autorização após atualização bem-sucedida
    // Buscar estudioId para saber se usuário tem vínculo com estúdio
    let estudioId = null;
    if (usuario) {
      estudioId = await buscarEstudioIdDoUsuario(usuario.id);
    }

    const autenticado = !!sessao && !!usuario;
    const autorizado = autenticado && !!estudioId;

    // Atualizar estado interno com o estado real de autorização
    atualizarEstadoAuth(sessao, usuario, estudioId);

    // Sucesso: limpa o estado de fluxo especial completamente (flag interna + sessionStorage)
    limparFluxoEspecial();

    // Remove o token da URL por segurança
    if (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token')) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    // Dispara evento com informação completa de autorização para navegação decidir o fluxo
    // NÃO incluir sessão (contém access_token/refresh_token) - apenas dados mínimos necessários
    dispararEvento('auth:password-updated', {
      sucesso: true,
      autenticado,
      autorizado,
      estudioId,
      usuario: usuario ? { id: usuario.id, email: usuario.email } : null
    });

    // Também dispara eventos padrão de auth para manter consistência
    if (autenticado) {
      dispararEvento('auth:authenticated', { usuario, sessao });
      if (autorizado) {
        dispararEvento('auth:login', { usuario, estudioId, sessao });
      } else {
        dispararEvento('auth:unauthorized', {
          usuario,
          sessao,
          mensagem: 'Sua conta não está vinculada a nenhum estúdio. Entre em contato com o suporte: nailflow.suporte@outlook.com'
        });
        dispararEvento('auth:pronto', { autenticado: true, autorizado: false });
      }
    }

    return { sucesso: true, autenticado, autorizado, estudioId };
  } catch (err) {
    console.error('[Auth] Erro ao atualizar senha:', err);

    let mensagem = 'Erro ao salvar nova senha. Tente novamente.';

    if (err.message) {
      const msg = err.message.toLowerCase();
      if (msg.includes('weak password') || msg.includes('senha fraca')) {
        mensagem = 'A senha é muito fraca. Use pelo menos 6 caracteres.';
      } else if (msg.includes('same password') || msg.includes('mesma senha')) {
        mensagem = 'A nova senha deve ser diferente da anterior.';
      } else if (msg.includes('session expired') || msg.includes('token expired') || msg.includes('expirado')) {
        mensagem = 'O link de recuperação expirou. Solicite um novo e-mail.';
        // Link expirado = fluxo especial abandonado
        abandonarFluxoEspecial('token-expirado');
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

  // Capturar intenção de fluxo especial (invite/recovery) ANTES de qualquer processamento
  // Isso define _fluxoEspecialDetectado e emRedefinicaoSenha, e opcionalmente salva no sessionStorage
  // para sobreviver a F5. O sessionStorage é APENAS para intenção de NAVEGAÇÃO (mostrar tela correta),
  // NÃO para autorização - o Supabase valida o token/sessão.
  capturarIntencaoFluxoEspecial();

  // 1. Listener para mudanças de estado (login, logout, refresh token)
  // IMPORTANTE: Callback síncrono - NÃO fazer chamadas async/await aqui
  // O processamento assíncrono (buscar estudioId) é delegado para processarLoginAsync
  supabase.auth.onAuthStateChange((event, sessao) => {
    console.log('[Auth] Evento:', event, sessao ? 'com sessão' : 'sem sessão');

    switch (event) {
      case 'INITIAL_SESSION':
        // Sessão recuperada do storage ao carregar a página
        if (sessao?.user) {
          // Se há fluxo especial detectado, não processar como login convencional
          // Usamos isFluxoEspecialDetectado() que NÃO depende do hash (que pode ter sido limpo)
          if (isFluxoEspecialDetectado()) {
            console.log('[Auth] INITIAL_SESSION: fluxo especial detectado — ignorando processarLoginAsync');
            // Ainda marca como inicializado para não bloquear a navegação
            marcarInicializado(true, false, true);
            dispararEvento('auth:pronto', { autenticado: true, autorizado: false, emRedefinicaoSenha: true });
          } else {
            // Dispara processamento assíncrono sem bloquear o callback
            processarLoginAsync(sessao, sessao.user);
          }
        } else {
          // Sem sessão: se há fluxo especial detectado (ex: link de convite/recovery),
          // preservar emRedefinicaoSenha — o Supabase pode ainda não ter processado o token
          if (isFluxoEspecialDetectado()) {
            console.log('[Auth] INITIAL_SESSION: sem sessão, mas fluxo especial ativo — preservando estado');
            marcarInicializado(false, false, true);
            dispararEvento('auth:pronto', { autenticado: false, autorizado: false, emRedefinicaoSenha: true });
          } else {
            marcarInicializado(false, false);
            dispararEvento('auth:pronto', { autenticado: false, autorizado: false, emRedefinicaoSenha: false });
          }
        }
        break;

      case 'SIGNED_IN':
        // Login bem-sucedido (após OAuth redirect)
        if (sessao?.user) {
          // Verificar se é um convite (type=invite na URL hash)
          // O Supabase processa o token de convite, cria sessão e dispara SIGNED_IN
          // Mas deve mostrar o formulário de definição de senha, não abrir o app
          const _hashParams = new URLSearchParams(window.location.hash.substring(1));
          if (_hashParams.get('type') === 'invite') {
            console.log('[Auth] Convite detectado no SIGNED_IN - disparando auth:password-recovery');
            // Usa dispararEvento() que dispara em window (consistente com listeners do navegacao.js)
            dispararEvento('auth:password-recovery', { sessao, usuario: sessao.user });
            return;
          }
          // Se fluxo especial já foi detectado (ex: type=recovery), não sobrescrever
          // Usamos isFluxoEspecialDetectado() que NÃO depende do hash (que pode ter sido limpo)
          if (isFluxoEspecialDetectado()) {
            console.log('[Auth] SIGNED_IN: fluxo especial detectado — ignorando processarLoginAsync');
            return;
          }
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

      case 'PASSWORD_RECOVERY':
        // Usuário clicou no link de recuperação de senha no e-mail
        // A sessão contém um token de recuperação - mostrar tela de redefinição
        console.log('[Auth] PASSWORD_RECOVERY detectado - exibindo tela de redefinição de senha');

        // Marcar fluxo especial como detectado (prioridade sobre login convencional)
        // Isso impede que processarLoginAsync iniciado anteriormente continue
        if (!estadoAuth._fluxoEspecialDetectado) {
          console.log('[Auth] PASSWORD_RECOVERY: marcando fluxo especial como detectado');
          estadoAuth._fluxoEspecialDetectado = true;
          // Persistir intenção de navegação no sessionStorage para sobreviver a F5
          try {
            sessionStorage.setItem('nailflow_fluxo_especial', 'true');
          } catch {
            // Ignorar erros de sessionStorage (ex: navegação privada)
          }
        }

        if (sessao?.user) {
          atualizarEstadoAuth(sessao, sessao.user, null, true);
          dispararEvento('auth:password-recovery', { sessao, usuario: sessao.user });
        } else {
          // Se não há sessão mas há evento, pode ser que o token esteja na URL
          // Marca como em redefinição para a UI mostrar a tela
          estadoAuth.emRedefinicaoSenha = true;
          window.NailFlow.auth.emRedefinicaoSenha = true;
          dispararEvento('auth:password-recovery', { sessao: null, usuario: null });
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
    // Se fluxo especial detectado, não processar como login convencional
    // Usamos isFluxoEspecialDetectado() que NÃO depende do hash (que pode ter sido limpo)
    if (isFluxoEspecialDetectado()) {
      console.log('[Auth] getSession: fluxo especial detectado — ignorando processarLoginAsync');
      marcarInicializado(true, false, true);
      dispararEvento('auth:pronto', { autenticado: true, autorizado: false, emRedefinicaoSenha: true });
    } else {
      await processarLoginAsync(session, session.user);
    }
  } else {
    // Sem sessão: se há fluxo especial detectado (ex: link de convite/recovery),
    // NÃO resetar emRedefinicaoSenha — o Supabase pode ainda não ter processado o token
    if (isFluxoEspecialDetectado()) {
      console.log('[Auth] getSession: sem sessão, mas fluxo especial ativo — preservando estado');
      marcarInicializado(false, false, true);
      dispararEvento('auth:pronto', { autenticado: false, autorizado: false, emRedefinicaoSenha: true });
    } else {
      marcarInicializado(false, false);
      dispararEvento('auth:pronto', { autenticado: false, autorizado: false, emRedefinicaoSenha: false });
    }
  }
}

/**
 * Processa login bem-sucedido de forma assíncrona (fora do callback onAuthStateChange)
 * Busca estudio_id e atualiza estado, disparando eventos apropriados
 */
async function processarLoginAsync(sessao, usuario) {
  // Guard: se fluxo especial detectado, não processar como login convencional
  // Isso evita sobrescrever emRedefinicaoSenha=true com false
  // Usamos isFluxoEspecialDetectado() que NÃO depende do hash (que pode ter sido limpo)
  if (isFluxoEspecialDetectado()) {
    console.log('[Auth] processarLoginAsync: fluxo especial detectado — abortando processamento convencional');
    return;
  }

  // Deduplicação SÍNCRONA: checa e marca ANTES de qualquer await
  // Evita que chamadas concorrentes (getSession + INITIAL_SESSION + SIGNED_IN) processem o mesmo login
  if (estadoAuth._ultimoUserIdProcessado === usuario.id) {
    console.log('[Auth] Login duplicado ignorado para userId:', usuario.id);
    return;
  }

  // Marca como "em processamento" para bloquear outras chamadas concorrentes para o mesmo userId
  estadoAuth._ultimoUserIdProcessado = usuario.id;

  try {
    // Buscar estudio_id vinculado a este usuário
    let estudioId;
    try {
      estudioId = await buscarEstudioIdDoUsuario(usuario.id);
    } catch (err) {
      // Erro real ao consultar vínculo (rede, RLS, etc.) — não é "sem estúdio"
      // Limpa marca de deduplicação e propaga como erro de autenticação
      estadoAuth._ultimoUserIdProcessado = null;
      console.error('[Auth] Erro ao buscar vínculo com estúdio:', err);
      dispararEvento('auth:erro', {
        mensagem: 'Erro ao verificar vínculo com estúdio. Tente novamente.',
        erro: err
      });
      return;
    }

    // Guard 2: Verificar novamente se fluxo especial foi iniciado durante a consulta assíncrona
    // (ex: PASSWORD_RECOVERY chegou enquanto buscávamos o vínculo com estúdio)
    if (isFluxoEspecialDetectado()) {
      console.log('[Auth] processarLoginAsync: fluxo especial detectado APÓS consulta — abortando processamento convencional');
      // IMPORTANTE: Limpar a marca de deduplicação para permitir login futuro
      // Não emitir eventos de login convencional
      estadoAuth._ultimoUserIdProcessado = null;
      return;
    }

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
    // Em caso de erro, limpa a marca para permitir retry
    estadoAuth._ultimoUserIdProcessado = null;
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
  // Também limpa estado de fluxo especial para não interferir em login posterior
  limparFluxoEspecial();

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

// Expor helper de teste para window.NailFlow.auth (não usado em produção)
// Colocado aqui para garantir que window.NailFlow.auth já existe
if (typeof window !== 'undefined' && window.NailFlow && window.NailFlow.auth) {
  window.NailFlow.auth._abandonarFluxoEspecial = abandonarFluxoEspecial;
}

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