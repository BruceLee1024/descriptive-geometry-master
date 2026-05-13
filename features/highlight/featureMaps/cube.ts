import type { FeatureMap, FeatureDescriptor } from '../types';

// 正方体：8 顶点 + 6 面
export const cubeFeatureMap: FeatureMap = ({ width, height, depth }) => {
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;

  const signs: Array<{ key: string; sx: number; sy: number; sz: number }> = [
    { key: 'tfr', sx: 1, sy: 1, sz: 1 },
    { key: 'tfl', sx: -1, sy: 1, sz: 1 },
    { key: 'tbr', sx: 1, sy: 1, sz: -1 },
    { key: 'tbl', sx: -1, sy: 1, sz: -1 },
    { key: 'bfr', sx: 1, sy: -1, sz: 1 },
    { key: 'bfl', sx: -1, sy: -1, sz: 1 },
    { key: 'bbr', sx: 1, sy: -1, sz: -1 },
    { key: 'bbl', sx: -1, sy: -1, sz: -1 },
  ];

  const vertices: FeatureDescriptor[] = signs.map(({ key, sx, sy, sz }) => ({
    id: `CUBE:vertex:${key}`,
    primitive: 'vertex',
    geometry: { kind: 'vertex', position: [sx * w, sy * h, sz * d] },
    presentIn: ['3d', 'V', 'H', 'W', 'R'],
    correspondence: ['长对正', '高平齐', '宽相等'],
    label: `顶点 ${key.toUpperCase()}`,
  }));

  // 6 个面：使用世界坐标 + 法向。faceRectInPlane 会负责在正确视图中生成矩形热区
  const faces: FeatureDescriptor[] = [
    {
      id: 'CUBE:face:front',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, 0, d], normal: 'Z', w: width, h: height },
      presentIn: ['3d', 'V'],
      correspondence: ['长对正', '高平齐'],
      label: '前面',
    },
    {
      id: 'CUBE:face:back',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, 0, -d], normal: 'Z', w: width, h: height },
      presentIn: ['3d', 'V'],
      correspondence: ['长对正', '高平齐'],
      label: '后面',
    },
    {
      id: 'CUBE:face:top',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, h, 0], normal: 'Y', w: width, h: depth },
      presentIn: ['3d', 'H'],
      correspondence: ['长对正', '宽相等'],
      label: '顶面',
    },
    {
      id: 'CUBE:face:bottom',
      primitive: 'face',
      geometry: { kind: 'face', center: [0, -h, 0], normal: 'Y', w: width, h: depth },
      presentIn: ['3d', 'H'],
      correspondence: ['长对正', '宽相等'],
      label: '底面',
    },
    {
      id: 'CUBE:face:right',
      primitive: 'face',
      geometry: { kind: 'face', center: [w, 0, 0], normal: 'X', w: depth, h: height },
      presentIn: ['3d', 'W', 'R'],
      correspondence: ['高平齐', '宽相等'],
      label: '右面',
    },
    {
      id: 'CUBE:face:left',
      primitive: 'face',
      geometry: { kind: 'face', center: [-w, 0, 0], normal: 'X', w: depth, h: height },
      presentIn: ['3d', 'W', 'R'],
      correspondence: ['高平齐', '宽相等'],
      label: '左面',
    },
  ];

  return [...vertices, ...faces];
};
