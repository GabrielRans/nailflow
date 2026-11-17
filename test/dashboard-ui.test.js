/**
 * Testes para a UI do Dashboard - NailFlow
 * Testa as funções puras:
 * - obterMateriaisParaReposicao
 * - determinarEstadoSaldo (Issue #25)
 * - obterTextoAcessivelIndicador (Issue #25)
 * - formatarDataCurta
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const {
  obterMateriaisParaReposicao,
  determinarEstadoSaldo,
  obterTextoAcessivelIndicador,
  formatarDataCurta,
} = require("../js/dashboard-ui.js");

describe("obterMateriaisParaReposicao", () => {
  it("retorna array vazio quando lista é null", () => {
    assert.deepStrictEqual(obterMateriaisParaReposicao(null), []);
  });

  it("retorna array vazio quando lista é undefined", () => {
    assert.deepStrictEqual(obterMateriaisParaReposicao(undefined), []);
  });

  it("retorna array vazio quando lista não é array", () => {
    assert.deepStrictEqual(obterMateriaisParaReposicao("não é array"), []);
    assert.deepStrictEqual(obterMateriaisParaReposicao(123), []);
    assert.deepStrictEqual(obterMateriaisParaReposicao({}), []);
  });

  it("retorna array vazio quando lista está vazia", () => {
    assert.deepStrictEqual(obterMateriaisParaReposicao([]), []);
  });

  it("retorna apenas materiais com estoque crítico (disponível <= mínimo)", () => {
    const materiais = [
      { id: "1", nome: "Esmalte Vermelho", quantidadeDisponivel: 2, quantidadeMinima: 5 }, // precisa
      { id: "2", nome: "Algodão", quantidadeDisponivel: 10, quantidadeMinima: 3 },          // ok
      { id: "3", nome: "Acetona", quantidadeDisponivel: 1, quantidadeMinima: 1 },           // precisa (igual)
      { id: "4", nome: "Lixa", quantidadeDisponivel: 0, quantidadeMinima: 2 },              // precisa (zerado)
    ];

    const resultado = obterMateriaisParaReposicao(materiais);

    assert.strictEqual(resultado.length, 3);
    assert.strictEqual(resultado[0].nome, "Esmalte Vermelho");
    assert.strictEqual(resultado[1].nome, "Acetona");
    assert.strictEqual(resultado[2].nome, "Lixa");
  });

  it("retorna array vazio quando nenhum material precisa de reposição", () => {
    const materiais = [
      { id: "1", nome: "Esmalte Vermelho", quantidadeDisponivel: 10, quantidadeMinima: 5 },
      { id: "2", nome: "Algodão", quantidadeDisponivel: 20, quantidadeMinima: 3 },
    ];

    assert.deepStrictEqual(obterMateriaisParaReposicao(materiais), []);
  });

  it("converte strings numéricas corretamente", () => {
    const materiais = [
      { id: "1", nome: "Esmalte", quantidadeDisponivel: "2", quantidadeMinima: "5" },
      { id: "2", nome: "Algodão", quantidadeDisponivel: "10", quantidadeMinima: "3" },
    ];

    const resultado = obterMateriaisParaReposicao(materiais);
    assert.strictEqual(resultado.length, 1);
    assert.strictEqual(resultado[0].nome, "Esmalte");
  });

  it("ignora itens inválidos ou corrompidos na lista", () => {
    const materiais = [
      null,
      undefined,
      "item inválido",
      { id: "1", nome: "Esmalte", quantidadeDisponivel: 1, quantidadeMinima: 5 },
    ];

    const resultado = obterMateriaisParaReposicao(materiais);
    assert.strictEqual(resultado.length, 1);
    assert.strictEqual(resultado[0].nome, "Esmalte");
  });

  it("preserva a imutabilidade do array de entrada", () => {
    const materiais = [
      { id: "1", nome: "Esmalte", quantidadeDisponivel: 1, quantidadeMinima: 5 },
    ];
    const originalLength = materiais.length;

    obterMateriaisParaReposicao(materiais);
    assert.strictEqual(materiais.length, originalLength);
  });
});

describe("determinarEstadoSaldo (Issue #25)", () => {
  it("retorna 'positivo' para valor maior que zero", () => {
    assert.strictEqual(determinarEstadoSaldo(100), "positivo");
    assert.strictEqual(determinarEstadoSaldo(0.01), "positivo");
    assert.strictEqual(determinarEstadoSaldo("250.75"), "positivo");
  });

  it("retorna 'negativo' para valor menor que zero", () => {
    assert.strictEqual(determinarEstadoSaldo(-50), "negativo");
    assert.strictEqual(determinarEstadoSaldo(-0.01), "negativo");
    assert.strictEqual(determinarEstadoSaldo("-120.00"), "negativo");
  });

  it("retorna 'neutro' para zero e valores nulos ou inválidos", () => {
    assert.strictEqual(determinarEstadoSaldo(0), "neutro");
    assert.strictEqual(determinarEstadoSaldo(-0), "neutro");
    assert.strictEqual(determinarEstadoSaldo("0"), "neutro");
    assert.strictEqual(determinarEstadoSaldo(null), "neutro");
    assert.strictEqual(determinarEstadoSaldo(undefined), "neutro");
    assert.strictEqual(determinarEstadoSaldo(NaN), "neutro");
    assert.strictEqual(determinarEstadoSaldo("invalido"), "neutro");
  });
});

describe("obterTextoAcessivelIndicador (Issue #25)", () => {
  it("gera texto acessível para saldo positivo, negativo e neutro", () => {
    assert.strictEqual(
      obterTextoAcessivelIndicador("saldo", "R$ 500,00", "positivo"),
      "Resultado: R$ 500,00 (saldo positivo)"
    );
    assert.strictEqual(
      obterTextoAcessivelIndicador("saldo", "-R$ 150,00", "negativo"),
      "Resultado: -R$ 150,00 (saldo negativo)"
    );
    assert.strictEqual(
      obterTextoAcessivelIndicador("saldo", "R$ 0,00", "neutro"),
      "Resultado: R$ 0,00 (saldo zerado)"
    );
  });

  it("gera texto acessível para outros indicadores", () => {
    assert.strictEqual(
      obterTextoAcessivelIndicador("totalEntradas", "R$ 1.250,00"),
      "Total de entradas: R$ 1.250,00"
    );
    assert.strictEqual(
      obterTextoAcessivelIndicador("totalSaidas", "R$ 320,00"),
      "Total de saídas: R$ 320,00"
    );
    assert.strictEqual(
      obterTextoAcessivelIndicador("ticketMedio", "R$ 125,00"),
      "Ticket médio: R$ 125,00"
    );
  });
});

describe("formatarDataCurta", () => {
  it("formata data ISO YYYY-MM-DD para DD/MM", () => {
    assert.strictEqual(formatarDataCurta("2026-11-16"), "16/11");
    assert.strictEqual(formatarDataCurta("2026-05-01"), "01/05");
  });

  it("retorna '--/--' quando data não é informada", () => {
    assert.strictEqual(formatarDataCurta(null), "--/--");
    assert.strictEqual(formatarDataCurta(""), "--/--");
    assert.strictEqual(formatarDataCurta(undefined), "--/--");
  });
});
