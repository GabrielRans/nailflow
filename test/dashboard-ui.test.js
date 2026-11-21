/**
 * Testes para a UI do Dashboard - NailFlow
 * Testa a função pura obterMateriaisParaReposicao
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

/**
 * Retorna os materiais que precisam de reposição (quantidadeDisponivel <= quantidadeMinima)
 * Função pura - reutiliza a mesma regra da tela de Materiais (materiais-ui.js)
 * @param {Array} materiais - Lista de materiais
 * @returns {Array} Materiais que precisam de reposição
 */
function obterMateriaisParaReposicao(materiais) {
  if (!Array.isArray(materiais)) return [];
  return materiais.filter(
    (mat) =>
      mat &&
      typeof mat === "object" &&
      Number(mat.quantidadeDisponivel) <= Number(mat.quantidadeMinima)
  );
}

describe("obterMateriaisParaReposicao", () => {
  it("retorna array vazio quando lista é null", () => {
    const resultado = obterMateriaisParaReposicao(null);
    assert.deepStrictEqual(resultado, []);
  });

  it("retorna array vazio quando lista é undefined", () => {
    const resultado = obterMateriaisParaReposicao(undefined);
    assert.deepStrictEqual(resultado, []);
  });

  it("retorna array vazio quando lista não é array", () => {
    const resultado = obterMateriaisParaReposicao("string");
    assert.deepStrictEqual(resultado, []);
    const resultado2 = obterMateriaisParaReposicao({});
    assert.deepStrictEqual(resultado2, []);
    const resultado3 = obterMateriaisParaReposicao(123);
    assert.deepStrictEqual(resultado3, []);
  });

  it("retorna array vazio quando lista está vazia", () => {
    const resultado = obterMateriaisParaReposicao([]);
    assert.deepStrictEqual(resultado, []);
  });

  it("retorna array vazio quando nenhum material precisa de reposição", () => {
    const materiais = [
      { id: "1", nome: "Algodão", quantidadeDisponivel: 100, quantidadeMinima: 10, unidade: "un" },
      { id: "2", nome: "Esmalte", quantidadeDisponivel: 50, quantidadeMinima: 5, unidade: "un" },
    ];
    const resultado = obterMateriaisParaReposicao(materiais);
    assert.deepStrictEqual(resultado, []);
  });

  it("retorna 1 item quando quantidadeDisponivel é igual a quantidadeMinima", () => {
    const materiais = [
      { id: "1", nome: "Algodão", quantidadeDisponivel: 10, quantidadeMinima: 10, unidade: "un" },
      { id: "2", nome: "Esmalte", quantidadeDisponivel: 50, quantidadeMinima: 5, unidade: "un" },
    ];
    const resultado = obterMateriaisParaReposicao(materiais);
    assert.strictEqual(resultado.length, 1);
    assert.strictEqual(resultado[0].nome, "Algodão");
  });

  it("retorna 1 item quando quantidadeDisponivel é menor que quantidadeMinima", () => {
    const materiais = [
      { id: "1", nome: "Algodão", quantidadeDisponivel: 5, quantidadeMinima: 10, unidade: "un" },
      { id: "2", nome: "Esmalte", quantidadeDisponivel: 50, quantidadeMinima: 5, unidade: "un" },
    ];
    const resultado = obterMateriaisParaReposicao(materiais);
    assert.strictEqual(resultado.length, 1);
    assert.strictEqual(resultado[0].nome, "Algodão");
  });

  it("retorna múltiplos itens quando vários precisam de reposição", () => {
    const materiais = [
      { id: "1", nome: "Algodão", quantidadeDisponivel: 5, quantidadeMinima: 10, unidade: "un" },
      { id: "2", nome: "Esmalte", quantidadeDisponivel: 3, quantidadeMinima: 5, unidade: "un" },
      { id: "3", nome: "Lixa", quantidadeDisponivel: 50, quantidadeMinima: 5, unidade: "un" },
    ];
    const resultado = obterMateriaisParaReposicao(materiais);
    assert.strictEqual(resultado.length, 2);
    assert.strictEqual(resultado[0].nome, "Algodão");
    assert.strictEqual(resultado[1].nome, "Esmalte");
  });

  it("ignora materiais inválidos (sem campos numéricos)", () => {
    const materiais = [
      { id: "1", nome: "Algodão", quantidadeDisponivel: 5, quantidadeMinima: 10, unidade: "un" },
      { id: "2", nome: "Invalido", quantidadeDisponivel: "abc", quantidadeMinima: 5, unidade: "un" },
      { id: "3", nome: "SemCampos", unidade: "un" },
      null,
      undefined,
      "string",
    ];
    const resultado = obterMateriaisParaReposicao(materiais);
    assert.strictEqual(resultado.length, 1);
    assert.strictEqual(resultado[0].nome, "Algodão");
  });

  it("funciona com números como strings", () => {
    const materiais = [
      { id: "1", nome: "Algodão", quantidadeDisponivel: "5", quantidadeMinima: "10", unidade: "un" },
      { id: "2", nome: "Esmalte", quantidadeDisponivel: "50", quantidadeMinima: "5", unidade: "un" },
    ];
    const resultado = obterMateriaisParaReposicao(materiais);
    assert.strictEqual(resultado.length, 1);
    assert.strictEqual(resultado[0].nome, "Algodão");
  });

  it("não muta o array original", () => {
    const materiais = [
      { id: "1", nome: "Algodão", quantidadeDisponivel: 5, quantidadeMinima: 10, unidade: "un" },
    ];
    const originalLength = materiais.length;
    obterMateriaisParaReposicao(materiais);
    assert.strictEqual(materiais.length, originalLength);
  });
});