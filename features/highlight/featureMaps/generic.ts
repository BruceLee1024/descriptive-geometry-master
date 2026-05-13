import type { FeatureMap, FeatureDescriptor } from '../types';

export const genericFeatureMap: FeatureMap = ({ width, height, depth }) => {
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;

  const vertices: FeatureDescriptor[] = [
    { id: 'GENERIC:vertex:tfr', primitive: 'vertex', geometry: { kind: 'vertex', position: [w, h, d] }, presentIn: ['3d', 'V', 'H', 'W', 'R'], correspondence: ['长对正', '高平齐', '宽相等'], label: '右上前' },
    { id: 'GENERIC:vertex:tfl', primitive: 'vertex', geometry: { kind: 'vertex', position: [-w, h, d] }, presentIn: ['3d', 'V', 'H', 'W', 'R'], correspondence: ['长对正', '高平齐', '宽相等'], label: '左上前' },
    { id: 'GENERIC:vertex:tbr', primitive: 'vertex', geometry: { kind: 'vertex', position: [w, h, -d] }, presentIn: ['3d', 'V', 'H', 'W', 'R'], correspondence: ['长对正', '高平齐', '宽相等'], label: '右上后' },
    { id: 'GENERIC:vertex:tbl', primitive: 'vertex', geometry: { kind: 'vertex', position: [-w, h, -d] }, presentIn: ['3d', 'V', 'H', 'W', 'R'], correspondence: ['长对正', '高平齐', '宽相等'], label: '左上后' },
    { id: 'GENERIC:vertex:bfr', primitive: 'vertex', geometry: { kind: 'vertex', position: [w, -h, d] }, presentIn: ['3d', 'V', 'H', 'W', 'R'], correspondence: ['长对正', '高平齐', '宽相等'], label: '右下前' },
    { id: 'GENERIC:vertex:bfl', primitive: 'vertex', geometry: { kind: 'vertex', position: [-w, -h, d] }, presentIn: ['3d', 'V', 'H', 'W', 'R'], correspondence: ['长对正', '高平齐', '宽相等'], label: '左下前' },
    { id: 'GENERIC:vertex:bbr', primitive: 'vertex', geometry: { kind: 'vertex', position: [w, -h, -d] }, presentIn: ['3d', 'V', 'H', 'W', 'R'], correspondence: ['长对正', '高平齐', '宽相等'], label: '右下后' },
    { id: 'GENERIC:vertex:bbl', primitive: 'vertex', geometry: { kind: 'vertex', position: [-w, -h, -d] }, presentIn: ['3d', 'V', 'H', 'W', 'R'], correspondence: ['长对正', '高平齐', '宽相等'], label: '左下后' },
  ];

  const faces: FeatureDescriptor[] = [
    { id: 'GENERIC:face:front', primitive: 'face', geometry: { kind: 'face', center: [0, 0, d], normal: 'Z', w: width, h: height }, presentIn: ['3d', 'V'], correspondence: ['长对正', '高平齐'], label: '前面' },
    { id: 'GENERIC:face:back', primitive: 'face', geometry: { kind: 'face', center: [0, 0, -d], normal: 'Z', w: width, h: height }, presentIn: ['3d', 'V'], correspondence: ['长对正', '高平齐'], label: '后面' },
    { id: 'GENERIC:face:top', primitive: 'face', geometry: { kind: 'face', center: [0, h, 0], normal: 'Y', w: width, h: depth }, presentIn: ['3d', 'H'], correspondence: ['长对正', '宽相等'], label: '顶面' },
    { id: 'GENERIC:face:bottom', primitive: 'face', geometry: { kind: 'face', center: [0, -h, 0], normal: 'Y', w: width, h: depth }, presentIn: ['3d', 'H'], correspondence: ['长对正', '宽相等'], label: '底面' },
    { id: 'GENERIC:face:right', primitive: 'face', geometry: { kind: 'face', center: [w, 0, 0], normal: 'X', w: depth, h: height }, presentIn: ['3d', 'W', 'R'], correspondence: ['高平齐', '宽相等'], label: '右面' },
    { id: 'GENERIC:face:left', primitive: 'face', geometry: { kind: 'face', center: [-w, 0, 0], normal: 'X', w: depth, h: height }, presentIn: ['3d', 'W', 'R'], correspondence: ['高平齐', '宽相等'], label: '左面' },
  ];

  return [...vertices, ...faces];
};
