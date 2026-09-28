/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "sistema-laudemir",
      script: "node_modules/.bin/next",
      args: "start -p 3001",
      // Usa Node 22 via nvm — o sistema tem Node 18 instalado globalmente
      // que é incompatível com Next.js 16. Nunca remover este campo.
      interpreter: "/home/svs/.nvm/versions/node/v22.22.3/bin/node",
      cwd: "/home/svs/sites/sistema-laudemir",
      max_memory_restart: "512M",
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        DEMO_MODE: "false",
        NEXT_PUBLIC_APP_NAME: "Sistema de Gestao Modular",
        // SECURE_COOKIES omitido: código já usa false como padrão
        // JWT_SECRET e DATABASE_URL ficam SOMENTE em ~/.env-laudemir (fora do repo)
      },
    },
  ],
};
