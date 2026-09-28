/** @type {import('pm2').StartOptions} */
module.exports = {
  apps: [
    {
      name: "sistema-laudemir",
      script: "scripts/start-next-server.mjs",
      // Duas instancias permitem recarga gradual: uma continua atendendo
      // enquanto a outra recebe a nova versao.
      exec_mode: "cluster",
      instances: 2,
      listen_timeout: 10_000,
      kill_timeout: 5_000,
      // Usa Node 22 via nvm — o sistema tem Node 18 instalado globalmente
      // que é incompatível com Next.js 16. Nunca remover este campo.
      interpreter: "/home/svs/.nvm/versions/node/v22.22.3/bin/node",
      cwd: __dirname,
      max_memory_restart: "512M",
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: "3001",
        DEMO_MODE: "false",
        NEXT_PUBLIC_APP_NAME: "Sistema de Gestao Modular",
        // SECURE_COOKIES omitido: código já usa false como padrão
        // JWT_SECRET e DATABASE_URL ficam SOMENTE em ~/.env-laudemir (fora do repo)
      },
    },
  ],
};
