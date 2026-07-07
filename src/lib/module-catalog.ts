import type { ModuleName } from "@/types/app";

export type ModuleGroupKey =
  | "core"
  | "field"
  | "special"
  | "business"
  | "transversal";

export type ModuleAccent = "slate" | "emerald" | "amber" | "violet" | "blue";
export type ModuleStage = "Base pronta" | "Fase 2" | "Fase 3" | "Fase 4";
export type ModuleIconKey =
  | "shield"
  | "ticket"
  | "calendar"
  | "table"
  | "gift"
  | "wallet"
  | "coins"
  | "badge"
  | "store"
  | "megaphone"
  | "globe"
  | "users"
  | "notebook"
  | "receipt";

export type ModuleCatalogItem = {
  module: ModuleName;
  slug: string;
  title: string;
  summary: string;
  detail: string;
  group: ModuleGroupKey;
  accent: ModuleAccent;
  stage: ModuleStage;
  icon: ModuleIconKey;
  href?: string;
};

export const moduleGroups: Record<
  ModuleGroupKey,
  { title: string; description: string }
> = {
  core: {
    title: "Core do sistema",
    description:
      "Autenticação, acesso por módulo, financeiro global, agenda e configurações.",
  },
  field: {
    title: "Operações de campo",
    description:
      "Fluxos mais usados por funcionário em rua, rota, coleta e atendimento.",
  },
  special: {
    title: "Operações financeiras especiais",
    description:
      "Rotinas com regras de comprovante, divisão, juros, negativo e histórico.",
  },
  business: {
    title: "Gestão de negócios",
    description:
      "Visão de contratos, mercado, marketing e plataformas complementares.",
  },
  transversal: {
    title: "Funcionalidades transversais",
    description:
      "Blocos que atendem todos os módulos e reforçam operação, controle e conversão.",
  },
};

export const moduleCatalog: ModuleCatalogItem[] = [
  {
    module: "CORE",
    slug: "core-do-sistema",
    title: "Core do sistema",
    summary: "Acesso, permissões e motor central",
    detail: "Login seguro, controle por módulo, financeiro global e agenda.",
    group: "core",
    accent: "slate",
    stage: "Base pronta",
    icon: "shield",
    href: "/dashboard",
  },
  {
    module: "CARRETA_KIDS",
    slug: "carreta-kids",
    title: "Carreta Kids",
    summary: "Controle por tempo e ficha",
    detail: "Tempo, local, entrada, saída, tabela de preço e despesas.",
    group: "field",
    accent: "emerald",
    stage: "Fase 2",
    icon: "ticket",
    href: "/modulos/carreta-kids",
  },
  {
    module: "RENTAL",
    slug: "locacao",
    title: "Locação",
    summary: "Reservas, sinal e contrato",
    detail: "Nome, telefone, local, documento, data, sinal opcional e pendências.",
    group: "field",
    accent: "emerald",
    stage: "Fase 2",
    icon: "calendar",
    href: "/modulos/locacao",
  },
  {
    module: "BILLIARD",
    slug: "bilhar-pebolim",
    title: "Bilhar / Pebolim",
    summary: "Rotas, fichas e telhado",
    detail: "Rotas, fichas, quinzena, telhado, contrato, manutenção e alerta de pano.",
    group: "field",
    accent: "emerald",
    stage: "Fase 2",
    icon: "table",
    href: "/modulos/bilhar-pebolim",
  },
  {
    module: "PLUSH",
    slug: "maquinas-de-pelucia",
    title: "Máquinas de Pelúcia",
    summary: "Gruas e comissão",
    detail: "Máquinas, pontos, duas fotos, pelúcias, noteiro, desconto e viabilidade.",
    group: "field",
    accent: "emerald",
    stage: "Fase 2",
    icon: "gift",
    href: "/modulos/maquinas-de-pelucia",
  },
  {
    module: "BX",
    slug: "bx",
    title: "BX",
    summary: "Entradas e saídas com comprovante",
    detail: "Duas fotos, cliente exceção, recolhe, negativo, desconto e status recebido.",
    group: "special",
    accent: "amber",
    stage: "Fase 3",
    icon: "wallet",
    href: "/modulos/bx",
  },
  {
    module: "SLOT_H",
    slug: "h-caca-niquel",
    title: "H (Caça-níquel)",
    summary: "Divisão e negativo",
    detail: "Entrada/saída atual e anterior, percentual, negativo, dívida e conferências.",
    group: "special",
    accent: "amber",
    stage: "Fase 3",
    icon: "coins",
    href: "/modulos/h-caca-niquel",
  },
  {
    module: "MACHINE",
    slug: "credito-financeiro",
    title: "Crédito Financeiro",
    summary: "Empréstimos e garantias",
    detail: "Contratos, garantias, percentual, juros, parcela fixa e pendências.",
    group: "special",
    accent: "amber",
    stage: "Fase 3",
    icon: "badge",
    href: "/modulos/credito-financeiro",
  },
  {
    module: "CONDOMINIUM_MARKET",
    slug: "mercado-autonomo",
    title: "Mercado Autônomo",
    summary: "Financeiro manual",
    detail: "Entrada, saída, despesa, lucro bruto e lucro líquido.",
    group: "business",
    accent: "violet",
    stage: "Fase 3",
    icon: "store",
    href: "/modulos/mercado-autonomo",
  },
  {
    module: "MARKETING",
    slug: "marketing",
    title: "Marketing",
    summary: "Contrato e assinatura",
    detail: "Serviço, valor, GOV, cliente, endereço e arquivo final.",
    group: "business",
    accent: "violet",
    stage: "Fase 3",
    icon: "megaphone",
    href: "/modulos/marketing",
  },
  {
    module: "BRASIL_BETS",
    slug: "plataforma-online",
    title: "Plataforma Online",
    summary: "Financeiro do brinde",
    detail: "Entradas, saídas, despesas e relatórios enxutos.",
    group: "business",
    accent: "violet",
    stage: "Fase 3",
    icon: "globe",
    href: "/modulos/plataforma-online",
  },
  {
    module: "PERSONAL_FINANCE",
    slug: "financas-pessoais",
    title: "Finanças Pessoais",
    summary: "Receitas, despesas e agenda",
    detail: "Receitas, despesas, contas a pagar, notas, agenda e totais por período.",
    group: "business",
    accent: "violet",
    stage: "Fase 3",
    icon: "notebook",
    href: "/modulos/financas-pessoais",
  },
  {
    module: "FINANCE",
    slug: "financeiro-global",
    title: "Financeiro global",
    summary: "Pagamento, parcial e saldo",
    detail: "Consolidado por período com entradas, saídas, despesas e comprovantes.",
    group: "transversal",
    accent: "blue",
    stage: "Base pronta",
    icon: "wallet",
    href: "/financeiro",
  },
  {
    module: "CLIENTS",
    slug: "cadastro-de-clientes",
    title: "Cadastro de clientes",
    summary: "Dívida, parcial e histórico",
    detail: "Telefone, documento, endereço, anexos e timeline completa.",
    group: "transversal",
    accent: "blue",
    stage: "Base pronta",
    icon: "users",
    href: "/clientes",
  },
  {
    module: "REPORTS",
    slug: "comprovantes-whatsapp",
    title: "Comprovantes / WhatsApp",
    summary: "Envio automático entre módulos",
    detail: "Comprovantes, notificações e disparos por etapa operacional.",
    group: "transversal",
    accent: "blue",
    stage: "Fase 4",
    icon: "receipt",
  },
];

const hiddenGroups: ModuleGroupKey[] = ["core"];

export function getVisibleModuleGroups(activeModules: ModuleName[]) {
  return Object.entries(moduleGroups)
    .filter(([key]) => !hiddenGroups.includes(key as ModuleGroupKey))
    .map(([key, group]) => {
      const items = moduleCatalog
        .filter((item) => item.group === key && activeModules.includes(item.module))
        .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));

      return {
        key: key as ModuleGroupKey,
        title: group.title,
        description: group.description,
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}

export function getVisibleModulesFlat(activeModules: ModuleName[]) {
  return moduleCatalog
    .filter((item) => !hiddenGroups.includes(item.group) && activeModules.includes(item.module))
    .sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
}

export function getModuleBySlug(slug: string) {
  return moduleCatalog.find((item) => item.slug === slug);
}

export const readyModuleSlugs = [
  "carreta-kids",
  "locacao",
  "maquinas-de-pelucia",
  "bx",
  "bilhar-pebolim",
  "h-caca-niquel",
  "credito-financeiro",
  "mercado-autonomo",
  "marketing",
  "plataforma-online",
  "financas-pessoais",
] as const;

export function isModuleReady(slug: string) {
  return readyModuleSlugs.includes(slug as (typeof readyModuleSlugs)[number]);
}
