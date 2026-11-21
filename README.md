# NailFlow

Aplicação web desenvolvida no projeto extensionista do curso de Análise e Desenvolvimento de Sistemas da UniEVANGÉLICA para auxiliar uma profissional autônoma de Nail Art na gestão financeira e no controle de materiais.

## Status

Projeto em desenvolvimento. As funcionalidades e os controles descritos neste documento devem ser considerados conforme o estado efetivamente implementado e validado; itens ainda não homologados estão identificados como limitações ou pendências.

## Tecnologias

- HTML5 e CSS3
- JavaScript com ES Modules
- Supabase: PostgreSQL e Auth
- Cloudflare Pages para hospedagem

O frontend utiliza o cliente JavaScript do Supabase. Não há backend Node.js próprio na arquitetura atual.

## Arquitetura e dados

O modelo de dados é organizado por estúdio. A entidade `estudios` representa o espaço de trabalho, e os registros operacionais são associados por `estudio_id`.

As tabelas identificadas no banco são:

- `estudios`: cadastro dos estúdios.
- `usuarios`: vínculo entre a identidade autenticada e o estúdio, incluindo o papel do usuário.
- `materiais`: materiais e quantidades disponíveis, associados ao estúdio por `estudio_id`.
- `movimentacoes`: movimentações financeiras, associadas ao estúdio e ao usuário responsável.

A tabela `materiais` não possui coluna `usuario_id`; seu vínculo de isolamento é feito por `estudio_id`. A view `materiais_baixo_estoque` apresenta materiais cuja quantidade disponível é menor ou igual à quantidade mínima.

## Autenticação e autorização

A autenticação configurada no fluxo atual é por e-mail e senha, utilizando Supabase Auth.

Autenticação e autorização são etapas distintas:

- **Autenticação:** confirma a identidade do usuário por meio da sessão do Supabase Auth.
- **Autorização:** o usuário precisa possuir vínculo válido com um estúdio na tabela `usuarios` para acessar os dados da aplicação.

O login, portanto, não deve conceder acesso automaticamente a qualquer conta autenticada. O vínculo com o estúdio e as políticas de Row Level Security (RLS) determinam o acesso permitido.

O modelo atual contempla uma proprietária inicial e mantém a associação dos registros ao estúdio. O gerenciamento de funcionários e a ampliação do acesso são evoluções futuras, não parte do escopo inicial.

## Segurança e isolamento

A proteção dos dados é baseada em PostgreSQL Row Level Security (RLS), com políticas nas tabelas `estudios`, `materiais`, `movimentacoes` e `usuarios`.

As operações permitidas também dependem dos privilégios SQL concedidos aos papéis do banco. A presença de RLS, isoladamente, não substitui a revisão desses privilégios.

Uma auditoria de metadados realizada em 20/11/2026 identificou concessões de privilégios que precisam ser revisadas, além de pontos de hardening em funções `SECURITY DEFINER`. A validação funcional do isolamento entre estúdios e a correção desses achados estão pendentes na Issue #55. Os resultados da inspeção de catálogos não equivalem a um pentest nem comprovam, por si só, exploração pela API.

A chave pública do Supabase utilizada pelo cliente pode estar no frontend conforme o modelo de acesso do Supabase e desde que as políticas e privilégios estejam corretamente configurados. **Chaves secretas, como `service_role`, senhas e credenciais administrativas não devem ser incluídas no código frontend nem versionadas.**

## Persistência, falhas e recuperação

Os dados operacionais são persistidos no PostgreSQL do Supabase. A aplicação não deve recorrer silenciosamente a armazenamento local como substituto de persistência em produção.

A estratégia de backup e recuperação ainda precisa ser definida, documentada e testada. Não se deve considerar como garantidos, neste projeto, PITR, backups automáticos ou prazos específicos de retenção no plano gratuito do Supabase. Consulte a Issue #32 para o planejamento de backup e recuperação.

## Limitações e pendências conhecidas

- A validação funcional do isolamento RLS entre estúdios ainda está pendente.
- A revisão dos privilégios SQL e das funções `SECURITY DEFINER` está em andamento na Issue #55.
- O fluxo de recuperação de senha depende da configuração e homologação do envio de e-mails; não deve ser considerado homologado até a realização dos testes.
- Não há suporte offline confirmado; as operações dependem de conectividade com os serviços utilizados.
- A estratégia de backup e restauração ainda não foi homologada.
- A homologação com a parceira e em dispositivos móveis deve ser registrada como evidência própria; não é presumida pela existência de testes automatizados.

## Deploy

A aplicação está hospedada no Cloudflare Pages.

Os headers de segurança configurados no arquivo `_headers` incluem:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

A política de Content Security Policy (CSP) permanece sujeita a revisão.

## Testes

Os testes automatizados do projeto são executados com o runner nativo de testes do Node.js. Consulte o `package.json` para os comandos disponíveis e a estrutura `test/` para os casos existentes.

A existência de testes unitários não substitui testes de integração com Supabase, testes de autorização/RLS, testes ponta a ponta, restauração de backup ou homologação com a parceira.

## Issues relacionadas

- [#32 — Backup e recuperação](https://github.com/GabrielRans/nailflow/issues/32)
- [#33 — Testes de regressão e evidências](https://github.com/GabrielRans/nailflow/issues/33)
- [#53 — Autenticação e recuperação de senha](https://github.com/GabrielRans/nailflow/issues/53)
- [#55 — Privilégios PostgreSQL, funções SECURITY DEFINER e isolamento RLS](https://github.com/GabrielRans/nailflow/issues/55)
