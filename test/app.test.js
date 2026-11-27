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
    // localStorage NÃO é mais usado automaticamente - mantido apenas para compatibilidade
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
        if (selector === "#financeiro-erro") {
          return { hidden: true, textContent: "" };
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

// Factory de repositório em memória para testes (compatível com a nova API)
function criarRepositorioMemoriaParaTeste() {
  const movimentacoes = [];
  return {
    tipo: 'memory',
    salvar(todas) { movimentacoes.length = 0; movimentacoes.push(...todas); },
    listar() { return [...movimentacoes]; },
    buscarPorId(id) { return movimentacoes.find(m => m.id === id) ?? null; },
    adicionar(movimentacao) { movimentacoes.push(movimentacao); return movimentacao; },
    atualizar(id, dadosAtualizados) {
      const idx = movimentacoes.findIndex(m => m.id === id);
      if (idx === -1) return false;
      movimentacoes[idx] = { ...dadosAtualizados, id };
      return true;
    },
    excluir(id) {
      const idx = movimentacoes.findIndex(m => m.id === id);
      if (idx === -1) return false;
      movimentacoes.splice(idx, 1);
      return true;
    },
    filtrarPorPeriodo(dataInicial, dataFinal) {
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

function configurarContextoComRepoMemoria(ctx) {
  // Injeta repositório em memória para testes
  const repo = criarRepositorioMemoriaParaTeste();
  ctx._setRepositorioParaTeste(repo);
  return repo;
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

describe("filtrarMovimentacoesPorPeriodo (API síncrona - testes com repo memória)", () => {
  let ctx;
  let repo;

  beforeEach(() => {
    ctx = criarContextoApp();
    repo = configurarContextoComRepoMemoria(ctx);

    // Popula via repositório em memória
    const movsBase = [
      { ...dadosValidos(), id: "1", data: "2026-01-10", valor: 100 },
      { ...dadosValidos(), id: "2", data: "2026-01-20", valor: 200 },
      { ...dadosValidos(), id: "3", data: "2026-02-05", valor: 300 },
      { ...dadosValidos(), id: "4", data: "2026-02-15", valor: 400 }
    ];
    movsBase.forEach(m => repo.adicionar(m));
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

describe("API Síncrona com Repositório em Memória - CRUD Movimentações", () => {
  let ctx;
  let repo;
  let eventosRecebidos;

  beforeEach(() => {
    ctx = criarContextoApp();
    repo = configurarContextoComRepoMemoria(ctx);
    eventosRecebidos = [];

    ctx.document.addEventListener("movimentacoes:atualizadas", (e) => {
      eventosRecebidos.push(e.detail);
    });
  });

  describe("adicionarMovimentacao", () => {
    it("adiciona movimentação válida e dispara evento", () => {
      const mov = { ...dadosValidos(), id: "evt-1" };
      const ok = ctx.adicionarMovimentacao(mov);
      assert.equal(ok, true);
      assert.equal(eventosRecebidos.length, 1);
      assert.equal(eventosRecebidos[0].length, 1);
      assert.equal(eventosRecebidos[0][0].id, "evt-1");
    });

    it("rejeita movimentação inválida e não dispara evento", () => {
      const ok = ctx.adicionarMovimentacao({ ...dadosValidos(), valor: -10 });
      assert.equal(ok, false);
      assert.equal(eventosRecebidos.length, 0);
    });

    it("adiciona múltiplas movimentações", () => {
      ctx.adicionarMovimentacao({ ...dadosValidos(), id: "1" });
      ctx.adicionarMovimentacao({ ...dadosValidos(), id: "2" });
      assert.equal(ctx.listarMovimentacoes().length, 2);
    });
  });

  describe("listarMovimentacoes", () => {
    it("retorna lista vazia inicialmente", () => {
      const lista = ctx.listarMovimentacoes();
      assert.deepEqual(lista, []);
    });

    it("retorna cópia da lista (imutabilidade)", () => {
      ctx.adicionarMovimentacao({ ...dadosValidos(), id: "1" });
      const lista1 = ctx.listarMovimentacoes();
      lista1.push({ teste: "mutacao" });
      const lista2 = ctx.listarMovimentacoes();
      assert.equal(lista2.length, 1);
    });
  });

  describe("buscarMovimentacaoPorId", () => {
    it("encontra movimentação existente", () => {
      ctx.adicionarMovimentacao({ ...dadosValidos(), id: "abc-123" });
      const r = ctx.buscarMovimentacaoPorId("abc-123");
      assert.deepEqual(r, { ...dadosValidos(), id: "abc-123" });
    });

    it("retorna null para ID inexistente", () => {
      const r = ctx.buscarMovimentacaoPorId("inexistente");
      assert.equal(r, null);
    });
  });

  describe("atualizarMovimentacao", () => {
    it("atualiza movimentação existente e dispara evento", () => {
      ctx.adicionarMovimentacao({ ...dadosValidos(), id: "upd-1", valor: 100 });
      eventosRecebidos.length = 0;

      const ok = ctx.atualizarMovimentacao("upd-1", { ...dadosValidos(), valor: 200 });
      assert.equal(ok, true);
      assert.equal(eventosRecebidos.length, 1);
      assert.equal(eventosRecebidos[0][0].valor, 200);
    });

    it("mantém ID original na atualização", () => {
      ctx.adicionarMovimentacao({ ...dadosValidos(), id: "manter-id" });
      ctx.atualizarMovimentacao("manter-id", { ...dadosValidos(), id: "novo-id", valor: 500 });
      const r = ctx.buscarMovimentacaoPorId("manter-id");
      assert.equal(r.id, "manter-id");
      assert.equal(r.valor, 500);
    });

    it("retorna false para ID inexistente", () => {
      const ok = ctx.atualizarMovimentacao("inexistente", { ...dadosValidos(), valor: 100 });
      assert.equal(ok, false);
      assert.equal(eventosRecebidos.length, 0);
    });
  });

  describe("excluirMovimentacao", () => {
    it("exclui movimentação existente e dispara evento", () => {
      ctx.adicionarMovimentacao({ ...dadosValidos(), id: "del-1" });
      eventosRecebidos.length = 0;

      const ok = ctx.excluirMovimentacao("del-1");
      assert.equal(ok, true);
      assert.equal(eventosRecebidos.length, 1);
      assert.equal(eventosRecebidos[0].length, 0);
    });

    it("retorna false para ID inexistente", () => {
      const ok = ctx.excluirMovimentacao("inexistente");
      assert.equal(ok, false);
      assert.equal(eventosRecebidos.length, 0);
    });

    it("não afeta outras movimentações", () => {
      ctx.adicionarMovimentacao({ ...dadosValidos(), id: "1" });
      ctx.adicionarMovimentacao({ ...dadosValidos(), id: "2" });
      ctx.excluirMovimentacao("1");
      const lista = ctx.listarMovimentacoes();
      assert.equal(lista.length, 1);
      assert.equal(lista[0].id, "2");
    });
  });
});

describe("API Assíncrona (Produção) - Interface", () => {
  let ctx;

  beforeEach(() => {
    ctx = criarContextoApp();
    // Injeta repositório de memória para testar a interface assíncrona
    const repo = criarRepositorioMemoriaParaTeste();
    ctx._setRepositorioParaTeste(repo);
  });

  function isPromise(obj) {
    return obj && typeof obj.then === 'function';
  }

  it("adicionarMovimentacaoAsync é função assíncrona", () => {
    assert.equal(typeof ctx.adicionarMovimentacaoAsync, "function");
    const resultado = ctx.adicionarMovimentacaoAsync(dadosValidos());
    assert.ok(isPromise(resultado));
  });

  it("listarMovimentacoesAsync é função assíncrona", () => {
    assert.equal(typeof ctx.listarMovimentacoesAsync, "function");
    const resultado = ctx.listarMovimentacoesAsync();
    assert.ok(isPromise(resultado));
  });

  it("buscarMovimentacaoPorIdAsync é função assíncrona", () => {
    assert.equal(typeof ctx.buscarMovimentacaoPorIdAsync, "function");
    const resultado = ctx.buscarMovimentacaoPorIdAsync("1");
    assert.ok(isPromise(resultado));
  });

  it("atualizarMovimentacaoAsync é função assíncrona", () => {
    assert.equal(typeof ctx.atualizarMovimentacaoAsync, "function");
    const resultado = ctx.atualizarMovimentacaoAsync("1", dadosValidos());
    assert.ok(isPromise(resultado));
  });

  it("excluirMovimentacaoAsync é função assíncrona", () => {
    assert.equal(typeof ctx.excluirMovimentacaoAsync, "function");
    const resultado = ctx.excluirMovimentacaoAsync("1");
    assert.ok(isPromise(resultado));
  });

  it("filtrarMovimentacoesPorPeriodoAsync é função assíncrona", () => {
    assert.equal(typeof ctx.filtrarMovimentacoesPorPeriodoAsync, "function");
    const resultado = ctx.filtrarMovimentacoesPorPeriodoAsync("", "");
    assert.ok(isPromise(resultado));
  });
});

describe("Inicialização e Reinicialização", () => {
  let ctx;

  beforeEach(() => {
    ctx = criarContextoApp();
    // Injeta repositório de memória para testar a interface assíncrona
    const repo = criarRepositorioMemoriaParaTeste();
    ctx._setRepositorioParaTeste(repo);
  });

  function isPromise(obj) {
    return obj && typeof obj.then === 'function';
  }

  it("reinicializarRepositorio é função assíncrona", () => {
    assert.equal(typeof ctx.reinicializarRepositorio, "function");
    const resultado = ctx.reinicializarRepositorio();
    assert.ok(isPromise(resultado));
  });

  it("_setRepositorioParaTeste permite injetar repo de memória", () => {
    const repo = criarRepositorioMemoriaParaTeste();
    repo.adicionar({ ...dadosValidos(), id: "test-1" });

    ctx._setRepositorioParaTeste(repo);
    assert.equal(ctx.listarMovimentacoes().length, 1);
    assert.equal(ctx.listarMovimentacoes()[0].id, "test-1");
  });

  it("_getRepositorioAtivo retorna tipo do repositório", () => {
    // Antes de injetar, deve ser 'supabase' (tentativa de inicialização)
    // Após injetar, deve ser 'memory'
    const repo = criarRepositorioMemoriaParaTeste();
    ctx._setRepositorioParaTeste(repo);
    assert.equal(ctx.NailFlow.financeiro._getRepositorioAtivo(), 'memory');
  });
});

describe("Sem Fallback Silencioso para localStorage em Produção", () => {
  let ctx;

  beforeEach(() => {
    ctx = criarContextoApp();
  });

  it("API síncrona NÃO funciona sem repo de memória injetado (produção)", () => {
    // Sem injetar repo de memória, as funções síncronas devem falhar/avisar
    const ok = ctx.adicionarMovimentacao(dadosValidos());
    assert.equal(ok, false); // Falha porque não há repo de memória
  });

  it("listarMovimentacoes retorna vazio sem repo de memória", () => {
    const lista = ctx.listarMovimentacoes();
    assert.equal(lista.length, 0);
  });

  it("buscarMovimentacaoPorId retorna undefined sem repo de memória", () => {
    const r = ctx.buscarMovimentacaoPorId("1");
    assert.equal(r, undefined);
  });

  it("atualizarMovimentacao retorna false sem repo de memória", () => {
    const ok = ctx.atualizarMovimentacao("1", dadosValidos());
    assert.equal(ok, false);
  });

  it("excluirMovimentacao retorna false sem repo de memória", () => {
    const ok = ctx.excluirMovimentacao("1");
    assert.equal(ok, false);
  });

  it("filtrarMovimentacoesPorPeriodo retorna vazio sem repo de memória", () => {
    const r = ctx.filtrarMovimentacoesPorPeriodo("", "");
    assert.equal(r.length, 0);
  });

  it("iniciarAplicacao NÃO carrega do localStorage automaticamente", () => {
    // Preenche localStorage
    ctx.localStorage.setItem("nailflow_movimentacoes", JSON.stringify([dadosValidos()]));
    ctx.iniciarAplicacao();

    // NÃO deve ter carregado do localStorage (repo ativo é 'supabase' em produção)
    // A lista deve estar vazia até que Supabase carregue
    assert.equal(ctx.listarMovimentacoes().length, 0);
  });
});

describe("Isolamento de Testes (sem estado global compartilhado)", () => {
  it("Contextos vm separados têm estado isolado", () => {
    const ctx1 = criarContextoApp();
    const ctx2 = criarContextoApp();

    const repo1 = configurarContextoComRepoMemoria(ctx1);
    repo1.adicionar({ ...dadosValidos(), id: "1" });

    const repo2 = configurarContextoComRepoMemoria(ctx2);
    // ctx2 não vê a movimentação do ctx1
    assert.equal(ctx1.listarMovimentacoes().length, 1);
    assert.equal(ctx2.listarMovimentacoes().length, 0);
  });
});

describe("Auth - loginComEmail", () => {
  let ctx;
  let eventosAuth;

  beforeEach(() => {
    // Cria contexto com supabase mockado
    const mockDocument = {
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
      querySelector() { return null; }
    };

    const mockWindow = {
      NailFlow: {},
      dispatchEvent: mockDocument.dispatchEvent.bind(mockDocument),
      addEventListener: mockDocument.addEventListener.bind(mockDocument),
      removeEventListener: mockDocument.removeEventListener.bind(mockDocument),
      localStorage: {
        _store: {},
        getItem(chave) { return this._store[chave] ?? null; },
        setItem(chave, valor) { this._store[chave] = valor; },
        removeItem(chave) { delete this._store[chave]; },
        clear() { this._store = {}; }
      }
    };

    const contexto = vm.createContext({
      crypto: webcrypto,
      window: mockWindow,
      document: mockDocument,
      CustomEvent: function(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      },
      console,
      setTimeout,
      clearTimeout,
      // Mock do supabase
      supabase: {
        auth: {
          onAuthStateChange: (callback) => {
            // Mock que não faz nada - apenas para evitar erro na inicialização
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signInWithPassword: async ({ email, password }) => {
            // Simula erro de credenciais inválidas
            return {
              data: { user: null, session: null },
              error: new Error('Invalid login credentials')
            };
          },
          getSession: async () => ({ data: { session: null } }),
          signOut: async () => ({ error: null })
        }
      }
    });

    // Carrega o código do auth.js no contexto (substituindo o import e removendo exports)
    const codigoAuth = fs.readFileSync("js/auth.js", "utf8")
      .replace("import { supabase } from './supabase-client.js';", "// supabase mockado no contexto")
      .replace(/export\s+/g, ""); // Remove 'export ' para funcionar no vm context

    vm.runInContext(codigoAuth, contexto);

    ctx = contexto;
    eventosAuth = [];

    // Captura eventos de auth
    const tiposEventos = ['auth:login', 'auth:authenticated', 'auth:unauthorized', 'auth:logout', 'auth:erro', 'auth:pronto', 'auth:token-refresh'];
    tiposEventos.forEach(tipo => {
      contexto.document.addEventListener(tipo, (e) => {
        eventosAuth.push({ tipo, detail: e.detail });
      });
    });
  });

  function isPromise(obj) {
    return obj && typeof obj.then === 'function';
  }

  it("loginComEmail é função assíncrona", async () => {
    assert.equal(typeof ctx.loginComEmail, "function");
    const resultado = ctx.loginComEmail("test@test.com", "senha123");
    assert.ok(isPromise(resultado));
    // A promise rejeita porque o mock sempre retorna erro - capturamos para evitar unhandled rejection
    await resultado.catch(() => {});
  });

  it("rejeita credenciais inválidas e dispara auth:erro", async () => {
    const promise = ctx.loginComEmail("usuario@invalido.com", "senhaerrada");
    assert.ok(isPromise(promise));

    await promise.catch(() => {}); // Espera a promise rejeitar

    // Verifica que auth:erro foi disparado
    const eventosErro = eventosAuth.filter(e => e.tipo === 'auth:erro');
    assert.ok(eventosErro.length > 0, "Deveria disparar auth:erro");

    const erroDetail = eventosErro[0].detail;
    // Verifica se a mensagem contém indicativo de erro de credencial
    const msg = erroDetail.mensagem.toLowerCase();
    assert.ok(
      msg.includes("incorretos") ||
      msg.includes("credencial") ||
      msg.includes("tente novamente"),
      `Mensagem de erro inesperada: ${erroDetail.mensagem}`
    );
    assert.ok(erroDetail.erro instanceof Error);
  });

  it("não dispara auth:login nem auth:authenticated em caso de erro", async () => {
    await ctx.loginComEmail("usuario@invalido.com", "senhaerrada").catch(() => {});

    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    const eventosAuthenticated = eventosAuth.filter(e => e.tipo === 'auth:authenticated');

    assert.equal(eventosLogin.length, 0, "Não deve disparar auth:login com credenciais inválidas");
    assert.equal(eventosAuthenticated.length, 0, "Não deve disparar auth:authenticated com credenciais inválidas");
  });

  it("não dispara auth:unauthorized em caso de erro de credenciais", async () => {
    await ctx.loginComEmail("usuario@invalido.com", "senhaerrada").catch(() => {});

    const eventosUnauthorized = eventosAuth.filter(e => e.tipo === 'auth:unauthorized');
    assert.equal(eventosUnauthorized.length, 0, "Não deve disparar auth:unauthorized com credenciais inválidas (erro é de AuthN, não AuthZ)");
  });
});

describe("Auth - Fluxo Especial (convite/recuperação de senha)", () => {
  let eventosAuth;
  let mockDocument;
  let mockWindow;
  let mockLocation;
  let sharedSessionStorage;
  let contexto;

  // sessionStorage compartilhado para testar persistência pós-F5
  sharedSessionStorage = {
    _store: {},
    getItem(chave) { return this._store[chave] ?? null; },
    setItem(chave, valor) { this._store[chave] = valor; },
    removeItem(chave) { delete this._store[chave]; },
    clear() { this._store = {}; }
  };

  function criarContextoAuthComHash(hash = "") {
    // Cada target (window, document) tem seu próprio registro de eventos independente
    const mockDocumentEventos = {};
    const mockWindowEventos = {};

    mockDocument = {
      _eventos: mockDocumentEventos,
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
      querySelector() { return null; }
    };

    // Mock window.location com hash configurável
    mockLocation = {
      hash: hash,
      pathname: "/",
      origin: "http://localhost"
    };

    mockWindow = {
      NailFlow: {},
      _eventos: mockWindowEventos,
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
      location: mockLocation,
      history: {
        replaceState: () => {},
        pushState: () => {}
      },
      localStorage: {
        _store: {},
        getItem(chave) { return this._store[chave] ?? null; },
        setItem(chave, valor) { this._store[chave] = valor; },
        removeItem(chave) { delete this._store[chave]; },
        clear() { this._store = {}; }
      },
      sessionStorage: sharedSessionStorage
    };

    const ctx = vm.createContext({
      crypto: webcrypto,
      window: mockWindow,
      document: mockDocument,
      CustomEvent: function(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      },
      console,
      setTimeout,
      clearTimeout,
      URLSearchParams, // Necessário para isFluxoConviteOuRecovery()
      sessionStorage: sharedSessionStorage, // Global sessionStorage para auth.js
      // Mock do supabase
      supabase: {
        auth: {
          onAuthStateChange: (callback) => {
            // Armazena callback para poder disparar eventos manualmente nos testes
            ctx._authStateCallback = callback;
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signInWithPassword: async ({ email, password }) => {
            return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
          },
          signOut: async () => {
            // Dispara callback SIGNED_OUT para simular logout real
            if (ctx._authStateCallback) {
              ctx._authStateCallback('SIGNED_OUT', null);
            }
            return { error: null };
          },
          updateUser: async () => {
            ctx._updateUserCalled = true;
            return {
              error: null,
              data: {
                user: { id: "user-123", email: "test@test.com" }
              }
            };
          },
          getSession: async () => {
            // Antes do updateUser(), retorna null (simula token não processado)
            // Após updateUser(), retorna sessão válida
            if (ctx._updateUserCalled) {
              return { data: { session: { user: { id: "user-123", email: "test@test.com" }, access_token: "mock-access-token", refresh_token: "mock-refresh-token" } } };
            }
            return { data: { session: null } };
          },
        }
      }
    });

    // Inicializa flag para controlar comportamento do getSession
    ctx._updateUserCalled = false;

    // Carrega o código do auth.js no contexto
    const codigoAuth = fs.readFileSync("js/auth.js", "utf8")
      .replace("import { supabase } from './supabase-client.js';", "// supabase mockado no contexto")
      .replace(/export\s+/g, "");

    vm.runInContext(codigoAuth, ctx);

    eventosAuth = [];
    const tiposEventos = ['auth:login', 'auth:authenticated', 'auth:unauthorized', 'auth:logout', 'auth:erro', 'auth:pronto', 'auth:token-refresh', 'auth:password-recovery', 'auth:password-updated', 'auth:special-flow-abandoned'];
    // auth.js usa dispararEvento() que dispara em window — listeners devem ser em window
    tiposEventos.forEach(tipo => {
      ctx.window.addEventListener(tipo, (e) => {
        eventosAuth.push({ tipo, detail: e.detail });
      });
    });

    // Aguarda inicialização (inicializarAuth é auto-invocado)
    return new Promise(r => setTimeout(() => r(ctx), 50));
  }

  beforeEach(async () => {
    // Limpa sessionStorage compartilhado antes de cada teste
    sharedSessionStorage.clear();
    contexto = await criarContextoAuthComHash("#dashboard"); // hash padrão limpo
  });

  it("detecta fluxo de convite (type=invite) no hash e define emRedefinicaoSenha", async () => {
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");

    // Verifica via window.NailFlow.auth (estado exposto publicamente)
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true, "window.NailFlow.auth.emRedefinicaoSenha deve ser true para invite");

    // Verifica que auth:pronto foi disparado com autenticado=true, autorizado=false
    // Nota: no teste o mock retorna session=null, mas fluxo especial preserva emRedefinicaoSenha=true
    // auth:pronto será disparado com autenticado=false (sem sessão ainda)
    const eventosPronto = eventosAuth.filter(e => e.tipo === 'auth:pronto');
    assert.ok(eventosPronto.length > 0, "Deve disparar auth:pronto");
    const ultimoPronto = eventosPronto[eventosPronto.length - 1];
    // Com fluxo especial ativo mas sem sessão, autenticado=false, autorizado=false
    assert.equal(ultimoPronto.detail.autenticado, false);
    assert.equal(ultimoPronto.detail.autorizado, false);
  });

  it("detecta fluxo de recuperação (type=recovery) no hash e define emRedefinicaoSenha", async () => {
    contexto = await criarContextoAuthComHash("#type=recovery&access_token=def456");

    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true, "window.NailFlow.auth.emRedefinicaoSenha deve ser true para recovery");
  });

  it("NÃO define estado especial quando hash não tem type=invite nem type=recovery", async () => {
    contexto = await criarContextoAuthComHash("#dashboard");

    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "emRedefinicaoSenha deve ser false para hash normal");
  });

  it("guards funcionam mesmo APÓS hash ser limpo (simula navegacao.js limpando hash)", async () => {
    // Inicia COM hash de convite
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");

    // Verifica estado inicial via window.NailFlow.auth
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);

    // Simula navegacao.js limpando o hash (como faz em auth:password-recovery listener)
    mockLocation.hash = "#redefinir-senha";

    // Simula processarLoginAsync sendo chamado DEPOIS da limpeza do hash
    // (ex: INITIAL_SESSION disparando após hash limpo)
    const sessaoMock = { user: { id: "user-123", email: "test@test.com" } };
    await contexto.processarLoginAsync(sessaoMock, sessaoMock.user);

    // O guard deve ter impedido o processamento (não deve ter disparado auth:login)
    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    assert.equal(eventosLogin.length, 0, "processarLoginAsync não deve processar login quando fluxo especial está ativo, mesmo após hash limpo");
  });

  it("sessionStorage persiste intenção de navegação para sobreviver a F5 (novo contexto lê sessionStorage)", async () => {
    // Primeira inicialização COM hash de convite
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");

    // Verifica que sessionStorage foi definido
    const salvo = sharedSessionStorage.getItem('nailflow_fluxo_especial');
    assert.equal(salvo, 'true', "sessionStorage deve guardar intenção de navegação");

    // Simula F5: cria NOVO contexto com hash LIMPO (pós-limpeza pelo navegacao.js)
    // mas MESMO sessionStorage (compartilhado)
    const contexto2 = await criarContextoAuthComHash("#redefinir-senha");

    // O novo contexto deve ler do sessionStorage e restaurar estado de navegação
    assert.equal(contexto2.window.NailFlow.auth.emRedefinicaoSenha, true, "Após F5, emRedefinicaoSenha deve ser restaurado do sessionStorage (intenção de navegação)");
  });

  it("atualizarSenha limpa estado interno e sessionStorage", async () => {
    // NOTA: Este teste usa mock de supabase.auth.updateUser que SEMPRE retorna sucesso.
    // Em produção, atualizarSenha() REQUER uma sessão válida do Supabase (token de recuperação ativo).
    // O sessionStorage NÃO substitui a validação do Supabase.
    // Se não houver sessão válida, o Supabase retornará erro.
    contexto = await criarContextoAuthComHash("#type=recovery&access_token=def456");

    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), 'true');

    // Chama atualizarSenha (exportada) que internamente chama limparFluxoEspecial
    await contexto.atualizarSenha("novaSenha123");

    // Verifica limpeza via window.NailFlow.auth
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "emRedefinicaoSenha deve ser false após atualizarSenha");

    // Verifica sessionStorage limpo
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), null, "sessionStorage deve ser limpo após atualizarSenha");

    // Verifica evento auth:password-updated disparado
    const eventosUpdated = eventosAuth.filter(e => e.tipo === 'auth:password-updated');
    assert.ok(eventosUpdated.length > 0, "Deve disparar auth:password-updated");
    assert.equal(eventosUpdated[0].detail.sucesso, true);
  });

  // =============================================================================
  // NOVOS TESTES: atualizarSenha() implementação real (com/sem vínculo de estúdio)
  // =============================================================================

  it("atualizarSenha com estúdio vinculado (autorizado) dispara auth:password-updated com autorizado=true e estudioId", async () => {
    // Mock buscarEstudioIdDoUsuario para retornar estudioId
    contexto = await criarContextoAuthComHash("#type=recovery&access_token=def456");

    // Sobrescrever buscarEstudioIdDoUsuario no contexto para retornar um estudioId
    vm.runInContext("buscarEstudioIdDoUsuario = async () => 'studio-123';", contexto);

    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);

    await contexto.atualizarSenha("novaSenha123");

    // Verifica estado final: autenticado E autorizado
    assert.equal(contexto.window.NailFlow.auth.autenticado, true, "Usuário deve estar autenticado após atualizar senha com sucesso");
    assert.equal(contexto.window.NailFlow.auth.autorizado, true, "Usuário deve estar autorizado (tem estúdio vinculado)");
    assert.equal(contexto.window.NailFlow.auth.estudioId, "studio-123", "estudioId deve ser definido");

    // Verifica evento auth:password-updated com dados corretos
    const eventosUpdated = eventosAuth.filter(e => e.tipo === 'auth:password-updated');
    assert.ok(eventosUpdated.length > 0, "Deve disparar auth:password-updated");
    const detail = eventosUpdated[0].detail;
    assert.equal(detail.sucesso, true);
    assert.equal(detail.autenticado, true);
    assert.equal(detail.autorizado, true);
    assert.equal(detail.estudioId, "studio-123");
    assert.ok(detail.usuario, "usuario deve estar presente");
    assert.equal(detail.usuario.id, "user-123"); // ID do usuário da sessão mockada
    // SEGURANÇA: NÃO deve expor sessão/tokens no evento
    assert.ok(!detail.sessao, "Evento NÃO deve conter sessão (access_token/refresh_token)");

    // Verifica que também disparou auth:login (AuthN + AuthZ OK)
    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    assert.ok(eventosLogin.length > 0, "Deve disparar auth:login quando autorizado");
    assert.equal(eventosLogin[0].detail.estudioId, "studio-123");

    // Verifica que NÃO disparou auth:unauthorized
    const eventosUnauthorized = eventosAuth.filter(e => e.tipo === 'auth:unauthorized');
    assert.equal(eventosUnauthorized.length, 0, "NÃO deve disparar auth:unauthorized quando tem estúdio vinculado");
  });

  it("atualizarSenha sem estúdio vinculado (não autorizado) dispara auth:password-updated com autorizado=false e auth:unauthorized", async () => {
    contexto = await criarContextoAuthComHash("#type=recovery&access_token=def456");

    // buscarEstudioIdDoUsuario retorna null por padrão (mock padrão)
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);

    await contexto.atualizarSenha("novaSenha123");

    // Verifica estado final: autenticado mas NÃO autorizado
    assert.equal(contexto.window.NailFlow.auth.autenticado, true, "Usuário deve estar autenticado após atualizar senha com sucesso");
    assert.equal(contexto.window.NailFlow.auth.autorizado, false, "Usuário NÃO deve estar autorizado (sem estúdio vinculado)");
    assert.equal(contexto.window.NailFlow.auth.estudioId, null, "estudioId deve ser null");

    // Verifica evento auth:password-updated com dados corretos
    const eventosUpdated = eventosAuth.filter(e => e.tipo === 'auth:password-updated');
    assert.ok(eventosUpdated.length > 0, "Deve disparar auth:password-updated");
    const detail = eventosUpdated[0].detail;
    assert.equal(detail.sucesso, true);
    assert.equal(detail.autenticado, true);
    assert.equal(detail.autorizado, false);
    assert.equal(detail.estudioId, null);
    assert.ok(detail.usuario, "usuario deve estar presente");
    // SEGURANÇA: NÃO deve expor sessão/tokens no evento
    assert.ok(!detail.sessao, "Evento NÃO deve conter sessão (access_token/refresh_token)");

    // Verifica que disparou auth:unauthorized (AuthN OK, mas sem AuthZ)
    const eventosUnauthorized = eventosAuth.filter(e => e.tipo === 'auth:unauthorized');
    assert.ok(eventosUnauthorized.length > 0, "Deve disparar auth:unauthorized quando sem estúdio vinculado");
    assert.ok(eventosUnauthorized[0].detail.mensagem, "auth:unauthorized deve conter mensagem informativa");

    // Verifica que NÃO disparou auth:login
    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    assert.equal(eventosLogin.length, 0, "NÃO deve disparar auth:login quando sem estúdio vinculado");

    // Verifica que NÃO fez logout indevido (signOut não deve ser chamado)
    // O estado autenticado deve permanecer true
    assert.equal(contexto.window.NailFlow.auth.autenticado, true, "Usuário deve permanecer autenticado (sem logout indevido)");
  });

  it("atualizarSenha NÃO expõe tokens de autenticação no evento auth:password-updated", async () => {
    contexto = await criarContextoAuthComHash("#type=recovery&access_token=def456");

    // Mock buscarEstudioIdDoUsuario para retornar estudioId
    vm.runInContext("buscarEstudioIdDoUsuario = async () => 'studio-123';", contexto);

    await contexto.atualizarSenha("novaSenha123");

    const eventosUpdated = eventosAuth.filter(e => e.tipo === 'auth:password-updated');
    assert.ok(eventosUpdated.length > 0, "Deve disparar auth:password-updated");
    const detail = eventosUpdated[0].detail;

    // SEGURANÇA: Verificar que não há sessão, access_token, refresh_token no evento
    assert.ok(!detail.sessao, "Evento NÃO deve conter propriedade 'sessao'");
    assert.ok(!detail.access_token, "Evento NÃO deve conter access_token");
    assert.ok(!detail.refresh_token, "Evento NÃO deve conter refresh_token");
    assert.ok(!detail.expires_at, "Evento NÃO deve conter expires_at");
    assert.ok(!detail.token_type, "Evento NÃO deve conter token_type");

    // Deve conter apenas dados mínimos necessários
    assert.ok(detail.sucesso !== undefined);
    assert.ok(detail.autenticado !== undefined);
    assert.ok(detail.autorizado !== undefined);
    assert.ok(detail.estudioId !== undefined);
    assert.ok(detail.usuario !== undefined);
  });

  it("atualizarSenha sem logout indevido - usuário permanece autenticado mesmo sem estúdio", async () => {
    contexto = await criarContextoAuthComHash("#type=recovery&access_token=def456");

    // Mock signOut para detectar se foi chamado indevidamente
    let signOutCalled = false;
    vm.runInContext("supabase.auth.signOut = async () => { signOutCalled = true; return { error: null }; }", contexto);

    await contexto.atualizarSenha("novaSenha123");

    // Verifica que signOut NÃO foi chamado
    assert.equal(signOutCalled, false, "supabase.auth.signOut() NÃO deve ser chamado durante atualizarSenha");

    // Verifica que usuário permanece autenticado
    assert.equal(contexto.window.NailFlow.auth.autenticado, true, "Usuário deve permanecer autenticado após atualizar senha");

    // Verifica que auth:logout NÃO foi disparado
    const eventosLogout = eventosAuth.filter(e => e.tipo === 'auth:logout');
    assert.equal(eventosLogout.length, 0, "NÃO deve disparar auth:logout durante atualização de senha");
  });

  it("logout limpa estado de fluxo especial", async () => {
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");

    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);

    // Simula logout
    await contexto.logout();

    // Verifica limpeza via window.NailFlow.auth
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "emRedefinicaoSenha deve ser false após logout");
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), null, "sessionStorage deve ser limpo após logout");
  });

  it("login convencional NÃO é bloqueado quando não há fluxo especial", async () => {
    contexto = await criarContextoAuthComHash("#dashboard");

    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false);

    // Simula login bem-sucedido
    const sessaoMock = { user: { id: "user-456", email: "user@test.com" } };
    await contexto.processarLoginAsync(sessaoMock, sessaoMock.user);

    // Como não há estudioId no mock (buscarEstudioIdDoUsuario retorna null),
    // deve disparar auth:unauthorized (AuthN OK, AuthZ falhou)
    // O importante: NÃO foi bloqueado pelo guard de fluxo especial
    const eventosUnauthorized = eventosAuth.filter(e => e.tipo === 'auth:unauthorized');
    assert.ok(eventosUnauthorized.length > 0, "Deve disparar auth:unauthorized (AuthN OK, sem estúdio vinculado)");
    // Verifica que NÃO houve erro de "fluxo especial ativo" bloqueando
    const eventosErro = eventosAuth.filter(e => e.tipo === 'auth:erro');
    const errosFluxoEspecial = eventosErro.filter(e => e.detail.mensagem && e.detail.mensagem.includes('fluxo especial'));
    assert.equal(errosFluxoEspecial.length, 0, "Não deve haver erro de fluxo especial bloqueando login convencional");
  });

  // =============================================================================
  // NOVOS TESTES: Callbacks com sessão válida durante fluxo especial
  // =============================================================================

  it("INITIAL_SESSION com sessão válida NÃO processa login se fluxo especial ativo", async () => {
    // Inicia COM hash de convite
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);

    // Simula INITIAL_SESSION com sessão válida (como se Supabase já tivesse processado o token)
    const sessaoValida = { user: { id: "user-invite", email: "invite@test.com" } };
    if (contexto._authStateCallback) {
      contexto._authStateCallback('INITIAL_SESSION', sessaoValida);
    }

    // Aguarda processamento assíncrono
    await new Promise(r => setTimeout(r, 50));

    // Guard deve impedir processarLoginAsync - não deve disparar auth:login
    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    assert.equal(eventosLogin.length, 0, "INITIAL_SESSION com sessão válida não deve processar login convencional quando fluxo especial ativo");

    // Deve manter emRedefinicaoSenha=true
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true, "emRedefinicaoSenha deve permanecer true");

    // Deve disparar auth:pronto com autenticado=true (tem sessão), autorizado=false
    const eventosPronto = eventosAuth.filter(e => e.tipo === 'auth:pronto');
    assert.ok(eventosPronto.length > 0, "Deve disparar auth:pronto");
    const ultimoPronto = eventosPronto[eventosPronto.length - 1];
    assert.equal(ultimoPronto.detail.autenticado, true, "auth:pronto deve ter autenticado=true (sessão existe)");
    assert.equal(ultimoPronto.detail.autorizado, false, "auth:pronto deve ter autorizado=false (sem estudioId)");
  });

  it("SIGNED_IN com type=invite no hash NÃO processa login e dispara auth:password-recovery", async () => {
    // Inicia COM hash de convite
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);

    // Simula SIGNED_IN com sessão válida (Supabase processou token de convite)
    const sessaoValida = { user: { id: "user-invite", email: "invite@test.com" } };
    if (contexto._authStateCallback) {
      contexto._authStateCallback('SIGNED_IN', sessaoValida);
    }

    // Aguarda processamento
    await new Promise(r => setTimeout(r, 50));

    // Guard deve impedir processarLoginAsync
    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    assert.equal(eventosLogin.length, 0, "SIGNED_IN não deve processar login convencional quando fluxo especial ativo");

    // Deve manter emRedefinicaoSenha=true
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);

    // Deve disparar auth:password-recovery (não auth:login)
    const eventosRecovery = eventosAuth.filter(e => e.tipo === 'auth:password-recovery');
    assert.ok(eventosRecovery.length > 0, "Deve disparar auth:password-recovery para invite");
    assert.equal(eventosRecovery[0].detail.sessao, sessaoValida);
    assert.equal(eventosRecovery[0].detail.usuario, sessaoValida.user);
  });

  it("getSession com sessão válida NÃO processa login se fluxo especial ativo", async () => {
    // Cria contexto COM sessionStorage de fluxo especial (simula pós-F5)
    // e mock de getSession retornando sessão válida
    sharedSessionStorage.setItem('nailflow_fluxo_especial', 'true');

    // Cria mock de supabase com getSession retornando sessão válida
    const mockDocument2 = {
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
      querySelector() { return null; }
    };

    const mockLocation2 = {
      hash: "#redefinir-senha",
      pathname: "/",
      origin: "http://localhost"
    };

    const mockWindow2 = {
      NailFlow: {},
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
      location: mockLocation2,
      history: { replaceState: () => {}, pushState: () => {} },
      localStorage: { _store: {}, getItem(k) { return this._store[k] ?? null; }, setItem(k, v) { this._store[k] = v; }, removeItem(k) { delete this._store[k]; }, clear() { this._store = {}; } },
      sessionStorage: sharedSessionStorage
    };

    const eventosAuthGetSession = [];
    const tiposEventos = ['auth:login', 'auth:authenticated', 'auth:unauthorized', 'auth:logout', 'auth:erro', 'auth:pronto', 'auth:token-refresh', 'auth:password-recovery', 'auth:password-updated', 'auth:special-flow-abandoned'];
    tiposEventos.forEach(tipo => {
      mockWindow2.addEventListener(tipo, (e) => {
        eventosAuthGetSession.push({ tipo, detail: e.detail });
      });
    });

    const ctx2 = vm.createContext({
      crypto: webcrypto,
      window: mockWindow2,
      document: mockDocument2,
      CustomEvent: function(type, options = {}) { this.type = type; this.detail = options.detail; },
      console,
      setTimeout,
      clearTimeout,
      URLSearchParams,
      sessionStorage: sharedSessionStorage,
      supabase: {
        auth: {
          onAuthStateChange: (callback) => {
            ctx2._authStateCallback = callback;
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signInWithPassword: async ({ email, password }) => {
            return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
          },
          // getSession retorna sessão válida — simula que o Supabase já tem sessão
          getSession: async () => ({ data: { session: { user: { id: "user-getsession", email: "getsession@test.com" } } } }),
          signOut: async () => { if (ctx2._authStateCallback) { ctx2._authStateCallback('SIGNED_OUT', null); } return { error: null }; },
          updateUser: async () => ({ error: null })
        }
      }
    });

    // Carrega auth.js — inicializarAuth() será chamado e invocará getSession()
    const codigoAuth = fs.readFileSync("js/auth.js", "utf8")
      .replace("import { supabase } from './supabase-client.js';", "// supabase mockado no contexto")
      .replace(/export\s+/g, "");
    vm.runInContext(codigoAuth, ctx2);

    // Aguarda processamento assíncrono (getSession + callback)
    await new Promise(r => setTimeout(r, 50));

    // Verifica que estado de fluxo especial foi restaurado do sessionStorage
    assert.equal(ctx2.window.NailFlow.auth.emRedefinicaoSenha, true, "emRedefinicaoSenha deve ser true (restaurado do sessionStorage)");

    // Guard deve impedir processarLoginAsync — não deve disparar auth:login
    const eventosLogin = eventosAuthGetSession.filter(e => e.tipo === 'auth:login');
    assert.equal(eventosLogin.length, 0, "getSession com sessão válida não deve processar login convencional quando fluxo especial ativo");

    // Deve manter emRedefinicaoSenha=true
    assert.equal(ctx2.window.NailFlow.auth.emRedefinicaoSenha, true, "emRedefinicaoSenha deve permanecer true");

    // Deve disparar auth:pronto com autenticado=true (tem sessão), autorizado=false, emRedefinicaoSenha=true
    const eventosPronto = eventosAuthGetSession.filter(e => e.tipo === 'auth:pronto');
    assert.ok(eventosPronto.length > 0, "Deve disparar auth:pronto");
    const ultimoPronto = eventosPronto[eventosPronto.length - 1];
    assert.equal(ultimoPronto.detail.autenticado, true, "auth:pronto deve ter autenticado=true (sessão existe)");
    assert.equal(ultimoPronto.detail.autorizado, false, "auth:pronto deve ter autorizado=false (sem estudioId)");
    assert.equal(ultimoPronto.detail.emRedefinicaoSenha, true, "auth:pronto deve ter emRedefinicaoSenha=true");
  });

  // =============================================================================
  // TESTE: Eventos disparados em window são recebidos por listeners em window
  // =============================================================================

  it("auth:password-recovery é disparado em window e recebido por listener em window (não document)", async () => {
    // Cria contexto COM hash de convite
    const contextoInvite = await criarContextoAuthComHash("#type=invite&access_token=abc123");

    // Registra listener em document (não deve receber — auth.js dispara em window)
    const eventosDocument = [];
    const tiposEventos = ['auth:password-recovery'];
    tiposEventos.forEach(tipo => {
      contextoInvite.document.addEventListener(tipo, (e) => {
        eventosDocument.push({ tipo, detail: e.detail });
      });
    });

    // Registra listener em window (deve receber — auth.js usa dispararEvento -> window.dispatchEvent)
    const eventosWindow = [];
    tiposEventos.forEach(tipo => {
      contextoInvite.window.addEventListener(tipo, (e) => {
        eventosWindow.push({ tipo, detail: e.detail });
      });
    });

    // Simula SIGNED_IN com sessão válida (trigger convite)
    const sessaoValida = { user: { id: "user-window-test", email: "window@test.com" } };
    if (contextoInvite._authStateCallback) {
      contextoInvite._authStateCallback('SIGNED_IN', sessaoValida);
    }

    await new Promise(r => setTimeout(r, 50));

    // Listener em window deve receber o evento
    assert.ok(eventosWindow.length > 0, "Listener em window deve receber auth:password-recovery");
    assert.equal(eventosWindow[0].detail.sessao, sessaoValida);
    assert.equal(eventosWindow[0].detail.usuario, sessaoValida.user);

    // Listener em document NÃO deve receber (auth.js dispara em window, não document)
    assert.equal(eventosDocument.length, 0, "Listener em document NÃO deve receber auth:password-recovery (auth.js dispara em window)");
  });

  it("INITIAL_SESSION SEM sessão mas COM fluxo especial preserva emRedefinicaoSenha", async () => {
    // Inicia COM hash de convite (define fluxo especial)
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);

    // Simula INITIAL_SESSION SEM sessão (Supabase ainda não processou o token)
    if (contexto._authStateCallback) {
      contexto._authStateCallback('INITIAL_SESSION', null);
    }

    await new Promise(r => setTimeout(r, 50));

    // Deve preservar emRedefinicaoSenha=true
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true, "emRedefinicaoSenha deve permanecer true sem sessão mas com fluxo especial");

    // Deve disparar auth:pronto com autenticado=false, autorizado=false, emRedefinicaoSenha=true
    const eventosPronto = eventosAuth.filter(e => e.tipo === 'auth:pronto');
    assert.ok(eventosPronto.length > 0, "Deve disparar auth:pronto");
    const ultimoPronto = eventosPronto[eventosPronto.length - 1];
    assert.equal(ultimoPronto.detail.autenticado, false, "auth:pronto deve ter autenticado=false (sem sessão)");
    assert.equal(ultimoPronto.detail.autorizado, false, "auth:pronto deve ter autorizado=false");
    assert.equal(ultimoPronto.detail.emRedefinicaoSenha, true, "auth:pronto deve ter emRedefinicaoSenha=true (fluxo especial ativo)");
  });

  it("INITIAL_SESSION SEM sessão e SEM fluxo especial marca como não autenticado", async () => {
    contexto = await criarContextoAuthComHash("#dashboard");

    // Simula INITIAL_SESSION sem sessão
    if (contexto._authStateCallback) {
      contexto._authStateCallback('INITIAL_SESSION', null);
    }

    await new Promise(r => setTimeout(r, 50));

    // Deve marcar como inicializado mas não autenticado
    const eventosPronto = eventosAuth.filter(e => e.tipo === 'auth:pronto');
    assert.ok(eventosPronto.length > 0);
    const ultimoPronto = eventosPronto[eventosPronto.length - 1];
    assert.equal(ultimoPronto.detail.autenticado, false);
    assert.equal(ultimoPronto.detail.autorizado, false);
  });

  // =============================================================================
  // NOVOS TESTES: Abandono do fluxo especial
  // =============================================================================

  it("atualizarSenha com erro de token expirado abandona fluxo especial", async () => {
    contexto = await criarContextoAuthComHash("#type=recovery&access_token=def456");

    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), 'true');

    // Mock updateUser para retornar erro de token expirado
    const originalUpdateUser = contexto.supabase.auth.updateUser;
    contexto.supabase.auth.updateUser = async () => ({
      error: { message: 'session expired' }
    });

    try {
      await contexto.atualizarSenha("novaSenha123");
      assert.fail("Deveria ter lançado erro");
    } catch (err) {
      // Esperado
    }

    // Deve ter chamado abandonarFluxoEspecial (limpa estado + sessionStorage)
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "emRedefinicaoSenha deve ser false após token expirado");
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), null, "sessionStorage deve ser limpo após token expirado");

    // Restaurar mock
    contexto.supabase.auth.updateUser = originalUpdateUser;
  });

  it("loginComEmail abandona fluxo especial pendente", async () => {
    // Inicia COM hash de convite (fluxo especial pendente)
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), 'true');

    // Chama loginComEmail (simula usuário decidindo fazer login convencional)
    // O mock signInWithPassword sempre falha, mas o abandonFluxoEspecial deve ter sido chamado ANTES
    try {
      await contexto.loginComEmail("test@test.com", "senha123");
    } catch (err) {
      // Esperado - mock retorna erro
    }

    // Verifica que fluxo especial foi abandonado
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "emRedefinicaoSenha deve ser false após iniciar login convencional");
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), null, "sessionStorage deve ser limpo após iniciar login convencional");
  });

  it("abandonarFluxoEspecial limpa estado e dispara evento", async () => {
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");

    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true);
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), 'true');

    // Chama a função exposta para testes
    await contexto.window.NailFlow.auth._abandonarFluxoEspecial('teste-manual');

    // Verifica limpeza
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "emRedefinicaoSenha deve ser false");
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), null, "sessionStorage deve ser limpo");

    // Verifica evento disparado
    const eventosAbandon = eventosAuth.filter(e => e.tipo === 'auth:special-flow-abandoned');
    assert.ok(eventosAbandon.length > 0, "Deve disparar auth:special-flow-abandoned");
    assert.equal(eventosAbandon[0].detail.motivo, 'teste-manual');
  });

  // =============================================================================
  // NOVOS TESTES: F5 com sessionStorage - verifica estado restaurado via auth:pronto
  // =============================================================================

  it("F5: sessionStorage restaura estado E auth:pronto inclui emRedefinicaoSenha", async () => {
    // Primeira inicialização COM hash de convite
    contexto = await criarContextoAuthComHash("#type=invite&access_token=abc123");

    // Verifica que sessionStorage foi definido
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), 'true');

    // Simula F5: cria NOVO contexto com hash LIMPO mas MESMO sessionStorage
    // Precisamos registrar listeners ANTES de carregar auth.js (que auto-inicializa)
    const mockDocument2 = {
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
      querySelector() { return null; }
    };

    const mockLocation2 = {
      hash: "#redefinir-senha",
      pathname: "/",
      origin: "http://localhost"
    };

    const mockWindow2 = {
      NailFlow: {},
      dispatchEvent: mockDocument2.dispatchEvent.bind(mockDocument2),
      addEventListener: mockDocument2.addEventListener.bind(mockDocument2),
      removeEventListener: mockDocument2.removeEventListener.bind(mockDocument2),
      location: mockLocation2,
      history: {
        replaceState: () => {},
        pushState: () => {}
      },
      localStorage: {
        _store: {},
        getItem(chave) { return this._store[chave] ?? null; },
        setItem(chave, valor) { this._store[chave] = valor; },
        removeItem(chave) { delete this._store[chave]; },
        clear() { this._store = {}; }
      },
      sessionStorage: sharedSessionStorage
    };

    const eventosAuthF5 = [];
    const tiposEventos = ['auth:pronto'];
    tiposEventos.forEach(tipo => {
      mockDocument2.addEventListener(tipo, (e) => {
        eventosAuthF5.push({ tipo, detail: e.detail });
      });
    });

    const ctx2 = vm.createContext({
      crypto: webcrypto,
      window: mockWindow2,
      document: mockDocument2,
      CustomEvent: function(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      },
      console,
      setTimeout,
      clearTimeout,
      URLSearchParams,
      sessionStorage: sharedSessionStorage,
      supabase: {
        auth: {
          onAuthStateChange: (callback) => {
            ctx2._authStateCallback = callback;
            return { data: { subscription: { unsubscribe: () => {} } } };
          },
          signInWithPassword: async ({ email, password }) => {
            return { data: { user: null, session: null }, error: new Error('Invalid login credentials') };
          },
          getSession: async () => ({ data: { session: null } }),
          signOut: async () => {
            if (ctx2._authStateCallback) {
              ctx2._authStateCallback('SIGNED_OUT', null);
            }
            return { error: null };
          },
          updateUser: async () => ({ error: null })
        }
      }
    });

    // Carrega o código do auth.js no contexto (auto-inicializa e dispara evento)
    const codigoAuth = fs.readFileSync("js/auth.js", "utf8")
      .replace("import { supabase } from './supabase-client.js';", "// supabase mockado no contexto")
      .replace(/export\s+/g, "");

    vm.runInContext(codigoAuth, ctx2);

    // Aguarda processamento assíncrono
    await new Promise(r => setTimeout(r, 50));

    // O novo contexto deve ler do sessionStorage e restaurar estado de navegação
    assert.equal(ctx2.window.NailFlow.auth.emRedefinicaoSenha, true, "Após F5, emRedefinicaoSenha deve ser restaurado do sessionStorage");

    // Deve ter disparado auth:pronto com emRedefinicaoSenha=true para a UI mostrar a tela
    const eventosPronto = eventosAuthF5.filter(e => e.tipo === 'auth:pronto');
    assert.ok(eventosPronto.length > 0, "Após F5, deve disparar auth:pronto");
    const ultimoPronto = eventosPronto[eventosPronto.length - 1];
    assert.equal(ultimoPronto.detail.emRedefinicaoSenha, true, "auth:pronto deve incluir emRedefinicaoSenha=true");
    assert.equal(ultimoPronto.detail.autenticado, false, "auth:pronto deve ter autenticado=false (sem sessão)");
    assert.equal(ultimoPronto.detail.autorizado, false, "auth:pronto deve ter autorizado=false");
  });

  // =============================================================================
  // NOVOS TESTES: Concorrência entre INITIAL_SESSION e PASSWORD_RECOVERY
  // =============================================================================

  it("Cenário A: INITIAL_SESSION inicia processamento, PASSWORD_RECOVERY chega antes da consulta terminar — permanece no fluxo de recuperação", async () => {
    // Este teste simula a condição de corrida real:
    // 1. INITIAL_SESSION chega com sessão válida (via callback onAuthStateChange)
    // 2. processarLoginAsync inicia e começa busca assíncrona de estudioId
    // 3. PASSWORD_RECOVERY chega ANTES da busca terminar
    // 4. A busca termina — deve abortar login convencional e manter fluxo de recuperação
    // 5. Verificar que deduplicação foi limpa (login futuro deve funcionar)

    // Sincronização explícita: promises para coordenar o momento exato da consulta
    let resolveBuscaEstudio;
    const buscaEstudioPromise = new Promise(resolve => {
      resolveBuscaEstudio = resolve;
    });

    // Promise que resolve quando a consulta de buscarEstudioIdDoUsuario INICIA (atinge o await)
    let consultaIniciadaResolve;
    const consultaIniciadaPromise = new Promise(resolve => {
      consultaIniciadaResolve = resolve;
    });

    // Mock buscarEstudioIdDoUsuario que aguarda nossa resolução
    contexto = await criarContextoAuthComHash("#dashboard"); // hash limpo inicialmente

    // Sobrescrever buscarEstudioIdDoUsuario para controlar quando termina
    // e SINALIZAR quando a consulta começou (atingiu o await)
    vm.runInContext(`
      let _resolveBuscaEstudio;
      const _buscaEstudioPromise = new Promise(r => { _resolveBuscaEstudio = r; });
      let _consultaIniciadaResolve;
      const _consultaIniciadaPromise = new Promise(r => { _consultaIniciadaResolve = r; });
      buscarEstudioIdDoUsuario = async (userId) => {
        // Sinaliza que a consulta começou (estamos no await)
        _consultaIniciadaResolve();
        await _buscaEstudioPromise;
        return null; // Sem estúdio vinculado
      };
      // Expor funções de resolução para o teste
      __resolveBuscaEstudioTest = () => _resolveBuscaEstudio();
      __getConsultaIniciadaPromise = () => _consultaIniciadaPromise;
    `, contexto);

    const sessaoValida = { user: { id: "user-race-a", email: "race-a@test.com" } };

    // Dispara INITIAL_SESSION via callback real (simula Supabase recuperando sessão)
    // Isso inicia processarLoginAsync internamente
    if (contexto._authStateCallback) {
      contexto._authStateCallback('INITIAL_SESSION', sessaoValida);
    }

    // AGUARDA EXPLICITAMENTE a consulta iniciar (atingir o await em buscarEstudioIdDoUsuario)
    // Obtém a promise do contexto VM e aguarda
    const consultaIniciadaPromiseVM = vm.runInContext("__getConsultaIniciadaPromise()", contexto);
    await consultaIniciadaPromiseVM;

    // Sinalização explícita de que a consulta começou: deduplicação deve ter marcado o userId
    const deduplicacaoIniciada = vm.runInContext("estadoAuth._ultimoUserIdProcessado", contexto);
    assert.equal(deduplicacaoIniciada, sessaoValida.user.id, "Deduplicação deve marcar userId como em processamento");

    // AGORA: Simula PASSWORD_RECOVERY chegando (o fluxo especial começa)
    // Dispara callback PASSWORD_RECOVERY enquanto a consulta está pendente
    if (contexto._authStateCallback) {
      contexto._authStateCallback('PASSWORD_RECOVERY', sessaoValida);
    }

    // Aguarda processamento do PASSWORD_RECOVERY (síncrono no callback)
    await new Promise(r => setTimeout(r, 0));

    // Verifica que fluxo especial foi detectado
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true, "PASSWORD_RECOVERY deve definir emRedefinicaoSenha=true");

    // AGORA: Resolve a busca de estudioId (a consulta assíncrona termina)
    vm.runInContext("__resolveBuscaEstudioTest();", contexto);
    resolveBuscaEstudio(); // Resolve a promise externa também

    // Aguarda conclusão do processamento assíncrono iniciado pelo INITIAL_SESSION
    // O processarLoginAsync continua após o await e deve abortar ao ver _fluxoEspecialDetectado
    await new Promise(r => setTimeout(r, 0));

    // Verifica que NÃO emitiu eventos de login convencional
    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    assert.equal(eventosLogin.length, 0, "NÃO deve disparar auth:login quando PASSWORD_RECOVERY interceptou");

    const eventosUnauthorized = eventosAuth.filter(e => e.tipo === 'auth:unauthorized');
    assert.equal(eventosUnauthorized.length, 0, "NÃO deve disparar auth:unauthorized quando PASSWORD_RECOVERY interceptou");

    // Deve ter emitido auth:password-recovery
    const eventosRecovery = eventosAuth.filter(e => e.tipo === 'auth:password-recovery');
    assert.ok(eventosRecovery.length > 0, "Deve disparar auth:password-recovery");

    // Verifica que emRedefinicaoSenha permanece verdadeiro durante a recuperação
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true, "emRedefinicaoSenha deve permanecer true");

    // Verifica que deduplicação foi limpa: o userId NÃO deve mais estar marcado como processado
    const deduplicacaoAposAbort = vm.runInContext("estadoAuth._ultimoUserIdProcessado", contexto);
    assert.equal(deduplicacaoAposAbort, null, "Deduplicação deve ser limpa (null) ao abortar por fluxo especial");

    // Verificação indireta: após fluxo especial terminar, login convencional futuro deve funcionar
    // Simula conclusão do fluxo de recuperação (atualizarSenha sem estúdio)
    await contexto.atualizarSenha("novaSenha123");

    // Verifica que fluxo especial foi limpo
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "Fluxo especial deve ser limpo após conclusão");

    // Simula logout para limpar estado de autenticação
    await contexto.logout();
    await new Promise(r => setTimeout(r, 0));

    // Agora simula login convencional bem-sucedido (mesmo userId)
    const sessaoLogin = { user: { id: "user-race-a", email: "race-a@test.com" } };
    await contexto.processarLoginAsync(sessaoLogin, sessaoLogin.user);

    // Deve ter processado login convencional (sem bloqueio de fluxo especial ou deduplicação)
    // Como buscarEstudioIdDoUsuario retorna null (mock padrão), deve disparar auth:unauthorized
    // O importante: NÃO foi bloqueado por fluxo especial nem por deduplicação
    const eventosLoginAposFluxo = eventosAuth.filter(e => e.tipo === 'auth:login');
    const eventosUnauthorizedAposFluxo = eventosAuth.filter(e => e.tipo === 'auth:unauthorized');
    assert.ok(eventosUnauthorizedAposFluxo.length > 0 || eventosLoginAposFluxo.length > 0,
      "Deve processar login convencional após fluxo especial terminar (deduplicação limpa)");
  });

  it("Cenário B: PASSWORD_RECOVERY chega antes de INITIAL_SESSION — fluxo especial tem prioridade", async () => {
    // Cenário: PASSWORD_RECOVERY é processado primeiro, depois INITIAL_SESSION com sessão válida
    // O fluxo especial deve manter prioridade

    // Cria contexto SEM hash especial (para que INITIAL_SESSION não detecte fluxo no init)
    contexto = await criarContextoAuthComHash("#dashboard");

    // Primeiro: PASSWORD_RECOVERY chega (simula Supabase processando token de recovery)
    const sessaoRecovery = { user: { id: "user-race-b", email: "race-b@test.com" } };
    if (contexto._authStateCallback) {
      contexto._authStateCallback('PASSWORD_RECOVERY', sessaoRecovery);
    }
    await new Promise(r => setTimeout(r, 10));

    // Verifica estado após PASSWORD_RECOVERY - o callback deve detectar o fluxo especial
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true, "PASSWORD_RECOVERY deve definir emRedefinicaoSenha=true");

    // Depois: INITIAL_SESSION chega com sessão válida
    if (contexto._authStateCallback) {
      contexto._authStateCallback('INITIAL_SESSION', sessaoRecovery);
    }
    await new Promise(r => setTimeout(r, 10));

    // Fluxo especial deve ter prioridade — não processar como login convencional
    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    assert.equal(eventosLogin.length, 0, "INITIAL_SESSION após PASSWORD_RECOVERY não deve processar login convencional");

    const eventosUnauthorized = eventosAuth.filter(e => e.tipo === 'auth:unauthorized');
    assert.equal(eventosUnauthorized.length, 0, "INITIAL_SESSION após PASSWORD_RECOVERY não deve disparar auth:unauthorized");

    // Deve manter estado de recuperação
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true, "emRedefinicaoSenha deve permanecer true");

    // auth:pronto deve refletir fluxo especial
    const eventosPronto = eventosAuth.filter(e => e.tipo === 'auth:pronto');
    const ultimoPronto = eventosPronto[eventosPronto.length - 1];
    assert.equal(ultimoPronto.detail.emRedefinicaoSenha, true, "auth:pronto deve ter emRedefinicaoSenha=true");
    assert.equal(ultimoPronto.detail.autenticado, true, "auth:pronto deve ter autenticado=true (tem sessão)");
  });

  it("Cenário C: Fluxo de recuperação concluído com sucesso — autenticação/autorização calculados corretamente", async () => {
    // Simula fluxo completo: recovery -> atualizarSenha -> sessão recuperada
    contexto = await criarContextoAuthComHash("#type=recovery&access_token=def456");

    const sessaoRecovery = { user: { id: "user-race-c", email: "race-c@test.com" } };
    if (contexto._authStateCallback) {
      contexto._authStateCallback('PASSWORD_RECOVERY', sessaoRecovery);
    }
    await new Promise(r => setTimeout(r, 10));

    // Mock buscarEstudioIdDoUsuario para retornar estudioId (usuário COM vínculo)
    vm.runInContext("buscarEstudioIdDoUsuario = async () => 'studio-123';", contexto);

    // Chama atualizarSenha (simula usuário definindo nova senha)
    await contexto.atualizarSenha("novaSenha123");

    // Verifica estado final: autenticado E autorizado (tem estúdio)
    assert.equal(contexto.window.NailFlow.auth.autenticado, true, "Deve estar autenticado após recovery bem-sucedido");
    assert.equal(contexto.window.NailFlow.auth.autorizado, true, "Deve estar autorizado (tem estúdio vinculado)");
    assert.equal(contexto.window.NailFlow.auth.estudioId, "studio-123", "estudioId deve ser definido");
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "emRedefinicaoSenha deve ser false após conclusão");

    // Verifica eventos: auth:password-updated com autorizado=true
    const eventosUpdated = eventosAuth.filter(e => e.tipo === 'auth:password-updated');
    assert.ok(eventosUpdated.length > 0, "Deve disparar auth:password-updated");
    assert.equal(eventosUpdated[0].detail.autorizado, true);
    assert.equal(eventosUpdated[0].detail.estudioId, "studio-123");

    // Deve ter disparado auth:login (AuthN + AuthZ OK)
    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    assert.ok(eventosLogin.length > 0, "Deve disparar auth:login quando autorizado");
    assert.equal(eventosLogin[0].detail.estudioId, "studio-123");

    // NÃO deve ter disparado auth:unauthorized
    const eventosUnauthorized = eventosAuth.filter(e => e.tipo === 'auth:unauthorized');
    assert.equal(eventosUnauthorized.length, 0, "NÃO deve disparar auth:unauthorized quando tem estúdio");
  });

  it("Cenário C (sem estúdio): Fluxo de recuperação concluído sem vínculo — autenticado mas não autorizado", async () => {
    // Mesmo fluxo mas sem estúdio vinculado
    contexto = await criarContextoAuthComHash("#type=recovery&access_token=def456");

    const sessaoRecovery = { user: { id: "user-race-c2", email: "race-c2@test.com" } };
    if (contexto._authStateCallback) {
      contexto._authStateCallback('PASSWORD_RECOVERY', sessaoRecovery);
    }
    await new Promise(r => setTimeout(r, 10));

    // buscarEstudioIdDoUsuario retorna null por padrão (sem estúdio)
    await contexto.atualizarSenha("novaSenha123");

    // Verifica estado final: autenticado mas NÃO autorizado
    assert.equal(contexto.window.NailFlow.auth.autenticado, true, "Deve estar autenticado");
    assert.equal(contexto.window.NailFlow.auth.autorizado, false, "NÃO deve estar autorizado (sem estúdio)");
    assert.equal(contexto.window.NailFlow.auth.estudioId, null, "estudioId deve ser null");

    // Deve ter disparado auth:unauthorized
    const eventosUnauthorized = eventosAuth.filter(e => e.tipo === 'auth:unauthorized');
    assert.ok(eventosUnauthorized.length > 0, "Deve disparar auth:unauthorized quando sem estúdio");
    assert.ok(eventosUnauthorized[0].detail.mensagem, "Deve conter mensagem informativa");

    // NÃO deve ter disparado auth:login
    const eventosLogin = eventosAuth.filter(e => e.tipo === 'auth:login');
    assert.equal(eventosLogin.length, 0, "NÃO deve disparar auth:login quando sem estúdio");

    // auth:password-updated com autorizado=false
    const eventosUpdated = eventosAuth.filter(e => e.tipo === 'auth:password-updated');
    assert.ok(eventosUpdated.length > 0);
    assert.equal(eventosUpdated[0].detail.autorizado, false);
    assert.equal(eventosUpdated[0].detail.estudioId, null);
  });

  it("Cenário D: Após concluir fluxo especial, login convencional futuro funciona normalmente", async () => {
    // 1. Inicia fluxo de recuperação
    contexto = await criarContextoAuthComHash("#dashboard");

    const sessaoRecovery = { user: { id: "user-race-d", email: "race-d@test.com" } };
    if (contexto._authStateCallback) {
      contexto._authStateCallback('PASSWORD_RECOVERY', sessaoRecovery);
    }
    await new Promise(r => setTimeout(r, 10));

    // 2. Conclui recuperação (sem estúdio)
    await contexto.atualizarSenha("novaSenha123");

    // Verifica que fluxo especial foi limpo
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), null, "sessionStorage deve ser limpo");
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "Fluxo especial deve ser limpo após conclusão (emRedefinicaoSenha=false)");

    // 3. Agora simula login convencional (SIGNED_IN sem hash especial)
    // Limpa hash para simular navegação normal
    // Cria novo contexto para simular nova navegação/login
    // (o estado do contexto anterior já tem autenticado=true, autorizado=false)

    // Chama processarLoginAsync diretamente para simular novo login
    // O usuário já está autenticado, mas vamos simular novo login
    const eventosAuthAntesLogin = eventosAuth.length;

    // Simula logout primeiro para limpar estado
    await contexto.logout();
    await new Promise(r => setTimeout(r, 10));

    // Verifica que estado foi limpo
    assert.equal(contexto.window.NailFlow.auth.autenticado, false);
    assert.equal(contexto.window.NailFlow.auth.autorizado, false);

    // Agora simula login convencional bem-sucedido
    const sessaoLogin = { user: { id: "user-login-d", email: "login-d@test.com" } };
    await contexto.processarLoginAsync(sessaoLogin, sessaoLogin.user);

    // Deve ter processado login convencional (sem bloqueio de fluxo especial)
    const eventosLogin = eventosAuth.slice(eventosAuthAntesLogin).filter(e => e.tipo === 'auth:login');
    const eventosUnauthorized = eventosAuth.slice(eventosAuthAntesLogin).filter(e => e.tipo === 'auth:unauthorized');

    // Como buscarEstudioIdDoUsuario retorna null (mock padrão), deve disparar auth:unauthorized
    // O importante: NÃO foi bloqueado por fluxo especial
    assert.ok(eventosUnauthorized.length > 0 || eventosLogin.length > 0, "Deve processar login convencional após fluxo especial terminar");

    // Verifica que NÃO houve erro de "fluxo especial ativo" bloqueando
    const eventosErro = eventosAuth.slice(eventosAuthAntesLogin).filter(e => e.tipo === 'auth:erro');
    const errosFluxoEspecial = eventosErro.filter(e => e.detail.mensagem && e.detail.mensagem.includes('fluxo especial'));
    assert.equal(errosFluxoEspecial.length, 0, "Não deve haver erro de fluxo especial bloqueando login convencional posterior");
  });

  // =============================================================================
  // TESTES: abandonarFluxoEspecial — exportação e comportamento
  // =============================================================================
  //
  // NOTA: O ambiente de teste VM (vm.runInContext) NÃO suporta ES Modules dinâmicos
  // (import()). Portanto, NÃO é possível testar o import dinâmico real que
  // navegacao.js faz: import("./auth.js").then(({ abandonarFluxoEspecial }) => ...)
  //
  // O que testamos aqui:
  // 1. Validação da exportação nomeada: verificamos no CÓDIGO FONTE se existe 'export function abandonarFluxoEspecial'
  // 2. Validação do comportamento da função: chamamos via window.NailFlow.auth._abandonarFluxoEspecial (exposto pelo módulo)
  // 3. O listener de navegação (hashchange) NÃO é testado aqui — requer ambiente com ES Modules reais

  it("Exportação nomeada: auth.js deve declarar 'export function abandonarFluxoEspecial'", () => {
    // Validação estática da exportação ES Module no código fonte
    // Isso comprova que o import dinâmico em navegacao.js encontrará a exportação
    const codigoAuth = fs.readFileSync("js/auth.js", "utf8");
    assert.ok(
      /export\s+function\s+abandonarFluxoEspecial\b/.test(codigoAuth),
      "auth.js deve conter 'export function abandonarFluxoEspecial' (exportação nomeada ES Module)"
    );
  });

  it("Comportamento: abandonarFluxoEspecial limpa estado especial e emite evento", async () => {
    // Testa o COMPORTAMENTO da função (não a integração com dynamic import)
    // Acessamos via propriedade global exposta pelo módulo para testes
    contexto = await criarContextoAuthComHash("#dashboard");

    const sessaoRecovery = { user: { id: "user-hashchange", email: "hashchange@test.com" } };
    if (contexto._authStateCallback) {
      contexto._authStateCallback('PASSWORD_RECOVERY', sessaoRecovery);
    }
    await new Promise(r => setTimeout(r, 0));

    // Verifica que fluxo especial está ativo
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, true, "Fluxo especial deve estar ativo");
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), 'true', "sessionStorage deve ter flag");

    // Chama a função via propriedade exposta (valida que a função existe e é acessível)
    const abandonarFluxoEspecial = contexto.window.NailFlow.auth._abandonarFluxoEspecial;
    assert.ok(typeof abandonarFluxoEspecial === 'function', "abandonarFluxoEspecial deve ser uma função");

    // Executa a função com motivo (simula hashchange saindo de redefinir-senha)
    abandonarFluxoEspecial('navegacao-fora-da-tela');

    // Verifica que o estado especial foi limpo
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false, "emRedefinicaoSenha deve ser false após abandonar");
    assert.equal(sharedSessionStorage.getItem('nailflow_fluxo_especial'), null, "sessionStorage deve ser limpo");

    // Verifica que evento auth:special-flow-abandoned foi emitido
    const eventosAbandoned = eventosAuth.filter(e => e.tipo === 'auth:special-flow-abandoned');
    assert.ok(eventosAbandoned.length > 0, "Deve disparar auth:special-flow-abandoned");
    assert.equal(eventosAbandoned[0].detail.motivo, 'navegacao-fora-da-tela', "Evento deve conter o motivo");
  });

  it("Comportamento: abandonarFluxoEspecial é idempotente (chamada dupla não falha)", async () => {
    // A função deve ser segura para ser chamada múltiplas vezes
    contexto = await criarContextoAuthComHash("#dashboard");

    const sessaoRecovery = { user: { id: "user-hashchange-2", email: "hashchange2@test.com" } };
    if (contexto._authStateCallback) {
      contexto._authStateCallback('PASSWORD_RECOVERY', sessaoRecovery);
    }
    await new Promise(r => setTimeout(r, 0));

    const abandonarFluxoEspecial = contexto.window.NailFlow.auth._abandonarFluxoEspecial;

    // Primeira chamada
    abandonarFluxoEspecial('motivo-1');
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false);

    // Segunda chamada não deve lançar erro
    assert.doesNotThrow(() => abandonarFluxoEspecial('motivo-2'), "Chamada dupla não deve lançar erro");

    // Estado permanece limpo
    assert.equal(contexto.window.NailFlow.auth.emRedefinicaoSenha, false);
  });
});

// =============================================================================
// TESTES: Navegação - auth:password-updated listener
// =============================================================================

describe("Navegação - auth:password-updated listener", () => {
  let mockDocument;
  let mockWindow;
  let mockLocation;
  let reloadCalled;
  let hashChanged;

  function criarContextoNavegacao() {
    reloadCalled = false;
    hashChanged = false;

    mockLocation = {
      _hash: "#redefinir-senha",
      pathname: "/",
      origin: "http://localhost",
      set hash(value) {
        hashChanged = true;
        this._hash = value;
      },
      get hash() {
        return this._hash;
      }
    };

    mockDocument = {
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
      querySelector() { return null; }
    };

    mockWindow = {
      NailFlow: { auth: { emRedefinicaoSenha: true } },
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
      location: mockLocation,
      history: {
        replaceState: () => {},
        pushState: () => {}
      },
      localStorage: {
        _store: {},
        getItem(chave) { return this._store[chave] ?? null; },
        setItem(chave, valor) { this._store[chave] = valor; },
        removeItem(chave) { delete this._store[chave]; },
        clear() { this._store = {}; }
      },
      sessionStorage: {
        _store: {},
        getItem(chave) { return this._store[chave] ?? null; },
        setItem(chave, valor) { this._store[chave] = valor; },
        removeItem(chave) { delete this._store[chave]; },
        clear() { this._store = {}; }
      }
    };

    // Adiciona reload no location (navegacao.js usa window.location.reload())
    mockLocation.reload = function() {
      reloadCalled = true;
    };

    const ctx = vm.createContext({
      crypto: webcrypto,
      window: mockWindow,
      document: mockDocument,
      CustomEvent: function(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
      },
      console,
      setTimeout,
      clearTimeout,
      URLSearchParams
    });

    // Carrega o código do navegacao.js
    const codigoNavegacao = fs.readFileSync("js/navegacao.js", "utf8");
    vm.runInContext(codigoNavegacao, ctx);

    // Chama inicializarAuthListeners() diretamente para registrar os listeners de auth
    // (evita depender de DOMContentLoaded que precisa de DOM completo)
    vm.runInContext("inicializarAuthListeners()", ctx);

    return ctx;
  }

  it("auth:password-updated com sucesso E autorizado (tem estúdio) define hash #dashboard e recarrega a página", () => {
    const ctx = criarContextoNavegacao();

    // Verifica estado inicial
    assert.equal(mockLocation.hash, "#redefinir-senha");
    assert.equal(reloadCalled, false);

    // Dispara auth:password-updated com sucesso: true E autorizado: true (tem estúdio)
    mockWindow.dispatchEvent(new ctx.CustomEvent("auth:password-updated", {
      detail: { sucesso: true, autenticado: true, autorizado: true, estudioId: "studio-123" }
    }));

    // Verifica que hash foi alterado para #dashboard
    assert.equal(mockLocation.hash, "#dashboard", "Hash deve ser alterado para #dashboard");

    // Verifica que reload foi chamado
    assert.equal(reloadCalled, true, "window.location.reload() deve ser chamado após sucesso com autorização");
  });

  it("auth:password-updated com sucesso mas SEM autorização (sem estúdio) NÃO recarrega e NÃO redireciona para login", () => {
    const ctx = criarContextoNavegacao();

    // Verifica estado inicial
    assert.equal(mockLocation.hash, "#redefinir-senha");
    assert.equal(reloadCalled, false);

    // Dispara auth:password-updated com sucesso: true mas autorizado: false (sem estúdio)
    mockWindow.dispatchEvent(new ctx.CustomEvent("auth:password-updated", {
      detail: { sucesso: true, autenticado: true, autorizado: false, estudioId: null }
    }));

    // Verifica que hash NÃO foi alterado (continua em redefinir-senha)
    assert.equal(mockLocation.hash, "#redefinir-senha", "Hash não deve ser alterado sem autorização");

    // Verifica que reload NÃO foi chamado
    assert.equal(reloadCalled, false, "window.location.reload() NÃO deve ser chamado sem autorização");
  });

  it("auth:password-updated sem sucesso NÃO recarrega a página", () => {
    const ctx = criarContextoNavegacao();

    // Dispara auth:password-updated SEM sucesso
    mockWindow.dispatchEvent(new ctx.CustomEvent("auth:password-updated", { detail: {} }));

    // Verifica que hash NÃO foi alterado (continua em redefinir-senha)
    assert.equal(mockLocation.hash, "#redefinir-senha", "Hash não deve ser alterado sem sucesso");

    // Verifica que reload NÃO foi chamado
    assert.equal(reloadCalled, false, "window.location.reload() NÃO deve ser chamado sem sucesso");
  });

  it("auth:password-updated com sucesso: false NÃO recarrega a página", () => {
    const ctx = criarContextoNavegacao();

    // Dispara auth:password-updated com sucesso: false
    mockWindow.dispatchEvent(new ctx.CustomEvent("auth:password-updated", { detail: { sucesso: false } }));

    // Verifica que hash NÃO foi alterado
    assert.equal(mockLocation.hash, "#redefinir-senha", "Hash não deve ser alterado com sucesso: false");

    // Verifica que reload NÃO foi chamado
    assert.equal(reloadCalled, false, "window.location.reload() NÃO deve ser chamado com sucesso: false");
  });

  it("auth:password-updated sem detail NÃO recarrega a página", () => {
    const ctx = criarContextoNavegacao();

    // Dispara auth:password-updated sem detail
    mockWindow.dispatchEvent(new ctx.CustomEvent("auth:password-updated", { detail: undefined }));

    // Verifica que hash NÃO foi alterado
    assert.equal(mockLocation.hash, "#redefinir-senha", "Hash não deve ser alterado sem detail");

    // Verifica que reload NÃO foi chamado
    assert.equal(reloadCalled, false, "window.location.reload() NÃO deve ser chamado sem detail");
  });
});