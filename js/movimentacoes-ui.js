// Formata valores monetários para o padrão brasileiro.
const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
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
