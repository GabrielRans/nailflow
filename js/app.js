/**
 * Módulo Financeiro - NailFlow
 * API assíncrona Supabase (produção) + Repositório in-memory (testes)
 * localStorage NÃO é usado automaticamente em produção - apenas para testes via injeção de dependência
 */

const CHAVE_MOVIMENTACOES = "nailflow_movimentacoes";

// Estado interno
let movimentacoes = [];
let repositorioAtivo = null; // 'supabase' | 'memory' | null
let repoSupabase = null;
let repoMemory = null;
let inicializacaoPromise = null;

// =============================================================================
// Repositório em Memória (para testes) - Síncrono
// =============================================================================

function criarRepositorioMemoria() {
  const dados = [];
  return {
    tipo: 'memory',
    salvar(todas) { dados.length = 0; dados.push(...todas); },
    listar() { return [...dados]; },
    buscarPorId(id) { return dados.find(m => m.id === id) ?? null; },
    adicionar(movimentacao) { dados.push(movimentacao); return movimentacao; },
    atualizar(id, dadosAtualizados) {
      const idx = dados.findIndex(m => m.id === id);
      if (idx === -1) return false;
      dados[idx] = { ...dadosAtualizados, id };
      return true;
    },
    excluir(id) {
      const idx = dados.findIndex(m => m.id === id);
      if (idx === -1) return false;
      dados.splice(idx, 1);
      return true;
    },
    filtrarPorPeriodo(dataInicial, dataFinal) {
      return dados.filter(m => {
        const atendeInicial = !dataInicial || m.data >= dataInicial;
        const atendeFinal = !dataFinal || m.data <= dataFinal;
        return atendeInicial && atendeFinal;
      });
    },
    // Para testes: permite injetar dados iniciais
    _setDados(novosDados) { dados.length = 0; dados.push(...novosDados); },
    _getDados() { return [...dados]; }
  };
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
 * Inicializa o repositório Supabase (produção)
 * FALHA se não conseguir criar o repositório - NÃO faz fallback automático para localStorage
 * @returns {Promise<Object>} Repositório Supabase
 */
async function inicializarRepositorioSupabase() {
  if (repositorioAtivo === 'supabase' && repoSupabase) return repoSupabase;

  const tentarCriar = await carregarRepoSupabase();
  if (!tentarCriar) {
    throw new Error('Módulo do repositório Supabase não disponível');
  }

  repoSupabase = await tentarCriar();
  // tentarCriar agora lança erro em vez de retornar null se não autenticado/autorizado

  repositorioAtivo = 'supabase';
  // Carregar dados do Supabase para cache local
  movimentacoes = await repoSupabase.listar();
  return repoSupabase;
}

/**
 * Inicializa repositório em memória (para testes)
 * @returns {Object} Repositório em memória
 */
function inicializarRepositorioMemoria(dadosIniciais = []) {
  repoMemory = criarRepositorioMemoria();
  repoMemory._setDados(dadosIniciais);
  repositorioAtivo = 'memory';
  movimentacoes = repoMemory.listar();
  return repoMemory;
}

/**
 * Obtém o repositório ativo atual
 * @returns {Object|null}
 */
function getRepo() {
  if (repositorioAtivo === 'supabase') return repoSupabase;
  if (repositorioAtivo === 'memory') return repoMemory;
  return null;
}

/**
 * Força reinicialização do repositório (útil após login/logout)
 * Em produção: reinicializa Supabase
 * Em testes: mantém repositório em memória se já existir
 */
async function reinicializarRepositorio() {
  if (repositorioAtivo === 'memory' && repoMemory) {
    // Em testes, mantém o repositório em memória
    movimentacoes = repoMemory.listar();
    return repoMemory;
  }

  repositorioAtivo = null;
  repoSupabase = null;
  inicializacaoPromise = null;
  movimentacoes = [];
  return await obterRepositorio();
}

/**
 * Define repositório ativo explicitamente (para testes)
 * @param {Object} repo - Repositório a usar
 */
function _setRepositorioParaTeste(repo) {
  repoSupabase = null;
  repoMemory = repo;
  repositorioAtivo = 'memory';
  movimentacoes = repo.listar();
  // Cancela qualquer inicialização pendente do Supabase
  inicializacaoPromise = null;
}

/**
 * Inicialização preguiçosa (lazy) - só inicializa na primeira chamada da API assíncrona
 * @returns {Promise<Object>} Repositório ativo
 */
async function obterRepositorio() {
  // Se já tem repositório de memória (testes), usa ele
  if (repositorioAtivo === 'memory' && repoMemory) {
    return repoMemory;
  }

  // Se já tem repositório Supabase, usa ele
  if (repositorioAtivo === 'supabase' && repoSupabase) {
    return repoSupabase;
  }

  // Se já está inicializando, aguarda
  if (inicializacaoPromise) {
    return await inicializacaoPromise;
  }

  // Inicializa Supabase (apenas na primeira chamada)
  inicializacaoPromise = inicializarRepositorioSupabase().catch(err => {
    console.error('[Financeiro] Falha ao inicializar Supabase:', err.message);
    inicializacaoPromise = null; // Permite retry
    throw err;
  });

  return await inicializacaoPromise;
}

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
// API ASSÍNCRONA (Produção - usa repositório Supabase diretamente)
// =============================================================================

/**
 * Adiciona movimentação (assíncrono - direto no repositório Supabase)
 * @param {Object} movimentacao
 * @returns {Promise<boolean>}
 */
async function adicionarMovimentacaoAsync(movimentacao) {
  if (!validarMovimentacao(movimentacao)) return false;
  try {
    const repo = await obterRepositorio();
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
 * Lista movimentações (assíncrono - direto do repositório Supabase)
 * @returns {Promise<Array>}
 */
async function listarMovimentacoesAsync() {
  const repo = await obterRepositorio();
  movimentacoes = await repo.listar();
  return [...movimentacoes];
}

/**
 * Busca movimentação por ID (assíncrono - direto do repositório Supabase)
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
async function buscarMovimentacaoPorIdAsync(id) {
  const repo = await obterRepositorio();
  return await repo.buscarPorId(id);
}

/**
 * Atualiza movimentação (assíncrono - direto no repositório Supabase)
 * @param {string} id
 * @param {Object} dadosAtualizados
 * @returns {Promise<boolean>}
 */
async function atualizarMovimentacaoAsync(id, dadosAtualizados) {
  try {
    const repo = await obterRepositorio();
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
 * Exclui movimentação (assíncrono - direto no repositório Supabase)
 * @param {string} id
 * @returns {Promise<boolean>}
 */
async function excluirMovimentacaoAsync(id) {
  try {
    const repo = await obterRepositorio();
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
 * Filtra movimentações por período (assíncrono - direto do repositório Supabase)
 * @param {string} dataInicial
 * @param {string} dataFinal
 * @returns {Promise<Array>}
 */
async function filtrarMovimentacoesPorPeriodoAsync(dataInicial, dataFinal) {
  const repo = await obterRepositorio();
  return await repo.filtrarPorPeriodo(dataInicial, dataFinal);
}

// =============================================================================
// API SÍNCRONA (Apenas para testes - usa repositório em memória injetado)
// =============================================================================
// NOTA: Em produção, repositorioAtivo === 'supabase' e estas funções NÃO funcionam
//       Elas só funcionam quando _setRepositorioParaTeste() injetou um repo de memória

/**
 * Adiciona movimentação (síncrono - apenas para testes com repo em memória)
 * @param {Object} movimentacao
 * @returns {boolean}
 */
function adicionarMovimentacao(movimentacao) {
  if (!validarMovimentacao(movimentacao)) {
    return false;
  }

  const repo = getRepo();
  if (!repo || repositorioAtivo !== 'memory') {
    console.warn('[Financeiro] API síncrona disponível apenas para testes (repo em memória)');
    return false;
  }

  repo.adicionar(movimentacao);
  movimentacoes = repo.listar();
  dispararAtualizacao(movimentacoes);
  return true;
}

/**
 * Lista movimentações (síncrono - apenas para testes com repo em memória)
 * @returns {Array}
 */
function listarMovimentacoes() {
  const repo = getRepo();
  if (!repo || repositorioAtivo !== 'memory') {
    console.warn('[Financeiro] API síncrona disponível apenas para testes (repo em memória)');
    return [];
  }
  return repo.listar();
}

/**
 * Busca movimentação por ID (síncrono - apenas para testes com repo em memória)
 * @param {string} id
 * @returns {Object|undefined}
 */
function buscarMovimentacaoPorId(id) {
  const repo = getRepo();
  if (!repo || repositorioAtivo !== 'memory') {
    console.warn('[Financeiro] API síncrona disponível apenas para testes (repo em memória)');
    return undefined;
  }
  return repo.buscarPorId(id);
}

/**
 * Atualiza movimentação (síncrono - apenas para testes com repo em memória)
 * @param {string} id
 * @param {Object} dadosAtualizados
 * @returns {boolean}
 */
function atualizarMovimentacao(id, dadosAtualizados) {
  const repo = getRepo();
  if (!repo || repositorioAtivo !== 'memory') {
    console.warn('[Financeiro] API síncrona disponível apenas para testes (repo em memória)');
    return false;
  }

  const ok = repo.atualizar(id, dadosAtualizados);
  if (ok) {
    movimentacoes = repo.listar();
    dispararAtualizacao(movimentacoes);
  }
  return ok;
}

/**
 * Exclui movimentação (síncrono - apenas para testes com repo em memória)
 * @param {string} id
 * @returns {boolean}
 */
function excluirMovimentacao(id) {
  const repo = getRepo();
  if (!repo || repositorioAtivo !== 'memory') {
    console.warn('[Financeiro] API síncrona disponível apenas para testes (repo em memória)');
    return false;
  }

  const ok = repo.excluir(id);
  if (ok) {
    movimentacoes = repo.listar();
    dispararAtualizacao(movimentacoes);
  }
  return ok;
}

/**
 * Filtra movimentações por período (síncrono - apenas para testes com repo em memória)
 * @param {string} dataInicial
 * @param {string} dataFinal
 * @returns {Array}
 */
function filtrarMovimentacoesPorPeriodo(dataInicial, dataFinal) {
  const repo = getRepo();
  if (!repo || repositorioAtivo !== 'memory') {
    console.warn('[Financeiro] API síncrona disponível apenas para testes (repo em memória)');
    return [];
  }
  return repo.filtrarPorPeriodo(dataInicial, dataFinal);
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
  // Em produção: NÃO inicializa o repositório automaticamente
  // A inicialização é preguiçosa (lazy) - acontece na primeira chamada da API assíncrona
  // Isso evita erros de inicialização durante carregamento da página

  // Apenas configura o formulário - a inicialização do repositório
  // acontecerá quando o usuário interagir (adicionar, listar, etc.)
  configurarFormularioMovimentacao();
}

document.addEventListener("DOMContentLoaded", iniciarAplicacao);

// =============================================================================
// Exportação para uso global (scripts clássicos) e testes
// =============================================================================

const apiFinanceiro = {
  // API Assíncrona (Produção - Supabase)
  adicionarMovimentacaoAsync,
  listarMovimentacoesAsync,
  buscarMovimentacaoPorIdAsync,
  atualizarMovimentacaoAsync,
  excluirMovimentacaoAsync,
  filtrarMovimentacoesPorPeriodoAsync,

  // API Síncrona (Apenas Testes - requer _setRepositorioParaTeste)
  adicionarMovimentacao,
  listarMovimentacoes,
  buscarMovimentacaoPorId,
  atualizarMovimentacao,
  excluirMovimentacao,
  filtrarMovimentacoesPorPeriodo,

  // Utilitários
  validarMovimentacao,
  calcularIndicadoresFinanceiros,
  reinicializarRepositorio,

  // Internos (para testes)
  _getCache: () => movimentacoes,
  _setRepositorioParaTeste,
  _inicializarRepositorioMemoria: inicializarRepositorioMemoria,
  _getRepositorioAtivo: () => repositorioAtivo
};

if (typeof globalThis !== "undefined") {
  globalThis.NailFlow = globalThis.NailFlow || {};
  globalThis.NailFlow.financeiro = apiFinanceiro;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = apiFinanceiro;
}