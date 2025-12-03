import React, { useRef, Suspense } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import { Grid, OrbitControls, PerspectiveCamera, OrthographicCamera, Edges, Line } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import { GeometryType, GeometryParams } from '../types';
import { MainObject, ProjectedView, COLORS, PlaneLabel, ProjectorRays, useGeometryFactory } from './SceneComponents';
import { SketchBuilder } from './SketchBuilder';

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
    onDrawComplete
}) => {
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
                
                <group rotation={[-Math.PI/2, 0, 0]} position={[0, 0, 0.05]}> 
                    <mesh scale={[1, 0.001, 1]} geometry={geometry}>
                       <Edges threshold={15} color="#1f2937" lineWidth={2} />
                       <meshBasicMaterial color="#1f2937" transparent opacity={0.08} />
                    </mesh>
                </group>
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

              <group rotation={[0, Math.PI/2, 0]} position={[0, 0, 0.05]}>
                 <mesh scale={[0.001, 1, 1]} geometry={geometry}>
                    <Edges threshold={15} color="#1f2937" lineWidth={2} />
                    <meshBasicMaterial color="#1f2937" transparent opacity={0.08} />
                 </mesh>
              </group>
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

                <group rotation={[0, -Math.PI/2, 0]} position={[0, 0, 0.05]}>
                   <mesh scale={[0.001, 1, 1]} geometry={geometry}>
                      <Edges threshold={15} color="#1f2937" lineWidth={2} />
                      <meshBasicMaterial color="#1f2937" transparent opacity={0.08} />
                   </mesh>
                </group>
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
