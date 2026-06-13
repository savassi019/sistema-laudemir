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
  | "table"
  | "gift"
  | "wallet"
  | "coins"
  | "badge"
  | "store"
  | "megaphone"
  | "globe"
  | "users"
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
      "Autenticacao, acesso por modulo, financeiro global, agenda e configuracoes.",
  },
  field: {
    title: "Operacoes de campo",
    description:
      "Fluxos mais usados por funcionario em rua, rota, coleta e atendimento.",
  },
  special: {
    title: "Operacoes financeiras especiais",
    description:
      "Rotinas com regras de comprovante, divisao, juros, negativo e historico.",
  },
  business: {
    title: "Gestao de negocios",
    description:
      "Visao de contratos, mercado, marketing e plataformas complementares.",
  },
  transversal: {
    title: "Funcionalidades transversais",
    description:
      "Blocos que atendem todos os modulos e reforcam operacao, controle e conversao.",
  },
};

export const moduleCatalog: ModuleCatalogItem[] = [
  {
    module: "CORE",
    slug: "core-do-sistema",
    title: "Core do sistema",
    summary: "Acesso, permissoes e motor central",
    detail: "Login seguro, controle por modulo, financeiro global e agenda.",
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
    detail: "Tempo, local, entrada, saida, tabela de preco e despesas.",
    group: "field",
    accent: "emerald",
    stage: "Fase 2",
    icon: "ticket",
    href: "/modulos/carreta-kids",
  },
  {
    module: "BILLIARD",
    slug: "bilhar-pebolim",
    title: "Bilhar / Pebolim",
    summary: "Rotas, fichas e telhado",
    detail: "Rotas, manutencao, contratos, custo e alerta de troca de pano.",
    group: "field",
    accent: "emerald",
    stage: "Fase 2",
    icon: "table",
    href: "/modulos/bilhar-pebolim",
  },
  {
    module: "PLUSH",
    slug: "maquinas-de-pelucia",
    title: "Maquinas de Pelucia",
    summary: "Gruas e comissao",
    detail: "Fotos coin/gift, percentual, noteiro e comprovante.",
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
    summary: "Entradas e saidas com comprovante",
    detail: "Fotos obrigatorias, agente, desconto, recebido e excecao.",
    group: "special",
    accent: "amber",
    stage: "Fase 3",
    icon: "wallet",
    href: "/modulos/bx",
  },
  {
    module: "SLOT_H",
    slug: "h-caca-niquel",
    title: "H (Caca-niquel)",
    summary: "Divisao e negativo",
    detail: "Entrada/saida, 50%, divida, negativo e conferencias.",
    group: "special",
    accent: "amber",
    stage: "Fase 3",
    icon: "coins",
    href: "/modulos/h-caca-niquel",
  },
  {
    module: "MACHINE",
    slug: "credito-financeiro",
    title: "Credito Financeiro",
    summary: "Emprestimos e garantias",
    detail: "Juros, parcela fixa, assinatura digital e historico.",
    group: "special",
    accent: "amber",
    stage: "Fase 3",
    icon: "badge",
    href: "/modulos/credito-financeiro",
  },
  {
    module: "CONDOMINIUM_MARKET",
    slug: "mercado-autonomo",
    title: "Mercado Autonomo",
    summary: "Financeiro manual",
    detail: "Entrada, saida, despesa, lucro bruto e lucro liquido.",
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
    detail: "Servico, valor, GOV, cliente, endereco e arquivo final.",
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
    detail: "Entradas, saidas, despesas e relatorios enxutos.",
    group: "business",
    accent: "violet",
    stage: "Fase 3",
    icon: "globe",
    href: "/modulos/plataforma-online",
  },
  {
    module: "FINANCE",
    slug: "financeiro-global",
    title: "Financeiro global",
    summary: "Pagamento, parcial e saldo",
    detail: "Consolidado por periodo com entradas, saidas, despesas e comprovantes.",
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
    summary: "Divida, parcial e historico",
    detail: "Telefone, documento, endereco, anexos e timeline completa.",
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
    summary: "Envio automatico entre modulos",
    detail: "Comprovantes, notificacoes e disparos por etapa operacional.",
    group: "transversal",
    accent: "blue",
    stage: "Fase 4",
    icon: "receipt",
    href: "/modulos/comprovantes-whatsapp",
  },
];

export function getVisibleModuleGroups(activeModules: ModuleName[]) {
  return Object.entries(moduleGroups)
    .map(([key, group]) => {
      const items = moduleCatalog.filter(
        (item) =>
          item.group === key && activeModules.includes(item.module),
      );

      return {
        key: key as ModuleGroupKey,
        title: group.title,
        description: group.description,
        items,
      };
    })
    .filter((group) => group.items.length > 0);
}

export function getModuleBySlug(slug: string) {
  return moduleCatalog.find((item) => item.slug === slug);
}
