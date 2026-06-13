import type {
  ClientListItem,
  DashboardOverview,
  FinanceOverview,
  SessionData,
} from "@/types/app";

type DemoAccount = {
  label: string;
  helper: string;
  email: string;
  password: string;
  session: SessionData;
};

export const demoAccounts: DemoAccount[] = [
  {
    label: "Funcionario",
    helper: "Visao enxuta para rotina no celular",
    email: "funcionario@svs-demo.local",
    password: "Funcionario@12345",
    session: {
      userId: "demo-user-2",
      organizationId: "demo-org-1",
      name: "Equipe Campo Demo",
      email: "funcionario@svs-demo.local",
      role: "STAFF",
      modules: [
        "DASHBOARD",
        "CLIENTS",
        "FINANCE",
        "CARRETA_KIDS",
        "BILLIARD",
        "PLUSH",
        "BX",
        "SLOT_H",
      ],
    },
  },
  {
    label: "Dono",
    helper: "Visao completa de operacao e negocio",
    email: "admin@svs-demo.local",
    password: "Admin@12345",
    session: {
      userId: "demo-user-1",
      organizationId: "demo-org-1",
      name: "Administrador Demo",
      email: "admin@svs-demo.local",
      role: "OWNER",
      modules: [
        "CORE",
        "DASHBOARD",
        "CLIENTS",
        "FINANCE",
        "REPORTS",
        "SETTINGS",
        "CARRETA_KIDS",
        "RENTAL",
        "PLUSH",
        "BILLIARD",
        "BRASIL_BETS",
        "MACHINE",
        "CONDOMINIUM_MARKET",
        "MARKETING",
        "PERSONAL_FINANCE",
        "BX",
        "SLOT_H",
      ],
    },
  },
];

export const defaultDemoAccount = demoAccounts[0];

export const demoDashboard: DashboardOverview = {
  metrics: [
    {
      label: "Receita recebida",
      value: "R$ 48.320",
      helper: "Ultimos 30 dias no consolidado financeiro",
      tone: "emerald",
    },
    {
      label: "Pagamentos pendentes",
      value: "R$ 12.480",
      helper: "Titulos em aberto e contas a pagar",
      tone: "amber",
    },
    {
      label: "Clientes inadimplentes",
      value: "18",
      helper: "Clientes com saldo vencido ou parcial",
      tone: "rose",
    },
    {
      label: "Lucro liquido",
      value: "R$ 21.940",
      helper: "Resultado liquido apos despesas operacionais",
      tone: "sky",
    },
  ],
  cashflow: [
    { label: "Seg", receitas: 8400, despesas: 3200 },
    { label: "Ter", receitas: 9200, despesas: 4100 },
    { label: "Qua", receitas: 7800, despesas: 3500 },
    { label: "Qui", receitas: 9600, despesas: 4200 },
    { label: "Sex", receitas: 11200, despesas: 4600 },
    { label: "Sab", receitas: 7400, despesas: 2800 },
  ],
  reminders: [
    {
      id: "rem-1",
      title: "Fechamento da rota 03",
      dueAt: "Hoje, 18:30",
      owner: "Equipe externa",
      status: "aberto",
    },
    {
      id: "rem-2",
      title: "Enviar contrato de locacao revisado",
      dueAt: "Amanha, 09:00",
      owner: "Administrativo",
      status: "aberto",
    },
    {
      id: "rem-3",
      title: "Cobrar cliente com parcial atrasado",
      dueAt: "Amanha, 11:00",
      owner: "Financeiro",
      status: "aberto",
    },
  ],
  spotlights: [
    {
      title: "Motor financeiro unificado",
      description:
        "Todas as entradas, saidas, contas a pagar, parciais e dividas convergem para um unico ledger auditavel.",
      tone: "default",
    },
    {
      title: "Permissoes por modulo",
      description:
        "O dono acessa tudo, administradores gerenciam operacao e funcionarios entram so nos modulos liberados.",
      tone: "success",
    },
    {
      title: "WhatsApp e comprovantes",
      description:
        "A base ja fica pronta para notificacoes, envio de comprovantes e trilha de auditoria por evento.",
      tone: "warning",
    },
  ],
};

export const demoClients: ClientListItem[] = [
  {
    id: "cli-1",
    code: "CLI-0001",
    name: "Carlos Henrique",
    phone: "(11) 98888-1111",
    city: "Sao Paulo",
    status: "ativo",
    balance: 0,
    updatedAt: "2026-06-10T10:30:00.000Z",
  },
  {
    id: "cli-2",
    code: "CLI-0002",
    name: "Loja Central Kids",
    phone: "(11) 97777-2222",
    city: "Guarulhos",
    status: "inadimplente",
    balance: 1240,
    updatedAt: "2026-06-09T14:00:00.000Z",
  },
  {
    id: "cli-3",
    code: "CLI-0003",
    name: "Thiago Souza",
    phone: "(11) 96666-3434",
    city: "Osasco",
    status: "excecao",
    balance: 420,
    updatedAt: "2026-06-08T09:20:00.000Z",
  },
  {
    id: "cli-4",
    code: "CLI-0004",
    name: "Mercado Condominio Azul",
    phone: "(11) 95555-1010",
    city: "Barueri",
    status: "ativo",
    balance: 320,
    updatedAt: "2026-06-07T18:10:00.000Z",
  },
];

export const demoFinance: FinanceOverview = {
  cards: [
    {
      label: "Total recebido",
      value: "R$ 48.320",
      helper: "Entradas liquidadas no periodo atual",
      tone: "emerald",
    },
    {
      label: "Contas a pagar",
      value: "R$ 7.950",
      helper: "Titulos ainda nao quitados",
      tone: "amber",
    },
    {
      label: "Parciais em aberto",
      value: "R$ 4.530",
      helper: "Lancamentos com baixa parcial",
      tone: "rose",
    },
    {
      label: "Saldo liquido",
      value: "R$ 21.940",
      helper: "Receitas menos despesas consolidadas",
      tone: "sky",
    },
  ],
  entries: [
    {
      id: "fin-1",
      reference: "FIN-0001",
      description: "Fechamento quinzenal - ponto rota 03",
      module: "Bilhar e pebolim",
      status: "pago",
      amount: 2400,
      paid: 2400,
      remaining: 0,
      dueDate: "2026-06-08T00:00:00.000Z",
      method: "PIX",
      customer: "Carlos Henrique",
    },
    {
      id: "fin-2",
      reference: "FIN-0002",
      description: "Compra de pecas e manutencao",
      module: "Financeiro geral",
      status: "parcial",
      amount: 1350,
      paid: 800,
      remaining: 550,
      dueDate: "2026-06-12T00:00:00.000Z",
      method: "Transferencia",
    },
    {
      id: "fin-3",
      reference: "FIN-0003",
      description: "Telhado em aberto no ponto 18",
      module: "Bilhar e pebolim",
      status: "pendente",
      amount: 980,
      paid: 0,
      remaining: 980,
      dueDate: "2026-06-15T00:00:00.000Z",
      method: "Em aberto",
      customer: "Loja Central Kids",
    },
    {
      id: "fin-4",
      reference: "FIN-0004",
      description: "Recebimento de BX com cliente excecao",
      module: "BX",
      status: "atrasado",
      amount: 620,
      paid: 0,
      remaining: 620,
      dueDate: "2026-06-06T00:00:00.000Z",
      method: "Dinheiro",
      customer: "Thiago Souza",
    },
  ],
};
