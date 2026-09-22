import type { ModuleName, RoleName } from "@/types/app";

export function canAccessModule(
  role: RoleName,
  modules: readonly ModuleName[],
  module: ModuleName,
) {
  return role === "OWNER" || modules.includes(module);
}

export function canViewCalculatedFinancials(role: RoleName) {
  return role === "OWNER" || role === "ADMIN";
}

export function canManageTeam(role: RoleName) {
  return role === "OWNER";
}

export function canViewOwnerDashboard(role: RoleName) {
  return role === "OWNER";
}
