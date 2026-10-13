import type { ModuleSlug } from "@/server/services/module-record-service";

export type ModuleCapabilities = {
  clients: boolean;
  visit: boolean;
  finance: boolean;
  receipts: boolean;
  routes: boolean;
  calendar: boolean;
  prize: boolean;
  employeeCash: boolean;
};

const standardFieldModule: ModuleCapabilities = {
  clients: true,
  visit: true,
  finance: true,
  receipts: true,
  routes: false,
  calendar: false,
  prize: false,
  employeeCash: true,
};

/**
 * Fonte unica para as secoes compartilhadas. Ao adicionar um modulo, o
 * TypeScript exige declarar suas capacidades e evita menus diferentes por
 * acidente entre celular, financeiro, historico e comprovantes.
 */
export const MODULE_CAPABILITIES = {
  "carreta-kids": standardFieldModule,
  "maquinas-de-pelucia": standardFieldModule,
  "bilhar-pebolim": { ...standardFieldModule, routes: true },
  bx: { ...standardFieldModule, prize: true },
  "h-caca-niquel": standardFieldModule,
  locacao: standardFieldModule,
  "credito-financeiro": {
    clients: true,
    visit: false,
    finance: true,
    receipts: false,
    routes: false,
    calendar: false,
    prize: false,
    employeeCash: true,
  },
  marketing: {
    clients: true,
    visit: false,
    finance: false,
    receipts: false,
    routes: false,
    calendar: true,
    prize: false,
    employeeCash: false,
  },
  "mercado-autonomo": {
    clients: false,
    visit: false,
    finance: true,
    receipts: false,
    routes: false,
    calendar: false,
    prize: false,
    employeeCash: true,
  },
  "plataforma-online": {
    clients: false,
    visit: false,
    finance: true,
    receipts: false,
    routes: false,
    calendar: false,
    prize: false,
    employeeCash: true,
  },
  "financas-pessoais": {
    clients: false,
    visit: false,
    finance: true,
    receipts: false,
    routes: false,
    calendar: false,
    prize: false,
    employeeCash: true,
  },
} satisfies Record<ModuleSlug, ModuleCapabilities>;
