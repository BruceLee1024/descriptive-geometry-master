import React from 'react';
import {
  Box, Cylinder, Circle, Plus, Minus, X as XIcon, Trash2,
  Undo2, Redo2, Eye, EyeOff, ArrowRight, Boxes,
} from 'lucide-react';
import { useWorkshopStore } from './store';
import type { OpKind, PrimitiveKind } from './model';
import { WORKSHOP_PRESETS } from './model';

const PRIMITIVE_LABELS: Record<PrimitiveKind, { label: string; Icon: React.ComponentType<{ size?: number }> }> = {
  box: { label: '方块', Icon: Box },
  cylinder: { label: '圆柱', Icon: Cylinder },
  sphere: { label: '球体', Icon: Circle },
};

const OP_META: Record<OpKind, { label: string; color: string; Icon: React.ComponentType<{ size?: number }> }> = {
  add: { label: '并', color: 'emerald', Icon: Plus },
  subtract: { label: '减', color: 'rose', Icon: Minus },
  intersect: { label: '交', color: 'amber', Icon: XIcon },
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
  const steps = useWorkshopStore((s) => s.steps);
  const selectedId = useWorkshopStore((s) => s.selectedId);
  const addPrimitive = useWorkshopStore((s) => s.addPrimitive);
  const updateStep = useWorkshopStore((s) => s.updateStep);
  const removeStep = useWorkshopStore((s) => s.removeStep);
  const select = useWorkshopStore((s) => s.select);
  const toggleDisabled = useWorkshopStore((s) => s.toggleDisabled);
  const applyPreset = useWorkshopStore((s) => s.applyPreset);
  const clear = useWorkshopStore((s) => s.clear);
  const undo = useWorkshopStore((s) => s.undo);
  const redo = useWorkshopStore((s) => s.redo);
  const historyLen = useWorkshopStore((s) => s.history.length);
  const futureLen = useWorkshopStore((s) => s.future.length);

  const selected = steps.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-2">
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
                    className={`bg-slate-900/60 border border-${opMeta.color}-500/30 text-${opMeta.color}-300 text-[10px] rounded px-1 py-0.5 outline-none`}
                  >
                    <option value="add">并</option>
                    <option value="subtract">减</option>
                    <option value="intersect">交</option>
                  </select>
                )}
                <PrimIcon size={12} />
                <span className="flex-1 truncate">{label}</span>
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
