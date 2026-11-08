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