const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");

// Carrega o módulo app.js em um contexto isolado
const codigoApp = fs.readFileSync("js/app.js", "utf8");

function criarContextoApp() {
  const contexto = vm.createContext({
    crypto: webcrypto,
    localStorage: {
      _store: {},
      getItem(chave) { return this._store[chave] ?? null; },
      setItem(chave, valor) { this._store[chave] = valor; },
      removeItem(chave) { delete this._store[chave]; },
      clear() { this._store = {}; }
    },
    document: {
      _eventos: {},
      dispatchEvent(evento) {
        if (this._eventos[evento.type]) {
          this._eventos[evento.type].forEach(cb => cb(evento));
        }
        return true;
      },
      addEventListener(tipo, callback) {
        this._eventos[tipo] = this._eventos[tipo] || [];
        this._eventos[tipo].push(callback);
      },
      removeEventListener(tipo, callback) {
        if (this._eventos[tipo]) {
          this._eventos[tipo] = this._eventos[tipo].filter(cb => cb !== callback);
        }
      },
      querySelector(selector) {
        if (selector === "#form-movimentacao") {
          return {
            addEventListener: () => {},
            reset: () => {},
            elements: {
              tipo: { value: "" },
              valor: { value: "" },
              descricao: { value: "" },
              categoria: { value: "" },
              data: { value: "" },
              observacao: { value: "" },
              id: { value: "" }
            }
          };
        }
        return null;
      }
    },
    CustomEvent: function(type, options = {}) {
      this.type = type;
      this.detail = options.detail;
    },
    console,
    setTimeout,
    clearTimeout
  });

  vm.runInContext(codigoApp, contexto);
  return contexto;
}

// Factory de repositório em memória para testes (padrão Repository)
function criarRepositorioMemoria() {
  const movimentacoes = [];
  return {
    movimentacoes,
    async salvar(todas) {
      movimentacoes.length = 0;
      movimentacoes.push(...todas);
    },
    async listar() { return [...movimentacoes]; },
    async buscarPorId(id) { return movimentacoes.find(m => m.id === id) ?? null; },
    async adicionar(movimentacao) { movimentacoes.push(movimentacao); },
    async atualizar(id, dados) {
      const idx = movimentacoes.findIndex(m => m.id === id);
      if (idx === -1) return false;
      movimentacoes[idx] = { ...dados, id };
      return true;
    },
    async excluir(id) {
      const idx = movimentacoes.findIndex(m => m.id === id);
      if (idx === -1) return false;
      movimentacoes.splice(idx, 1);
      return true;
    },
    async filtrarPorPeriodo(dataInicial, dataFinal) {
      return movimentacoes.filter(m => {
        const atendeInicial = !dataInicial || m.data >= dataInicial;
        const atendeFinal = !dataFinal || m.data <= dataFinal;
        return atendeInicial && atendeFinal;
      });
    }
  };
}

// Dados válidos base para testes
function dadosValidos(sobrescritas = {}) {
  return {
    tipo: "entrada",
    valor: 100.50,
    descricao: "Corte de unha",
    categoria: "atendimento",
    data: "2026-01-15",
    observacao: "Cliente regular",
    ...sobrescritas
  };
}

describe("validarMovimentacao", () => {
  let ctx;

  beforeEach(() => {
    ctx = criarContextoApp();
  });

  it("rejeita null", () => {
    assert.equal(ctx.validarMovimentacao(null), false);
  });

  it("rejeita undefined", () => {
    assert.equal(ctx.validarMovimentacao(undefined), false);
  });

  it("rejeita array", () => {
    assert.equal(ctx.validarMovimentacao([]), false);
  });

  it("rejeita string", () => {
    assert.equal(ctx.validarMovimentacao("string"), false);
  });

  it("rejeita número", () => {
    assert.equal(ctx.validarMovimentacao(123), false);
  });

  it("rejeita objeto sem tipo", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), tipo: undefined });
    assert.equal(r, false);
  });

  it("rejeita tipo inválido", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), tipo: "invalido" });
    assert.equal(r, false);
  });

  it("aceita tipo 'entrada'", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), tipo: "entrada" });
    assert.equal(r, true);
  });

  it("aceita tipo 'saida'", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), tipo: "saida" });
    assert.equal(r, true);
  });

  it("rejeita valor não-numérico", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), valor: "100" });
    assert.equal(r, false);
  });

  it("rejeita valor NaN", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), valor: NaN });
    assert.equal(r, false);
  });

  it("rejeita valor Infinity", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), valor: Infinity });
    assert.equal(r, false);
  });

  it("rejeita valor zero", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), valor: 0 });
    assert.equal(r, false);
  });

  it("rejeita valor negativo", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), valor: -10 });
    assert.equal(r, false);
  });

  it("aceita valor positivo válido", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), valor: 0.01 });
    assert.equal(r, true);
  });

  it("rejeita descrição ausente", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), descricao: undefined });
    assert.equal(r, false);
  });

  it("rejeita descrição vazia", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), descricao: "" });
    assert.equal(r, false);
  });

  it("rejeita descrição apenas espaços", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), descricao: "   " });
    assert.equal(r, false);
  });

  it("rejeita descrição não-string", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), descricao: 123 });
    assert.equal(r, false);
  });

  it("aceita descrição válida", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), descricao: "  Atendimento  " });
    assert.equal(r, true);
  });

  it("rejeita categoria ausente", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), categoria: undefined });
    assert.equal(r, false);
  });

  it("rejeita categoria inválida", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), categoria: "invalida" });
    assert.equal(r, false);
  });

  it("aceita categoria 'atendimento'", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), categoria: "atendimento" });
    assert.equal(r, true);
  });

  it("aceita categoria 'material'", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), categoria: "material" });
    assert.equal(r, true);
  });

  it("aceita categoria 'outro'", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), categoria: "outro" });
    assert.equal(r, true);
  });

  it("rejeita data ausente", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), data: undefined });
    assert.equal(r, false);
  });

  it("rejeita data vazia", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), data: "" });
    assert.equal(r, false);
  });

  it("rejeita data apenas espaços", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), data: "   " });
    assert.equal(r, false);
  });

  it("rejeita data não-string", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), data: 123 });
    assert.equal(r, false);
  });

  it("aceita data válida no formato ISO", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), data: "2026-12-31" });
    assert.equal(r, true);
  });

  it("aceita observação ausente (opcional)", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), observacao: undefined });
    assert.equal(r, true);
  });

  it("aceita observação vazia", () => {
    const r = ctx.validarMovimentacao({ ...dadosValidos(), observacao: "" });
    assert.equal(r, true);
  });

  it("aceita observação longa (até 300 chars)", () => {
    const obs = "a".repeat(300);
    const r = ctx.validarMovimentacao({ ...dadosValidos(), observacao: obs });
    assert.equal(r, true);
  });
});

describe("calcularIndicadoresFinanceiros", () => {
  let ctx;

  beforeEach(() => {
    ctx = criarContextoApp();
  });

  it("retorna zeros para array vazio", () => {
    const r = ctx.calcularIndicadoresFinanceiros([]);
    assert.equal(r.totalEntradas, 0);
    assert.equal(r.totalSaidas, 0);
    assert.equal(r.saldo, 0);
    assert.equal(r.ticketMedio, 0);
  });

  it("retorna zeros para null", () => {
    const r = ctx.calcularIndicadoresFinanceiros(null);
    assert.equal(r.totalEntradas, 0);
    assert.equal(r.totalSaidas, 0);
    assert.equal(r.saldo, 0);
    assert.equal(r.ticketMedio, 0);
  });

  it("retorna zeros para undefined", () => {
    const r = ctx.calcularIndicadoresFinanceiros(undefined);
    assert.equal(r.totalEntradas, 0);
    assert.equal(r.totalSaidas, 0);
    assert.equal(r.saldo, 0);
    assert.equal(r.ticketMedio, 0);
  });

  it("retorna zeros para não-array", () => {
    const r = ctx.calcularIndicadoresFinanceiros("string");
    assert.equal(r.totalEntradas, 0);
    assert.equal(r.totalSaidas, 0);
    assert.equal(r.saldo, 0);
    assert.equal(r.ticketMedio, 0);
  });

  it("calcula apenas entradas", () => {
    const movs = [
      { ...dadosValidos(), id: "1", tipo: "entrada", valor: 100, categoria: "atendimento" },
      { ...dadosValidos(), id: "2", tipo: "entrada", valor: 50, categoria: "material" }
    ];
    const r = ctx.calcularIndicadoresFinanceiros(movs);
    assert.equal(r.totalEntradas, 150);
    assert.equal(r.totalSaidas, 0);
    assert.equal(r.saldo, 150);
    assert.equal(r.ticketMedio, 100); // apenas a de atendimento conta para ticket
  });

  it("calcula apenas saídas", () => {
    const movs = [
      { ...dadosValidos(), id: "1", tipo: "saida", valor: 30, categoria: "material" },
      { ...dadosValidos(), id: "2", tipo: "saida", valor: 20, categoria: "outro" }
    ];
    const r = ctx.calcularIndicadoresFinanceiros(movs);
    assert.equal(r.totalEntradas, 0);
    assert.equal(r.totalSaidas, 50);
    assert.equal(r.saldo, -50);
    assert.equal(r.ticketMedio, 0);
  });

  it("calcula misto entradas e saídas", () => {
    const movs = [
      { ...dadosValidos(), id: "1", tipo: "entrada", valor: 200, categoria: "atendimento" },
      { ...dadosValidos(), id: "2", tipo: "saida", valor: 80, categoria: "material" }
    ];
    const r = ctx.calcularIndicadoresFinanceiros(movs);
    assert.equal(r.totalEntradas, 200);
    assert.equal(r.totalSaidas, 80);
    assert.equal(r.saldo, 120);
    assert.equal(r.ticketMedio, 200);
  });

  it("calcula ticket médio apenas com categoria atendimento", () => {
    const movs = [
      { ...dadosValidos(), id: "1", tipo: "entrada", valor: 100, categoria: "atendimento" },
      { ...dadosValidos(), id: "2", tipo: "entrada", valor: 200, categoria: "atendimento" },
      { ...dadosValidos(), id: "3", tipo: "entrada", valor: 50, categoria: "material" }, // não conta
      { ...dadosValidos(), id: "4", tipo: "entrada", valor: 30, categoria: "outro" } // não conta
    ];
    const r = ctx.calcularIndicadoresFinanceiros(movs);
    assert.equal(r.totalEntradas, 380);
    assert.equal(r.ticketMedio, 150); // (100 + 200) / 2
  });

  it("ticket médio zero quando sem atendimentos", () => {
    const movs = [
      { ...dadosValidos(), id: "1", tipo: "entrada", valor: 100, categoria: "material" },
      { ...dadosValidos(), id: "2", tipo: "entrada", valor: 50, categoria: "outro" }
    ];
    const r = ctx.calcularIndicadoresFinanceiros(movs);
    assert.equal(r.ticketMedio, 0);
  });

  it("ignora saídas no cálculo do ticket médio", () => {
    const movs = [
      { ...dadosValidos(), id: "1", tipo: "entrada", valor: 100, categoria: "atendimento" },
      { ...dadosValidos(), id: "2", tipo: "saida", valor: 50, categoria: "atendimento" } // saída não conta
    ];
    const r = ctx.calcularIndicadoresFinanceiros(movs);
    assert.equal(r.totalEntradas, 100);
    assert.equal(r.totalSaidas, 50);
    assert.equal(r.ticketMedio, 100); // apenas a entrada de atendimento
  });

  it("mantém precisão decimal", () => {
    const movs = [
      { ...dadosValidos(), id: "1", tipo: "entrada", valor: 100.10, categoria: "atendimento" },
      { ...dadosValidos(), id: "2", tipo: "entrada", valor: 100.20, categoria: "atendimento" }
    ];
    const r = ctx.calcularIndicadoresFinanceiros(movs);
    assert.equal(r.totalEntradas, 200.30);
    assert.equal(r.ticketMedio, 100.15);
  });

  it("não muta array original", () => {
    const movs = [{ ...dadosValidos(), id: "1", tipo: "entrada", valor: 100, categoria: "atendimento" }];
    const originalLength = movs.length;
    ctx.calcularIndicadoresFinanceiros(movs);
    assert.equal(movs.length, originalLength);
  });
});

describe("filtrarMovimentacoesPorPeriodo", () => {
  let ctx;

  beforeEach(() => {
    ctx = criarContextoApp();
    // Popula via localStorage para definir estado interno
    const movsBase = [
      { ...dadosValidos(), id: "1", data: "2026-01-10", valor: 100 },
      { ...dadosValidos(), id: "2", data: "2026-01-20", valor: 200 },
      { ...dadosValidos(), id: "3", data: "2026-02-05", valor: 300 },
      { ...dadosValidos(), id: "4", data: "2026-02-15", valor: 400 }
    ];
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify(movsBase));
    ctx.carregarMovimentacoes();
  });

  it("retorna todas quando sem filtros", () => {
    const r = ctx.filtrarMovimentacoesPorPeriodo("", "");
    assert.equal(r.length, 4);
  });

  it("retorna todas quando dataInicial vazia", () => {
    const r = ctx.filtrarMovimentacoesPorPeriodo("", "2026-01-31");
    assert.equal(r.length, 2);
  });

  it("retorna todas quando dataFinal vazia", () => {
    const r = ctx.filtrarMovimentacoesPorPeriodo("2026-02-01", "");
    assert.equal(r.length, 2);
  });

  it("filtra por dataInicial inclusive", () => {
    const r = ctx.filtrarMovimentacoesPorPeriodo("2026-01-20", "");
    assert.equal(r.length, 3);
    assert.equal(r[0].id, "2");
  });

  it("filtra por dataFinal inclusive", () => {
    const r = ctx.filtrarMovimentacoesPorPeriodo("", "2026-01-20");
    assert.equal(r.length, 2);
    assert.equal(r[1].id, "2");
  });

  it("filtra por período exato", () => {
    const r = ctx.filtrarMovimentacoesPorPeriodo("2026-01-15", "2026-02-10");
    assert.equal(r.length, 2);
    assert.equal(r[0].id, "2");
    assert.equal(r[1].id, "3");
  });

  it("retorna vazio quando período não tem dados", () => {
    const r = ctx.filtrarMovimentacoesPorPeriodo("2026-03-01", "2026-03-31");
    assert.equal(r.length, 0);
  });

  it("retorna vazio quando dataInicial > dataFinal", () => {
    const r = ctx.filtrarMovimentacoesPorPeriodo("2026-02-01", "2026-01-01");
    assert.equal(r.length, 0);
  });

  it("não muta array original", () => {
    const originalLength = ctx.listarMovimentacoes().length;
    ctx.filtrarMovimentacoesPorPeriodo("2026-01-01", "2026-01-31");
    assert.equal(ctx.listarMovimentacoes().length, originalLength);
  });
});

describe("Repositório em memória - CRUD Movimentações", () => {
  let repo;

  beforeEach(() => {
    repo = criarRepositorioMemoria();
  });

  describe("adicionar / listar", () => {
    it("adiciona e lista movimentação", async () => {
      const mov = { ...dadosValidos(), id: "test-1" };
      await repo.adicionar(mov);
      const lista = await repo.listar();
      assert.equal(lista.length, 1);
      assert.equal(lista[0].id, "test-1");
      assert.equal(lista[0].descricao, "Corte de unha");
    });

    it("retorna cópia da lista (imutabilidade)", async () => {
      await repo.adicionar({ ...dadosValidos(), id: "1" });
      const lista1 = await repo.listar();
      lista1.push({ teste: "mutacao" });
      const lista2 = await repo.listar();
      assert.equal(lista2.length, 1);
    });

    it("lista vazia inicialmente", async () => {
      const lista = await repo.listar();
      assert.deepEqual(lista, []);
    });
  });

  describe("buscarPorId", () => {
    it("encontra movimentação existente", async () => {
      const mov = { ...dadosValidos(), id: "abc-123" };
      await repo.adicionar(mov);
      const r = await repo.buscarPorId("abc-123");
      assert.deepEqual(r, mov);
    });

    it("retorna null para ID inexistente", async () => {
      const r = await repo.buscarPorId("inexistente");
      assert.equal(r, null);
    });
  });

  describe("atualizar", () => {
    it("atualiza movimentação existente", async () => {
      await repo.adicionar({ ...dadosValidos(), id: "1", valor: 100 });
      const ok = await repo.atualizar("1", { ...dadosValidos(), id: "1", valor: 200, descricao: "Atualizado" });
      assert.equal(ok, true);
      const r = await repo.buscarPorId("1");
      assert.equal(r.valor, 200);
      assert.equal(r.descricao, "Atualizado");
    });

    it("mantém ID original na atualização", async () => {
      await repo.adicionar({ ...dadosValidos(), id: "manter-id" });
      await repo.atualizar("manter-id", { ...dadosValidos(), id: "novo-id", valor: 500 });
      const r = await repo.buscarPorId("manter-id");
      assert.equal(r.id, "manter-id");
      assert.equal(r.valor, 500);
    });

    it("retorna false para ID inexistente", async () => {
      const ok = await repo.atualizar("inexistente", { ...dadosValidos(), valor: 100 });
      assert.equal(ok, false);
    });
  });

  describe("excluir", () => {
    it("exclui movimentação existente", async () => {
      await repo.adicionar({ ...dadosValidos(), id: "del-1" });
      const ok = await repo.excluir("del-1");
      assert.equal(ok, true);
      const r = await repo.buscarPorId("del-1");
      assert.equal(r, null);
    });

    it("retorna false para ID inexistente", async () => {
      const ok = await repo.excluir("inexistente");
      assert.equal(ok, false);
    });

    it("não afeta outras movimentações", async () => {
      await repo.adicionar({ ...dadosValidos(), id: "1" });
      await repo.adicionar({ ...dadosValidos(), id: "2" });
      await repo.excluir("1");
      const lista = await repo.listar();
      assert.equal(lista.length, 1);
      assert.equal(lista[0].id, "2");
    });
  });

  describe("filtrarPorPeriodo", () => {
    beforeEach(async () => {
      await repo.adicionar({ ...dadosValidos(), id: "1", data: "2026-01-10" });
      await repo.adicionar({ ...dadosValidos(), id: "2", data: "2026-01-20" });
      await repo.adicionar({ ...dadosValidos(), id: "3", data: "2026-02-05" });
    });

    it("filtra corretamente por período", async () => {
      const r = await repo.filtrarPorPeriodo("2026-01-01", "2026-01-31");
      assert.equal(r.length, 2);
      assert.equal(r[0].id, "1");
      assert.equal(r[1].id, "2");
    });

    it("retorna vazio para período sem dados", async () => {
      const r = await repo.filtrarPorPeriodo("2026-03-01", "2026-03-31");
      assert.equal(r.length, 0);
    });
  });
});

describe("Integração: Módulo app.js com localStorage mockado", () => {
  let ctx;
  let eventosRecebidos;

  beforeEach(() => {
    ctx = criarContextoApp();
    eventosRecebidos = [];

    // Captura eventos disparados
    ctx.document.addEventListener("movimentacoes:atualizadas", (e) => {
      eventosRecebidos.push(e.detail);
    });
  });

  it("adicionarMovimentacao persiste no localStorage e dispara evento", () => {
    const mov = { ...dadosValidos(), id: "evt-1" };
    const ok = ctx.adicionarMovimentacao(mov);
    assert.equal(ok, true);
    assert.equal(eventosRecebidos.length, 1);
    assert.equal(eventosRecebidos[0].length, 1);
    assert.equal(eventosRecebidos[0][0].id, "evt-1");

    // Verifica se persistiu no localStorage
    const salvo = JSON.parse(ctx.localStorage.getItem("nailflow_movimentacoes"));
    assert.equal(salvo.length, 1);
    assert.equal(salvo[0].id, "evt-1");
  });

  it("adicionarMovimentacao rejeita inválida e não dispara evento", () => {
    const ok = ctx.adicionarMovimentacao({ ...dadosValidos(), valor: -10 });
    assert.equal(ok, false);
    assert.equal(eventosRecebidos.length, 0);
  });

  it("atualizarMovimentacao persiste no localStorage e dispara evento", () => {
    // Prepara estado inicial via localStorage
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "upd-1", valor: 100 }]));
    ctx.carregarMovimentacoes();

    const ok = ctx.atualizarMovimentacao("upd-1", { ...dadosValidos(), valor: 200 });
    assert.equal(ok, true);
    assert.equal(eventosRecebidos.length, 1);
    assert.equal(eventosRecebidos[0][0].valor, 200);

    // Verifica se persistiu
    const salvo = JSON.parse(ctx.localStorage.getItem("nailflow_movimentacoes"));
    assert.equal(salvo[0].valor, 200);
  });

  it("atualizarMovimentacao retorna false para ID inexistente", () => {
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([]));
    ctx.carregarMovimentacoes();

    const ok = ctx.atualizarMovimentacao("inexistente", { ...dadosValidos(), valor: 100 });
    assert.equal(ok, false);
    assert.equal(eventosRecebidos.length, 0);
  });

  it("ExcluirMovimentacao persiste no localStorage e dispara evento", () => {
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "del-1" }]));
    ctx.carregarMovimentacoes();

    const ok = ctx.ExcluirMovimentacao("del-1");
    assert.equal(ok, true);
    assert.equal(eventosRecebidos.length, 1);
    assert.equal(eventosRecebidos[0].length, 0);

    // Verifica se persistiu
    const salvo = JSON.parse(ctx.localStorage.getItem("nailflow_movimentacoes"));
    assert.equal(salvo.length, 0);
  });

  it("ExcluirMovimentacao retorna false para ID inexistente", () => {
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([]));
    ctx.carregarMovimentacoes();

    const ok = ctx.ExcluirMovimentacao("inexistente");
    assert.equal(ok, false);
    assert.equal(eventosRecebidos.length, 0);
  });

  it("listarMovimentacoes retorna cópia", () => {
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "1" }]));
    ctx.carregarMovimentacoes();

    const lista = ctx.listarMovimentacoes();
    lista.push({ teste: "mutacao" });
    const lista2 = ctx.listarMovimentacoes();
    assert.equal(lista2.length, 1);
  });

  it("buscarMovimentacaoPorId encontra existente", () => {
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "find-1" }]));
    ctx.carregarMovimentacoes();

    const r = ctx.buscarMovimentacaoPorId("find-1");
    assert.equal(r.id, "find-1");
    assert.equal(r.tipo, "entrada");
    assert.equal(r.valor, 100.5);
    assert.equal(r.descricao, "Corte de unha");
    assert.equal(r.categoria, "atendimento");
    assert.equal(r.data, "2026-01-15");
    assert.equal(r.observacao, "Cliente regular");
  });

  it("buscarMovimentacaoPorId retorna undefined para inexistente", () => {
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([]));
    ctx.carregarMovimentacoes();

    const r = ctx.buscarMovimentacaoPorId("inexistente");
    assert.equal(r, undefined);
  });

  it("carregarMovimentacoes lê do localStorage", () => {
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "load-1" }]));
    ctx.carregarMovimentacoes();
    assert.equal(ctx.listarMovimentacoes().length, 1);
    assert.equal(ctx.listarMovimentacoes()[0].id, "load-1");
  });

  it("salvarMovimentacoes escreve no localStorage", () => {
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([]));
    ctx.carregarMovimentacoes();

    ctx.adicionarMovimentacao({ ...dadosValidos(), id: "save-1" });
    const salvo = JSON.parse(ctx.localStorage.getItem("nailflow_movimentacoes"));
    assert.equal(salvo.length, 1);
    assert.equal(salvo[0].id, "save-1");
  });
});

describe("Incompatibilidades para integração assíncrona Supabase", () => {
  it("API atual é síncrona - adicionarMovimentacao retorna boolean, não Promise", () => {
    const ctx = criarContextoApp();
    const resultado = ctx.adicionarMovimentacao(dadosValidos());
    assert.equal(typeof resultado, "boolean");
    assert.equal(resultado, true);
  });

  it("API atual é síncrona - atualizarMovimentacao retorna boolean, não Promise", () => {
    const ctx = criarContextoApp();
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "1" }]));
    ctx.carregarMovimentacoes();
    const resultado = ctx.atualizarMovimentacao("1", { ...dadosValidos(), valor: 200 });
    assert.equal(typeof resultado, "boolean");
  });

  it("API atual é síncrona - ExcluirMovimentacao retorna boolean, não Promise", () => {
    const ctx = criarContextoApp();
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "1" }]));
    ctx.carregarMovimentacoes();
    const resultado = ctx.ExcluirMovimentacao("1");
    assert.equal(typeof resultado, "boolean");
  });

  it("listarMovimentacoes retorna array direto, não Promise", () => {
    const ctx = criarContextoApp();
    const resultado = ctx.listarMovimentacoes();
    assert.ok(Array.isArray(resultado));
  });

  it("buscarMovimentacaoPorId retorna objeto direto, não Promise", () => {
    const ctx = criarContextoApp();
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "1" }]));
    ctx.carregarMovimentacoes();
    const resultado = ctx.buscarMovimentacaoPorId("1");
    assert.equal(typeof resultado, "object");
  });

  it("salvarMovimentacoes/carregarMovimentacoes são síncronas e usam localStorage diretamente", () => {
    const ctx = criarContextoApp();
    // Estas funções não retornam Promise e acessam localStorage diretamente
    assert.equal(typeof ctx.salvarMovimentacoes, "function");
    assert.equal(typeof ctx.carregarMovimentacoes, "function");
  });

  it("Estado global mutável (movimentacoes) impede isolamento de testes", () => {
    const ctx1 = criarContextoApp();
    const ctx2 = criarContextoApp();
    ctx1.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "1" }]));
    ctx1.carregarMovimentacoes();
    // ctx2 não vê a movimentação do ctx1 - isolamento funciona por contexto vm
    // Mas dentro do mesmo contexto, estado global é compartilhado
    assert.equal(ctx1.listarMovimentacoes().length, 1);
    assert.equal(ctx2.listarMovimentacoes().length, 0);
  });

  it("Evento movimentacoes:atualizadas é síncrono e dispara após cada operação", () => {
    const ctx = criarContextoApp();
    let count = 0;
    ctx.document.addEventListener("movimentacoes:atualizadas", () => count++);

    ctx.adicionarMovimentacao(dadosValidos());
    ctx.adicionarMovimentacao(dadosValidos());
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([{ ...dadosValidos(), id: "1" }]));
    ctx.carregarMovimentacoes();
    ctx.atualizarMovimentacao("1", { ...dadosValidos(), valor: 200 });
    ctx.ExcluirMovimentacao("1");

    assert.equal(count, 4); // 2 adds + 1 update + 1 delete
  });

  it("configurarFormularioMovimentacao acopla DOM e localStorage - difícil testar isolado", () => {
    const ctx = criarContextoApp();
    // Esta função usa document.querySelector e FormData - requer DOM real
    assert.equal(typeof ctx.configurarFormularioMovimentacao, "function");
  });

  it("iniciarAplicacao carrega do localStorage na inicialização - efeito colateral", () => {
    const ctx = criarContextoApp();
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([dadosValidos()]));
    ctx.iniciarAplicacao();
    assert.equal(ctx.listarMovimentacoes().length, 1);
  });
});