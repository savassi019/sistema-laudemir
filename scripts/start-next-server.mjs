import { startServer } from "next/dist/server/lib/start-server";

const port = Number.parseInt(process.env.PORT || "3001", 10);

if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  throw new Error("PORT invalida para iniciar o servidor Next.js.");
}

startServer({
  dir: process.cwd(),
  port,
  isDev: false,
  hostname: process.env.NEXT_HOSTNAME || "0.0.0.0",
  allowRetry: false,
}).catch((error) => {
  console.error("[start-next-server] Falha ao iniciar:", error);
  process.exit(1);
});
