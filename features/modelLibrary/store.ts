import { create } from 'zustand';
import type { StoredModel } from './db';
import {
  listModels as dbList,
  saveModel as dbSave,
  deleteModel as dbDelete,
  updateModelMeta as dbUpdateMeta,
  genId,
} from './db';
import { generateThumbnail } from './thumbnail';

// 内存中的"轻"表示：blob 留在 IndexedDB 里，这里只保存运行时用的 ObjectURL + 元数据
export interface ModelEntry {
  id: string;
  name: string;
  fileName: string;
  size: number;
  createdAt: number;
  scale: number;
  source?: 'imported' | 'drawn' | 'csg';
  csgProjectId?: string;
  objectUrl: string;       // 指向 model blob
  thumbnailUrl?: string;   // 指向 thumbnail blob
}

interface ModelLibraryState {
  loaded: boolean;
  entries: ModelEntry[];
  load: () => Promise<void>;
  addFromFile: (file: File) => Promise<ModelEntry>;
  addFromBlob: (blob: Blob, meta: { name: string; fileName: string; mimeType: string; source?: ModelEntry['source']; csgProjectId?: string }) => Promise<ModelEntry>;
  remove: (id: string) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  updateScale: (id: string, scale: number) => Promise<void>;
}

function toEntry(m: StoredModel): ModelEntry {
  return {
    id: m.id,
    name: m.name,
    fileName: m.fileName,
    size: m.size,
    createdAt: m.createdAt,
    scale: m.scale,
    source: m.source ?? 'imported',
    csgProjectId: m.csgProjectId,
    objectUrl: URL.createObjectURL(m.blob),
    thumbnailUrl: m.thumbnail ? URL.createObjectURL(m.thumbnail) : undefined,
  };
}

function revokeEntry(e: ModelEntry) {
  URL.revokeObjectURL(e.objectUrl);
  if (e.thumbnailUrl) URL.revokeObjectURL(e.thumbnailUrl);
}

export const useModelLibraryStore = create<ModelLibraryState>((set, get) => ({
  loaded: false,
  entries: [],

  load: async () => {
    if (get().loaded) return;
    try {
      const stored = await dbList();
      const entries = stored.map(toEntry);
      set({ entries, loaded: true });
    } catch (err) {
      console.warn('[modelLibrary] load failed', err);
      set({ loaded: true });
    }
  },

  addFromFile: async (file: File) => {
    const id = genId();
    const createdAt = Date.now();
    const thumbnail = await generateThumbnail(file).catch(() => undefined);
    const stored: StoredModel = {
      id,
      name: file.name.replace(/\.(glb|gltf)$/i, ''),
      fileName: file.name,
      mimeType: file.type || 'model/gltf-binary',
      size: file.size,
      createdAt,
      scale: 1,
      source: 'imported',
      blob: file,
      thumbnail,
    };
    await dbSave(stored);
    const entry = toEntry(stored);
    set((s) => ({ entries: [entry, ...s.entries] }));
    return entry;
  },

  addFromBlob: async (blob, meta) => {
    const id = genId();
    const createdAt = Date.now();
    const thumbnail = await generateThumbnail(blob).catch(() => undefined);
    const stored: StoredModel = {
      id,
      name: meta.name,
      fileName: meta.fileName,
      mimeType: meta.mimeType,
      size: blob.size,
      createdAt,
      scale: 1,
      source: meta.source,
      csgProjectId: meta.csgProjectId,
      blob,
      thumbnail,
    };
    await dbSave(stored);
    const entry = toEntry(stored);
    set((s) => ({ entries: [entry, ...s.entries] }));
    return entry;
  },

  remove: async (id: string) => {
    const entry = get().entries.find((e) => e.id === id);
    if (entry) revokeEntry(entry);
    await dbDelete(id);
    set((s) => ({ entries: s.entries.filter((e) => e.id !== id) }));
  },

  rename: async (id: string, name: string) => {
    await dbUpdateMeta(id, { name });
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, name } : e)),
    }));
  },

  updateScale: async (id: string, scale: number) => {
    await dbUpdateMeta(id, { scale });
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, scale } : e)),
    }));
  },
}));
