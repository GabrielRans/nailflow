const { describe, it, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const codigoMateriaisUI = fs.readFileSync('js/materiais-ui.js', 'utf8');

function criarAmbienteDOM() {
  const elementos = new Map();
  const eventListeners = new Map();

  function criarElemento(tag, id = '', className = '') {
    const el = {
      tagName: tag.toUpperCase(),
      id,
      className,
      hidden: false,
      textContent: '',
      _innerHTML: '',
      value: '',
      dataset: {},
      attributes: {},
      children: [],
      setAttribute(k, v) { this.attributes[k] = String(v); },
      getAttribute(k) { return this.attributes[k] ?? null; },
      removeAttribute(k) { delete this.attributes[k]; },
      focus() { this._focused = true; },
      reset() {
        if (this.elements) {
          Object.values(this.elements).forEach(elem => { if (elem.value !== undefined) elem.value = ''; });
        }
      },
      appendChild(child) {
        this.children.push(child);
      },
      get innerHTML() {
        return this._innerHTML;
      },
      set innerHTML(value) {
        this._innerHTML = value;
        if (value === '') {
          this.children = [];
        }
      },
      querySelectorAll(selector) {
        if (selector === '.form-erro-campo') {
          return [
            elementos.get('material-nome-erro'),
            elementos.get('material-qtd-disponivel-erro'),
            elementos.get('material-qtd-minima-erro'),
            elementos.get('material-unidade-erro')
          ].filter(Boolean);
        }
        return [];
      },
      querySelector(selector) {
        if (selector === "button[type='submit']") return elementos.get('btn-submit-material');
        if (selector === '.btn-submit-material') return elementos.get('btn-submit-material');
        if (selector === '.material-card__ajuste') {
          if (!this._formAjuste) {
            this._formAjuste = criarElemento('form', '', 'material-card__ajuste');
            this._formAjuste._inputAjuste = criarElemento('input', '', 'material-card__ajuste-campo');
            this._formAjuste._btnAjuste = criarElemento('button', '', 'material-card__btn-atualizar');
            this._formAjuste.querySelector = (sel) => {
              if (sel === '.material-card__ajuste-campo') return this._formAjuste._inputAjuste;
              if (sel === '.material-card__btn-atualizar') return this._formAjuste._btnAjuste;
              return null;
            };
          }
          return this._formAjuste;
        }
        if (selector === '.material-card__ajuste-campo') return this._inputAjuste;
        if (selector === '.material-card__btn-atualizar') return this._btnAjuste;
        // Botões Editar e Atualizar do card
        if (selector === '[data-acao="editar"]') {
          if (!this._btnEditar) this._btnEditar = criarElemento('button', '', 'material-card__btn');
          return this._btnEditar;
        }
        if (selector === '[data-acao="atualizar"]') {
          if (!this._btnAtualizar) this._btnAtualizar = criarElemento('button', '', 'material-card__btn');
          return this._btnAtualizar;
        }
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

  const listaMateriais = criarElemento('ul', 'lista-materiais');
  const materiaisVazio = criarElemento('div', 'materiais-vazio');
  const materiaisLoading = criarElemento('div', 'materiais-loading');
  const materiaisFeedback = criarElemento('div', 'materiais-feedback');
  const buscaInput = criarElemento('input', 'materiais-busca-input');
  const materiaisBuscaVazio = criarElemento('div', 'materiais-busca-vazio');
  materiaisBuscaVazio.textContent = 'Nenhum material encontrado';

  const formMaterial = criarElemento('form', 'form-material');
  const inputNome = criarElemento('input', 'material-nome');
  const inputNomeErro = criarElemento('span', 'material-nome-erro', 'form-erro-campo');
  const inputQtdDisp = criarElemento('input', 'material-qtd-disponivel');
  const inputQtdDispErro = criarElemento('span', 'material-qtd-disponivel-erro', 'form-erro-campo');
  const selectUnidade = criarElemento('select', 'material-unidade');
  const selectUnidadeErro = criarElemento('span', 'material-unidade-erro', 'form-erro-campo');
  const inputQtdMin = criarElemento('input', 'material-qtd-minima');
  const inputQtdMinErro = criarElemento('span', 'material-qtd-minima-erro', 'form-erro-campo');
  const btnSubmit = criarElemento('button', 'btn-submit-material');
  const feedbackErro = criarElemento('div', 'form-material-erro');

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
    location: { hash: '#materiais' },
    addEventListener(type, cb) {
      const list = eventListeners.get('window:' + type) || [];
      list.push(cb);
      eventListeners.set('window:' + type, list);
    },
    dispatchEvent(event) {
      const list = eventListeners.get('window:' + event.type) || [];
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

describe('Interface de Materiais (materiais-ui.js)', () => {
  it('escapa caracteres especiais para prevenir XSS', () => {
    const { context } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const escaparHtml = vm.runInContext('escaparHtml', context);
    // A função ESCAPA corretamente - teste verifica se o retorno JÁ ESTÁ escapado
    assert.equal(escaparHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    assert.equal(escaparHtml('item "especial" & barato'), 'item &quot;especial&quot; &amp; barato');
    assert.equal(escaparHtml(null), '');
    assert.equal(escaparHtml(undefined), '');
  });

  it('renderiza estado vazio quando a lista estiver vazia', () => {
    const { context, elementos } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const renderizarLista = vm.runInContext('renderizarListaMateriais', context);
    renderizarLista([]);

    assert.equal(elementos.get('materiais-vazio').hidden, false);
    assert.equal(elementos.get('lista-materiais').hidden, true);
  });

  it('renderiza cards com badge de reposição quando disponível <= mínimo', () => {
    const { context, elementos } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const renderizarLista = vm.runInContext('renderizarListaMateriais', context);
    const mockMateriais = [
      {
        id: 'mat-1',
        nome: 'Gel Construtor Pink',
        quantidadeDisponivel: 2,
        quantidadeMinima: 5,
        unidade: 'unidades'
      },
      {
        id: 'mat-2',
        nome: 'Top Coat Fosco',
        quantidadeDisponivel: 10,
        quantidadeMinima: 3,
        unidade: 'unidades'
      }
    ];

    renderizarLista(mockMateriais);

    assert.equal(elementos.get('materiais-vazio').hidden, true);
    assert.equal(elementos.get('lista-materiais').hidden, false);
    assert.equal(elementos.get('lista-materiais').children.length, 2);

    const card1 = elementos.get('lista-materiais').children[0];
    assert.match(card1.innerHTML, /material-card__badge--reposicao/);

    const card2 = elementos.get('lista-materiais').children[1];
    assert.match(card2.innerHTML, /material-card__badge--ok/);
  });

  it('badge mostra OK quando disponível > mínimo e Reposição quando <= mínimo (casos de borda)', () => {
    const { context, elementos } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const renderizarLista = vm.runInContext('renderizarListaMateriais', context);
    const precisaReposicao = vm.runInContext('precisaReposicao', context);

    // Igual ao mínimo -> Reposição
    assert.equal(precisaReposicao({ quantidadeDisponivel: 5, quantidadeMinima: 5 }), true);
    // Zero disponível, zero mínimo -> Reposição (0 <= 0)
    assert.equal(precisaReposicao({ quantidadeDisponivel: 0, quantidadeMinima: 0 }), true);
    // Disponível maior -> OK
    assert.equal(precisaReposicao({ quantidadeDisponivel: 6, quantidadeMinima: 5 }), false);
    // Disponível menor -> Reposição
    assert.equal(precisaReposicao({ quantidadeDisponivel: 4, quantidadeMinima: 5 }), true);
  });

  it('busca filtra por nome em tempo real ignorando acentos e maiúsculas', () => {
    const { context, elementos, documentMock } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const renderizarLista = vm.runInContext('renderizarListaMateriais', context);
    const normalizarParaBusca = vm.runInContext('normalizarParaBusca', context);
    const configurarBusca = vm.runInContext('configurarBuscaMateriais', context);
    const filtroBuscaAtual = 'filtroBuscaAtual';

    const mockMateriais = [
      { id: '1', nome: 'Gel Construtor', quantidadeDisponivel: 10, quantidadeMinima: 5, unidade: 'un' },
      { id: '2', nome: 'Esmalte Vermelho', quantidadeDisponivel: 5, quantidadeMinima: 2, unidade: 'un' },
      { id: '3', nome: 'Lixa Banana', quantidadeDisponivel: 20, quantidadeMinima: 10, unidade: 'un' },
      { id: '4', nome: 'Primer Ácido', quantidadeDisponivel: 3, quantidadeMinima: 1, unidade: 'un' }
    ];

    // Testa normalização - NFD + remove diacríticos + lowercase
    // "PRÉMER" -> "PREMER" (não "PRIMER" - o É perde o acento mas não vira I)
    assert.equal(normalizarParaBusca('Gel Construtor'), 'gel construtor');
    assert.equal(normalizarParaBusca('PRÉMER ÁCIDO'), 'premer acido');
    assert.equal(normalizarParaBusca('esmalte'), 'esmalte');

    // Configura busca (registra listener no input)
    configurarBusca();

    // Carrega materiais primeiro
    renderizarLista(mockMateriais);
    assert.equal(elementos.get('lista-materiais').children.length, 4);

    // Simula busca por "gel" (minúsculo) via input event
    const buscaInput = elementos.get('materiais-busca-input');
    buscaInput.value = 'gel';
    buscaInput.dispatchEvent({ type: 'input', target: buscaInput });
    renderizarLista(mockMateriais);
    // Deve mostrar apenas "Gel Construtor"
    assert.equal(elementos.get('lista-materiais').children.length, 1);
    assert.match(elementos.get('lista-materiais').children[0].innerHTML, /Gel Construtor/);

    // Busca por "ácido" sem acento
    buscaInput.value = 'acido';
    buscaInput.dispatchEvent({ type: 'input', target: buscaInput });
    renderizarLista(mockMateriais);
    assert.equal(elementos.get('lista-materiais').children.length, 1);
    assert.match(elementos.get('lista-materiais').children[0].innerHTML, /Primer Ácido/);

    // Busca por "VERMELHO" (maiúsculo)
    buscaInput.value = 'VERMELHO';
    buscaInput.dispatchEvent({ type: 'input', target: buscaInput });
    renderizarLista(mockMateriais);
    assert.equal(elementos.get('lista-materiais').children.length, 1);
    assert.match(elementos.get('lista-materiais').children[0].innerHTML, /Esmalte Vermelho/);

    // Busca sem resultados
    buscaInput.value = 'inexistente';
    buscaInput.dispatchEvent({ type: 'input', target: buscaInput });
    renderizarLista(mockMateriais);
    assert.equal(elementos.get('lista-materiais').hidden, true);
    assert.equal(elementos.get('materiais-busca-vazio').hidden, false);
    assert.match(elementos.get('materiais-busca-vazio').textContent, /Nenhum material encontrado/);

    // Limpa busca
    buscaInput.value = '';
    buscaInput.dispatchEvent({ type: 'input', target: buscaInput });
    renderizarLista(mockMateriais);
    assert.equal(elementos.get('lista-materiais').children.length, 4);
  });

  it('valida formulário na ordem contratual (Nome -> Qtd Disp -> Qtd Min -> Unidade)', async () => {
    const { context, elementos } = criarAmbienteDOM();
    vm.runInContext(codigoMateriaisUI, context);

    const configurarForm = vm.runInContext('configurarFormularioCadastroMaterial', context);
    configurarForm();

    const form = elementos.get('form-material');
    const inputNome = elementos.get('material-nome');
    const inputQtdDisp = elementos.get('material-qtd-disponivel');
    const inputQtdMin = elementos.get('material-qtd-minima');
    const selectUnidade = elementos.get('material-unidade');

    inputNome.value = '';
    form._listeners['submit'][0]({ preventDefault: () => {} });
    assert.equal(elementos.get('material-nome-erro').hidden, false);
    assert.equal(elementos.get('material-nome-erro').textContent, 'O nome do material é obrigatório.');

    inputNome.value = 'Primer Ácido';
    inputQtdDisp.value = '-1';
    form._listeners['submit'][0]({ preventDefault: () => {} });
    assert.equal(elementos.get('material-qtd-disponivel-erro').hidden, false);
    assert.equal(
      elementos.get('material-qtd-disponivel-erro').textContent,
      'Informe uma quantidade disponível válida maior ou igual a zero.'
    );

    inputQtdDisp.value = '10';
    inputQtdMin.value = '-5';
    form._listeners['submit'][0]({ preventDefault: () => {} });
    assert.equal(elementos.get('material-qtd-minima-erro').hidden, false);
    assert.equal(
      elementos.get('material-qtd-minima-erro').textContent,
      'Informe uma quantidade mínima válida maior ou igual a zero.'
    );

    inputQtdMin.value = '2';
    selectUnidade.value = '';
    form._listeners['submit'][0]({ preventDefault: () => {} });
    assert.equal(elementos.get('material-unidade-erro').hidden, false);
    assert.equal(elementos.get('material-unidade-erro').textContent, 'A unidade de medida é obrigatória.');
  });

  it('submete formulário com sucesso e dispara evento materiais:atualizados', async () => {
    const { context, elementos, windowMock, documentMock } = criarAmbienteDOM();

    let adicionado = null;
    windowMock.NailFlow.materiais.adicionarMaterialAsync = async (dados) => {
      adicionado = dados;
      return { sucesso: true, dados: { id: 'novo-123', ...dados }, erro: null };
    };

    let eventoDisparado = false;
    documentMock.addEventListener('materiais:atualizados', () => {
      eventoDisparado = true;
    });

    vm.runInContext(codigoMateriaisUI, context);
    const configurarForm = vm.runInContext('configurarFormularioCadastroMaterial', context);
    configurarForm();

    const form = elementos.get('form-material');
    elementos.get('material-nome').value = 'Lixa Banana 100/180';
    elementos.get('material-qtd-disponivel').value = '15';
    elementos.get('material-qtd-minima').value = '5';
    elementos.get('material-unidade').value = 'unidades';

    await form._listeners['submit'][0]({ preventDefault: () => {} });

    assert.equal(adicionado.nome, 'Lixa Banana 100/180');
    assert.equal(adicionado.quantidadeDisponivel, 15);
    assert.equal(adicionado.quantidadeMinima, 5);
    assert.equal(adicionado.unidade, 'unidades');
    assert.equal(eventoDisparado, true);
    assert.equal(windowMock.location.hash, '#materiais');
  });
});