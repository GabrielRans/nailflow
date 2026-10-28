# Contrato de Integração — Sprint 03 | NailFlow

**Versão:** 1.1 — TEXTO CONSOLIDADO PARA VALIDAÇÃO FORMAL (ainda não aprovado pelos dois integrantes)
**Base:** contrato v1.0 publicado na Issue #34 e revisão registrada por 0S1mple1
**Período:** 26/10/2026 a 08/11/2026
**Branch principal:** `main`
**Responsável técnico:** `GabrielRans`
**Colaborador de interface:** `0S1mple1`
**Situação:** decisões de navegação por hash, preservação de edição na sessão e F05 provisória aceitas por GabrielRans; aguardando revisão do texto completo e concordância expressa de ambos os integrantes

> Este documento define responsabilidades, pontos de integração e critérios de aceitação. Nenhuma cláusula afirma que funcionalidades ainda pendentes já foram implementadas. Itens marcados **PENDENTE DE DECISÃO** devem ser resolvidos antes da implementação da parte afetada.

## 1. Objetivo e limites

Organizar a Sprint 03 para implementar navegação entre Dashboard, Financeiro e Materiais, evoluir os componentes visuais e preparar o módulo de materiais **sem comprometer** cadastro, edição, exclusão, filtros, armazenamento e indicadores financeiros já integrados.

**Fora do escopo da Issue #34:** autenticação, sincronização entre dispositivos, implantação automática de banco/serviço externo, reimplementação dos cálculos financeiros e duplicação das operações de materiais. A pesquisa arquitetural pertence à Issue #30; materiais, às Issues #7 e #31; alertas, à Issue #8; backup, à Issue #32.

## 2. Responsabilidades

### GabrielRans — regras de negócio e integração

- Issue #29: padronização da categoria `atendimento` e adequação do ticket médio ao RF06.
- Issue #30: avaliação e registro da decisão arquitetural, sem implantação automática de serviços externos.
- Issue #34: definição dos identificadores, estrutura e lógica de navegação; coordenação das alterações em `index.html`.
- Issue #7: contrato de dados, operações, validações e persistência de materiais, após avaliação das dependências.
- Issue #8: regras para identificação de necessidade de reposição.
- Revisão dos Pull Requests e validação de integração.

### 0S1mple1 — interface e experiência do usuário

- Issue #25: legibilidade e estados visuais do Dashboard, sem reproduzir lógica financeira.
- Issue #31: interface de cadastro e listagem de materiais, conforme contrato da Issue #7.
- Issue #34: estilos, elementos visuais, responsividade e acessibilidade da navegação, conforme seletores previamente acordados.
- Issue #33: colaboração em testes e evidências.

**Regra compartilhada:** mudanças de escopo, comportamento ou contratos entre módulos deverão ser discutidas na Issue correspondente antes de alterações paralelas.

## 3. Áreas, telas e rotas — Issue #34

### 3.1 Fluxos previstos

| Identificação | Área/tela | Comportamento esperado |
|---|---|---|
| F01 | Dashboard | Exibir indicadores financeiros existentes e acesso a F03; preservar o fluxo de atualização atual. |
| F02 | Financeiro | Exibir movimentações, filtros e ações Editar/Excluir; oferecer acesso a F03. |
| F03 | Nova movimentação / edição | Utilizar o formulário existente, sem duplicação; ao editar, abrir o formulário preenchido com o ID original. |
| F04 | Materiais | Área de consulta e acesso ao cadastro; não duplicar as operações da Issue #7. |
| F05 | Cadastro de materiais | Rota e acesso previstos nesta Issue; formulário funcional e integração pertencem às Issues #31 e #7. |

**F05 durante a entrega da navegação (decisão aprovada pelo responsável técnico):** se o formulário de materiais ainda não estiver implementado, o acesso abrirá uma área provisória identificada como “Cadastro de materiais — em desenvolvimento”, acessível por teclado e toque. Não apresentar um formulário fictício como funcional e não cadastrar registros por fluxo alternativo. A área provisória será substituída pela interface aprovada da Issue #31, integrada às operações da Issue #7.

### 3.2 Estratégia de URL e histórico — ACEITA PELO RESPONSÁVEL TÉCNICO

Adotar navegação cliente por fragmento da URL (*hash routing*), sem recarga de página, com estas rotas convencionadas para a v1.1:

- `#dashboard` (F01)
- `#financeiro` (F02)
- `#movimentacao` (F03)
- `#materiais` (F04)
- `#cadastro-material` (F05)

Requisitos: carregar a área correspondente ao fragmento válido; usar Dashboard como destino padrão de fragmentos vazios/desconhecidos (sem acumular entradas artificiais no histórico); permitir Voltar/Avançar do navegador entre áreas; restaurar **a área** após recarregamento. **Não há promessa de restaurar formulários não salvos após recarregar**. Estas rotas e seus nomes foram aceitos por GabrielRans e serão submetidos à validação formal de 0S1mple1 no documento completo.

### 3.3 Navegação sem perda de edição — ACEITA PELO RESPONSÁVEL TÉCNICO

- Ao mudar de área na mesma sessão, manter no DOM o formulário F03 e preservar os campos preenchidos e `#movimentacao-id`, inclusive em modo de edição. A troca de área por si só não executa `form.reset()` nem grava um rascunho no `localStorage`.
- Ao clicar em Editar em F02, localizar o registro pelo ID, preencher o formulário existente, ativar F03 (`#movimentacao`) e posicionar o foco de modo previsível, **após** a exibição da área.
- Se o registro não existir mais, não navegar para edição inválida; informar o problema de forma acessível.
- Após salvar com sucesso, manter o comportamento atual de persistência, atualização por evento e limpeza do formulário; qualquer mudança de rota automática deverá ser combinada antes.
- Se for disponibilizado controle de cancelamento da edição ou houver tentativa de substituir uma edição alterada por outro registro, confirmar o descarte quando existirem alterações não salvas. Isso não implica criar automaticamente um novo botão na Issue #34; a navegação comum entre áreas não descarta os campos.
- A preservação de rascunhos depois de fechar ou recarregar a página não está prevista nesta versão; não criar persistência adicional de rascunho sem acordo específico.

### 3.4 Acessibilidade e foco

- Navegação principal semanticamente identificada; links/controles operáveis por teclado e toque, sem interação exclusiva por hover.
- Indicar a área ativa visualmente **e** por atributo semântico adequado, como `aria-current="page"` no link correspondente.
- Ao abrir uma nova área por navegação explícita, transferir o foco ao título da área (que poderá usar `tabindex="-1"` para foco programático); ao iniciar edição, posicionar o foco no primeiro campo relevante após mostrar F03. Não deixar foco em conteúdo oculto.
- Ao retornar ou fechar formulário, restaurar o foco a um controle útil da área de origem quando possível.
- Manter rótulos, foco visível, ordem de tabulação lógica e mensagens de estado acessíveis.
- Áreas inativas não devem receber foco pelo teclado; ao ocultá-las, usar comportamento consistente com `hidden` e verificar que o CSS não torne os elementos visíveis nem focáveis.

### 3.5 Identificadores e contratos do DOM

**Identificadores existentes que não podem ser quebrados:**

- `#form-movimentacao`, `#movimentacao-id`, `#lista-movimentacoes`;
- `#filtro-data-inicial`, `#filtro-data-final`, `#btn-filtrar-periodo`, `#btn-limpar-filtro`;
- `.dashboard`, `.dashboard__estado` e os `[data-indicador]` financeiros;
- os scripts e eventos existentes consumidos pelos componentes financeiros.

**Mapa proposto de seletores para validação conjunta (ainda não implementado):**

| Tela | Contêiner proposto | Rota |
|---|---|---|
| F01 | `[data-tela="dashboard"]` | `#dashboard` |
| F02 | `[data-tela="financeiro"]` | `#financeiro` |
| F03 | `[data-tela="movimentacao"]` | `#movimentacao` |
| F04 | `[data-tela="materiais"]` | `#materiais` |
| F05 | `[data-tela="cadastro-material"]` | `#cadastro-material` |

**Controles propostos:** links de navegação por `href="#..."` e identificador complementar `data-rota="..."`; navegação principal com `aria-label="Navegação principal"`. Os três links principais são Dashboard, Financeiro e Materiais. Quando F03 estiver ativa, o item Financeiro poderá permanecer indicado como área principal correspondente; quando F05 estiver ativa, Materiais. Definir a apresentação visual desse estado em conjunto.

**Preservação obrigatória:** os seletores existentes listados acima continuam intactos. A estrutura atual das seções deverá ser encapsulada/reorganizada sem recriar seus formulários, listas ou listeners. A equipe deve validar este mapa na Issue #34 antes de alterar `index.html` e iniciar CSS/JS em paralelo. O mapa é uma proposta técnica do documento, **não um acordo já firmado com 0S1mple1**.

## 4. Contrato financeiro — Issues #29 e #25

- `js/app.js` permanece como fonte das operações, validações e cálculos financeiros enquanto ocorrer a adequação RF06.
- Preservar `movimentacoes:atualizadas`, com a lista de registros em `event.detail`, e os consumidores existentes de `listarMovimentacoes()` e `calcularIndicadoresFinanceiros()`.
- A Issue #25 altera apresentação e estados visuais, **não** o cálculo do ticket médio, a persistência ou o contrato do evento.
- A navegação não pode cadastrar listeners duplicados, recriar o formulário nem renderizar dados divergentes.
- A correção RF06 da Issue #29 deverá adotar categoria `atendimento` conforme sua especificação; este contrato não antecipa sua implementação nem a declara concluída.
- O estado vazio deve ser distinto de falha de leitura. Mensagens de carregamento só deverão ser criadas se existir processo assíncrono que as justifique.

## 5. Contrato de materiais — Issues #7 e #31

**Estrutura mínima proposta (não é ainda contrato definitivo):**

| Campo | Finalidade |
|---|---|
| `id` | Identificador estável do material |
| `nome` | Identificação do material |
| `quantidadeDisponivel` | Saldo em estoque |
| `unidade` | Unidade de medida |
| `quantidadeMinima` | Limite de reposição |

A interface F05 segue os campos do wireframe: nome, quantidade, unidade e quantidade mínima; não adicionar preço por item nesta etapa sem mudança explícita de escopo.

**PENDENTE DE DECISÃO após alinhamento com Issue #30 e antes da Issue #31:**

1. Nomes e assinaturas de criação, listagem, consulta e atualização de materiais; formato dos retornos de sucesso e erro.
2. Se as operações serão síncronas ou assíncronas, para definir quando apresentar carregamento.
3. Evento proposto `materiais:atualizados`: nome definitivo, formato de `event.detail` (lista atualizada, se aprovado) e momento da emissão (somente após alteração persistida com sucesso, proposta).
4. Forma de relatar validação, falha de leitura/escrita, estado vazio e recuperação sem a interface acessar o armazenamento diretamente.
5. Mecanismo de persistência aprovado e consequências para a Issue #32.

GabrielRans formalizará essas definições em comentário/contrato técnico da Issue #7 e solicitará concordância de 0S1mple1 **antes** de iniciar a integração funcional da Issue #31. Nenhuma escolha de Firebase, Supabase, localStorage definitivo ou API de eventos é considerada aprovada pelo presente rascunho.

## 6. Arquivos, alterações autorizadas e prevenção de conflitos

| Arquivo | Responsável / regra |
|---|---|
| `index.html` | **Compartilhado.** GabrielRans coordena estrutura, IDs e integração; 0S1mple1 propõe marcação de controles visuais mediante alinhamento prévio. |
| `js/app.js` | GabrielRans. Alterações financeiras e dados requerem revisão de regressão. |
| `js/navegacao.js` (proposto) | GabrielRans, lógica de rotas e foco em coordenação com UI. |
| `js/materiais.js` (proposto) | GabrielRans, operações e dados. |
| `js/movimentacoes-ui.js` | Alterações pontuais de abertura de F03 e foco: GabrielRans, após alinhamento; preservar ações existentes. |
| `js/dashboard-ui.js` | Preservar o contrato financeiro; mudanças de interface dependem de alinhamento com GabrielRans e revisão conjunta. |
| `js/materiais-ui.js` (proposto) | 0S1mple1, consumo do contrato de materiais; não acessar armazenamento diretamente. |
| `css/navegacao.css` (proposto) | 0S1mple1, baseado nos seletores/estados acordados. |
| `css/materiais.css` (proposto) | 0S1mple1. |
| `css/dashboard.css` | 0S1mple1, apenas apresentação. |

Arquivos propostos podem ainda não existir. Quem necessitar alterar arquivo atribuído ao outro deverá abrir alinhamento na Issue correspondente antes de iniciar. Evitar PRs simultâneos tocando o mesmo trecho de `index.html`; usar commits pequenos e sincronização após integração.

## 7. Sequência de trabalho e dependências

1. **Issue #29:** adequar RF06, com testes financeiros e PR próprio.
2. **Issue #30:** documentar a decisão sobre persistência; **não** implantar serviços externos automaticamente.
3. **Issue #34:** aprovar mapa de seletores/rotas; criar navegação funcional e áreas F01/F02/F04, com acessos F03/F05 e F05 provisória quando necessário.
4. **Issue #25:** refinar visual do Dashboard sem alterar regras; pode ocorrer em paralelo se não houver disputa por arquivos compartilhados.
5. **Issues #7 e #31:** fechar o contrato técnico de materiais; desenvolver operações e interface em branches coordenadas, integrando somente após testes em conjunto.
6. **Issues #8 e #32:** alertas e backup, segundo suas dependências técnicas.
7. **Issue #33:** testes e evidências durante toda a sprint, com consolidação do Relatório Incremental v2.0 até 01/11/2026 e encerramento da Sprint 03 em 08/11/2026.

Essa sequência é uma referência de dependências, não exigência de trabalho estritamente serial. Desenvolvimento independente pode ocorrer em paralelo após fixação dos contratos.

## 8. Fluxo Git e revisão obrigatórios

- Criar branch da Issue a partir da `main` atualizada.
- Realizar commits pequenos, com mensagens descritivas e rastreáveis.
- Vincular PR à Issue correspondente, sem encerrá-la antes do aceite funcional.
- Não commitar diretamente na `main`; não sobrescrever o trabalho do outro nem executar merge por bypass administrativo.
- Testar alterações antes de solicitar aprovação.
- Para arquivos compartilhados, combinar alterações antecipadamente e integrar sobre a `main` mais recente.
- Após cada merge, sincronizar os ambientes de desenvolvimento.
- Registrar capturas, testes e histórico para o Relatório Incremental.

## 9. Critérios mínimos de aprovação e cenários de teste

- [ ] Navegação principal entre Dashboard, Financeiro e Materiais funciona por toque e teclado; área ativa identificável.
- [ ] F03 acessível por Dashboard e Financeiro; Editar abre o formulário existente com ID e valores correspondentes.
- [ ] Trocar de área e voltar preserva os campos não salvos dentro da mesma sessão, sem gerar registros duplicados.
- [ ] F05 é acessível; quando módulo não estiver pronto, exibe estado provisório claro, sem funcionalidade enganosa.
- [ ] Voltar/Avançar, carregamento por rota e comportamento do foco são testados conforme a estratégia de navegação aprovada.
- [ ] Cadastro, edição, exclusão com confirmação, filtros, persistência e indicadores financeiros não apresentam regressões.
- [ ] Evento `movimentacoes:atualizadas` e os identificadores atuais continuam funcionais.
- [ ] Ausência de rolagem horizontal indevida e legibilidade nas larguras 320px, 375px, 768px e desktop.
- [ ] Sem erros JavaScript relativos às alterações; sem duplicidade de cálculo, persistência ou listeners.
- [ ] Novos estados de materiais seguem contrato técnico acordado antes da integração (quando aplicável).
- [ ] PR revisado, evidências anexadas e conclusão registrada na Issue correspondente.

**Evidências sugeridas:** capturas dos fluxos F01–F05; edição preservada ao navegar; teste de teclado/foco; responsividade; regressão financeira; commits, PRs e decisões arquiteturais. A Issue #33 documentará resultados reais e eventuais pendências, sem declarar testes não executados como aprovados.

## 10. Pendências de decisão e aprovação formal

**A decidir antes de começar a implementação dependente:**

- [x] GabrielRans aceitou navegação por hash, rotas e fallback definidos na seção 3.2; falta validação formal de 0S1mple1 no documento completo.
- [x] GabrielRans aceitou a preservação de campos na sessão e a F05 provisória, nas seções 3.1 e 3.3; falta validação formal de 0S1mple1 no documento completo.
- [ ] Aprovar em conjunto o mapa de seletores, a estrutura compartilhada de `index.html`, a indicação visual da área ativa e as regras de foco.
- [ ] Confirmar antes de implementar controles adicionais o comportamento de cancelamento/descarte e o retorno após salvar.
- [ ] Na fase de materiais, aprovar funções, retornos, erros, estados de carregamento e o evento `materiais:atualizados` após a decisão da Issue #30.

**Aprovação do contrato:**

A concordância com três decisões arquiteturais nesta conversa **não substitui** a aprovação do texto integral versionado e não representa aprovação do colaborador.

- [ ] GabrielRans: comentário de concordância com a versão 1.1 e link/commit do documento.
- [ ] 0S1mple1: comentário de concordância com a mesma versão e link/commit do documento.

O contrato v1.1 **somente entra em vigor após aprovação expressa dos dois integrantes**. Alterações posteriores deverão resultar em nova revisão versionada e registro na Issue #34.

## 11. Histórico de alterações

| Versão | Situação | Descrição |
|---|---|---|
| 1.0 | Proposta publicada | Responsabilidades, contratos iniciais, arquivos, ordem de integração e regras Git. |
| 1.1 | Consolidada para validação; aprovação formal pendente | Aceita pelo responsável técnico a F05 provisória, a preservação de edição na sessão e o roteamento por hash; acrescenta mapa de seletores proposto, foco, coordenação de arquivos e pendências técnicas de materiais. |

## 12. Rastreabilidade

- [Issue #34 — Navegação / contrato v1.0](https://github.com/GabrielRans/nailflow/issues/34#issuecomment-6424858338)
- [Revisão de 0S1mple1](https://github.com/GabrielRans/nailflow/issues/34#issuecomment-6428367802)
- [Resposta de alinhamento de GabrielRans](https://github.com/GabrielRans/nailflow/issues/34#issuecomment-6429599438)
- [Issue #29 — RF06](https://github.com/GabrielRans/nailflow/issues/29), [Issue #30 — PL04](https://github.com/GabrielRans/nailflow/issues/30), [Issue #7 — Materiais](https://github.com/GabrielRans/nailflow/issues/7), [Issue #31 — Interface F04/F05](https://github.com/GabrielRans/nailflow/issues/31), [Issue #25 — UX Dashboard](https://github.com/GabrielRans/nailflow/issues/25), [Issue #33 — Testes](https://github.com/GabrielRans/nailflow/issues/33).
