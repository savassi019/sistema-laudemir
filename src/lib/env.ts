export const env = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "Sistema Laudemir",
  demoMode: process.env.DEMO_MODE !== "false",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-sistema-laudemir",
};
