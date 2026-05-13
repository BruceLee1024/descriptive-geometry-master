import * as THREE from 'three';
import { ADDITION, SUBTRACTION, INTERSECTION, Evaluator, Brush } from 'three-bvh-csg';

export type PrimitiveKind = 'box' | 'cylinder' | 'sphere';
export type OpKind = 'add' | 'subtract' | 'intersect';

export interface PrimitiveDef {
  kind: PrimitiveKind;
  // 通用参数，不同 kind 读取不同字段
  width: number;    // box.x / cylinder diameter / sphere diameter
  height: number;   // box.y / cylinder height
  depth: number;    // box.z
  segments?: number; // cylinder/sphere 分段数，默认 32
}

export interface Step {
  id: string;
  op: OpKind;           // 首步强制 add（忽略）
  primitive: PrimitiveDef;
  position: [number, number, number];
  rotation: [number, number, number]; // radians
  disabled?: boolean;    // 勾选禁用此步，便于对比
}

export type StepDraft = Omit<Step, 'id'>;

export interface WorkshopPreset {
  id: string;
  label: string;
  description: string;
  steps: StepDraft[];
}

export function genStepId(): string {
  return `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// 从 PrimitiveDef 构造 THREE.BufferGeometry
function buildPrimitiveGeometry(p: PrimitiveDef): THREE.BufferGeometry {
  switch (p.kind) {
    case 'box':
      return new THREE.BoxGeometry(p.width, p.height, p.depth);
    case 'cylinder':
      return new THREE.CylinderGeometry(p.width / 2, p.width / 2, p.height, p.segments ?? 32);
    case 'sphere':
      return new THREE.SphereGeometry(p.width / 2, p.segments ?? 32, Math.max(8, (p.segments ?? 32) / 2));
  }
}

function applyTransform(geo: THREE.BufferGeometry, step: Step): THREE.BufferGeometry {
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
  return { kind, width: 1.5, height: 1.5, depth: 1.5, segments: 24 };
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
