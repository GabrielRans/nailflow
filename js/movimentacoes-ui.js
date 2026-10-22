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

botaoFiltrar.addEventListener("click", () => {
  const dataInicial = campoDataInicial.value;
  const dataFinal = campoDataFinal.value;

  if (dataInicial && dataFinal && dataInicial > dataFinal) {
    alert("A data incial não pode ser posterior à data final.");
    return;
  }

  const movimentacoesFiltradas = filtrarMovimentacoesPorPeriodo(
    dataInicial,
    dataFinal
  );

  renderizarMovimentacoes(movimentacoesFiltradas);
});

botaoLimparFiltro.addEventListener("click", () => {
    campoDataInicial.value = "";
    campoDataFinal.value = "";

  renderizarMovimentacoes(listarMovimentacoes());
});

// Renderiza na interface as movimentações recebidas.
function renderizarMovimentacoes(movimentacoes) {
  const lista = document.querySelector("#lista-movimentacoes");

  lista.replaceChildren();

  if (movimentacoes.length === 0) {
    const itemVazio = document.createElement("li");
    itemVazio.textContent = "Nenhuma movimentação salva.";
    lista.append(itemVazio);
    return;
  }

  movimentacoes.forEach((movimentacao) => {
    const item = document.createElement("li");
    const ehReceita = movimentacao.tipo === "entrada";
    item.className = `movimentacao movimentacao--${ehReceita ? "receita" : "despesa"}`;

    const tipo = document.createElement("span");
    tipo.className = "movimentacao__tipo";
    tipo.textContent = ehReceita ? "Receita" : "Despesa";

    const indicador = document.createElement("span");
    indicador.className = "movimentacao__indicador";
    indicador.setAttribute("aria-hidden", "true");
    indicador.textContent = ehReceita ? "↑" : "↓";

    const conteudo = document.createElement("div");
    conteudo.className = "movimentacao__conteudo";

    const descricao = document.createElement("p");
    descricao.className = "movimentacao__descricao";
    descricao.textContent = movimentacao.descricao;

    const detalhes = document.createElement("p");
    detalhes.className = "movimentacao__detalhes";
    detalhes.textContent = `${movimentacao.categoria} • ${movimentacao.data}`;
    conteudo.append(descricao, detalhes);

    const valor = document.createElement("strong");
    valor.className = "movimentacao__valor";
    valor.textContent = formatadorMoeda.format(movimentacao.valor);

    const botaoEditar = document.createElement("button");
    botaoEditar.type = "button";
    botaoEditar.textContent = "Editar";
    botaoEditar.className = "movimentacao__editar";

    botaoEditar.addEventListener("click", () => {
      const movimentacaoSelecionada = buscarMovimentacaoPorId(movimentacao.id);

      campoIdMovimentacao.value = movimentacaoSelecionada.id;

      formularioMovimentacao.elements.tipo.value = movimentacaoSelecionada.tipo;
      formularioMovimentacao.elements.valor.value = movimentacaoSelecionada.valor;
      formularioMovimentacao.elements.descricao.value = movimentacaoSelecionada.descricao;
      formularioMovimentacao.elements.categoria.value = movimentacaoSelecionada.categoria;
      formularioMovimentacao.elements.data.value = movimentacaoSelecionada.data;
      formularioMovimentacao.elements.observacao.value = movimentacaoSelecionada.observacao;
    });

    item.append(tipo, indicador, conteudo, valor, botaoEditar);

    lista.append(item);
  });
}

// Atualiza a interface sempre que o estado das movimentações mudar.
document.addEventListener("movimentacoes:atualizadas", (event) => {
  renderizarMovimentacoes(event.detail);
});

// Renderiza os dados iniciais somente após a aplicação carregar o estado persistido
document.addEventListener("DOMContentLoaded", () => {
  renderizarMovimentacoes(listarMovimentacoes());
});
