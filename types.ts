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
  // 参数化自定义形体
  CUSTOM_PRISM = 'CUSTOM_PRISM',
  CUSTOM_STEPPED = 'CUSTOM_STEPPED',
  CUSTOM_HOLE_BLOCK = 'CUSTOM_HOLE_BLOCK',
  CUSTOM_DOUBLE_SLOT = 'CUSTOM_DOUBLE_SLOT',
  CSG_WORKSHOP = 'CSG_WORKSHOP',
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
  // 参数化自定义形体的专属字段
  prismSides?: number;          // CUSTOM_PRISM 边数 3-12
  stepCount?: number;           // CUSTOM_STEPPED 层数 2-5
  stepStyle?: 'pyramid' | 'stair';  // 金字塔式（逐层缩小）/ 阶梯式（单向递进）
  holeCount?: number;           // CUSTOM_HOLE_BLOCK 孔数 1-4
  holeDiameter?: number;        // 孔直径
  slotWidth?: number;           // CUSTOM_DOUBLE_SLOT 槽宽
  slotDepth?: number;           // 槽深
  // CSG 工作台：geometry 对象由外部注入（不存入持久化），key 仅为 memo 触发用
  csgGeometry?: import('three').BufferGeometry;
  csgGeometryKey?: string;
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
  // 参数化自定义（可调节边数/层数/孔数等结构参数，比纯尺寸滑块更灵活）
  { id: GeometryType.CUSTOM_PRISM, name: '⚙️ 自定义棱柱', description: '自由设置边数（3-12）的正棱柱。观察不同棱柱在三视图中的投影规律。' },
  { id: GeometryType.CUSTOM_STEPPED, name: '⚙️ 自定义台阶块', description: '自由设置层数（2-5）和样式的阶梯体，练习多层叠加结构的三视图。' },
  { id: GeometryType.CUSTOM_HOLE_BLOCK, name: '⚙️ 带孔方块', description: '方块上自由设置孔数（1-4）与直径。观察圆孔在各视图中的虚线表示。' },
  { id: GeometryType.CUSTOM_DOUBLE_SLOT, name: '⚙️ 双向开槽块', description: '正交双槽结构，经典的组合切割案例。' },
  { id: GeometryType.CSG_WORKSHOP, name: '🛠️ 布尔建模工作台', description: '自由加入方块/圆柱/球体，做并/减/交布尔运算，搭建任意形体。' },
  // 自定义
  { id: GeometryType.CUSTOM, name: '📁 导入模型', description: '上传自己的3D模型文件（支持 .glb/.gltf 格式），观察其三视图投影。' },
  { id: GeometryType.DRAW, name: '✏️ 绘制建模', description: '类似 SketchUp 的绘制模式，在平面上绘制轮廓，然后推拉生成三维形体。' },
];
