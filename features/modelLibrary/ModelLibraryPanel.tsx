import React, { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, Edit2, Check, X, Library } from 'lucide-react';
import { useModelLibraryStore, type ModelEntry } from './store';

interface ModelLibraryPanelProps {
  activeId: string | null;
  onSelect: (entry: ModelEntry) => void;
  onClear: () => void;
}

export const ModelLibraryPanel: React.FC<ModelLibraryPanelProps> = ({
  activeId,
  onSelect,
  onClear,
}) => {
  const entries = useModelLibraryStore((s) => s.entries);
  const loaded = useModelLibraryStore((s) => s.loaded);
  const load = useModelLibraryStore((s) => s.load);
  const addFromFile = useModelLibraryStore((s) => s.addFromFile);
  const remove = useModelLibraryStore((s) => s.remove);
  const rename = useModelLibraryStore((s) => s.rename);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const entry = await addFromFile(file);
      onSelect(entry);
      setToast(`已加入模型库：${entry.name}`);
    } catch (err) {
      console.error(err);
      setToast('上传失败');
    } finally {
      setUploading(false);
    }
  };

  const startRename = (entry: ModelEntry) => {
    setEditingId(entry.id);
    setEditingName(entry.name);
  };

  const commitRename = async () => {
    if (editingId && editingName.trim()) {
      await rename(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const cancelRename = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleDelete = async (entry: ModelEntry) => {
    if (!confirm(`删除「${entry.name}」？`)) return;
    if (activeId === entry.id) onClear();
    await remove(entry.id);
    setToast('已删除');
  };

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".glb,.gltf"
        onChange={handleFile}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full p-2.5 rounded-lg text-[11px] text-left transition-all border border-dashed border-indigo-500/30 text-slate-400 hover:border-purple-500/50 hover:text-purple-300 hover:bg-purple-500/10 flex items-center gap-1.5 group disabled:opacity-60"
      >
        <Upload size={12} className="group-hover:scale-110 transition-transform" />
        {uploading ? '处理中…' : '上传模型 (.glb/.gltf)'}
      </button>

      {loaded && entries.length > 0 && (
        <div className="pt-2 mt-2 border-t border-white/10">
          <div className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">
            <Library size={11} /> 我的模型库 ({entries.length})
          </div>
          <div className="space-y-1.5 max-h-60 overflow-auto pr-1">
            {entries.map((entry) => {
              const isActive = entry.id === activeId;
              const isEditing = editingId === entry.id;
              return (
                <div
                  key={entry.id}
                  className={`group flex items-center gap-2 p-1.5 rounded-lg text-[11px] transition-all border ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-600/80 to-pink-600/80 border-purple-400/50 text-white shadow-md shadow-purple-500/20'
                      : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  <button
                    onClick={() => onSelect(entry)}
                    className="shrink-0 w-10 h-10 rounded-md overflow-hidden bg-slate-900/50 border border-white/10"
                    title="切换到此模型"
                  >
                    {entry.thumbnailUrl ? (
                      <img
                        src={entry.thumbnailUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Library size={14} />
                      </div>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') cancelRename();
                        }}
                        className="w-full bg-slate-900/70 text-[11px] text-white px-1.5 py-0.5 rounded border border-indigo-500/40 outline-none"
                      />
                    ) : (
                      <button
                        onClick={() => onSelect(entry)}
                        className="block text-left truncate w-full"
                      >
                        <div className="truncate font-medium">{entry.name}</div>
                        <div className="truncate text-[9px] opacity-60">
                          {(entry.size / 1024).toFixed(0)} KB · {entry.source === 'csg' ? 'CSG 可编辑' : entry.source === 'drawn' ? '绘制模型' : '导入模型'}
                        </div>
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          onClick={commitRename}
                          className="p-1 rounded hover:bg-emerald-500/30 transition-colors"
                          title="保存"
                        >
                          <Check size={12} />
                        </button>
                        <button
                          onClick={cancelRename}
                          className="p-1 rounded hover:bg-red-500/30 transition-colors"
                          title="取消"
                        >
                          <X size={12} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startRename(entry)}
                          className="p-1 rounded hover:bg-white/10 transition-colors opacity-0 group-hover:opacity-100"
                          title="重命名"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          onClick={() => handleDelete(entry)}
                          className="p-1 rounded hover:bg-red-500/30 transition-colors opacity-0 group-hover:opacity-100"
                          title="删除"
                        >
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-lg bg-slate-900/95 border border-indigo-500/40 text-indigo-200 text-[12px] shadow-xl">
          {toast}
        </div>
      )}
    </div>
  );
};
