import { GeometryType } from '../../types';

export type FeaturePrimitive = 'vertex' | 'edge' | 'face';
export type ProjectionPlane = 'V' | 'H' | 'W' | 'R' | '3d';
export type CorrespondenceRule = '长对正' | '高平齐' | '宽相等';

// FeatureId 形如 "CUBE:vertex:tfr" 或 "CUT_BLOCK:face:top"
export type FeatureId = string;

export interface VertexGeometry {
  kind: 'vertex';
  // 世界坐标
  position: [number, number, number];
  // 热区小球半径（可选，默认 0.08）
  radius?: number;
}

// 平面法向：'X' → 面垂直于 X 轴（即 left/right 面），依此类推
export interface FaceGeometry {
  kind: 'face';
  // 世界坐标中面的中心
  center: [number, number, number];
  normal: 'X' | 'Y' | 'Z';
  // 面的尺寸（世界单位）。normal=X 时 (w 沿 Z, h 沿 Y)；normal=Y 时 (w 沿 X, h 沿 Z)；normal=Z 时 (w 沿 X, h 沿 Y)
  w: number;
  h: number;
}

// 为通用性保留，P0 未用到
export interface EdgeGeometry {
  kind: 'edge';
  from: [number, number, number];
  to: [number, number, number];
}

export type FeatureGeometry = VertexGeometry | FaceGeometry | EdgeGeometry;

export interface FeatureDescriptor {
  id: FeatureId;
  primitive: FeaturePrimitive;
  geometry: FeatureGeometry;
  // 在哪些视图里可见。featureMap 需要自己判断可见性（例如：后面在 V 视图不可见）
  presentIn: ProjectionPlane[];
  // 悬停时显示的对应关系
  correspondence: CorrespondenceRule[];
  // 面向学生的标签
  label: string;
}

export type FeatureMap = (params: {
  width: number;
  height: number;
  depth: number;
  cutSize: number;
}) => FeatureDescriptor[];

export type FeatureMapRegistry = Partial<Record<GeometryType, FeatureMap>>;

// world → local(plane) 坐标映射。
//   V 平面（后墙，无旋转）: local.x = world.x, local.y = world.y
//   H 平面（底面，绕X -90°）: local.x = world.x, local.y = -world.z
//   W 平面（右侧，绕Y -90°，作左视图）: local.x = world.z, local.y = world.y
//   R 平面（左侧，绕Y +90°，作右视图）: local.x = -world.z, local.y = world.y
export const worldToPlane = (
  plane: 'V' | 'H' | 'W' | 'R',
  world: [number, number, number]
): [number, number] => {
  const [x, y, z] = world;
  switch (plane) {
    case 'V': return [x, y];
    case 'H': return [x, -z];
    case 'W': return [z, y];
    case 'R': return [-z, y];
  }
};

// 根据面的法向 + 视图，决定：
//  - 该面是否在此视图中显示为矩形热区（返回 {w, h}）
//  - 还是退化为一条线（返回 null，P0 暂不生成热区）
export const faceRectInPlane = (
  face: FaceGeometry,
  plane: 'V' | 'H' | 'W' | 'R'
): { w: number; h: number } | null => {
  // 面垂直于某轴 → 该轴所在的侧视图里退化为线
  // normal=X 面：在 W/R（看 X 轴）里退化；在 V、H 里是矩形
  // normal=Y 面：在 H 里退化；在 V、W、R 里是矩形
  // normal=Z 面：在 V 里退化？不：V 看 Z 轴，法向 Z 的面正对观察者，呈现为矩形（w, h = 面的 w, h）
  //   真正退化为线的：normal=Z 面在 H、W、R
  //   normal=Y 面在 V、W、R（侧看顶面是一条水平线）→ 错，顶面在 W 里是水平线没错，但 V 里也是水平线
  // 矫正：
  //   normal=X：V、H 退化（被看穿）→ 错。想象左面（法向 -X），在 V 里（从+Z看）能看到它的投影是矩形吗？不能，左面平行于视线 Z 轴吗？不，V 从 +Z 看，左面在 ±X 方向上，法向 ±X，从 Z 看过去左面呈现为一条竖线（宽为 0，高为 h）。
  //   正解：法向 N 的面，在视图方向 = N 时显示为矩形，其他视图中退化为线
  //   视图方向：V = Z, H = Y, W = -X, R = +X（或都按 X 轴观察）
  //   normal=Z 面：V 是矩形，H/W/R 是线
  //   normal=Y 面：H 是矩形，V/W/R 是线
  //   normal=X 面：W 和 R 是矩形，V/H 是线
  const { normal } = face;
  if (normal === 'Z' && plane === 'V') return { w: face.w, h: face.h };
  if (normal === 'Y' && plane === 'H') return { w: face.w, h: face.h };
  if (normal === 'X' && (plane === 'W' || plane === 'R')) return { w: face.w, h: face.h };
  return null;
};
