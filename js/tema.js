/**
 * Módulo de Tema (Dark/Light Mode) - NailFlow
 * Gerencia a alternância de tema com persistência no localStorage
 */

const TEMA_KEY = 'nailflow-tema';

/**
 * Obtém o tema salvo ou detecta a preferência do sistema
 * @returns {'light' | 'dark'}
 */
function obterTemaSalvo() {
  const salvo = localStorage.getItem(TEMA_KEY);
  if (salvo === 'dark' || salvo === 'light') {
    return salvo;
  }
  // Fallback: preferência do sistema
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Aplica o tema no documento
 * @param {'light' | 'dark'} tema
 */
function aplicarTema(tema) {
  document.documentElement.setAttribute('data-theme', tema);
  localStorage.setItem(TEMA_KEY, tema);

  // Atualiza os ícones dos botões de tema
  atualizarBotoesTema(tema);
}

/**
 * Atualiza a visibilidade dos ícones sol/lua nos botões de tema
 * @param {'light' | 'dark'} tema
 */
function atualizarBotoesTema(tema) {
  const botoes = document.querySelectorAll('.btn-tema');
  botoes.forEach(btn => {
    const iconeLua = btn.querySelector('.icone-lua');
    const iconeSol = btn.querySelector('.icone-sol');
    if (iconeLua && iconeSol) {
      if (tema === 'dark') {
        iconeLua.hidden = true;
        iconeSol.hidden = false;
      } else {
        iconeLua.hidden = false;
        iconeSol.hidden = true;
      }
    }
  });
}

/**
 * Alterna entre tema claro e escuro
 */
function alternarTema() {
  const temaAtual = document.documentElement.getAttribute('data-theme') || 'light';
  const novoTema = temaAtual === 'dark' ? 'light' : 'dark';
  aplicarTema(novoTema);
}

/**
 * Inicializa o sistema de tema
 */
export function inicializarTema() {
  // Aplica o tema salvo na inicialização (antes do primeiro paint idealmente)
  const tema = obterTemaSalvo();
  document.documentElement.setAttribute('data-theme', tema);

  // Aguarda o DOM estar pronto para configurar os botões
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      configurarBotoesTema();
      atualizarBotoesTema(tema);
    });
  } else {
    configurarBotoesTema();
    atualizarBotoesTema(tema);
  }
}

/**
 * Configura os event listeners dos botões de tema
 */
function configurarBotoesTema() {
  const botoes = document.querySelectorAll('.btn-tema');
  botoes.forEach(btn => {
    btn.addEventListener('click', alternarTema);
  });
}

/**
 * Retorna o tema atual
 * @returns {'light' | 'dark'}
 */
export function getTemaAtual() {
  return document.documentElement.getAttribute('data-theme') || 'light';
}

/**
 * Define o tema programaticamente
 * @param {'light' | 'dark'} tema
 */
export function setTema(tema) {
  if (tema === 'light' || tema === 'dark') {
    aplicarTema(tema);
  }
}

// Auto-inicialização
inicializarTema();