import React from 'react';
import {
  Box, Cylinder, Circle, Plus, Minus, X as XIcon, Trash2,
  Undo2, Redo2, Eye, EyeOff, ArrowRight, Boxes, Copy,
  ArrowLeft, ArrowUp, ArrowDown, Download, Upload, RotateCcw, Cone,
  Hexagon, TriangleRight, Save, FolderOpen, FilePlus, Edit2,
} from 'lucide-react';
import { useWorkshopStore } from './store';
import type { OpKind, PrimitiveKind } from './model';
import {
  WORKSHOP_PRESETS,
  evaluateSteps,
  parseWorkshopSteps,
  serializeWorkshopSteps,
  summarizeSteps,
  formatWorkshopFileName,
} from './model';
import { downloadBlob, exportGeometryAsGLB, exportGeometryAsSTL } from './exporters';
import { useModelLibraryStore } from '../modelLibrary/store';

const PRIMITIVE_LABELS: Record<PrimitiveKind, { label: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  box: { label: '方块', Icon: Box },
  cylinder: { label: '圆柱', Icon: Cylinder },
  sphere: { label: '球体', Icon: Circle },
  cone: { label: '圆锥', Icon: Cone },
  prism: { label: '棱柱', Icon: Hexagon },
  wedge: { label: '楔体', Icon: TriangleRight },
};

const OP_META: Record<OpKind, { label: string; selectClass: string; Icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  add: { label: '并', selectClass: 'border-emerald-500/30 text-emerald-300', Icon: Plus },
  subtract: { label: '减', selectClass: 'border-rose-500/30 text-rose-300', Icon: Minus },
  intersect: { label: '交', selectClass: 'border-amber-500/30 text-amber-300', Icon: XIcon },
};

const numInput = (
  value: number,
  onChange: (v: number) => void,
  step = 0.1,
  min?: number,
  max?: number
) => (
  <input
    type="number"
    value={value.toFixed(2)}
    step={step}
    min={min}
    max={max}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    className="w-full bg-slate-900/60 border border-white/10 rounded px-1.5 py-1 text-[10px] text-slate-200 outline-none focus:border-cyan-500/50 font-mono"
  />
);

export const CSGWorkshopPanel: React.FC = () => {
  const [importMessage, setImportMessage] = React.useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = React.useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const steps = useWorkshopStore((s) => s.steps);
  const projects = useWorkshopStore((s) => s.projects);
  const activeProjectId = useWorkshopStore((s) => s.activeProjectId);
  const selectedId = useWorkshopStore((s) => s.selectedId);
  const addPrimitive = useWorkshopStore((s) => s.addPrimitive);
  const updateStep = useWorkshopStore((s) => s.updateStep);
  const removeStep = useWorkshopStore((s) => s.removeStep);
  const duplicateStep = useWorkshopStore((s) => s.duplicateStep);
  const mirrorStep = useWorkshopStore((s) => s.mirrorStep);
  const moveStep = useWorkshopStore((s) => s.moveStep);
  const resetStep = useWorkshopStore((s) => s.resetStep);
  const nudgeSelected = useWorkshopStore((s) => s.nudgeSelected);
  const select = useWorkshopStore((s) => s.select);
  const toggleDisabled = useWorkshopStore((s) => s.toggleDisabled);
  const applyPreset = useWorkshopStore((s) => s.applyPreset);
  const importSteps = useWorkshopStore((s) => s.importSteps);
  const clear = useWorkshopStore((s) => s.clear);
  const undo = useWorkshopStore((s) => s.undo);
  const redo = useWorkshopStore((s) => s.redo);
  const createProject = useWorkshopStore((s) => s.createProject);
  const openProject = useWorkshopStore((s) => s.openProject);
  const saveProject = useWorkshopStore((s) => s.saveProject);
  const duplicateProject = useWorkshopStore((s) => s.duplicateProject);
  const removeProject = useWorkshopStore((s) => s.removeProject);
  const renameProject = useWorkshopStore((s) => s.renameProject);
  const exportProject = useWorkshopStore((s) => s.exportProject);
  const importProject = useWorkshopStore((s) => s.importProject);
  const setProjectNotes = useWorkshopStore((s) => s.setProjectNotes);
  const addModelFromBlob = useModelLibraryStore((s) => s.addFromBlob);
  const historyLen = useWorkshopStore((s) => s.history.length);
  const futureLen = useWorkshopStore((s) => s.future.length);

  const selected = steps.find((s) => s.id === selectedId) ?? null;
  const selectedScale = selected?.scale ?? [1, 1, 1];
  const activeProject = projects.find((project) => project.id === activeProjectId) ?? null;
  const modelSummary = summarizeSteps(steps);

  React.useEffect(() => {
    if (!activeProjectId) return;
    saveProject();
  }, [activeProjectId, steps, saveProject]);

  const handleExport = () => {
    if (steps.length === 0) return;
    const blob = new Blob([activeProjectId ? exportProject() : serializeWorkshopSteps(steps)], { type: 'application/json' });
    downloadBlob(blob, formatWorkshopFileName(activeProject?.name || 'csg-workshop', 'json'));
  };

  const currentGeometryBlob = async (format: 'stl' | 'glb') => {
    const geometry = evaluateSteps(steps);
    if (!geometry) throw new Error('当前没有可导出的几何体');
    const name = activeProject?.name || 'csg-workshop';
    if (format === 'stl') return exportGeometryAsSTL(geometry, name);
    return exportGeometryAsGLB(geometry, name);
  };

  const handleExportMesh = async (format: 'stl' | 'glb') => {
    try {
      const blob = await currentGeometryBlob(format);
      const name = activeProject?.name || 'csg-workshop';
      downloadBlob(blob, formatWorkshopFileName(name, format));
      setImportMessage(`已导出 ${format.toUpperCase()}`);
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '导出失败');
    }
  };

  const handleSaveToModelLibrary = async () => {
    try {
      if (!activeProjectId) saveProject();
      const blob = await currentGeometryBlob('glb');
      const projectId = activeProjectId || useWorkshopStore.getState().activeProjectId || undefined;
      const name = activeProject?.name || 'CSG 模型';
      await addModelFromBlob(blob, {
        name,
        fileName: `${name}.glb`,
        mimeType: 'model/gltf-binary',
        source: 'csg',
        csgProjectId: projectId,
      });
      setImportMessage('已保存到模型库');
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '保存到模型库失败');
    }
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      try {
        importProject(text);
        setImportMessage('已导入 CSG 项目');
      } catch {
        importSteps(parseWorkshopSteps(text));
        setImportMessage('已导入模型步骤');
      }
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : '导入失败');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const commitProjectRename = () => {
    if (editingProjectId && editingProjectName.trim()) {
      renameProject(editingProjectId, editingProjectName.trim());
    }
    setEditingProjectId(null);
    setEditingProjectName('');
  };

  return (
    <div className="space-y-2">
      {/* 项目管理 */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
            <FolderOpen size={11} />
            CSG 项目
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => createProject(`CSG 模型 ${projects.length + 1}`)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-cyan-200"
              title="新建项目"
            >
              <FilePlus size={12} />
            </button>
            <button
              onClick={() => saveProject()}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-cyan-200"
              title="保存当前项目"
            >
              <Save size={12} />
            </button>
          </div>
        </div>
        {projects.length > 0 ? (
          <div className="space-y-1 max-h-28 overflow-auto pr-1">
            {projects.map((project) => {
              const isActive = project.id === activeProjectId;
              const isEditing = editingProjectId === project.id;
              return (
                <div
                  key={project.id}
                  className={`flex items-center gap-1.5 p-1.5 rounded-lg border text-[10px] ${
                    isActive ? 'bg-cyan-500/15 border-cyan-400/40 text-cyan-100' : 'bg-white/5 border-white/10 text-slate-300'
                  }`}
                >
                  {isEditing ? (
                    <input
                      autoFocus
                      value={editingProjectName}
                      onChange={(e) => setEditingProjectName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitProjectRename();
                        if (e.key === 'Escape') {
                          setEditingProjectId(null);
                          setEditingProjectName('');
                        }
                      }}
                      className="min-w-0 flex-1 bg-slate-900/70 border border-cyan-500/40 rounded px-1 py-0.5 outline-none text-white"
                    />
                  ) : (
                    <button
                      onClick={() => openProject(project.id)}
                      className="min-w-0 flex-1 text-left truncate"
                      title="打开项目"
                    >
                      {project.name}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setEditingProjectId(project.id);
                      setEditingProjectName(project.name);
                    }}
                    className="p-0.5 rounded hover:bg-white/10"
                    title="重命名"
                  >
                    <Edit2 size={10} />
                  </button>
                  <button
                    onClick={() => duplicateProject(project.id)}
                    className="p-0.5 rounded hover:bg-cyan-500/20"
                    title="复制项目"
                  >
                    <Copy size={10} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`删除「${project.name}」？`)) removeProject(project.id); }}
                    className="p-0.5 rounded hover:bg-rose-500/30"
                    title="删除项目"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-[9px] text-slate-500 border border-dashed border-white/10 rounded-lg p-2 text-center">
            当前未保存为项目
          </div>
        )}
        {activeProject && (
          <textarea
            value={activeProject.notes ?? ''}
            onChange={(e) => setProjectNotes(e.target.value)}
            placeholder="项目备注..."
            className="w-full min-h-12 resize-y rounded-lg bg-slate-900/50 border border-white/10 px-2 py-1.5 text-[10px] text-slate-300 placeholder-slate-600 outline-none focus:border-cyan-500/40"
          />
        )}
        <div className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-[9px] text-slate-400 leading-relaxed">
          {modelSummary}
        </div>
      </div>

      {/* 练习预设 */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1 text-[10px] font-semibold text-cyan-300">
          <Boxes size={11} />
          练习预设
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {WORKSHOP_PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => applyPreset(preset.steps)}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-cyan-500/15 hover:border-cyan-500/40 text-left transition-all"
              title={preset.description}
            >
              <span className="block text-[10px] text-cyan-100 truncate">{preset.label}</span>
              <span className="block text-[8px] text-slate-500">{preset.steps.length} 步</span>
            </button>
          ))}
        </div>
      </div>

      {/* 加基元 */}
      <div className="grid grid-cols-3 gap-1.5">
        {(Object.keys(PRIMITIVE_LABELS) as PrimitiveKind[]).map((kind) => {
          const meta = PRIMITIVE_LABELS[kind];
          return (
            <button
              key={kind}
              onClick={() => addPrimitive(kind, steps.length === 0 ? 'add' : 'subtract')}
              className="p-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-[10px] text-cyan-200 flex flex-col items-center gap-1 transition-all"
              title={`加入${meta.label}（首步并集，之后默认差集；在下方改操作）`}
            >
              <meta.Icon size={14} />
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* 文件操作 */}
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={handleExport}
          disabled={steps.length === 0}
          className="p-1.5 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          <Download size={12} /> 导出
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="p-1.5 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/10 flex items-center justify-center gap-1"
        >
          <Upload size={12} /> 导入
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => handleImportFile(event.target.files?.[0])}
        />
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={() => handleExportMesh('stl')}
          disabled={steps.length === 0}
          className="p-1.5 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          STL
        </button>
        <button
          onClick={() => handleExportMesh('glb')}
          disabled={steps.length === 0}
          className="p-1.5 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          GLB
        </button>
        <button
          onClick={handleSaveToModelLibrary}
          disabled={steps.length === 0}
          className="p-1.5 rounded-lg border border-cyan-500/30 text-[10px] text-cyan-200 hover:bg-cyan-500/15 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          入库
        </button>
      </div>
      {importMessage && (
        <div className="text-[9px] text-slate-400 bg-white/5 border border-white/10 rounded px-2 py-1">
          {importMessage}
        </div>
      )}
      <div className="flex items-center justify-between text-[9px] text-slate-500 px-1">
        <span>{steps.length} 个步骤</span>
        <span>已自动保存</span>
      </div>

      {/* undo/redo/clear */}
      <div className="grid grid-cols-3 gap-1.5">
        <button
          onClick={undo}
          disabled={historyLen === 0}
          className="p-1.5 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          <Undo2 size={12} /> 撤销
        </button>
        <button
          onClick={redo}
          disabled={futureLen === 0}
          className="p-1.5 rounded-lg border border-white/10 text-[10px] text-slate-300 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          <Redo2 size={12} /> 重做
        </button>
        <button
          onClick={() => { if (confirm('清空所有操作？')) clear(); }}
          disabled={steps.length === 0}
          className="p-1.5 rounded-lg border border-rose-500/30 text-[10px] text-rose-300 hover:bg-rose-500/20 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
        >
          <Trash2 size={12} /> 清空
        </button>
      </div>

      {/* 步骤列表 */}
      {steps.length === 0 ? (
        <div className="text-[10px] text-slate-500 text-center py-4 border border-dashed border-white/10 rounded-lg">
          点击上方按钮加入第一个基元
        </div>
      ) : (
        <div className="space-y-1 max-h-48 overflow-auto pr-1">
          {steps.map((step, i) => {
            const { Icon: PrimIcon, label } = PRIMITIVE_LABELS[step.primitive.kind];
            const opMeta = OP_META[step.op];
            const isFirst = i === 0;
            const isSelected = step.id === selectedId;
            const OpIcon = opMeta.Icon;
            return (
              <div
                key={step.id}
                onClick={() => select(step.id)}
                className={`flex items-center gap-1.5 p-1.5 rounded-lg text-[10px] cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-100'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                } ${step.disabled ? 'opacity-40' : ''}`}
              >
                <span className="text-slate-500 font-mono w-4 text-right">{i + 1}</span>
                {isFirst ? (
                  <span className="text-slate-500 w-6 text-center">基体</span>
                ) : (
                  <select
                    value={step.op}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateStep(step.id, { op: e.target.value as OpKind })}
                    className={`bg-slate-900/60 border ${opMeta.selectClass} text-[10px] rounded px-1 py-0.5 outline-none`}
                  >
                    <option value="add">并</option>
                    <option value="subtract">减</option>
                    <option value="intersect">交</option>
                  </select>
                )}
                {!isFirst && <OpIcon size={11} className="opacity-70" />}
                <PrimIcon size={12} />
                <span className="flex-1 truncate">{label}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); moveStep(step.id, -1); }}
                  disabled={i === 0}
                  className="p-0.5 hover:bg-white/10 rounded disabled:opacity-25 disabled:cursor-not-allowed"
                  title="上移"
                >
                  <ArrowUp size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveStep(step.id, 1); }}
                  disabled={i === steps.length - 1}
                  className="p-0.5 hover:bg-white/10 rounded disabled:opacity-25 disabled:cursor-not-allowed"
                  title="下移"
                >
                  <ArrowDown size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); duplicateStep(step.id); }}
                  className="p-0.5 hover:bg-cyan-500/20 rounded"
                  title="复制此步"
                >
                  <Copy size={11} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleDisabled(step.id); }}
                  className="p-0.5 hover:bg-white/10 rounded"
                  title={step.disabled ? '启用' : '禁用'}
                >
                  {step.disabled ? <EyeOff size={11} /> : <Eye size={11} />}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                  className="p-0.5 hover:bg-rose-500/30 rounded"
                  title="删除"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 选中步骤的参数编辑 */}
      {selected && (
        <div className="mt-2 p-2 bg-slate-900/40 border border-cyan-500/20 rounded-lg space-y-1.5">
          <div className="text-[10px] text-cyan-300 font-semibold flex items-center gap-1">
            <ArrowRight size={10} />
            {PRIMITIVE_LABELS[selected.primitive.kind].label} 参数
            <button
              onClick={() => resetStep(selected.id)}
              className="ml-auto p-1 rounded hover:bg-white/10 text-slate-400 hover:text-cyan-200"
              title="重置当前步骤"
            >
              <RotateCcw size={11} />
            </button>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            <button
              onClick={() => nudgeSelected(0, -0.1)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 flex items-center justify-center"
              title="向 -X 微移"
            >
              <ArrowLeft size={12} />
            </button>
            <button
              onClick={() => nudgeSelected(0, 0.1)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 flex items-center justify-center"
              title="向 +X 微移"
            >
              <ArrowRight size={12} />
            </button>
            <button
              onClick={() => nudgeSelected(1, 0.1)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 flex items-center justify-center"
              title="向 +Y 微移"
            >
              <ArrowUp size={12} />
            </button>
            <button
              onClick={() => nudgeSelected(1, -0.1)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 flex items-center justify-center"
              title="向 -Y 微移"
            >
              <ArrowDown size={12} />
            </button>
            <button
              onClick={() => nudgeSelected(2, -0.1)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 text-[10px]"
              title="向 -Z 微移"
            >
              Z-
            </button>
            <button
              onClick={() => nudgeSelected(2, 0.1)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 text-[10px]"
              title="向 +Z 微移"
            >
              Z+
            </button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              onClick={() => duplicateStep(selected.id)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 flex items-center justify-center gap-1 text-[10px]"
              title="复制当前步骤"
            >
              <Copy size={11} /> 复制
            </button>
            <button
              onClick={() => mirrorStep(selected.id, 0)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 text-[10px]"
              title="沿 X 坐标镜像复制"
            >
              镜像X
            </button>
            <button
              onClick={() => mirrorStep(selected.id, 1)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 text-[10px]"
              title="沿 Y 坐标镜像复制"
            >
              镜像Y
            </button>
            <button
              onClick={() => mirrorStep(selected.id, 2)}
              className="p-1.5 rounded border border-white/10 bg-white/5 text-slate-300 hover:bg-cyan-500/15 text-[10px]"
              title="沿 Z 坐标镜像复制"
            >
              镜像Z
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <label className="text-[9px] text-slate-500">宽/径
              {numInput(selected.primitive.width, (v) =>
                updateStep(selected.id, { primitive: { ...selected.primitive, width: Math.max(0.1, v) } })
              )}
            </label>
            <label className="text-[9px] text-slate-500">高
              {numInput(selected.primitive.height, (v) =>
                updateStep(selected.id, { primitive: { ...selected.primitive, height: Math.max(0.1, v) } })
              )}
            </label>
            {selected.primitive.kind === 'box' && (
              <label className="text-[9px] text-slate-500">深
                {numInput(selected.primitive.depth, (v) =>
                  updateStep(selected.id, { primitive: { ...selected.primitive, depth: Math.max(0.1, v) } })
                )}
              </label>
            )}
          </div>
          {(selected.primitive.kind === 'cylinder' || selected.primitive.kind === 'cone' || selected.primitive.kind === 'sphere' || selected.primitive.kind === 'prism') && (
            <div className="grid grid-cols-3 gap-1.5">
              {selected.primitive.kind === 'prism' ? (
                <label className="text-[9px] text-slate-500">边数
                  {numInput(selected.primitive.sides ?? 6, (v) =>
                    updateStep(selected.id, { primitive: { ...selected.primitive, sides: Math.max(3, Math.min(12, Math.round(v))) } })
                  , 1, 3, 12)}
                </label>
              ) : (
                <label className="text-[9px] text-slate-500">分段
                  {numInput(selected.primitive.segments ?? 32, (v) =>
                    updateStep(selected.id, { primitive: { ...selected.primitive, segments: Math.max(8, Math.min(64, Math.round(v))) } })
                  , 1, 8, 64)}
                </label>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/5">
            <label className="text-[9px] text-slate-500">缩 X
              {numInput(selectedScale[0], (v) =>
                updateStep(selected.id, { scale: [Math.max(0.05, v), selectedScale[1], selectedScale[2]] })
              , 0.05, 0.05, 10)}
            </label>
            <label className="text-[9px] text-slate-500">缩 Y
              {numInput(selectedScale[1], (v) =>
                updateStep(selected.id, { scale: [selectedScale[0], Math.max(0.05, v), selectedScale[2]] })
              , 0.05, 0.05, 10)}
            </label>
            <label className="text-[9px] text-slate-500">缩 Z
              {numInput(selectedScale[2], (v) =>
                updateStep(selected.id, { scale: [selectedScale[0], selectedScale[1], Math.max(0.05, v)] })
              , 0.05, 0.05, 10)}
            </label>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-white/5">
            <label className="text-[9px] text-slate-500">位 X
              {numInput(selected.position[0], (v) =>
                updateStep(selected.id, { position: [v, selected.position[1], selected.position[2]] })
              )}
            </label>
            <label className="text-[9px] text-slate-500">位 Y
              {numInput(selected.position[1], (v) =>
                updateStep(selected.id, { position: [selected.position[0], v, selected.position[2]] })
              )}
            </label>
            <label className="text-[9px] text-slate-500">位 Z
              {numInput(selected.position[2], (v) =>
                updateStep(selected.id, { position: [selected.position[0], selected.position[1], v] })
              )}
            </label>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <label className="text-[9px] text-slate-500">转 X°
              {numInput(
                (selected.rotation[0] * 180) / Math.PI,
                (v) => updateStep(selected.id, { rotation: [(v * Math.PI) / 180, selected.rotation[1], selected.rotation[2]] }),
                5
              )}
            </label>
            <label className="text-[9px] text-slate-500">转 Y°
              {numInput(
                (selected.rotation[1] * 180) / Math.PI,
                (v) => updateStep(selected.id, { rotation: [selected.rotation[0], (v * Math.PI) / 180, selected.rotation[2]] }),
                5
              )}
            </label>
            <label className="text-[9px] text-slate-500">转 Z°
              {numInput(
                (selected.rotation[2] * 180) / Math.PI,
                (v) => updateStep(selected.id, { rotation: [selected.rotation[0], selected.rotation[1], (v * Math.PI) / 180] }),
                5
              )}
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
