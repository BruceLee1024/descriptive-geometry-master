import type { FeatureMap, FeatureDescriptor } from '../types';

// 切角块：右上前后两条棱被切出斜面。P0 只处理轴向面与 10 个顶点，斜面留 P1。
export const cutBlockFeatureMap: FeatureMap = ({ width, height, depth, cutSize }) => {
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const cut = Math.min(cutSize, Math.min(width, height) - 0.05);

  // 10 个顶点：原 8 顶点中的 6 个保留 + 切角处 4 个新顶点
  // 命名：position-layer，f/b 表示 depth 的前后
  type V = { key: string; pos: [number, number, number]; label: string };
  const vertices: V[] = [
    { key: 'bfl', pos: [-w, -h,  d], label: '左下前' },
    { key: 'bfr', pos: [ w, -h,  d], label: '右下前' },
    { key: 'bbl', pos: [-w, -h, -d], label: '左下后' },
    { key: 'bbr', pos: [ w, -h, -d], label: '右下后' },
    { key: 'tfl', pos: [-w,  h,  d], label: '左上前' },
    { key: 'tbl', pos: [-w,  h, -d], label: '左上后' },
    { key: 'cut_rf_bot', pos: [ w, h - cut,  d], label: '切角右前下' },
    { key: 'cut_rb_bot', pos: [ w, h - cut, -d], label: '切角右后下' },
    { key: 'cut_tf_left', pos: [w - cut,  h,  d], label: '切角上前左' },
    { key: 'cut_tb_left', pos: [w - cut,  h, -d], label: '切角上后左' },
  ];

  const vertexFeatures: FeatureDescriptor[] = vertices.map((v) => ({
    id: `CUT_BLOCK:vertex:${v.key}`,
    primitive: 'vertex',
    geometry: { kind: 'vertex', position: v.pos },
    presentIn: ['3d', 'V', 'H', 'W', 'R'],
    correspondence: ['长对正', '高平齐', '宽相等'],
    label: `顶点 ${v.label}`,
  }));

  const faces: FeatureDescriptor[] = [
    {
      id: 'CUT_BLOCK:face:front',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, 0, d], normal: 'Z', w: width, h: height },
      presentIn: ['3d', 'V'],
      correspondence: ['长对正', '高平齐'],
      label: '前面（含切角）',
    },
    {
      id: 'CUT_BLOCK:face:back',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, 0, -d], normal: 'Z', w: width, h: height },
      presentIn: ['3d', 'V'],
      correspondence: ['长对正', '高平齐'],
      label: '后面（含切角）',
    },
    {
      id: 'CUT_BLOCK:face:left',
      primitive: 'face',
      geometry: { kind: 'face', center: [-w, 0, 0], normal: 'X', w: depth, h: height },
      presentIn: ['3d', 'W', 'R'],
      correspondence: ['高平齐', '宽相等'],
      label: '左面',
    },
    {
      id: 'CUT_BLOCK:face:bottom',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, -h, 0], normal: 'Y', w: width, h: depth },
      presentIn: ['3d', 'H'],
      correspondence: ['长对正', '宽相等'],
      label: '底面',
    },
    {
      id: 'CUT_BLOCK:face:top',
      primitive: 'face',
      geometry: {
        kind: 'face',
        center: [-cut / 2, h, 0],
        normal: 'Y',
        w: width - cut,
        h: depth,
      },
      presentIn: ['3d', 'H'],
      correspondence: ['长对正', '宽相等'],
      label: '顶面（被切短）',
    },
    {
      id: 'CUT_BLOCK:face:right',
      primitive: 'face',
      geometry: {
        kind: 'face',
        center: [w, -cut / 2, 0],
        normal: 'X',
        w: depth,
        h: height - cut,
      },
      presentIn: ['3d', 'W', 'R'],
      correspondence: ['高平齐', '宽相等'],
      label: '右面（被切短）',
    },
  ];

  return [...vertexFeatures, ...faces];
};
