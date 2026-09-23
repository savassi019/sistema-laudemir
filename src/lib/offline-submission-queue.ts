"use client";

export const OFFLINE_SUBMISSION_STORAGE_KEY = "infinity-offline-submissions-v1";
export const OFFLINE_SUBMISSION_EVENT = "infinity:offline-submissions-changed";

export type OfflineSubmission = {
  id: string;
  endpoint: string;
  payload: Record<string, unknown>;
  requestKey: string;
  label: string;
  createdAt: string;
  attempts: number;
  lastError?: string;
  uploads?: Array<{
    fileKey: string;
    payloadPath: string;
    category: string;
    fileName: string;
  }>;
};

export type QueuedPostResult<T> =
  | { queued: false; data: T }
  | { queued: true; data: null };

class HttpResponseError extends Error {}

type PendingFile = { file: File; payloadPath: string; category: string };

function openFileDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("infinity-offline-files-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("files");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function storeFile(key: string, file: File) {
  const database = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("files", "readwrite");
    transaction.objectStore("files").put(file, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

async function readFile(key: string) {
  const database = await openFileDatabase();
  const file = await new Promise<File | undefined>((resolve, reject) => {
    const request = database.transaction("files", "readonly").objectStore("files").get(key);
    request.onsuccess = () => resolve(request.result as File | undefined);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return file;
}

async function deleteFile(key: string) {
  const database = await openFileDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction("files", "readwrite");
    transaction.objectStore("files").delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
}

function notifyQueueChanged() {
  window.dispatchEvent(new CustomEvent(OFFLINE_SUBMISSION_EVENT));
}

export function readOfflineSubmissions(): OfflineSubmission[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(OFFLINE_SUBMISSION_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as OfflineSubmission[]) : [];
  } catch {
    return [];
  }
}

function writeOfflineSubmissions(items: OfflineSubmission[]) {
  localStorage.setItem(OFFLINE_SUBMISSION_STORAGE_KEY, JSON.stringify(items));
  notifyQueueChanged();
}

async function queueSubmission(item: OfflineSubmission, files: PendingFile[] = []) {
  const items = readOfflineSubmissions();
  if (!items.some((saved) => saved.requestKey === item.requestKey)) {
    if (files.length > 0) {
      item.uploads = files.map((pendingFile, index) => ({
        fileKey: `${item.requestKey}:${index}`,
        payloadPath: pendingFile.payloadPath,
        category: pendingFile.category,
        fileName: pendingFile.file.name,
      }));
      await Promise.all(
        item.uploads.map((upload, index) => storeFile(upload.fileKey, files[index]!.file)),
      );
    }
    items.push(item);
    writeOfflineSubmissions(items);
  }
}

async function readError(response: Response) {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || `Falha no servidor (${response.status}).`;
  } catch {
    return `Falha no servidor (${response.status}).`;
  }
}

export async function postJsonWithOfflineQueue<T>(options: {
  endpoint: string;
  payload: Record<string, unknown>;
  requestKey: string;
  label: string;
  files?: PendingFile[];
}): Promise<QueuedPostResult<T>> {
  const item: OfflineSubmission = {
    id: options.requestKey,
    endpoint: options.endpoint,
    payload: options.payload,
    requestKey: options.requestKey,
    label: options.label,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };

  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await queueSubmission(item, options.files);
    return { queued: true, data: null };
  }

  try {
    const response = await fetch(options.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Idempotency-Key": options.requestKey,
      },
      body: JSON.stringify(options.payload),
    });

    if (!response.ok) throw new HttpResponseError(await readError(response));
    return { queued: false, data: (await response.json()) as T };
  } catch (error) {
    // Erros HTTP indicam que o servidor respondeu e precisam aparecer ao usuario.
    // Somente a ausencia real de conexao entra na fila para nao esconder validacoes.
    if (error instanceof HttpResponseError) throw error;
    await queueSubmission(item, options.files);
    return { queued: true, data: null };
  }
}

export async function syncOfflineSubmissions() {
  const items = readOfflineSubmissions();
  const remaining: OfflineSubmission[] = [];
  let synced = 0;

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    try {
      const payload = structuredClone(item.payload);
      for (const upload of item.uploads ?? []) {
        const file = await readFile(upload.fileKey);
        if (!file) throw new Error(`Arquivo offline nao encontrado: ${upload.fileName}`);
        const formData = new FormData();
        formData.append("file", file, upload.fileName);
        formData.append("category", upload.category);
        const uploadResponse = await fetch("/api/upload", { method: "POST", body: formData });
        if (!uploadResponse.ok) throw new Error(`Falha ao enviar ${upload.fileName}.`);
        const uploaded = (await uploadResponse.json()) as { id: string };
        setPayloadPath(payload, upload.payloadPath, uploaded.id);
      }
      const response = await fetch(item.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Idempotency-Key": item.requestKey,
        },
        body: JSON.stringify(payload),
      });

      // 409 neste endpoint significa que a mesma chave ja chegou ao servidor.
      if (response.ok || response.status === 409) {
        await Promise.all((item.uploads ?? []).map((upload) => deleteFile(upload.fileKey)));
        synced += 1;
        continue;
      }

      const failed = {
        ...item,
        attempts: item.attempts + 1,
        lastError: await readError(response),
      };
      remaining.push(failed, ...items.slice(index + 1));
      break;
    } catch {
      remaining.push(
        { ...item, attempts: item.attempts + 1, lastError: "Sem conexao com o servidor." },
        ...items.slice(index + 1),
      );
      break;
    }
  }

  writeOfflineSubmissions(remaining);
  return { synced, pending: remaining.length, lastError: remaining[0]?.lastError };
}

function setPayloadPath(payload: Record<string, unknown>, path: string, value: string) {
  const parts = path.split(".");
  let current: unknown = payload;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index]!;
    current = Array.isArray(current)
      ? current[Number(key)]
      : (current as Record<string, unknown>)[key];
  }
  const finalKey = parts.at(-1)!;
  if (Array.isArray(current)) current[Number(finalKey)] = value;
  else (current as Record<string, unknown>)[finalKey] = value;
}
