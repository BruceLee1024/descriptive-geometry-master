import { create } from 'zustand';
import type { CSGProject, Step, StepDraft, OpKind, PrimitiveKind } from './model';
import {
  genStepId,
  defaultPrimitive,
  parseWorkshopSteps,
  parseWorkshopProject,
  toStepDraft,
} from './model';

const MAX_HISTORY = 40;
const STORAGE_KEY = 'descriptive-geometry:csg-workshop:v1';
const PROJECTS_KEY = 'descriptive-geometry:csg-projects:v1';
const ACTIVE_PROJECT_KEY = 'descriptive-geometry:csg-active-project:v1';

interface WorkshopState {
  steps: Step[];
  projects: CSGProject[];
  activeProjectId: string | null;
  history: Step[][];    // 过去状态栈
  future: Step[][];     // redo 栈
  selectedId: string | null;

  addPrimitive: (kind: PrimitiveKind, op?: OpKind) => void;
  updateStep: (id: string, patch: Partial<Step>) => void;
  removeStep: (id: string) => void;
  duplicateStep: (id: string) => void;
  mirrorStep: (id: string, axis: 0 | 1 | 2) => void;
  moveStep: (id: string, direction: -1 | 1) => void;
  resetStep: (id: string) => void;
  nudgeSelected: (axis: 0 | 1 | 2, delta: number) => void;
  select: (id: string | null) => void;
  toggleDisabled: (id: string) => void;
  applyPreset: (steps: StepDraft[]) => void;
  importSteps: (steps: StepDraft[]) => void;
  setProjectNotes: (notes: string) => void;
  clear: () => void;
  undo: () => void;
  redo: () => void;
  createProject: (name?: string) => void;
  openProject: (id: string) => void;
  saveProject: (patch?: Partial<Pick<CSGProject, 'name' | 'notes' | 'thumbnail'>>) => void;
  duplicateProject: (id: string) => void;
  removeProject: (id: string) => void;
  renameProject: (id: string, name: string) => void;
  exportProject: () => string;
  importProject: (json: string) => void;
}

function cloneStep(step: Step): Step {
  return {
    ...step,
    primitive: { ...step.primitive },
    position: [...step.position],
    rotation: [...step.rotation],
    scale: [...(step.scale ?? [1, 1, 1])] as [number, number, number],
  };
}

function cloneSteps(steps: Step[]): Step[] {
  return steps.map(cloneStep);
}

function snapshot(s: WorkshopState): Step[][] {
  return [...s.history, cloneSteps(s.steps)].slice(-MAX_HISTORY);
}

function createStepsFromDrafts(drafts: StepDraft[]): Step[] {
  return drafts.map((draft, index) => ({
    ...draft,
    id: genStepId(),
    op: index === 0 ? 'add' : draft.op,
    primitive: { ...draft.primitive },
    position: [...draft.position] as [number, number, number],
    rotation: [...draft.rotation] as [number, number, number],
    scale: [...(draft.scale ?? [1, 1, 1])] as [number, number, number],
  }));
}

function createProjectFromSteps(name: string, steps: Step[]): CSGProject {
  const now = Date.now();
  return {
    id: `csg_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
    steps: steps.map(toStepDraft),
    notes: '',
  };
}

function loadPersistedSteps(): Step[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map(cloneStep);
  } catch {
    return [];
  }
}

function loadProjects(): CSGProject[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const projects: CSGProject[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const project = item as Partial<CSGProject> & { steps?: unknown };
      if (typeof project.id !== 'string' || typeof project.name !== 'string' || !Array.isArray(project.steps)) continue;
      let steps: Step[] = [];
      try {
        steps = createStepsFromDrafts(parseWorkshopSteps(JSON.stringify(project.steps)));
      } catch {
        continue;
      }
      if (steps.length === 0) continue;
      projects.push({
        id: project.id,
        name: project.name,
        createdAt: typeof project.createdAt === 'number' ? project.createdAt : Date.now(),
        updatedAt: typeof project.updatedAt === 'number' ? project.updatedAt : Date.now(),
        steps: steps.map(toStepDraft),
        thumbnail: typeof project.thumbnail === 'string' ? project.thumbnail : undefined,
        notes: typeof project.notes === 'string' ? project.notes : '',
      });
    }
    return projects.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function persistSteps(steps: Step[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneSteps(steps)));
  } catch {
    // Storage can fail in private browsing or quota-limited contexts.
  }
}

function persistProjects(projects: CSGProject[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    // Ignore storage failures.
  }
}

function persistActiveProject(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) window.localStorage.setItem(ACTIVE_PROJECT_KEY, id);
  else window.localStorage.removeItem(ACTIVE_PROJECT_KEY);
}

const persistedSteps = loadPersistedSteps();
const persistedProjects = loadProjects();
const persistedActiveProjectId =
  typeof window === 'undefined' ? null : window.localStorage.getItem(ACTIVE_PROJECT_KEY);
const activeProject = persistedProjects.find((project) => project.id === persistedActiveProjectId);
const initialSteps = activeProject ? createStepsFromDrafts(activeProject.steps) : persistedSteps;

export const useWorkshopStore = create<WorkshopState>((set, get) => ({
  steps: initialSteps,
  projects: persistedProjects,
  activeProjectId: activeProject?.id ?? null,
  history: [],
  future: [],
  selectedId: initialSteps.at(-1)?.id ?? null,

  addPrimitive: (kind, op = 'add') => {
    set((s) => {
      const isFirst = s.steps.length === 0;
      const newStep: Step = {
        id: genStepId(),
        op: isFirst ? 'add' : op,
        primitive: defaultPrimitive(kind),
        position: [0, 0, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
      };
      const steps = [...s.steps, newStep];
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
          selectedId: newStep.id,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
        selectedId: newStep.id,
      };
    });
  },

  updateStep: (id, patch) => {
    set((s) => {
      const steps = s.steps.map((st) => (st.id === id ? { ...st, ...patch } : st));
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
      };
    });
  },

  removeStep: (id) => {
    set((s) => {
      const index = s.steps.findIndex((st) => st.id === id);
      const steps = s.steps.filter((st) => st.id !== id);
      const nextSelection =
        s.selectedId === id ? steps[Math.min(index, steps.length - 1)]?.id ?? null : s.selectedId;
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
          selectedId: nextSelection,
        };
      }
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
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
          selectedId: duplicated.id,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
        selectedId: duplicated.id,
      };
    });
  },

  mirrorStep: (id, axis) => {
    set((s) => {
      const index = s.steps.findIndex((st) => st.id === id);
      if (index < 0) return s;
      const source = s.steps[index];
      const position: [number, number, number] = [...source.position];
      position[axis] = Number((-position[axis]).toFixed(3));
      const mirrored: Step = {
        ...cloneStep(source),
        id: genStepId(),
        position,
      };
      const steps = [...s.steps.slice(0, index + 1), mirrored, ...s.steps.slice(index + 1)];
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
          selectedId: mirrored.id,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
        selectedId: mirrored.id,
      };
    });
  },

  moveStep: (id, direction) => {
    set((s) => {
      const index = s.steps.findIndex((st) => st.id === id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= s.steps.length) return s;
      const steps = cloneSteps(s.steps);
      const [moved] = steps.splice(index, 1);
      steps.splice(nextIndex, 0, moved);
      steps[0] = { ...steps[0], op: 'add' };
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
      };
    });
  },

  resetStep: (id) => {
    set((s) => {
      const steps = s.steps.map((st) => {
        if (st.id !== id) return st;
        return {
          ...st,
          primitive: defaultPrimitive(st.primitive.kind),
          position: [0, 0, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          scale: [1, 1, 1] as [number, number, number],
        };
      });
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
      };
    });
  },

  nudgeSelected: (axis, delta) => {
    set((s) => {
      if (!s.selectedId) return s;
      const steps = s.steps.map((st) => {
        if (st.id !== s.selectedId) return st;
        const position: [number, number, number] = [...st.position];
        position[axis] = Number((position[axis] + delta).toFixed(3));
        return { ...st, position };
      });
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
      };
    });
  },

  select: (id) => set({ selectedId: id }),

  toggleDisabled: (id) => {
    set((s) => {
      const steps = s.steps.map((st) => (st.id === id ? { ...st, disabled: !st.disabled } : st));
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
      };
    });
  },

  applyPreset: (drafts) => {
    set((s) => {
      const steps = createStepsFromDrafts(drafts);
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
          selectedId: steps.at(-1)?.id ?? null,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
        selectedId: steps.at(-1)?.id ?? null,
      };
    });
  },

  importSteps: (drafts) => {
    set((s) => {
      const steps = createStepsFromDrafts(drafts);
      persistSteps(steps);
      if (s.activeProjectId) {
        const projects = s.projects.map((project) =>
          project.id === s.activeProjectId
            ? { ...project, updatedAt: Date.now(), steps: steps.map(toStepDraft) }
            : project
        );
        persistProjects(projects);
        return {
          history: snapshot(s),
          future: [],
          steps,
          projects,
          selectedId: steps.at(-1)?.id ?? null,
        };
      }
      return {
        history: snapshot(s),
        future: [],
        steps,
        selectedId: steps.at(-1)?.id ?? null,
      };
    });
  },

  setProjectNotes: (notes) => {
    set((s) => {
      if (!s.activeProjectId) return s;
      const projects = s.projects.map((project) =>
        project.id === s.activeProjectId
          ? { ...project, notes, updatedAt: Date.now() }
          : project
      );
      persistProjects(projects);
      return { projects };
    });
  },

  clear: () => {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY);
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
    const steps = cloneSteps(prev);
    persistSteps(steps);
    set({
      steps,
      history: s.history.slice(0, -1),
      future: [cloneSteps(s.steps), ...s.future].slice(0, MAX_HISTORY),
      selectedId: prev.some((step) => step.id === s.selectedId) ? s.selectedId : prev.at(-1)?.id ?? null,
    });
  },

  redo: () => {
    const s = get();
    if (s.future.length === 0) return;
    const next = s.future[0];
    const steps = cloneSteps(next);
    persistSteps(steps);
    set({
      steps,
      history: [...s.history, cloneSteps(s.steps)].slice(-MAX_HISTORY),
      future: s.future.slice(1),
      selectedId: next.some((step) => step.id === s.selectedId) ? s.selectedId : next.at(-1)?.id ?? null,
    });
  },

  createProject: (name = '未命名 CSG 模型') => {
    set((s) => {
      const steps: Step[] = [];
      const project = createProjectFromSteps(name, steps);
      const projects = [project, ...s.projects];
      persistProjects(projects);
      persistActiveProject(project.id);
      persistSteps(steps);
      return {
        history: snapshot(s),
        future: [],
        steps,
        projects,
        activeProjectId: project.id,
        selectedId: null,
      };
    });
  },

  openProject: (id) => {
    const project = get().projects.find((item) => item.id === id);
    if (!project) return;
    const steps = createStepsFromDrafts(project.steps);
    persistSteps(steps);
    persistActiveProject(project.id);
    set((s) => ({
      history: snapshot(s),
      future: [],
      steps,
      activeProjectId: project.id,
      selectedId: steps.at(-1)?.id ?? null,
    }));
  },

  saveProject: (patch = {}) => {
    set((s) => {
      const existing = s.projects.find((project) => project.id === s.activeProjectId);
      const project = existing ?? createProjectFromSteps(patch.name || '未命名 CSG 模型', s.steps);
      const updated: CSGProject = {
        ...project,
        ...patch,
        name: (patch.name ?? project.name).trim() || project.name,
        updatedAt: Date.now(),
        steps: s.steps.map(toStepDraft),
      };
      const projects = [updated, ...s.projects.filter((item) => item.id !== updated.id)].sort((a, b) => b.updatedAt - a.updatedAt);
      persistProjects(projects);
      persistActiveProject(updated.id);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cloneSteps(s.steps)));
      }
      return { projects, activeProjectId: updated.id };
    });
  },

  duplicateProject: (id) => {
    set((s) => {
      const source = s.projects.find((project) => project.id === id);
      if (!source) return s;
      const now = Date.now();
      const copy: CSGProject = {
        ...source,
        id: `csg_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name: `${source.name} 副本`,
        createdAt: now,
        updatedAt: now,
        steps: source.steps.map((step) => ({ ...step, primitive: { ...step.primitive }, position: [...step.position], rotation: [...step.rotation], scale: [...step.scale] })),
      };
      const projects = [copy, ...s.projects];
      persistProjects(projects);
      persistActiveProject(copy.id);
      return { projects };
    });
  },

  removeProject: (id) => {
    set((s) => {
      const projects = s.projects.filter((project) => project.id !== id);
      const isActive = s.activeProjectId === id;
      const nextActive = isActive ? projects[0] ?? null : null;
      const steps = nextActive ? createStepsFromDrafts(nextActive.steps) : isActive ? [] : s.steps;
      persistProjects(projects);
      if (isActive) {
        persistActiveProject(nextActive?.id ?? null);
        persistSteps(steps);
      }
      return {
        projects,
        steps,
        activeProjectId: isActive ? nextActive?.id ?? null : s.activeProjectId,
        selectedId: isActive ? steps.at(-1)?.id ?? null : s.selectedId,
      };
    });
  },

  renameProject: (id, name) => {
    set((s) => {
      const cleanName = name.trim();
      if (!cleanName) return s;
      const projects = s.projects.map((project) => project.id === id ? { ...project, name: cleanName, updatedAt: Date.now() } : project);
      persistProjects(projects);
      return { projects };
    });
  },

  exportProject: () => {
    const s = get();
    const existing = s.projects.find((project) => project.id === s.activeProjectId);
    const project = existing ?? createProjectFromSteps('未命名 CSG 模型', s.steps);
    return JSON.stringify({
      schema: 1,
      ...project,
      steps: s.steps.map(toStepDraft),
      updatedAt: Date.now(),
    }, null, 2);
  },

  importProject: (json) => {
    const { project: incoming, steps, warnings } = parseWorkshopProject(json);
    const now = Date.now();
    const importedSteps = createStepsFromDrafts(steps);
    const project: CSGProject = {
      id: `csg_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      name: incoming.name?.trim() ? incoming.name.trim() : '导入的 CSG 模型',
      createdAt: now,
      updatedAt: now,
      notes: typeof incoming.notes === 'string' ? incoming.notes : undefined,
      thumbnail: typeof incoming.thumbnail === 'string' ? incoming.thumbnail : undefined,
      steps: steps.map(toStepDraft),
    };
    set((s) => {
      const projects = [project, ...s.projects];
      persistProjects(projects);
      persistActiveProject(project.id);
      persistSteps(importedSteps);
      return {
        history: snapshot(s),
        future: [],
        projects,
        steps: importedSteps,
        activeProjectId: project.id,
        selectedId: importedSteps.at(-1)?.id ?? null,
      };
    });
    if (warnings.length > 0 && typeof window !== 'undefined') {
      window.console.warn('[csgWorkshop] project import warnings:', warnings);
    }
  },
}));
