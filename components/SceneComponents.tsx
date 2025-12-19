import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Edges, Text, Line } from '@react-three/drei';
import { GeometryType, GeometryParams } from '../types';
import { ADDITION, INTERSECTION, Evaluator, Brush } from 'three-bvh-csg';

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
  const { width, height, depth, cutSize } = params;

  return useMemo(() => {
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

      default:
        return new THREE.BoxGeometry(width, height, depth);
    }
  }, [type, width, height, depth, cutSize]);
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

// 计算相贯三棱柱的相贯线几何体
const useIntersectionLineGeometry = (params: GeometryParams) => {
  const { width, height, depth } = params;
  
  return useMemo(() => {
    const prismRadius = Math.min(width, height) * 0.4;
    const prismLength = depth * 1.8;
    
    // 创建等边三角形截面
    const createTriangleShape = () => {
      const shape = new THREE.Shape();
      const r = prismRadius;
      shape.moveTo(0, r);
      shape.lineTo(-r * 0.866, -r * 0.5);
      shape.lineTo(r * 0.866, -r * 0.5);
      shape.closePath();
      return shape;
    };
    
    // 第一个三棱柱（沿X轴）
    const geo1 = new THREE.ExtrudeGeometry(createTriangleShape(), { 
      depth: prismLength, 
      bevelEnabled: false 
    });
    geo1.rotateY(Math.PI / 2);
    geo1.translate(prismLength / 2, 0, 0);
    geo1.center();
    
    // 第二个三棱柱（沿Z轴）
    const geo2 = new THREE.ExtrudeGeometry(createTriangleShape(), { 
      depth: prismLength, 
      bevelEnabled: false 
    });
    geo2.translate(0, 0, -prismLength / 2);
    geo2.center();
    
    // 使用 CSG 求交集
    const evaluator = new Evaluator();
    const brush1 = new Brush(geo1);
    const brush2 = new Brush(geo2);
    const intersectionResult = evaluator.evaluate(brush1, brush2, INTERSECTION);
    
    // 提取交集的边缘（阈值设低，确保所有棱都出来）
    const edgesGeometry = new THREE.EdgesGeometry(intersectionResult.geometry, 1);
    
    // 清理
    geo1.dispose();
    geo2.dispose();
    intersectionResult.geometry.dispose();
    
    return edgesGeometry;
  }, [width, height, depth]);
};

export const MainObject: React.FC<MainObjectProps> = ({ type, params, opacity = 1, customModelComponent }) => {
  const geometry = useGeometryFactory(type, params);
  const intersectionLineGeometry = useIntersectionLineGeometry(params);

  // 如果是自定义模型，渲染传入的组件
  if (type === GeometryType.CUSTOM && customModelComponent) {
    return <>{customModelComponent}</>;
  }

  // 相贯三棱柱需要额外显示相贯线
  if (type === GeometryType.INTERSECTING_PRISMS) {
    return (
      <group>
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
        {/* 相贯线 - 红色高亮显示 */}
        <lineSegments geometry={intersectionLineGeometry} scale={[1.002, 1.002, 1.002]}>
          <lineBasicMaterial color="#ef4444" linewidth={2} />
        </lineSegments>
      </group>
    );
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
    // 俯视图（从上往下看）：看到两个三棱柱的十字形轮廓
    // 注意：父级已有旋转变换，在 XY 平面绘制
    // 十字形由两个矩形相交组成，只画外轮廓
    return (
      <group position={[0, 0, OFFSET]}>
        {/* 十字形外轮廓 - 顺时针绘制 */}
        <Line
          points={[
            // 从左上角开始，顺时针
            [-halfLen, triW, 0],   // 左上
            [-triW, triW, 0],      // 左上内角
            [-triW, halfLen, 0],   // 上左
            [triW, halfLen, 0],    // 上右
            [triW, triW, 0],       // 右上内角
            [halfLen, triW, 0],    // 右上
            [halfLen, -triW, 0],   // 右下
            [triW, -triW, 0],      // 右下内角
            [triW, -halfLen, 0],   // 下右
            [-triW, -halfLen, 0],  // 下左
            [-triW, -triW, 0],     // 左下内角
            [-halfLen, -triW, 0],  // 左下
            [-halfLen, triW, 0],   // 回到左上
          ]}
          color="#1f2937"
          lineWidth={2}
        />
        {/* 相贯线 - X形对角线（两个三棱柱相交处的投影） */}
        <Line
          points={[[-triW, -triW, 0], [triW, triW, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
        <Line
          points={[[-triW, triW, 0], [triW, -triW, 0]]}
          color="#1f2937"
          lineWidth={2}
        />
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
    const { width, height, depth, cutSize } = params;
    const boxSize = 5;
    const w = width / 2;
    const h = height / 2;

    const getInterestPoints = () => {
        let points: [number, number, number][] = [
            [w, h, depth/2], [w, h, -depth/2], [w, -h, depth/2], [w, -h, -depth/2],
            [-w, h, depth/2], [-w, h, -depth/2], [-w, -h, depth/2], [-w, -h, -depth/2]
        ];

        if (geometryType === GeometryType.CUT_BLOCK) {
            const safeCut = Math.min(cutSize, Math.min(width, height) - 0.05);
            points = [
                [-w, h, depth/2], [-w, h, -depth/2],
                [-w, -h, depth/2], [-w, -h, -depth/2],
                [w, -h, depth/2], [w, -h, -depth/2],
                [w, h - safeCut, depth/2], [w, h - safeCut, -depth/2],
                [w - safeCut, h, depth/2], [w - safeCut, h, -depth/2]
            ];
        } else if (geometryType === GeometryType.CONE) {
            const r = width / 2;
            points = [
                [0, h, 0],
                [r, -h, 0], [-r, -h, 0],
                [0, -h, r], [0, -h, -r]
            ];
        } else if (geometryType === GeometryType.CYLINDER) {
            const r = width / 2;
            points = [
                [r, h, 0], [-r, h, 0], [0, h, r], [0, h, -r],
                [r, -h, 0], [-r, -h, 0], [0, -h, r], [0, -h, -r]
            ];
        } else if (geometryType === GeometryType.HEX_PRISM) {
            // 六棱柱的6个顶点（上下两个面）
            // Three.js CylinderGeometry 的起始角度有 90度偏移 (Math.PI/2)
            const r = width / 2;
            const hexPoints: [number, number, number][] = [];
            for (let i = 0; i < 6; i++) {
                const angle = (i * Math.PI) / 3 + Math.PI / 6; // 60度间隔，起始偏移30度
                const x = r * Math.cos(angle);
                const z = r * Math.sin(angle);
                hexPoints.push([x, h, z]);  // 上面
                hexPoints.push([x, -h, z]); // 下面
            }
            points = hexPoints;
        } else if (geometryType === GeometryType.L_SHAPE) {
            const thick = Math.min(width, height) * 0.4;
            points = [
                [-w, -h, depth/2], [-w, -h, -depth/2],
                [w, -h, depth/2], [w, -h, -depth/2],
                [w, -h + thick, depth/2], [w, -h + thick, -depth/2],
                [-w + thick, -h + thick, depth/2], [-w + thick, -h + thick, -depth/2],
                [-w + thick, h, depth/2], [-w + thick, h, -depth/2],
                [-w, h, depth/2], [-w, h, -depth/2],
            ];
        } else if (geometryType === GeometryType.SPHERE) {
            const r = width / 2;
            points = [
                [r, 0, 0], [-r, 0, 0],
                [0, r, 0], [0, -r, 0],
                [0, 0, r], [0, 0, -r]
            ];
        } else if (geometryType === GeometryType.PYRAMID) {
            const r = width / 2;
            points = [
                [0, h, 0], // 顶点
                [r, -h, 0], [-r, -h, 0],
                [0, -h, r], [0, -h, -r]
            ];
        } else if (geometryType === GeometryType.TORUS) {
            // TorusGeometry 默认在 XY 平面，环绕 Z 轴
            const R = width / 2.5; // 主半径
            const r = width / 6;   // 管半径
            points = [
                // X轴方向的外圈和内圈点
                [R + r, 0, 0], [R - r, 0, 0],
                [-(R + r), 0, 0], [-(R - r), 0, 0],
                // Y轴方向的外圈和内圈点
                [0, R + r, 0], [0, R - r, 0],
                [0, -(R + r), 0], [0, -(R - r), 0],
                // 管截面的上下点
                [R, 0, r], [R, 0, -r],
                [-R, 0, r], [-R, 0, -r],
                [0, R, r], [0, R, -r],
                [0, -R, r], [0, -R, -r]
            ];
        } else if (geometryType === GeometryType.WEDGE) {
            points = [
                [-w, -h, depth/2], [-w, -h, -depth/2],
                [w, -h, depth/2], [w, -h, -depth/2],
                [w, h, depth/2], [w, h, -depth/2]
            ];
        } else if (geometryType === GeometryType.T_SHAPE) {
            const stemW = width * 0.3;
            const topH = height * 0.3;
            points = [
                [-stemW/2, -h, depth/2], [-stemW/2, -h, -depth/2],
                [stemW/2, -h, depth/2], [stemW/2, -h, -depth/2],
                [stemW/2, h - topH, depth/2], [stemW/2, h - topH, -depth/2],
                [w, h - topH, depth/2], [w, h - topH, -depth/2],
                [w, h, depth/2], [w, h, -depth/2],
                [-w, h, depth/2], [-w, h, -depth/2],
                [-w, h - topH, depth/2], [-w, h - topH, -depth/2],
                [-stemW/2, h - topH, depth/2], [-stemW/2, h - topH, -depth/2]
            ];
        } else if (geometryType === GeometryType.CROSS_SHAPE) {
            const armW = width * 0.3;
            const armH = height * 0.3;
            points = [
                [-armW/2, -h, depth/2], [-armW/2, -h, -depth/2],
                [armW/2, -h, depth/2], [armW/2, -h, -depth/2],
                [armW/2, h, depth/2], [armW/2, h, -depth/2],
                [-armW/2, h, depth/2], [-armW/2, h, -depth/2],
                [w, -armH/2, depth/2], [w, -armH/2, -depth/2],
                [w, armH/2, depth/2], [w, armH/2, -depth/2],
                [-w, -armH/2, depth/2], [-w, -armH/2, -depth/2],
                [-w, armH/2, depth/2], [-w, armH/2, -depth/2]
            ];
        } else if (geometryType === GeometryType.HOLLOW_CYLINDER) {
            // 几何体居中，Y 从 -h/2 到 h/2
            const outerR = width / 2;
            const innerR = width / 4;
            const hh = height / 2;
            points = [
                // 顶面外圈 (Y = h/2)
                [outerR, hh, 0], [-outerR, hh, 0], [0, hh, outerR], [0, hh, -outerR],
                // 底面外圈 (Y = -h/2)
                [outerR, -hh, 0], [-outerR, -hh, 0], [0, -hh, outerR], [0, -hh, -outerR],
                // 顶面内圈
                [innerR, hh, 0], [-innerR, hh, 0], [0, hh, innerR], [0, hh, -innerR],
                // 底面内圈
                [innerR, -hh, 0], [-innerR, -hh, 0], [0, -hh, innerR], [0, -hh, -innerR]
            ];
        } else if (geometryType === GeometryType.STEPPED_BLOCK) {
            const step = height / 3;
            points = [
                [-w, -h, depth/2], [-w, -h, -depth/2],
                [w, -h, depth/2], [w, -h, -depth/2],
                [w, -h + step, depth/2], [w, -h + step, -depth/2],
                [w * 0.5, -h + step, depth/2], [w * 0.5, -h + step, -depth/2],
                [w * 0.5, -h + step * 2, depth/2], [w * 0.5, -h + step * 2, -depth/2],
                [0, -h + step * 2, depth/2], [0, -h + step * 2, -depth/2],
                [0, h, depth/2], [0, h, -depth/2],
                [-w, h, depth/2], [-w, h, -depth/2]
            ];
        } else if (geometryType === GeometryType.CUT_CYLINDER) {
            const r = width / 2;
            points = [
                [r, h, 0], [-r, h, 0], [0, h, r], [0, h, -r],
                [r, -h, 0], [-r, -h, 0], [0, -h, r], [0, -h, -r]
            ];
        } else if (geometryType === GeometryType.SLOT_BLOCK) {
            const slotW = width * 0.3;
            const slotD = height * 0.4;
            points = [
                [-w, -h, depth/2], [-w, -h, -depth/2],
                [w, -h, depth/2], [w, -h, -depth/2],
                [w, h, depth/2], [w, h, -depth/2],
                [slotW/2, h, depth/2], [slotW/2, h, -depth/2],
                [slotW/2, h - slotD, depth/2], [slotW/2, h - slotD, -depth/2],
                [-slotW/2, h - slotD, depth/2], [-slotW/2, h - slotD, -depth/2],
                [-slotW/2, h, depth/2], [-slotW/2, h, -depth/2],
                [-w, h, depth/2], [-w, h, -depth/2]
            ];
        } else if (geometryType === GeometryType.INTERSECTING_PRISMS) {
            // 两个正交相贯的三棱柱 - 与几何体定义保持一致
            const prismRadius = Math.min(width, height) * 0.4;
            const prismLength = depth * 1.8;
            const halfLen = prismLength / 2;
            const r = prismRadius;
            const topY = r;           // 三角形顶点Y
            const botY = -r * 0.5;    // 三角形底边Y
            const triW = r * 0.866;   // 三角形半宽
            
            points = [
                // 第一个三棱柱（沿X轴）的关键点
                [halfLen, topY, 0], [-halfLen, topY, 0],           // 顶棱两端
                [halfLen, botY, -triW], [-halfLen, botY, -triW],   // 后底棱两端
                [halfLen, botY, triW], [-halfLen, botY, triW],     // 前底棱两端
                // 第二个三棱柱（沿Z轴）的关键点
                [0, topY, halfLen], [0, topY, -halfLen],           // 顶棱两端
                [-triW, botY, halfLen], [-triW, botY, -halfLen],   // 左底棱两端
                [triW, botY, halfLen], [triW, botY, -halfLen],     // 右底棱两端
            ];
        }

        return points;
    }

    const corners = getInterestPoints();

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
    const vPlaneZ = -boxSize/2 - explodeGap;  // V面向后炸开
    const hPlaneY = -boxSize/2 - explodeGap;  // H面向下炸开
    const wPlaneX = boxSize/2 + explodeGap;   // W面向右炸开
    const rPlaneX = -boxSize/2 - explodeGap;  // R面向左炸开
    
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
