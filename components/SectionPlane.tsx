import React, { useRef, useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import { 
  calculateMeshSection, 
  SectionResult,
  SectionLoop,
  projectSectionToView 
} from '../utils/sectionPlane';

interface SectionPlaneProps {
  geometry: THREE.BufferGeometry | null;
  enabled: boolean;
  planePosition?: [number, number, number];
  planeRotation?: [number, number, number];
  planeSize?: number;
  onSectionChange?: (result: SectionResult | null) => void;
}

/**
 * 截平面组件
 * 显示一个可交互的截平面，并计算与几何体的截交线
 */
export const SectionPlane: React.FC<SectionPlaneProps> = ({
  geometry,
  enabled,
  planePosition = [0, 0, 0],
  planeRotation = [0, 0, 0],
  planeSize = 3,
  onSectionChange
}) => {
  const planeRef = useRef<THREE.Mesh>(null);
  const [sectionResult, setSectionResult] = useState<SectionResult | null>(null);
  
  // 计算平面的法向量和位置
  const planeParams = useMemo(() => {
    const euler = new THREE.Euler(planeRotation[0], planeRotation[1], planeRotation[2]);
    const normal = new THREE.Vector3(0, 0, 1).applyEuler(euler);
    const position = new THREE.Vector3(...planePosition);
    return { normal, position };
  }, [planePosition, planeRotation]);
  
  // 当几何体或平面参数变化时，重新计算截交线
  useEffect(() => {
    if (!enabled || !geometry) {
      setSectionResult(null);
      onSectionChange?.(null);
      return;
    }
    
    const result = calculateMeshSection(
      geometry,
      planeParams.position,
      planeParams.normal
    );
    
    setSectionResult(result);
    onSectionChange?.(result);
  }, [geometry, planeParams, enabled, onSectionChange]);
  
  if (!enabled) return null;
  
  return (
    <group>
      {/* 截平面可视化 */}
      <mesh
        ref={planeRef}
        position={planePosition}
        rotation={planeRotation}
      >
        <planeGeometry args={[planeSize, planeSize]} />
        <meshBasicMaterial 
          color="#ff6b6b" 
          transparent 
          opacity={0.3} 
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      
      {/* 截平面边框 */}
      <group position={planePosition} rotation={planeRotation}>
        <Line
          points={[
            [-planeSize/2, -planeSize/2, 0],
            [planeSize/2, -planeSize/2, 0],
            [planeSize/2, planeSize/2, 0],
            [-planeSize/2, planeSize/2, 0],
            [-planeSize/2, -planeSize/2, 0]
          ]}
          color="#ff6b6b"
          lineWidth={2}
        />
      </group>
      
      {/* 截交线显示 - 支持多回路 */}
      {sectionResult && sectionResult.loops && sectionResult.loops.map((loop, idx) => (
        loop.points.length >= 3 && (
          <SectionLine key={idx} points={loop.points} closed={loop.isClosed} />
        )
      ))}
    </group>
  );
};

/**
 * 截交线组件
 */
interface SectionLineProps {
  points: THREE.Vector3[];
  closed?: boolean;
  color?: string;
  lineWidth?: number;
}

export const SectionLine: React.FC<SectionLineProps> = ({
  points,
  closed = true,
  color = '#ff0000',
  lineWidth = 3
}) => {
  const linePoints = useMemo(() => {
    const pts = points.map(p => [p.x, p.y, p.z] as [number, number, number]);
    if (closed && pts.length > 0) {
      pts.push(pts[0]); // 闭合
    }
    return pts;
  }, [points, closed]);
  
  if (linePoints.length < 2) return null;
  
  return (
    <Line
      points={linePoints}
      color={color}
      lineWidth={lineWidth}
    />
  );
};

/**
 * 截交线2D投影组件（用于在投影视图上显示）
 * 支持多个分离的回路
 */
interface SectionLine2DProps {
  sectionResult: SectionResult | null;
  plane: 'V' | 'H' | 'W' | 'R';
  offset?: number;
  color?: string;
}

export const SectionLine2D: React.FC<SectionLine2DProps> = ({
  sectionResult,
  plane,
  offset = 0.06,
  color = '#ff0000'
}) => {
  // 为每个回路生成2D投影点
  const loopLines = useMemo(() => {
    if (!sectionResult || !sectionResult.loops || sectionResult.loops.length === 0) {
      return [];
    }
    
    return sectionResult.loops.map(loop => {
      // 至少需要2个点才能画线
      if (loop.points.length < 2) return null;
      
      const points2D = projectSectionToView(loop.points, plane);
      const pts = points2D.map(([x, y]) => [x, y, 0] as [number, number, number]);
      
      if (loop.isClosed && pts.length > 2) {
        pts.push(pts[0]); // 闭合（只有3个点以上才闭合）
      }
      
      return pts;
    }).filter(pts => pts !== null && pts.length >= 2);
  }, [sectionResult, plane]);
  
  if (loopLines.length === 0) return null;
  
  return (
    <group position={[0, 0, offset]}>
      {loopLines.map((pts, idx) => (
        <Line
          key={idx}
          points={pts as [number, number, number][]}
          color={color}
          lineWidth={2}
        />
      ))}
    </group>
  );
};

/**
 * 截平面控制器组件
 * 提供UI控件来调整截平面的位置和角度
 */
interface SectionPlaneControlsProps {
  position: [number, number, number];
  rotation: [number, number, number];
  onPositionChange: (position: [number, number, number]) => void;
  onRotationChange: (rotation: [number, number, number]) => void;
}

export const SectionPlaneControls: React.FC<SectionPlaneControlsProps> = ({
  position,
  rotation,
  onPositionChange,
  onRotationChange
}) => {
  return (
    <div className="section-plane-controls">
      <h4>截平面控制</h4>
      
      <div className="control-group">
        <label>位置 Y:</label>
        <input
          type="range"
          min={-2}
          max={2}
          step={0.1}
          value={position[1]}
          onChange={(e) => onPositionChange([position[0], parseFloat(e.target.value), position[2]])}
        />
        <span>{position[1].toFixed(1)}</span>
      </div>
      
      <div className="control-group">
        <label>旋转 X:</label>
        <input
          type="range"
          min={-Math.PI / 2}
          max={Math.PI / 2}
          step={0.1}
          value={rotation[0]}
          onChange={(e) => onRotationChange([parseFloat(e.target.value), rotation[1], rotation[2]])}
        />
        <span>{(rotation[0] * 180 / Math.PI).toFixed(0)}°</span>
      </div>
      
      <div className="control-group">
        <label>旋转 Y:</label>
        <input
          type="range"
          min={-Math.PI / 2}
          max={Math.PI / 2}
          step={0.1}
          value={rotation[1]}
          onChange={(e) => onRotationChange([rotation[0], parseFloat(e.target.value), rotation[2]])}
        />
        <span>{(rotation[1] * 180 / Math.PI).toFixed(0)}°</span>
      </div>
    </div>
  );
};

export default SectionPlane;
