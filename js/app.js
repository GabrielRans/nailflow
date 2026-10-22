const CHAVE_MOVIMENTACOES = "nailflow_movimentacoes";

let movimentacoes = [];

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

function buscarMovimentacaoPorId(id) {
  const movimentacaoEncontrada = movimentacoes.find((movimentacao) => {
    return movimentacao.id === id;
  });

  return movimentacaoEncontrada;
}

function atualizarMovimentacao(id, dadosAtualizados) {
  const indice = movimentacoes.findIndex((movimentacao) => {
    return movimentacao.id === id;
  });

  if (indice === -1) {
    return false;
  }

  movimentacoes[indice] = {
    ...dadosAtualizados,
    id
  };

  salvarMovimentacoes();

  document.dispatchEvent(
    new CustomEvent("movimentacoes:atualizadas", {
      detail: listarMovimentacoes(),
    })
  );

  return true;
}

function ExcluirMovimentacao(id) {
  const indice = movimentacoes.findIndex((movimentacao) => {
    return movimentacao.id === id;
  });

  if (indice === -1) {
    return false;
  }

  movimentacoes.splice(indice, 1);

  salvarMovimentacoes();

  document.dispatchEvent(
    new CustomEvent("movimentacoes:atualizadas", {
      detail: listarMovimentacoes(),
    })
  );

  return true;
}

function filtrarMovimentacoesPorPeriodo(dataInicial, dataFinal) {
  const movimentacoesFiltradas = movimentacoes.filter((movimentacao) => {
    const atendeDataInicial =
    !dataInicial || movimentacao.data >= dataInicial;

    const atendeDataFinal =
    !dataFinal || movimentacao.data <= dataFinal;

    return atendeDataInicial && atendeDataFinal;
  });

  return movimentacoesFiltradas;
}

//Configura o comportamento do formulário de cadastro de movimentações.
function configurarFormularioMovimentacao() {
  const formulario = document.querySelector("#form-movimentacao");

  formulario.addEventListener("submit", function (event) {
    event.preventDefault();

    const dadosFormulario = new FormData(formulario);

    const idMovimentacao = dadosFormulario.get("id");

    const movimentacao = {
      tipo: dadosFormulario.get("tipo"),
      valor: Number(dadosFormulario.get("valor")),
      descricao: dadosFormulario.get("descricao"),
      categoria: dadosFormulario.get("categoria"),
      data: dadosFormulario.get("data"),
      observacao: dadosFormulario.get("observacao")
    };

    let movimentacaoSalva;

    if (idMovimentacao) {
      movimentacaoSalva = atualizarMovimentacao(
        idMovimentacao,
        movimentacao
      );
    } else {
      const novaMovimentacao = {
        ...movimentacao,
        id: crypto.randomUUID()
      };

      movimentacaoSalva = adicionarMovimentacao(novaMovimentacao);
    }

    if (movimentacaoSalva) {
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

//Calcula os indicadores financeiros a partir das movimentações cadastradas.
function calcularIndicadoresFinanceiros(movimentacoes) {
  let totalEntradas = 0;
  let totalSaidas = 0;
  let quantidadeEntradas = 0;

  if (!Array.isArray(movimentacoes)) {
    return {
      totalEntradas: 0,
      totalSaidas: 0,
      saldo: 0,
      ticketMedio: 0
    };
  }

  for (const movimentacao of movimentacoes) {
    if (movimentacao.tipo === "entrada") {
        totalEntradas += movimentacao.valor;
        quantidadeEntradas++;
      } else if (movimentacao.tipo === "saida") {
      totalSaidas += movimentacao.valor;
    }
  }

  const saldo = totalEntradas - totalSaidas;

  const ticketMedio = quantidadeEntradas > 0
    ?  totalEntradas / quantidadeEntradas
    : 0;

  return {
    totalEntradas,
    totalSaidas,
    saldo,
    ticketMedio
  };
}
function iniciarAplicacao() {
  carregarMovimentacoes();
  configurarFormularioMovimentacao();
}

// Inicia o NailFlow somente quando o DOM estiver completamente carregado.
document.addEventListener("DOMContentLoaded", iniciarAplicacao);
