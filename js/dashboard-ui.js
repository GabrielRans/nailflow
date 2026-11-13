/**
 * UI do Dashboard - NailFlow
 * Usa API assíncrona do módulo financeiro com estados de carregamento
 */

// Formata os indicadores financeiros em reais
const formatarIndicadores = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const estadoDashboard = document.querySelector(".dashboard__estado");
const cardsIndicadores = document.querySelectorAll(".dashboard [data-indicador]");
const alertaReposicaoCard = document.getElementById("alerta-reposicao");
const alertaReposicaoTexto = document.getElementById("alerta-reposicao-texto");

let carregandoDashboard = false;

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

/**
 * Atualiza o card de alerta de reposição no Dashboard
 * @param {Array} materiais - Lista completa de materiais
 */
function renderizarAlertaReposicao(materiais) {
  if (!alertaReposicaoCard || !alertaReposicaoTexto) return;

  const itensReposicao = obterMateriaisParaReposicao(materiais);
  const count = itensReposicao.length;

  if (count === 0) {
    alertaReposicaoCard.hidden = true;
    return;
  }

  // Texto: "1 item precisa de reposição" ou "N itens precisam de reposição"
  const texto = `${count} ${count === 1 ? "item" : "itens"} precisa${count === 1 ? "" : "m"} de reposição`;

  alertaReposicaoTexto.textContent = texto;
  alertaReposicaoCard.hidden = false;
}

/**
 * Mostra/esconde estado de carregamento nos cards
 * @param {boolean} mostrar
 */
function setCarregandoDashboard(mostrar) {
  carregandoDashboard = mostrar;
  cardsIndicadores.forEach(el => {
    if (mostrar) {
      el.dataset.valorOriginal = el.textContent;
      el.textContent = "—";
      el.classList.add("carregando");
    } else {
      el.classList.remove("carregando");
    }
  });
}

/**
 * Obtém o período do mês atual
 * @returns {{dataInicial: string, dataFinal: string}}
 */
function obterPeriodoMesAtual() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const ultimoDia = new Date(ano, hoje.getMonth() + 1, 0).getDate();
    const dataInicial = `${ano}-${mes}-01`;
    const dataFinal = `${ano}-${mes}-${String(ultimoDia).padStart(2, "0")}`;
    return { dataInicial, dataFinal };
}

/**
 * Atualiza os valores exibidos nos cards do Dashboard
 * @param {Array} movimentacoes
 */
function renderizarIndicadoresFinanceiros(movimentacoes) {
    const indicadores = calcularIndicadoresFinanceiros(movimentacoes);

    cardsIndicadores.forEach((elemento) => {
        const chave = elemento.dataset.indicador;
        elemento.textContent = formatarIndicadores.format(indicadores[chave]);
    });

    if (estadoDashboard) {
        const semMovimentacoes = movimentacoes.length === 0;
        estadoDashboard.textContent = semMovimentacoes
            ? "Nenhuma movimentação registrada neste mês."
            : "";
        estadoDashboard.hidden = !semMovimentacoes;
    }
}

/**
 * Carrega e renderiza indicadores do mês atual
 */
async function carregarIndicadores() {
  if (carregandoDashboard) return;
  setCarregandoDashboard(true);

  try {
    const { dataInicial, dataFinal } = obterPeriodoMesAtual();
    const movs = await window.NailFlow.financeiro.filtrarMovimentacoesPorPeriodoAsync(dataInicial, dataFinal);
    renderizarIndicadoresFinanceiros(movs);
  } catch (err) {
    console.error('[Dashboard] Erro ao carregar indicadores:', err);
    // Mostra zeros em caso de erro
    cardsIndicadores.forEach(el => el.textContent = formatarIndicadores.format(0));
    if (estadoDashboard) {
      estadoDashboard.textContent = "Erro ao carregar dados. Tente recarregar.";
      estadoDashboard.hidden = false;
    }
  } finally {
    setCarregandoDashboard(false);
  }
}

// Renderiza os indicadores quando o usuário estiver autenticado E autorizado
function inicializarDashboard() {
  // Se já autenticado e autorizado, carrega imediatamente
  if (window.NailFlow?.auth?.autorizado === true) {
    carregarIndicadores();
    carregarUltimasMovimentacoes();
    carregarAlertaReposicao();
    return;
  }

  // Caso contrário, aguarda o evento auth:login (AuthN + AuthZ OK)
  window.addEventListener('auth:login', async () => {
    await carregarIndicadores();
    await carregarUltimasMovimentacoes();
    await carregarAlertaReposicao();
  }, { once: true });
}

// Atualiza o alerta de reposição quando materiais são alterados
document.addEventListener("materiais:atualizados", async () => {
  await carregarAlertaReposicao();
});

// Limpa o dashboard no logout
window.addEventListener('auth:logout', () => {
  cardsIndicadores.forEach(el => el.textContent = formatarIndicadores.format(0));
  if (estadoDashboard) {
    estadoDashboard.textContent = "";
    estadoDashboard.hidden = true;
  }
  if (alertaReposicaoCard) alertaReposicaoCard.hidden = true;
});

/**
 * Carrega materiais e atualiza o card de alerta de reposição
 */
async function carregarAlertaReposicao() {
  try {
    const api = window.NailFlow?.materiais;
    const fnListar = api?.listarMateriaisAsync || api?.listarMateriais;

    if (typeof fnListar !== "function") {
      // Módulo de materiais não disponível - esconde o card silenciosamente
      if (alertaReposicaoCard) alertaReposicaoCard.hidden = true;
      return;
    }

    const res = await fnListar();
    const materiais = res?.sucesso ? res.dados : (Array.isArray(res) ? res : []);
    renderizarAlertaReposicao(materiais);
  } catch (err) {
    console.error('[Dashboard] Erro ao carregar alerta de reposição:', err);
    // Em caso de erro, esconde o card sem quebrar o resto do dashboard
    if (alertaReposicaoCard) alertaReposicaoCard.hidden = true;
  }
}

/**
 * Formata data para exibição
 * @param {string} data - Data no formato YYYY-MM-DD ou ISO com hora
 * @returns {string} Data formatada DD/MM
 */
function formatarDataCurta(data) {
  if (!data) return '--/--';
  const [, mes, dia] = String(data).split('T')[0].split('-');
  return `${dia}/${mes}`;
}

/**
 * Carrega e renderiza as últimas 5 movimentações no Dashboard
 */
async function carregarUltimasMovimentacoes() {
  const container = document.querySelector('#ultimas-movimentacoes');
  if (!container) return;

  try {
    const movs = await window.NailFlow.financeiro.listarMovimentacoesAsync();

    // Ordena por data decrescente, depois por ID para desempate
    movs.sort((a, b) => {
      const da = a.data ?? '', db = b.data ?? '';
      if (db !== da) return db.localeCompare(da);
      return String(b.id).localeCompare(String(a.id));
    });

    // Pega apenas as 5 primeiras
    const ultimas = movs.slice(0, 5);

    // Limpa o container
    container.innerHTML = '';

    if (ultimas.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 16px;">Nenhuma movimentação recente</p>';
      return;
    }

    // Formata moeda
    const formatadorMoeda = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    // Renderiza cada movimentação
    ultimas.forEach((movimentacao) => {
      const item = document.createElement("li");
      const ehReceita = movimentacao.tipo === "entrada";
      item.className = `item-movimentacao ${ehReceita ? "receita" : "despesa"}`;

      // Link para o financeiro (card clicável)
      const link = document.createElement("a");
      link.href = "#financeiro";
      link.className = "movimentacao-link";
      link.setAttribute("aria-label", `Ver detalhes de ${movimentacao.descricao} no Financeiro`);

      // Ícone circular
      const icone = document.createElement("div");
      icone.className = `icone-movimentacao ${ehReceita ? "receita" : "despesa"}`;
      icone.setAttribute("aria-hidden", "true");
      icone.textContent = ehReceita ? "↑" : "↓";

      // Info principal
      const infoPrincipal = document.createElement("div");
      infoPrincipal.className = "info-principal";

      const descricao = document.createElement("strong");
      descricao.className = "descricao";
      descricao.textContent = movimentacao.descricao;

      const detalhes = document.createElement("span");
      detalhes.className = "detalhes";
      detalhes.textContent = `${movimentacao.categoria} • ${formatarDataCurta(movimentacao.data)}`;

      infoPrincipal.append(descricao, detalhes);

      // Container para valor + seta (permite alinhar à direita no desktop)
      const valorSetaContainer = document.createElement("div");
      valorSetaContainer.className = "valor-seta-container";

      // Valor
      const valor = document.createElement("strong");
      valor.className = `valor ${ehReceita ? "receita" : "despesa"}`;
      valor.textContent = formatadorMoeda.format(movimentacao.valor);

      // Seta/chevron indicando navegação
      const seta = document.createElement("span");
      seta.className = "seta-navegacao";
      seta.setAttribute("aria-hidden", "true");
      seta.textContent = ">";

      valorSetaContainer.append(valor, seta);
      link.append(icone, infoPrincipal, valorSetaContainer);
      item.append(link);
      container.append(item);
    });
  } catch (err) {
    console.error('[Dashboard] Erro ao carregar últimas movimentações:', err);
    container.innerHTML = '<p style="color: var(--error-text); text-align: center; padding: 16px;">Erro ao carregar movimentações</p>';
  }
}

// Inicializa no DOMContentLoaded
document.addEventListener("DOMContentLoaded", inicializarDashboard);

// Atualiza os indicadores quando uma movimentação é cadastrada, editada ou excluída
document.addEventListener("movimentacoes:atualizadas", async (event) => {
  if (!carregandoDashboard) {
    // Usa dados do evento (cache local síncrono) para resposta imediata
    const { dataInicial, dataFinal } = obterPeriodoMesAtual();
    const movsFiltradas = event.detail.filter(m => {
      const atendeInicial = !dataInicial || m.data >= dataInicial;
      const atendeFinal = !dataFinal || m.data <= dataFinal;
      return atendeInicial && atendeFinal;
    });
    renderizarIndicadoresFinanceiros(movsFiltradas);
    // Atualiza também a lista das últimas movimentações
    await carregarUltimasMovimentacoes();
  }
});