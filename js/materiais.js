console.log("materiais.js carregado");

/**
 * Módulo de domínio para cadastro e controle de materiais - NailFlow
 * Suporte dual: Supabase (assíncrono) com injeção de dependência
 * Carregado como script clássico (não ES module) para compatibilidade com testes
 *
 * Contrato do repositório (objeto injetado nas operações):
 * - salvar(material): Promise<void> — persiste o material (já contém id)
 * - listar(): Promise<Material[]> — retorna cópia da lista de materiais
 * - atualizarQuantidade(id, quantidade): Promise<Material | null | undefined>
 *     Retorna o material atualizado em sucesso;
 *     null ou undefined quando o material não é encontrado;
 *     Lança Error em falha de persistência.
 * - buscarPorId(id): Promise<Material | null> — retorna o material ou null se não encontrado
 * - adicionar(material): Promise<Material> — adiciona novo material
 * - atualizar(id, dados): Promise<boolean> — atualiza material completamente
 * - excluir(id): Promise<boolean> — exclui material
 *
 * Material: { id, nome, quantidadeDisponivel, unidade, quantidadeMinima }
 */

// Cache do repositório Supabase (materiais)
let repoSupabaseMateriais = null;
let inicializacaoPromiseMateriais = null;

/**
 * Carrega o módulo do repositório Supabase dinamicamente
 * @returns {Promise<Function|null>}
 */
async function carregarRepoMateriais() {
  try {
    const modulo = await import('./repositories/materiais-repo.js');
    return modulo.tentarCriarMateriaisRepository;
  } catch {
    return null;
  }
}

/**
 * Obtém o repositório ativo (Supabase se autenticado, senão lança erro)
 * Inicialização preguiçosa (lazy) - só inicializa na primeira chamada da API assíncrona
 * Não faz fallback silencioso - erros de autenticação/autorização propagam para a UI
 * @returns {Promise<Object>}
 */
async function obterRepositorio() {
  if (repoSupabaseMateriais) return repoSupabaseMateriais;

  // Se já está inicializando, aguarda
  if (inicializacaoPromiseMateriais) {
    return await inicializacaoPromiseMateriais;
  }

  // Inicializa Supabase (apenas na primeira chamada)
  inicializacaoPromiseMateriais = carregarRepoMateriais()
    .then(tentarCriar => {
      if (!tentarCriar) {
        throw new Error('Módulo do repositório Supabase não disponível');
      }
      return tentarCriar();
    })
    .then(repo => {
      if (!repo) {
        throw new Error('Falha ao criar repositório Supabase: usuário não autenticado/autorizado ou erro de configuração');
      }
      repoSupabaseMateriais = repo;
      return repo;
    })
    .catch(err => {
      console.error('[Materiais] Falha ao inicializar Supabase:', err.message);
      inicializacaoPromiseMateriais = null; // Permite retry
      throw err;
    });

  return await inicializacaoPromiseMateriais;
}

/**
 * Força reinicialização do repositório (útil após login/logout)
 * Não faz fallback silencioso - erros propagam para a UI
 */
async function reinicializarMateriaisRepository() {
  repoSupabaseMateriais = null;
  inicializacaoPromiseMateriais = null;
  return await obterRepositorio();
}

function validarMaterial(dados) {
    if (!dados || typeof dados !== "object" || Array.isArray(dados)) {
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "DADOS_INVALIDOS",
                mensagem: "Informe os dados do material."
            }
        };
    }
    if (typeof dados.nome !== "string" || dados.nome.trim() === "") {
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "NOME_INVALIDO",
                mensagem: "Informe um nome válido para o material."
            }
        };
    }
    if (
        typeof dados.quantidadeDisponivel !== "number" ||
        !Number.isFinite(dados.quantidadeDisponivel) ||
        dados.quantidadeDisponivel < 0
    ) {
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "QUANTIDADE_INVALIDA",
                mensagem: "Informe uma quantidade válida para o material."
            }
        };
    }
    if (
        typeof dados.quantidadeMinima !== "number" ||
        !Number.isFinite(dados.quantidadeMinima) ||
        dados.quantidadeMinima < 0
    ) {
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "MINIMO_INVALIDO",
                mensagem: "Informe uma quantidade mínima válida para o material."
            }
        };
    }
    if (
        typeof dados.unidade !== "string" ||
        dados.unidade.trim() === ""
    ) {
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "UNIDADE_INVALIDA",
                mensagem: "Informe uma unidade válida para o material."
            }
        };
    }
    const materialNormalizado = {
        nome: dados.nome.trim(),
        quantidadeDisponivel: dados.quantidadeDisponivel,
        unidade: dados.unidade.trim(),
        quantidadeMinima: dados.quantidadeMinima
    };
    return {
        sucesso: true,
        dados: materialNormalizado,
        erro: null
    };
}

async function adicionarMaterial(dados, repositorio) {
    const validacao = validarMaterial(dados);

    if (!validacao.sucesso) {
        return validacao;
    }
    const material = {
        id: crypto.randomUUID(),
        ...validacao.dados
    };
    try {
        const repo = repositorio || await obterRepositorio();
        if (!repo) {
            return {
                sucesso: false,
                dados: null,
                erro: {
                    codigo: "NAO_AUTENTICADO",
                    mensagem: "Faça login para cadastrar materiais."
                }
            };
        }
        await repo.salvar(material);

        return {
            sucesso: true,
            dados: material,
            erro: null
        };
    } catch (err) {
        console.error('[Materiais] Erro ao adicionar:', err);
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "ERRO_PERSISTENCIA",
                mensagem: "Não foi possível salvar o material."
            }
        };
    }
}

async function listarMateriais(repositorio) {
    try {
        const repo = repositorio || await obterRepositorio();
        if (!repo) {
            return {
                sucesso: false,
                dados: [],
                erro: {
                    codigo: "NAO_AUTENTICADO",
                    mensagem: "Faça login para listar materiais."
                }
            };
        }
        const materiais = await repo.listar();

        return {
            sucesso: true,
            dados: materiais,
            erro: null
        };
    } catch (err) {
        console.error('[Materiais] Erro ao listar:', err);
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "ERRO_CONSULTA",
                mensagem: "Não foi possível consultar os materiais."
            }
        };
    }
}

async function atualizarQuantidadeMaterial(id, quantidade, repositorio) {

    if (typeof id !== "string" || id.trim() === "") {
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "ID_INVALIDO",
                mensagem: "Informe um identificador válido."
            }
        };
    }

    const idNormalizado = id.trim();

    if (
        typeof quantidade !== "number" ||
        !Number.isFinite(quantidade) ||
        quantidade < 0
    ) {
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "QUANTIDADE_INVALIDA",
                mensagem: "Informe uma quantidade válida para o material."
            }
        };
    }

    try {
        const repo = repositorio || await obterRepositorio();
        if (!repo) {
            return {
                sucesso: false,
                dados: null,
                erro: {
                    codigo: "NAO_AUTENTICADO",
                    mensagem: "Faça login para atualizar materiais."
                }
            };
        }

        const materialAtualizado = await repo.atualizarQuantidade(
            idNormalizado,
            quantidade
        );

        if (materialAtualizado == null) {
            return {
                sucesso: false,
                dados: null,
                erro: {
                    codigo: "MATERIAL_NAO_ENCONTRADO",
                    mensagem: "Material não encontrado."
                }
            };
        }

        return {
            sucesso: true,
            dados: materialAtualizado,
            erro: null
        };

    } catch (err) {
        console.error('[Materiais] Erro ao atualizar quantidade:', err);
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "ERRO_ATUALIZACAO",
                mensagem: "Não foi possível atualizar a quantidade do material."
            }
        };
    }
}

async function buscarMaterialPorId(id, repositorio) {
    if (typeof id !== "string" || id.trim() === "") {
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "ID_INVALIDO",
                mensagem: "Informe um identificador válido."
            }
        };
    }

    const idNormalizado = id.trim();

    try {
        const repo = repositorio || await obterRepositorio();
        if (!repo) {
            return {
                sucesso: false,
                dados: null,
                erro: {
                    codigo: "NAO_AUTENTICADO",
                    mensagem: "Faça login para buscar materiais."
                }
            };
        }

        const material = await repo.buscarPorId(idNormalizado);

        if (material == null) {
            return {
                sucesso: false,
                dados: null,
                erro: {
                    codigo: "MATERIAL_NAO_ENCONTRADO",
                    mensagem: "Material não encontrado."
                }
            };
        }

        return {
            sucesso: true,
            dados: material,
            erro: null
        };
    } catch (err) {
        console.error('[Materiais] Erro ao buscar:', err);
        return {
            sucesso: false,
            dados: null,
            erro: {
                codigo: "ERRO_CONSULTA",
                mensagem: "Não foi possível consultar o material."
            }
        };
    }
}

// Novas funções assíncronas expostas para UI moderna
async function adicionarMaterialAsync(dados) {
    return await adicionarMaterial(dados, null);
}

async function listarMateriaisAsync() {
    return await listarMateriais(null);
}

async function atualizarQuantidadeMaterialAsync(id, quantidade) {
    return await atualizarQuantidadeMaterial(id, quantidade, null);
}

async function buscarMaterialPorIdAsync(id) {
    return await buscarMaterialPorId(id, null);
}

async function atualizarMaterialAsync(id, dados) {
    try {
        const repo = await obterRepositorio();
        if (!repo) {
            return { sucesso: false, erro: { codigo: "NAO_AUTENTICADO", mensagem: "Faça login para atualizar materiais." } };
        }
        const validacao = validarMaterial(dados);
        if (!validacao.sucesso) return validacao;
        const ok = await repo.atualizar(id, validacao.dados);
        return { sucesso: ok, erro: ok ? null : { codigo: "MATERIAL_NAO_ENCONTRADO", mensagem: "Material não encontrado." } };
    } catch (err) {
        console.error('[Materiais] Erro ao atualizar:', err);
        return { sucesso: false, erro: { codigo: "ERRO_ATUALIZACAO", mensagem: "Não foi possível atualizar o material." } };
    }
}

async function excluirMaterialAsync(id) {
    try {
        const repo = await obterRepositorio();
        if (!repo) {
            return { sucesso: false, erro: { codigo: "NAO_AUTENTICADO", mensagem: "Faça login para excluir materiais." } };
        }
        const ok = await repo.excluir(id);
        return { sucesso: ok, erro: ok ? null : { codigo: "MATERIAL_NAO_ENCONTRADO", mensagem: "Material não encontrado." } };
    } catch (err) {
        console.error('[Materiais] Erro ao excluir:', err);
        return { sucesso: false, erro: { codigo: "ERRO_EXCLUSAO", mensagem: "Não foi possível excluir o material." } };
    }
}

// Exposição para uso no navegador (scripts clássicos) e Node (testes)
const apiMateriais = {
    validarMaterial,
    adicionarMaterial,
    listarMateriais,
    atualizarQuantidadeMaterial,
    buscarMaterialPorId,
    // API Assíncrona (moderna)
    adicionarMaterialAsync,
    listarMateriaisAsync,
    atualizarQuantidadeMaterialAsync,
    buscarMaterialPorIdAsync,
    atualizarMaterialAsync,
    excluirMaterialAsync,
    reinicializarMateriaisRepository
};

if (typeof globalThis !== "undefined") {
    globalThis.NailFlow = globalThis.NailFlow || {};
    globalThis.NailFlow.materiais = apiMateriais;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = apiMateriais;
}
