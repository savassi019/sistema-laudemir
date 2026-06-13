# Arquitetura

## Stack
- Frontend: Next.js com TypeScript.
- Estilo: Tailwind CSS.
- Backend: Route Handlers do Next.js com servicos de dominio.
- Banco: PostgreSQL.
- ORM: Prisma.
- Autenticacao: JWT em cookie HttpOnly.

## Camadas
- Apresentacao: paginas, componentes, formulários e dashboard.
- Dominio: servicos de negocio, consolidacao e regras.
- Dados: Prisma, schema, seed e consultas.
- Integracoes: WhatsApp, PDF, notificacoes e upload futuro.

## Estrutura
- `src/app`: rotas e paginas.
- `src/components`: componentes reutilizaveis.
- `src/lib`: auth, prisma, formatacao e utilitarios.
- `src/server/services`: consultas e regras consolidadas.
- `prisma`: schema e seed.
- `docs`: requisitos, arquitetura e planos.

## Decisoes
- Modo demo local para testar sem infraestrutura externa.
- PostgreSQL mantido como destino final.
- Motor financeiro unificado para todos os modulos.
- Tenancy por organizacao para evoluir para multiempresa.
