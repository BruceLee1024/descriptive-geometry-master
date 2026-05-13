import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Edges, Text, Line } from '@react-three/drei';
import { GeometryType, GeometryParams } from '../types';
import { ADDITION, SUBTRACTION, Evaluator, Brush } from 'three-bvh-csg';

// 优化后的配色方案 - 更柔和协调
export const COLORS = {
  OBJECT: '#818cf8', // Indigo 400 - 更亮的主体颜色
  OBJECT_EDGE: '#c7d2fe', // Indigo 200 - 边缘高亮
  PROJECTED_LINE: '#64748b', // Slate 500
  // 投影面使用更柔和的颜色
  PLANE_V: '#fecaca', // Red 200 (主视图 - 后面)
  PLANE_H: '#bae6fd', // Sky 200 (俯视图 - 底面)
  PLANE_W: '#bbf7d0', // Green 200 (左视图 - 右侧墙)
  PLANE_R: '#fde68a', // Amber 200 (右视图 - 左侧墙)
  PLANE_BORDER: '#374151', // Gray 700
  PROJECTOR_LINE: '#f87171', // Red 400 - 投影线
  PROJECTION_FILL: 'rgba(0,0,0,0.05)',
};

// --- Geometry Hook ---

export const useGeometryFactory = (type: GeometryType, params: GeometryParams) => {
  const {
    width, height, depth, cutSize,
    prismSides, stepCount, stepStyle,
    holeCount, holeDiameter, slotWidth, slotDepth,
    csgGeometryKey,
  } = params;

  return useMemo(() => {
    // CSG 工作台由外部通过 params.csgGeometry 注入，优先返回
    if (type === GeometryType.CSG_WORKSHOP && params.csgGeometry) {
      return params.csgGeometry;
    }
    switch (type) {
      case GeometryType.CUBE:
        return new THREE.BoxGeometry(width, height, depth);
      
      case GeometryType.CYLINDER:
        return new THREE.CylinderGeometry(width/2, width/2, height, 32);
      
      case GeometryType.CONE:
        return new THREE.ConeGeometry(width/2, height, 32);
      
      case GeometryType.HEX_PRISM:
        return new THREE.CylinderGeometry(width/2, width/2, height, 6);

      case GeometryType.CUT_BLOCK: {
        const s = new THREE.Shape();
        const w = width / 2;
        const h = height / 2;
        const safeCut = Math.min(cutSize, Math.min(width, height) - 0.05);

        s.moveTo(-w, -h);
        s.lineTo(w, -h);
        s.lineTo(w, h - safeCut); 
        s.lineTo(w - safeCut, h);
        s.lineTo(-w, h);
        s.lineTo(-w, -h);

        const geo = new THREE.ExtrudeGeometry(s, { depth: depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        return geo;
      }

      case GeometryType.L_SHAPE: {
         const shape = new THREE.Shape();
         const w = width / 2;
         const h = height / 2;
         const thick = Math.min(width, height) * 0.4;
         
         shape.moveTo(-w, -h);
         shape.lineTo(w, -h);
         shape.lineTo(w, -h + thick);
         shape.lineTo(-w + thick, -h + thick);
         shape.lineTo(-w + thick, h);
         shape.lineTo(-w, h);
         shape.lineTo(-w, -h);
         
         const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
         geo.translate(0, 0, -depth / 2);
         return geo;
      }

      // 新增形体
      case GeometryType.SPHERE:
        return new THREE.SphereGeometry(width / 2, 32, 32);

      case GeometryType.PYRAMID: {
        const geo = new THREE.ConeGeometry(width / 2, height, 4);
        geo.rotateY(Math.PI / 4);
        return geo;
      }

      case GeometryType.TORUS: {
        const torusGeo = new THREE.TorusGeometry(width / 2.5, width / 6, 16, 48);
        // 将圆环从XY平面旋转到XZ平面（水平放置）
        torusGeo.rotateX(Math.PI / 2);
        return torusGeo;
      }

      case GeometryType.WEDGE: {
        const shape = new THREE.Shape();
        const w = width / 2;
        const h = height / 2;
        
        shape.moveTo(-w, -h);
        shape.lineTo(w, -h);
        shape.lineTo(w, h);
        shape.lineTo(-w, -h);
        
        const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        return geo;
      }

      case GeometryType.T_SHAPE: {
        const shape = new THREE.Shape();
        const w = width / 2;
        const h = height / 2;
        const stemW = width * 0.3;
        const topH = height * 0.3;
        
        shape.moveTo(-stemW / 2, -h);
        shape.lineTo(stemW / 2, -h);
        shape.lineTo(stemW / 2, h - topH);
        shape.lineTo(w, h - topH);
        shape.lineTo(w, h);
        shape.lineTo(-w, h);
        shape.lineTo(-w, h - topH);
        shape.lineTo(-stemW / 2, h - topH);
        shape.lineTo(-stemW / 2, -h);
        
        const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        return geo;
      }

      case GeometryType.CROSS_SHAPE: {
        const shape = new THREE.Shape();
        const w = width / 2;
        const h = height / 2;
        const armW = width * 0.3;
        const armH = height * 0.3;
        
        shape.moveTo(-armW / 2, -h);
        shape.lineTo(armW / 2, -h);
        shape.lineTo(armW / 2, -armH / 2);
        shape.lineTo(w, -armH / 2);
        shape.lineTo(w, armH / 2);
        shape.lineTo(armW / 2, armH / 2);
        shape.lineTo(armW / 2, h);
        shape.lineTo(-armW / 2, h);
        shape.lineTo(-armW / 2, armH / 2);
        shape.lineTo(-w, armH / 2);
        shape.lineTo(-w, -armH / 2);
        shape.lineTo(-armW / 2, -armH / 2);
        shape.lineTo(-armW / 2, -h);
        
        const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        return geo;
      }

      case GeometryType.HOLLOW_CYLINDER: {
        // 使用 LatheGeometry 创建空心圆柱，边缘更干净
        const outerRadius = width / 2;
        const innerRadius = width / 4;
        const halfH = height / 2;
        
        // 创建截面轮廓点（从内圈底部开始）
        const points = [
          new THREE.Vector2(innerRadius, -halfH),
          new THREE.Vector2(outerRadius, -halfH),
          new THREE.Vector2(outerRadius, halfH),
          new THREE.Vector2(innerRadius, halfH),
        ];
        
        const geo = new THREE.LatheGeometry(points, 32);
        return geo;
      }

      case GeometryType.STEPPED_BLOCK: {
        const shape = new THREE.Shape();
        const w = width / 2;
        const h = height / 2;
        const step = height / 3;
        
        shape.moveTo(-w, -h);
        shape.lineTo(w, -h);
        shape.lineTo(w, -h + step);
        shape.lineTo(w * 0.5, -h + step);
        shape.lineTo(w * 0.5, -h + step * 2);
        shape.lineTo(0, -h + step * 2);
        shape.lineTo(0, h);
        shape.lineTo(-w, h);
        shape.lineTo(-w, -h);
        
        const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        return geo;
      }

      case GeometryType.CUT_CYLINDER: {
        // 创建一个带斜切的圆柱
        const shape = new THREE.Shape();
        const r = width / 2;
        for (let i = 0; i <= 32; i++) {
          const angle = (i / 32) * Math.PI * 2;
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          if (i === 0) shape.moveTo(x, y);
          else shape.lineTo(x, y);
        }
        const extrudeGeo = new THREE.ExtrudeGeometry(shape, { 
          depth: height, 
          bevelEnabled: false 
        });
        extrudeGeo.translate(0, 0, -height / 2);
        extrudeGeo.rotateX(-Math.PI / 2);
        return extrudeGeo;
      }

      case GeometryType.SLOT_BLOCK: {
        const shape = new THREE.Shape();
        const w = width / 2;
        const h = height / 2;
        const slotW = width * 0.3;
        const slotD = height * 0.4;
        
        shape.moveTo(-w, -h);
        shape.lineTo(w, -h);
        shape.lineTo(w, h);
        shape.lineTo(slotW / 2, h);
        shape.lineTo(slotW / 2, h - slotD);
        shape.lineTo(-slotW / 2, h - slotD);
        shape.lineTo(-slotW / 2, h);
        shape.lineTo(-w, h);
        shape.lineTo(-w, -h);
        
        const geo = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: false });
        geo.translate(0, 0, -depth / 2);
        return geo;
      }

      case GeometryType.INTERSECTING_PRISMS: {
        // 两个三棱柱正交相贯 - 使用 CSG 布尔运算合并
        // 三棱柱尺寸：截面大小和长度
        const prismRadius = Math.min(width, height) * 0.4;  // 截面外接圆半径
        const prismLength = depth * 1.8;  // 三棱柱长度
        
        // 创建等边三角形截面（顶点朝上）
        const createTriangleShape = () => {
          const shape = new THREE.Shape();
          const r = prismRadius;
          // 等边三角形，顶点朝上
          shape.moveTo(0, r);                    // 顶点
          shape.lineTo(-r * 0.866, -r * 0.5);   // 左下 (cos(210°), sin(210°))
          shape.lineTo(r * 0.866, -r * 0.5);    // 右下 (cos(-30°), sin(-30°))
          shape.closePath();
          return shape;
        };
        
        // 第一个三棱柱（沿X轴延伸）- 在XY平面的三角形，沿X挤出
        const geo1 = new THREE.ExtrudeGeometry(createTriangleShape(), { 
          depth: prismLength, 
          bevelEnabled: false 
        });
        // 挤出方向默认是+Z，需要旋转到+X方向，并居中
        geo1.rotateY(Math.PI / 2);
        geo1.translate(prismLength / 2, 0, 0);
        geo1.center();  // 居中
        
        // 第二个三棱柱（沿Z轴延伸）- 在XY平面的三角形，沿Z挤出
        const geo2 = new THREE.ExtrudeGeometry(createTriangleShape(), { 
          depth: prismLength, 
          bevelEnabled: false 
        });
        geo2.translate(0, 0, -prismLength / 2);
        geo2.center();  // 居中
        
        // 使用 CSG 布尔运算合并两个几何体（并集）
        const evaluator = new Evaluator();
        const brush1 = new Brush(geo1);
        const brush2 = new Brush(geo2);
        const result = evaluator.evaluate(brush1, brush2, ADDITION);
        
        // 清理临时几何体
        geo1.dispose();
        geo2.dispose();
        
        return result.geometry;
      }

      case GeometryType.CUSTOM_PRISM: {
        const sides = Math.max(3, Math.min(12, prismSides ?? 6));
        const radius = width / 2;
        // CylinderGeometry with low segment count = regular prism
        return new THREE.CylinderGeometry(radius, radius, height, sides);
      }

      case GeometryType.CUSTOM_STEPPED: {
        const layers = Math.max(2, Math.min(5, stepCount ?? 3));
        const style = stepStyle ?? 'pyramid';
        const layerH = height / layers;
        const evaluator = new Evaluator();
        let current: Brush | null = null;
        for (let i = 0; i < layers; i++) {
          // pyramid：每层尺寸缩小；stair：每层仅沿 +X 偏移
          const shrink = style === 'pyramid' ? (1 - i * 0.25) : 1;
          const lw = Math.max(0.2, width * shrink);
          const ld = Math.max(0.2, depth * shrink);
          const box = new THREE.BoxGeometry(lw, layerH, ld);
          // 每层 Y：底部在 -height/2 + i*layerH
          const yCenter = -height / 2 + layerH * (i + 0.5);
          // stair 模式：每层从 -width/2 起，依次朝 +X 滑动 layerShift
          const xOffset = style === 'stair' ? i * (width / layers) * 0.4 : 0;
          box.translate(xOffset, yCenter, 0);
          const brush = new Brush(box);
          if (!current) {
            current = brush;
          } else {
            const merged = evaluator.evaluate(current, brush, ADDITION);
            current = merged;
          }
        }
        return current ? current.geometry : new THREE.BoxGeometry(width, height, depth);
      }

      case GeometryType.CUSTOM_HOLE_BLOCK: {
        const numHoles = Math.max(1, Math.min(4, holeCount ?? 2));
        const d = Math.max(0.1, Math.min(Math.min(width, depth) * 0.45, holeDiameter ?? 0.5));
        const baseBox = new THREE.BoxGeometry(width, height, depth);
        const evaluator = new Evaluator();
        let current: Brush = new Brush(baseBox);
        // 孔沿 Y 轴穿透方块；按 numHoles 在 XZ 平面上均匀排布
        const positions: [number, number][] = (() => {
          if (numHoles === 1) return [[0, 0]];
          if (numHoles === 2) return [[-width / 4, 0], [width / 4, 0]];
          if (numHoles === 3) return [[-width / 4, -depth / 4], [width / 4, -depth / 4], [0, depth / 4]];
          return [
            [-width / 4, -depth / 4], [width / 4, -depth / 4],
            [-width / 4, depth / 4], [width / 4, depth / 4],
          ];
        })();
        for (const [px, pz] of positions) {
          const cyl = new THREE.CylinderGeometry(d / 2, d / 2, height * 1.1, 32);
          cyl.translate(px, 0, pz);
          const cylBrush = new Brush(cyl);
          current = evaluator.evaluate(current, cylBrush, SUBTRACTION);
          cyl.dispose();
        }
        return current.geometry;
      }

      case GeometryType.CUSTOM_DOUBLE_SLOT: {
        const sw = Math.max(0.1, Math.min(Math.min(width, depth) * 0.4, slotWidth ?? 0.4));
        const sd = Math.max(0.1, Math.min(height * 0.7, slotDepth ?? height * 0.5));
        const baseBox = new THREE.BoxGeometry(width, height, depth);
        const evaluator = new Evaluator();
        let current: Brush = new Brush(baseBox);
        // 槽 1：沿 X 轴的长条槽（从顶面往下挖，沿 Z 宽 = sw）
        const slotX = new THREE.BoxGeometry(width * 1.05, sd, sw);
        slotX.translate(0, height / 2 - sd / 2, 0);
        current = evaluator.evaluate(current, new Brush(slotX), SUBTRACTION);
        slotX.dispose();
        // 槽 2：沿 Z 轴的长条槽（沿 X 宽 = sw）
        const slotZ = new THREE.BoxGeometry(sw, sd, depth * 1.05);
        slotZ.translate(0, height / 2 - sd / 2, 0);
        current = evaluator.evaluate(current, new Brush(slotZ), SUBTRACTION);
        slotZ.dispose();
        return current.geometry;
      }

      default:
        return new THREE.BoxGeometry(width, height, depth);
    }
  }, [
    type, width, height, depth, cutSize,
    prismSides, stepCount, stepStyle, holeCount, holeDiameter, slotWidth, slotDepth,
    csgGeometryKey, params.csgGeometry,
  ]);
};

export const BaseGeometry: React.FC<{ type: GeometryType; params: GeometryParams }> = ({ type, params }) => {
  const geometry = useGeometryFactory(type, params);
  return <primitive object={geometry} attach="geometry" />;
};

// --- Main Object Component ---

interface MainObjectProps {
  type: GeometryType;
  params: GeometryParams;
  opacity?: number;
  customModelComponent?: React.ReactNode;
}

export const MainObject: React.FC<MainObjectProps> = ({ type, params, opacity = 1, customModelComponent }) => {
  const geometry = useGeometryFactory(type, params);

  // 如果是自定义模型，渲染传入的组件
  if (type === GeometryType.CUSTOM && customModelComponent) {
    return <>{customModelComponent}</>;
  }

  return (
    <mesh castShadow receiveShadow geometry={geometry}>
      <meshStandardMaterial 
        color={COLORS.OBJECT} 
        transparent 
        opacity={opacity} 
        metalness={0.2}
        roughness={0.4}
        emissive={COLORS.OBJECT}
        emissiveIntensity={0.1}
      />
      <Edges color={COLORS.OBJECT_EDGE} threshold={15} lineWidth={1.5} />
    </mesh>
  );
};

// --- Projected View Component ---

interface ProjectedViewProps {
  type: GeometryType;
  params: GeometryParams;
  plane: 'V' | 'H' | 'W' | 'R';
}

// 空心圆柱专用投影视图
const HollowCylinderProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height } = params;
  const outerR = width / 2;
  const innerR = width / 4;
  const halfH = height / 2;
  const OFFSET = 0.05;

  // 创建圆形路径点
  const createCirclePoints = (radius: number, segments: number = 64): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    return points;
  };

  if (plane === 'V') {
    // 主视图：显示矩形外轮廓 + 内孔虚线
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓实线 - 矩形 */}
        <Line
          points={[
            [-outerR, -halfH, 0], [outerR, -halfH, 0], [outerR, halfH, 0], [-outerR, halfH, 0], [-outerR, -halfH, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 内孔虚线 - 两条竖线 */}
        <Line
          points={[[-innerR, -halfH, 0], [-innerR, halfH, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
        <Line
          points={[[innerR, -halfH, 0], [innerR, halfH, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  } else if (plane === 'W' || plane === 'R') {
    // 左视图/右视图：显示矩形外轮廓 + 内孔虚线
    // 注意：父级已经有旋转变换，这里在 XY 平面绘制（与 V 面类似）
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓实线 - 矩形 */}
        <Line
          points={[
            [-outerR, -halfH, 0], [outerR, -halfH, 0], [outerR, halfH, 0], [-outerR, halfH, 0], [-outerR, -halfH, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 内孔虚线 - 两条竖线 */}
        <Line
          points={[[-innerR, -halfH, 0], [-innerR, halfH, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
        <Line
          points={[[innerR, -halfH, 0], [innerR, halfH, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  } else {
    // 俯视图：显示两个同心圆
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外圆实线 */}
        <Line points={createCirclePoints(outerR)} color="#1f2937" lineWidth={2} />
        {/* 内圆实线（内孔在俯视图中可见） */}
        <Line points={createCirclePoints(innerR)} color="#1f2937" lineWidth={2} />
      </group>
    );
  }
};

// 开槽块专用投影视图
const SlotBlockProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth } = params;
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const slotW = width * 0.3;
  const slotD = height * 0.4;
  const OFFSET = 0.05;

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：显示凹字形外轮廓 + 槽底虚线
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓实线 */}
        <Line
          points={[
            [-w, -h, 0], [w, -h, 0], [w, h, 0], 
            [slotW/2, h, 0], [slotW/2, h - slotD, 0], 
            [-slotW/2, h - slotD, 0], [-slotW/2, h, 0],
            [-w, h, 0], [-w, -h, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 槽底虚线（不可见线） */}
        <primitive object={createDashedLine([-slotW/2, h - slotD, 0], [slotW/2, h - slotD, 0])} />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：显示矩形 + 槽的虚线
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓实线 */}
        <Line
          points={[[-w, -d, 0], [w, -d, 0], [w, d, 0], [-w, d, 0], [-w, -d, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 槽的虚线 */}
        <Line
          points={[[-slotW/2, -d, 0], [-slotW/2, d, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
        <Line
          points={[[slotW/2, -d, 0], [slotW/2, d, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  } else {
    // 左视图/右视图：显示矩形 + 槽的虚线
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓实线 */}
        <Line
          points={[[-d, -h, 0], [d, -h, 0], [d, h, 0], [-d, h, 0], [-d, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 槽底虚线 */}
        <Line
          points={[[-d, h - slotD, 0], [d, h - slotD, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  }
};

// 圆环体专用投影视图
// 圆环水平放置在XZ平面（通过rotateX(PI/2)旋转后）
const TorusProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width } = params;
  const R = width / 2.5;  // 主半径（圆环中心到管中心的距离）
  const r = width / 6;    // 管半径
  const OFFSET = 0.05;

  // 创建圆形路径点
  const createCirclePoints = (radius: number, segments: number = 64): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    return points;
  };

  if (plane === 'V') {
    // 主视图：从前面看（沿-Z方向）
    // 圆环水平放置在XZ平面，从正面看到两个管截面圆（左右排列）
    // 加上连接两个圆的上下切线
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 左边的管截面圆 */}
        <group position={[-R, 0, 0]}>
          <Line points={createCirclePoints(r)} color="#1f2937" lineWidth={2} />
        </group>
        {/* 右边的管截面圆 */}
        <group position={[R, 0, 0]}>
          <Line points={createCirclePoints(r)} color="#1f2937" lineWidth={2} />
        </group>
        {/* 连接两个圆的切线（上下两条横线） */}
        <Line points={[[-R, r, 0], [R, r, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[-R, -r, 0], [R, -r, 0]]} color="#1f2937" lineWidth={2} />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：从上面看（沿-Y方向）
    // 圆环水平放置在XZ平面，从上面看到两个同心圆
    const outerR = R + r;
    const innerR = R - r;
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外圆轮廓 */}
        <Line points={createCirclePoints(outerR)} color="#1f2937" lineWidth={2} />
        {/* 内圆轮廓 */}
        <Line points={createCirclePoints(innerR)} color="#1f2937" lineWidth={2} />
      </group>
    );
  } else {
    // 左视图/右视图：从侧面看（沿X方向）
    // 圆环水平放置在XZ平面，从侧面看到两个管截面圆（前后排列，投影后左右排列）
    // 加上连接两个圆的上下切线
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 前面的管截面圆（投影后在左边） */}
        <group position={[-R, 0, 0]}>
          <Line points={createCirclePoints(r)} color="#1f2937" lineWidth={2} />
        </group>
        {/* 后面的管截面圆（投影后在右边） */}
        <group position={[R, 0, 0]}>
          <Line points={createCirclePoints(r)} color="#1f2937" lineWidth={2} />
        </group>
        {/* 连接两个圆的切线（上下两条横线） */}
        <Line points={[[-R, r, 0], [R, r, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[-R, -r, 0], [R, -r, 0]]} color="#1f2937" lineWidth={2} />
      </group>
    );
  }
};

// 立方体专用投影视图
const CubeProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth } = params;
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const OFFSET = 0.05;

  if (plane === 'V') {
    // 主视图：看到矩形 (width × height)
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-w, -h, 0], [w, -h, 0], [w, h, 0], [-w, h, 0], [-w, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到矩形 (width × depth)
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-w, -d, 0], [w, -d, 0], [w, d, 0], [-w, d, 0], [-w, -d, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else {
    // 左视图/右视图：看到矩形 (depth × height)
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-d, -h, 0], [d, -h, 0], [d, h, 0], [-d, h, 0], [-d, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  }
};

// 球体专用投影视图
const SphereProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width } = params;
  const r = width / 2;
  const OFFSET = 0.05;

  // 创建圆形路径点
  const createCirclePoints = (radius: number, segments: number = 64): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    return points;
  };

  if (plane === 'V') {
    return (
      <group position={[0, 0, OFFSET]}>
        <Line points={createCirclePoints(r)} color="#1f2937" lineWidth={2} />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到圆形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line points={createCirclePoints(r)} color="#1f2937" lineWidth={2} />
      </group>
    );
  } else {
    // 左视图/右视图：看到圆形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line points={createCirclePoints(r)} color="#1f2937" lineWidth={2} />
      </group>
    );
  }
};

// 切角块专用投影视图
const CutBlockProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth, cutSize } = params;
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const safeCut = Math.min(cutSize, Math.min(width, height) - 0.05);
  const OFFSET = 0.05;

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图（从前往后看）：看到切角形状
    // 可见：外轮廓（切角形状）
    // 不可见：无（后面的边与前面重合）
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓实线 - 切角形状 */}
        <Line
          points={[
            [-w, -h, 0], [w, -h, 0], [w, h - safeCut, 0], 
            [w - safeCut, h, 0], [-w, h, 0], [-w, -h, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图（从上往下看）：看到切角形状
    // 切角在右后上角（+X, -Z），从上往下看，切角在右上角（+X, +Y方向，因为-Z映射到+Y）
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓实线 - 切角形状 */}
        <Line
          points={[
            [-w, -d, 0], [w, -d, 0], [w, d - safeCut, 0], 
            [w - safeCut, d, 0], [-w, d, 0], [-w, -d, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else {
    // 左视图（W面）和右视图（R面）：从侧面看，看到矩形
    // 切角沿Z轴方向，从侧面看不到切角的形状变化
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓实线 - 矩形 */}
        <Line
          points={[[-d, -h, 0], [d, -h, 0], [d, h, 0], [-d, h, 0], [-d, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  }
};

// L形块专用投影视图
const LShapeProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth } = params;
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const thick = Math.min(width, height) * 0.4;
  const OFFSET = 0.05;

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：看到L形轮廓
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[
            [-w, -h, 0], [w, -h, 0], [w, -h + thick, 0],
            [-w + thick, -h + thick, 0], [-w + thick, h, 0],
            [-w, h, 0], [-w, -h, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到矩形，内部L形边缘用虚线
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓 */}
        <Line
          points={[[-w, -d, 0], [w, -d, 0], [w, d, 0], [-w, d, 0], [-w, -d, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* L形内角边 - 虚线（不可见） */}
        <Line
          points={[[-w + thick, -d, 0], [-w + thick, d, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  } else {
    // 左视图/右视图：看到矩形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-d, -h, 0], [d, -h, 0], [d, h, 0], [-d, h, 0], [-d, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* L形内角边 - 虚线 */}
        <Line
          points={[[-d, -h + thick, 0], [d, -h + thick, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  }
};

// 楔形块专用投影视图
const WedgeProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth } = params;
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const OFFSET = 0.05;

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：看到三角形
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-w, -h, 0], [w, -h, 0], [w, h, 0], [-w, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到矩形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓 */}
        <Line
          points={[[-w, -d, 0], [w, -d, 0], [w, d, 0], [-w, d, 0], [-w, -d, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else {
    // 左视图/右视图：看到矩形（楔形体沿Z轴挤出，侧面是矩形）
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-d, -h, 0], [d, -h, 0], [d, h, 0], [-d, h, 0], [-d, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  }
};

// T形块专用投影视图
const TShapeProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth } = params;
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const stemW = width * 0.3;
  const topH = height * 0.3;
  const OFFSET = 0.05;

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：看到T形轮廓
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[
            [-stemW/2, -h, 0], [stemW/2, -h, 0], [stemW/2, h - topH, 0],
            [w, h - topH, 0], [w, h, 0], [-w, h, 0],
            [-w, h - topH, 0], [-stemW/2, h - topH, 0], [-stemW/2, -h, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到矩形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓 */}
        <Line
          points={[[-w, -d, 0], [w, -d, 0], [w, d, 0], [-w, d, 0], [-w, -d, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else {
    // 左视图/右视图：看到矩形（茎部侧面）
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 茎部 */}
        <Line
          points={[[-d, -h, 0], [d, -h, 0], [d, h - topH, 0], [-d, h - topH, 0], [-d, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 顶部横条 */}
        <Line
          points={[[-d, h - topH, 0], [-d, h, 0], [d, h, 0], [d, h - topH, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  }
};

// 十字形块专用投影视图
const CrossShapeProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth } = params;
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const armW = width * 0.3;
  const armH = height * 0.3;
  const OFFSET = 0.05;

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：看到十字形轮廓
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[
            [-armW/2, -h, 0], [armW/2, -h, 0], [armW/2, -armH/2, 0],
            [w, -armH/2, 0], [w, armH/2, 0], [armW/2, armH/2, 0],
            [armW/2, h, 0], [-armW/2, h, 0], [-armW/2, armH/2, 0],
            [-w, armH/2, 0], [-w, -armH/2, 0], [-armW/2, -armH/2, 0],
            [-armW/2, -h, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到矩形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓 */}
        <Line
          points={[[-w, -d, 0], [w, -d, 0], [w, d, 0], [-w, d, 0], [-w, -d, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else {
    // 左视图/右视图
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓 */}
        <Line
          points={[[-d, -h, 0], [d, -h, 0], [d, h, 0], [-d, h, 0], [-d, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 十字形内角边 - 虚线 */}
        <Line
          points={[[-d, -armH/2, 0], [d, -armH/2, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
        <Line
          points={[[-d, armH/2, 0], [d, armH/2, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  }
};

// 阶梯块专用投影视图
const SteppedBlockProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth } = params;
  const w = width / 2;
  const h = height / 2;
  const d = depth / 2;
  const step = height / 3;
  const OFFSET = 0.05;

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：看到阶梯形轮廓
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[
            [-w, -h, 0], [w, -h, 0], [w, -h + step, 0],
            [w * 0.5, -h + step, 0], [w * 0.5, -h + step * 2, 0],
            [0, -h + step * 2, 0], [0, h, 0],
            [-w, h, 0], [-w, -h, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到矩形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓 */}
        <Line
          points={[[-w, -d, 0], [w, -d, 0], [w, d, 0], [-w, d, 0], [-w, -d, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else {
    // 左视图/右视图：看到矩形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-d, -h, 0], [d, -h, 0], [d, h, 0], [-d, h, 0], [-d, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 阶梯内部边 - 虚线 */}
        <Line
          points={[[-d, -h + step, 0], [d, -h + step, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
        <Line
          points={[[-d, -h + step * 2, 0], [d, -h + step * 2, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  }
};

// 圆柱体专用投影视图
const CylinderProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height } = params;
  const r = width / 2;
  const h = height / 2;
  const OFFSET = 0.05;

  // 创建圆形路径点
  const createCirclePoints = (radius: number, segments: number = 64): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    return points;
  };

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：看到矩形
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-r, -h, 0], [r, -h, 0], [r, h, 0], [-r, h, 0], [-r, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 轴线 - 虚线 */}
        <primitive object={createDashedLine([0, -h, 0], [0, h, 0])} />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到圆形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line points={createCirclePoints(r)} color="#1f2937" lineWidth={2} />
      </group>
    );
  } else {
    // 左视图/右视图：看到矩形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-r, -h, 0], [r, -h, 0], [r, h, 0], [-r, h, 0], [-r, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 轴线 - 虚线 */}
        <Line
          points={[[0, -h, 0], [0, h, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  }
};

// 圆锥体专用投影视图
const ConeProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height } = params;
  const r = width / 2;
  const h = height / 2;
  const OFFSET = 0.05;

  // 创建圆形路径点
  const createCirclePoints = (radius: number, segments: number = 64): THREE.Vector3[] => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0));
    }
    return points;
  };

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：看到三角形
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-r, -h, 0], [r, -h, 0], [0, h, 0], [-r, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 轴线 - 虚线 */}
        <primitive object={createDashedLine([0, -h, 0], [0, h, 0])} />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到圆形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line points={createCirclePoints(r)} color="#1f2937" lineWidth={2} />
        {/* 圆心点 */}
        <mesh position={[0, 0, 0]}>
          <circleGeometry args={[0.05, 16]} />
          <meshBasicMaterial color="#1f2937" />
        </mesh>
      </group>
    );
  } else {
    // 左视图/右视图：看到三角形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-r, -h, 0], [r, -h, 0], [0, h, 0], [-r, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 轴线 - 虚线 */}
        <Line
          points={[[0, -h, 0], [0, h, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  }
};

// 四棱锥专用投影视图
const PyramidProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height } = params;
  const r = width / 2;
  const h = height / 2;
  const OFFSET = 0.05;

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：看到三角形，后面的棱用虚线
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 可见轮廓 */}
        <Line
          points={[[-r, -h, 0], [r, -h, 0], [0, h, 0], [-r, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 后面的底边 - 虚线 */}
        <primitive object={createDashedLine([0, -h, 0], [0, h, 0])} />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到正方形底面
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 底面正方形 */}
        <Line
          points={[[r, 0, 0], [0, r, 0], [-r, 0, 0], [0, -r, 0], [r, 0, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 从顶点到各角的棱 - 虚线（被遮挡） */}
        <Line points={[[0, 0, 0], [r, 0, 0]]} color="#1f2937" lineWidth={1.5} dashed dashSize={0.15} gapSize={0.1} />
        <Line points={[[0, 0, 0], [-r, 0, 0]]} color="#1f2937" lineWidth={1.5} dashed dashSize={0.15} gapSize={0.1} />
        <Line points={[[0, 0, 0], [0, r, 0]]} color="#1f2937" lineWidth={1.5} dashed dashSize={0.15} gapSize={0.1} />
        <Line points={[[0, 0, 0], [0, -r, 0]]} color="#1f2937" lineWidth={1.5} dashed dashSize={0.15} gapSize={0.1} />
      </group>
    );
  } else {
    // 左视图/右视图：看到三角形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[[-r, -h, 0], [r, -h, 0], [0, h, 0], [-r, -h, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 轴线 - 虚线 */}
        <Line
          points={[[0, -h, 0], [0, h, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  }
};

// 六棱柱专用投影视图
// ── 台阶块投影 ──────────────────────────────────────────────────────────────
const CustomSteppedProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth, stepCount, stepStyle } = params;
  const layers = Math.max(2, Math.min(5, stepCount ?? 3));
  const style = stepStyle ?? 'pyramid';
  const layerH = height / layers;
  const OFFSET = 0.05;

  // 每层的 [lw, ld, xOffset, yBottom]
  const layerData = Array.from({ length: layers }, (_, i) => {
    const shrink = style === 'pyramid' ? (1 - i * 0.25) : 1;
    const lw = Math.max(0.2, width * shrink);
    const ld = Math.max(0.2, depth * shrink);
    const xOffset = style === 'stair' ? i * (width / layers) * 0.4 : 0;
    const yBottom = -height / 2 + i * layerH;
    return { lw, ld, xOffset, yBottom };
  });

  if (plane === 'V') {
    // 主视图：从前往后看，每层矩形叠加，取外轮廓
    return (
      <group position={[0, 0, OFFSET]}>
        {layerData.map(({ lw, xOffset, yBottom }, i) => (
          <Line key={i}
            points={[
              [xOffset - lw/2, yBottom, 0], [xOffset + lw/2, yBottom, 0],
              [xOffset + lw/2, yBottom + layerH, 0], [xOffset - lw/2, yBottom + layerH, 0],
              [xOffset - lw/2, yBottom, 0],
            ]}
            color="#1f2937" lineWidth={2}
          />
        ))}
      </group>
    );
  }

  if (plane === 'H') {
    // 俯视图：从上往下看，只看最顶层（最小/最偏的那层）
    const top = layerData[layers - 1];
    return (
      <group position={[0, 0, OFFSET]}>
        {layerData.map(({ lw, ld, xOffset }, i) => (
          <Line key={i}
            points={[
              [xOffset - lw/2, -ld/2, 0], [xOffset + lw/2, -ld/2, 0],
              [xOffset + lw/2,  ld/2, 0], [xOffset - lw/2,  ld/2, 0],
              [xOffset - lw/2, -ld/2, 0],
            ]}
            color="#1f2937" lineWidth={i === layers - 1 ? 2 : 1}
            opacity={i === layers - 1 ? 1 : 0.5} transparent
          />
        ))}
        {/* suppress unused var warning */ void top}
      </group>
    );
  }

  // W / R：侧视图，每层矩形（深度方向）
  return (
    <group position={[0, 0, OFFSET]}>
      {layerData.map(({ ld, yBottom }, i) => (
        <Line key={i}
          points={[
            [-ld/2, yBottom, 0], [ld/2, yBottom, 0],
            [ld/2, yBottom + layerH, 0], [-ld/2, yBottom + layerH, 0],
            [-ld/2, yBottom, 0],
          ]}
          color="#1f2937" lineWidth={2}
        />
      ))}
    </group>
  );
};

// ── 带孔方块投影 ─────────────────────────────────────────────────────────────
const CustomHoleBlockProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth, holeCount, holeDiameter } = params;
  const numHoles = Math.max(1, Math.min(4, holeCount ?? 2));
  const d = Math.max(0.1, Math.min(Math.min(width, depth) * 0.45, holeDiameter ?? 0.5));
  const w = width / 2;
  const h = height / 2;
  const dh = depth / 2;
  const OFFSET = 0.05;

  const holePositions: [number, number][] = (() => {
    if (numHoles === 1) return [[0, 0]];
    if (numHoles === 2) return [[-width / 4, 0], [width / 4, 0]];
    if (numHoles === 3) return [[-width / 4, -depth / 4], [width / 4, -depth / 4], [0, depth / 4]];
    return [[-width/4, -depth/4], [width/4, -depth/4], [-width/4, depth/4], [width/4, depth/4]];
  })();

  const circlePoints = (cx: number, cy: number, r: number, n = 48): [number, number, number][] => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0]);
    }
    return pts;
  };

  const dashedCircle = (cx: number, cy: number, r: number) => {
    const geo = new THREE.BufferGeometry().setFromPoints(
      circlePoints(cx, cy, r).map(p => new THREE.Vector3(...p))
    );
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.1, gapSize: 0.07 }));
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：矩形外框 + 每个孔的两条竖虚线（孔在 XZ 平面，V 视图看 X 方向）
    return (
      <group position={[0, 0, OFFSET]}>
        <Line points={[[-w,-h,0],[w,-h,0],[w,h,0],[-w,h,0],[-w,-h,0]]} color="#1f2937" lineWidth={2} />
        {holePositions.map(([px], i) => (
          <React.Fragment key={i}>
            <primitive object={(() => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px-d/2,-h,0),new THREE.Vector3(px-d/2,h,0)]); const l = new THREE.Line(g, new THREE.LineDashedMaterial({color:'#1f2937',dashSize:0.1,gapSize:0.07})); l.computeLineDistances(); return l; })()} />
            <primitive object={(() => { const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(px+d/2,-h,0),new THREE.Vector3(px+d/2,h,0)]); const l = new THREE.Line(g, new THREE.LineDashedMaterial({color:'#1f2937',dashSize:0.1,gapSize:0.07})); l.computeLineDistances(); return l; })()} />
          </React.Fragment>
        ))}
      </group>
    );
  }

  if (plane === 'H') {
    // 俯视图：矩形外框 + 每个孔的圆（实线，孔穿透可见）
    return (
      <group position={[0, 0, OFFSET]}>
        <Line points={[[-w,-dh,0],[w,-dh,0],[w,dh,0],[-w,dh,0],[-w,-dh,0]]} color="#1f2937" lineWidth={2} />
        {holePositions.map(([px, pz], i) => (
          <Line key={i} points={circlePoints(px, pz, d/2)} color="#1f2937" lineWidth={2} />
        ))}
      </group>
    );
  }

  // W / R：侧视图：矩形外框 + 孔的两条横虚线（孔在 Z 方向可见）
  return (
    <group position={[0, 0, OFFSET]}>
      <Line points={[[-dh,-h,0],[dh,-h,0],[dh,h,0],[-dh,h,0],[-dh,-h,0]]} color="#1f2937" lineWidth={2} />
      {holePositions.map(([, pz], i) => (
        <primitive key={i} object={dashedCircle(pz, 0, d/2)} />
      ))}
    </group>
  );
};

// ── 双向开槽块投影 ───────────────────────────────────────────────────────────
const CustomDoubleSlotProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth, slotWidth, slotDepth } = params;
  const sw = Math.max(0.1, Math.min(Math.min(width, depth) * 0.4, slotWidth ?? 0.4));
  const sd = Math.max(0.1, Math.min(height * 0.7, slotDepth ?? height * 0.5));
  const w = width / 2;
  const h = height / 2;
  const dh = depth / 2;
  const OFFSET = 0.05;
  // 槽从顶面往下挖，槽底 Y = h - sd
  const slotBottomY = h - sd;

  if (plane === 'V') {
    // 主视图：看到沿 X 方向的槽（宽 sw，深 sd）；沿 Z 方向的槽退化为两条竖线
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 外轮廓（含槽缺口） */}
        <Line points={[
          [-w, -h, 0], [w, -h, 0], [w, slotBottomY, 0],
          [sw/2, slotBottomY, 0], [sw/2, h, 0],
          [-sw/2, h, 0], [-sw/2, slotBottomY, 0],
          [-w, slotBottomY, 0], [-w, -h, 0],
        ]} color="#1f2937" lineWidth={2} />
        {/* 槽底横线 */}
        <Line points={[[-w, slotBottomY, 0], [-sw/2, slotBottomY, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[sw/2, slotBottomY, 0], [w, slotBottomY, 0]]} color="#1f2937" lineWidth={2} />
      </group>
    );
  }

  if (plane === 'H') {
    // 俯视图：看到两个槽的交叉（十字形缺口）
    return (
      <group position={[0, 0, OFFSET]}>
        <Line points={[
          [-w, -dh, 0], [w, -dh, 0], [w, dh, 0], [-w, dh, 0], [-w, -dh, 0],
        ]} color="#1f2937" lineWidth={2} />
        {/* 十字槽轮廓虚线 */}
        {[[-sw/2, -dh, 0], [-sw/2, dh, 0]].map((_, i) => null)}
        <Line points={[[-sw/2, -dh, 0], [-sw/2, dh, 0]]} color="#1f2937" lineWidth={1.5} dashed dashSize={0.1} gapSize={0.07} />
        <Line points={[[sw/2, -dh, 0], [sw/2, dh, 0]]} color="#1f2937" lineWidth={1.5} dashed dashSize={0.1} gapSize={0.07} />
        <Line points={[[-w, -sw/2, 0], [w, -sw/2, 0]]} color="#1f2937" lineWidth={1.5} dashed dashSize={0.1} gapSize={0.07} />
        <Line points={[[-w, sw/2, 0], [w, sw/2, 0]]} color="#1f2937" lineWidth={1.5} dashed dashSize={0.1} gapSize={0.07} />
      </group>
    );
  }

  // W / R：侧视图：看到沿 Z 方向的槽（宽 sw，深 sd）
  return (
    <group position={[0, 0, OFFSET]}>
      <Line points={[
        [-dh, -h, 0], [dh, -h, 0], [dh, slotBottomY, 0],
        [sw/2, slotBottomY, 0], [sw/2, h, 0],
        [-sw/2, h, 0], [-sw/2, slotBottomY, 0],
        [-dh, slotBottomY, 0], [-dh, -h, 0],
      ]} color="#1f2937" lineWidth={2} />
      <Line points={[[-dh, slotBottomY, 0], [-sw/2, slotBottomY, 0]]} color="#1f2937" lineWidth={2} />
      <Line points={[[sw/2, slotBottomY, 0], [dh, slotBottomY, 0]]} color="#1f2937" lineWidth={2} />
    </group>
  );
};

// ── CSG 工作台投影（用实时 geometry 压扁） ───────────────────────────────────
const CSGWorkshopProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const geometry = params.csgGeometry;
  if (!geometry) return null;
  const OFFSET = 0.05;
  let scale: [number, number, number] = [1, 1, 1];
  let position: [number, number, number] = [0, 0, 0];
  if (plane === 'V') { scale = [1, 1, 0.001]; position = [0, 0, OFFSET]; }
  else if (plane === 'H') { scale = [1, 0.001, 1]; position = [0, OFFSET, 0]; }
  else if (plane === 'W') { scale = [0.001, 1, 1]; position = [-OFFSET, 0, 0]; }
  else { scale = [0.001, 1, 1]; position = [OFFSET, 0, 0]; }
  return (
    <group position={position}>
      <mesh scale={scale} geometry={geometry}>
        <Edges threshold={15} color="#1f2937" lineWidth={2} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.08} />
      </mesh>
    </group>
  );
};

// 自定义棱柱投影（任意边数）
const CustomPrismProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, prismSides } = params;
  const sides = Math.max(3, Math.min(12, prismSides ?? 6));
  const r = width / 2;
  const h = height / 2;
  const OFFSET = 0.05;

  // CylinderGeometry 默认第一个顶点在 +X 方向（angle=0），无旋转偏移
  const pts: [number, number][] = [];
  for (let i = 0; i < sides; i++) {
    const angle = (i / sides) * Math.PI * 2;
    pts.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }

  // 俯视图：正多边形
  if (plane === 'H') {
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[...pts.map(p => [p[0], p[1], 0] as [number, number, number]), [pts[0][0], pts[0][1], 0]]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  }

  // V / W / R：矩形轮廓（最宽跨度）+ 内部棱虚线
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...start), new THREE.Vector3(...end)]);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 }));
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：宽 = maxX-minX，高 = height；内部棱投影为竖虚线
    const innerXs = [...new Set(xs)].filter(x => x > minX + 0.01 && x < maxX - 0.01).sort((a, b) => a - b);
    return (
      <group position={[0, 0, OFFSET]}>
        <Line points={[[minX, -h, 0], [maxX, -h, 0], [maxX, h, 0], [minX, h, 0], [minX, -h, 0]]} color="#1f2937" lineWidth={2} />
        {innerXs.map((x, i) => <primitive key={i} object={createDashedLine([x, -h, 0], [x, h, 0])} />)}
      </group>
    );
  }

  // W / R：宽 = maxY-minY（depth 方向），高 = height
  const innerYs = [...new Set(ys)].filter(y => y > minY + 0.01 && y < maxY - 0.01).sort((a, b) => a - b);
  return (
    <group position={[0, 0, OFFSET]}>
      <Line points={[[minY, -h, 0], [maxY, -h, 0], [maxY, h, 0], [minY, h, 0], [minY, -h, 0]]} color="#1f2937" lineWidth={2} />
      {innerYs.map((y, i) => <primitive key={i} object={createDashedLine([y, -h, 0], [y, h, 0])} />)}
    </group>
  );
};

const HexPrismProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height } = params;
  const r = width / 2;
  const h = height / 2;
  const OFFSET = 0.05;

  // 六边形顶点（与 CylinderGeometry 的 6 边形一致）
  const hexPoints: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI) / 3 + Math.PI / 6;
    hexPoints.push([r * Math.cos(angle), r * Math.sin(angle)]);
  }

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图：看到六边形的正面投影（矩形+两个斜边）
    const leftX = hexPoints[2][0];  // 最左边的点
    const rightX = hexPoints[5][0]; // 最右边的点
    const topLeftX = hexPoints[1][0];
    const topRightX = hexPoints[0][0];
    
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 可见轮廓 */}
        <Line
          points={[
            [leftX, -h, 0], [rightX, -h, 0], [rightX, h, 0], [leftX, h, 0], [leftX, -h, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 后面的棱 - 虚线 */}
        <primitive object={createDashedLine([topLeftX, -h, 0], [topLeftX, h, 0])} />
        <primitive object={createDashedLine([topRightX, -h, 0], [topRightX, h, 0])} />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图：看到六边形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        <Line
          points={[
            ...hexPoints.map(p => [p[0], p[1], 0] as [number, number, number]),
            [hexPoints[0][0], hexPoints[0][1], 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else {
    // 左视图/右视图
    // 注意：父级已有旋转变换，在 XY 平面绘制
    const frontZ = hexPoints[4][1];  // 最前面的点
    const backZ = hexPoints[1][1];   // 最后面的点
    const midZ1 = hexPoints[3][1];
    const midZ2 = hexPoints[0][1];
    
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 可见轮廓 */}
        <Line
          points={[
            [backZ, -h, 0], [frontZ, -h, 0], [frontZ, h, 0], [backZ, h, 0], [backZ, -h, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 中间的棱 - 虚线 */}
        <Line
          points={[[midZ1, -h, 0], [midZ1, h, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
        <Line
          points={[[midZ2, -h, 0], [midZ2, h, 0]]}
          color="#1f2937"
          lineWidth={1.5}
          dashed
          dashSize={0.15}
          gapSize={0.1}
        />
      </group>
    );
  }
};

// 相贯三棱柱专用投影视图
const IntersectingPrismsProjection: React.FC<{ params: GeometryParams; plane: 'V' | 'H' | 'W' | 'R' }> = ({ params, plane }) => {
  const { width, height, depth } = params;
  const prismRadius = Math.min(width, height) * 0.4;
  const prismLength = depth * 1.8;
  const halfLen = prismLength / 2;
  const r = prismRadius;
  const topY = r;           // 三角形顶点Y
  const botY = -r * 0.5;    // 三角形底边Y
  const triW = r * 0.866;   // 三角形半宽
  const OFFSET = 0.05;

  // 创建虚线
  const createDashedLine = (start: [number, number, number], end: [number, number, number]) => {
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end)
    ]);
    const line = new THREE.Line(
      geometry,
      new THREE.LineDashedMaterial({ color: '#1f2937', dashSize: 0.12, gapSize: 0.08 })
    );
    line.computeLineDistances();
    return line;
  };

  if (plane === 'V') {
    // 主视图（从前往后看，XY平面）：看到沿X轴的三棱柱侧面 + 沿Z轴的三棱柱端面
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 沿X轴三棱柱的侧面轮廓（矩形） */}
        <Line
          points={[
            [-halfLen, topY, 0], [halfLen, topY, 0],
            [halfLen, botY, 0], [-halfLen, botY, 0], [-halfLen, topY, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 沿Z轴三棱柱的端面（三角形）- 相贯线 */}
        <Line
          points={[
            [0, topY, 0], [-triW, botY, 0], [triW, botY, 0], [0, topY, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  } else if (plane === 'H') {
    // 俯视图（从上往下看）：看到两个三棱柱的十字形
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 沿X轴三棱柱的俯视（矩形）- 左边部分 */}
        <Line points={[[-halfLen, -triW, 0], [-triW, -triW, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[-halfLen, triW, 0], [-triW, triW, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[-halfLen, -triW, 0], [-halfLen, triW, 0]]} color="#1f2937" lineWidth={2} />
        {/* 右边部分 */}
        <Line points={[[triW, -triW, 0], [halfLen, -triW, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[triW, triW, 0], [halfLen, triW, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[halfLen, -triW, 0], [halfLen, triW, 0]]} color="#1f2937" lineWidth={2} />
        
        {/* 沿Z轴三棱柱的俯视（矩形）- 上边部分 */}
        <Line points={[[-triW, -halfLen, 0], [-triW, -triW, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[triW, -halfLen, 0], [triW, -triW, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[-triW, -halfLen, 0], [triW, -halfLen, 0]]} color="#1f2937" lineWidth={2} />
        {/* 下边部分 */}
        <Line points={[[-triW, triW, 0], [-triW, halfLen, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[triW, triW, 0], [triW, halfLen, 0]]} color="#1f2937" lineWidth={2} />
        <Line points={[[-triW, halfLen, 0], [triW, halfLen, 0]]} color="#1f2937" lineWidth={2} />
        
        {/* 相贯线 - 中心正方形 */}
        <Line points={[[-triW, -triW, 0], [-triW, triW, 0]]} color="#1f2937" lineWidth={2.5} />
        <Line points={[[triW, -triW, 0], [triW, triW, 0]]} color="#1f2937" lineWidth={2.5} />
        <Line points={[[-triW, -triW, 0], [triW, -triW, 0]]} color="#1f2937" lineWidth={2.5} />
        <Line points={[[-triW, triW, 0], [triW, triW, 0]]} color="#1f2937" lineWidth={2.5} />
      </group>
    );
  } else {
    // 左视图/右视图（从侧面看）
    // 注意：父级已有旋转变换，在 XY 平面绘制
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 沿Z轴三棱柱的侧面轮廓（矩形） */}
        <Line
          points={[
            [-halfLen, topY, 0], [halfLen, topY, 0],
            [halfLen, botY, 0], [-halfLen, botY, 0], [-halfLen, topY, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 沿X轴三棱柱的端面（三角形）- 相贯线 */}
        <Line
          points={[
            [0, topY, 0], [-triW, botY, 0], [triW, botY, 0], [0, topY, 0]
          ]}
          color="#1f2937"
          lineWidth={2}
        />
      </group>
    );
  }
};

export const ProjectedView: React.FC<ProjectedViewProps> = ({ type, params, plane }) => {
  const geometry = useGeometryFactory(type, params);
  
  // 立方体使用专门的投影视图
  if (type === GeometryType.CUBE) {
    return <CubeProjection params={params} plane={plane} />;
  }
  
  // 切角块使用专门的投影视图
  if (type === GeometryType.CUT_BLOCK) {
    return <CutBlockProjection params={params} plane={plane} />;
  }
  
  // L形块使用专门的投影视图
  if (type === GeometryType.L_SHAPE) {
    return <LShapeProjection params={params} plane={plane} />;
  }
  
  // 楔形块使用专门的投影视图
  if (type === GeometryType.WEDGE) {
    return <WedgeProjection params={params} plane={plane} />;
  }
  
  // T形块使用专门的投影视图
  if (type === GeometryType.T_SHAPE) {
    return <TShapeProjection params={params} plane={plane} />;
  }
  
  // 十字形块使用专门的投影视图
  if (type === GeometryType.CROSS_SHAPE) {
    return <CrossShapeProjection params={params} plane={plane} />;
  }
  
  // 阶梯块使用专门的投影视图
  if (type === GeometryType.STEPPED_BLOCK) {
    return <SteppedBlockProjection params={params} plane={plane} />;
  }
  
  // 圆柱体使用专门的投影视图
  if (type === GeometryType.CYLINDER) {
    return <CylinderProjection params={params} plane={plane} />;
  }
  
  // 圆锥体使用专门的投影视图
  if (type === GeometryType.CONE) {
    return <ConeProjection params={params} plane={plane} />;
  }
  
  // 四棱锥使用专门的投影视图
  if (type === GeometryType.PYRAMID) {
    return <PyramidProjection params={params} plane={plane} />;
  }
  
  // 六棱柱使用专门的投影视图
  if (type === GeometryType.HEX_PRISM) {
    return <HexPrismProjection params={params} plane={plane} />;
  }

  if (type === GeometryType.CUSTOM_PRISM) {
    return <CustomPrismProjection params={params} plane={plane} />;
  }

  // 空心圆柱使用专门的投影视图
  if (type === GeometryType.HOLLOW_CYLINDER) {
    return <HollowCylinderProjection params={params} plane={plane} />;
  }
  
  // 开槽块使用专门的投影视图
  if (type === GeometryType.SLOT_BLOCK) {
    return <SlotBlockProjection params={params} plane={plane} />;
  }
  
  // 相贯三棱柱使用专门的投影视图
  if (type === GeometryType.INTERSECTING_PRISMS) {
    return <IntersectingPrismsProjection params={params} plane={plane} />;
  }
  
  // 圆环体使用专门的投影视图
  if (type === GeometryType.TORUS) {
    return <TorusProjection params={params} plane={plane} />;
  }
  
  // 球体使用专门的投影视图
  if (type === GeometryType.SPHERE) {
    return <SphereProjection params={params} plane={plane} />;
  }

  if (type === GeometryType.CUSTOM_STEPPED) {
    return <CustomSteppedProjection params={params} plane={plane} />;
  }

  if (type === GeometryType.CUSTOM_HOLE_BLOCK) {
    return <CustomHoleBlockProjection params={params} plane={plane} />;
  }

  if (type === GeometryType.CUSTOM_DOUBLE_SLOT) {
    return <CustomDoubleSlotProjection params={params} plane={plane} />;
  }

  if (type === GeometryType.CSG_WORKSHOP) {
    return <CSGWorkshopProjection params={params} plane={plane} />;
  }

  // 默认：使用压扁方式（用于 CUBE 等简单几何体）
  let scale: [number, number, number] = [1, 1, 1];
  let position: [number, number, number] = [0, 0, 0];
  const OFFSET = 0.05;

  if (plane === 'V') {
    scale = [1, 1, 0.001];
    position = [0, 0, OFFSET]; 
  } else if (plane === 'H') {
    scale = [1, 0.001, 1];
    position = [0, OFFSET, 0];
  } else if (plane === 'W') {
    scale = [0.001, 1, 1];
    position = [-OFFSET, 0, 0]; 
  } else if (plane === 'R') {
    scale = [0.001, 1, 1];
    position = [OFFSET, 0, 0]; 
  }

  return (
    <group position={position}>
      <mesh scale={scale} geometry={geometry}>
        <Edges threshold={15} color="#1f2937" lineWidth={2} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.08} />
      </mesh>
    </group>
  );
};

// --- Projector Rays ---
interface ProjectorRaysProps {
  params: GeometryParams;
  geometryType: GeometryType;
  explodeGap?: number; // 炸开间距
}

export const ProjectorRays: React.FC<ProjectorRaysProps> = ({ params, geometryType, explodeGap = 0 }) => {
    const boxSize = 5;
    const geometry = useGeometryFactory(geometryType, params);

    const corners = React.useMemo(() => {
      geometry.computeBoundingBox();
      const box = geometry.boundingBox;
      if (!box) return [] as [number, number, number][];
      const { min, max } = box;
      const raw: [number, number, number][] = [
        [max.x, max.y, max.z],
        [max.x, max.y, min.z],
        [max.x, min.y, max.z],
        [max.x, min.y, min.z],
        [min.x, max.y, max.z],
        [min.x, max.y, min.z],
        [min.x, min.y, max.z],
        [min.x, min.y, min.z],
        [max.x, 0, 0],
        [min.x, 0, 0],
        [0, max.y, 0],
        [0, min.y, 0],
        [0, 0, max.z],
        [0, 0, min.z],
      ];
      const seen = new Set<string>();
      return raw.filter(([x, y, z]) => {
        const key = `${x.toFixed(4)}:${y.toFixed(4)}:${z.toFixed(4)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }, [geometry]);

    const createProjector = (start: [number, number, number], end: [number, number, number], key: string) => {
        const dist = Math.sqrt(
            Math.pow(end[0] - start[0], 2) + 
            Math.pow(end[1] - start[1], 2) + 
            Math.pow(end[2] - start[2], 2)
        );
        
        if (dist < 0.1) return null;

        // 整条线都用虚线，只在终点显示投影点
        return (
            <React.Fragment key={key}>
                <Line 
                    points={[start, end]} 
                    color={COLORS.PROJECTOR_LINE} 
                    dashed 
                    dashSize={0.15} 
                    gapSize={0.1} 
                    opacity={0.35}
                    transparent
                    lineWidth={1}
                />
                <mesh position={end}>
                    <sphereGeometry args={[0.05, 8, 8]} />
                    <meshBasicMaterial color={COLORS.PROJECTOR_LINE} />
                </mesh>
            </React.Fragment>
        );
    };

    const lines: React.ReactElement[] = [];
    
    // 计算各投影面的实际位置（考虑炸开间距）
    // 折叠态下四个投影面的实际世界位置要和 GlassBoxScene 里的平面中心对齐
    const vPlaneZ = -boxSize / 2 - explodeGap;   // V面后墙
    const hPlaneY = -boxSize - explodeGap;       // H面底墙
    const wPlaneX = boxSize + explodeGap;        // W面右墙（左视图）
    const rPlaneX = -boxSize - explodeGap;       // R面左墙（右视图）
    
    corners.forEach((corner, i) => {
        const [x, y, z] = corner;
        
        // V面 (主视图 - 后墙)
        const vLine = createProjector([x, y, z], [x, y, vPlaneZ], `v-${i}`);
        if(vLine) lines.push(vLine);

        // H面 (俯视图 - 底面)
        const hLine = createProjector([x, y, z], [x, hPlaneY, z], `h-${i}`);
        if(hLine) lines.push(hLine);

        // W面 (左视图 - 投影到右侧墙)
        const wLine = createProjector([x, y, z], [wPlaneX, y, z], `w-${i}`);
        if(wLine) lines.push(wLine);

        // R面 (右视图 - 投影到左侧墙)
        const rLine = createProjector([x, y, z], [rPlaneX, y, z], `r-${i}`);
        if(rLine) lines.push(rLine);
    });

    return <group>{lines}</group>;
};

// --- Plane Label ---
export const PlaneLabel: React.FC<{ 
  text: string, 
  position: [number, number, number], 
  color?: string 
}> = ({ text, position, color = '#1f2937' }) => {
  return (
    <Text
      position={position}
      fontSize={0.35}
      color={color}
      anchorX="center"
      anchorY="middle"
      outlineWidth={0.03}
      outlineColor="white"
      renderOrder={999}
    >
      {text}
    </Text>
  );
};
