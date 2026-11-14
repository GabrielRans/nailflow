/**
 * Interface do Módulo de Materiais (F04 e F05) - NailFlow
 * Consome exclusivamente a API pública de materiais em window.NailFlow.materiais
 */

// Estado local da UI de materiais
let materiaisCarregando = false;
let todosMateriais = [];
let filtroBuscaAtual = "";
let materialEmEdicao = null; // { id, dadosOriginais } para modo edição
let materialAtualizandoQtd = null; // id do material com ajuste inline aberto

/**
 * Escapa texto para inserção segura no HTML
 * @param {string} texto
 * @returns {string}
 */
function escaparHtml(texto) {
  if (typeof texto !== "string") return "";
  const mapa = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  };
  return texto.replace(/[&<>"']/g, (m) => mapa[m]);
}

/**
 * Normaliza string para busca: remove acentos, lower case
 * @param {string} str
 * @returns {string}
 */
function normalizarParaBusca(str) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Exibe feedback acessível na tela F04
 * @param {string} mensagem
 * @param {'sucesso' | 'erro'} tipo
 */
function exibirFeedbackMateriais(mensagem, tipo = "sucesso") {
  const feedbackEl = document.getElementById("materiais-feedback");
  if (!feedbackEl) return;

  feedbackEl.textContent = mensagem;
  feedbackEl.className = `materiais-feedback materiais-feedback--${tipo}`;
  feedbackEl.hidden = false;

  setTimeout(() => {
    if (feedbackEl) {
      feedbackEl.hidden = true;
    }
  }, 4000);
}

/**
 * SVG do ícone de caixa genérica
 * @returns {string}
 */
function iconeCaixa() {
  return `
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
  `;
}

/**
 * Determina se material precisa de reposição
 * REUTILIZA a mesma regra do dashboard (obterMateriaisParaReposicao)
 * @param {Object} mat
 * @returns {boolean}
 */
function precisaReposicao(mat) {
  return Number(mat.quantidadeDisponivel) <= Number(mat.quantidadeMinima);
}

/**
 * Renderiza a lista de materiais cadastrados na tela F04
 * @param {Array} materiais
 */
function renderizarListaMateriais(materiais) {
  const listaEl = document.getElementById("lista-materiais");
  const vazioEl = document.getElementById("materiais-vazio");
  const buscaVazioEl = document.getElementById("materiais-busca-vazio");
  const loadingEl = document.getElementById("materiais-loading");
  const tituloListaEl = document.getElementById("lista-materiais-titulo");

  if (loadingEl) loadingEl.hidden = true;

  if (!listaEl) return;

  // Aplica filtro de busca
  let materiaisFiltrados = materiais;
  if (filtroBuscaAtual) {
    const termo = normalizarParaBusca(filtroBuscaAtual);
    materiaisFiltrados = materiais.filter((mat) =>
      normalizarParaBusca(mat.nome).includes(termo)
    );
  }

  // Estado vazio: sem materiais cadastrados vs busca sem resultados
  const temMateriaisCadastrados = Array.isArray(materiais) && materiais.length > 0;
  const temResultadosBusca = materiaisFiltrados.length > 0;

  if (!temMateriaisCadastrados) {
    listaEl.innerHTML = "";
    listaEl.hidden = true;
    if (vazioEl) vazioEl.hidden = false;
    if (buscaVazioEl) buscaVazioEl.hidden = true;
    if (tituloListaEl) tituloListaEl.hidden = true;
    return;
  }

  if (filtroBuscaAtual && !temResultadosBusca) {
    listaEl.innerHTML = "";
    listaEl.hidden = true;
    if (vazioEl) vazioEl.hidden = true;
    if (buscaVazioEl) buscaVazioEl.hidden = false;
    if (tituloListaEl) tituloListaEl.hidden = true;
    return;
  }

  if (vazioEl) vazioEl.hidden = true;
  if (buscaVazioEl) buscaVazioEl.hidden = true;
  if (tituloListaEl) tituloListaEl.hidden = false;
  listaEl.hidden = false;
  listaEl.innerHTML = "";

  materiaisFiltrados.forEach((mat) => {
    const precisaRepor = precisaReposicao(mat);
    const unidade = escaparHtml(mat.unidade);
    const qtdDisponivel = escaparHtml(String(mat.quantidadeDisponivel));
    const qtdMinima = escaparHtml(String(mat.quantidadeMinima));

    const li = document.createElement("li");
    li.className = "material-card";
    li.dataset.materialId = mat.id;

    // Se está em modo edição de quantidade inline
    if (materialAtualizandoQtd === mat.id) {
      li.innerHTML = `
        <div class="material-card__cabecalho">
          <div class="material-card__info-principal">
            <div class="material-card__icone">${iconeCaixa()}</div>
            <h3 class="material-card__nome">${escaparHtml(mat.nome)}</h3>
          </div>
          <span class="material-card__badge ${precisaRepor ? "material-card__badge--reposicao" : "material-card__badge--ok"}" aria-label="${precisaRepor ? "Reposição necessária" : "Estoque OK"}">
            ${precisaRepor ? "Reposição" : "OK"}
          </span>
        </div>

        <div class="material-card__metricas">
          <div class="material-card__metrica">
            <span class="material-card__metrica-label">Quantidade:</span>
            <span class="material-card__metrica-valor ${precisaRepor ? "material-card__metrica-valor--alerta" : ""}">${qtdDisponivel} ${unidade}</span>
          </div>
          <div class="material-card__metrica">
            <span class="material-card__metrica-label">Mínimo:</span>
            <span class="material-card__metrica-valor">${qtdMinima} ${unidade}</span>
          </div>
        </div>

        <div class="material-card__ajuste-inline">
          <input
            type="number"
            class="material-card__ajuste-inline-campo"
            min="0"
            step="any"
            value="${qtdDisponivel}"
            aria-label="Nova quantidade para ${escaparHtml(mat.nome)}"
            required
            autocomplete="off"
          >
          <div class="material-card__ajuste-inline-botoes">
            <button type="button" class="material-card__ajuste-inline-btn material-card__ajuste-inline-btn--salvar" aria-label="Salvar nova quantidade">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
            </button>
            <button type="button" class="material-card__ajuste-inline-btn material-card__ajuste-inline-btn--cancelar" aria-label="Cancelar">✕</button>
          </div>
        </div>
      `;

      // Handlers do ajuste inline
      const inputQtd = li.querySelector(".material-card__ajuste-inline-campo");
      const btnSalvar = li.querySelector(".material-card__ajuste-inline-btn--salvar");
      const btnCancelar = li.querySelector(".material-card__ajuste-inline-btn--cancelar");

      inputQtd.focus();
      inputQtd.select();

      const salvarAjuste = async () => {
        const novaQtd = Number(inputQtd.value);
        if (isNaN(novaQtd) || novaQtd < 0) {
          exibirFeedbackMateriais("Informe uma quantidade válida maior ou igual a zero.", "erro");
          inputQtd.focus();
          return;
        }

        btnSalvar.disabled = true;
        btnSalvar.setAttribute("aria-busy", "true");

        try {
          const api = window.NailFlow?.materiais;
          const fnAtualizar = api?.atualizarQuantidadeMaterialAsync || api?.atualizarQuantidadeMaterial;

          if (typeof fnAtualizar !== "function") {
            throw new Error("Módulo de materiais não inicializado.");
          }

          const res = await fnAtualizar(mat.id, novaQtd);

          if (res && res.sucesso) {
            exibirFeedbackMateriais(`Estoque de "${mat.nome}" atualizado para ${novaQtd} ${mat.unidade}.`, "sucesso");
            materialAtualizandoQtd = null;
            document.dispatchEvent(new CustomEvent("materiais:atualizados"));
          } else {
            const msg = res?.erro?.mensagem || "Não foi possível atualizar a quantidade.";
            exibirFeedbackMateriais(msg, "erro");
          }
        } catch (err) {
          console.error("[Materiais UI] Erro ao atualizar quantidade:", err);
          exibirFeedbackMateriais("Erro ao atualizar estoque. Tente novamente.", "erro");
        } finally {
          btnSalvar.disabled = false;
          btnSalvar.removeAttribute("aria-busy");
        }
      };

      const cancelarAjuste = () => {
        materialAtualizandoQtd = null;
        carregarMateriais(); // Re-renderiza sem o inline
      };

      btnSalvar.addEventListener("click", salvarAjuste);
      btnCancelar.addEventListener("click", cancelarAjuste);
      inputQtd.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          salvarAjuste();
        } else if (e.key === "Escape") {
          cancelarAjuste();
        }
      });

      listaEl.appendChild(li);
      return;
    }

    // Card normal
    li.innerHTML = `
      <div class="material-card__cabecalho">
        <div class="material-card__info-principal">
          <div class="material-card__icone">${iconeCaixa()}</div>
          <h3 class="material-card__nome">${escaparHtml(mat.nome)}</h3>
        </div>
        <span class="material-card__badge ${precisaRepor ? "material-card__badge--reposicao" : "material-card__badge--ok"}" aria-label="${precisaRepor ? "Reposição necessária" : "Estoque OK"}">
          ${precisaRepor ? "Reposição" : "OK"}
        </span>
      </div>

      <div class="material-card__metricas">
        <div class="material-card__metrica">
          <span class="material-card__metrica-label">Quantidade:</span>
          <span class="material-card__metrica-valor ${precisaRepor ? "material-card__metrica-valor--alerta" : ""}">${qtdDisponivel} ${unidade}</span>
        </div>
        <div class="material-card__metrica">
          <span class="material-card__metrica-label">Mínimo:</span>
          <span class="material-card__metrica-valor">${qtdMinima} ${unidade}</span>
        </div>
      </div>

      <div class="material-card__acoes">
        <button type="button" class="material-card__btn material-card__btn--editar" data-acao="editar" aria-label="Editar ${escaparHtml(mat.nome)}">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          <span>Editar</span>
        </button>
        <button type="button" class="material-card__btn material-card__btn--primario material-card__btn--atualizar" data-acao="atualizar" aria-label="Atualizar quantidade de ${escaparHtml(mat.nome)}">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
          <span>Atualizar</span>
        </button>
      </div>
    `;

    // Handlers dos botões Editar e Atualizar
    const btnEditar = li.querySelector('[data-acao="editar"]');
    const btnAtualizar = li.querySelector('[data-acao="atualizar"]');

    btnEditar.addEventListener("click", () => abrirModoEdicao(mat));
    btnAtualizar.addEventListener("click", () => abrirAjusteInline(mat.id));

    listaEl.appendChild(li);
  });
}

/**
 * Abre o formulário de cadastro em modo edição
 * @param {Object} mat - Material a editar
 */
function abrirModoEdicao(mat) {
  materialEmEdicao = { id: mat.id, dadosOriginais: { ...mat } };

  // Atualiza título e subtítulo
  const tituloEl = document.getElementById("cadastro-material-titulo");
  const subtituloEl = document.getElementById("cadastro-material-subtitulo");
  if (tituloEl) tituloEl.textContent = "Editar material";
  if (subtituloEl) subtituloEl.textContent = "Atualize os dados do material.";

  // Preenche o formulário
  const inputNome = document.getElementById("material-nome");
  const inputQtdDisp = document.getElementById("material-qtd-disponivel");
  const selectUnidade = document.getElementById("material-unidade");
  const inputQtdMin = document.getElementById("material-qtd-minima");
  const btnSubmit = document.querySelector("#form-material button[type='submit']");

  if (inputNome) inputNome.value = mat.nome;
  if (inputQtdDisp) inputQtdDisp.value = mat.quantidadeDisponivel;
  if (selectUnidade) selectUnidade.value = mat.unidade;
  if (inputQtdMin) inputQtdMin.value = mat.quantidadeMinima;
  if (btnSubmit) {
    btnSubmit.innerHTML = `
      <svg class="icone-check" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Salvar alterações</span>
    `;
  }

  // Navega para a tela de cadastro
  window.location.hash = "#cadastro-material";

  // Foca no primeiro campo
  setTimeout(() => inputNome?.focus(), 0);
}

/**
 * Abre o ajuste inline de quantidade
 * @param {string} materialId
 */
function abrirAjusteInline(materialId) {
  materialAtualizandoQtd = materialId;
  carregarMateriais(); // Re-renderiza com o inline aberto
}

/**
 * Cancela o modo edição e limpa o formulário
 */
function cancelarModoEdicao() {
  materialEmEdicao = null;
  const form = document.getElementById("form-material");
  if (form) form.reset();

  // Declara campos do formulário (necessários para limpar aria-invalid)
  const inputNome = document.getElementById("material-nome");
  const inputQtdDisp = document.getElementById("material-qtd-disponivel");
  const selectUnidade = document.getElementById("material-unidade");
  const inputQtdMin = document.getElementById("material-qtd-minima");

  // Restaura título e subtítulo
  const tituloEl = document.getElementById("cadastro-material-titulo");
  const subtituloEl = document.getElementById("cadastro-material-subtitulo");
  const btnSubmit = document.querySelector("#form-material button[type='submit']");
  if (tituloEl) tituloEl.textContent = "Cadastrar material";
  if (subtituloEl) subtituloEl.textContent = "Adicione um novo material ao estoque.";
  if (btnSubmit) {
    btnSubmit.innerHTML = `
      <svg class="icone-check" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Salvar material</span>
    `;
  }

  // Limpa erros
  form?.querySelectorAll(".form-erro-campo").forEach((el) => {
    el.hidden = true;
    el.textContent = "";
  });
  const feedbackErro = document.getElementById("form-material-erro");
  if (feedbackErro) feedbackErro.hidden = true;
  [inputNome, inputQtdDisp, selectUnidade, inputQtdMin].forEach((c) => c?.removeAttribute("aria-invalid"));

  // Volta para a lista
  window.location.hash = "#materiais";
}

/**
 * Carrega e lista todos os materiais do repositório
 */
async function carregarMateriais() {
  if (materiaisCarregando) return;
  materiaisCarregando = true;

  const loadingEl = document.getElementById("materiais-loading");
  const listaEl = document.getElementById("lista-materiais");
  const vazioEl = document.getElementById("materiais-vazio");
  const buscaVazioEl = document.getElementById("materiais-busca-vazio");
  const tituloListaEl = document.getElementById("lista-materiais-titulo");

  if (loadingEl && (!listaEl || listaEl.children.length === 0)) {
    loadingEl.hidden = false;
  }
  if (vazioEl) vazioEl.hidden = true;
  if (buscaVazioEl) buscaVazioEl.hidden = true;
  if (tituloListaEl) tituloListaEl.hidden = true;

  try {
    const api = window.NailFlow?.materiais;
    const fnListar = api?.listarMateriaisAsync || api?.listarMateriais;

    if (typeof fnListar !== "function") {
      throw new Error("Módulo de materiais indisponível.");
    }

    const res = await fnListar();
    const lista = res?.sucesso ? res.dados : (Array.isArray(res) ? res : []);
    todosMateriais = lista;
    renderizarListaMateriais(lista);
  } catch (err) {
    console.error("[Materiais UI] Erro ao listar materiais:", err);
    if (loadingEl) loadingEl.hidden = true;
    exibirFeedbackMateriais("Não foi possível carregar os materiais cadastrados.", "erro");
  } finally {
    materiaisCarregando = false;
  }
}

/**
 * Configura o campo de busca
 */
function configurarBuscaMateriais() {
  const inputBusca = document.getElementById("materiais-busca-input");
  if (!inputBusca) return;

  inputBusca.addEventListener("input", (e) => {
    filtroBuscaAtual = e.target.value.trim();
    renderizarListaMateriais(todosMateriais);
  });

  // Limpar busca ao pressionar Escape
  inputBusca.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      inputBusca.value = "";
      filtroBuscaAtual = "";
      renderizarListaMateriais(todosMateriais);
      inputBusca.blur();
    }
  });
}

/**
 * Configura o formulário de cadastro de material F05
 * Suporta modo criação e modo edição
 */
function configurarFormularioCadastroMaterial() {
  const form = document.getElementById("form-material");
  if (!form) return;

  const inputNome = document.getElementById("material-nome");
  const inputQtdDisp = document.getElementById("material-qtd-disponivel");
  const selectUnidade = document.getElementById("material-unidade");
  const inputQtdMin = document.getElementById("material-qtd-minima");
  const btnSubmit = form.querySelector("button[type='submit']");
  const btnCancelar = document.getElementById("btn-cancelar-material");
  const btnVoltar = document.getElementById("btn-voltar-materiais");
  const feedbackErro = document.getElementById("form-material-erro");

  // Limpar erro inline ao digitar
  [inputNome, inputQtdDisp, selectUnidade, inputQtdMin].forEach((campo) => {
    if (!campo) return;
    campo.addEventListener("input", () => {
      campo.removeAttribute("aria-invalid");
      const errEl = document.getElementById(`${campo.id}-erro`);
      if (errEl) {
        errEl.hidden = true;
        errEl.textContent = "";
      }
      if (feedbackErro) feedbackErro.hidden = true;
    });
  });

  // Botão Cancelar
  if (btnCancelar) {
    btnCancelar.addEventListener("click", (e) => {
      e.preventDefault();
      cancelarModoEdicao();
    });
  }

  // Botão Voltar (topo)
  if (btnVoltar) {
    btnVoltar.addEventListener("click", (e) => {
      e.preventDefault();
      cancelarModoEdicao();
    });
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Limpar erros prévios
    if (feedbackErro) feedbackErro.hidden = true;
    form.querySelectorAll(".form-erro-campo").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
    [inputNome, inputQtdDisp, selectUnidade, inputQtdMin].forEach((c) => c?.removeAttribute("aria-invalid"));

    const dados = {
      nome: inputNome?.value?.trim() || "",
      quantidadeDisponivel: Number(inputQtdDisp?.value),
      quantidadeMinima: Number(inputQtdMin?.value),
      unidade: selectUnidade?.value?.trim() || ""
    };

    // Validação client-side respeitando a ordem contratual:
    // Nome -> Quantidade Disponível -> Quantidade Mínima -> Unidade
    if (!dados.nome) {
      exibirErroCampo(inputNome, "O nome do material é obrigatório.");
      return;
    }

    if (isNaN(dados.quantidadeDisponivel) || dados.quantidadeDisponivel < 0) {
      exibirErroCampo(inputQtdDisp, "Informe uma quantidade disponível válida maior ou igual a zero.");
      return;
    }

    if (isNaN(dados.quantidadeMinima) || dados.quantidadeMinima < 0) {
      exibirErroCampo(inputQtdMin, "Informe uma quantidade mínima válida maior ou igual a zero.");
      return;
    }

    if (!dados.unidade) {
      exibirErroCampo(selectUnidade, "A unidade de medida é obrigatória.");
      return;
    }

    // Desabilita botão durante processamento
    btnSubmit.disabled = true;
    btnSubmit.setAttribute("aria-busy", "true");

    try {
      const api = window.NailFlow?.materiais;

      if (materialEmEdicao) {
        // MODO EDIÇÃO: usa atualizarMaterialAsync
        const fnAtualizar = api?.atualizarMaterialAsync;

        if (typeof fnAtualizar !== "function") {
          throw new Error("Módulo de materiais não inicializado.");
        }

        const res = await fnAtualizar(materialEmEdicao.id, dados);

        if (res && res.sucesso) {
          form.reset();
          materialEmEdicao = null;
          exibirFeedbackMateriais(`Material "${dados.nome}" atualizado com sucesso!`, "sucesso");
          document.dispatchEvent(new CustomEvent("materiais:atualizados"));
          window.location.hash = "#materiais";
        } else {
          const msg = res?.erro?.mensagem || "Não foi possível atualizar o material.";
          if (feedbackErro) {
            feedbackErro.textContent = msg;
            feedbackErro.hidden = false;
          }
        }
      } else {
        // MODO CRIAÇÃO: usa adicionarMaterialAsync
        const fnAdicionar = api?.adicionarMaterialAsync || api?.adicionarMaterial;

        if (typeof fnAdicionar !== "function") {
          throw new Error("Módulo de materiais não inicializado.");
        }

        const res = await fnAdicionar(dados);

        if (res && res.sucesso) {
          form.reset();
          exibirFeedbackMateriais(`Material "${dados.nome}" cadastrado com sucesso!`, "sucesso");
          document.dispatchEvent(new CustomEvent("materiais:atualizados"));
          window.location.hash = "#materiais";
        } else {
          const msg = res?.erro?.mensagem || "Não foi possível cadastrar o material.";
          if (feedbackErro) {
            feedbackErro.textContent = msg;
            feedbackErro.hidden = false;
          }
        }
      }
    } catch (err) {
      console.error("[Materiais UI] Erro ao salvar material:", err);
      if (feedbackErro) {
        feedbackErro.textContent = "Erro ao cadastrar material. Verifique sua conexão e tente novamente.";
        feedbackErro.hidden = false;
      }
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.removeAttribute("aria-busy");
      // Restaura texto do botão conforme modo (criação vs edição)
      if (btnSubmit) {
        const span = btnSubmit.querySelector("span");
        if (span) {
          span.textContent = materialEmEdicao ? "Salvar alterações" : "Salvar material";
        }
      }
    }
  });
}

/**
 * Exibe erro inline no campo específico e coloca o foco nele
 * @param {HTMLElement} campo
 * @param {string} mensagem
 */
function exibirErroCampo(campo, mensagem) {
  if (!campo) return;
  campo.setAttribute("aria-invalid", "true");
  const errEl = document.getElementById(`${campo.id}-erro`);
  if (errEl) {
    errEl.textContent = mensagem;
    errEl.hidden = false;
  }
  campo.focus();
}

/**
 * Inicialização dos listeners da interface de materiais
 */
window.NailFlow = window.NailFlow || {};
window.NailFlow.materiaisUI = {
  carregarMateriais,
  renderizarListaMateriais,
  configurarFormularioCadastroMaterial,
  configurarBuscaMateriais,
  escaparHtml,
  precisaReposicao,
  normalizarParaBusca
};

document.addEventListener("DOMContentLoaded", () => {
  configurarFormularioCadastroMaterial();
  configurarBuscaMateriais();

  // Escuta evento de materiais atualizados
  document.addEventListener("materiais:atualizados", () => {
    carregarMateriais();
  });

  // Carrega materiais quando a rota ativa for #materiais
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#materiais") {
      filtroBuscaAtual = "";
      const inputBusca = document.getElementById("materiais-busca-input");
      if (inputBusca) inputBusca.value = "";
      carregarMateriais();
    }
    // Limpa modo edição ao sair da tela de cadastro
    if (window.location.hash !== "#cadastro-material" && materialEmEdicao) {
      cancelarModoEdicao();
    }
  });

  // Se já inicializou na rota #materiais
  if (window.location.hash === "#materiais") {
    filtroBuscaAtual = "";
    carregarMateriais();
  }

  // Recarregar materiais após login
  window.addEventListener("auth:login", () => {
    if (window.location.hash === "#materiais") {
      filtroBuscaAtual = "";
      const inputBusca = document.getElementById("materiais-busca-input");
      if (inputBusca) inputBusca.value = "";
      carregarMateriais();
    }
  });
});
