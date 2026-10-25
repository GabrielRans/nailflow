//Formata os indicadores financeiros em reais
const formatarIndicadores = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

function obterMovimentacoesDoMesAtual() {
    const hoje = new Date();

    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");

    const UltimoDia = new Date(
        ano,
        hoje.getMonth() + 1,
        0
    ).getDate();

    const dataInicial = `${ano}-${mes}-01`;
    const dataFinal = `${ano}-${mes}-${String(UltimoDia).padStart(2, "0")}`;

    return filtrarMovimentacoesPorPeriodo(dataInicial, dataFinal);
}

//Atualiza os valores exibidos nos cards do Dashboard
function renderizarIndicadoresFinanceiros(movimentacoes) {
    const indicadores = calcularIndicadoresFinanceiros(movimentacoes);

    const elementos = document.querySelectorAll(
        ".dashboard [data-indicador]"
    );

    elementos.forEach((elemento) => {
        const chave = elemento.dataset.indicador;

        elemento.textContent = formatarIndicadores.format(
            indicadores[chave]
        );
    });

    const estadoDashboard = document.querySelector(".dashboard__estado");

    if (estadoDashboard) {
        const semMovimentacoes = movimentacoes.length === 0;
        estadoDashboard.textContent =  semMovimentacoes
        ? "Nenhuma movimentação registrada neste mês."
        : "";

        estadoDashboard.hidden = !semMovimentacoes;
    }
}

//Renderiza os indicadores após o carregamento das movimentações
document.addEventListener("DOMContentLoaded", () =>{
    renderizarIndicadoresFinanceiros(obterMovimentacoesDoMesAtual());
});

//Atualiza os indicadores quando uma movimentação é cadastrada, editada ou excluida...
document.addEventListener("movimentacoes:atualizadas", (event) => {
    renderizarIndicadoresFinanceiros(obterMovimentacoesDoMesAtual());
});
