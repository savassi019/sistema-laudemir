# Modelagem do banco

## Nucleo
- Organization
- User
- ModulePermission
- SystemSetting
- Client
- ModuleClient
- FinancialAccount
- FinancialCategory
- FinancialEntry
- Payment
- FileAsset
- Note
- Reminder
- Notification
- AuditLog

## Modulos especificos
- CarretaKidsRecord
- RentalOrder
- PlushMachine
- PlushCollection
- BilliardPoint
- BilliardCollection
- BilliardMaintenance
- RoutePlan
- BrazilBetsEntry
- MachineContract
- MachineGuarantee
- CondominiumMarketEntry
- MarketingContract
- PersonalFinanceRecord
- BxTransaction
- SlotMachine
- SlotCollection

## Regras da modelagem
- Toda entidade relevante carrega `organizationId`.
- O cadastro principal de cliente continua unico, mas o vinculo operacional fica em `ModuleClient`, separado por modulo.
- Cada modulo deve filtrar seus clientes por `ModuleClient.module`.
- Cada modulo deve filtrar suas entradas, recebimentos, parciais e despesas por `FinancialEntry.module`.
- Despesas operacionais devem usar `FinancialEntry.direction = EXPENSE` e, quando aplicavel, `FinancialEntry.kind = EXPENSE`.
- Entrada financeira guarda valor total, pago, restante, desconto e juros.
- Pagamento parcial nunca apaga saldo restante.
- Comprovantes ficam em `FileAsset`.
- Auditoria registra alteracoes de eventos sensiveis.
