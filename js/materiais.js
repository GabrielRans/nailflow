/**
 * Módulo de domínio para cadastro e controle de materiais.
 *
 * Contrato do repositório (objeto injetado nas operações):
 * - salvar(material): Promise<void> — persiste o material (já contém id)
 * - listar(): Promise<Material[]> — retorna cópia da lista de materiais
 * - atualizarQuantidade(id, quantidade): Promise<Material | null | undefined>
 *     Retorna o material atualizado em sucesso;
 *     null ou undefined quando o material não é encontrado;
 *     Lança Error em falha de persistência.
 * - buscarPorId(id): Promise<Material | null> — retorna o material ou null se não encontrado
 *
 * Material: { id, nome, quantidadeDisponivel, unidade, quantidadeMinima }
 */

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
        await repositorio.salvar(material);

        return {
            sucesso: true,
            dados: material,
            erro: null
        };
    } catch {
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
        const materiais = await repositorio.listar();

        return {
            sucesso: true,
            dados: materiais,
            erro: null
        };
    } catch {
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
        const materialAtualizado = await repositorio.atualizarQuantidade(
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

    } catch {
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
        const material = await repositorio.buscarPorId(idNormalizado);

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
    } catch {
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

// Exposição para uso no navegador (scripts clássicos) e Node (testes)
const apiMateriais = {
    validarMaterial,
    adicionarMaterial,
    listarMateriais,
    atualizarQuantidadeMaterial,
    buscarMaterialPorId
};

if (typeof globalThis !== "undefined") {
    globalThis.NailFlow = globalThis.NailFlow || {};
    globalThis.NailFlow.materiais = apiMateriais;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = apiMateriais;
}