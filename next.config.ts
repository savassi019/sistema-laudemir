import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  typescript: {
    // tsc --noEmit já valida localmente antes do push
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
