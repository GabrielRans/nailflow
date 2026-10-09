function salvarTeste() {
  localStorage.setItem("nailflow_teste", "Persistência funcionando");
}

function lerTeste() {
  const valor = localStorage.getItem("nailflow_teste");
  console.log(valor);
}

function removerTeste() {
  localStorage.removeItem("nailflow_teste");
}
