import { create } from 'zustand';
import type { Step, StepDraft, OpKind, PrimitiveKind } from './model';
import { genStepId, defaultPrimitive } from './model';

const MAX_HISTORY = 40;

interface WorkshopState {
  steps: Step[];
  history: Step[][];    // 过去状态栈
  future: Step[][];     // redo 栈
  selectedId: string | null;

  addPrimitive: (kind: PrimitiveKind, op?: OpKind) => void;
  updateStep: (id: string, patch: Partial<Step>) => void;
  removeStep: (id: string) => void;
  duplicateStep: (id: string) => void;
  nudgeSelected: (axis: 0 | 1 | 2, delta: number) => void;
  select: (id: string | null) => void;
  toggleDisabled: (id: string) => void;
  applyPreset: (steps: StepDraft[]) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
}

function cloneStep(step: Step): Step {
  return {
    ...step,
    primitive: { ...step.primitive },
    position: [...step.position],
    rotation: [...step.rotation],
  };
}

function cloneSteps(steps: Step[]): Step[] {
  return steps.map(cloneStep);
}

function snapshot(s: WorkshopState): Step[][] {
  return [...s.history, cloneSteps(s.steps)].slice(-MAX_HISTORY);
}

export const useWorkshopStore = create<WorkshopState>((set, get) => ({
  steps: [],
  history: [],
  future: [],
  selectedId: null,

  addPrimitive: (kind, op = 'add') => {
    set((s) => {
      const isFirst = s.steps.length === 0;
      const newStep: Step = {
        id: genStepId(),
        op: isFirst ? 'add' : op,
        primitive: defaultPrimitive(kind),
        position: [0, 0, 0],
        rotation: [0, 0, 0],
      };
      return {
        history: snapshot(s),
        future: [],
        steps: [...s.steps, newStep],
        selectedId: newStep.id,
      };
    });
  },

  updateStep: (id, patch) => {
    set((s) => ({
      history: snapshot(s),
      future: [],
      steps: s.steps.map((st) => (st.id === id ? { ...st, ...patch } : st)),
    }));
  },

  removeStep: (id) => {
    set((s) => {
      const index = s.steps.findIndex((st) => st.id === id);
      const steps = s.steps.filter((st) => st.id !== id);
      const nextSelection =
        s.selectedId === id ? steps[Math.min(index, steps.length - 1)]?.id ?? null : s.selectedId;
      return {
        history: snapshot(s),
        future: [],
        steps,
        selectedId: nextSelection,
      };
    });
  },

  duplicateStep: (id) => {
    set((s) => {
      const index = s.steps.findIndex((st) => st.id === id);
      if (index < 0) return s;
      const source = s.steps[index];
      const duplicated: Step = {
        ...cloneStep(source),
        id: genStepId(),
        op: s.steps.length === 0 ? 'add' : source.op,
        position: [source.position[0] + 0.25, source.position[1], source.position[2] + 0.25],
      };
      const steps = [...s.steps.slice(0, index + 1), duplicated, ...s.steps.slice(index + 1)];
      return {
        history: snapshot(s),
        future: [],
        steps,
        selectedId: duplicated.id,
      };
    });
  },

  nudgeSelected: (axis, delta) => {
    set((s) => {
      if (!s.selectedId) return s;
      return {
        history: snapshot(s),
        future: [],
        steps: s.steps.map((st) => {
          if (st.id !== s.selectedId) return st;
          const position: [number, number, number] = [...st.position];
          position[axis] = Number((position[axis] + delta).toFixed(3));
          return { ...st, position };
        }),
      };
    });
  },

  select: (id) => set({ selectedId: id }),

  toggleDisabled: (id) => {
    set((s) => ({
      history: snapshot(s),
      future: [],
      steps: s.steps.map((st) => (st.id === id ? { ...st, disabled: !st.disabled } : st)),
    }));
  },

  applyPreset: (drafts) => {
    set((s) => {
      const steps: Step[] = drafts.map((draft, index) => ({
        ...draft,
        id: genStepId(),
        op: index === 0 ? 'add' : draft.op,
        primitive: { ...draft.primitive },
        position: [...draft.position] as [number, number, number],
        rotation: [...draft.rotation] as [number, number, number],
      }));
      return {
        history: snapshot(s),
        future: [],
        steps,
        selectedId: steps.at(-1)?.id ?? null,
      };
    });
  },

  clear: () => {
    set((s) => ({
      history: snapshot(s),
      future: [],
      steps: [],
      selectedId: null,
    }));
  },

  undo: () => {
    const s = get();
    if (s.history.length === 0) return;
    const prev = s.history[s.history.length - 1];
    set({
      steps: cloneSteps(prev),
      history: s.history.slice(0, -1),
      future: [cloneSteps(s.steps), ...s.future].slice(0, MAX_HISTORY),
      selectedId: prev.some((step) => step.id === s.selectedId) ? s.selectedId : prev.at(-1)?.id ?? null,
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    set({
      steps: cloneSteps(next),
      history: [...s.history, cloneSteps(s.steps)].slice(-MAX_HISTORY),
      future: s.future.slice(1),
      selectedId: next.some((step) => step.id === s.selectedId) ? s.selectedId : next.at(-1)?.id ?? null,
    });
  },
}));
