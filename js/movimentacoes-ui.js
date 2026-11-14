/**
 * UI de Movimentações - NailFlow
 * Usa API assíncrona do módulo financeiro com estados de carregamento
 */

// Formata valores monetários para o padrão brasileiro.
const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const campoDataInicial = document.querySelector("#filtro-data-inicial");
const campoDataFinal = document.querySelector("#filtro-data-final");
const botaoFiltrar = document.querySelector("#btn-filtrar-periodo");
const botaoLimparFiltro = document.querySelector("#btn-limpar-filtro");
const formularioMovimentacao = document.querySelector("#form-movimentacao");
const campoIdMovimentacao = document.querySelector("#movimentacao-id");
const mensagemErroFinanceiro = document.querySelector("#financeiro-erro");
const listaMovimentacoes = document.querySelector("#lista-movimentacoes");
const campoTipoSelect = document.querySelector("#tipo");
const botoesTipo = document.querySelectorAll(".btn-tipo");
const btnCancelarMovimentacao = document.querySelector("#btn-cancelar-movimentacao");

// Estado de loading
let carregando = false;

/**
 * Sincroniza os botões de alternância de tipo com o select oculto
 * @param {string} tipo - "entrada" ou "saida"
 */
function sincronizarBotoesTipo(tipo) {
  // Atualiza o select oculto (compatibilidade JS)
  if (campoTipoSelect) {
    campoTipoSelect.value = tipo;
  }

  // Atualiza estado visual dos botões
  botoesTipo.forEach((botao) => {
    const ehAtivo = botao.dataset.tipo === tipo;
    botao.classList.toggle("ativo", ehAtivo);
    botao.setAttribute("aria-checked", ehAtivo.toString());
  });
}

/**
 * Inicializa os listeners dos botões de tipo (Entrada/Saída)
 */
function inicializarBotoesTipo() {
  botoesTipo.forEach((botao) => {
    botao.addEventListener("click", () => {
      const tipo = botao.dataset.tipo;
      sincronizarBotoesTipo(tipo);
    });
  });

  // Handler do botão Cancelar
  if (btnCancelarMovimentacao) {
    btnCancelarMovimentacao.addEventListener("click", () => {
      limparFormularioMovimentacaoCompleto();
      // Volta para a tela financeiro
      window.location.hash = "#financeiro";
    });
  }
}

/**
 * Limpa o formulário completamente incluindo botões de tipo
 */
function limparFormularioMovimentacaoCompleto() {
  if (formularioMovimentacao) {
    formularioMovimentacao.reset();
    if (campoIdMovimentacao) campoIdMovimentacao.value = "";
    // Resetar botões de tipo (nenhum selecionado)
    botoesTipo.forEach((botao) => {
      botao.classList.remove("ativo");
      botao.setAttribute("aria-checked", "false");
    });
    if (campoTipoSelect) campoTipoSelect.value = "";
    // Focar no primeiro campo
    const primeiroCampo = formularioMovimentacao.querySelector("input, select");
    primeiroCampo?.focus();
  }
}

/**
 * Mostra/esconde estado de carregamento na lista
 * @param {boolean} mostrar
 */
function setCarregando(mostrar) {
  carregando = mostrar;
  if (mostrar) {
    listaMovimentacoes.innerHTML = `
      <div class="movimentacoes-carregando" role="status" aria-live="polite">
        <div class="spinner" aria-hidden="true"></div>
        <span>Carregando movimentações...</span>
      </div>
    `;
  }
}

/**
 * Ordena movimentações por data decrescente, depois por ID para desempate
 * @param {Array} movs
 * @returns {Array} Novo array ordenado (não muta o original)
 */
function ordenarMovimentacoes(movs) {
  return [...movs].sort((a, b) => {
    if (b.data !== a.data) return b.data.localeCompare(a.data);
    return b.id.localeCompare(a.id);
  });
}

/**
 * Renderiza na interface as movimentações recebidas.
 * @param {Array} movimentacoes
 */
function renderizarMovimentacoes(movimentacoes) {
  // Garante ordenação: mais recentes primeiro (data desc, depois ID desc)
  const movsOrdenadas = ordenarMovimentacoes(movimentacoes);
  listaMovimentacoes.replaceChildren();

  if (movsOrdenadas.length === 0) {
    const itemVazio = document.createElement("div");
    itemVazio.className = "movimentacoes-vazio";
    itemVazio.setAttribute("role", "status");

    const tituloVazio = document.createElement("strong");
    tituloVazio.textContent = "Nenhuma movimentação cadastrada";

    const mensagemVazia = document.createElement("p");
    mensagemVazia.textContent = "Cadastre uma receita ou despesa para começar.";

    itemVazio.append(tituloVazio, mensagemVazia);
    listaMovimentacoes.append(itemVazio);
    return;
  }

  movsOrdenadas.forEach((movimentacao) => {
    const item = document.createElement("li");
    const ehReceita = movimentacao.tipo === "entrada";
    item.className = `item-movimentacao ${ehReceita ? "receita" : "despesa"}`;

    // Ícone circular da movimentação (seta para cima/baixo)
    const icone = document.createElement("div");
    icone.className = `icone-movimentacao ${ehReceita ? "receita" : "despesa"}`;
    icone.setAttribute("aria-hidden", "true");
    icone.textContent = ehReceita ? "↑" : "↓";

    // Container principal com as informações
    const infoPrincipal = document.createElement("div");
    infoPrincipal.className = "info-principal";

    const descricao = document.createElement("strong");
    descricao.className = "descricao";
    descricao.textContent = movimentacao.descricao;

    const detalhes = document.createElement("span");
    detalhes.className = "detalhes";
    // Formata data para DD/MM/AAAA apenas na exibição
    const dataFormatada = movimentacao.data
      ? movimentacao.data.split("-").reverse().join("/")
      : "";
    detalhes.textContent = `${movimentacao.categoria} • ${dataFormatada}`;

    infoPrincipal.append(descricao, detalhes);

    // Lado direito: Valor + Ações (estrutura conforme wireframe)
    const direitaCard = document.createElement("div");
    direitaCard.className = "direita-card";

    // Valor
    const valor = document.createElement("strong");
    valor.className = `valor ${ehReceita ? "receita" : "despesa"}`;
    valor.textContent = formatadorMoeda.format(movimentacao.valor);

    // Ações
    const acoes = document.createElement("div");
    acoes.className = "acoes";

    // Botão Editar (ícone de lápis)
    const botaoEditar = document.createElement("button");
    botaoEditar.type = "button";
    botaoEditar.className = "btn-acao-editar";
    botaoEditar.setAttribute(
      "aria-label",
      `Editar movimentação: ${movimentacao.descricao}`
    );
    botaoEditar.title = `Editar movimentação: ${movimentacao.descricao}`;
    botaoEditar.innerHTML = `
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;

    botaoEditar.addEventListener("click", async () => {
      // Usa API assíncrona para buscar a movimentação (compatível com Supabase)
      botaoEditar.disabled = true;
      botaoEditar.setAttribute("aria-busy", "true");
      botaoEditar.innerHTML = `
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spinner-icon" style="animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
        </svg>
      `;

      try {
        const movimentacaoSelecionada = await window.NailFlow.financeiro.buscarMovimentacaoPorIdAsync(movimentacao.id);

        if (!movimentacaoSelecionada) {
          mensagemErroFinanceiro.textContent =
            "Não foi possível editar esta movimentação. O registro não foi encontrado.";
          botaoEditar.disabled = false;
          botaoEditar.removeAttribute("aria-busy");
          botaoEditar.innerHTML = `
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          `;
          return;
        }

        mensagemErroFinanceiro.textContent = "";

        campoIdMovimentacao.value = movimentacaoSelecionada.id;

        formularioMovimentacao.elements.tipo.value =
          movimentacaoSelecionada.tipo;
        formularioMovimentacao.elements.valor.value =
          movimentacaoSelecionada.valor;
        formularioMovimentacao.elements.descricao.value =
          movimentacaoSelecionada.descricao;
        formularioMovimentacao.elements.categoria.value =
          movimentacaoSelecionada.categoria;
        formularioMovimentacao.elements.data.value =
          movimentacaoSelecionada.data;
        formularioMovimentacao.elements.observacao.value =
          movimentacaoSelecionada.observacao ?? "";

        // Sincroniza botões de tipo (Entrada/Saída) com o valor do select
        sincronizarBotoesTipo(movimentacaoSelecionada.tipo);

        navegarParaEdicao(botaoEditar);
      } catch (err) {
        console.error('[UI] Erro ao buscar movimentação para edição:', err);
        mensagemErroFinanceiro.textContent =
          "Erro ao carregar dados da movimentação. Tente novamente.";
      } finally {
        botaoEditar.disabled = false;
        botaoEditar.removeAttribute("aria-busy");
        botaoEditar.innerHTML = `
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        `;
      }
    });

    // Botão Excluir (ícone de lixeira)
    const botaoExcluir = document.createElement("button");
    botaoExcluir.type = "button";
    botaoExcluir.className = "btn-acao-excluir";
    botaoExcluir.setAttribute(
      "aria-label",
      `Excluir movimentação: ${movimentacao.descricao}`
    );
    botaoExcluir.title = `Excluir movimentação: ${movimentacao.descricao}`;
    botaoExcluir.innerHTML = `
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;

    botaoExcluir.addEventListener("click", async () => {
      const confirmou = confirm(
        "Deseja realmente excluir esta movimentação?"
      );

      if (!confirmou) return;

      botaoExcluir.disabled = true;
      botaoExcluir.setAttribute("aria-busy", "true");
      botaoExcluir.innerHTML = `
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="spinner-icon" style="animation: spin 1s linear infinite;">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke-opacity="1"></path>
        </svg>
      `;

      try {
        const ok = await window.NailFlow.financeiro.excluirMovimentacaoAsync(movimentacao.id);
        if (!ok) {
          alert("Erro ao excluir movimentação. Tente novamente.");
          botaoExcluir.disabled = false;
          botaoExcluir.removeAttribute("aria-busy");
          botaoExcluir.innerHTML = `
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          `;
        }
        // Evento 'movimentacoes:atualizadas' disparará renderização automática
      } catch (err) {
        console.error('[UI] Erro ao excluir:', err);
        alert("Erro ao excluir movimentação.");
        botaoExcluir.disabled = false;
        botaoExcluir.removeAttribute("aria-busy");
        botaoExcluir.innerHTML = `
          <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        `;
      }
    });

    acoes.append(botaoEditar, botaoExcluir);
    direitaCard.append(valor, acoes);
    item.append(icone, infoPrincipal, direitaCard);

    listaMovimentacoes.append(item);
  });
}

/**
 * Carrega e renderiza movimentações filtradas
 */
async function carregarEFiltrar(dataInicial, dataFinal) {
  setCarregando(true);
  try {
    const movs = await window.NailFlow.financeiro.filtrarMovimentacoesPorPeriodoAsync(dataInicial, dataFinal);
    renderizarMovimentacoes(movs);
  } catch (err) {
    console.error('[UI] Erro ao filtrar:', err);
    renderizarMovimentacoes([]);
    mensagemErroFinanceiro.textContent = "Erro ao carregar movimentações. Tente recarregar a página.";
  } finally {
    setCarregando(false);
  }
}

/**
 * Carrega e renderiza todas as movimentações
 */
async function carregarTodas() {
  setCarregando(true);
  try {
    const movs = await window.NailFlow.financeiro.listarMovimentacoesAsync();
    renderizarMovimentacoes(movs);
  } catch (err) {
    console.error('[UI] Erro ao carregar:', err);
    renderizarMovimentacoes([]);
    mensagemErroFinanceiro.textContent = "Erro ao carregar movimentações. Tente recarregar a página.";
  } finally {
    setCarregando(false);
  }
}

// Handlers de filtro
botaoFiltrar.addEventListener("click", () => {
  const dataInicial = campoDataInicial.value;
  const dataFinal = campoDataFinal.value;

  if (dataInicial && dataFinal && dataInicial > dataFinal) {
    alert("A data inicial não pode ser posterior à data final.");
    return;
  }

  carregarEFiltrar(dataInicial, dataFinal);
});

botaoLimparFiltro.addEventListener("click", () => {
  campoDataInicial.value = "";
  campoDataFinal.value = "";
  carregarTodas();
});

// Atualiza a interface sempre que o estado das movimentações mudar (evento síncrono do cache local)
document.addEventListener("movimentacoes:atualizadas", (event) => {
  if (!carregando) {
    renderizarMovimentacoes(event.detail);
  }
});

// Renderiza os dados iniciais quando o usuário estiver autenticado E autorizado
function inicializarMovimentacoes() {
  // Se já autenticado e autorizado, carrega imediatamente
  if (window.NailFlow?.auth?.autorizado === true) {
    carregarTodas();
    return;
  }

  // Caso contrário, aguarda o evento auth:login (AuthN + AuthZ OK)
  window.addEventListener('auth:login', async () => {
    await carregarTodas();
  }, { once: true });
}

// Limpa a lista no logout
window.addEventListener('auth:logout', () => {
  listaMovimentacoes.replaceChildren();
  const itemVazio = document.createElement("li");
  itemVazio.className = "movimentacoes-vazio";
  itemVazio.setAttribute("role", "status");
  const tituloVazio = document.createElement("strong");
  tituloVazio.textContent = "Faça login para ver suas movimentações";
  itemVazio.append(tituloVazio);
  listaMovimentacoes.append(itemVazio);
})

// Inicializa no DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
  inicializarMovimentacoes();
  inicializarBotoesTipo();
});