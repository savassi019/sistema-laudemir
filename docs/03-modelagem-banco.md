# Modelagem do banco

## Nucleo
- Organization
- User
- ModulePermission
- SystemSetting
- Client
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
- Entrada financeira guarda valor total, pago, restante, desconto e juros.
- Pagamento parcial nunca apaga saldo restante.
- Comprovantes ficam em `FileAsset`.
- Auditoria registra alteracoes de eventos sensiveis.
