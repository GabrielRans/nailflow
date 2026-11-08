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

let carregandoDashboard = false;

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
    return;
  }

  // Caso contrário, aguarda o evento auth:login (AuthN + AuthZ OK)
  window.addEventListener('auth:login', async () => {
    await carregarIndicadores();
  }, { once: true });
}

// Limpa o dashboard no logout
window.addEventListener('auth:logout', () => {
  cardsIndicadores.forEach(el => el.textContent = formatarIndicadores.format(0));
  if (estadoDashboard) {
    estadoDashboard.textContent = "";
    estadoDashboard.hidden = true;
  }
});

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
  }
});