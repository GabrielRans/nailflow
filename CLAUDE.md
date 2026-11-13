# NailFlow

App de gestão para estúdios de unhas. Front-end estático em HTML, CSS e JavaScript puro, com Supabase (auth + banco) e deploy no Cloudflare Pages.

## Regras inegociáveis
- Stack: APENAS HTML, CSS e JavaScript puro. Nunca Python.
- NUNCA criar scripts auxiliares (.py, .js, .sh) para gerar ou editar arquivos. Editar direto com Edit/Write.
- Se uma edição falhar, pare e me avise em vez de contornar. Se um teste for difícil de editar, simplifique-o.
- Arquivos temporários só em /tmp, nunca na raiz do projeto.
- Não alterar js/auth.js nem a função escaparHtml (js/materiais-ui.js) sem pedido explícito.
- Nunca fazer commit nem push sem eu pedir.
- Ignorar: node_modules/, supabase/.temp/, supabase/migrations/.

## Arquitetura
- js/*.js são scripts CLÁSSICOS (não módulos) e compartilham UM escopo global.
  Qualquer function, const, let ou var de nível superior com o mesmo nome em outro arquivo
  causa bug: function sobrescreve a outra; const/let repetido dá SyntaxError e derruba o arquivo.
  Use nomes únicos com sufixo do domínio (obterRepositorioFinanceiro, obterRepositorioMateriais)
  e rode grep antes de criar qualquer nome novo.
- Só js/auth.js, js/supabase-client.js e js/repositories/*.js são ES modules.
- Ordem no index.html: supabase-client.js, auth.js (módulos); depois app.js, materiais.js,
  movimentacoes-ui.js, dashboard-ui.js, navegacao.js, materiais-ui.js, toast.js (defer).
- Módulos de domínio: app.js = financeiro (window.NailFlow.financeiro), materiais.js = materiais
  (window.NailFlow.materiais), materiais-ui.js = UI de materiais.
- Em produção usar SOMENTE as funções *Async (Supabase). As síncronas existem só para testes.
- Eventos globais: movimentacoes:atualizadas, materiais:atualizados, auth:login, auth:logout,
  auth:authenticated, auth:unauthorized, auth:pronto.
- Regra de reposição: quantidadeDisponivel <= quantidadeMinima (dashboard e lista devem usar a mesma).

## Banco (Supabase)
- Tabelas: estudios, usuarios, movimentacoes, materiais. Isolamento por estudio_id via RLS.
- Timestamps: criado_em e atualizado_em. NUNCA created_at/updated_at.
- Delete: .select('id') e checar data.length. Nunca head: true com count.
- Objetos de domínio usam camelCase (quantidadeDisponivel); colunas usam snake_case (quantidade_disponivel).

## Interface
- Seguir os wireframes aprovados pela cliente em docs/WIREFRAME/ (estrutura, textos, componentes).
  Manter a paleta vinho (--primary #7C435C); o wireframe vale para layout, não para cor.
- Textos em português do Brasil. Escapar todo texto de usuário antes de inserir em HTML.
- Acessibilidade: labels associados, aria-label em botões de ícone, foco visível, alvos de toque >= 44px.
- Mobile-first; no mobile há barra de navegação inferior (.bottom-nav).
- Pendente: adicionar viewport-fit=cover e safe-area no cabeçalho (iPhone).

## Testes e verificação
- npm test (node:test, CommonJS com require, nada de import).
- Rodar node --check em todo JS alterado antes de dizer que terminou.
- Ao mexer em UI, atualizar os testes que dependem de textos/estrutura.

## Fluxo de trabalho
- Uma tarefa por vez. Commits pequenos, um assunto só, no estilo
  tipo(escopo): descrição em português (feat, fix, style, test, docs).
- Antes de implementar, verificar se já existe; se existir, só revisar.
- Deploy: Cloudflare Pages gera URL por branch/deploy. Testar na URL nova com Ctrl+Shift+R.
