// Formata valores monetários para o padrão brasileiro.
const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const campoDataInicial = document.querySelector("#filtro-data-inicial");
const campoDataFinal = document.querySelector("#filtro-data-final");
const botaoFiltrar = document.querySelector("#btn-filtrar-periodo");
const botaoLimparFiltro = document.querySelector("#btn-limpar-filtro");

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

    item.textContent = [
      `Tipo: ${movimentacao.tipo}`,
      `Descrição: ${movimentacao.descricao}`,
      `Valor: ${formatadorMoeda.format(movimentacao.valor)}`,
      `Categoria: ${movimentacao.categoria}`,
      `Data: ${movimentacao.data}`,
    ].join(" | ");

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
