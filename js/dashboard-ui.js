/**
 * UI do Dashboard - NailFlow
 * Usa API assíncrona do módulo financeiro com estados de carregamento
 * Alinhado ao Design System Modelo B e aos critérios da Issue #25
 */

// Formata os indicadores financeiros em reais
const formatarIndicadores = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

const cardsIndicadores = typeof document !== "undefined"
  ? document.querySelectorAll(".dashboard [data-indicador]")
  : [];
const alertaReposicaoCard = typeof document !== "undefined"
  ? document.getElementById("alerta-reposicao")
  : null;
const alertaReposicaoTexto = typeof document !== "undefined"
  ? document.getElementById("alerta-reposicao-texto")
  : null;

let carregandoDashboard = false;

/**
 * Obtém elemento do estado contextual do Dashboard
 * @returns {HTMLElement | null}
 */
function obterElementoEstadoDashboard() {
  if (typeof document === "undefined") return null;
  return document.getElementById("dashboard-estado") || document.querySelector(".dashboard__estado");
}

/**
 * Determina a classificação semântica do saldo
 * @param {number|string} valor
 * @returns {'positivo' | 'negativo' | 'neutro'}
 */
function determinarEstadoSaldo(valor) {
  const n = Number(valor);
  if (Number.isNaN(n) || n === 0) return "neutro";
  return n > 0 ? "positivo" : "negativo";
}

/**
 * Retorna rótulo acessível completo para leitura de tela dos indicadores
 * @param {string} chave - Chave do indicador
 * @param {string} valorFormatado - Valor monetário formatado
 * @param {'positivo' | 'negativo' | 'neutro'} [estadoSaldo]
 * @returns {string}
 */
function obterTextoAcessivelIndicador(chave, valorFormatado, estadoSaldo) {
  switch (chave) {
    case "saldo": {
      const sufixo = estadoSaldo === "positivo"
        ? "(saldo positivo)"
        : estadoSaldo === "negativo"
        ? "(saldo negativo)"
        : "(saldo zerado)";
      return `Resultado: ${valorFormatado} ${sufixo}`;
    }
    case "totalEntradas":
      return `Total de entradas: ${valorFormatado}`;
    case "totalSaidas":
      return `Total de saídas: ${valorFormatado}`;
    case "ticketMedio":
      return `Ticket médio: ${valorFormatado}`;
    default:
      return `${chave}: ${valorFormatado}`;
  }
}

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

  // Texto: "1 material precisa de reposição" ou "N materiais precisam de reposição"
  const texto = `${count} ${count === 1 ? "material precisa" : "materiais precisam"} de reposição`;

  alertaReposicaoTexto.textContent = texto;
  alertaReposicaoCard.hidden = false;
}

/**
 * Mostra/esconde estado de carregamento nos cards
 * @param {boolean} mostrar
 */
function setCarregandoDashboard(mostrar) {
  carregandoDashboard = mostrar;
  const cards = typeof document !== "undefined"
    ? document.querySelectorAll(".dashboard [data-indicador]")
    : [];
  cards.forEach(el => {
    if (mostrar) {
      el.dataset.valorOriginal = el.textContent;
      el.textContent = "—";
      el.classList.add("carregando");
    } else {
      el.classList.remove("carregando");
    }
  });

  if (mostrar) {
    const estadoEl = obterElementoEstadoDashboard();
    if (estadoEl && !estadoEl.classList.contains("dashboard__estado--erro")) {
      estadoEl.hidden = true;
    }
  }
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
    const listaMovs = Array.isArray(movimentacoes) ? movimentacoes : [];
    const estadoSaldo = determinarEstadoSaldo(indicadores.saldo);

    const cards = typeof document !== "undefined"
      ? document.querySelectorAll(".dashboard [data-indicador]")
      : [];
    cards.forEach((elemento) => {
        const chave = elemento.dataset.indicador;
        const valorFormatado = formatarIndicadores.format(indicadores[chave] ?? 0);
        elemento.textContent = valorFormatado;

        const textoAcessivel = obterTextoAcessivelIndicador(chave, valorFormatado, estadoSaldo);
        elemento.setAttribute("aria-label", textoAcessivel);
    });

    // Atualiza estado do card de saldo e badge semântico (WCAG AA - não depender só de cores)
    const cardSaldo = typeof document !== "undefined"
      ? (document.getElementById("card-indicador-saldo") || document.querySelector(".card-indicador--saldo"))
      : null;
    const badgeSaldo = typeof document !== "undefined"
      ? (document.getElementById("badge-saldo") || cardSaldo?.querySelector(".badge-saldo"))
      : null;

    if (cardSaldo) {
        cardSaldo.classList.remove("card-indicador--saldo-positivo", "card-indicador--saldo-negativo", "card-indicador--saldo-neutro");
        cardSaldo.classList.add(`card-indicador--saldo-${estadoSaldo}`);
    }

    if (badgeSaldo) {
        badgeSaldo.className = `badge-saldo badge-saldo--${estadoSaldo}`;
        if (estadoSaldo === "positivo") {
            badgeSaldo.textContent = "+ Positivo";
            badgeSaldo.hidden = false;
        } else if (estadoSaldo === "negativo") {
            badgeSaldo.textContent = "− Negativo";
            badgeSaldo.hidden = false;
        } else {
            badgeSaldo.textContent = "Neutro";
            badgeSaldo.hidden = false;
        }
    }

    const estadoEl = obterElementoEstadoDashboard();
    if (estadoEl) {
        const semMovimentacoes = listaMovs.length === 0;
        if (semMovimentacoes) {
            estadoEl.className = "dashboard__estado dashboard__estado--vazio";
            estadoEl.innerHTML = `
              <div class="dashboard__estado-conteudo">
                <div class="dashboard__estado-icone" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                  </svg>
                </div>
                <div class="dashboard__estado-texto">
                  <strong>Nenhuma movimentação neste mês</strong>
                  <p>Cadastre suas receitas e despesas para acompanhar o desempenho do seu estúdio.</p>
                </div>
              </div>
            `;
            estadoEl.hidden = false;
        } else {
            estadoEl.hidden = true;
            estadoEl.innerHTML = "";
        }
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
    const cards = typeof document !== "undefined"
      ? document.querySelectorAll(".dashboard [data-indicador]")
      : [];
    cards.forEach(el => {
      el.textContent = formatarIndicadores.format(0);
      el.removeAttribute("aria-label");
    });

    const cardSaldo = typeof document !== "undefined"
      ? (document.getElementById("card-indicador-saldo") || document.querySelector(".card-indicador--saldo"))
      : null;
    const badgeSaldo = typeof document !== "undefined"
      ? (document.getElementById("badge-saldo") || cardSaldo?.querySelector(".badge-saldo"))
      : null;
    if (cardSaldo) {
      cardSaldo.classList.remove("card-indicador--saldo-positivo", "card-indicador--saldo-negativo", "card-indicador--saldo-neutro");
    }
    if (badgeSaldo) {
      badgeSaldo.hidden = true;
    }

    const estadoEl = obterElementoEstadoDashboard();
    if (estadoEl) {
      estadoEl.className = "dashboard__estado dashboard__estado--erro";
      estadoEl.innerHTML = `
        <div class="dashboard__estado-conteudo">
          <div class="dashboard__estado-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
              <line x1="12" y1="9" x2="12" y2="13"></line>
              <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>
          </div>
          <div class="dashboard__estado-texto">
            <strong>Não foi possível carregar os dados</strong>
            <p>Verifique sua conexão ou tente novamente.</p>
          </div>
          <button type="button" class="btn-dashboard-recarregar" id="btn-recarregar-dashboard">Tentar novamente</button>
        </div>
      `;
      estadoEl.hidden = false;
      const btnRetry = document.getElementById("btn-recarregar-dashboard");
      if (btnRetry) {
        btnRetry.addEventListener("click", () => carregarIndicadores(), { once: true });
      }
    }
  } finally {
    setCarregandoDashboard(false);
  }
}

// Renderiza os indicadores quando o usuário estiver autenticado E autorizado
function inicializarDashboard() {
  if (typeof window === "undefined") return;
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
if (typeof document !== "undefined") {
  document.addEventListener("materiais:atualizados", async () => {
    await carregarAlertaReposicao();
  });
}

// Limpa o dashboard no logout
if (typeof window !== "undefined") {
  window.addEventListener('auth:logout', () => {
    const cards = typeof document !== "undefined" ? document.querySelectorAll(".dashboard [data-indicador]") : [];
    cards.forEach(el => {
      el.textContent = formatarIndicadores.format(0);
      el.removeAttribute("aria-label");
    });
    const cardSaldo = typeof document !== "undefined" ? (document.getElementById("card-indicador-saldo") || document.querySelector(".card-indicador--saldo")) : null;
    if (cardSaldo) {
      cardSaldo.classList.remove("card-indicador--saldo-positivo", "card-indicador--saldo-negativo", "card-indicador--saldo-neutro");
    }
    const badgeSaldo = typeof document !== "undefined" ? document.getElementById("badge-saldo") : null;
    if (badgeSaldo) {
      badgeSaldo.hidden = true;
    }
    const estadoEl = obterElementoEstadoDashboard();
    if (estadoEl) {
      estadoEl.textContent = "";
      estadoEl.innerHTML = "";
      estadoEl.hidden = true;
    }
    if (alertaReposicaoCard) alertaReposicaoCard.hidden = true;
  });
}

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
  const container = typeof document !== "undefined" ? document.querySelector('#ultimas-movimentacoes') : null;
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
if (typeof document !== "undefined") {
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
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    obterMateriaisParaReposicao,
    determinarEstadoSaldo,
    obterTextoAcessivelIndicador,
    formatarDataCurta,
  };
}
