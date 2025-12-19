import React, { useRef, Suspense, useCallback, useMemo } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera, OrthographicCamera, Edges, Line } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { GeometryType, GeometryParams } from '../types';
import { MainObject, ProjectedView, COLORS, PlaneLabel, ProjectorRays, useGeometryFactory } from './SceneComponents';
import { SketchBuilder } from './SketchBuilder';
import { SectionPlane, SectionLine2D } from './SectionPlane';
import { SectionResult } from '../utils/sectionPlane';

interface GlassBoxSceneProps {
  geometryType: GeometryType;
  geometryParams: GeometryParams;
  isUnfolded: boolean;
  showObject: boolean;
  showProjectors: boolean;
  useOrthographic: boolean;
  showAxonometric?: boolean;
  axonometricType?: 'isometric' | 'dimetric' | 'cabinet';
  drawCompleted?: boolean;
  drawnPoints?: [number, number][];
  drawnDepth?: number;
  onDrawComplete?: (points: [number, number][], depth: number) => void;
  // 截平面相关
  showSectionPlane?: boolean;
  sectionPlanePosition?: [number, number, number];
  sectionPlaneRotation?: [number, number, number];
  onSectionChange?: (result: SectionResult | null) => void;
}

// 自定义模型组件
const CustomModelObject: React.FC<{ url: string; scale: number }> = ({ url, scale }) => {
  const gltf = useLoader(GLTFLoader, url);
  
  const { scene, normalizedScale } = React.useMemo(() => {
    const clonedScene = gltf.scene.clone();
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    clonedScene.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    const normalizedScale = maxDim > 0 ? 2 / maxDim : 1;
    
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: COLORS.OBJECT,
          metalness: 0.2,
          roughness: 0.4,
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    return { scene: clonedScene, normalizedScale };
  }, [gltf]);

  return (
    <group scale={normalizedScale * scale}>
      <primitive object={scene} />
    </group>
  );
};

// 自定义模型投影组件 - 使用边缘检测生成投影线
interface CustomModelProjectionProps {
  url: string;
  scale: number;
  plane: 'V' | 'H' | 'W' | 'R';
}

const CustomModelProjection: React.FC<CustomModelProjectionProps> = ({ url, scale, plane }) => {
  const gltf = useLoader(GLTFLoader, url);
  const OFFSET = 0.05;
  
  const { geometry, normalizedScale } = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    
    // 计算包围盒用于居中和缩放
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const normalizedScale = maxDim > 0 ? 2 / maxDim : 1;
    
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const clonedGeometry = child.geometry.clone();
        child.updateMatrixWorld();
        clonedGeometry.applyMatrix4(child.matrixWorld);
        geometries.push(clonedGeometry);
      }
    });
    
    if (geometries.length === 0) {
      return { geometry: new THREE.BoxGeometry(1, 1, 1), normalizedScale: 1 };
    }
    
    // 合并所有几何体（转换为非索引几何体以确保正确处理）
    let mergedGeometry: THREE.BufferGeometry;
    if (geometries.length === 1) {
      mergedGeometry = geometries[0].index ? geometries[0].toNonIndexed() : geometries[0];
    } else {
      // 先将所有几何体转换为非索引几何体
      const nonIndexedGeometries = geometries.map(geo => 
        geo.index ? geo.toNonIndexed() : geo
      );
      
      let totalVertices = 0;
      nonIndexedGeometries.forEach(geo => {
        totalVertices += geo.attributes.position.count;
      });
      
      const positions = new Float32Array(totalVertices * 3);
      let posOffset = 0;
      
      nonIndexedGeometries.forEach(geo => {
        const pos = geo.attributes.position.array;
        positions.set(pos, posOffset);
        posOffset += pos.length;
      });
      
      mergedGeometry = new THREE.BufferGeometry();
      mergedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      mergedGeometry.computeVertexNormals();
    }
    
    // 居中几何体
    mergedGeometry.translate(-center.x, -center.y, -center.z);
    
    return { geometry: mergedGeometry, normalizedScale };
  }, [gltf]);
  
  // 根据投影面设置缩放和位置
  let scaleVec: [number, number, number] = [1, 1, 1];
  let position: [number, number, number] = [0, 0, 0];
  const finalScale = normalizedScale * scale;

  if (plane === 'V') {
    // 主视图：压扁Z轴
    scaleVec = [finalScale, finalScale, 0.001];
    position = [0, 0, OFFSET];
  } else if (plane === 'H') {
    // 俯视图：压扁Y轴（注意父级已有旋转变换）
    scaleVec = [finalScale, finalScale, 0.001];
    position = [0, 0, OFFSET];
  } else if (plane === 'W') {
    // 左视图：压扁X轴（注意父级已有旋转变换）
    scaleVec = [finalScale, finalScale, 0.001];
    position = [0, 0, OFFSET];
  } else if (plane === 'R') {
    // 右视图：压扁X轴（注意父级已有旋转变换）
    scaleVec = [finalScale, finalScale, 0.001];
    position = [0, 0, OFFSET];
  }

  // 根据投影面旋转几何体以获得正确的投影
  const projectedGeometry = useMemo(() => {
    const geo = geometry.clone();
    
    if (plane === 'H') {
      // 俯视图：绕X轴旋转-90度，然后压扁
      geo.rotateX(-Math.PI / 2);
    } else if (plane === 'W') {
      // 左视图：绕Y轴旋转90度
      geo.rotateY(Math.PI / 2);
    } else if (plane === 'R') {
      // 右视图：绕Y轴旋转-90度
      geo.rotateY(-Math.PI / 2);
    }
    // V面（主视图）不需要旋转
    
    return geo;
  }, [geometry, plane]);

  return (
    <group position={position}>
      <mesh scale={scaleVec} geometry={projectedGeometry}>
        <Edges threshold={15} color="#1f2937" lineWidth={2} />
        <meshBasicMaterial color="#1f2937" transparent opacity={0.08} />
      </mesh>
    </group>
  );
};

// 自定义模型截平面组件 - 包装 SectionPlane 以支持自定义模型
interface CustomModelSectionPlaneProps {
  url: string;
  scale: number;
  enabled: boolean;
  planePosition: [number, number, number];
  planeRotation: [number, number, number];
  planeSize?: number;
  onSectionChange?: (result: SectionResult | null) => void;
}

const CustomModelSectionPlane: React.FC<CustomModelSectionPlaneProps> = ({
  url,
  scale,
  enabled,
  planePosition,
  planeRotation,
  planeSize = 4,
  onSectionChange
}) => {
  const gltf = useLoader(GLTFLoader, url);
  
  // 获取合并后的几何体（与投影组件使用相同的逻辑）
  const geometry = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];
    
    // 计算包围盒用于居中和缩放
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const normalizedScale = maxDim > 0 ? 2 / maxDim : 1;
    const finalScale = normalizedScale * scale;
    
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const clonedGeometry = child.geometry.clone();
        child.updateMatrixWorld();
        clonedGeometry.applyMatrix4(child.matrixWorld);
        geometries.push(clonedGeometry);
      }
    });
    
    if (geometries.length === 0) {
      return new THREE.BoxGeometry(1, 1, 1);
    }
    
    // 合并所有几何体（转换为非索引几何体以确保正确处理截交线计算）
    let mergedGeometry: THREE.BufferGeometry;
    if (geometries.length === 1) {
      mergedGeometry = geometries[0].index ? geometries[0].toNonIndexed() : geometries[0];
    } else {
      // 先将所有几何体转换为非索引几何体
      const nonIndexedGeometries = geometries.map(geo => 
        geo.index ? geo.toNonIndexed() : geo
      );
      
      let totalVertices = 0;
      nonIndexedGeometries.forEach(geo => {
        totalVertices += geo.attributes.position.count;
      });
      
      const positions = new Float32Array(totalVertices * 3);
      let posOffset = 0;
      
      nonIndexedGeometries.forEach(geo => {
        const pos = geo.attributes.position.array;
        positions.set(pos, posOffset);
        posOffset += pos.length;
      });
      
      mergedGeometry = new THREE.BufferGeometry();
      mergedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      mergedGeometry.computeVertexNormals();
    }
    
    // 居中几何体
    mergedGeometry.translate(-center.x, -center.y, -center.z);
    
    // 应用缩放
    mergedGeometry.scale(finalScale, finalScale, finalScale);
    
    return mergedGeometry;
  }, [gltf, scale]);
  
  return (
    <SectionPlane
      geometry={geometry}
      enabled={enabled}
      planePosition={planePosition}
      planeRotation={planeRotation}
      planeSize={planeSize}
      onSectionChange={onSectionChange}
    />
  );
};

// 自定义模型投影线组件 - 显示从模型轮廓线顶点到各投影面的投影线和投影点
interface CustomModelProjectorRaysProps {
  url: string;
  scale: number;
  explodeGap?: number;
}

const CustomModelProjectorRays: React.FC<CustomModelProjectorRaysProps> = ({
  url,
  scale,
  explodeGap = 0
}) => {
  const gltf = useLoader(GLTFLoader, url);
  const BOX_SIZE = 5;
  
  // 提取关键点：极值点 + 拐点检测
  const cornerPoints = useMemo(() => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const normalizedScale = maxDim > 0 ? 2 / maxDim : 1;
    const finalScale = normalizedScale * scale;
    
    // 收集所有轮廓线的边
    const edges: [THREE.Vector3, THREE.Vector3][] = [];
    const allPoints: THREE.Vector3[] = [];
    
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const edgesGeometry = new THREE.EdgesGeometry(child.geometry, 15);
        const positions = edgesGeometry.getAttribute('position');
        
        if (positions) {
          child.updateMatrixWorld();
          
          for (let i = 0; i < positions.count; i += 2) {
            const p1 = new THREE.Vector3().fromBufferAttribute(positions, i);
            const p2 = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
            p1.applyMatrix4(child.matrixWorld).sub(center).multiplyScalar(finalScale);
            p2.applyMatrix4(child.matrixWorld).sub(center).multiplyScalar(finalScale);
            edges.push([p1, p2]);
            allPoints.push(p1, p2);
          }
        }
        edgesGeometry.dispose();
      }
    });
    
    const keyPoints: THREE.Vector3[] = [];
    const tolerance = 0.1;
    
    const addUniquePoint = (p: THREE.Vector3) => {
      if (!keyPoints.some(existing => existing.distanceTo(p) < tolerance)) {
        keyPoints.push(p.clone());
      }
    };
    
    // 方法1：极值点检测 - 找 X/Y/Z 各轴的最大最小值点
    if (allPoints.length > 0) {
      let minX = allPoints[0], maxX = allPoints[0];
      let minY = allPoints[0], maxY = allPoints[0];
      let minZ = allPoints[0], maxZ = allPoints[0];
      
      for (const p of allPoints) {
        if (p.x < minX.x) minX = p;
        if (p.x > maxX.x) maxX = p;
        if (p.y < minY.y) minY = p;
        if (p.y > maxY.y) maxY = p;
        if (p.z < minZ.z) minZ = p;
        if (p.z > maxZ.z) maxZ = p;
      }
      
      addUniquePoint(minX);
      addUniquePoint(maxX);
      addUniquePoint(minY);
      addUniquePoint(maxY);
      addUniquePoint(minZ);
      addUniquePoint(maxZ);
    }
    
    // 方法2：拐点检测 - 找多条边交汇的顶点（度数 >= 3）
    const vertexDegree = new Map<string, { point: THREE.Vector3; count: number }>();
    const pointKey = (p: THREE.Vector3) => 
      `${Math.round(p.x / tolerance)},${Math.round(p.y / tolerance)},${Math.round(p.z / tolerance)}`;
    
    for (const [p1, p2] of edges) {
      const key1 = pointKey(p1);
      const key2 = pointKey(p2);
      
      if (!vertexDegree.has(key1)) vertexDegree.set(key1, { point: p1, count: 0 });
      if (!vertexDegree.has(key2)) vertexDegree.set(key2, { point: p2, count: 0 });
      
      vertexDegree.get(key1)!.count++;
      vertexDegree.get(key2)!.count++;
    }
    
    // 度数 >= 3 的点是拐点（多条边交汇）
    for (const { point, count } of vertexDegree.values()) {
      if (count >= 3) {
        addUniquePoint(point);
      }
    }
    
    return keyPoints.map(p => [p.x, p.y, p.z] as [number, number, number]);
  }, [gltf, scale]);
  
  // 创建投影线
  const createProjector = (
    start: [number, number, number],
    end: [number, number, number],
    key: string
  ) => {
    const dist = Math.sqrt(
      Math.pow(end[0] - start[0], 2) +
      Math.pow(end[1] - start[1], 2) +
      Math.pow(end[2] - start[2], 2)
    );
    
    if (dist < 0.1) return null;
    
    return (
      <React.Fragment key={key}>
        <Line
          points={[start, end]}
          color={COLORS.PROJECTOR_LINE}
          dashed
          dashSize={0.15}
          gapSize={0.08}
          opacity={0.6}
          transparent
          lineWidth={1}
        />
        {/* 投影点 */}
        <mesh position={end}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color={COLORS.PROJECTOR_LINE} />
        </mesh>
      </React.Fragment>
    );
  };
  
  return (
    <group>
      {cornerPoints.map((p, i) => (
        <React.Fragment key={i}>
          {/* 到V面（主视图）的投影线 - Z方向 */}
          {createProjector(
            p,
            [p[0], p[1], -BOX_SIZE / 2 - explodeGap],
            `v-${i}`
          )}
          {/* 到H面（俯视图）的投影线 - Y方向 */}
          {createProjector(
            p,
            [p[0], -BOX_SIZE / 2 - explodeGap, p[2]],
            `h-${i}`
          )}
          {/* 到W面（左视图）的投影线 - X方向（正方向） */}
          {createProjector(
            p,
            [BOX_SIZE / 2 + explodeGap, p[1], p[2]],
            `w-${i}`
          )}
          {/* 到R面（右视图）的投影线 - X方向（负方向） */}
          {createProjector(
            p,
            [-BOX_SIZE / 2 - explodeGap, p[1], p[2]],
            `r-${i}`
          )}
        </React.Fragment>
      ))}
    </group>
  );
};

// 轴测投影视图组件
interface AxonometricViewProps {
  geometry: THREE.BufferGeometry;
  type: 'isometric' | 'dimetric' | 'cabinet';
  position: [number, number, number];
}

const AxonometricView: React.FC<AxonometricViewProps> = ({ geometry, type, position }) => {
  const BOX = 2; // 投影面距离原点的距离
  const SCALE = 0.6; // 物体缩放比例

  // 获取几何体的包围盒顶点用于投影线（已缩放）
  const cornerPoints = React.useMemo(() => {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box) return [];
    
    const { min, max } = box;
    return [
      [max.x * SCALE, max.y * SCALE, max.z * SCALE],
      [max.x * SCALE, max.y * SCALE, min.z * SCALE],
      [max.x * SCALE, min.y * SCALE, max.z * SCALE],
      [max.x * SCALE, min.y * SCALE, min.z * SCALE],
      [min.x * SCALE, max.y * SCALE, max.z * SCALE],
      [min.x * SCALE, max.y * SCALE, min.z * SCALE],
      [min.x * SCALE, min.y * SCALE, max.z * SCALE],
      [min.x * SCALE, min.y * SCALE, min.z * SCALE],
    ] as [number, number, number][];
  }, [geometry]);

  const labels: Record<string, string> = {
    isometric: '等轴测',
    dimetric: '二等轴测',
    cabinet: '斜二测'
  };

  return (
    <group position={position}>
      {/* 背景面板 */}
      <mesh position={[0, 0, -0.1]}>
        <planeGeometry args={[5, 5]} />
        <meshBasicMaterial color="#0f172a" transparent opacity={0.7} />
      </mesh>
      
      {/* 边框 */}
      <mesh position={[0, 0, -0.05]}>
        <planeGeometry args={[5.1, 5.1]} />
        <meshBasicMaterial color="#6366f1" transparent opacity={0.3} />
      </mesh>

      {/* 三个投影面及投影图 */}
      {/* XY平面 (主视图) - 后面 */}
      <group position={[0, 0, -BOX]}>
        <mesh>
          <planeGeometry args={[BOX * 2, BOX * 2]} />
          <meshBasicMaterial color="#fecaca" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
        {/* 主视图投影 - 压扁Z轴 */}
        <mesh geometry={geometry} scale={[SCALE, SCALE, 0.001]} position={[0, 0, 0.02]}>
          <meshBasicMaterial color="#1f2937" transparent opacity={0.1} />
          <Edges color="#1f2937" threshold={15} lineWidth={2} />
        </mesh>
      </group>
      
      {/* XZ平面 (俯视图) - 底面 */}
      <group position={[0, -BOX, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[BOX * 2, BOX * 2]} />
          <meshBasicMaterial color="#bae6fd" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
        {/* 俯视图投影 - 压扁Y轴 */}
        <mesh geometry={geometry} scale={[SCALE, 0.001, SCALE]} position={[0, 0.02, 0]}>
          <meshBasicMaterial color="#1f2937" transparent opacity={0.1} />
          <Edges color="#1f2937" threshold={15} lineWidth={2} />
        </mesh>
      </group>
      
      {/* YZ平面 (左视图) - 左侧 */}
      <group position={[-BOX, 0, 0]}>
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[BOX * 2, BOX * 2]} />
          <meshBasicMaterial color="#bbf7d0" transparent opacity={0.2} side={THREE.DoubleSide} />
        </mesh>
        {/* 左视图投影 - 压扁X轴 */}
        <mesh geometry={geometry} scale={[0.001, SCALE, SCALE]} position={[0.02, 0, 0]}>
          <meshBasicMaterial color="#1f2937" transparent opacity={0.1} />
          <Edges color="#1f2937" threshold={15} lineWidth={2} />
        </mesh>
      </group>
      
      {/* 轴测投影的物体 */}
      <mesh geometry={geometry} scale={SCALE}>
        <meshStandardMaterial 
          color={COLORS.OBJECT} 
          transparent 
          opacity={0.85}
          metalness={0.2}
          roughness={0.4}
        />
        <Edges color={COLORS.OBJECT_EDGE} threshold={15} />
      </mesh>

      {/* 投影线 - 从物体顶点到各投影面 */}
      {cornerPoints.map((p, i) => (
        <React.Fragment key={i}>
          {/* 到主视图面的投影线 (Z方向) */}
          <Line
            points={[p, [p[0], p[1], -BOX]]}
            color="#f87171"
            dashed
            dashSize={0.1}
            gapSize={0.05}
            opacity={0.4}
            transparent
            lineWidth={1}
          />
          <mesh position={[p[0], p[1], -BOX]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#f87171" />
          </mesh>
          
          {/* 到俯视图面的投影线 (Y方向) */}
          <Line
            points={[p, [p[0], -BOX, p[2]]]}
            color="#f87171"
            dashed
            dashSize={0.1}
            gapSize={0.05}
            opacity={0.4}
            transparent
            lineWidth={1}
          />
          <mesh position={[p[0], -BOX, p[2]]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#f87171" />
          </mesh>
          
          {/* 到左视图面的投影线 (X方向) */}
          <Line
            points={[p, [-BOX, p[1], p[2]]]}
            color="#f87171"
            dashed
            dashSize={0.1}
            gapSize={0.05}
            opacity={0.4}
            transparent
            lineWidth={1}
          />
          <mesh position={[-BOX, p[1], p[2]]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshBasicMaterial color="#f87171" />
          </mesh>
        </React.Fragment>
      ))}
      
      {/* 坐标轴指示 */}
      <group position={[-BOX, -BOX, -BOX]} scale={0.4}>
        <mesh position={[0.5, 0, 0]}>
          <boxGeometry args={[1, 0.04, 0.04]} />
          <meshBasicMaterial color="#ef4444" />
        </mesh>
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.04, 1, 0.04]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        <mesh position={[0, 0, 0.5]}>
          <boxGeometry args={[0.04, 0.04, 1]} />
          <meshBasicMaterial color="#3b82f6" />
        </mesh>
      </group>
      
      {/* 标签 */}
      <PlaneLabel 
        text={labels[type]} 
        position={[0, 2.8, 0]} 
        color="#a5b4fc"
      />
    </group>
  );
};

// 创建绘制几何体
const createDrawnGeometry = (points: [number, number][], depth: number): THREE.BufferGeometry | null => {
  if (points.length < 3) return null;
  try {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, depth / 2, 0);
    return geo;
  } catch {
    return null;
  }
};

export const GlassBoxScene: React.FC<GlassBoxSceneProps> = ({ 
    geometryType, 
    geometryParams, 
    isUnfolded, 
    showObject, 
    showProjectors,
    useOrthographic,
    showAxonometric = false,
    axonometricType = 'isometric',
    drawCompleted = false,
    drawnPoints = [],
    drawnDepth = 2,
    onDrawComplete,
    showSectionPlane = false,
    sectionPlanePosition = [0, 0, 0],
    sectionPlaneRotation = [0, 0, 0],
    onSectionChange
}) => {
  const [sectionResult, setSectionResult] = React.useState<SectionResult | null>(null);
  
  const handleSectionChange = useCallback((result: SectionResult | null) => {
    setSectionResult(result);
    onSectionChange?.(result);
  }, [onSectionChange]);
  const BOX_SIZE = 5;
  const EXPLODE_GAP = 1.5;
  
  // 根据类型选择几何体
  const standardGeometry = useGeometryFactory(geometryType, geometryParams);
  const isCustom = geometryType === GeometryType.CUSTOM && geometryParams.customModelUrl;
  const isDraw = geometryType === GeometryType.DRAW;
  const isDrawCompleted = isDraw && drawCompleted && drawnPoints.length >= 3;
  
  // 绘制完成后的几何体
  const drawnGeometry = React.useMemo(() => {
    if (isDrawCompleted) {
      return createDrawnGeometry(drawnPoints, drawnDepth);
    }
    return null;
  }, [isDrawCompleted, drawnPoints, drawnDepth]);
  
  // 选择使用的几何体
  const geometry = isDrawCompleted && drawnGeometry ? drawnGeometry : standardGeometry;

  // 动画 refs
  const hPlaneRef = useRef<THREE.Group>(null);
  const wPlaneRef = useRef<THREE.Group>(null);
  const rPlaneRef = useRef<THREE.Group>(null);
  const vPlaneRef = useRef<THREE.Group>(null);
  
  useFrame((_, delta) => {
    if (!hPlaneRef.current || !wPlaneRef.current || !rPlaneRef.current || !vPlaneRef.current) return;

    const speed = 4;
    
    // 旋转目标
    const targetRotX_H = isUnfolded ? Math.PI / 2 : 0;
    const targetRotY_W = isUnfolded ? Math.PI / 2 : 0;
    const targetRotY_R = isUnfolded ? -Math.PI / 2 : 0;
    
    // 位移目标 (折叠时炸开，展开时紧贴)
    const targetPosY_H = isUnfolded ? 0 : -EXPLODE_GAP;  // 折叠时H面向下炸开
    const targetPosX_W = isUnfolded ? 0 : EXPLODE_GAP;   // 折叠时W面向右炸开
    const targetPosX_R = isUnfolded ? 0 : -EXPLODE_GAP;  // 折叠时R面向左炸开
    const targetPosZ_V = isUnfolded ? 0 : -EXPLODE_GAP;  // 折叠时V面向后炸开

    // 旋转动画
    hPlaneRef.current.rotation.x = THREE.MathUtils.lerp(hPlaneRef.current.rotation.x, targetRotX_H, delta * speed);
    wPlaneRef.current.rotation.y = THREE.MathUtils.lerp(wPlaneRef.current.rotation.y, targetRotY_W, delta * speed);
    rPlaneRef.current.rotation.y = THREE.MathUtils.lerp(rPlaneRef.current.rotation.y, targetRotY_R, delta * speed);
    
    // 位移动画 (炸开效果 - 折叠时生效)
    hPlaneRef.current.position.y = THREE.MathUtils.lerp(hPlaneRef.current.position.y, -BOX_SIZE / 2 + targetPosY_H, delta * speed);
    wPlaneRef.current.position.x = THREE.MathUtils.lerp(wPlaneRef.current.position.x, BOX_SIZE / 2 + targetPosX_W, delta * speed);
    rPlaneRef.current.position.x = THREE.MathUtils.lerp(rPlaneRef.current.position.x, -BOX_SIZE / 2 + targetPosX_R, delta * speed);
    vPlaneRef.current.position.z = THREE.MathUtils.lerp(vPlaneRef.current.position.z, -BOX_SIZE / 2 + targetPosZ_V, delta * speed);
  });

  return (
    <>
      {/* 相机设置 */}
      {useOrthographic ? (
        <OrthographicCamera 
            makeDefault 
            position={[0, 0, 30]} 
            zoom={isUnfolded ? 28 : 35} 
            near={-100} 
            far={200}
        />
      ) : (
        <PerspectiveCamera 
            makeDefault 
            position={[10, 8, 12]} 
            fov={40} 
        />
      )}

      <OrbitControls 
        enablePan={true} 
        enableZoom={true} 
        minDistance={5} 
        maxDistance={80}
        target={[0, -1, 0]}
        enableDamping
        dampingFactor={0.05}
      />
      
      {/* 光照 */}
      <ambientLight intensity={0.7} color="#f8fafc" />
      <directionalLight position={[10, 15, 10]} intensity={0.8} color="#ffffff" castShadow />
      <directionalLight position={[-5, 5, -5]} intensity={0.3} color="#e0f2fe" />
      
      {/* 背景色 */}
      <color attach="background" args={['#1e293b']} />

      {/* 绘制模式（未完成时显示绘制界面） */}
      {isDraw && !drawCompleted && (
        <SketchBuilder 
          onComplete={onDrawComplete}
          initialPoints={drawnPoints}
          initialDepth={drawnDepth}
        />
      )}

      {/* 主体物体 */}
      {showObject && (!isDraw || isDrawCompleted) && (
        <group position={[0, 0, 0]}>
          {isCustom ? (
            <Suspense fallback={null}>
              <CustomModelObject 
                url={geometryParams.customModelUrl!} 
                scale={geometryParams.customModelScale || 1} 
              />
            </Suspense>
          ) : isDrawCompleted && drawnGeometry ? (
            <mesh geometry={drawnGeometry}>
              <meshStandardMaterial 
                color={COLORS.OBJECT}
                metalness={0.2}
                roughness={0.4}
              />
              <Edges color={COLORS.OBJECT_EDGE} threshold={15} />
            </mesh>
          ) : (
            <MainObject type={geometryType} params={geometryParams} />
          )}
          {showProjectors && !isUnfolded && !isCustom && !isDrawCompleted && (
              <ProjectorRays params={geometryParams} geometryType={geometryType} explodeGap={EXPLODE_GAP} />
          )}
          {showProjectors && !isUnfolded && isCustom && geometryParams.customModelUrl && (
            <Suspense fallback={null}>
              <CustomModelProjectorRays
                url={geometryParams.customModelUrl}
                scale={geometryParams.customModelScale || 1}
                explodeGap={EXPLODE_GAP}
              />
            </Suspense>
          )}
          
          {/* 截平面 - 标准几何体 */}
          {showSectionPlane && !isCustom && (
            <SectionPlane
              geometry={geometry}
              enabled={showSectionPlane}
              planePosition={sectionPlanePosition}
              planeRotation={sectionPlaneRotation}
              planeSize={4}
              onSectionChange={handleSectionChange}
            />
          )}
          
          {/* 截平面 - 自定义模型 */}
          {showSectionPlane && isCustom && geometryParams.customModelUrl && (
            <Suspense fallback={null}>
              <CustomModelSectionPlane
                url={geometryParams.customModelUrl}
                scale={geometryParams.customModelScale || 1}
                enabled={showSectionPlane}
                planePosition={sectionPlanePosition}
                planeRotation={sectionPlaneRotation}
                planeSize={4}
                onSectionChange={handleSectionChange}
              />
            </Suspense>
          )}
        </group>
      )}

      {/* 轴测投影视图 - 放在右上方避免遮挡 */}
      {showAxonometric && (!isDraw || isDrawCompleted) && (
        <AxonometricView 
          geometry={geometry} 
          type={axonometricType}
          position={[9, 3, 3]}
        />
      )}

      {/* V面 (主视图 - 后墙，固定位置) */}
      {(!isDraw || isDrawCompleted) && <group ref={vPlaneRef} position={[0, 0, -BOX_SIZE / 2]}>
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[BOX_SIZE, BOX_SIZE]} />
          <meshBasicMaterial color={COLORS.PLANE_V} transparent opacity={0.4} side={THREE.DoubleSide} />
          <Edges color={COLORS.PLANE_BORDER} />
        </mesh>
        <PlaneLabel text="V (主视图)" position={[0, BOX_SIZE / 2 + 0.3, 0.1]} />
        {!isCustom && <ProjectedView type={geometryType} params={geometryParams} plane="V" />}
        {isCustom && geometryParams.customModelUrl && (
          <Suspense fallback={null}>
            <CustomModelProjection 
              url={geometryParams.customModelUrl} 
              scale={geometryParams.customModelScale || 1} 
              plane="V" 
            />
          </Suspense>
        )}
        {showSectionPlane && sectionResult && (
          <SectionLine2D sectionResult={sectionResult} plane="V" />
        )}
      </group>}

      {/* H面 (俯视图 - 底面，展开时向下炸开) */}
      {(!isDraw || isDrawCompleted) && <group ref={hPlaneRef} position={[0, -BOX_SIZE / 2, -BOX_SIZE / 2]}>
          <group rotation={[-Math.PI / 2, 0, 0]}>
             <group position={[0, -BOX_SIZE / 2, 0]}> 
                <mesh receiveShadow>
                  <planeGeometry args={[BOX_SIZE, BOX_SIZE]} />
                  <meshBasicMaterial color={COLORS.PLANE_H} transparent opacity={0.4} side={THREE.DoubleSide} />
                  <Edges color={COLORS.PLANE_BORDER} />
                </mesh>
                <PlaneLabel text="H (俯视图)" position={[0, -BOX_SIZE / 2 + 0.3, 0.1]} />
                
                {!isCustom && <ProjectedView type={geometryType} params={geometryParams} plane="H" />}
                {isCustom && geometryParams.customModelUrl && (
                  <Suspense fallback={null}>
                    <CustomModelProjection 
                      url={geometryParams.customModelUrl} 
                      scale={geometryParams.customModelScale || 1} 
                      plane="H" 
                    />
                  </Suspense>
                )}
                {showSectionPlane && sectionResult && (
                  <SectionLine2D sectionResult={sectionResult} plane="H" />
                )}
             </group>
          </group>
      </group>}

      {/* W面 (左视图 - 展开时向右炸开) */}
      {(!isDraw || isDrawCompleted) && <group ref={wPlaneRef} position={[BOX_SIZE / 2, 0, -BOX_SIZE / 2]}>
          <group rotation={[0, -Math.PI / 2, 0]}>
            <group position={[BOX_SIZE / 2, 0, 0]}> 
              <mesh receiveShadow>
                <planeGeometry args={[BOX_SIZE, BOX_SIZE]} />
                <meshBasicMaterial color={COLORS.PLANE_W} transparent opacity={0.4} side={THREE.DoubleSide} />
                <Edges color={COLORS.PLANE_BORDER} />
              </mesh>
              <PlaneLabel text="W (左视图)" position={[0, BOX_SIZE / 2 + 0.3, 0.1]} />

              {!isCustom && <ProjectedView type={geometryType} params={geometryParams} plane="W" />}
              {isCustom && geometryParams.customModelUrl && (
                <Suspense fallback={null}>
                  <CustomModelProjection 
                    url={geometryParams.customModelUrl} 
                    scale={geometryParams.customModelScale || 1} 
                    plane="W" 
                  />
                </Suspense>
              )}
              {showSectionPlane && sectionResult && (
                <SectionLine2D sectionResult={sectionResult} plane="W" />
              )}
            </group>
          </group>
      </group>}

      {/* R面 (右视图 - 展开时向左炸开) */}
      {(!isDraw || isDrawCompleted) && <group ref={rPlaneRef} position={[-BOX_SIZE / 2, 0, -BOX_SIZE / 2]}>
          <group rotation={[0, Math.PI / 2, 0]}>
             <group position={[-BOX_SIZE / 2, 0, 0]}>
                <mesh receiveShadow>
                  <planeGeometry args={[BOX_SIZE, BOX_SIZE]} />
                  <meshBasicMaterial color={COLORS.PLANE_R} transparent opacity={0.4} side={THREE.DoubleSide} />
                  <Edges color={COLORS.PLANE_BORDER} />
                </mesh>
                <PlaneLabel text="R (右视图)" position={[0, BOX_SIZE / 2 + 0.3, 0.1]} />

                {!isCustom && <ProjectedView type={geometryType} params={geometryParams} plane="R" />}
                {isCustom && geometryParams.customModelUrl && (
                  <Suspense fallback={null}>
                    <CustomModelProjection 
                      url={geometryParams.customModelUrl} 
                      scale={geometryParams.customModelScale || 1} 
                      plane="R" 
                    />
                  </Suspense>
                )}
                {showSectionPlane && sectionResult && (
                  <SectionLine2D sectionResult={sectionResult} plane="R" />
                )}
             </group>
          </group>
      </group>}

      {/* 展开时显示网格背景 */}
      {isUnfolded && (
        <Grid 
          args={[40, 40]} 
          sectionSize={5} 
          cellSize={1}
          cellColor="#475569" 
          sectionColor="#64748b" 
          position={[0, -BOX_SIZE/2 - EXPLODE_GAP - BOX_SIZE - 0.05, -BOX_SIZE/2]} 
          rotation={[Math.PI/2, 0, 0]}
          fadeDistance={50}
        />
      )}

      {/* 坐标轴辅助线（折叠状态下显示，绘制模式除外） */}
      {!isUnfolded && (!isDraw || isDrawCompleted) && (
        <group position={[-BOX_SIZE/2 - 0.5, -BOX_SIZE/2 - 0.5, -BOX_SIZE/2 - 0.5]}>
          <mesh position={[0.75, 0, 0]}>
            <boxGeometry args={[1.5, 0.03, 0.03]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, 0.75, 0]}>
            <boxGeometry args={[0.03, 1.5, 0.03]} />
            <meshBasicMaterial color="#22c55e" />
          </mesh>
          <mesh position={[0, 0, 0.75]}>
            <boxGeometry args={[0.03, 0.03, 1.5]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
        </group>
      )}
    </>
  );
};
