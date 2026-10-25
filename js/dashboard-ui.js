//Formata os indicadores financeiros em reais
const formatarIndicadores = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
});

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
        ? "Nenhuma movimentação cadastrada. Registre uma entrada ou saída para começar."
        : "";

        estadoDashboard.hidden = !semMovimentacoes;
    }
}

//Renderiza os indicadores após o carregamento das movimentações
document.addEventListener("DOMContentLoaded", () =>{
    renderizarIndicadoresFinanceiros(listarMovimentacoes());
});

//Atualiza os indicadores quando uma movimentação é cadastrada, editada ou excluida...
document.addEventListener("movimentacoes:atualizadas", (event) => {
    renderizarIndicadoresFinanceiros(event.detail);
});
