import type { ModuleName } from "@/types/app";

export const primaryNavigation: Array<{
  href: string;
  label: string;
  description: string;
  module: ModuleName;
}> = [
  {
    href: "/dashboard",
    label: "Visao geral",
    description: "Painel consolidado",
    module: "DASHBOARD",
  },
  {
    href: "/modulos",
    label: "Modulos",
    description: "Todos os modulos",
    module: "DASHBOARD",
  },
  {
    href: "/clientes",
    label: "Clientes",
    description: "Cadastro e historico",
    module: "CLIENTS",
  },
  {
    href: "/financeiro",
    label: "Financeiro",
    description: "Entradas, saidas e parciais",
    module: "FINANCE",
  },
];
