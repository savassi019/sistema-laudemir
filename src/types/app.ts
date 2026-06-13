export type RoleName = "OWNER" | "ADMIN" | "STAFF";

export type ModuleName =
  | "CORE"
  | "DASHBOARD"
  | "CLIENTS"
  | "FINANCE"
  | "REPORTS"
  | "SETTINGS"
  | "CARRETA_KIDS"
  | "RENTAL"
  | "PLUSH"
  | "BILLIARD"
  | "BRASIL_BETS"
  | "MACHINE"
  | "CONDOMINIUM_MARKET"
  | "MARKETING"
  | "PERSONAL_FINANCE"
  | "BX"
  | "SLOT_H";

export type SessionData = {
  userId: string;
  organizationId: string;
  name: string;
  email: string;
  role: RoleName;
  modules: ModuleName[];
};

export type DashboardMetric = {
  label: string;
  value: string;
  helper: string;
  tone: "emerald" | "amber" | "rose" | "sky";
};

export type ChartPoint = {
  label: string;
  receitas: number;
  despesas: number;
};

export type ReminderItem = {
  id: string;
  title: string;
  dueAt: string;
  owner: string;
  status: "aberto" | "feito";
};

export type SpotlightItem = {
  title: string;
  description: string;
  tone: "default" | "warning" | "success";
};

export type DashboardOverview = {
  metrics: DashboardMetric[];
  cashflow: ChartPoint[];
  reminders: ReminderItem[];
  spotlights: SpotlightItem[];
};

export type ClientListItem = {
  id: string;
  code: string;
  name: string;
  phone: string;
  city: string;
  status: "ativo" | "inativo" | "inadimplente" | "excecao";
  balance: number;
  updatedAt: string;
};

export type FinanceEntryListItem = {
  id: string;
  reference: string;
  description: string;
  module: string;
  status: "pago" | "parcial" | "pendente" | "atrasado";
  amount: number;
  paid: number;
  remaining: number;
  dueDate: string;
  method: string;
  customer?: string;
};

export type FinanceOverview = {
  cards: DashboardMetric[];
  entries: FinanceEntryListItem[];
};
