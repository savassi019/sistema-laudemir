import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  typescript: {
    // Ligado de volta em 2026-09-04, com o projeto em zero erros. Ignorar
    // deixava erro real de tipo passar pro ar em silencio — foi assim que
    // campos opcionais viraram `undefined` no comprovante do cliente.
    // Se um build falhar por tipo, o deploy para e a versao antiga segue
    // no ar: e o comportamento desejado, nao um transtorno.
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
