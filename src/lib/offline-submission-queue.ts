"use client";

export const OFFLINE_SUBMISSION_STORAGE_KEY = "infinity-offline-submissions-v1";
export const OFFLINE_SUBMISSION_EVENT = "infinity:offline-submissions-changed";

const ACTIVE_SCOPE_KEY = "infinity-offline-active-scope-v1";
const DATABASE_NAME = "infinity-offline-operations-v2";
const DATABASE_VERSION = 1;
const SUBMISSION_STORE = "submissions";
const FILE_STORE = "files";
const LEGACY_FILE_DATABASE = "infinity-offline-files-v1";
const LEGACY_FILE_STORE = "files";
const REQUEST_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 60_000;
let activeScope: string | null = null;

export type OfflineSubmissionStatus = "pending" | "attention";

export type OfflineUpload = {
  fileKey: string;
  payloadPath: string;
  category: string;
  fileName: string;
  fileSize?: number;
  fileType?: string;
  lastModified?: number;
  uploadedFileId?: string;
};

export type OfflineSubmission = {
  id: string;
  ownerScope: string;
  endpoint: string;
  payload: Record<string, unknown>;
  requestKey: string;
  label: string;
  createdAt: string;
  attempts: number;
  status: OfflineSubmissionStatus;
  lastError?: string;
  lastAttemptAt?: string;
  nextAttemptAt?: string;
  uploads?: OfflineUpload[];
};

export type QueuedPostResult<T> =
  | { queued: false; data: T; uploadedFileIds: Record<string, string> }
  | { queued: true; data: null };

export type PendingFile = { file: File; payloadPath: string; category: string };

class HttpResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class OfflineDataError extends Error {}

function canUseIndexedDb() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error ?? new Error("Operacao local cancelada."));
  });
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(SUBMISSION_STORE)) {
        const store = database.createObjectStore(SUBMISSION_STORE, { keyPath: "id" });
        store.createIndex("ownerScope", "ownerScope", { unique: false });
      }
      if (!database.objectStoreNames.contains(FILE_STORE)) {
        database.createObjectStore(FILE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function openLegacyFileDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(LEGACY_FILE_DATABASE, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(LEGACY_FILE_STORE)) {
        request.result.createObjectStore(LEGACY_FILE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function notifyQueueChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OFFLINE_SUBMISSION_EVENT));
  try {
    localStorage.setItem(`${OFFLINE_SUBMISSION_EVENT}:pulse`, String(Date.now()));
  } catch {}
}

export function setOfflineSubmissionScope(scope: string) {
  if (typeof window === "undefined") return;
  activeScope = scope;
  try {
    localStorage.setItem(ACTIVE_SCOPE_KEY, scope);
  } catch {}
  notifyQueueChanged();
}

function getOfflineSubmissionScope() {
  if (typeof window === "undefined") return null;
  if (activeScope) return activeScope;
  try {
    return localStorage.getItem(ACTIVE_SCOPE_KEY);
  } catch {
    return null;
  }
}

async function readLegacyFile(key: string) {
  const database = await openLegacyFileDatabase();
  try {
    const transaction = database.transaction(LEGACY_FILE_STORE, "readonly");
    return await requestResult(
      transaction.objectStore(LEGACY_FILE_STORE).get(key) as IDBRequest<Blob | undefined>,
    );
  } finally {
    database.close();
  }
}

async function migrateLegacyQueue(scope: string) {
  const raw = localStorage.getItem(OFFLINE_SUBMISSION_STORAGE_KEY);
  if (!raw) return;

  let legacyItems: Array<Partial<OfflineSubmission>>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.removeItem(OFFLINE_SUBMISSION_STORAGE_KEY);
      return;
    }
    legacyItems = parsed;
  } catch {
    return;
  }

  const database = await openDatabase();
  try {
    for (const legacy of legacyItems) {
      if (!legacy.id || !legacy.endpoint || !legacy.requestKey || !legacy.payload) continue;
      const uploads = (legacy.uploads ?? []) as OfflineUpload[];
      const files = await Promise.all(
        uploads.map(async (upload) => ({ key: upload.fileKey, file: await readLegacyFile(upload.fileKey) })),
      );
      const transaction = database.transaction([SUBMISSION_STORE, FILE_STORE], "readwrite");
      const migrated: OfflineSubmission = {
        id: legacy.id,
        ownerScope: legacy.ownerScope ?? scope,
        endpoint: legacy.endpoint,
        payload: legacy.payload,
        requestKey: legacy.requestKey,
        label: legacy.label ?? "Operacao pendente",
        createdAt: legacy.createdAt ?? new Date().toISOString(),
        attempts: legacy.attempts ?? 0,
        status: legacy.status ?? "pending",
        lastError: legacy.lastError,
        uploads,
      };
      transaction.objectStore(SUBMISSION_STORE).put(migrated);
      for (const item of files) {
        if (item.file) transaction.objectStore(FILE_STORE).put(item.file, item.key);
      }
      await transactionDone(transaction);
    }
    localStorage.removeItem(OFFLINE_SUBMISSION_STORAGE_KEY);
  } finally {
    database.close();
  }
}

async function getSubmission(id: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SUBMISSION_STORE, "readonly");
    return await requestResult(
      transaction.objectStore(SUBMISSION_STORE).get(id) as IDBRequest<OfflineSubmission | undefined>,
    );
  } finally {
    database.close();
  }
}

async function saveSubmission(item: OfflineSubmission, notify = true) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SUBMISSION_STORE, "readwrite");
    transaction.objectStore(SUBMISSION_STORE).put(item);
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  if (notify) notifyQueueChanged();
}

async function readFile(key: string) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction(FILE_STORE, "readonly");
    return await requestResult(
      transaction.objectStore(FILE_STORE).get(key) as IDBRequest<Blob | undefined>,
    );
  } finally {
    database.close();
  }
}

async function removeSubmission(item: OfflineSubmission) {
  const database = await openDatabase();
  try {
    const transaction = database.transaction([SUBMISSION_STORE, FILE_STORE], "readwrite");
    transaction.objectStore(SUBMISSION_STORE).delete(item.id);
    for (const upload of item.uploads ?? []) {
      transaction.objectStore(FILE_STORE).delete(upload.fileKey);
    }
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  notifyQueueChanged();
}

export async function readOfflineSubmissions(scope = getOfflineSubmissionScope()) {
  if (!scope || !canUseIndexedDb()) return [];
  await migrateLegacyQueue(scope);
  const database = await openDatabase();
  try {
    const transaction = database.transaction(SUBMISSION_STORE, "readonly");
    const store = transaction.objectStore(SUBMISSION_STORE);
    const items = store.indexNames.contains("ownerScope")
      ? await requestResult(
          store.index("ownerScope").getAll(scope) as IDBRequest<OfflineSubmission[]>,
        )
      : (await requestResult(store.getAll() as IDBRequest<OfflineSubmission[]>)).filter(
          (item) => item.ownerScope === scope,
        );
    return items.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  } finally {
    database.close();
  }
}

function uploadsMatch(left: OfflineUpload[] = [], right: PendingFile[] = []) {
  return left.length === right.length && left.every((upload, index) => {
    const candidate = right[index];
    return candidate &&
      upload.payloadPath === candidate.payloadPath &&
      upload.category === candidate.category &&
      upload.fileName === candidate.file.name &&
      upload.fileSize === candidate.file.size &&
      upload.lastModified === candidate.file.lastModified;
  });
}

async function stageSubmission(item: OfflineSubmission, files: PendingFile[] = []) {
  await migrateLegacyQueue(item.ownerScope);
  const items = await readOfflineSubmissions(item.ownerScope);
  const duplicate = items.find((saved) =>
    saved.endpoint === item.endpoint &&
    JSON.stringify(saved.payload) === JSON.stringify(item.payload) &&
    uploadsMatch(saved.uploads, files),
  );
  if (duplicate) return duplicate;

  const existing = await getSubmission(item.id);
  const uploads = files.map((pendingFile, index) => {
    const previous = existing?.uploads?.find(
      (upload) => upload.payloadPath === pendingFile.payloadPath &&
        upload.fileName === pendingFile.file.name &&
        upload.fileSize === pendingFile.file.size &&
        upload.lastModified === pendingFile.file.lastModified,
    );
    return {
      fileKey: `${item.ownerScope}:${item.requestKey}:${index}`,
      payloadPath: pendingFile.payloadPath,
      category: pendingFile.category,
      fileName: pendingFile.file.name,
      fileSize: pendingFile.file.size,
      fileType: pendingFile.file.type,
      lastModified: pendingFile.file.lastModified,
      uploadedFileId: previous?.uploadedFileId,
    } satisfies OfflineUpload;
  });
  const staged = { ...item, uploads };

  const database = await openDatabase();
  try {
    const transaction = database.transaction([SUBMISSION_STORE, FILE_STORE], "readwrite");
    transaction.objectStore(SUBMISSION_STORE).put(staged);
    for (const previous of existing?.uploads ?? []) {
      if (!uploads.some((upload) => upload.fileKey === previous.fileKey)) {
        transaction.objectStore(FILE_STORE).delete(previous.fileKey);
      }
    }
    files.forEach((pendingFile, index) => {
      transaction.objectStore(FILE_STORE).put(pendingFile.file, uploads[index]!.fileKey);
    });
    await transactionDone(transaction);
  } finally {
    database.close();
  }
  notifyQueueChanged();
  return staged;
}

async function readError(response: Response) {
  if (response.status === 401) {
    return "Sua sessao expirou. Entre novamente para enviar a operacao protegida.";
  }
  if (response.status === 403) {
    return "Este usuario nao tem mais permissao para enviar esta operacao.";
  }
  try {
    const body = (await response.json()) as { error?: string };
    return body.error || `Falha no servidor (${response.status}).`;
  } catch {
    return `Falha no servidor (${response.status}).`;
  }
}

export function classifyOfflineResponseStatus(status: number): OfflineSubmissionStatus {
  return status === 408 || status === 425 || status === 429 || status >= 500
    ? "pending"
    : "attention";
}

function retryDelay(attempts: number) {
  return Math.min(5 * 60_000, 5_000 * (2 ** Math.min(attempts, 6)));
}

async function markFailure(
  item: OfflineSubmission,
  error: string,
  status: OfflineSubmissionStatus,
) {
  const attempts = item.attempts + 1;
  const failed: OfflineSubmission = {
    ...item,
    attempts,
    status,
    lastError: error,
    lastAttemptAt: new Date().toISOString(),
    nextAttemptAt:
      status === "pending" ? new Date(Date.now() + retryDelay(attempts)).toISOString() : undefined,
  };
  await saveSubmission(failed);
  return failed;
}

async function sendSubmission<T>(original: OfflineSubmission) {
  let item = original;
  const payload = structuredClone(item.payload);

  for (let index = 0; index < (item.uploads?.length ?? 0); index += 1) {
    const upload = item.uploads![index]!;
    let fileId = upload.uploadedFileId;
    if (!fileId) {
      const file = await readFile(upload.fileKey);
      if (!file) throw new OfflineDataError(`Foto offline nao encontrada: ${upload.fileName}.`);
      const formData = new FormData();
      formData.append("file", file, upload.fileName);
      formData.append("category", upload.category);
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
      });
      if (!response.ok) throw new HttpResponseError(await readError(response), response.status);
      const uploaded = (await response.json()) as { id?: string };
      if (!uploaded.id) throw new OfflineDataError(`O servidor nao confirmou a foto ${upload.fileName}.`);
      fileId = uploaded.id;
      // Mantem o ID tambem no objeto recebido pelo chamador. Se o envio do
      // fechamento falhar depois do upload, markFailure nao pode apagar essa
      // confirmacao e provocar outro upload da mesma foto na tentativa seguinte.
      upload.uploadedFileId = fileId;
      const uploads = [...(item.uploads ?? [])];
      uploads[index] = upload;
      item = { ...item, uploads };
      await saveSubmission(item, false);
    }
    setPayloadPath(payload, upload.payloadPath, fileId);
  }

  const response = await fetch(item.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Idempotency-Key": item.requestKey,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new HttpResponseError(await readError(response), response.status);
  return {
    data: (await response.json()) as T,
    uploadedFileIds: Object.fromEntries(
      (item.uploads ?? [])
        .filter((upload) => upload.uploadedFileId)
        .map((upload) => [upload.payloadPath, upload.uploadedFileId!]),
    ),
  };
}

export async function postJsonWithOfflineQueue<T>(options: {
  endpoint: string;
  payload: Record<string, unknown>;
  requestKey: string;
  label: string;
  files?: PendingFile[];
}): Promise<QueuedPostResult<T>> {
  const ownerScope = getOfflineSubmissionScope();
  if (!ownerScope) {
    throw new Error("Nao foi possivel identificar o usuario para proteger a operacao offline.");
  }

  let item = await stageSubmission({
    id: options.requestKey,
    ownerScope,
    endpoint: options.endpoint,
    payload: options.payload,
    requestKey: options.requestKey,
    label: options.label,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
  }, options.files);

  if (!navigator.onLine) return { queued: true, data: null };

  try {
    const result = await sendSubmission<T>(item);
    await removeSubmission(item);
    return { queued: false, ...result };
  } catch (error) {
    if (error instanceof HttpResponseError) {
      const status = classifyOfflineResponseStatus(error.status);
      item = await markFailure(item, error.message, status);
      if (status === "attention") throw new Error(error.message);
      return { queued: true, data: null };
    }
    if (error instanceof OfflineDataError) {
      await markFailure(item, error.message, "attention");
      throw error;
    }
    await markFailure(item, "Sem conexao com o servidor. O registro continua protegido.", "pending");
    return { queued: true, data: null };
  }
}

export async function syncOfflineSubmissions(options: {
  retryAttention?: boolean;
  ignoreBackoff?: boolean;
  scope?: string;
} = {}) {
  const scope = options.scope ?? getOfflineSubmissionScope();
  if (!scope) return { synced: 0, pending: 0, attention: 0, lastError: undefined };
  const items = await readOfflineSubmissions(scope);
  let synced = 0;
  let lastError: string | undefined;

  for (const original of items) {
    if (original.status === "attention" && !options.retryAttention) continue;
    if (
      !options.ignoreBackoff &&
      original.nextAttemptAt &&
      new Date(original.nextAttemptAt).getTime() > Date.now()
    ) continue;

    let item = original;
    try {
      await sendSubmission(item);
      await removeSubmission(item);
      synced += 1;
    } catch (error) {
      if (error instanceof HttpResponseError) {
        const status = classifyOfflineResponseStatus(error.status);
        item = await markFailure(item, error.message, status);
        lastError ??= error.message;
        if (status === "pending" || error.status === 401 || error.status === 403) break;
        continue;
      }
      const message = error instanceof OfflineDataError
        ? error.message
        : "Sem conexao com o servidor. O registro continua protegido.";
      const status = error instanceof OfflineDataError ? "attention" : "pending";
      item = await markFailure(item, message, status);
      lastError ??= message;
      if (status === "pending") break;
    }
  }

  const remaining = await readOfflineSubmissions(scope);
  return {
    synced,
    pending: remaining.filter((item) => item.status === "pending").length,
    attention: remaining.filter((item) => item.status === "attention").length,
    lastError: lastError ?? remaining.find((item) => item.lastError)?.lastError,
  };
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
