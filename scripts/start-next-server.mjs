import cluster from "node:cluster";

import { startServer } from "next/dist/server/lib/start-server.js";

const port = Number.parseInt(process.env.PORT || "3001", 10);
const configuredWorkers = Number.parseInt(process.env.WEB_CONCURRENCY || "2", 10);
const workerCount = Number.isInteger(configuredWorkers) && configuredWorkers >= 2
  ? configuredWorkers
  : 2;

if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
  throw new Error("PORT invalida para iniciar o servidor Next.js.");
}

if (cluster.isPrimary) {
  let stopping = false;
  let reloadInProgress = false;

  function startWorker() {
    return cluster.fork();
  }

  function waitUntilReady(worker) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Worker ${worker.process.pid} nao ficou pronto a tempo.`));
      }, 20_000);

      function cleanup() {
        clearTimeout(timeout);
        worker.off("message", handleMessage);
        worker.off("exit", handleExit);
      }

      function handleMessage(message) {
        if (message?.type !== "ready") return;
        cleanup();
        resolve();
      }

      function handleExit(code, signal) {
        cleanup();
        reject(new Error(`Worker novo encerrou antes de ficar pronto (${code ?? signal}).`));
      }

      worker.on("message", handleMessage);
      worker.once("exit", handleExit);
    });
  }

  function retireWorker(worker) {
    return new Promise((resolve) => {
      if (worker.isDead()) {
        resolve();
        return;
      }

      const forceKill = setTimeout(() => {
        if (!worker.isDead()) worker.kill("SIGKILL");
      }, 15_000);

      worker.once("exit", () => {
        clearTimeout(forceKill);
        resolve();
      });
      worker.disconnect();
    });
  }

  async function rollingReload() {
    if (reloadInProgress || stopping) return;
    reloadInProgress = true;
    try {
      const previousWorkers = Object.values(cluster.workers).filter(Boolean);
      for (const previousWorker of previousWorkers) {
        if (stopping) break;
        const replacement = startWorker();
        await waitUntilReady(replacement);
        await retireWorker(previousWorker);
      }
      console.log("[start-next-server] Recarga gradual concluida.");
    } catch (error) {
      console.error("[start-next-server] Recarga gradual cancelada:", error);
    } finally {
      reloadInProgress = false;
    }
  }

  function shutdown() {
    if (stopping) return;
    stopping = true;
    const forceShutdown = setTimeout(() => process.exit(1), 18_000);
    cluster.disconnect(() => {
      clearTimeout(forceShutdown);
      process.exit(0);
    });
  }

  cluster.on("exit", () => {
    if (stopping || reloadInProgress) return;
    setTimeout(() => {
      const activeWorkers = Object.values(cluster.workers).filter(Boolean).length;
      if (!stopping && activeWorkers < workerCount) startWorker();
    }, 500);
  });

  for (let index = 0; index < workerCount; index += 1) startWorker();

  process.on("SIGUSR2", () => void rollingReload());
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
} else {
  startServer({
    dir: process.cwd(),
    port,
    isDev: false,
    hostname: process.env.NEXT_HOSTNAME || "0.0.0.0",
    allowRetry: false,
  }).then(() => {
    process.send?.({ type: "ready" });
  }).catch((error) => {
    console.error("[start-next-server] Falha ao iniciar:", error);
    process.exit(1);
  });
}
