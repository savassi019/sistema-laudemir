<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Sistema Laudemir / Infinity ERP

ERP modular mobile-first para operações de campo (bilhar/pebolim, pelúcia,
carreta kids, locação, BX, caça-níquel, crédito financeiro, mercado
autônomo, marketing, plataforma online, finanças pessoais). Cliente real
(Laudemir) usa isso diariamente para fechar caixa em campo — **não é um
projeto de estudo, é produção com dinheiro e dados reais de negócio**.

Uso é ~98% no celular. Qualquer tela nova ou alterada é mobile-first
primeiro: alvo de toque mínimo 44px, `text-base` nos inputs (evita zoom
automático do iOS), `active:` em vez de `hover:`, nunca deixar a página
rolar na horizontal.

## Regras que não podem ser quebradas

**Nunca perder dado, nunca corromper o banco de produção.** Isso vale mais
que qualquer outra prioridade aqui. Antes de qualquer migração de schema,
saber exatamente o que ela faz (aditiva/nula é segura; remover coluna ou
apertar constraint exige confirmação explícita do dono do projeto). Nunca
rodar comando destrutivo (`DROP`, `TRUNCATE`, `db push` com perda de dado)
sem confirmação e sem backup recente confirmado.

**Cada módulo é uma unidade de negócio isolada e completa.** Ver
"checklist padrão" abaixo. Não existe cadastro de cliente compartilhado
entre módulos — cada um guarda seu próprio cliente/contraparte direto no
model do módulo (string, não FK pra uma tabela `Client` genérica). Uma
tentativa antiga de unificar isso foi revertida a pedido do dono.

**Todo módulo (novo ou existente) precisa ter, cada um isoladamente:**
1. Cadastro de cliente/contraparte próprio (nome, telefone, documento)
2. Despesa dedicada, separada da entrada
3. Rastreio de pendência/dívida/parcial (não só entrada-saída simples)
4. Financeiro completo: entrada, despesa e saldo calculado
5. Forma de pagamento
6. Anexo real de comprovante (upload de verdade, não nome de arquivo em texto)
7. Financeiro total E quebra semanal (segunda a sábado)
8. Controle de acesso por módulo pro funcionário (já existe no nível do
   sistema via `ModulePermission`, não duplicar por módulo)

**Funcionário (role STAFF) nunca vê valor financeiro calculado** — nenhum
card/total/soma em nenhum módulo. Campos que ele mesmo digitou continuam
visíveis. Todo componente com número de dinheiro recebe um prop
`hideFinancials` e esconde os totais quando `true`.

**Status/enum nunca aparece cru na tela nem no comprovante.** Enums do
Prisma são em inglês; sempre traduzir via `src/lib/status-labels.ts`
(`rotuloDeStatus(valor, MAPA)`) — nunca `{record.status}` direto em JSX ou
template string. Ao achar um enum cru num lugar, procurar o mesmo padrão
(`record.campo`, `receipt.campo`) em todos os arquivos irmãos antes de
considerar terminado — esse bug tende a estar repetido em vários módulos
de uma vez, não isolado.

**Dinheiro é uma fonte só por módulo.** Não criar um segundo sistema
paralelo de lançamento financeiro pra um módulo que já tem um — isso já
causou bug real (dinheiro lançado num lugar invisível no relatório do
outro). Se o módulo já tem uma tabela de lançamentos, todo relatório novo
soma a partir dela, nunca duplica.

## Armadilhas conhecidas

- **`z.string().optional()` aceita `undefined` mas rejeita `null`.** Usar
  `.nullish()` quando o campo pode vir `null` do formulário (ex.: arquivo
  removido).
- **Data sem hora vira meio-dia UTC, não meia-noite.**
  `new Date("2026-09-08")` é meia-noite UTC = dia anterior no horário do
  Brasil. Usar `new Date("YYYY-MM-DDT12:00:00Z")` para datas soltas
  (sem hora) que precisam cair no dia certo em qualquer fuso razoável.
- **Deploy não puxa código sozinho.** O script de deploy da VPS só
  compila e reinicia — não faz `git pull`. Sempre sincronizar o código
  (`git fetch && git reset --hard origin/main`) antes de rodar o deploy,
  ou ele publica a versão antiga com "sucesso" mesmo assim.
- **Depois de `prisma db push` em produção, rodar `prisma generate` na
  própria VPS antes do build.** O `node_modules` da VPS é separado do
  local; sem isso o build falha por tipo desatualizado do Prisma Client.
- **Server Actions são endpoint público.** Validar tudo de novo no
  servidor — nunca confiar que só o formulário valida.

## Onde procurar antes de perguntar

- `src/server/services/module-record-service.ts` — lógica de negócio de
  todos os 11 módulos operacionais (um `case` por slug, em várias
  funções: criar, listar, listar por cliente).
- `src/lib/status-labels.ts` — toda tradução de enum pra português.
- `src/components/modules/` — um form/tela por módulo.
- `prisma/schema.prisma` — schema completo; ler antes de assumir que um
  campo não existe.
- A pasta `.claude/` neste projeto guarda contexto de sessões anteriores
  do Claude Code (decisões, auditorias, bugs já corrigidos) — útil como
  histórico, mas não é lida automaticamente por outros agentes.

## Infraestrutura

Produção roda numa VPS via PM2 + PostgreSQL em Docker, com backup
automático e monitoramento. Credenciais e endereço do servidor **não
ficam neste arquivo** (é versionado no Git) — perguntar ao dono do
projeto quando precisar fazer deploy ou acessar produção diretamente.
