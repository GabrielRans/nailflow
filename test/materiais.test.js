const { describe, it, beforeEach } = require("node:test");
const assert = require("node:assert/strict");

// Carrega o módulo de negócio via require (CommonJS)
const {
  validarMaterial,
  adicionarMaterial,
  listarMateriais,
  atualizarQuantidadeMaterial,
  buscarMaterialPorId
} = require("../js/materiais.js");

// Factory de repositório limpo por teste
function criarRepositorio() {
  const materiais = [];
  return {
    materiais,
    async salvar(m) { materiais.push(m); },
    async listar() { return [...materiais]; },
    async atualizarQuantidade(id, qtd) {
      const m = materiais.find(x => x.id === id);
      if (!m) return null;
      m.quantidadeDisponivel = qtd;
      return { ...m };
    },
    async buscarPorId(id) { return materiais.find(m => m.id === id) ?? null; }
  };
}

// Dados válidos base
function dadosValidos() {
  return {
    nome: "Algodão",
    quantidadeDisponivel: 25,
    unidade: "un",
    quantidadeMinima: 10
  };
}

describe("validarMaterial", () => {
  it("rejeita null", () => {
    assert.deepEqual(validarMaterial(null).erro.codigo, "DADOS_INVALIDOS");
  });

  it("rejeita undefined", () => {
    assert.deepEqual(validarMaterial(undefined).erro.codigo, "DADOS_INVALIDOS");
  });

  it("rejeita array", () => {
    assert.deepEqual(validarMaterial([]).erro.codigo, "DADOS_INVALIDOS");
  });

  it("rejeita string", () => {
    assert.deepEqual(validarMaterial("string").erro.codigo, "DADOS_INVALIDOS");
  });

  it("rejeita número", () => {
    assert.deepEqual(validarMaterial(123).erro.codigo, "DADOS_INVALIDOS");
  });

  it("rejeita nome vazio", () => {
    const r = validarMaterial({ ...dadosValidos(), nome: "" });
    assert.equal(r.erro.codigo, "NOME_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe um nome válido para o material.");
  });

  it("rejeita nome com apenas espaços", () => {
    const r = validarMaterial({ ...dadosValidos(), nome: "   " });
    assert.equal(r.erro.codigo, "NOME_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe um nome válido para o material.");
  });

  it("rejeita nome não-string", () => {
    const r = validarMaterial({ ...dadosValidos(), nome: 123 });
    assert.equal(r.erro.codigo, "NOME_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe um nome válido para o material.");
  });

  it("rejeita quantidadeDisponivel negativa", () => {
    const r = validarMaterial({ ...dadosValidos(), quantidadeDisponivel: -1 });
    assert.equal(r.erro.codigo, "QUANTIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma quantidade válida para o material.");
  });

  it("rejeita quantidadeDisponivel NaN", () => {
    const r = validarMaterial({ ...dadosValidos(), quantidadeDisponivel: NaN });
    assert.equal(r.erro.codigo, "QUANTIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma quantidade válida para o material.");
  });

  it("rejeita quantidadeDisponivel Infinity", () => {
    const r = validarMaterial({ ...dadosValidos(), quantidadeDisponivel: Infinity });
    assert.equal(r.erro.codigo, "QUANTIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma quantidade válida para o material.");
  });

  it("rejeita quantidadeDisponivel não-número", () => {
    const r = validarMaterial({ ...dadosValidos(), quantidadeDisponivel: "10" });
    assert.equal(r.erro.codigo, "QUANTIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma quantidade válida para o material.");
  });

  it("rejeita quantidadeMinima negativa", () => {
    const r = validarMaterial({ ...dadosValidos(), quantidadeMinima: -1 });
    assert.equal(r.erro.codigo, "MINIMO_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe uma quantidade mínima válida para o material.");
  });

  it("rejeita quantidadeMinima NaN", () => {
    const r = validarMaterial({ ...dadosValidos(), quantidadeMinima: NaN });
    assert.equal(r.erro.codigo, "MINIMO_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe uma quantidade mínima válida para o material.");
  });

  it("rejeita quantidadeMinima não-número", () => {
    const r = validarMaterial({ ...dadosValidos(), quantidadeMinima: "10" });
    assert.equal(r.erro.codigo, "MINIMO_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe uma quantidade mínima válida para o material.");
  });

  it("rejeita unidade vazia", () => {
    const r = validarMaterial({ ...dadosValidos(), unidade: "" });
    assert.equal(r.erro.codigo, "UNIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma unidade válida para o material.");
  });

  it("rejeita unidade com apenas espaços", () => {
    const r = validarMaterial({ ...dadosValidos(), unidade: "   " });
    assert.equal(r.erro.codigo, "UNIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma unidade válida para o material.");
  });

  it("rejeita unidade não-string", () => {
    const r = validarMaterial({ ...dadosValidos(), unidade: 123 });
    assert.equal(r.erro.codigo, "UNIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma unidade válida para o material.");
  });

  it("aceita dados válidos e normaliza strings", () => {
    const r = validarMaterial({ ...dadosValidos(), nome: "  Algodão  ", unidade: "  un  " });
    assert.equal(r.sucesso, true);
    assert.equal(r.dados.nome, "Algodão");
    assert.equal(r.dados.unidade, "un");
    assert.equal(r.dados.quantidadeDisponivel, 25);
    assert.equal(r.dados.quantidadeMinima, 10);
    assert.equal(r.erro, null);
  });

  it("aceita quantidadeMinima zero", () => {
    const r = validarMaterial({ ...dadosValidos(), quantidadeMinima: 0 });
    assert.equal(r.sucesso, true);
    assert.equal(r.dados.quantidadeMinima, 0);
  });

  it("aceita quantidadeDisponivel zero", () => {
    const r = validarMaterial({ ...dadosValidos(), quantidadeDisponivel: 0 });
    assert.equal(r.sucesso, true);
    assert.equal(r.dados.quantidadeDisponivel, 0);
  });

  it("rejeita dados inválidos com mensagem padronizada", () => {
    const r = validarMaterial(null);
    assert.equal(r.erro.codigo, "DADOS_INVALIDOS");
    assert.equal(r.erro.mensagem, "Informe os dados do material.");
  });
});

describe("adicionarMaterial", () => {
  let repo;

  beforeEach(() => { repo = criarRepositorio(); });

  it("cadastra material válido com UUID", async () => {
    const r = await adicionarMaterial(dadosValidos(), repo);
    assert.equal(r.sucesso, true);
    assert.ok(r.dados.id);
    assert.equal(r.dados.nome, "Algodão");
    assert.equal(r.dados.quantidadeDisponivel, 25);
    assert.equal(r.dados.unidade, "un");
    assert.equal(r.dados.quantidadeMinima, 10);
    assert.equal(repo.materiais.length, 1);
  });

  it("rejeita nome inválido", async () => {
    const r = await adicionarMaterial({ ...dadosValidos(), nome: "" }, repo);
    assert.equal(r.erro.codigo, "NOME_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe um nome válido para o material.");
    assert.equal(repo.materiais.length, 0);
  });

  it("rejeita quantidadeDisponivel inválida", async () => {
    const r = await adicionarMaterial({ ...dadosValidos(), quantidadeDisponivel: -5 }, repo);
    assert.equal(r.erro.codigo, "QUANTIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma quantidade válida para o material.");
    assert.equal(repo.materiais.length, 0);
  });

  it("rejeita quantidadeMinima inválida", async () => {
    const r = await adicionarMaterial({ ...dadosValidos(), quantidadeMinima: -1 }, repo);
    assert.equal(r.erro.codigo, "MINIMO_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe uma quantidade mínima válida para o material.");
    assert.equal(repo.materiais.length, 0);
  });

  it("rejeita unidade inválida", async () => {
    const r = await adicionarMaterial({ ...dadosValidos(), unidade: "" }, repo);
    assert.equal(r.erro.codigo, "UNIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma unidade válida para o material.");
    assert.equal(repo.materiais.length, 0);
  });

  it("rejeita dados não-objeto", async () => {
    const r = await adicionarMaterial(null, repo);
    assert.equal(r.erro.codigo, "DADOS_INVALIDOS");
    assert.equal(r.erro.mensagem, "Informe os dados do material.");
    assert.equal(repo.materiais.length, 0);
  });

  it("trata falha de persistência", async () => {
    const repoFalho = { async salvar() { throw new Error("db down"); } };
    const r = await adicionarMaterial(dadosValidos(), repoFalho);
    assert.equal(r.erro.codigo, "ERRO_PERSISTENCIA");
    assert.equal(r.erro.mensagem, "Não foi possível salvar o material.");
  });
});

describe("listarMateriais", () => {
  let repo;

  beforeEach(() => { repo = criarRepositorio(); });

  it("retorna lista vazia", async () => {
    const r = await listarMateriais(repo);
    assert.equal(r.sucesso, true);
    assert.deepEqual(r.dados, []);
  });

  it("retorna materiais cadastrados", async () => {
    await adicionarMaterial(dadosValidos(), repo);
    const r = await listarMateriais(repo);
    assert.equal(r.sucesso, true);
    assert.equal(r.dados.length, 1);
    assert.equal(r.dados[0].nome, "Algodão");
  });

  it("retorna cópia da lista (imutabilidade)", async () => {
    await adicionarMaterial(dadosValidos(), repo);
    const r1 = await listarMateriais(repo);
    // Modifica o array retornado
    r1.dados.push({ teste: "mutacao" });
    // Nova listagem não deve conter a mutação
    const r2 = await listarMateriais(repo);
    assert.equal(r2.dados.length, 1);
    assert.equal(r2.dados[0].nome, "Algodão");
  });

  it("trata falha de consulta", async () => {
    const repoFalho = { async listar() { throw new Error("db down"); } };
    const r = await listarMateriais(repoFalho);
    assert.equal(r.erro.codigo, "ERRO_CONSULTA");
    assert.equal(r.erro.mensagem, "Não foi possível consultar os materiais.");
    assert.equal(r.sucesso, false);
    assert.equal(r.dados, null);
  });
});

describe("atualizarQuantidadeMaterial", () => {
  let repo, idMaterial;

  beforeEach(async () => {
    repo = criarRepositorio();
    const r = await adicionarMaterial(dadosValidos(), repo);
    idMaterial = r.dados.id;
  });

  it("atualiza para quantidade válida (inclui zero)", async () => {
    const r = await atualizarQuantidadeMaterial(idMaterial, 0, repo);
    assert.equal(r.sucesso, true);
    assert.equal(r.dados.quantidadeDisponivel, 0);
    assert.equal(repo.materiais[0].quantidadeDisponivel, 0);
  });

  it("atualiza para quantidade positiva", async () => {
    const r = await atualizarQuantidadeMaterial(idMaterial, 50, repo);
    assert.equal(r.sucesso, true);
    assert.equal(r.dados.quantidadeDisponivel, 50);
    assert.equal(repo.materiais[0].quantidadeDisponivel, 50);
  });

  it("mantém outros campos inalterados", async () => {
    const r = await atualizarQuantidadeMaterial(idMaterial, 10, repo);
    assert.equal(r.sucesso, true);
    assert.equal(r.dados.nome, "Algodão");
    assert.equal(r.dados.quantidadeMinima, 10);
    assert.equal(r.dados.unidade, "un");
  });

  it("rejeita quantidade negativa", async () => {
    const r = await atualizarQuantidadeMaterial(idMaterial, -5, repo);
    assert.equal(r.erro.codigo, "QUANTIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma quantidade válida para o material.");
    assert.equal(repo.materiais[0].quantidadeDisponivel, 25);
  });

  it("rejeita quantidade NaN", async () => {
    const r = await atualizarQuantidadeMaterial(idMaterial, NaN, repo);
    assert.equal(r.erro.codigo, "QUANTIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma quantidade válida para o material.");
    assert.equal(repo.materiais[0].quantidadeDisponivel, 25);
  });

  it("rejeita quantidade Infinity", async () => {
    const r = await atualizarQuantidadeMaterial(idMaterial, Infinity, repo);
    assert.equal(r.erro.codigo, "QUANTIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma quantidade válida para o material.");
    assert.equal(repo.materiais[0].quantidadeDisponivel, 25);
  });

  it("rejeita quantidade não-número", async () => {
    const r = await atualizarQuantidadeMaterial(idMaterial, "10", repo);
    assert.equal(r.erro.codigo, "QUANTIDADE_INVALIDA");
    assert.equal(r.erro.mensagem, "Informe uma quantidade válida para o material.");
    assert.equal(repo.materiais[0].quantidadeDisponivel, 25);
  });

  it("rejeita ID vazio", async () => {
    const r = await atualizarQuantidadeMaterial("", 10, repo);
    assert.equal(r.erro.codigo, "ID_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe um identificador válido.");
  });

  it("rejeita ID com apenas espaços", async () => {
    const r = await atualizarQuantidadeMaterial("   ", 10, repo);
    assert.equal(r.erro.codigo, "ID_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe um identificador válido.");
  });

  it("rejeita material inexistente", async () => {
    const r = await atualizarQuantidadeMaterial("id-inexistente", 10, repo);
    assert.equal(r.erro.codigo, "MATERIAL_NAO_ENCONTRADO");
    assert.equal(r.erro.mensagem, "Material não encontrado.");
  });

  it("trata retorno undefined do repositório como material não encontrado", async () => {
    const repoUndefined = {
      async atualizarQuantidade() {
        return undefined;
      }
    };
    const r = await atualizarQuantidadeMaterial(idMaterial, 10, repoUndefined);
    assert.equal(r.sucesso, false);
    assert.equal(r.dados, null);
    assert.equal(r.erro.codigo, "MATERIAL_NAO_ENCONTRADO");
    assert.equal(r.erro.mensagem, "Material não encontrado.");
  });

  it("trata falha de atualização", async () => {
    const repoFalho = { async atualizarQuantidade() { throw new Error("db down"); } };
    const r = await atualizarQuantidadeMaterial(idMaterial, 10, repoFalho);
    assert.equal(r.erro.codigo, "ERRO_ATUALIZACAO");
    assert.equal(r.erro.mensagem, "Não foi possível atualizar a quantidade do material.");
    assert.equal(r.sucesso, false);
    assert.equal(r.dados, null);
  });
});

describe("buscarMaterialPorId", () => {
  let repo, idMaterial;

  beforeEach(async () => {
    repo = criarRepositorio();
    const r = await adicionarMaterial(dadosValidos(), repo);
    idMaterial = r.dados.id;
  });

  it("encontra material existente", async () => {
    const r = await buscarMaterialPorId(idMaterial, repo);
    assert.equal(r.sucesso, true);
    assert.equal(r.dados.id, idMaterial);
    assert.equal(r.dados.nome, "Algodão");
    assert.equal(r.dados.quantidadeDisponivel, 25);
    assert.equal(r.dados.quantidadeMinima, 10);
    assert.equal(r.dados.unidade, "un");
    assert.equal(r.erro, null);
  });

  it("encontra material com ID contendo espaços (normalização trim)", async () => {
    const r = await buscarMaterialPorId("  " + idMaterial + "  ", repo);
    assert.equal(r.sucesso, true);
    assert.equal(r.dados.id, idMaterial);
    assert.equal(r.dados.nome, "Algodão");
  });

  it("retorna MATERIAL_NAO_ENCONTRADO para ID inexistente", async () => {
    const r = await buscarMaterialPorId("id-inexistente", repo);
    assert.equal(r.sucesso, false);
    assert.equal(r.dados, null);
    assert.equal(r.erro.codigo, "MATERIAL_NAO_ENCONTRADO");
    assert.equal(r.erro.mensagem, "Material não encontrado.");
  });

  it("rejeita ID vazio", async () => {
    const r = await buscarMaterialPorId("", repo);
    assert.equal(r.sucesso, false);
    assert.equal(r.dados, null);
    assert.equal(r.erro.codigo, "ID_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe um identificador válido.");
  });

  it("rejeita ID com apenas espaços", async () => {
    const r = await buscarMaterialPorId("   ", repo);
    assert.equal(r.sucesso, false);
    assert.equal(r.dados, null);
    assert.equal(r.erro.codigo, "ID_INVALIDO");
    assert.equal(r.erro.mensagem, "Informe um identificador válido.");
  });

  it("trata falha de consulta", async () => {
    const repoFalho = { async buscarPorId() { throw new Error("db down"); } };
    const r = await buscarMaterialPorId(idMaterial, repoFalho);
    assert.equal(r.erro.codigo, "ERRO_CONSULTA");
    assert.equal(r.erro.mensagem, "Não foi possível consultar o material.");
    assert.equal(r.sucesso, false);
    assert.equal(r.dados, null);
  });
});