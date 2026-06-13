# Regras e fluxos

## Login
- Email e senha.
- Cookie HttpOnly com JWT.
- Usuario sem permissao nao entra no modulo.

## Financeiro
- Entrada e saida entram no ledger central.
- Parcial atualiza `paidAmount` e `remainingAmount`.
- Pendente vira atraso quando vence.
- Comprovante pode ser anexado ao pagamento.

## Clientes
- Cliente pode ser ativo, inativo, inadimplente ou excecao.
- Historico consolidado por cliente e por modulo.

## Permissoes
- Dono acessa tudo.
- Admin gerencia usuarios e relatorios.
- Funcionario ve apenas modulos liberados.

## Fluxos
- Cadastro -> validacao -> gravacao -> auditoria.
- Pagamento -> comprovante -> atualizacao de saldo -> notificacao futura.
- Contrato -> assinatura -> arquivo -> vinculo com financeiro.
