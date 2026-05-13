import type { FeatureMap, FeatureDescriptor } from '../types';

// L 型支座：底部一整条 + 左侧一竖条，缺左上角矩形。
// 形状（在 XY 平面挤出 depth）：
//   (-w,-h) → (w,-h) → (w,-h+thick) → (-w+thick,-h+thick) → (-w+thick,h) → (-w,h) → (-w,-h)
// 即：底板（宽 width，高 thick）+ 左板（宽 thick，高 height）
export const lShapeFeatureMap: FeatureMap = ({ width, height, depth }) => {
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const thick = Math.min(width, height) * 0.4;

  // 12 个 3D 顶点：底板 8 顶点 + 左板上 4 顶点 - 共用 4 顶点 = 12
  type V = { key: string; pos: [number, number, number]; label: string };
  const vertices: V[] = [
    // 底板前面 4 顶点
    { key: 'base_bfl', pos: [-w, -h, d], label: '底板左下前' },
    { key: 'base_bfr', pos: [ w, -h, d], label: '底板右下前' },
    { key: 'base_tfr', pos: [ w, -h + thick, d], label: '底板右上前' },
    { key: 'base_tfl', pos: [-w + thick, -h + thick, d], label: '内拐角前' },
    // 底板后面 4 顶点
    { key: 'base_bbl', pos: [-w, -h, -d], label: '底板左下后' },
    { key: 'base_bbr', pos: [ w, -h, -d], label: '底板右下后' },
    { key: 'base_tbr', pos: [ w, -h + thick, -d], label: '底板右上后' },
    { key: 'base_tbl', pos: [-w + thick, -h + thick, -d], label: '内拐角后' },
    // 左板上部 4 顶点（底板与左板共用 -w,-h 两个顶点）
    { key: 'left_tfl', pos: [-w,  h, d], label: '左板左上前' },
    { key: 'left_tfr', pos: [-w + thick, h, d], label: '左板右上前' },
    { key: 'left_tbl', pos: [-w,  h, -d], label: '左板左上后' },
    { key: 'left_tbr', pos: [-w + thick, h, -d], label: '左板右上后' },
  ];

  const vertexFeatures: FeatureDescriptor[] = vertices.map((v) => ({
    id: `L_SHAPE:vertex:${v.key}`,
    primitive: 'vertex',
    geometry: { kind: 'vertex', position: v.pos },
    presentIn: ['3d', 'V', 'H', 'W', 'R'],
    correspondence: ['长对正', '高平齐', '宽相等'],
    label: `顶点 ${v.label}`,
  }));

  // 主要可识别面（P0 选有代表性的几个，其余 P1 补齐）
  const faces: FeatureDescriptor[] = [
    // 前 L 形面（整个 L 轮廓，normal=+Z）
    {
      id: 'L_SHAPE:face:front_L',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, 0, d], normal: 'Z', w: width, h: height },
      presentIn: ['3d', 'V'],
      correspondence: ['长对正', '高平齐'],
      label: 'L 型前面',
    },
    {
      id: 'L_SHAPE:face:back_L',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, 0, -d], normal: 'Z', w: width, h: height },
      presentIn: ['3d', 'V'],
      correspondence: ['长对正', '高平齐'],
      label: 'L 型后面',
    },
    // 底板下底面
    {
      id: 'L_SHAPE:face:base_bottom',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, -h, 0], normal: 'Y', w: width, h: depth },
      presentIn: ['3d', 'H'],
      correspondence: ['长对正', '宽相等'],
      label: 'L 底面',
    },
    // 底板顶面（内台阶，位于 -h+thick，只存在于 -w+thick..w）
    {
      id: 'L_SHAPE:face:base_top',
      primitive: 'face',
      geometry: {
        kind: 'face',
        center: [(-w + thick + w) / 2, -h + thick, 0],
        normal: 'Y',
        w: width - thick,
        h: depth,
      },
      presentIn: ['3d', 'H'],
      correspondence: ['长对正', '宽相等'],
      label: 'L 内台阶顶面',
    },
    // 左板顶面
    {
      id: 'L_SHAPE:face:left_top',
      primitive: 'face',
      geometry: {
        kind: 'face',
        center: [(-w + (-w + thick)) / 2, h, 0],
        normal: 'Y',
        w: thick,
        h: depth,
      },
      presentIn: ['3d', 'H'],
      correspondence: ['长对正', '宽相等'],
      label: 'L 左板顶面',
    },
    // 底板右端面（+X 法向）
    {
      id: 'L_SHAPE:face:base_right',
      primitive: 'face',
      geometry: {
        kind: 'face',
        center: [w, (-h + (-h + thick)) / 2, 0],
        normal: 'X',
        w: depth,
        h: thick,
      },
      presentIn: ['3d', 'W', 'R'],
      correspondence: ['高平齐', '宽相等'],
      label: 'L 底板右端',
    },
    // 左板右侧内台阶（+X 法向，位于 -w+thick，从 -h+thick 到 h）
    {
      id: 'L_SHAPE:face:inner_right',
      primitive: 'face',
      geometry: {
        kind: 'face',
        center: [-w + thick, (-h + thick + h) / 2, 0],
        normal: 'X',
        w: depth,
        h: height - thick,
      },
      presentIn: ['3d', 'W', 'R'],
      correspondence: ['高平齐', '宽相等'],
      label: 'L 内侧竖面',
    },
    // L 左端面（-X 法向，整条高度）
    {
      id: 'L_SHAPE:face:left_outer',
      primitive: 'face',
      geometry: { kind: 'face', center: [-w, 0, 0], normal: 'X', w: depth, h: height },
      presentIn: ['3d', 'W', 'R'],
      correspondence: ['高平齐', '宽相等'],
      label: 'L 外左面',
    },
  ];

  return [...vertexFeatures, ...faces];
};
