const movimentacaoEntrada = {
  tipo: "entrada",
  valor: 120,
  descricao: "alongamento em gel",
  categoria: "procedimento",
  data: "2026-10-09",
  observacao: ""
};

const movimentacaoSaida = {
  tipo: "saida",
  valor: 50,
  descricao: "unhas postiças",
  categoria: "material",
  data: "2026-10-10",
  observacao: ""
};

const novaMovimentacao = {
  tipo: "entrada",
  valor: 35,
  descricao: "Nail Design",
  categoria: "serviço",
  data: "2026-10-10",
  observacao: ""
};

const CHAVE_MOVIMENTACOES = "nailflow_movimentacoes";
const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
let movimentacoes = [movimentacaoEntrada, movimentacaoSaida];

function adicionarMovimentacao(movimentacao) {
  if (!validarMovimentacao(movimentacao)) {
    return false;
  }

  movimentacoes.push(movimentacao);
  salvarMovimentacoes();

  document.dispatchEvent(
    new CustomEvent("movimentacoes:atualizadas", {
      detail: listarMovimentacoes(),
    })
  );

  return true;
}

function salvarMovimentacoes() {
  const textoMovimentacoes = JSON.stringify(movimentacoes);

  localStorage.setItem(CHAVE_MOVIMENTACOES, textoMovimentacoes);
}

function carregarMovimentacoes() {
  const dadosSalvos = localStorage.getItem(CHAVE_MOVIMENTACOES);

  if (dadosSalvos !== null) {
    const dadosConvertidos = JSON.parse(dadosSalvos);
    movimentacoes = dadosConvertidos;
  }
}

// Retorna uma cópia da lista de movimentações cadastradas.
function listarMovimentacoes() {
  return movimentacoes.map((movimentacao) => ({
    ...movimentacao,
  }));
}

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

    item.append(tipo, indicador, conteudo, valor);

    lista.append(item);
  });
}

//Configura o comportamento do formulário de cadastro de movimentações.
function configurarFormularioMovimentacao() {
  const formulario = document.querySelector("#form-movimentacao");

   formulario.addEventListener("submit", function (event) {
    event.preventDefault();

    const dadosFormulario = new FormData(formulario);

    const movimentacao = {
      id: crypto.randomUUID(),
      tipo: dadosFormulario.get("tipo"),
      valor: Number(dadosFormulario.get("valor")),
      descricao: dadosFormulario.get("descricao"),
      categoria: dadosFormulario.get("categoria"),
      data: dadosFormulario.get("data"),
      observacao: dadosFormulario.get("observacao")
    };

    const movimentacaoAdicionada = adicionarMovimentacao(movimentacao);

    if (movimentacaoAdicionada) {
      formulario.reset();
    }
  });
}

// Valida os dados obrigatórios antes de adicionar uma movimentação.
function validarMovimentacao(movimentacao) {
  if (!movimentacao || typeof movimentacao !== "object") {
    return false;
  }

  const tiposValidos = ["entrada", "saida"];
  const categoriasValidas = ["procedimento", "material", "servico", "outro"];

  if (!tiposValidos.includes(movimentacao.tipo)) {
    return false;
  }

  if (
    typeof movimentacao.valor !== "number" ||
    !Number.isFinite(movimentacao.valor) ||
    movimentacao.valor <= 0
  ) {
    return false;
  }

  if (
    typeof movimentacao.descricao !== "string" ||
    movimentacao.descricao.trim() === ""
  ) {
    return false;
  }

  if (!categoriasValidas.includes(movimentacao.categoria)) {
    return false;
  }

  if (
    typeof movimentacao.data !== "string" ||
    movimentacao.data.trim() === ""
  ) {
    return false;
  }

  return true;
}

function iniciarAplicacao() {
  carregarMovimentacoes();
  document.addEventListener("movimentacoes:atualizadas", (event) => {
    renderizarMovimentacoes(event.detail);
  });
  renderizarMovimentacoes(listarMovimentacoes());
  configurarFormularioMovimentacao();
}

// Inicia o NailFlow somente quando o DOM estiver completamente carregado.
document.addEventListener("DOMContentLoaded", iniciarAplicacao);
