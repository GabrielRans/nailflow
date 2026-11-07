/**
 * Módulo Financeiro - NailFlow
 * API dual: localStorage (fallback/síncrono para testes) + Supabase (assíncrono para produção)
 * Carregado como script clássico (não ES module) para compatibilidade com testes
 */

const CHAVE_MOVIMENTACOES = "nailflow_movimentacoes";

// Estado interno
let movimentacoes = [];
let repositorioAtivo = null; // 'localStorage' | 'supabase' | null
let repoSupabase = null;
let inicializacaoPromise = null;

// =============================================================================
// Repositório localStorage (síncrono) - Fallback para testes
// =============================================================================

const repoLocalStorage = {
  salvar(todas) {
    const textoMovimentacoes = JSON.stringify(todas);
    localStorage.setItem(CHAVE_MOVIMENTACOES, textoMovimentacoes);
  },
  listar() {
    const dadosSalvos = localStorage.getItem(CHAVE_MOVIMENTACOES);
    if (dadosSalvos !== null) {
      return JSON.parse(dadosSalvos);
    }
    return [];
  },
  buscarPorId(id) {
    const lista = this.listar();
    return lista.find(m => m.id === id) ?? null;
  },
  adicionar(movimentacao) {
    const lista = this.listar();
    lista.push(movimentacao);
    this.salvar(lista);
    return movimentacao;
  },
  atualizar(id, dadosAtualizados) {
    const lista = this.listar();
    const idx = lista.findIndex(m => m.id === id);
    if (idx === -1) return false;
    lista[idx] = { ...dadosAtualizados, id };
    this.salvar(lista);
    return true;
  },
  excluir(id) {
    const lista = this.listar();
    const idx = lista.findIndex(m => m.id === id);
    if (idx === -1) return false;
    lista.splice(idx, 1);
    this.salvar(lista);
    return true;
  },
  filtrarPorPeriodo(dataInicial, dataFinal) {
    const lista = this.listar();
    return lista.filter(m => {
      const atendeInicial = !dataInicial || m.data >= dataInicial;
      const atendeFinal = !dataFinal || m.data <= dataFinal;
      return atendeInicial && atendeFinal;
    });
  }
};

// =============================================================================
// API Síncrona Legada (Compatibilidade com testes) - @deprecated
// =============================================================================

/**
 * Carrega movimentações do localStorage para o cache local (síncrono)
 * @deprecated Use API assíncrona
 */
function carregarMovimentacoes() {
  const dadosSalvos = localStorage.getItem(CHAVE_MOVIMENTACOES);
  if (dadosSalvos !== null) {
    movimentacoes = JSON.parse(dadosSalvos);
  }
}

/**
 * Salva movimentações do cache local no localStorage (síncrono)
 * @deprecated Use API assíncrona
 */
function salvarMovimentacoes() {
  const textoMovimentacoes = JSON.stringify(movimentacoes);
  localStorage.setItem(CHAVE_MOVIMENTACOES, textoMovimentacoes);
}

// =============================================================================
// Inicialização do repositório ativo
// =============================================================================

/**
 * Carrega o módulo do repositório Supabase dinamicamente
 * @returns {Promise<Function|null>}
 */
async function carregarRepoSupabase() {
  try {
    const modulo = await import('./repositories/financeiro-repo.js');
    return modulo.tentarCriarFinanceiroRepository;
  } catch {
    return null;
  }
}

/**
 * Inicializa o repositório adequado baseado no estado de autenticação
 * @returns {Promise<Object>} Repositório ativo
 */
async function inicializarRepositorio() {
  if (repositorioAtivo) return getRepo();

  // Tentar criar repositório Supabase (dynamic import)
  const tentarCriar = await carregarRepoSupabase();
  if (tentarCriar) {
    repoSupabase = await tentarCriar();
  }

  if (repoSupabase) {
    repositorioAtivo = 'supabase';
    // Carregar dados do Supabase para cache local
    try {
      movimentacoes = await repoSupabase.listar();
    } catch {
      movimentacoes = [];
    }
  } else {
    repositorioAtivo = 'localStorage';
    // Carregar do localStorage
    const dadosSalvos = localStorage.getItem(CHAVE_MOVIMENTACOES);
    if (dadosSalvos !== null) {
      movimentacoes = JSON.parse(dadosSalvos);
    }
  }

  return getRepo();
}

function getRepo() {
  return repositorioAtivo === 'supabase' ? repoSupabase : repoLocalStorage;
}

/**
 * Força reinicialização do repositório (útil após login/logout)
 */
async function reinicializarRepositorio() {
  repositorioAtivo = null;
  repoSupabase = null;
  movimentacoes = [];
  return await inicializarRepositorio();
}

// Inicializar imediatamente (não await - uso lazy)
inicializacaoPromise = inicializarRepositorio();

// =============================================================================
// Helpers internos
// =============================================================================

function dispararAtualizacao(lista) {
  document.dispatchEvent(
    new CustomEvent("movimentacoes:atualizadas", {
      detail: lista.map(m => ({ ...m }))
    })
  );
}

// =============================================================================
// API ASSÍNCRONA (Usa repositório Supabase diretamente)
// =============================================================================

/**
 * Adiciona movimentação (assíncrono - direto no repositório)
 * @param {Object} movimentacao
 * @returns {Promise<boolean>}
 */
async function adicionarMovimentacaoAsync(movimentacao) {
  if (!validarMovimentacao(movimentacao)) return false;
  try {
    const repo = await inicializacaoPromise;
    await repo.adicionar(movimentacao);
    movimentacoes = await repo.listar();
    dispararAtualizacao(movimentacoes);
    return true;
  } catch (err) {
    console.error('[Financeiro] Erro ao adicionar:', err);
    return false;
  }
}

/**
 * Lista movimentações (assíncrono - direto do repositório)
 * @returns {Promise<Array>}
 */
async function listarMovimentacoesAsync() {
  const repo = await inicializacaoPromise;
  movimentacoes = await repo.listar();
  return [...movimentacoes];
}

/**
 * Busca movimentação por ID (assíncrono - direto do repositório)
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function buscarMovimentacaoPorIdAsync(id) {
  const repo = await inicializacaoPromise;
  return await repo.buscarPorId(id);
}

/**
 * Atualiza movimentação (assíncrono - direto no repositório)
 * @param {string} id
 * @param {Object} dadosAtualizados
 * @returns {Promise<boolean>}
 */
async function atualizarMovimentacaoAsync(id, dadosAtualizados) {
  try {
    const repo = await inicializacaoPromise;
    const ok = await repo.atualizar(id, dadosAtualizados);
    if (ok) {
      movimentacoes = await repo.listar();
      dispararAtualizacao(movimentacoes);
    }
    return ok;
  } catch (err) {
    console.error('[Financeiro] Erro ao atualizar:', err);
    return false;
  }
}

/**
 * Exclui movimentação (assíncrono - direto no repositório)
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function excluirMovimentacaoAsync(id) {
  try {
    const repo = await inicializacaoPromise;
    const ok = await repo.excluir(id);
    if (ok) {
      movimentacoes = await repo.listar();
      dispararAtualizacao(movimentacoes);
    }
    return ok;
  } catch (err) {
    console.error('[Financeiro] Erro ao excluir:', err);
    return false;
  }
}

/**
 * Filtra movimentações por período (assíncrono - direto do repositório)
 * @param {string} dataInicial
 * @param {string} dataFinal
 * @returns {Promise<Array>}
 */
async function filtrarMovimentacoesPorPeriodoAsync(dataInicial, dataFinal) {
  const repo = await inicializacaoPromise;
  return await repo.filtrarPorPeriodo(dataInicial, dataFinal);
}

// =============================================================================
// API SÍNCRONA (Compatibilidade - usa cache em memória + persiste assíncrono)
// =============================================================================

/**
 * Adiciona movimentação (síncrono - usa cache local + persiste assíncrono)
 * @param {Object} movimentacao
 * @returns {boolean}
 */
function adicionarMovimentacao(movimentacao) {
  if (!validarMovimentacao(movimentacao)) {
    return false;
  }

  // Adiciona ao cache local imediatamente
  movimentacoes.push(movimentacao);

  // Persiste: se não Supabase (inclui null/fallback), faz sincronicamente; se Supabase, assíncrono
  if (repositorioAtivo !== 'supabase') {
    const repo = getRepo();
    repo.adicionar(movimentacao);
  } else {
    // Persiste assíncrono
    (async () => {
      try {
        const repo = await inicializacaoPromise;
        await repo.adicionar(movimentacao);
        // Recarrega do Supabase para garantir consistência
        if (repositorioAtivo === 'supabase') {
          movimentacoes = await repo.listar();
        }
        dispararAtualizacao(movimentacoes);
      } catch (err) {
        console.error('[Financeiro] Erro ao persistir:', err);
        // Rollback local
        const idx = movimentacoes.findIndex(m => m.id === movimentacao.id);
        if (idx !== -1) movimentacoes.splice(idx, 1);
        dispararAtualizacao(movimentacoes);
      }
    })();
  }

  // Dispara evento imediato com cache local
  dispararAtualizacao(movimentacoes);

  return true;
}

/**
 * Lista movimentações (síncrono - cache local)
 * @returns {Array}
 */
function listarMovimentacoes() {
  return movimentacoes.map(m => ({ ...m }));
}

/**
 * Busca movimentação por ID (síncrono - cache local)
 * @param {string} id
 * @returns {Object|undefined}
 */
function buscarMovimentacaoPorId(id) {
  return movimentacoes.find(m => m.id === id);
}

/**
 * Atualiza movimentação (síncrono - cache local + persiste)
 * @param {string} id
 * @param {Object} dadosAtualizados
 * @returns {boolean}
 */
function atualizarMovimentacao(id, dadosAtualizados) {
  const indice = movimentacoes.findIndex(m => m.id === id);
  if (indice === -1) return false;

  movimentacoes[indice] = { ...dadosAtualizados, id };

  // Persiste: se não Supabase (inclui null/fallback), faz sincronicamente; se Supabase, assíncrono
  if (repositorioAtivo !== 'supabase') {
    const repo = getRepo();
    repo.atualizar(id, dadosAtualizados);
  } else {
    // Persiste assíncrono
    (async () => {
      try {
        const repo = await inicializacaoPromise;
        await repo.atualizar(id, dadosAtualizados);
        if (repositorioAtivo === 'supabase') {
          movimentacoes = await repo.listar();
        }
        dispararAtualizacao(movimentacoes);
      } catch (err) {
        console.error('[Financeiro] Erro ao atualizar:', err);
        dispararAtualizacao(movimentacoes);
      }
    })();
  }

  dispararAtualizacao(movimentacoes);
  return true;
}

/**
 * Exclui movimentação (síncrono - cache local + persiste)
 * @param {string} id
 * @returns {boolean}
 */
function ExcluirMovimentacao(id) {
  const indice = movimentacoes.findIndex(m => m.id === id);
  if (indice === -1) return false;

  movimentacoes.splice(indice, 1);

  // Persiste: se não Supabase (inclui null/fallback), faz sincronicamente; se Supabase, assíncrono
  if (repositorioAtivo !== 'supabase') {
    const repo = getRepo();
    repo.excluir(id);
  } else {
    // Persiste assíncrono
    (async () => {
      try {
        const repo = await inicializacaoPromise;
        await repo.excluir(id);
        if (repositorioAtivo === 'supabase') {
          movimentacoes = await repo.listar();
        }
        dispararAtualizacao(movimentacoes);
      } catch (err) {
        console.error('[Financeiro] Erro ao excluir:', err);
        dispararAtualizacao(movimentacoes);
      }
    })();
  }

  dispararAtualizacao(movimentacoes);
  return true;
}

/**
 * Filtra movimentações por período (síncrono - cache local)
 * @param {string} dataInicial
 * @param {string} dataFinal
 * @returns {Array}
 */
function filtrarMovimentacoesPorPeriodo(dataInicial, dataFinal) {
  return movimentacoes.filter(m => {
    const atendeDataInicial = !dataInicial || m.data >= dataInicial;
    const atendeDataFinal = !dataFinal || m.data <= dataFinal;
    return atendeDataInicial && atendeDataFinal;
  });
}

// =============================================================================
// Validação e Indicadores (Puros - síncronos)
// =============================================================================

function validarMovimentacao(movimentacao) {
  if (!movimentacao || typeof movimentacao !== "object") return false;

  const tiposValidos = ["entrada", "saida"];
  const categoriasValidas = ["atendimento", "material", "outro"];

  if (!tiposValidos.includes(movimentacao.tipo)) return false;

  if (
    typeof movimentacao.valor !== "number" ||
    !Number.isFinite(movimentacao.valor) ||
    movimentacao.valor <= 0
  ) return false;

  if (
    typeof movimentacao.descricao !== "string" ||
    movimentacao.descricao.trim() === ""
  ) return false;

  if (!categoriasValidas.includes(movimentacao.categoria)) return false;

  if (
    typeof movimentacao.data !== "string" ||
    movimentacao.data.trim() === ""
  ) return false;

  return true;
}

function calcularIndicadoresFinanceiros(movimentacoes) {
  let totalEntradas = 0;
  let totalSaidas = 0;
  let totalAtendimentos = 0;
  let quantidadeAtendimentos = 0;

  if (!Array.isArray(movimentacoes)) {
    return { totalEntradas: 0, totalSaidas: 0, saldo: 0, ticketMedio: 0 };
  }

  for (const mov of movimentacoes) {
    if (mov.tipo === "entrada") {
      totalEntradas += mov.valor;
      if (mov.categoria === "atendimento") {
        totalAtendimentos += mov.valor;
        quantidadeAtendimentos++;
      }
    } else if (mov.tipo === "saida") {
      totalSaidas += mov.valor;
    }
  }

  const saldo = totalEntradas - totalSaidas;
  const ticketMedio = quantidadeAtendimentos > 0
    ? totalAtendimentos / quantidadeAtendimentos
    : 0;

  return { totalEntradas, totalSaidas, saldo, ticketMedio };
}

// =============================================================================
// UI - Formulário
// =============================================================================

function configurarFormularioMovimentacao() {
  const formulario = document.querySelector("#form-movimentacao");
  if (!formulario) return;

  formulario.addEventListener("submit", async function (event) {
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

    let ok;

    if (idMovimentacao) {
      ok = await atualizarMovimentacaoAsync(idMovimentacao, movimentacao);
    } else {
      const novaMovimentacao = {
        ...movimentacao,
        id: crypto.randomUUID()
      };
      ok = await adicionarMovimentacaoAsync(novaMovimentacao);
    }

    if (ok) {
      formulario.reset();
      // Limpa campo hidden id
      const campoId = formulario.querySelector("#movimentacao-id");
      if (campoId) campoId.value = "";
    }
  });
}

// =============================================================================
// Inicialização
// =============================================================================

function iniciarAplicacao() {
  // Carrega do localStorage imediatamente como fallback síncrono
  // (será sobrescrito pela inicialização assíncrona se Supabase estiver disponível)
  const dadosSalvos = localStorage.getItem(CHAVE_MOVIMENTACOES);
  if (dadosSalvos !== null) {
    movimentacoes = JSON.parse(dadosSalvos);
  }

  // Aguarda inicialização do repositório (já iniciada lazy)
  inicializacaoPromise.then(() => {
    configurarFormularioMovimentacao();
  }).catch(err => {
    console.error('[Financeiro] Falha na inicialização:', err);
    // Fallback: configura formulário mesmo sem repo
    configurarFormularioMovimentacao();
  });
}

document.addEventListener("DOMContentLoaded", iniciarAplicacao);

// =============================================================================
// Exportação para uso global (scripts clássicos) e testes
// =============================================================================

const apiFinanceiro = {
  // API Síncrona (compatibilidade - cache em memória + persiste assíncrono)
  adicionarMovimentacao,
  listarMovimentacoes,
  buscarMovimentacaoPorId,
  atualizarMovimentacao,
  ExcluirMovimentacao,
  filtrarMovimentacoesPorPeriodo,
  // API Assíncrona
  adicionarMovimentacaoAsync,
  listarMovimentacoesAsync,
  buscarMovimentacaoPorIdAsync,
  atualizarMovimentacaoAsync,
  excluirMovimentacaoAsync,
  filtrarMovimentacoesPorPeriodoAsync,
  // Utilitários
  validarMovimentacao,
  calcularIndicadoresFinanceiros,
  reinicializarRepositorio,
  // Internos (para testes)
  _getCache: () => movimentacoes
};

if (typeof globalThis !== "undefined") {
  globalThis.NailFlow = globalThis.NailFlow || {};
  globalThis.NailFlow.financeiro = apiFinanceiro;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = apiFinanceiro;
}