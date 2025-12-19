import React, { useState, useCallback, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';
import { Line, Html, Edges } from '@react-three/drei';
import { COLORS } from './SceneComponents';

interface Point2D {
  x: number;
  y: number;
}

interface Edge {
  start: Point2D;
  end: Point2D;
  id: string;
}

interface SketchBuilderProps {
  onGeometryChange?: (geometry: THREE.BufferGeometry | null) => void;
  onComplete?: (points: [number, number][], depth: number) => void;
  isCompleted?: boolean;
  initialPoints?: [number, number][];
  initialDepth?: number;
}

type DrawPlane = 'V' | 'H' | 'W'; // 主视图、俯视图、左视图
type Tool = 'line' | 'push' | 'eraser';
type SnapType = 'endpoint' | 'midpoint' | 'axis' | 'grid' | 'projection' | null;

interface SnapInfo {
  point: Point2D;
  type: SnapType;
}

const GRID_SIZE = 0.25;
const SNAP_DISTANCE = 0.15;
const BOX_SIZE = 5;

// 工具函数
const distance = (p1: Point2D, p2: Point2D): number => 
  Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const pointsEqual = (p1: Point2D, p2: Point2D, tolerance = 0.02): boolean => 
  distance(p1, p2) < tolerance;

const generateId = (): string => Math.random().toString(36).substr(2, 9);

const snapToGrid = (value: number): number => 
  Math.round(value / GRID_SIZE) * GRID_SIZE;

// 查找闭合多边形
const findClosedPolygon = (edges: Edge[]): Point2D[] | null => {
  if (edges.length < 3) return null;
  
  const adjacency = new Map<string, Point2D[]>();
  const pointKey = (p: Point2D) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
  
  edges.forEach(edge => {
    const startKey = pointKey(edge.start);
    const endKey = pointKey(edge.end);
    
    if (!adjacency.has(startKey)) adjacency.set(startKey, []);
    if (!adjacency.has(endKey)) adjacency.set(endKey, []);
    
    adjacency.get(startKey)!.push(edge.end);
    adjacency.get(endKey)!.push(edge.start);
  });
  
  // 简单DFS找环
  const visited = new Set<string>();
  const path: Point2D[] = [];
  
  const dfs = (current: Point2D, start: Point2D): boolean => {
    const key = pointKey(current);
    
    if (path.length >= 3 && pointsEqual(current, start)) {
      return true;
    }
    
    if (visited.has(key)) return false;
    visited.add(key);
    path.push(current);
    
    const neighbors = adjacency.get(key) || [];
    for (const neighbor of neighbors) {
      if (path.length > 1 && pointsEqual(neighbor, path[path.length - 2])) continue;
      if (dfs(neighbor, start)) return true;
    }
    
    path.pop();
    visited.delete(key);
    return false;
  };
  
  // 从第一个点开始找
  const firstPoint = edges[0].start;
  if (dfs(firstPoint, firstPoint) && path.length >= 3) {
    return [...path];
  }
  
  return null;
};

export const SketchBuilder: React.FC<SketchBuilderProps> = ({ 
  onComplete,
  isCompleted = false,
  initialPoints = [],
  initialDepth = 2
}) => {
  // 三个视图的边
  const [vEdges, setVEdges] = useState<Edge[]>([]); // 主视图 (XY)
  const [hEdges, setHEdges] = useState<Edge[]>([]); // 俯视图 (XZ)
  const [wEdges, setWEdges] = useState<Edge[]>([]); // 左视图 (ZY)
  
  const [activePlane, setActivePlane] = useState<DrawPlane>('H');
  const [tool, setTool] = useState<Tool>('line');
  const [drawingStart, setDrawingStart] = useState<Point2D | null>(null);
  const [currentPoint, setCurrentPoint] = useState<Point2D | null>(null);
  const [snapInfo, setSnapInfo] = useState<SnapInfo | null>(null);
  const [extrudeHeight, setExtrudeHeight] = useState(initialDepth);
  
  // 获取当前视图的边
  const getEdges = (plane: DrawPlane) => {
    switch (plane) {
      case 'V': return vEdges;
      case 'H': return hEdges;
      case 'W': return wEdges;
    }
  };
  
  const setEdges = (plane: DrawPlane, edges: Edge[]) => {
    switch (plane) {
      case 'V': setVEdges(edges); break;
      case 'H': setHEdges(edges); break;
      case 'W': setWEdges(edges); break;
    }
  };

  // 初始化
  useEffect(() => {
    if (initialPoints.length >= 3) {
      const initEdges: Edge[] = [];
      for (let i = 0; i < initialPoints.length; i++) {
        const start = { x: initialPoints[i][0], y: initialPoints[i][1] };
        const end = { x: initialPoints[(i + 1) % initialPoints.length][0], y: initialPoints[(i + 1) % initialPoints.length][1] };
        initEdges.push({ start, end, id: generateId() });
      }
      setHEdges(initEdges);
    }
  }, []);

  // 查找吸附点（包括投影对应点）
  const findSnapPoint = useCallback((rawPoint: Point2D, plane: DrawPlane): SnapInfo => {
    let bestSnap: SnapInfo = { 
      point: { x: snapToGrid(rawPoint.x), y: snapToGrid(rawPoint.y) }, 
      type: 'grid' 
    };
    let bestDistance = SNAP_DISTANCE;
    
    const edges = getEdges(plane);
    
    // 端点吸附
    edges.forEach(edge => {
      [edge.start, edge.end].forEach(pt => {
        const dist = distance(rawPoint, pt);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestSnap = { point: pt, type: 'endpoint' };
        }
      });
      
      // 中点吸附
      const mid = { x: (edge.start.x + edge.end.x) / 2, y: (edge.start.y + edge.end.y) / 2 };
      const distMid = distance(rawPoint, mid);
      if (distMid < bestDistance) {
        bestDistance = distMid;
        bestSnap = { point: mid, type: 'midpoint' };
      }
    });
    
    // 投影对应点吸附（从其他视图）
    const otherPlanes: DrawPlane[] = ['V', 'H', 'W'].filter(p => p !== plane) as DrawPlane[];
    otherPlanes.forEach(otherPlane => {
      const otherEdges = getEdges(otherPlane);
      otherEdges.forEach(edge => {
        [edge.start, edge.end].forEach(pt => {
          // 根据视图关系计算投影对应点
          let projPoint: Point2D | null = null;
          
          if (plane === 'H' && otherPlane === 'V') {
            // 俯视图中，X坐标对应主视图的X
            projPoint = { x: pt.x, y: rawPoint.y };
          } else if (plane === 'V' && otherPlane === 'H') {
            // 主视图中，X坐标对应俯视图的X
            projPoint = { x: pt.x, y: rawPoint.y };
          } else if (plane === 'H' && otherPlane === 'W') {
            // 俯视图中，Y坐标对应左视图的X（深度）
            projPoint = { x: rawPoint.x, y: pt.x };
          } else if (plane === 'W' && otherPlane === 'H') {
            // 左视图中，X坐标对应俯视图的Y（深度）
            projPoint = { x: pt.y, y: rawPoint.y };
          } else if (plane === 'V' && otherPlane === 'W') {
            // 主视图中，Y坐标对应左视图的Y
            projPoint = { x: rawPoint.x, y: pt.y };
          } else if (plane === 'W' && otherPlane === 'V') {
            // 左视图中，Y坐标对应主视图的Y
            projPoint = { x: rawPoint.x, y: pt.y };
          }
          
          if (projPoint) {
            const dist = distance(rawPoint, projPoint);
            if (dist < bestDistance) {
              bestDistance = dist;
              bestSnap = { point: projPoint, type: 'projection' };
            }
          }
        });
      });
    });
    
    // 轴线吸附
    if (drawingStart) {
      const dx = Math.abs(rawPoint.x - drawingStart.x);
      const dy = Math.abs(rawPoint.y - drawingStart.y);
      if (dx < SNAP_DISTANCE * 0.8 && dy > dx) {
        bestSnap = { point: { x: drawingStart.x, y: bestSnap.point.y }, type: 'axis' };
      } else if (dy < SNAP_DISTANCE * 0.8 && dx > dy) {
        bestSnap = { point: { x: bestSnap.point.x, y: drawingStart.y }, type: 'axis' };
      }
    }
    
    return bestSnap;
  }, [vEdges, hEdges, wEdges, drawingStart]);

  // 添加边
  const addEdge = useCallback((plane: DrawPlane, start: Point2D, end: Point2D) => {
    if (pointsEqual(start, end)) return;
    
    const edges = getEdges(plane);
    const exists = edges.some(e => 
      (pointsEqual(e.start, start) && pointsEqual(e.end, end)) ||
      (pointsEqual(e.start, end) && pointsEqual(e.end, start))
    );
    
    if (!exists) {
      setEdges(plane, [...edges, { start, end, id: generateId() }]);
    }
  }, [vEdges, hEdges, wEdges]);

  // 处理视图点击
  const handlePlaneClick = useCallback((plane: DrawPlane, localPoint: Point2D) => {
    if (tool !== 'line') return;
    
    setActivePlane(plane);
    const snapped = findSnapPoint(localPoint, plane);
    
    if (drawingStart && activePlane === plane) {
      addEdge(plane, drawingStart, snapped.point);
      setDrawingStart(snapped.point);
    } else {
      setDrawingStart(snapped.point);
    }
  }, [tool, drawingStart, activePlane, findSnapPoint, addEdge]);

  // 处理鼠标移动
  const handlePlaneMove = useCallback((plane: DrawPlane, localPoint: Point2D) => {
    if (activePlane !== plane && drawingStart) return;
    const snapped = findSnapPoint(localPoint, plane);
    setCurrentPoint(snapped.point);
    setSnapInfo(snapped);
  }, [activePlane, drawingStart, findSnapPoint]);

  // 双击结束绘制
  const handleDoubleClick = useCallback(() => {
    setDrawingStart(null);
  }, []);

  // 从俯视图生成几何体
  const geometry = useMemo(() => {
    const polygon = findClosedPolygon(hEdges);
    if (!polygon || polygon.length < 3 || extrudeHeight <= 0) return null;
    
    try {
      const shape = new THREE.Shape();
      shape.moveTo(polygon[0].x, polygon[0].y);
      for (let i = 1; i < polygon.length; i++) {
        shape.lineTo(polygon[i].x, polygon[i].y);
      }
      shape.closePath();
      
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: extrudeHeight,
        bevelEnabled: false,
      });
      geo.rotateX(-Math.PI / 2);
      geo.translate(0, extrudeHeight / 2, 0);
      return geo;
    } catch {
      return null;
    }
  }, [hEdges, extrudeHeight]);

  // 检测闭合状态
  const hPolygon = useMemo(() => findClosedPolygon(hEdges), [hEdges]);
  const isClosed = hPolygon !== null;

  // 清除
  const handleClear = useCallback(() => {
    setVEdges([]);
    setHEdges([]);
    setWEdges([]);
    setDrawingStart(null);
    setExtrudeHeight(2);
  }, []);

  // 撤销
  const handleUndo = useCallback(() => {
    const edges = getEdges(activePlane);
    if (edges.length > 0) {
      setEdges(activePlane, edges.slice(0, -1));
    }
  }, [activePlane, vEdges, hEdges, wEdges]);

  // 完成
  const handleComplete = useCallback(() => {
    if (hPolygon && onComplete) {
      const points: [number, number][] = hPolygon.map(p => [p.x, p.y]);
      onComplete(points, extrudeHeight);
    }
  }, [hPolygon, extrudeHeight, onComplete]);

  // 快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawingStart(null);
      else if (e.key === 'l' || e.key === 'L') setTool('line');
      else if (e.key === 'p' || e.key === 'P') setTool('push');
      else if ((e.ctrlKey || e.metaKey) && e.key === 'z') handleUndo();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo]);

  const getSnapColor = (type: SnapType): string => {
    switch (type) {
      case 'endpoint': return '#22c55e';
      case 'midpoint': return '#3b82f6';
      case 'axis': return '#ef4444';
      case 'projection': return '#f59e0b';
      default: return '#94a3b8';
    }
  };

  // 渲染单个视图的绘制层
  const renderDrawingPlane = (
    plane: DrawPlane, 
    position: [number, number, number], 
    rotation: [number, number, number],
    label: string,
    color: string
  ) => {
    const edges = getEdges(plane);
    const isActive = activePlane === plane;
    const size = BOX_SIZE * 0.9;
    
    // 转换3D事件到2D本地坐标
    const toLocal = (e: ThreeEvent<MouseEvent>): Point2D => {
      // 获取相对于平面的本地坐标
      const localPoint = e.point.clone();
      
      // 根据不同视图转换坐标
      if (plane === 'V') {
        return { x: localPoint.x, y: localPoint.y };
      } else if (plane === 'H') {
        return { x: localPoint.x, y: localPoint.z };
      } else {
        return { x: localPoint.z, y: localPoint.y };
      }
    };
    
    return (
      <group position={position}>
        {/* 绘制平面背景 */}
        <mesh
          rotation={rotation}
          onClick={(e) => { e.stopPropagation(); handlePlaneClick(plane, toLocal(e)); }}
          onPointerMove={(e) => handlePlaneMove(plane, toLocal(e))}
          onDoubleClick={handleDoubleClick}
        >
          <planeGeometry args={[size, size]} />
          <meshBasicMaterial 
            color={isActive ? color : '#1e293b'} 
            transparent 
            opacity={isActive ? 0.15 : 0.05} 
            side={THREE.DoubleSide}
          />
        </mesh>
        
        {/* 网格 */}
        <group rotation={rotation}>
          {/* 细网格 */}
          {Array.from({ length: 21 }).map((_, i) => {
            const pos = -2.5 + i * 0.25;
            return (
              <React.Fragment key={i}>
                <Line points={[[pos, -2.5, 0.001], [pos, 2.5, 0.001]]} color="#334155" lineWidth={0.5} transparent opacity={0.3} />
                <Line points={[[-2.5, pos, 0.001], [2.5, pos, 0.001]]} color="#334155" lineWidth={0.5} transparent opacity={0.3} />
              </React.Fragment>
            );
          })}
          {/* 粗网格 */}
          {Array.from({ length: 5 }).map((_, i) => {
            const pos = -2 + i;
            return (
              <React.Fragment key={`major-${i}`}>
                <Line points={[[pos, -2.5, 0.002], [pos, 2.5, 0.002]]} color="#475569" lineWidth={1} />
                <Line points={[[-2.5, pos, 0.002], [2.5, pos, 0.002]]} color="#475569" lineWidth={1} />
              </React.Fragment>
            );
          })}
        </group>

        {/* 已绘制的边 */}
        <group rotation={rotation}>
          {edges.map(edge => (
            <Line
              key={edge.id}
              points={[[edge.start.x, edge.start.y, 0.01], [edge.end.x, edge.end.y, 0.01]]}
              color={isClosed && plane === 'H' ? '#22c55e' : '#f8fafc'}
              lineWidth={2}
            />
          ))}
          
          {/* 端点 */}
          {edges.map(edge => (
            <React.Fragment key={`pts-${edge.id}`}>
              <mesh position={[edge.start.x, edge.start.y, 0.02]}>
                <circleGeometry args={[0.06, 16]} />
                <meshBasicMaterial color="#22c55e" />
              </mesh>
              <mesh position={[edge.end.x, edge.end.y, 0.02]}>
                <circleGeometry args={[0.06, 16]} />
                <meshBasicMaterial color="#22c55e" />
              </mesh>
            </React.Fragment>
          ))}
          
          {/* 正在绘制的线 */}
          {drawingStart && currentPoint && isActive && (
            <>
              <Line
                points={[[drawingStart.x, drawingStart.y, 0.01], [currentPoint.x, currentPoint.y, 0.01]]}
                color="#22d3ee"
                lineWidth={2}
                dashed
                dashSize={0.1}
                gapSize={0.05}
              />
              {/* 起点标记 */}
              <mesh position={[drawingStart.x, drawingStart.y, 0.025]}>
                <circleGeometry args={[0.08, 16]} />
                <meshBasicMaterial color="#f97316" />
              </mesh>
            </>
          )}
          
          {/* 吸附点指示器 */}
          {snapInfo && currentPoint && isActive && (
            <mesh position={[currentPoint.x, currentPoint.y, 0.03]}>
              <ringGeometry args={[0.08, 0.12, 16]} />
              <meshBasicMaterial color={getSnapColor(snapInfo.type)} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
        
        {/* 视图标签 */}
        <Html position={[0, size/2 + 0.3, 0]} center>
          <div className={`text-xs font-medium px-2 py-0.5 rounded ${isActive ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
            {label}
          </div>
        </Html>
      </group>
    );
  };

  // 如果已完成，只显示几何体
  if (isCompleted && geometry) {
    return (
      <mesh geometry={geometry}>
        <meshStandardMaterial color={COLORS.OBJECT} metalness={0.2} roughness={0.4} />
        <Edges color={COLORS.OBJECT_EDGE} threshold={15} />
      </mesh>
    );
  }

  return (
    <group>
      {/* 三个绘制视图 */}
      {renderDrawingPlane('V', [0, 0, -BOX_SIZE/2 - 0.1], [0, 0, 0], '主视图 V (点击绘制)', '#fecaca')}
      {renderDrawingPlane('H', [0, -BOX_SIZE/2 - 0.1, 0], [-Math.PI/2, 0, 0], '俯视图 H (点击绘制)', '#bae6fd')}
      {renderDrawingPlane('W', [BOX_SIZE/2 + 0.1, 0, 0], [0, Math.PI/2, 0], '左视图 W (点击绘制)', '#bbf7d0')}
      
      {/* 预览几何体 */}
      {geometry && (
        <mesh geometry={geometry}>
          <meshStandardMaterial 
            color={COLORS.OBJECT} 
            metalness={0.2} 
            roughness={0.4}
            transparent
            opacity={0.8}
          />
          <Edges color={COLORS.OBJECT_EDGE} threshold={15} />
        </mesh>
      )}

      {/* 控制面板 */}
      <Html position={[-6, 2.5, 0]} style={{ pointerEvents: 'auto' }}>
        <div className="bg-slate-900/95 backdrop-blur p-4 rounded-xl border border-slate-700 text-white text-xs w-52 space-y-3 shadow-2xl">
          <div className="font-semibold text-indigo-300 text-sm">
            ✏️ 三视图绘制建模
          </div>
          
          {/* 当前视图 */}
          <div className="flex gap-1">
            {(['V', 'H', 'W'] as DrawPlane[]).map(p => (
              <button
                key={p}
                onClick={() => { setActivePlane(p); setDrawingStart(null); }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] transition-all ${
                  activePlane === p 
                    ? p === 'V' ? 'bg-red-600/80' : p === 'H' ? 'bg-sky-600/80' : 'bg-green-600/80'
                    : 'bg-slate-800 hover:bg-slate-700'
                }`}
              >
                {p === 'V' ? '主视图' : p === 'H' ? '俯视图' : '左视图'}
              </button>
            ))}
          </div>

          {/* 工具 */}
          <div className="flex gap-1">
            <button
              onClick={() => setTool('line')}
              className={`flex-1 py-2 rounded-lg text-[11px] ${tool === 'line' ? 'bg-cyan-600' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              ✏️ 画线 (L)
            </button>
            <button
              onClick={() => setTool('push')}
              disabled={!isClosed}
              className={`flex-1 py-2 rounded-lg text-[11px] disabled:opacity-40 ${tool === 'push' ? 'bg-orange-600' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              📐 推拉 (P)
            </button>
          </div>

          {/* 状态 */}
          <div className="bg-slate-800/50 rounded-lg p-2 space-y-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400">俯视图线段</span>
              <span className="text-cyan-400">{hEdges.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">状态</span>
              <span className={isClosed ? 'text-green-400' : 'text-yellow-400'}>
                {isClosed ? '✓ 已闭合' : '未闭合'}
              </span>
            </div>
          </div>

          {/* 拉伸高度 */}
          {isClosed && (
            <div>
              <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                <span>拉伸高度</span>
                <span className="text-orange-400 font-mono">{extrudeHeight.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="4"
                step="0.1"
                value={extrudeHeight}
                onChange={(e) => setExtrudeHeight(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          )}

          {/* 吸附提示 */}
          {snapInfo && snapInfo.type !== 'grid' && (
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: getSnapColor(snapInfo.type) }} />
              <span className="text-slate-400">
                {snapInfo.type === 'endpoint' && '端点吸附'}
                {snapInfo.type === 'midpoint' && '中点吸附'}
                {snapInfo.type === 'axis' && '轴线吸附'}
                {snapInfo.type === 'projection' && '投影对应点'}
              </span>
            </div>
          )}

          {/* 操作按钮 */}
          <div className="flex gap-1">
            <button onClick={handleUndo} className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[11px]">
              ↩ 撤销
            </button>
            <button onClick={handleClear} className="flex-1 py-1.5 bg-red-900/50 hover:bg-red-900 text-red-300 rounded-lg text-[11px]">
              🗑 清除
            </button>
          </div>

          {/* 完成按钮 */}
          {isClosed && extrudeHeight > 0 && (
            <button
              onClick={handleComplete}
              className="w-full py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-lg text-sm font-medium shadow-lg"
            >
              ✓ 完成
            </button>
          )}

          {/* 提示 */}
          <div className="text-[10px] text-slate-500 border-t border-slate-700 pt-2 space-y-1">
            <div>💡 在<span className="text-sky-400">俯视图</span>绘制闭合轮廓</div>
            <div>💡 <span className="text-orange-400">黄色</span>吸附=投影对应点</div>
            <div>💡 双击或 Esc 结束当前线条</div>
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
    
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, depth / 2, 0);
    return geo;
  } catch {
    return null;
  }
};

export default SketchBuilder;
