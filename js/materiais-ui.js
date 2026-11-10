/**
 * Interface do Módulo de Materiais (F04 e F05) - NailFlow
 * Consome exclusivamente a API pública de materiais em window.NailFlow.materiais
 */

// Estado local da UI de materiais
let materiaisCarregando = false;

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
 * Renderiza a lista de materiais cadastrados na tela F04
 * @param {Array} materiais
 */
function renderizarListaMateriais(materiais) {
  const listaEl = document.getElementById("lista-materiais");
  const vazioEl = document.getElementById("materiais-vazio");
  const loadingEl = document.getElementById("materiais-loading");

  if (loadingEl) loadingEl.hidden = true;

  if (!listaEl) return;

  if (!Array.isArray(materiais) || materiais.length === 0) {
    listaEl.innerHTML = "";
    listaEl.hidden = true;
    if (vazioEl) vazioEl.hidden = false;
    return;
  }

  if (vazioEl) vazioEl.hidden = true;
  listaEl.hidden = false;
  listaEl.innerHTML = "";

  materiais.forEach((mat) => {
    const precisaReposicao =
      Number(mat.quantidadeDisponivel) <= Number(mat.quantidadeMinima);

    const li = document.createElement("li");
    li.className = `material-card ${
      precisaReposicao ? "material-card--alerta-reposicao" : ""
    }`;
    li.dataset.materialId = mat.id;

    li.innerHTML = `
      <div class="material-card__cabecalho">
        <h3 class="material-card__nome">${escaparHtml(mat.nome)}</h3>
        ${
          precisaReposicao
            ? '<span class="badge-reposicao" aria-label="Alerta: reposição necessária">Reposição</span>'
            : ""
        }
      </div>

      <div class="material-card__metricas">
        <div class="material-card__metrica">
          <span class="material-card__metrica-rotulo">Disponível</span>
          <span class="material-card__metrica-valor ${
            precisaReposicao ? "material-card__metrica-valor--alerta" : ""
          }">
            ${escaparHtml(String(mat.quantidadeDisponivel))} ${escaparHtml(mat.unidade)}
          </span>
        </div>
        <div class="material-card__metrica">
          <span class="material-card__metrica-rotulo">Mínimo seguro</span>
          <span class="material-card__metrica-valor">
            ${escaparHtml(String(mat.quantidadeMinima))} ${escaparHtml(mat.unidade)}
          </span>
        </div>
      </div>

      <form class="material-card__ajuste" data-id="${mat.id}">
        <label for="ajuste-qtd-${mat.id}" class="material-card__ajuste-label">
          Ajustar estoque:
        </label>
        <input
          type="number"
          id="ajuste-qtd-${mat.id}"
          class="material-card__ajuste-campo"
          min="0"
          step="any"
          value="${escaparHtml(String(mat.quantidadeDisponivel))}"
          aria-label="Nova quantidade para ${escaparHtml(mat.nome)}"
          required
        >
        <button
          type="submit"
          class="material-card__btn-atualizar"
          aria-label="Salvar quantidade de ${escaparHtml(mat.nome)}"
        >
          Salvar
        </button>
      </form>
    `;

    // Handler do formulário de ajuste rápido de quantidade
    const formAjuste = li.querySelector(".material-card__ajuste");
    formAjuste.addEventListener("submit", async (e) => {
      e.preventDefault();
      const inputQtd = formAjuste.querySelector(".material-card__ajuste-campo");
      const btnAtualizar = formAjuste.querySelector(".material-card__btn-atualizar");
      const novaQtd = Number(inputQtd.value);

      if (isNaN(novaQtd) || novaQtd < 0) {
        exibirFeedbackMateriais("Informe uma quantidade válida maior ou igual a zero.", "erro");
        inputQtd.focus();
        return;
      }

      btnAtualizar.disabled = true;
      btnAtualizar.setAttribute("aria-busy", "true");

      try {
        const api = window.NailFlow?.materiais;
        const fnAtualizar = api?.atualizarQuantidadeMaterialAsync || api?.atualizarQuantidadeMaterial;

        if (typeof fnAtualizar !== "function") {
          throw new Error("Módulo de materiais não inicializado.");
        }

        const res = await fnAtualizar(mat.id, novaQtd);

        if (res && res.sucesso) {
          exibirFeedbackMateriais(`Estoque de "${mat.nome}" atualizado para ${novaQtd} ${mat.unidade}.`, "sucesso");
          // Dispara evento reativo para sincronizar listagem
          document.dispatchEvent(new CustomEvent("materiais:atualizados"));
        } else {
          const msg = res?.erro?.mensagem || "Não foi possível atualizar a quantidade.";
          exibirFeedbackMateriais(msg, "erro");
        }
      } catch (err) {
        console.error("[Materiais UI] Erro ao atualizar quantidade:", err);
        exibirFeedbackMateriais("Erro ao atualizar estoque. Tente novamente.", "erro");
      } finally {
        btnAtualizar.disabled = false;
        btnAtualizar.removeAttribute("aria-busy");
      }
    });

    listaEl.appendChild(li);
  });
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

  if (loadingEl && (!listaEl || listaEl.children.length === 0)) {
    loadingEl.hidden = false;
  }
  if (vazioEl) vazioEl.hidden = true;

  try {
    const api = window.NailFlow?.materiais;
    const fnListar = api?.listarMateriaisAsync || api?.listarMateriais;

    if (typeof fnListar !== "function") {
      throw new Error("Módulo de materiais indisponível.");
    }

    const res = await fnListar();
    const lista = res?.sucesso ? res.dados : (Array.isArray(res) ? res : []);
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
 * Configura o formulário de cadastro de material F05
 */
function configurarFormularioCadastroMaterial() {
  const form = document.getElementById("form-material");
  if (!form) return;

  const inputNome = document.getElementById("material-nome");
  const inputQtdDisp = document.getElementById("material-qtd-disponivel");
  const selectUnidade = document.getElementById("material-unidade");
  const inputQtdMin = document.getElementById("material-qtd-minima");
  const btnSubmit = form.querySelector(".btn-submit-material");
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Limpar erros prévios
    if (feedbackErro) feedbackErro.hidden = true;
    form.querySelectorAll(".form-erro-campo").forEach((el) => {
      el.hidden = true;
      el.textContent = "";
    });
    [inputNome, inputQtdDisp, selectUnidade, inputQtdMin].forEach((c) =>
      c?.removeAttribute("aria-invalid")
    );

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
      const fnAdicionar = api?.adicionarMaterialAsync || api?.adicionarMaterial;

      if (typeof fnAdicionar !== "function") {
        throw new Error("Módulo de materiais não inicializado.");
      }

      const res = await fnAdicionar(dados);

      if (res && res.sucesso) {
        form.reset();
        exibirFeedbackMateriais(`Material "${dados.nome}" cadastrado com sucesso!`, "sucesso");

        // Dispara evento para sincronizar lista de materiais
        document.dispatchEvent(new CustomEvent("materiais:atualizados"));

        // Redireciona para tela de listagem F04
        window.location.hash = "#materiais";
      } else {
        const msg = res?.erro?.mensagem || "Não foi possível cadastrar o material.";
        if (feedbackErro) {
          feedbackErro.textContent = msg;
          feedbackErro.hidden = false;
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
  escaparHtml
};

document.addEventListener("DOMContentLoaded", () => {
  configurarFormularioCadastroMaterial();

  // Escuta evento de materiais atualizados
  document.addEventListener("materiais:atualizados", () => {
    carregarMateriais();
  });

  // Carrega materiais quando a rota ativa for #materiais
  window.addEventListener("hashchange", () => {
    if (window.location.hash === "#materiais") {
      carregarMateriais();
    }
  });

  // Se já inicializou na rota #materiais
  if (window.location.hash === "#materiais") {
    carregarMateriais();
  }

  // Recarregar materiais após login
  window.addEventListener("auth:login", () => {
    if (window.location.hash === "#materiais") {
      carregarMateriais();
    }
  });
});
