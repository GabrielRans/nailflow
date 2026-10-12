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
let movimentacoes = [movimentacaoEntrada, movimentacaoSaida];

function adicionarMovimentacao(movimentacao) {
  if (movimentacao === undefined) {
    return;
  }
  movimentacoes.push(movimentacao);
  salvarMovimentacoes();
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

    adicionarMovimentacao(movimentacao);
  });
}

function iniciarAplicacao() {
  carregarMovimentacoes();
  configurarFormularioMovimentacao();
}

// Inicia o NailFlow somente quando o DOM estiver completamente carregado.
document.addEventListener("DOMContentLoaded", iniciarAplicacao);
