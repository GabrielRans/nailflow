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
  "nova-movimentacao", // alias para criar nova movimentação
  "materiais",
  "cadastro-material",
  "login",           // rota pública de login
  "redefinir-senha"  // rota pública de redefinição de senha (via link mágico)
]);

// Rotas que exigem autenticação E autorização (estudioId)
const ROTAS_PROTEGIDAS = new Set([
  "dashboard",
  "financeiro",
  "movimentacao",
  "nova-movimentacao",
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
  // Mapear rotas aliases para telas existentes
  const telaParaExibir = rota === "nova-movimentacao" ? "movimentacao" : rota;

  const telas = document.querySelectorAll("[data-tela]");
  telas.forEach((tela) => {
    tela.hidden = tela.dataset.tela !== telaParaExibir;
  });
}

/**
 * Alterna visibilidade do app logado vs tela de login vs tela de redefinição de senha
 * @param {boolean} autenticado - Se o usuário está autenticado
 * @param {boolean} emRedefinicaoSenha - Se está no fluxo de redefinição de senha
 */
function alternarVisibilidadeApp(autenticado, emRedefinicaoSenha = false) {
  const appLogado = document.getElementById("app-logado");
  const telaLogin = document.getElementById("tela-login");
  const telaRedefinirSenha = document.getElementById("tela-redefinir-senha");
  const btnLogout = document.getElementById("btn-logout");
  const headerTopo = document.querySelector('.app-header-topo');
  const bottomNav = document.querySelector('.bottom-nav');

  if (appLogado) appLogado.hidden = !autenticado || emRedefinicaoSenha;
  if (telaLogin) telaLogin.hidden = autenticado || emRedefinicaoSenha;
  if (telaRedefinirSenha) telaRedefinirSenha.hidden = !emRedefinicaoSenha;
  if (btnLogout) btnLogout.hidden = !autenticado || emRedefinicaoSenha;

  // Controla visibilidade do header topo e bottom nav
  if (autenticado && !emRedefinicaoSenha) {
    if (headerTopo) headerTopo.style.display = 'flex';
    if (bottomNav) bottomNav.style.display = 'flex';
  } else {
    if (headerTopo) headerTopo.style.display = 'none';
    if (bottomNav) bottomNav.style.display = 'none';
  }
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

  // Verificar se está no fluxo de redefinição de senha
  const emRedefinicaoSenha = window.NailFlow?.auth?.emRedefinicaoSenha === true;

  // Proteger rota antes de exibir (exceto redefinir-senha que é pública via token)
  if (rota !== "redefinir-senha" && !protegerRota(rota)) {
    return; // Redirecionou para login
  }

  exibirTela(rota);
  alternarVisibilidadeApp(estaAutenticado(), emRedefinicaoSenha);

  const areaPrincipal = {
    movimentacao: "financeiro",
    "nova-movimentacao": "financeiro",
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
  const retornandoDaEdicao = (rotaAnterior === "movimentacao" || rotaAnterior === "nova-movimentacao") && rota === "financeiro" && botaoOrigemEdicao !== null;
  const origemDisponivel = retornandoDaEdicao && botaoOrigemEdicao.isConnected && !botaoOrigemEdicao.disabled;

  // Para nova-movimentacao, garantir modo de criação (limpar formulário)
  if (rota === "nova-movimentacao") {
    focoEdicaoPendente = false;
    limparFormularioMovimentacao();
  } else {
    focoEdicaoPendente = false;
  }

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
 * Limpa o formulário de movimentação para modo de criação
 */
function limparFormularioMovimentacao() {
  const form = document.getElementById("form-movimentacao");
  if (form) {
    form.reset();
    const idInput = document.getElementById("movimentacao-id");
    if (idInput) idInput.value = "";

    // Resetar botões de tipo (Entrada/Saída)
    document.querySelectorAll(".btn-tipo").forEach((botao) => {
      botao.classList.remove("ativo");
      botao.setAttribute("aria-checked", "false");
    });
    const tipoSelect = document.getElementById("tipo");
    if (tipoSelect) tipoSelect.value = "";

    // Focar no primeiro campo
    const primeiroCampo = form.querySelector("input, select");
    primeiroCampo?.focus();
  }
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
  // Mapear rotas aliases para telas existentes (mesma lógica de exibirTela)
  const telaParaFocar = rota === "nova-movimentacao" ? "movimentacao" : rota;
  const tela = document.querySelector(`[data-tela="${telaParaFocar}"]`);
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
      const msgRecuperacao = document.getElementById("recuperar-senha-msg");
      if (!email) {
        if (erroEmail) {
          erroEmail.textContent = "Informe seu e-mail para recuperar a senha.";
          erroEmail.hidden = false;
        }
        inputEmail?.setAttribute("aria-invalid", "true");
        inputEmail?.focus();
        return;
      }
      try {
        const { supabase } = await import("./supabase-client.js");
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        if (msgRecuperacao) {
          msgRecuperacao.className = "recuperar-senha-msg recuperar-senha-msg--sucesso";
          msgRecuperacao.textContent = "Se este e-mail estiver cadastrado, você receberá um link de recuperação em breve. Verifique também a pasta de spam.";
          msgRecuperacao.hidden = false;
        }
      } catch (err) {
        console.error('[Navegação] Erro ao enviar e-mail de recuperação:', err);
        if (msgRecuperacao) {
          msgRecuperacao.className = "recuperar-senha-msg recuperar-senha-msg--erro";
          msgRecuperacao.textContent = "Não foi possível enviar o e-mail de recuperação. Tente novamente.";
          msgRecuperacao.hidden = false;
        }
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
 * Handler do formulário de redefinição de senha
 */
function configurarRedefinirSenha() {
  const form = document.getElementById("form-redefinir-senha");
  if (!form) return;

  const btnSalvar = document.getElementById("btn-salvar-senha");
  const inputNovaSenha = document.getElementById("nova-senha");
  const inputConfirmarSenha = document.getElementById("confirmar-senha");
  const erroNovaSenha = document.getElementById("nova-senha-erro");
  const erroConfirmarSenha = document.getElementById("confirmar-senha-erro");
  const erroRedefinir = document.getElementById("redefinir-senha-erro");
  const sucessoRedefinir = document.getElementById("redefinir-senha-sucesso");

  // Toggle visibilidade da nova senha
  const btnToggleNovaSenha = document.getElementById("btn-toggle-nova-senha");
  if (btnToggleNovaSenha && inputNovaSenha) {
    btnToggleNovaSenha.addEventListener("click", () => {
      const isPassword = inputNovaSenha.type === "password";
      inputNovaSenha.type = isPassword ? "text" : "password";
      btnToggleNovaSenha.setAttribute("aria-pressed", isPassword.toString());
      btnToggleNovaSenha.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
    });
  }

  // Toggle visibilidade da confirmação de senha
  const btnToggleConfirmarSenha = document.getElementById("btn-toggle-confirmar-senha");
  if (btnToggleConfirmarSenha && inputConfirmarSenha) {
    btnToggleConfirmarSenha.addEventListener("click", () => {
      const isPassword = inputConfirmarSenha.type === "password";
      inputConfirmarSenha.type = isPassword ? "text" : "password";
      btnToggleConfirmarSenha.setAttribute("aria-pressed", isPassword.toString());
      btnToggleConfirmarSenha.setAttribute("aria-label", isPassword ? "Ocultar senha" : "Mostrar senha");
    });
  }

  // Função para validar requisitos de senha em tempo real
  function validarRequisitosSenha(senha) {
    const requisitos = {
      minimo: senha.length >= 8,
      maiuscula: /[A-Z]/.test(senha),
      minuscula: /[a-z]/.test(senha),
      digito: /[0-9]/.test(senha)
    };

    document.querySelectorAll('.senha-req').forEach(req => {
      const tipo = req.dataset.req;
      if (requisitos[tipo]) {
        req.classList.add('senha-req--ok');
      } else {
        req.classList.remove('senha-req--ok');
      }
    });

    return Object.values(requisitos).every(v => v);
  }

  // Limpar erros ao digitar + validação em tempo real dos requisitos
  [inputNovaSenha, inputConfirmarSenha].forEach(input => {
    if (input) {
      input.addEventListener("input", () => {
        input.removeAttribute("aria-invalid");
        const erroId = `${input.id}-erro`;
        const erroEl = document.getElementById(erroId);
        if (erroEl) erroEl.hidden = true;
        if (erroRedefinir) erroRedefinir.hidden = true;
        if (sucessoRedefinir) sucessoRedefinir.hidden = true;

        // Validação em tempo real apenas para o campo de nova senha
        if (input === inputNovaSenha) {
          validarRequisitosSenha(input.value);
        }
      });
    }
  });

  // Submit do formulário
  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    // Limpar erros anteriores
    if (erroNovaSenha) erroNovaSenha.hidden = true;
    if (erroConfirmarSenha) erroConfirmarSenha.hidden = true;
    if (erroRedefinir) erroRedefinir.hidden = true;
    if (sucessoRedefinir) sucessoRedefinir.hidden = true;
    inputNovaSenha?.removeAttribute("aria-invalid");
    inputConfirmarSenha?.removeAttribute("aria-invalid");

    const novaSenha = inputNovaSenha?.value;
    const confirmarSenha = inputConfirmarSenha?.value;

    // Validação client-side
    let temErro = false;

    if (!novaSenha) {
      if (erroNovaSenha) {
        erroNovaSenha.textContent = "Informe a nova senha.";
        erroNovaSenha.hidden = false;
      }
      inputNovaSenha?.setAttribute("aria-invalid", "true");
      temErro = true;
    } else if (novaSenha.length < 6) {
      if (erroNovaSenha) {
        erroNovaSenha.textContent = "A senha deve ter pelo menos 6 caracteres.";
        erroNovaSenha.hidden = false;
      }
      inputNovaSenha?.setAttribute("aria-invalid", "true");
      temErro = true;
    }

    if (!confirmarSenha) {
      if (erroConfirmarSenha) {
        erroConfirmarSenha.textContent = "Confirme a nova senha.";
        erroConfirmarSenha.hidden = false;
      }
      inputConfirmarSenha?.setAttribute("aria-invalid", "true");
      temErro = true;
    } else if (novaSenha !== confirmarSenha) {
      if (erroConfirmarSenha) {
        erroConfirmarSenha.textContent = "As senhas não coincidem.";
        erroConfirmarSenha.hidden = false;
      }
      inputConfirmarSenha?.setAttribute("aria-invalid", "true");
      temErro = true;
    }

    // Validar requisitos de senha no submit
    const requisitosOk = validarRequisitosSenha(novaSenha);
    if (!requisitosOk) {
      if (erroNovaSenha) {
        erroNovaSenha.textContent = "A senha não atende aos requisitos mínimos.";
        erroNovaSenha.hidden = false;
      }
      inputNovaSenha?.setAttribute("aria-invalid", "true");
      inputNovaSenha?.focus();
      temErro = true;
    }

    if (temErro) return;

    // Estado de loading
    if (btnSalvar) {
      btnSalvar.disabled = true;
      btnSalvar.setAttribute("aria-busy", "true");
    }

    try {
      const { atualizarSenha } = await import("./auth.js");
      await atualizarSenha(novaSenha);
      // auth:password-updated event tratará o redirecionamento
    } catch (err) {
      console.error('[Navegação] Erro ao redefinir senha:', err);
      if (btnSalvar) {
        btnSalvar.disabled = false;
        btnSalvar.setAttribute("aria-busy", "false");
      }
      // O erro já é tratado no auth.js e disparado via auth:erro
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
    alternarVisibilidadeApp(true, false);

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
    alternarVisibilidadeApp(false, false);
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
    alternarVisibilidadeApp(false, false);
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
    // Se emRedefinicaoSenha estiver ativo (fluxo invite/recovery), mostra tela de redefinição
    const autenticado = event.detail.autenticado === true;
    const autorizado = event.detail.autorizado === true;
    const emRedefinicaoSenha = event.detail.emRedefinicaoSenha === true;
    alternarVisibilidadeApp(autenticado && autorizado, emRedefinicaoSenha);
    atualizarNavegacao(false);
  });

  // Fluxo de redefinição de senha iniciado (PASSWORD_RECOVERY)
  window.addEventListener("auth:password-recovery", (event) => {
    console.log('[Navegação] auth:password-recovery recebido', event.detail);
    authInicializado = true;
    // Mostra tela de redefinição de senha
    alternarVisibilidadeApp(false, true);
    window.location.hash = "#redefinir-senha";

    // Limpar hash da URL se ainda contiver parâmetros de convite/recuperação
    // Evita que um reload re-dispare o fluxo de convite
    const hash = window.location.hash;
    if (hash.includes('type=invite') || hash.includes('type=recovery') || hash.includes('access_token')) {
      history.replaceState(null, '', window.location.pathname + '#redefinir-senha');
    }
  });

  // Fluxo especial abandonado (usuário saiu da tela, link expirou, login convencional)
  window.addEventListener("auth:special-flow-abandoned", (event) => {
    console.log('[Navegação] auth:special-flow-abandoned recebido', event.detail);
    // Se estava na tela de redefinir-senha, voltar para login
    const rotaAtual = obterRotaAtual();
    if (rotaAtual === "redefinir-senha") {
      window.location.hash = "#login";
    }
  });

  // Senha atualizada com sucesso
  window.addEventListener("auth:password-updated", (event) => {
    console.log('[Navegação] auth:password-updated recebido', event.detail);
    // Só recarrega se o evento indicar sucesso explícito
    // O evento é disparado apenas após supabase.auth.updateUser() retornar sucesso
    if (event.detail?.sucesso === true) {
      // Define a rota para dashboard e recarrega a página
      // O recarregamento garante que a inicialização normal recupere a sessão do Supabase
      // e processe a autenticação/autorização corretamente
      window.location.hash = "#dashboard";
      window.location.reload();
    }
  });
}

// =============================================================================
// Inicialização
// =============================================================================

window.addEventListener("hashchange", (event) => {
  // Detectar abandono do fluxo especial: usuário navegou para fora de redefinir-senha
  // enquanto emRedefinicaoSenha estava true
  const hashNovo = window.location.hash.slice(1);

  // Mais confiável: verificar se ANTES estávamos em redefinir-senha e agora não estamos
  // Usamos rotaAnterior para rastrear a rota anterior
  if (rotaAnterior === "redefinir-senha" && hashNovo !== "redefinir-senha") {
    const emRedefinicaoSenha = window.NailFlow?.auth?.emRedefinicaoSenha === true;
    if (emRedefinicaoSenha) {
      console.log('[Navegação] Usuário saiu de redefinir-senha — abandonando fluxo especial');
      // Import dinâmico para evitar dependência circular
      import("./auth.js").then(({ abandonarFluxoEspecial }) => {
        abandonarFluxoEspecial('navegacao-fora-da-tela');
      }).catch(() => {
        // Se falhar import, o auth.js já limpará no logout/login
      });
    }
  }

  atualizarNavegacao();
});

document.addEventListener("DOMContentLoaded", () => {
  configurarLogout();
  configurarLoginEmail();
  configurarRedefinirSenha();
  inicializarAuthListeners();

  // Verificar se auth já inicializou (race condition: auth:pronto pode ter disparado antes do listener)
  if (window.NailFlow?.auth?.inicializado) {
    console.log('[Navegação] Auth já inicializado no DOMContentLoaded, aplicando estado atual');
    // Exibe app apenas se autenticado E autorizado
    const autenticado = window.NailFlow.auth.autenticado === true;
    const autorizado = window.NailFlow.auth.autorizado === true;
    const emRedefinicaoSenha = window.NailFlow.auth.emRedefinicaoSenha === true;
    alternarVisibilidadeApp(autenticado && autorizado, emRedefinicaoSenha);
    atualizarNavegacao(false);
  }
  // Se não inicializado, aguarda auth:pronto
});
