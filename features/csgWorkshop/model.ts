import * as THREE from 'three';
import { ADDITION, SUBTRACTION, INTERSECTION, Evaluator, Brush } from 'three-bvh-csg';

export type PrimitiveKind = 'box' | 'cylinder' | 'sphere' | 'cone' | 'prism' | 'wedge';
export type OpKind = 'add' | 'subtract' | 'intersect';

export interface PrimitiveDef {
  kind: PrimitiveKind;
  // 通用参数，不同 kind 读取不同字段
  width: number;    // box.x / cylinder diameter / sphere diameter
  height: number;   // box.y / cylinder height
  depth: number;    // box.z
  segments?: number; // cylinder/sphere 分段数，默认 32
  sides?: number;    // prism 边数，默认 6
}

export interface Step {
  id: string;
  op: OpKind;           // 首步强制 add（忽略）
  primitive: PrimitiveDef;
  position: [number, number, number];
  rotation: [number, number, number]; // radians
  scale: [number, number, number];
  disabled?: boolean;    // 勾选禁用此步，便于对比
}

export type StepDraft = Omit<Step, 'id' | 'scale'> & { scale?: [number, number, number] };

export interface WorkshopPreset {
  id: string;
  label: string;
  description: string;
  steps: StepDraft[];
}

export interface CSGProject {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  steps: StepDraft[];
  thumbnail?: string;
  notes?: string;
}

export const WORKSHOP_SCHEMA_VERSION = 1;

export function genStepId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// 从 PrimitiveDef 构造 THREE.BufferGeometry
function buildPrimitiveGeometry(p: PrimitiveDef): THREE.BufferGeometry {
  const segments = clampInt(p.segments ?? 32, 8, 64);
  switch (p.kind) {
    case 'box':
      return new THREE.BoxGeometry(p.width, p.height, p.depth);
    case 'cylinder':
      return new THREE.CylinderGeometry(p.width / 2, p.width / 2, p.height, segments);
    case 'sphere':
      return new THREE.SphereGeometry(p.width / 2, segments, Math.max(8, segments / 2));
    case 'cone':
      return new THREE.ConeGeometry(p.width / 2, p.height, segments);
    case 'prism':
      return new THREE.CylinderGeometry(p.width / 2, p.width / 2, p.height, clampInt(p.sides ?? 6, 3, 12));
    case 'wedge': {
      const shape = new THREE.Shape();
      const w = p.width / 2;
      const h = p.height / 2;
      shape.moveTo(-w, -h);
      shape.lineTo(w, -h);
      shape.lineTo(w, h);
      shape.lineTo(-w, -h);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: p.depth, bevelEnabled: false });
      geo.translate(0, 0, -p.depth / 2);
      return geo;
    }
  }
}

function applyTransform(geo: THREE.BufferGeometry, step: Step): THREE.BufferGeometry {
  geo.scale(step.scale[0], step.scale[1], step.scale[2]);
  geo.rotateX(step.rotation[0]);
  geo.rotateY(step.rotation[1]);
  geo.rotateZ(step.rotation[2]);
  geo.translate(step.position[0], step.position[1], step.position[2]);
  return geo;
}

export function buildStepGeometry(step: Step): THREE.BufferGeometry {
  return applyTransform(buildPrimitiveGeometry(step.primitive), step);
}

// 核心：按步骤顺序评估，返回最终 geometry
export function evaluateSteps(steps: Step[]): THREE.BufferGeometry | null {
  const active = steps.filter((s) => !s.disabled);
  if (active.length === 0) return null;

  const evaluator = new Evaluator();
  // 首步无条件作为基体
  const firstGeo = buildStepGeometry(active[0]);
  let current: Brush = new Brush(firstGeo);

  for (let i = 1; i < active.length; i++) {
    const step = active[i];
    const geo = buildStepGeometry(step);
    const brush = new Brush(geo);
    const opConst = step.op === 'subtract' ? SUBTRACTION : step.op === 'intersect' ? INTERSECTION : ADDITION;
    current = evaluator.evaluate(current, brush, opConst);
    geo.dispose();
  }

  return current.geometry;
}

// 默认基元模板
export function defaultPrimitive(kind: PrimitiveKind): PrimitiveDef {
  if (kind === 'box') return { kind, width: 2, height: 2, depth: 2 };
  if (kind === 'cylinder') return { kind, width: 1.5, height: 2, depth: 1.5, segments: 32 };
  if (kind === 'sphere') return { kind, width: 1.5, height: 1.5, depth: 1.5, segments: 24 };
  if (kind === 'cone') return { kind, width: 1.5, height: 2, depth: 1.5, segments: 32 };
  if (kind === 'prism') return { kind, width: 1.6, height: 2, depth: 1.6, sides: 6 };
  return { kind, width: 2, height: 1.6, depth: 2 };
}

const PRIMITIVE_KINDS: PrimitiveKind[] = ['box', 'cylinder', 'sphere', 'cone', 'prism', 'wedge'];
const OP_KINDS: OpKind[] = ['add', 'subtract', 'intersect'];

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object');
}

function isNumberTuple(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function sanitizePrimitive(value: unknown): PrimitiveDef | null {
  if (!isRecord(value)) return null;
  const primitive = value as Partial<PrimitiveDef>;
  if (!primitive.kind || !PRIMITIVE_KINDS.includes(primitive.kind)) return null;
  const defaults = defaultPrimitive(primitive.kind);
  return {
    kind: primitive.kind,
    width: typeof primitive.width === 'number' && primitive.width > 0 ? primitive.width : defaults.width,
    height: typeof primitive.height === 'number' && primitive.height > 0 ? primitive.height : defaults.height,
    depth: typeof primitive.depth === 'number' && primitive.depth > 0 ? primitive.depth : defaults.depth,
    segments: typeof primitive.segments === 'number' ? clampInt(primitive.segments, 8, 64) : defaults.segments,
    sides: typeof primitive.sides === 'number' ? clampInt(primitive.sides, 3, 12) : defaults.sides,
  };
}

function sanitizeTuple(
  value: unknown,
  length: number,
  fallback: [number, number, number]
): [number, number, number] {
  return isNumberTuple(value, length)
    ? (value as [number, number, number])
    : fallback;
}

function parseStepArray(rawSteps: unknown): { steps: StepDraft[]; warnings: string[] } {
  if (!Array.isArray(rawSteps)) {
    throw new Error('文件格式不正确：缺少 steps 数组');
  }

  const warnings: string[] = [];
  const steps = rawSteps.map((raw, index): StepDraft | null => {
    if (!isRecord(raw)) {
      warnings.push(`第 ${index + 1} 步格式不正确，已跳过`);
      return null;
    }

    const primitive = sanitizePrimitive(raw.primitive);
    if (!primitive) {
      warnings.push(`第 ${index + 1} 步基元无效，已跳过`);
      return null;
    }

    const op = index === 0
      ? 'add'
      : raw.op && OP_KINDS.includes(raw.op as OpKind)
        ? (raw.op as OpKind)
        : 'subtract';

    const position = sanitizeTuple(raw.position, 3, [0, 0, 0]);
    const rotation = sanitizeTuple(raw.rotation, 3, [0, 0, 0]);
    const rawScale = sanitizeTuple(raw.scale, 3, [1, 1, 1]);
    const scale = rawScale.map((value) => Math.max(0.05, Math.min(10, value))) as [number, number, number];

    return {
      op,
      primitive,
      position,
      rotation,
      scale,
      disabled: Boolean(raw.disabled),
    };
  }).filter((step): step is StepDraft => Boolean(step));

  if (steps.length === 0) {
    throw new Error('文件中没有可用的建模步骤');
  }

  return { steps, warnings };
}

export function toStepDraft(step: Step | StepDraft): StepDraft {
  return {
    op: step.op,
    primitive: { ...step.primitive },
    position: [...step.position],
    rotation: [...step.rotation],
    scale: [...step.scale],
    disabled: step.disabled,
  };
}

export function parseWorkshopSteps(json: string): StepDraft[] {
  const data = JSON.parse(json) as unknown;
  const rawSteps = Array.isArray(data)
    ? data
    : isRecord(data) && Array.isArray(data.steps)
      ? data.steps
      : null;

  if (!rawSteps) {
    throw new Error('文件格式不正确：缺少 steps 数组');
  }

  return parseStepArray(rawSteps).steps;
}

export function parseWorkshopProject(json: string): { project: Partial<CSGProject>; steps: StepDraft[]; warnings: string[] } {
  const data = JSON.parse(json) as unknown;
  if (!isRecord(data) || data.schema !== WORKSHOP_SCHEMA_VERSION) {
    throw new Error(`仅支持 schema: ${WORKSHOP_SCHEMA_VERSION} 的 CSG 项目文件`);
  }

  const { steps, warnings } = parseStepArray(data.steps);
  return {
    project: {
      name: typeof data.name === 'string' && data.name.trim() ? data.name.trim() : undefined,
      notes: typeof data.notes === 'string' ? data.notes : undefined,
      thumbnail: typeof data.thumbnail === 'string' ? data.thumbnail : undefined,
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : undefined,
      updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : undefined,
    },
    steps,
    warnings,
  };
}

export function serializeWorkshopSteps(steps: Step[]): string {
  return JSON.stringify({
    schema: WORKSHOP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    steps: steps.map(toStepDraft),
  }, null, 2);
}

export function summarizeSteps(steps: Step[]): string {
  if (steps.length === 0) return '当前 CSG 工作台为空。';
  const active = steps.filter((step) => !step.disabled);
  const addCount = active.filter((step) => step.op === 'add').length;
  const subtractCount = active.filter((step) => step.op === 'subtract').length;
  const intersectCount = active.filter((step) => step.op === 'intersect').length;
  const kinds = Array.from(new Set(active.map((step) => step.primitive.kind))).join('、') || '无';
  const geometry = evaluateSteps(steps);
  let bounds = '暂无有效包围盒';
  if (geometry) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (box) {
      const size = box.getSize(new THREE.Vector3());
      bounds = `${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)}`;
    }
  }
  const hasHoleOrSlot = subtractCount > 0 ? '包含减料结构，可能形成孔、槽或切口' : '未使用减料结构';
  const mirroredAxes = [0, 1, 2]
    .filter((axis) =>
      active.some((step, index) =>
        active.slice(index + 1).some((other) =>
          step.primitive.kind === other.primitive.kind &&
          step.primitive.width === other.primitive.width &&
          step.primitive.height === other.primitive.height &&
          step.primitive.depth === other.primitive.depth &&
          step.position[axis] === -other.position[axis]
        )
      )
    )
    .map((axis) => ['X', 'Y', 'Z'][axis]);
  const symmetry = mirroredAxes.length > 0 ? `存在 ${mirroredAxes.join(' / ')} 轴对称布局` : '未检测到明显对称布局';
  return `CSG 模型摘要：总步骤 ${steps.length}，启用 ${active.length}；并集 ${addCount}，差集 ${subtractCount}，交集 ${intersectCount}；基元：${kinds}；包围盒约 ${bounds}；${hasHoleOrSlot}；${symmetry}。`;
}

export function formatWorkshopFileName(name: string, ext: 'json' | 'stl' | 'glb'): string {
  const safeName = (name || '模型名')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 48) || '模型名';
  return `${safeName}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export function buildProjectFromGeometry(
  geometry: THREE.BufferGeometry,
  name = '绘制转 CSG'
): CSGProject {
  geometry.computeBoundingBox();
  const box = geometry.boundingBox?.clone();
  const size = box?.getSize(new THREE.Vector3()) ?? new THREE.Vector3(2, 2, 2);
  const center = box?.getCenter(new THREE.Vector3()) ?? new THREE.Vector3();
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const normalizedScale = 2 / maxDim;
  const now = Date.now();

  const scaledSize = size.multiplyScalar(normalizedScale);
  const primitiveKind: PrimitiveKind = scaledSize.x <= 0.2 && scaledSize.z <= 0.2 ? 'sphere' : 'box';
  const draft: StepDraft = {
    op: 'add',
    primitive: {
      kind: primitiveKind,
      width: Math.max(0.1, scaledSize.x),
      height: Math.max(0.1, scaledSize.y),
      depth: Math.max(0.1, scaledSize.z),
      segments: primitiveKind === 'sphere' ? 24 : undefined,
    },
    position: [Number((-center.x * normalizedScale).toFixed(3)), Number((-center.y * normalizedScale).toFixed(3)), Number((-center.z * normalizedScale).toFixed(3))],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    disabled: false,
  };

  return {
    id: `csg_${now.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    createdAt: now,
    updatedAt: now,
    notes: '由绘制建模转换为 CSG 项目',
    steps: [draft],
  };
}

const baseRotation: [number, number, number] = [0, 0, 0];

export const WORKSHOP_PRESETS: WorkshopPreset[] = [
  {
    id: 'notched_block',
    label: '凹槽块',
    description: '方块顶面切出通槽，适合练习可见线和虚线。',
    steps: [
      {
        op: 'add',
        primitive: { kind: 'box', width: 2.8, height: 1.8, depth: 2 },
        position: [0, 0, 0],
        rotation: baseRotation,
      },
      {
        op: 'subtract',
        primitive: { kind: 'box', width: 0.8, height: 0.95, depth: 2.2 },
        position: [0, 0.55, 0],
        rotation: baseRotation,
      },
    ],
  },
  {
    id: 'cross_slot',
    label: '十字槽',
    description: '两条正交槽从顶面切入，俯视图结构更清楚。',
    steps: [
      {
        op: 'add',
        primitive: { kind: 'box', width: 2.8, height: 1.8, depth: 2.8 },
        position: [0, 0, 0],
        rotation: baseRotation,
      },
      {
        op: 'subtract',
        primitive: { kind: 'box', width: 2.95, height: 0.85, depth: 0.55 },
        position: [0, 0.55, 0],
        rotation: baseRotation,
      },
      {
        op: 'subtract',
        primitive: { kind: 'box', width: 0.55, height: 0.85, depth: 2.95 },
        position: [0, 0.55, 0],
        rotation: baseRotation,
      },
    ],
  },
  {
    id: 'through_hole',
    label: '通孔块',
    description: '圆柱差集打穿方块，观察圆孔在不同视图中的投影。',
    steps: [
      {
        op: 'add',
        primitive: { kind: 'box', width: 2.6, height: 2, depth: 1.8 },
        position: [0, 0, 0],
        rotation: baseRotation,
      },
      {
        op: 'subtract',
        primitive: { kind: 'cylinder', width: 0.8, height: 2.8, depth: 0.8, segments: 48 },
        position: [0, 0, 0],
        rotation: [0, 0, Math.PI / 2],
      },
    ],
  },
  {
    id: 'rounded_step',
    label: '圆头阶梯',
    description: '方块与圆柱并集再切除，形成更接近机械零件的外形。',
    steps: [
      {
        op: 'add',
        primitive: { kind: 'box', width: 2.4, height: 0.9, depth: 1.5 },
        position: [-0.25, -0.25, 0],
        rotation: baseRotation,
      },
      {
        op: 'add',
        primitive: { kind: 'cylinder', width: 1.5, height: 1.5, depth: 1.5, segments: 48 },
        position: [0.95, -0.25, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
      {
        op: 'add',
        primitive: { kind: 'box', width: 1.35, height: 1.1, depth: 1.5 },
        position: [-0.8, 0.65, 0],
        rotation: baseRotation,
      },
      {
        op: 'subtract',
        primitive: { kind: 'cylinder', width: 0.55, height: 1.8, depth: 0.55, segments: 40 },
        position: [0.95, -0.25, 0],
        rotation: [Math.PI / 2, 0, 0],
      },
    ],
  },
];
