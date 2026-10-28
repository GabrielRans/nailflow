const ROTAS_VALIDAS = new Set([
    "dashboard",
    "financeiro",
    "movimentacao",
    "materiais",
    "cadastro-material"
]);

let focoEdicaoPendente = false;
let botaoOrigemEdicao = null;
let rotaAnterior = null;

function obterRotaAtual() {
    const rota = window.location.hash.slice(1);

    return ROTAS_VALIDAS.has(rota)
        ? rota
        : "dashboard";
}

function exibirTela(rota) {
    const telas = document.querySelectorAll("[data-tela]");

    telas.forEach((tela) => {
        tela.hidden = tela.dataset.tela !== rota;
    });
}

function atualizarNavegacao(gerenciarFocoAtivo = true) {
    const rota = obterRotaAtual();

    exibirTela(rota);

    const areaPrincipal = {
        movimentacao: "financeiro",
        "cadastro-material": "materiais"
    }[rota] ?? rota;

    document.querySelectorAll("[data-rota]").forEach((link) => {
        if (link.dataset.rota === areaPrincipal) {
            link.setAttribute("aria-current", "page");
        } else {
            link.removeAttribute("aria-current");
        }
    });

    const modoEdicao =
        rota === "movimentacao" && focoEdicaoPendente;

    const retornandoDaEdicao =
        rotaAnterior === "movimentacao" &&
        rota === "financeiro" &&
        botaoOrigemEdicao !== null;

    const origemDisponivel =
        retornandoDaEdicao &&
        botaoOrigemEdicao.isConnected &&
        !botaoOrigemEdicao.disabled;

    focoEdicaoPendente = false;

    if (gerenciarFocoAtivo) {
        if (origemDisponivel) {
            botaoOrigemEdicao.focus();
            botaoOrigemEdicao.scrollIntoView({
                behavior: "auto",
                block: "nearest"
            });
        }  else {
            gerenciarFoco(rota, modoEdicao);
        }
    }

    if (retornandoDaEdicao || rota !== "movimentacao") {
        botaoOrigemEdicao = null;
    }

    rotaAnterior = rota;
}

function navegarParaEdicao(botaoOrigem) {
    botaoOrigemEdicao = botaoOrigem;
    focoEdicaoPendente = true;

    if (window.location.hash !== "#movimentacao") {
        window.location.hash = "#movimentacao";
    } else {
        atualizarNavegacao();
    }
}

function gerenciarFoco(rota, modoEdicao = false) {
    const tela = document.querySelector(`[data-tela="${rota}"]`);

    if (!tela) return;

    const destino = modoEdicao
        ? tela.querySelector("#tipo")
        : tela.querySelector("h2");

    destino?.focus();

    tela.scrollIntoView({
        behavior: "auto",
        block: "start"
    });
}

window.addEventListener("hashchange", atualizarNavegacao);

document.addEventListener("DOMContentLoaded", () => {

    atualizarNavegacao(false);
});
