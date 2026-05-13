import React, { useMemo } from 'react';
import { useHighlightStore } from './store';
import { featureMapRegistry } from './featureMaps';
import type {
  FeatureDescriptor,
  VertexGeometry,
  FaceGeometry,
  ProjectionPlane,
} from './types';
import { worldToPlane, faceRectInPlane } from './types';
import type { GeometryType, GeometryParams } from '../../types';

interface HighlightLayerProps {
  geometryType: GeometryType;
  params: GeometryParams;
  // 画在哪个视图上：'3d' 表示主体，其他是投影平面
  plane: ProjectionPlane;
  // 投影平面的 z-offset（沿 local z），避免与现有投影线 z-fighting
  localZOffset?: number;
}

const HIGHLIGHT_COLOR = '#facc15'; // amber-400，和现有紫色物体对比明显
const VERTEX_RADIUS_3D = 0.09;
const VERTEX_RADIUS_2D = 0.08;
const HOVER_AREA_PADDING = 0.02;

// 3D 视图的 hover 层：顶点 = 球、面 = 透明矩形贴在表面
const Vertex3D: React.FC<{ f: FeatureDescriptor; highlighted: boolean }> = ({
  f,
  highlighted,
}) => {
  const setHovered = useHighlightStore((s) => s.setHovered);
  const enabled = useHighlightStore((s) => s.enabled);
  if (f.geometry.kind !== 'vertex') return null;
  const [x, y, z] = (f.geometry as VertexGeometry).position;
  return (
    <mesh
      position={[x, y, z]}
      onPointerOver={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        setHovered(f.id);
      }}
      onPointerOut={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        setHovered(null);
      }}
    >
      <sphereGeometry args={[VERTEX_RADIUS_3D, 16, 16]} />
      <meshBasicMaterial
        color={HIGHLIGHT_COLOR}
        transparent
        opacity={highlighted ? 1 : 0.0}
        depthTest={false}
      />
    </mesh>
  );
};

const Face3D: React.FC<{ f: FeatureDescriptor; highlighted: boolean }> = ({
  f,
  highlighted,
}) => {
  const setHovered = useHighlightStore((s) => s.setHovered);
  const enabled = useHighlightStore((s) => s.enabled);
  if (f.geometry.kind !== 'face') return null;
  const face = f.geometry as FaceGeometry;
  const [cx, cy, cz] = face.center;

  // 根据法向决定旋转
  let rotation: [number, number, number] = [0, 0, 0];
  if (face.normal === 'X') rotation = [0, Math.PI / 2, 0];
  else if (face.normal === 'Y') rotation = [-Math.PI / 2, 0, 0];
  // Z: default

  // 推离表面一点避免 z-fighting
  const push = 0.01;
  let position: [number, number, number] = [cx, cy, cz];
  if (face.normal === 'X') position = [cx + Math.sign(cx || 1) * push, cy, cz];
  else if (face.normal === 'Y')
    position = [cx, cy + Math.sign(cy || 1) * push, cz];
  else position = [cx, cy, cz + Math.sign(cz || 1) * push];

  return (
    <mesh
      position={position}
      rotation={rotation}
      onPointerOver={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        setHovered(f.id);
      }}
      onPointerOut={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        setHovered(null);
      }}
    >
      <planeGeometry args={[face.w, face.h]} />
      <meshBasicMaterial
        color={HIGHLIGHT_COLOR}
        transparent
        opacity={highlighted ? 0.5 : 0.0}
        depthWrite={false}
        side={2 /* THREE.DoubleSide */}
      />
    </mesh>
  );
};

// 2D 投影视图的 hover 层：在 local z = 0 平面上画
const Vertex2D: React.FC<{
  f: FeatureDescriptor;
  plane: 'V' | 'H' | 'W' | 'R';
  localZOffset: number;
  highlighted: boolean;
}> = ({ f, plane, localZOffset, highlighted }) => {
  const setHovered = useHighlightStore((s) => s.setHovered);
  const enabled = useHighlightStore((s) => s.enabled);
  if (f.geometry.kind !== 'vertex') return null;
  const [lx, ly] = worldToPlane(plane, (f.geometry as VertexGeometry).position);
  return (
    <mesh
      position={[lx, ly, localZOffset]}
      onPointerOver={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        setHovered(f.id);
      }}
      onPointerOut={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        setHovered(null);
      }}
    >
      {/* 透明 hover 热区（稍大）+ 实心可视（较小） */}
      <circleGeometry args={[VERTEX_RADIUS_2D + HOVER_AREA_PADDING, 16]} />
      <meshBasicMaterial
        color={HIGHLIGHT_COLOR}
        transparent
        opacity={highlighted ? 0.9 : 0.0}
        depthTest={false}
      />
    </mesh>
  );
};

const Face2D: React.FC<{
  f: FeatureDescriptor;
  plane: 'V' | 'H' | 'W' | 'R';
  localZOffset: number;
  highlighted: boolean;
}> = ({ f, plane, localZOffset, highlighted }) => {
  const setHovered = useHighlightStore((s) => s.setHovered);
  const enabled = useHighlightStore((s) => s.enabled);
  if (f.geometry.kind !== 'face') return null;
  const face = f.geometry as FaceGeometry;
  const rect = faceRectInPlane(face, plane);
  if (!rect) return null;
  const [lx, ly] = worldToPlane(plane, face.center);
  return (
    <mesh
      position={[lx, ly, localZOffset]}
      onPointerOver={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        setHovered(f.id);
      }}
      onPointerOut={(e) => {
        if (!enabled) return;
        e.stopPropagation();
        setHovered(null);
      }}
    >
      <planeGeometry args={[rect.w, rect.h]} />
      <meshBasicMaterial
        color={HIGHLIGHT_COLOR}
        transparent
        opacity={highlighted ? 0.45 : 0.0}
        depthTest={false}
      />
    </mesh>
  );
};

export const HighlightLayer: React.FC<HighlightLayerProps> = ({
  geometryType,
  params,
  plane,
  localZOffset = 0.08,
}) => {
  const enabled = useHighlightStore((s) => s.enabled);
  const hoveredId = useHighlightStore((s) => s.hoveredId);

  const features = useMemo(() => {
    const map = featureMapRegistry[geometryType];
    if (!map) return [] as FeatureDescriptor[];
    return map({
      width: params.width,
      height: params.height,
      depth: params.depth,
      cutSize: params.cutSize,
    });
  }, [geometryType, params.width, params.height, params.depth, params.cutSize]);

  if (!enabled || features.length === 0) return null;

  const visible = features.filter((f) => f.presentIn.includes(plane));

  return (
    <group renderOrder={999}>
      {visible.map((f) => {
        const highlighted = hoveredId === f.id;
        if (plane === '3d') {
          if (f.primitive === 'vertex')
            return <Vertex3D key={f.id} f={f} highlighted={highlighted} />;
          if (f.primitive === 'face')
            return <Face3D key={f.id} f={f} highlighted={highlighted} />;
          return null;
        }
        if (f.primitive === 'vertex')
          return (
            <Vertex2D
              key={f.id}
              f={f}
              plane={plane}
              localZOffset={localZOffset}
              highlighted={highlighted}
            />
          );
        if (f.primitive === 'face')
          return (
            <Face2D
              key={f.id}
              f={f}
              plane={plane}
              localZOffset={localZOffset}
              highlighted={highlighted}
            />
          );
        return null;
      })}
    </group>
  );
};
