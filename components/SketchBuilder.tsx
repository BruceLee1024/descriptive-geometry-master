import React, { useState, useCallback, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Line, Html, Edges } from '@react-three/drei';
import { COLORS } from './SceneComponents';

interface SketchBuilderProps {
  onGeometryChange?: (geometry: THREE.BufferGeometry | null) => void;
  onComplete?: (points: [number, number][], depth: number) => void;
  isCompleted?: boolean;
  initialPoints?: [number, number][];
  initialDepth?: number;
}

type DrawMode = 'draw' | 'push' | 'edit';

export const SketchBuilder: React.FC<SketchBuilderProps> = ({ 
  onGeometryChange,
  onComplete,
  isCompleted = false,
  initialPoints = [],
  initialDepth = 2
}) => {
  const [mode, setMode] = useState<DrawMode>('draw');
  const [points, setPoints] = useState<[number, number][]>(initialPoints);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isClosed, setIsClosed] = useState(initialPoints.length >= 3);
  const [currentPoint, setCurrentPoint] = useState<[number, number] | null>(null);
  const [extrudeDepth, setExtrudeDepth] = useState(initialDepth);
  const [isPushing, setIsPushing] = useState(false);
  const [pushStartY, setPushStartY] = useState(0);
  const [selectedVertex, setSelectedVertex] = useState<number | null>(null);
  
  const meshRef = useRef<THREE.Mesh>(null);

  // 生成几何体
  const geometry = useMemo(() => {
    if (points.length < 3 || !isClosed) return null;
    
    try {
      const shape = new THREE.Shape();
      shape.moveTo(points[0][0], points[0][1]);
      for (let i = 1; i < points.length; i++) {
        shape.lineTo(points[i][0], points[i][1]);
      }
      shape.closePath();
      
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: extrudeDepth,
        bevelEnabled: false,
      });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, extrudeDepth / 2, 0);
      
      return geo;
    } catch (e) {
      console.error('Geometry creation error:', e);
      return null;
    }
  }, [points, extrudeDepth, isClosed]);

  // 通知父组件几何体变化
  React.useEffect(() => {
    onGeometryChange?.(geometry);
  }, [geometry, onGeometryChange]);

  // 处理绘制平面点击
  const handlePlaneClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (mode !== 'draw' || isClosed) return;
    e.stopPropagation();
    
    const point = e.point;
    const newPoint: [number, number] = [
      Math.round(point.x * 4) / 4,
      Math.round(point.z * 4) / 4
    ];
    
    // 检查是否点击了起点（闭合多边形）
    if (points.length >= 3) {
      const startPoint = points[0];
      const dist = Math.sqrt(
        Math.pow(newPoint[0] - startPoint[0], 2) + 
        Math.pow(newPoint[1] - startPoint[1], 2)
      );
      if (dist < 0.3) {
        setIsClosed(true);
        setIsDrawing(false);
        setCurrentPoint(null);
        setMode('push');
        return;
      }
    }
    
    setPoints(prev => [...prev, newPoint]);
    setIsDrawing(true);
  }, [mode, points, isClosed]);

  // 处理鼠标移动
  const handlePlaneMove = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (mode === 'draw' && isDrawing && !isClosed) {
      const point = e.point;
      setCurrentPoint([
        Math.round(point.x * 4) / 4,
        Math.round(point.z * 4) / 4
      ]);
    }
  }, [mode, isDrawing, isClosed]);

  // 处理推拉
  const handleMeshPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (mode !== 'push') return;
    e.stopPropagation();
    setIsPushing(true);
    setPushStartY(e.point.y);
  }, [mode]);

  const handleMeshPointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!isPushing || mode !== 'push') return;
    const deltaY = e.point.y - pushStartY;
    const newDepth = Math.max(0.1, extrudeDepth + deltaY * 0.5);
    setExtrudeDepth(newDepth);
    setPushStartY(e.point.y);
  }, [isPushing, mode, pushStartY, extrudeDepth]);

  const handleMeshPointerUp = useCallback(() => {
    setIsPushing(false);
  }, []);

  // 处理顶点编辑
  const handleVertexClick = useCallback((index: number, e: ThreeEvent<MouseEvent>) => {
    if (mode !== 'edit') return;
    e.stopPropagation();
    setSelectedVertex(selectedVertex === index ? null : index);
  }, [mode, selectedVertex]);

  // 清除绘制
  const handleClear = useCallback(() => {
    setPoints([]);
    setIsDrawing(false);
    setIsClosed(false);
    setCurrentPoint(null);
    setExtrudeDepth(2);
    setMode('draw');
    setSelectedVertex(null);
  }, []);

  // 预设形状：矩形
  const loadPresetRectangle = useCallback(() => {
    const w = 2.0;
    const h = 1.5;
    const rect: [number, number][] = [
      [-w / 2, -h / 2],
      [ w / 2, -h / 2],
      [ w / 2,  h / 2],
      [-w / 2,  h / 2],
    ];
    setPoints(rect);
    setIsClosed(true);
    setIsDrawing(false);
    setCurrentPoint(null);
    setMode('push');
  }, []);

  // 预设形状：圆（32 段近似）
  const loadPresetCircle = useCallback((segments = 32) => {
    const r = 1.0;
    const pts: [number, number][] = [];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2;
      pts.push([Math.round(Math.cos(a) * r * 4) / 4, Math.round(Math.sin(a) * r * 4) / 4]);
    }
    setPoints(pts);
    setIsClosed(true);
    setIsDrawing(false);
    setCurrentPoint(null);
    setMode('push');
  }, []);

  // 预设形状：正多边形
  const loadPresetPolygon = useCallback((sides: number) => {
    const r = 1.0;
    const pts: [number, number][] = [];
    for (let i = 0; i < sides; i++) {
      const a = (i / sides) * Math.PI * 2 + Math.PI / 2; // 顶点朝上
      pts.push([Math.round(Math.cos(a) * r * 4) / 4, Math.round(Math.sin(a) * r * 4) / 4]);
    }
    setPoints(pts);
    setIsClosed(true);
    setIsDrawing(false);
    setCurrentPoint(null);
    setMode('push');
  }, []);

  // 撤销
  const handleUndo = useCallback(() => {
    if (isClosed) {
      setIsClosed(false);
      setMode('draw');
    } else if (points.length > 0) {
      setPoints(prev => prev.slice(0, -1));
    }
  }, [points, isClosed]);

  // 完成并应用到三视图
  const handleComplete = useCallback(() => {
    if (geometry && onComplete) {
      onComplete(points, extrudeDepth);
    }
  }, [geometry, onComplete, points, extrudeDepth]);

  // 绘制线条
  const linePoints = useMemo(() => {
    if (points.length === 0) return [];
    const pts = points.map(p => new THREE.Vector3(p[0], 0.01, p[1]));
    if (currentPoint && isDrawing && !isClosed) {
      pts.push(new THREE.Vector3(currentPoint[0], 0.01, currentPoint[1]));
    }
    if (isClosed && points.length > 0) {
      pts.push(new THREE.Vector3(points[0][0], 0.01, points[0][1]));
    }
    return pts;
  }, [points, currentPoint, isDrawing, isClosed]);

  // 如果已完成，只显示几何体
  if (isCompleted && geometry) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial 
          color={COLORS.OBJECT}
          metalness={0.2}
          roughness={0.4}
        />
        <Edges color={COLORS.OBJECT_EDGE} threshold={15} />
      </mesh>
    );
  }

  return (
    <group>
      {/* 绘制平面 */}
      <mesh 
        rotation={[-Math.PI / 2, 0, 0]} 
        position={[0, 0, 0]}
        onClick={handlePlaneClick}
        onPointerMove={handlePlaneMove}
      >
        <planeGeometry args={[10, 10]} />
        <meshBasicMaterial 
          color="#334155" 
          transparent 
          opacity={0.3} 
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 网格线 */}
      <gridHelper args={[10, 20, '#475569', '#374151']} position={[0, 0.005, 0]} />

      {/* 绘制的线条 */}
      {linePoints.length >= 2 && (
        <Line
          points={linePoints}
          color={isClosed ? '#22c55e' : '#22d3ee'}
          lineWidth={3}
        />
      )}

      {/* 顶点标记 */}
      {points.map((p, i) => (
        <mesh 
          key={i} 
          position={[p[0], 0.02, p[1]]}
          onClick={(e) => handleVertexClick(i, e)}
        >
          <sphereGeometry args={[selectedVertex === i ? 0.12 : 0.08, 16, 16]} />
          <meshBasicMaterial color={
            i === 0 ? '#22c55e' : 
            selectedVertex === i ? '#f97316' : '#22d3ee'
          } />
        </mesh>
      ))}

      {/* 当前鼠标位置 */}
      {currentPoint && isDrawing && !isClosed && (
        <mesh position={[currentPoint[0], 0.02, currentPoint[1]]}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color="#f97316" />
        </mesh>
      )}

      {/* 生成的几何体 */}
      {geometry && (
        <mesh 
          ref={meshRef}
          geometry={geometry}
          onPointerDown={handleMeshPointerDown}
          onPointerMove={handleMeshPointerMove}
          onPointerUp={handleMeshPointerUp}
          onPointerLeave={handleMeshPointerUp}
        >
          <meshStandardMaterial 
            color={COLORS.OBJECT}
            metalness={0.2}
            roughness={0.4}
            transparent
            opacity={0.9}
          />
          <Edges color={COLORS.OBJECT_EDGE} threshold={15} />
        </mesh>
      )}

      {/* 控制面板 */}
      <Html position={[-5.5, 3, 0]} style={{ pointerEvents: 'auto' }}>
        <div className="bg-slate-800/95 backdrop-blur p-4 rounded-xl border border-slate-600 text-white text-xs w-52 space-y-3 shadow-xl">
          <div className="font-semibold text-indigo-300 text-sm flex items-center gap-2">
            ✏️ 绘制建模
            {isClosed && <span className="text-[10px] bg-green-600 px-1.5 py-0.5 rounded">已闭合</span>}
          </div>
          
          {/* 模式切换 */}
          <div className="flex gap-1">
            <button
              onClick={() => setMode('draw')}
              disabled={isClosed}
              className={`flex-1 py-1.5 rounded-lg transition-all text-[11px] ${
                mode === 'draw' 
                  ? 'bg-cyan-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40'
              }`}
            >
              绘制
            </button>
            <button
              onClick={() => setMode('push')}
              disabled={!isClosed}
              className={`flex-1 py-1.5 rounded-lg transition-all text-[11px] ${
                mode === 'push' 
                  ? 'bg-orange-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40'
              }`}
            >
              推拉
            </button>
            <button
              onClick={() => setMode('edit')}
              disabled={!isClosed}
              className={`flex-1 py-1.5 rounded-lg transition-all text-[11px] ${
                mode === 'edit' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600 disabled:opacity-40'
              }`}
            >
              编辑
            </button>
          </div>

          {/* 深度控制 */}
          {isClosed && (
            <div>
              <div className="flex justify-between text-slate-400 text-[10px] mb-1">
                <span>拉伸高度</span>
                <span className="text-orange-400 font-mono">{extrudeDepth.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={extrudeDepth}
                onChange={(e) => setExtrudeDepth(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-600 rounded appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          )}

          {/* 顶点数量 */}
          <div className="text-[10px] text-slate-400 flex justify-between">
            <span>顶点数量</span>
            <span className="text-cyan-400">{points.length}</span>
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-1">
            <button
              onClick={handleUndo}
              disabled={points.length === 0 && !isClosed}
              className="flex-1 py-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg text-[11px]"
            >
              撤销
            </button>
            <button
              onClick={handleClear}
              className="flex-1 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-300 rounded-lg text-[11px]"
            >
              清除
            </button>
          </div>

          {/* 预设形状：跳过手绘，直接载入常用轮廓 */}
          {!isClosed && points.length === 0 && (
            <div className="border-t border-slate-700 pt-2 space-y-1.5">
              <div className="text-[10px] text-slate-400 font-semibold">快速形状</div>
              <div className="grid grid-cols-3 gap-1">
                <button onClick={loadPresetRectangle} className="py-1.5 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 rounded text-[10px]">矩形</button>
                <button onClick={() => loadPresetCircle(32)} className="py-1.5 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 rounded text-[10px]">圆</button>
                <button onClick={() => loadPresetPolygon(3)} className="py-1.5 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 rounded text-[10px]">三角</button>
                <button onClick={() => loadPresetPolygon(5)} className="py-1.5 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 rounded text-[10px]">五边</button>
                <button onClick={() => loadPresetPolygon(6)} className="py-1.5 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 rounded text-[10px]">六边</button>
                <button onClick={() => loadPresetPolygon(8)} className="py-1.5 bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 rounded text-[10px]">八边</button>
              </div>
              <div className="text-[9px] text-slate-500">载入后可切换到推拉模式调整高度</div>
            </div>
          )}

          {/* 完成按钮 */}
          {isClosed && geometry && (
            <button
              onClick={handleComplete}
              className="w-full py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg"
            >
              ✓ 完成并查看三视图
            </button>
          )}

          {/* 提示 */}
          <div className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-700 pt-2">
            {!isClosed ? (
              <>💡 点击添加顶点，点击<span className="text-green-400">绿色起点</span>闭合图形</>
            ) : mode === 'push' ? (
              <>💡 拖拽模型或使用滑块调整高度</>
            ) : mode === 'edit' ? (
              <>💡 点击顶点进行选择（编辑功能开发中）</>
            ) : (
              <>💡 图形已闭合，可以推拉或完成</>
            )}
          </div>
        </div>
      </Html>
    </group>
  );
};

// 创建绘制几何体的工厂函数
export const createDrawnGeometry = (points: [number, number][], depth: number): THREE.BufferGeometry | null => {
  if (points.length < 3) return null;
  
  try {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i][0], points[i][1]);
    }
    shape.closePath();
    
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: depth,
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, depth / 2, 0);
    
    return geo;
  } catch {
    return null;
  }
};

export default SketchBuilder;
