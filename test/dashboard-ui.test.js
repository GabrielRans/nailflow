/**
 * Testes para a UI do Dashboard - NailFlow
 * Testa a função pura obterMateriaisParaReposicao (carregada do código fonte)
 */

const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const codigoDashboardUI = fs.readFileSync("js/dashboard-ui.js", "utf8");

function criarContextoMinimo() {
  return vm.createContext({
    console,
    Number,
    Array,
    String,
    document: {
      querySelector: () => null,
      querySelectorAll: () => [],
      getElementById: () => null,
      addEventListener: () => {},
    },
    window: {
      NailFlow: {},
      addEventListener: () => {},
      location: { hash: "" },
    },
    CustomEvent: class CustomEvent {
      constructor(type, detail) {
        this.type = type;
        this.detail = detail;
      }
    },
  });
}

describe("obterMateriaisParaReposicao (do dashboard-ui.js)", () => {
  let contexto;
  let obterMateriaisParaReposicao;

  beforeEach(() => {
    contexto = criarContextoMinimo();
    vm.runInContext(codigoDashboardUI, contexto);
    obterMateriaisParaReposicao = vm.runInContext("obterMateriaisParaReposicao", contexto);
  });

  it("retorna array vazio quando lista é null", () => {
    const resultado = obterMateriaisParaReposicao(null);
    assert.strictEqual(resultado.length, 0);
  });

  it("retorna array vazio quando lista é undefined", () => {
    const resultado = obterMateriaisParaReposicao(undefined);
    assert.strictEqual(resultado.length, 0);
  });

  it("retorna array vazio quando lista não é array", () => {
    const resultado = obterMateriaisParaReposicao("string");
    assert.strictEqual(resultado.length, 0);
    const resultado2 = obterMateriaisParaReposicao({});
    assert.strictEqual(resultado2.length, 0);
    const resultado3 = obterMateriaisParaReposicao(123);
    assert.strictEqual(resultado3.length, 0);
  });

  it("retorna array vazio quando lista está vazia", () => {
    const resultado = obterMateriaisParaReposicao([]);
    assert.strictEqual(resultado.length, 0);
  });

  it("retorna array vazio quando nenhum material precisa de reposição", () => {
    const materiais = [
      { id: "1", nome: "Algodão", quantidadeDisponivel: 100, quantidadeMinima: 10, unidade: "un" },
      { id: "2", nome: "Esmalte", quantidadeDisponivel: 50, quantidadeMinima: 5, unidade: "un" },
    ];
    const resultado = obterMateriaisParaReposicao(materiais);
    assert.strictEqual(resultado.length, 0);
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