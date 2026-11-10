const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const codigoMateriaisUI = fs.readFileSync("js/materiais-ui.js", "utf8");

function criarAmbienteDOM() {
  const elementos = new Map();
  const eventListeners = new Map();

  function criarElemento(tag, id = "", className = "") {
    const el = {
      tagName: tag.toUpperCase(),
      id,
      className,
      hidden: false,
      textContent: "",
      innerHTML: "",
      value: "",
      dataset: {},
      attributes: {},
      children: [],
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k] ?? null; },
      removeAttribute(k) { delete this.attributes[k]; },
      focus() { this._focused = true; },
      reset() {
        if (this.elements) {
          Object.values(this.elements).forEach(elem => { if (elem.value !== undefined) elem.value = ""; });
        }
      },
      appendChild(child) {
        this.children.push(child);
      },
      querySelectorAll(selector) {
        if (selector === ".form-erro-campo") {
          return [
            elementos.get("material-nome-erro"),
            elementos.get("material-qtd-disponivel-erro"),
            elementos.get("material-qtd-minima-erro"),
            elementos.get("material-unidade-erro")
          ].filter(Boolean);
        }
        return [];
      },
      querySelector(selector) {
        if (selector === ".btn-submit-material") return elementos.get("btn-submit-material");
        if (selector === ".material-card__ajuste") {
          if (!this._formAjuste) {
            this._formAjuste = criarElemento("form", "", "material-card__ajuste");
            this._formAjuste._inputAjuste = criarElemento("input", "", "material-card__ajuste-campo");
            this._formAjuste._btnAjuste = criarElemento("button", "", "material-card__btn-atualizar");
            this._formAjuste.querySelector = (sel) => {
              if (sel === ".material-card__ajuste-campo") return this._formAjuste._inputAjuste;
              if (sel === ".material-card__btn-atualizar") return this._formAjuste._btnAjuste;
              return null;
            };
          }
          return this._formAjuste;
        }
        if (selector === ".material-card__ajuste-campo") return this._inputAjuste;
        if (selector === ".material-card__btn-atualizar") return this._btnAjuste;
        return null;
      },
      _listeners: {},
      addEventListener(type, cb) {
        this._listeners[type] = this._listeners[type] || [];
        this._listeners[type].push(cb);
      },
      dispatchEvent(event) {
        if (this._listeners[event.type]) {
          this._listeners[event.type].forEach(cb => cb(event));
        }
      }
    };
    if (id) elementos.set(id, el);
    return el;
  }

  // Prepara estrutura básica do DOM para materiais
  const listaMateriais = criarElemento("ul", "lista-materiais");
  const materiaisVazio = criarElemento("div", "materiais-vazio");
  const materiaisLoading = criarElemento("div", "materiais-loading");
  const materiaisFeedback = criarElemento("div", "materiais-feedback");

  const formMaterial = criarElemento("form", "form-material");
  const inputNome = criarElemento("input", "material-nome");
  const inputNomeErro = criarElemento("span", "material-nome-erro", "form-erro-campo");
  const inputQtdDisp = criarElemento("input", "material-qtd-disponivel");
  const inputQtdDispErro = criarElemento("span", "material-qtd-disponivel-erro", "form-erro-campo");
  const selectUnidade = criarElemento("select", "material-unidade");
  const selectUnidadeErro = criarElemento("span", "material-unidade-erro", "form-erro-campo");
  const inputQtdMin = criarElemento("input", "material-qtd-minima");
  const inputQtdMinErro = criarElemento("span", "material-qtd-minima-erro", "form-erro-campo");
  const btnSubmit = criarElemento("button", "btn-submit-material");
  const feedbackErro = criarElemento("div", "form-material-erro");

  formMaterial.elements = {
    nome: inputNome,
    quantidadeDisponivel: inputQtdDisp,
    unidade: selectUnidade,
    quantidadeMinima: inputQtdMin
  };

  const documentMock = {
    getElementById(id) {
      return elementos.get(id) || null;
    },
    createElement(tag) {
      return criarElemento(tag);
    },
    addEventListener(type, cb) {
      const list = eventListeners.get(type) || [];
      list.push(cb);
      eventListeners.set(type, list);
    },
    dispatchEvent(event) {
      const list = eventListeners.get(event.type) || [];
      list.forEach(cb => cb(event));
    }
  };

  const windowMock = {
    location: { hash: "#materiais" },
    addEventListener(type, cb) {
      const list = eventListeners.get(`window:${type}`) || [];
      list.push(cb);
      eventListeners.set(`window:${type}`, list);
    },
    dispatchEvent(event) {
      const list = eventListeners.get(`window:${event.type}`) || [];
      list.forEach(cb => cb(event));
    },
    NailFlow: {
      materiais: {}
    }
  };

  const context = vm.createContext({
    console,
    setTimeout: (fn) => fn(),
    Number,
    isNaN,
    Array,
    String,
    document: documentMock,
    window: windowMock,
    CustomEvent: class CustomEvent {
      constructor(type, detail) {
        this.type = type;
        this.detail = detail;
      }
    }
  });

  return { context, elementos, windowMock, documentMock };
}

describe("Interface de Materiais (materiais-ui.js)", () => {
  it("escapa caracteres especiais para prevenir XSS", () => {
    const { context } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const escaparHtml = vm.runInContext("escaparHtml", context);
    assert.equal(escaparHtml("<script>alert('xss')</script>"), "&lt;script&gt;alert(&#039;xss&#039;)&lt;/script&gt;");
    assert.equal(escaparHtml('item "especial" & barato'), "item &quot;especial&quot; &amp; barato");
    assert.equal(escaparHtml(null), "");
    assert.equal(escaparHtml(undefined), "");
  });

  it("renderiza estado vazio quando a lista estiver vazia", () => {
    const { context, elementos } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const renderizarLista = vm.runInContext("renderizarListaMateriais", context);
    renderizarLista([]);

    assert.equal(elementos.get("materiais-vazio").hidden, false);
    assert.equal(elementos.get("lista-materiais").hidden, true);
  });

  it("renderiza cards com badge de reposição quando disponível <= mínimo", () => {
    const { context, elementos } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const renderizarLista = vm.runInContext("renderizarListaMateriais", context);
    const mockMateriais = [
      {
        id: "mat-1",
        nome: "Gel Construtor Pink",
        quantidadeDisponivel: 2,
        quantidadeMinima: 5,
        unidade: "unidades"
      },
      {
        id: "mat-2",
        nome: "Top Coat Fosco",
        quantidadeDisponivel: 10,
        quantidadeMinima: 3,
        unidade: "unidades"
      }
    ];

    renderizarLista(mockMateriais);

    assert.equal(elementos.get("materiais-vazio").hidden, true);
    assert.equal(elementos.get("lista-materiais").hidden, false);
    assert.equal(elementos.get("lista-materiais").children.length, 2);

    const card1 = elementos.get("lista-materiais").children[0];
    assert.match(card1.className, /material-card--alerta-reposicao/);
    assert.match(card1.innerHTML, /badge-reposicao/);

    const card2 = elementos.get("lista-materiais").children[1];
    assert.doesNotMatch(card2.className, /material-card--alerta-reposicao/);
    assert.doesNotMatch(card2.innerHTML, /badge-reposicao/);
  });

  it("valida formulário na ordem contratual (Nome -> Qtd Disp -> Qtd Min -> Unidade)", async () => {
    const { context, elementos } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const configurarForm = vm.runInContext("configurarFormularioCadastroMaterial", context);
    configurarForm();

    const form = elementos.get("form-material");
    const inputNome = elementos.get("material-nome");
    const inputQtdDisp = elementos.get("material-qtd-disponivel");
    const inputQtdMin = elementos.get("material-qtd-minima");
    const selectUnidade = elementos.get("material-unidade");

    // 1. Testa Nome vazio
    inputNome.value = "";
    form._listeners["submit"][0]({ preventDefault: () => {} });
    assert.equal(elementos.get("material-nome-erro").hidden, false);
    assert.equal(elementos.get("material-nome-erro").textContent, "O nome do material é obrigatório.");

    // 2. Preenche Nome, testa Qtd Disponivel inválida
    inputNome.value = "Primer Ácido";
    inputQtdDisp.value = "-1";
    form._listeners["submit"][0]({ preventDefault: () => {} });
    assert.equal(elementos.get("material-qtd-disponivel-erro").hidden, false);
    assert.equal(
      elementos.get("material-qtd-disponivel-erro").textContent,
      "Informe uma quantidade disponível válida maior ou igual a zero."
    );

    // 3. Preenche Qtd Disponivel, testa Qtd Minima inválida
    inputQtdDisp.value = "10";
    inputQtdMin.value = "-5";
    form._listeners["submit"][0]({ preventDefault: () => {} });
    assert.equal(elementos.get("material-qtd-minima-erro").hidden, false);
    assert.equal(
      elementos.get("material-qtd-minima-erro").textContent,
      "Informe uma quantidade mínima válida maior ou igual a zero."
    );

    // 4. Preenche Qtd Minima, testa Unidade vazia
    inputQtdMin.value = "2";
    selectUnidade.value = "";
    form._listeners["submit"][0]({ preventDefault: () => {} });
    assert.equal(elementos.get("material-unidade-erro").hidden, false);
    assert.equal(elementos.get("material-unidade-erro").textContent, "A unidade de medida é obrigatória.");
  });

  it("submete formulário com sucesso e dispara evento materiais:atualizados", async () => {
    const { context, elementos, windowMock, documentMock } = criarAmbienteDOM();

    let adicionado = null;
    windowMock.NailFlow.materiais.adicionarMaterialAsync = async (dados) => {
      adicionado = dados;
      return { sucesso: true, dados: { id: "novo-123", ...dados }, erro: null };
    };

    let eventoDisparado = false;
    documentMock.addEventListener("materiais:atualizados", () => {
      eventoDisparado = true;
    });

    vm.runInContext(codigoMateriaisUI, context);
    const configurarForm = vm.runInContext("configurarFormularioCadastroMaterial", context);
    configurarForm();

    const form = elementos.get("form-material");
    elementos.get("material-nome").value = "Lixa Banana 100/180";
    elementos.get("material-qtd-disponivel").value = "15";
    elementos.get("material-qtd-minima").value = "5";
    elementos.get("material-unidade").value = "unidades";

    await form._listeners["submit"][0]({ preventDefault: () => {} });

    assert.equal(adicionado.nome, "Lixa Banana 100/180");
    assert.equal(adicionado.quantidadeDisponivel, 15);
    assert.equal(adicionado.quantidadeMinima, 5);
    assert.equal(adicionado.unidade, "unidades");
    assert.equal(eventoDisparado, true);
    assert.equal(windowMock.location.hash, "#materiais");
  });
});
