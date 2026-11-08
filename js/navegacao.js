/**
 * Navegação com Hash Routing + Proteção de Rotas por Autenticação e Autorização
 * Integra com eventos CustomEvents do módulo auth.js
 *
 * Proteção em duas camadas:
 * - Autenticação (AuthN): usuário logado via Google OAuth
 * - Autorização (AuthZ): usuário vinculado a um estúdio (estudioId válido)
 * Rotas protegidas exigem AMBAS as condições
 */

const ROTAS_VALIDAS = new Set([
  "dashboard",
  "financeiro",
  "movimentacao",
  "materiais",
  "cadastro-material",
  "login"  // rota pública de login
]);

// Rotas que exigem autenticação E autorização (estudioId)
const ROTAS_PROTEGIDAS = new Set([
  "dashboard",
  "financeiro",
  "movimentacao",
  "materiais",
  "cadastro-material"
]);

let focoEdicaoPendente = false;
let botaoOrigemEdicao = null;
let rotaAnterior = null;
let authInicializado = false;

/**
 * Verifica se usuário está autenticado (AuthN: sessão + usuário válidos)
 */
function estaAutenticado() {
  return window.NailFlow?.auth?.autenticado === true;
}

/**
 * Verifica se usuário está autorizado (AuthN + AuthZ: estudioId válido)
 * Rotas protegidas exigem AMBAS as condições
 */
function estaAutorizado() {
  return window.NailFlow?.auth?.autorizado === true;
}

/**
 * Obtém a rota atual do hash
 */
function obterRotaAtual() {
  const rota = window.location.hash.slice(1);
  return ROTAS_VALIDAS.has(rota) ? rota : "dashboard";
}

/**
 * Exibe a tela correspondente à rota
 */
function exibirTela(rota) {
  const telas = document.querySelectorAll("[data-tela]");
  telas.forEach((tela) => {
    tela.hidden = tela.dataset.tela !== rota;
  });
}

/**
 * Alterna visibilidade do app logado vs tela de login
 */
function alternarVisibilidadeApp(autenticado) {
  const appLogado = document.getElementById("app-logado");
  const telaLogin = document.getElementById("tela-login");
  const btnLogout = document.getElementById("btn-logout");

  if (appLogado) appLogado.hidden = !autenticado;
  if (telaLogin) telaLogin.hidden = autenticado;
  if (btnLogout) btnLogout.hidden = !autenticado;
}

/**
 * Redireciona para login se rota protegida e não autenticado/autorizado
 * Rotas protegidas exigem: autenticação (AuthN) + autorização (AuthZ = estudioId válido)
 */
function protegerRota(rota) {
  if (ROTAS_PROTEGIDAS.has(rota)) {
    if (!estaAutenticado()) {
      console.log('[Navegação] Rota protegida acessada sem autenticação → redirecionando para #login');
      window.location.hash = "#login";
      return false;
    }
    if (!estaAutorizado()) {
      console.log('[Navegação] Rota protegida acessada sem autorização (sem estúdio vinculado) → redirecionando para #login');
      window.location.hash = "#login";
      return false;
    }
  }
  return true;
}

/**
 * Atualiza navegação: protege rota, exibe tela, gerencia foco e estado ativo
 */
function atualizarNavegacao(gerenciarFocoAtivo = true) {
  // Aguardar auth inicializar antes de processar rota protegida
  if (!authInicializado) {
    console.log('[Navegação] Aguardando auth inicializar...');
    // Reagenda após auth:pronto
    return;
  }

  const rota = obterRotaAtual();

  // Proteger rota antes de exibir
  if (!protegerRota(rota)) {
    return; // Redirecionou para login
  }

  exibirTela(rota);
  alternarVisibilidadeApp(estaAutenticado());

  const areaPrincipal = {
    movimentacao: "financeiro",
    "cadastro-material": "materiais"
  }[rota] ?? rota;

  document.querySelectorAll("[data-rota]").forEach((link) => {
    if (link.dataset.rota === areaPrincipal) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const modoEdicao = rota === "movimentacao" && focoEdicaoPendente;
  const retornandoDaEdicao = rotaAnterior === "movimentacao" && rota === "financeiro" && botaoOrigemEdicao !== null;
  const origemDisponivel = retornandoDaEdicao && botaoOrigemEdicao.isConnected && !botaoOrigemEdicao.disabled;

  focoEdicaoPendente = false;

  if (gerenciarFocoAtivo) {
    if (origemDisponivel) {
      botaoOrigemEdicao.focus();
      botaoOrigemEdicao.scrollIntoView({ behavior: "auto", block: "nearest" });
    } else {
      gerenciarFoco(rota, modoEdicao);
    }
  }

  if (retornandoDaEdicao || rota !== "movimentacao") {
    botaoOrigemEdicao = null;
  }

  rotaAnterior = rota;
}

/**
 * Navega para edição de movimentação
 */
function navegarParaEdicao(botaoOrigem) {
  botaoOrigemEdicao = botaoOrigem;
  focoEdicaoPendente = true;

  if (window.location.hash !== "#movimentacao") {
    window.location.hash = "#movimentacao";
  } else {
    atualizarNavegacao();
  }
}

/**
 * Gerencia foco ao entrar em uma tela
 */
function gerenciarFoco(rota, modoEdicao = false) {
  const tela = document.querySelector(`[data-tela="${rota}"]`);
  if (!tela) return;

  const destino = modoEdicao ? tela.querySelector("#tipo") : tela.querySelector("h2");
  destino?.focus();
  tela.scrollIntoView({ behavior: "auto", block: "start" });
}

/**
 * Handler do botão logout
 */
function configurarLogout() {
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", async () => {
      try {
        // Importa dinamicamente o módulo auth (ES Module)
        const { logout } = await import("./auth.js");
        await logout();
        // auth:logout event tratará a UI
      } catch (err) {
        console.error('[Navegação] Erro ao fazer logout:', err);
      }
    });
  }
}

/**
 * Handler do botão login Google
 */
function configurarLogin() {
  const btnLogin = document.getElementById("btn-login-google");
  if (btnLogin) {
    btnLogin.addEventListener("click", async () => {
      try {
        btnLogin.disabled = true;
        btnLogin.setAttribute("aria-busy", "true");
        const { loginComGoogle } = await import("./auth.js");
        await loginComGoogle();
        // onAuthStateChange → auth:login → UI atualizada
      } catch (err) {
        console.error('[Navegação] Erro ao iniciar login:', err);
        btnLogin.disabled = false;
        btnLogin.setAttribute("aria-busy", "false");
        btnLogin.innerHTML = `
          <svg class="google-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          <span>Entrar com Google</span>
        `;
      }
    });
  }
}

/**
 * Handler do formulário de login com email/senha
 */
function configurarLoginEmail() {
  const form = document.getElementById("form-login");
  if (!form) return;

  const btnLogin = document.getElementById("btn-login-email");
  const btnToggleSenha = document.getElementById("btn-toggle-senha");
  const inputSenha = document.getElementById("senha");
  const inputEmail = document.getElementById("email");
  const erroEmail = document.getElementById("email-erro");
  const erroSenha = document.getElementById("senha-erro");
  const erroLogin = document.getElementById("login-erro");

  // Toggle visibilidade da senha
  if (btnToggleSenha && inputSenha) {
    btnToggleSenha.addEventListener("click", () => {
      const isPassword = inputSenha.type === "password";
      inputSenha.type = isPassword ? "text" : "password";
      btnToggleSenha.setAttribute("aria-pressed", isPassword.toString());
      btnToggleSenha.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
    });
  }

  // Handler "Esqueceu a senha?"
  const linkEsqueciSenha = document.getElementById("link-esqueci-senha");
  if (linkEsqueciSenha) {
    linkEsqueciSenha.addEventListener("click", async (event) => {
      event.preventDefault();
      const email = inputEmail?.value?.trim();
      if (!email) {
        alert("Informe seu e-mail no campo acima para recuperar a senha.");
        inputEmail?.focus();
        return;
      }
      try {
        const { supabase } = await import("./supabase-client.js");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        alert("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
      } catch (err) {
        console.error('[Navegação] Erro ao enviar e-mail de recuperação:', err);
        alert("Não foi possível enviar o e-mail de recuperação. Tente novamente.");
      }
    });
  }

  // Limpar erros ao digitar
  [inputEmail, inputSenha].forEach(input => {
    if (input) {
      input.addEventListener("input", () => {
        input.removeAttribute("aria-invalid");
        const erroId = `${input.id}-erro`;
        const erroEl = document.getElementById(erroId);
        if (erroEl) erroEl.hidden = true;
        if (erroLogin) erroLogin.hidden = true;
      });
    }
  });

  // Submit do formulário
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Limpar erros anteriores
    if (erroEmail) erroEmail.hidden = true;
    if (erroSenha) erroSenha.hidden = true;
    if (erroLogin) erroLogin.hidden = true;
    inputEmail?.removeAttribute("aria-invalid");
    inputSenha?.removeAttribute("aria-invalid");

    const email = inputEmail?.value?.trim();
    const senha = inputSenha?.value;

    // Validação client-side
    let temErro = false;

    if (!email) {
      if (erroEmail) {
        erroEmail.textContent = "Informe seu e-mail.";
        erroEmail.hidden = false;
      }
      inputEmail?.setAttribute("aria-invalid", "true");
      temErro = true;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (erroEmail) {
        erroEmail.textContent = "Informe um e-mail válido.";
        erroEmail.hidden = false;
      }
      inputEmail?.setAttribute("aria-invalid", "true");
      temErro = true;
    }

    if (!senha) {
      if (erroSenha) {
        erroSenha.textContent = "Informe sua senha.";
        erroSenha.hidden = false;
      }
      inputSenha?.setAttribute("aria-invalid", "true");
      temErro = true;
    } else if (senha.length < 6) {
      if (erroSenha) {
        erroSenha.textContent = "A senha deve ter pelo menos 6 caracteres.";
        erroSenha.hidden = false;
      }
      inputSenha?.setAttribute("aria-invalid", "true");
      temErro = true;
    }

    if (temErro) return;

    // Estado de loading
    if (btnLogin) {
      btnLogin.disabled = true;
      btnLogin.setAttribute("aria-busy", "true");
    }

    try {
      const { loginComEmail } = await import("./auth.js");
      await loginComEmail(email, senha);
      // onAuthStateChange → auth:login → UI atualizada
    } catch (err) {
      console.error('[Navegação] Erro ao fazer login:', err);
      if (btnLogin) {
        btnLogin.disabled = false;
        btnLogin.setAttribute("aria-busy", "false");
      }
      // O erro já é tratado no auth.js e disparado via auth:erro
      // Mas podemos mostrar erro específico no formulário se necessário
    }
  });
}

/**
 * Inicializa listeners de eventos de autenticação
 */
function inicializarAuthListeners() {
  // Login bem-sucedido (AuthN + AuthZ OK - usuário tem estúdio vinculado)
  window.addEventListener("auth:login", (event) => {
    console.log('[Navegação] auth:login recebido', event.detail);
    authInicializado = true;
    alternarVisibilidadeApp(true);

    // Se estava na tela de login, redirecionar para dashboard
    const rotaAtual = obterRotaAtual();
    if (rotaAtual === "login") {
      window.location.hash = "#dashboard";
    } else {
      atualizarNavegacao();
    }
  });

  // Usuário autenticado mas não autorizado (sem estúdio vinculado)
  window.addEventListener("auth:unauthorized", (event) => {
    console.log('[Navegação] auth:unauthorized recebido', event.detail);
    authInicializado = true;
    // Mostra tela de login com mensagem de erro
    alternarVisibilidadeApp(false);
    const erroEl = document.getElementById("login-erro");
    if (erroEl) {
      erroEl.textContent = event.detail.mensagem || "Usuário não vinculado a nenhum estúdio.";
      erroEl.hidden = false;
    }
    window.location.hash = "#login";
  });

  // Apenas autenticado (AuthN OK) - para UI que precise saber
  window.addEventListener("auth:authenticated", (event) => {
    console.log('[Navegação] auth:authenticated recebido', event.detail);
    authInicializado = true;
    // Não altera visibilidade aqui - aguarda auth:login ou auth:unauthorized
  });

  // Logout
  window.addEventListener("auth:logout", (event) => {
    console.log('[Navegação] auth:logout recebido', event.detail);
    alternarVisibilidadeApp(false);
    window.location.hash = "#login";
  });

  // Erro de auth
  window.addEventListener("auth:erro", (event) => {
    console.error('[Navegação] auth:erro', event.detail);
    const erroEl = document.getElementById("login-erro");
    if (erroEl) {
      erroEl.textContent = event.detail.mensagem || "Erro de autenticação";
      erroEl.hidden = false;
    }
  });

  // Auth pronto (sessão inicial verificada)
  window.addEventListener("auth:pronto", (event) => {
    console.log('[Navegação] auth:pronto', event.detail);
    authInicializado = true;
    // Exibe app apenas se autenticado E autorizado
    const autenticado = event.detail.autenticado === true;
    const autorizado = event.detail.autorizado === true;
    alternarVisibilidadeApp(autenticado && autorizado);
    atualizarNavegacao(false);
  });
}

// =============================================================================
// Inicialização
// =============================================================================

window.addEventListener("hashchange", atualizarNavegacao);

document.addEventListener("DOMContentLoaded", () => {
  configurarLogout();
  configurarLogin();
  configurarLoginEmail();
  inicializarAuthListeners();

  // Verificar se auth já inicializou (race condition: auth:pronto pode ter disparado antes do listener)
  if (window.NailFlow?.auth?.inicializado) {
    console.log('[Navegação] Auth já inicializado no DOMContentLoaded, aplicando estado atual');
    // Exibe app apenas se autenticado E autorizado
    const autenticado = window.NailFlow.auth.autenticado === true;
    const autorizado = window.NailFlow.auth.autorizado === true;
    alternarVisibilidadeApp(autenticado && autorizado);
    atualizarNavegacao(false);
  }
  // Se não inicializado, aguarda auth:pronto
});
