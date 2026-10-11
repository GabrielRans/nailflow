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

function iniciarAplicacao() {
  carregarMovimentacoes();
}

iniciarAplicacao();
