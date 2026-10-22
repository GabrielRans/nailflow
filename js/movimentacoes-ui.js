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
    itemVazio.className = "movimentacoes-vazio";
    itemVazio.setAttribute("role", "status");

    const tituloVazio = document.createElement("strong");
    tituloVazio.textContent = "Nenhuma movimentação cadastrada";

    const mensagemVazia = document.createElement("p");
    mensagemVazia.textContent = "Cadastre uma receita ou despesa para começar.";

    itemVazio.append(tituloVazio, mensagemVazia);
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
    detalhes.setAttribute(
      "aria-label",
      `${movimentacao.categoria} • ${movimentacao.data}`
    );

    const categoria = document.createElement("span");
    categoria.className = "movimentacao__categoria";
    categoria.textContent = movimentacao.categoria;

    const separador = document.createElement("span");
    separador.setAttribute("aria-hidden", "true");
    separador.textContent = "•";

    const data = document.createElement("span");
    data.className = "movimentacao__data";
    data.textContent = movimentacao.data;

    detalhes.append(categoria, separador, data);
    conteudo.append(descricao, detalhes);

    const valor = document.createElement("strong");
    valor.className = "movimentacao__valor";
    valor.textContent = formatadorMoeda.format(movimentacao.valor);

    const lateral = document.createElement("div");
    lateral.className = "movimentacao__lateral";
    lateral.append(valor);

    const acoes = document.createElement("div");
    acoes.className = "movimentacao__acoes";

    const botaoEditar = document.createElement("button");
    botaoEditar.type = "button";
    botaoEditar.className = "movimentacao__acao";
    botaoEditar.textContent = "Editar";
    botaoEditar.setAttribute(
      "aria-label",
      `Editar movimentação: ${movimentacao.descricao}`
    );

    const botaoExcluir = document.createElement("button");
    botaoExcluir.type = "button";
    botaoExcluir.className = "movimentacao__acao";
    botaoExcluir.textContent = "Excluir";
    botaoExcluir.setAttribute(
      "aria-label",
      `Excluir movimentação: ${movimentacao.descricao}`
    );

    acoes.append(botaoEditar, botaoExcluir);
    lateral.append(acoes);
    item.append(tipo, indicador, conteudo, lateral);

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
