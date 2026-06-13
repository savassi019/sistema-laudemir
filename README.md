# Sistema de Gestao Modular

Base local em Next.js para um sistema empresarial complexo com financeiro, clientes, permissao por modulo e crescimento por fases.

## Rodar localmente
```bash
npm install
npm run db:generate
npm run dev
```

## Acesso demo
- Funcionario: `funcionario@svs-demo.local` / `Funcionario@12345`
- Dono: `admin@svs-demo.local` / `Admin@12345`

## Banco
- O projeto ja vem preparado para PostgreSQL via Prisma.
- Se quiser testar com banco real, suba o `docker-compose.yml` e depois rode `npm run db:push` e `npm run db:seed`.

## Documentacao
- `docs/01-requisitos.md`
- `docs/02-arquitetura.md`
- `docs/03-modelagem-banco.md`
- `docs/04-regras-e-fluxos.md`
- `docs/05-apis.md`
- `docs/06-plano-de-execucao.md`
