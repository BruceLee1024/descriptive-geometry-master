import React, { useEffect, useMemo, useRef } from 'react';
import { useLoader } from '@react-three/fiber';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Edges } from '@react-three/drei';
import * as THREE from 'three';
import { COLORS } from './SceneComponents';

interface CustomModelProps {
  url: string;
  scale?: number;
  showEdges?: boolean;
}

export const CustomModel: React.FC<CustomModelProps> = ({ url, scale = 1, showEdges = true }) => {
  const gltf = useLoader(GLTFLoader, url);
  const groupRef = useRef<THREE.Group>(null);

  // 计算模型的包围盒并居中、缩放
  const { scene, normalizedScale } = useMemo(() => {
    const clonedScene = gltf.scene.clone();
    
    // 计算包围盒
    const box = new THREE.Box3().setFromObject(clonedScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    // 将模型居中
    clonedScene.position.sub(center);
    
    // 计算归一化缩放（使最大边长为2）
    const maxDim = Math.max(size.x, size.y, size.z);
    const normalizedScale = maxDim > 0 ? 2 / maxDim : 1;
    
    // 设置材质
    clonedScene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: COLORS.OBJECT,
          metalness: 0.2,
          roughness: 0.4,
          transparent: true,
          opacity: 1,
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    
    return { scene: clonedScene, normalizedScale };
  }, [gltf]);

  return (
    <group ref={groupRef} scale={normalizedScale * scale}>
      <primitive object={scene} />
      {showEdges && <ModelEdges scene={scene} />}
    </group>
  );
};

// 为模型添加边缘线
const ModelEdges: React.FC<{ scene: THREE.Object3D }> = ({ scene }) => {
  const edges = useMemo(() => {
    const edgeElements: React.ReactElement[] = [];
    
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const edgeGeometry = new THREE.EdgesGeometry(child.geometry, 15);
        edgeElements.push(
          <lineSegments key={child.uuid} geometry={edgeGeometry}>
            <lineBasicMaterial color={COLORS.OBJECT_EDGE} />
          </lineSegments>
        );
      }
    });
    
    return edgeElements;
  }, [scene]);

  return <>{edges}</>;
};

// 获取自定义模型的合并几何体（用于投影）
export const useCustomModelGeometry = (url: string | undefined, scale: number = 1) => {
  const gltf = url ? useLoader(GLTFLoader, url) : null;
  
  return useMemo(() => {
    if (!gltf) return new THREE.BoxGeometry(1, 1, 1);
    
    const geometries: THREE.BufferGeometry[] = [];
    
    gltf.scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.geometry) {
        const clonedGeometry = child.geometry.clone();
        child.updateMatrixWorld();
        clonedGeometry.applyMatrix4(child.matrixWorld);
        geometries.push(clonedGeometry);
      }
    });
    
    if (geometries.length === 0) return new THREE.BoxGeometry(1, 1, 1);
    
    // 合并所有几何体
    const mergedGeometry = geometries.length === 1 
      ? geometries[0] 
      : mergeGeometries(geometries);
    
    // 居中和缩放
    mergedGeometry.computeBoundingBox();
    const box = mergedGeometry.boundingBox!;
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const normalizedScale = maxDim > 0 ? 2 / maxDim : 1;
    
    mergedGeometry.translate(-center.x, -center.y, -center.z);
    mergedGeometry.scale(normalizedScale * scale, normalizedScale * scale, normalizedScale * scale);
    
    return mergedGeometry;
  }, [gltf, scale]);
};

// 简单的几何体合并函数
function mergeGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = new THREE.BufferGeometry();
  
  let totalVertices = 0;
  let totalIndices = 0;
  
  geometries.forEach(geo => {
    totalVertices += geo.attributes.position.count;
    if (geo.index) totalIndices += geo.index.count;
  });
  
  const positions = new Float32Array(totalVertices * 3);
  let posOffset = 0;
  
  geometries.forEach(geo => {
    const pos = geo.attributes.position.array;
    positions.set(pos, posOffset);
    posOffset += pos.length;
  });
  
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.computeVertexNormals();
  
  return merged;
}

export default CustomModel;
