import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { useHighlightStore } from './store';
import { featureMapRegistry } from './featureMaps';
import type { FeatureDescriptor, VertexGeometry, FaceGeometry } from './types';
import type { GeometryType, GeometryParams } from '../../types';

// 三等关系颜色约定：
//   长对正（V ↔ H，共享 X）→ 红
//   高平齐（V ↔ W/R，共享 Y）→ 绿
//   宽相等（H ↔ W/R，共享 Z）→ 蓝
export const CORRESPONDENCE_COLORS = {
  长对正: '#ef4444',
  高平齐: '#22c55e',
  宽相等: '#3b82f6',
} as const;

interface Props {
  geometryType: GeometryType;
  params: GeometryParams;
  // 展开态下墙已散开，辅助线几何意义不再成立，外部传 false 禁用
  visible?: boolean;
}

// 几何盒参数（与 GlassBoxScene 保持一致）
const BOX_SIZE = 5;
const V_WALL_Z = -BOX_SIZE / 2;
const H_WALL_Y = -BOX_SIZE / 2;
const W_WALL_X = BOX_SIZE / 2;
const R_WALL_X = -BOX_SIZE / 2;
const EPS = 0.06; // 离墙表面的微小偏移，避免 z-fighting

type Pt = [number, number, number];

const projectTo = (p: Pt, plane: 'V' | 'H' | 'W' | 'R'): Pt => {
  const [x, y, z] = p;
  switch (plane) {
    case 'V': return [x, y, V_WALL_Z + EPS];
    case 'H': return [x, H_WALL_Y + EPS, z];
    case 'W': return [W_WALL_X - EPS, y, z];
    case 'R': return [R_WALL_X + EPS, y, z];
  }
};

// 对顶点：取其位置；对面：取面中心
const pickSpacePoint = (f: FeatureDescriptor): Pt | null => {
  if (f.geometry.kind === 'vertex') {
    return (f.geometry as VertexGeometry).position;
  }
  if (f.geometry.kind === 'face') {
    return (f.geometry as FaceGeometry).center;
  }
  return null;
};

export const CorrespondenceLines: React.FC<Props> = ({ geometryType, params, visible = true }) => {
  const enabled = useHighlightStore((s) => s.enabled);
  const linesEnabled = useHighlightStore((s) => s.correspondenceLinesEnabled);
  const hoveredId = useHighlightStore((s) => s.hoveredId);

  const hoveredFeature = useMemo<FeatureDescriptor | null>(() => {
    if (!hoveredId) return null;
    const map = featureMapRegistry[geometryType];
    if (!map) return null;
    const list = map({
      width: params.width,
      height: params.height,
      depth: params.depth,
      cutSize: params.cutSize,
    });
    return list.find((f) => f.id === hoveredId) ?? null;
  }, [hoveredId, geometryType, params.width, params.height, params.depth, params.cutSize]);

  if (!enabled || !linesEnabled || !visible || !hoveredFeature) return null;

  const p = pickSpacePoint(hoveredFeature);
  if (!p) return null;

  const present = new Set(hoveredFeature.presentIn);
  const showV = present.has('V');
  const showH = present.has('H');
  const showW = present.has('W');
  const showR = present.has('R');

  const pV = showV ? projectTo(p, 'V') : null;
  const pH = showH ? projectTo(p, 'H') : null;
  const pW = showW ? projectTo(p, 'W') : null;
  const pR = showR ? projectTo(p, 'R') : null;

  const LINE_WIDTH = 2;
  const DASH_SIZE = 0.12;
  const GAP_SIZE = 0.08;

  // 规则连线：
  //   长对正（红）：V↔H（沿 Z 方向连，x,y 对齐）
  //   高平齐（绿）：V↔W 或 V↔R（沿 X 方向连，y,z 对齐）
  //   宽相等（蓝）：H↔W 或 H↔R（沿 Y 方向连，x,z 对齐）
  //
  // 为了清晰，我们在 hover feature 出现的平面间连线；每条线只有一条（W 优先于 R）。
  const segments: Array<{ from: Pt; to: Pt; color: string; label: string }> = [];

  // 从空间点到 V 投影点的投射虚线（辅助理解点如何映射到墙上）
  if (pV) segments.push({ from: p, to: pV, color: '#94a3b8', label: 'projector-V' });
  if (pH) segments.push({ from: p, to: pH, color: '#94a3b8', label: 'projector-H' });
  if (pW) segments.push({ from: p, to: pW, color: '#94a3b8', label: 'projector-W' });
  else if (pR) segments.push({ from: p, to: pR, color: '#94a3b8', label: 'projector-R' });

  // 三等关系连线（投影点之间）——核心教学内容
  // 长对正：V↔H，在空间中是：从 (x, y, V_WALL) 走到 (x, H_WALL, z)，为了更直观改成先降到角点
  //   实际操作：画一条沿 (x, y→H_WALL, V_WALL) → (x, H_WALL, V_WALL→z) 的折线
  //   但学生在折叠图中更习惯看到直线对齐。先用两段折线：P_V → 角点(x, H_WALL, V_WALL) → P_H
  const cornerVH: Pt = [p[0], H_WALL_Y + EPS, V_WALL_Z + EPS];
  if (pV && pH) {
    segments.push({ from: pV, to: cornerVH, color: CORRESPONDENCE_COLORS.长对正, label: 'VH-1' });
    segments.push({ from: cornerVH, to: pH, color: CORRESPONDENCE_COLORS.长对正, label: 'VH-2' });
  }

  // 高平齐：V↔W，通过角点 (W_WALL, y, V_WALL)
  if (pV && pW) {
    const corner: Pt = [W_WALL_X - EPS, p[1], V_WALL_Z + EPS];
    segments.push({ from: pV, to: corner, color: CORRESPONDENCE_COLORS.高平齐, label: 'VW-1' });
    segments.push({ from: corner, to: pW, color: CORRESPONDENCE_COLORS.高平齐, label: 'VW-2' });
  } else if (pV && pR) {
    const corner: Pt = [R_WALL_X + EPS, p[1], V_WALL_Z + EPS];
    segments.push({ from: pV, to: corner, color: CORRESPONDENCE_COLORS.高平齐, label: 'VR-1' });
    segments.push({ from: corner, to: pR, color: CORRESPONDENCE_COLORS.高平齐, label: 'VR-2' });
  }

  // 宽相等：H↔W，通过角点 (W_WALL, H_WALL, z)
  if (pH && pW) {
    const corner: Pt = [W_WALL_X - EPS, H_WALL_Y + EPS, p[2]];
    segments.push({ from: pH, to: corner, color: CORRESPONDENCE_COLORS.宽相等, label: 'HW-1' });
    segments.push({ from: corner, to: pW, color: CORRESPONDENCE_COLORS.宽相等, label: 'HW-2' });
  } else if (pH && pR) {
    const corner: Pt = [R_WALL_X + EPS, H_WALL_Y + EPS, p[2]];
    segments.push({ from: pH, to: corner, color: CORRESPONDENCE_COLORS.宽相等, label: 'HR-1' });
    segments.push({ from: corner, to: pR, color: CORRESPONDENCE_COLORS.宽相等, label: 'HR-2' });
  }

  return (
    <group renderOrder={1000}>
      {segments.map((s, i) => (
        <Line
          key={`${s.label}-${i}`}
          points={[s.from, s.to]}
          color={s.color}
          lineWidth={LINE_WIDTH}
          dashed
          dashSize={DASH_SIZE}
          gapSize={GAP_SIZE}
          transparent
          opacity={s.color === '#94a3b8' ? 0.5 : 0.9}
          depthTest={false}
        />
      ))}
      {/* 投影点小标记 */}
      {[pV, pH, pW, pR].map((pp, i) => pp && (
        <mesh key={i} position={pp}>
          <sphereGeometry args={[0.06, 12, 12]} />
          <meshBasicMaterial color="#facc15" depthTest={false} />
        </mesh>
      ))}
    </group>
  );
};
