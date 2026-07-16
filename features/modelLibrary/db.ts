// 轻量 IndexedDB 封装，用于模型文件（Blob）持久化
// 只做这一个项目需要的事，不引第三方库

const DB_NAME = 'descriptive-geometry-db';
const DB_VERSION = 2;
const STORE_MODELS = 'models';

export interface StoredModel {
  id: string;            // uuid
  name: string;          // 用户可改
  fileName: string;      // 原文件名
  mimeType: string;
  size: number;          // bytes
  createdAt: number;     // ms
  scale: number;
  source?: 'imported' | 'drawn' | 'csg';
  csgProjectId?: string;
  blob: Blob;
  thumbnail?: Blob;      // 128×128 PNG
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MODELS)) {
        const store = db.createObjectStore(STORE_MODELS, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt');
      } else {
        const store = req.transaction?.objectStore(STORE_MODELS);
        if (store && !store.indexNames.contains('createdAt')) {
          store.createIndex('createdAt', 'createdAt');
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE_MODELS, mode);
        const store = t.objectStore(STORE_MODELS);
        const req = run(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

export async function listModels(): Promise<StoredModel[]> {
  const all = await tx<StoredModel[]>('readonly', (s) => s.getAll() as IDBRequest<StoredModel[]>);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveModel(m: StoredModel): Promise<void> {
  await tx('readwrite', (s) => s.put(m));
}

export async function updateModelMeta(
  id: string,
  patch: Partial<Pick<StoredModel, 'name' | 'scale'>>
): Promise<void> {
  const existing = await tx<StoredModel>('readonly', (s) => s.get(id) as IDBRequest<StoredModel>);
  if (!existing) return;
  await tx('readwrite', (s) => s.put({ ...existing, ...patch }));
}

export async function deleteModel(id: string): Promise<void> {
  await tx('readwrite', (s) => s.delete(id));
}

export async function getModel(id: string): Promise<StoredModel | undefined> {
  return tx<StoredModel | undefined>('readonly', (s) => s.get(id) as IDBRequest<StoredModel | undefined>);
}

export function genId(): string {
  // 足够的随机性，无需依赖 crypto.randomUUID（兼容性考虑）
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
