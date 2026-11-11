/**
 * Toast Notification System - NailFlow
 * Notificações não-bloqueantes no rodapé da tela
 */

function mostrarToast(mensagem, tipo = 'sucesso') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast ${tipo}`;
  toast.textContent = mensagem;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Exposição global
if (typeof globalThis !== 'undefined') {
  globalThis.NailFlow = globalThis.NailFlow || {};
  globalThis.NailFlow.toast = { mostrarToast };
}