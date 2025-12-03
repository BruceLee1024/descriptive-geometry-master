export enum GeometryType {
  CUBE = 'CUBE',
  CYLINDER = 'CYLINDER',
  CONE = 'CONE',
  CUT_BLOCK = 'CUT_BLOCK',
  L_SHAPE = 'L_SHAPE',
  HEX_PRISM = 'HEX_PRISM',
  // 新增复杂形体
  T_SHAPE = 'T_SHAPE',
  CROSS_SHAPE = 'CROSS_SHAPE',
  HOLLOW_CYLINDER = 'HOLLOW_CYLINDER',
  STEPPED_BLOCK = 'STEPPED_BLOCK',
  WEDGE = 'WEDGE',
  SPHERE = 'SPHERE',
  TORUS = 'TORUS',
  PYRAMID = 'PYRAMID',
  CUT_CYLINDER = 'CUT_CYLINDER',
  SLOT_BLOCK = 'SLOT_BLOCK',
  INTERSECTING_PRISMS = 'INTERSECTING_PRISMS', // 相贯三棱柱
  CUSTOM = 'CUSTOM',
  DRAW = 'DRAW'
}

export interface GeometryParams {
  width: number;
  height: number;
  depth: number;
  cutSize: number;
  customModelUrl?: string;
  customModelScale?: number;
  drawPoints?: [number, number][];
  drawDepth?: number;
}

export interface GeometryConfig {
  id: GeometryType;
  name: string;
  description: string;
}

export const GEOMETRIES: GeometryConfig[] = [
  // 基础形体
  { id: GeometryType.CUBE, name: '正方体', description: '最基础的形体。尝试调整长宽高，观察"长对正、高平齐、宽相等"的原则。' },
  { id: GeometryType.CYLINDER, name: '圆柱体', description: '曲面立体的代表。注意圆柱表面上的点在不同视图中的可见性。' },
  { id: GeometryType.CONE, name: '圆锥体', description: '观察圆锥顶点的投影位置，以及侧面素线在视图中的表现。' },
  { id: GeometryType.SPHERE, name: '球体', description: '所有视图都是圆形，理解球面投影的特殊性。' },
  { id: GeometryType.HEX_PRISM, name: '六棱柱', description: '多棱柱的代表，观察棱线的投影重合情况。' },
  { id: GeometryType.PYRAMID, name: '四棱锥', description: '观察棱锥的顶点投影和棱线在各视图中的表现。' },
  // 切割形体
  { id: GeometryType.CUT_BLOCK, name: '切角块', description: '画法几何经典案例。拖动"切角大小"滑块，观察截切面在三个视图中的变化。' },
  { id: GeometryType.WEDGE, name: '楔形体', description: '斜面切割的典型案例，观察斜面在各视图中的投影形状。' },
  { id: GeometryType.CUT_CYLINDER, name: '切口圆柱', description: '圆柱被平面切割，观察截交线在各视图中的形状变化。' },
  // 组合形体
  { id: GeometryType.L_SHAPE, name: 'L型支座', description: '典型的组合体，用于练习基本叠加和切割。' },
  { id: GeometryType.T_SHAPE, name: 'T型块', description: 'T形截面的组合体，观察相贯线的投影。' },
  { id: GeometryType.CROSS_SHAPE, name: '十字块', description: '十字形组合体，练习复杂组合体的三视图绘制。' },
  { id: GeometryType.STEPPED_BLOCK, name: '阶梯块', description: '多级阶梯形状，理解层叠结构的投影规律。' },
  { id: GeometryType.SLOT_BLOCK, name: '开槽块', description: '带有凹槽的块体，练习切割体的三视图表达。' },
  // 回转体
  { id: GeometryType.HOLLOW_CYLINDER, name: '空心圆柱', description: '带有内孔的圆柱，观察内外轮廓线的投影关系。' },
  { id: GeometryType.TORUS, name: '圆环体', description: '环形回转体，观察复杂曲面的投影特征。' },
  // 相贯体
  { id: GeometryType.INTERSECTING_PRISMS, name: '相贯三棱柱', description: '两个三棱柱正交相贯，经典的相贯线案例，观察相贯线在各视图中的投影。' },
  // 自定义
  { id: GeometryType.CUSTOM, name: '📁 导入模型', description: '上传自己的3D模型文件（支持 .glb/.gltf 格式），观察其三视图投影。' },
  { id: GeometryType.DRAW, name: '✏️ 绘制建模', description: '类似 SketchUp 的绘制模式，在平面上绘制轮廓，然后推拉生成三维形体。' },
];
