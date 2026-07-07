const isProduction = process.env.NODE_ENV === "production";

if (isProduction && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET precisa ser definido em produção.");
}

export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Sistema Laudemir",
  demoMode: process.env.DEMO_MODE === "true",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-sistema-laudemir",
};
