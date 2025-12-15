import * as THREE from 'three';

/**
 * 截平面工具类
 * 用于计算截平面与立体表面的截交线
 */

// 截平面参数接口
export interface SectionPlaneParams {
  position: THREE.Vector3;  // 平面上的一点
  normal: THREE.Vector3;    // 平面法向量
}

// 单个回路接口
export interface SectionLoop {
  points: THREE.Vector3[];  // 回路上的点（有序）
  isClosed: boolean;        // 是否闭合
}

// 截交线结果接口
export interface SectionResult {
  points3D: THREE.Vector3[];           // 3D空间中的截交线点（有序）- 兼容旧接口
  loops: SectionLoop[];                // 所有回路（支持多个分离的回路）
  isClosed: boolean;                   // 是否闭合
  curveType?: 'polygon' | 'ellipse' | 'parabola' | 'hyperbola' | 'circle';
  // 对于椭圆等曲线，提供解析参数
  ellipseParams?: {
    center: THREE.Vector3;
    majorAxis: THREE.Vector3;
    minorAxis: THREE.Vector3;
    majorRadius: number;
    minorRadius: number;
  };
}

/**
 * 计算线段与平面的交点
 * @param lineStart 线段起点
 * @param lineEnd 线段终点
 * @param planePoint 平面上的一点
 * @param planeNormal 平面法向量
 * @returns 交点，如果不相交返回null
 */
export function lineIntersectsPlane(
  lineStart: THREE.Vector3,
  lineEnd: THREE.Vector3,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3
): THREE.Vector3 | null {
  const direction = new THREE.Vector3().subVectors(lineEnd, lineStart);
  const denominator = direction.dot(planeNormal);
  
  // 如果分母接近0，说明线段与平面平行
  if (Math.abs(denominator) < 1e-10) {
    return null;
  }
  
  const t = new THREE.Vector3().subVectors(planePoint, lineStart).dot(planeNormal) / denominator;
  
  // 检查t是否在[0, 1]范围内（交点在线段上）
  if (t < 0 || t > 1) {
    return null;
  }
  
  // 计算交点
  return new THREE.Vector3().addVectors(
    lineStart,
    direction.multiplyScalar(t)
  );
}

/**
 * 从BufferGeometry中提取所有边
 * @param geometry BufferGeometry
 * @returns 边的数组，每条边由两个顶点组成
 */
export function extractEdges(geometry: THREE.BufferGeometry): [THREE.Vector3, THREE.Vector3][] {
  const edges: [THREE.Vector3, THREE.Vector3][] = [];
  const edgeSet = new Set<string>();
  
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex();
  
  const addEdge = (v1: THREE.Vector3, v2: THREE.Vector3) => {
    // 创建唯一的边标识符（排序后的顶点坐标）
    const key1 = `${v1.x.toFixed(6)},${v1.y.toFixed(6)},${v1.z.toFixed(6)}`;
    const key2 = `${v2.x.toFixed(6)},${v2.y.toFixed(6)},${v2.z.toFixed(6)}`;
    const edgeKey = key1 < key2 ? `${key1}-${key2}` : `${key2}-${key1}`;
    
    if (!edgeSet.has(edgeKey)) {
      edgeSet.add(edgeKey);
      edges.push([v1.clone(), v2.clone()]);
    }
  };
  
  if (indices) {
    // 索引几何体
    for (let i = 0; i < indices.count; i += 3) {
      const a = indices.getX(i);
      const b = indices.getX(i + 1);
      const c = indices.getX(i + 2);
      
      const v1 = new THREE.Vector3().fromBufferAttribute(positions, a);
      const v2 = new THREE.Vector3().fromBufferAttribute(positions, b);
      const v3 = new THREE.Vector3().fromBufferAttribute(positions, c);
      
      addEdge(v1, v2);
      addEdge(v2, v3);
      addEdge(v3, v1);
    }
  } else {
    // 非索引几何体
    for (let i = 0; i < positions.count; i += 3) {
      const v1 = new THREE.Vector3().fromBufferAttribute(positions, i);
      const v2 = new THREE.Vector3().fromBufferAttribute(positions, i + 1);
      const v3 = new THREE.Vector3().fromBufferAttribute(positions, i + 2);
      
      addEdge(v1, v2);
      addEdge(v2, v3);
      addEdge(v3, v1);
    }
  }
  
  return edges;
}

/**
 * 计算点集的重心
 */
export function calculateCentroid(points: THREE.Vector3[]): THREE.Vector3 {
  const centroid = new THREE.Vector3();
  points.forEach(p => centroid.add(p));
  centroid.divideScalar(points.length);
  return centroid;
}

/**
 * 将3D点投影到平面上的2D坐标
 * @param point 3D点
 * @param planePoint 平面上的一点（作为原点）
 * @param planeNormal 平面法向量
 * @returns 2D坐标 [u, v]
 */
export function projectToPlane2D(
  point: THREE.Vector3,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3
): [number, number] {
  // 创建平面的局部坐标系
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(planeNormal.dot(up)) > 0.99) {
    up.set(1, 0, 0);
  }
  
  const uAxis = new THREE.Vector3().crossVectors(up, planeNormal).normalize();
  const vAxis = new THREE.Vector3().crossVectors(planeNormal, uAxis).normalize();
  
  const relative = new THREE.Vector3().subVectors(point, planePoint);
  
  return [relative.dot(uAxis), relative.dot(vAxis)];
}

/**
 * 按顺时针/逆时针顺序排列点
 * @param points 无序的点集
 * @param planeNormal 平面法向量（用于确定排序方向）
 * @returns 有序的点集
 */
export function sortPointsClockwise(
  points: THREE.Vector3[],
  planeNormal: THREE.Vector3
): THREE.Vector3[] {
  if (points.length < 3) return points;
  
  // 计算重心
  const centroid = calculateCentroid(points);
  
  // 创建平面的局部坐标系
  const up = new THREE.Vector3(0, 1, 0);
  if (Math.abs(planeNormal.dot(up)) > 0.99) {
    up.set(1, 0, 0);
  }
  
  const uAxis = new THREE.Vector3().crossVectors(up, planeNormal).normalize();
  const vAxis = new THREE.Vector3().crossVectors(planeNormal, uAxis).normalize();
  
  // 计算每个点相对于重心的角度
  const pointsWithAngles = points.map(p => {
    const relative = new THREE.Vector3().subVectors(p, centroid);
    const u = relative.dot(uAxis);
    const v = relative.dot(vAxis);
    const angle = Math.atan2(v, u);
    return { point: p, angle };
  });
  
  // 按角度排序
  pointsWithAngles.sort((a, b) => a.angle - b.angle);
  
  return pointsWithAngles.map(p => p.point);
}

/**
 * 计算网格与平面的截交线（通用网格切割法）
 * 使用三角形遍历法：遍历每个三角形，找到与平面相交的边，形成线段
 * @param geometry 几何体
 * @param planePoint 平面上的一点
 * @param planeNormal 平面法向量
 * @returns 截交线结果
 */
export function calculateMeshSection(
  geometry: THREE.BufferGeometry,
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3
): SectionResult {
  const positions = geometry.getAttribute('position');
  const indices = geometry.getIndex();
  
  // 存储截交线段（每个线段由两个点组成）
  const segments: [THREE.Vector3, THREE.Vector3][] = [];
  
  // 遍历每个三角形
  const processTriangle = (i1: number, i2: number, i3: number) => {
    const v1 = new THREE.Vector3().fromBufferAttribute(positions, i1);
    const v2 = new THREE.Vector3().fromBufferAttribute(positions, i2);
    const v3 = new THREE.Vector3().fromBufferAttribute(positions, i3);
    
    // 计算每个顶点到平面的有符号距离
    const d1 = new THREE.Vector3().subVectors(v1, planePoint).dot(planeNormal);
    const d2 = new THREE.Vector3().subVectors(v2, planePoint).dot(planeNormal);
    const d3 = new THREE.Vector3().subVectors(v3, planePoint).dot(planeNormal);
    
    // 找到与平面相交的边
    const intersections: THREE.Vector3[] = [];
    
    // 边 v1-v2
    if (d1 * d2 < 0) {
      const t = d1 / (d1 - d2);
      intersections.push(new THREE.Vector3().lerpVectors(v1, v2, t));
    } else if (Math.abs(d1) < 1e-10) {
      intersections.push(v1.clone());
    }
    
    // 边 v2-v3
    if (d2 * d3 < 0) {
      const t = d2 / (d2 - d3);
      intersections.push(new THREE.Vector3().lerpVectors(v2, v3, t));
    } else if (Math.abs(d2) < 1e-10 && intersections.length === 0) {
      intersections.push(v2.clone());
    }
    
    // 边 v3-v1
    if (d3 * d1 < 0) {
      const t = d3 / (d3 - d1);
      intersections.push(new THREE.Vector3().lerpVectors(v3, v1, t));
    } else if (Math.abs(d3) < 1e-10 && intersections.length < 2) {
      intersections.push(v3.clone());
    }
    
    // 如果有两个交点，形成一条线段
    if (intersections.length === 2) {
      segments.push([intersections[0], intersections[1]]);
    }
  };
  
  if (indices) {
    for (let i = 0; i < indices.count; i += 3) {
      processTriangle(indices.getX(i), indices.getX(i + 1), indices.getX(i + 2));
    }
  } else {
    for (let i = 0; i < positions.count; i += 3) {
      processTriangle(i, i + 1, i + 2);
    }
  }
  
  if (segments.length === 0) {
    return {
      points3D: [],
      loops: [],
      isClosed: false,
      curveType: 'polygon'
    };
  }
  
  // 将线段连接成多个有序的回路（支持分离回路）
  const loops = connectSegmentsToLoops(segments);
  
  // 兼容旧接口：合并所有回路的点
  const allPoints = loops.flatMap(loop => loop.points);
  
  return {
    points3D: allPoints,
    loops: loops,
    isClosed: loops.length > 0 && loops.every(l => l.isClosed),
    curveType: 'polygon'
  };
}

/**
 * 将线段连接成多个有序的回路（支持分离回路）
 * 使用邻接追踪法 + 多回路检测
 */
function connectSegmentsToLoops(segments: [THREE.Vector3, THREE.Vector3][]): SectionLoop[] {
  if (segments.length === 0) return [];
  
  const tolerance = 1e-4;
  
  // 首先去重：合并距离非常近的端点
  const deduplicatedSegments = deduplicateSegments(segments, tolerance);
  
  if (deduplicatedSegments.length === 0) return [];
  
  // 构建邻接表：每个端点连接到哪些线段
  const pointToSegments = new Map<string, number[]>();
  
  const pointKey = (p: THREE.Vector3): string => {
    return `${Math.round(p.x / tolerance)},${Math.round(p.y / tolerance)},${Math.round(p.z / tolerance)}`;
  };
  
  deduplicatedSegments.forEach((seg, idx) => {
    const key1 = pointKey(seg[0]);
    const key2 = pointKey(seg[1]);
    
    if (!pointToSegments.has(key1)) pointToSegments.set(key1, []);
    if (!pointToSegments.has(key2)) pointToSegments.set(key2, []);
    
    pointToSegments.get(key1)!.push(idx);
    pointToSegments.get(key2)!.push(idx);
  });
  
  const loops: SectionLoop[] = [];
  const usedSegments = new Set<number>();
  
  // 循环处理所有线段，直到全部用完
  while (usedSegments.size < deduplicatedSegments.length) {
    // 找到第一个未使用的线段
    let startIdx = -1;
    for (let i = 0; i < deduplicatedSegments.length; i++) {
      if (!usedSegments.has(i)) {
        startIdx = i;
        break;
      }
    }
    
    if (startIdx === -1) break;
    
    // 从这条线段开始追踪一个回路
    const loopPoints: THREE.Vector3[] = [];
    const startSeg = deduplicatedSegments[startIdx];
    loopPoints.push(startSeg[0].clone());
    loopPoints.push(startSeg[1].clone());
    usedSegments.add(startIdx);
    
    // 向后追踪
    let currentEndKey = pointKey(startSeg[1]);
    let found = true;
    
    while (found) {
      found = false;
      const connectedSegs = pointToSegments.get(currentEndKey) || [];
      
      for (const segIdx of connectedSegs) {
        if (usedSegments.has(segIdx)) continue;
        
        const seg = deduplicatedSegments[segIdx];
        const key1 = pointKey(seg[0]);
        const key2 = pointKey(seg[1]);
        
        if (key1 === currentEndKey) {
          loopPoints.push(seg[1].clone());
          currentEndKey = key2;
          usedSegments.add(segIdx);
          found = true;
          break;
        } else if (key2 === currentEndKey) {
          loopPoints.push(seg[0].clone());
          currentEndKey = key1;
          usedSegments.add(segIdx);
          found = true;
          break;
        }
      }
    }
    
    // 向前追踪（从起点开始）
    let currentStartKey = pointKey(startSeg[0]);
    found = true;
    
    while (found) {
      found = false;
      const connectedSegs = pointToSegments.get(currentStartKey) || [];
      
      for (const segIdx of connectedSegs) {
        if (usedSegments.has(segIdx)) continue;
        
        const seg = deduplicatedSegments[segIdx];
        const key1 = pointKey(seg[0]);
        const key2 = pointKey(seg[1]);
        
        if (key1 === currentStartKey) {
          loopPoints.unshift(seg[1].clone());
          currentStartKey = key2;
          usedSegments.add(segIdx);
          found = true;
          break;
        } else if (key2 === currentStartKey) {
          loopPoints.unshift(seg[0].clone());
          currentStartKey = key1;
          usedSegments.add(segIdx);
          found = true;
          break;
        }
      }
    }
    
    // 检查是否闭合
    const isClosed = loopPoints.length > 2 && 
      loopPoints[0].distanceTo(loopPoints[loopPoints.length - 1]) < tolerance;
    
    // 移除重复的首尾点（如果闭合）
    if (isClosed) {
      loopPoints.pop();
    }
    
    // 添加到回路列表
    if (loopPoints.length >= 3) {
      loops.push({
        points: loopPoints,
        isClosed: isClosed
      });
    }
  }
  
  return loops;
}

/**
 * 将线段连接成有序的点序列（旧接口，保留兼容性）
 * 使用邻接追踪法：从一条线段开始，找到共享端点的下一条线段
 */
function connectSegments(segments: [THREE.Vector3, THREE.Vector3][]): THREE.Vector3[] {
  if (segments.length === 0) return [];
  
  const tolerance = 1e-4;
  
  // 首先去重：合并距离非常近的端点
  const deduplicatedSegments = deduplicateSegments(segments, tolerance);
  
  if (deduplicatedSegments.length === 0) return [];
  
  // 构建邻接表：每个端点连接到哪些线段
  const pointToSegments = new Map<string, number[]>();
  
  const pointKey = (p: THREE.Vector3): string => {
    return `${Math.round(p.x / tolerance)},${Math.round(p.y / tolerance)},${Math.round(p.z / tolerance)}`;
  };
  
  deduplicatedSegments.forEach((seg, idx) => {
    const key1 = pointKey(seg[0]);
    const key2 = pointKey(seg[1]);
    
    if (!pointToSegments.has(key1)) pointToSegments.set(key1, []);
    if (!pointToSegments.has(key2)) pointToSegments.set(key2, []);
    
    pointToSegments.get(key1)!.push(idx);
    pointToSegments.get(key2)!.push(idx);
  });
  
  // 邻接追踪：从第一条线段开始，顺藤摸瓜
  const result: THREE.Vector3[] = [];
  const usedSegments = new Set<number>();
  
  // 从第一条线段开始
  let currentSegIdx = 0;
  let currentSeg = deduplicatedSegments[currentSegIdx];
  result.push(currentSeg[0].clone());
  result.push(currentSeg[1].clone());
  usedSegments.add(currentSegIdx);
  
  // 向后追踪
  let currentEndKey = pointKey(currentSeg[1]);
  let found = true;
  
  while (found) {
    found = false;
    const connectedSegs = pointToSegments.get(currentEndKey) || [];
    
    for (const segIdx of connectedSegs) {
      if (usedSegments.has(segIdx)) continue;
      
      const seg = deduplicatedSegments[segIdx];
      const key1 = pointKey(seg[0]);
      const key2 = pointKey(seg[1]);
      
      if (key1 === currentEndKey) {
        result.push(seg[1].clone());
        currentEndKey = key2;
        usedSegments.add(segIdx);
        found = true;
        break;
      } else if (key2 === currentEndKey) {
        result.push(seg[0].clone());
        currentEndKey = key1;
        usedSegments.add(segIdx);
        found = true;
        break;
      }
    }
  }
  
  // 向前追踪（从起点开始）
  let currentStartKey = pointKey(deduplicatedSegments[0][0]);
  found = true;
  
  while (found) {
    found = false;
    const connectedSegs = pointToSegments.get(currentStartKey) || [];
    
    for (const segIdx of connectedSegs) {
      if (usedSegments.has(segIdx)) continue;
      
      const seg = deduplicatedSegments[segIdx];
      const key1 = pointKey(seg[0]);
      const key2 = pointKey(seg[1]);
      
      if (key1 === currentStartKey) {
        result.unshift(seg[1].clone());
        currentStartKey = key2;
        usedSegments.add(segIdx);
        found = true;
        break;
      } else if (key2 === currentStartKey) {
        result.unshift(seg[0].clone());
        currentStartKey = key1;
        usedSegments.add(segIdx);
        found = true;
        break;
      }
    }
  }
  
  // 移除重复的首尾点（如果闭合）
  if (result.length > 2 && result[0].distanceTo(result[result.length - 1]) < tolerance) {
    result.pop();
  }
  
  return result;
}

/**
 * 去重线段端点
 */
function deduplicateSegments(
  segments: [THREE.Vector3, THREE.Vector3][],
  tolerance: number
): [THREE.Vector3, THREE.Vector3][] {
  // 收集所有唯一点
  const uniquePoints: THREE.Vector3[] = [];
  
  const findOrAddPoint = (p: THREE.Vector3): THREE.Vector3 => {
    for (const up of uniquePoints) {
      if (up.distanceTo(p) < tolerance) {
        return up;
      }
    }
    const newPoint = p.clone();
    uniquePoints.push(newPoint);
    return newPoint;
  };
  
  // 去重后的线段
  const result: [THREE.Vector3, THREE.Vector3][] = [];
  
  for (const [p1, p2] of segments) {
    const up1 = findOrAddPoint(p1);
    const up2 = findOrAddPoint(p2);
    
    // 跳过退化线段（两端点相同）
    if (up1 === up2) continue;
    
    result.push([up1, up2]);
  }
  
  return result;
}

/**
 * 计算圆柱与平面的截交线（解析法）
 * @param cylinderRadius 圆柱半径
 * @param cylinderHeight 圆柱高度
 * @param cylinderAxis 圆柱轴向（默认Y轴）
 * @param planePoint 平面上的一点
 * @param planeNormal 平面法向量
 * @returns 截交线结果
 */
export function calculateCylinderSection(
  cylinderRadius: number,
  cylinderHeight: number,
  cylinderAxis: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3
): SectionResult {
  // 计算平面与圆柱轴的夹角
  const axisNormalized = cylinderAxis.clone().normalize();
  const normalNormalized = planeNormal.clone().normalize();
  const cosAngle = Math.abs(axisNormalized.dot(normalNormalized));
  
  // 如果平面垂直于轴（cosAngle ≈ 1），截交线是圆
  if (cosAngle > 0.999) {
    // 圆形截面
    const points: THREE.Vector3[] = [];
    const segments = 64;
    
    // 计算圆心（平面与轴的交点）
    const t = new THREE.Vector3().subVectors(planePoint, new THREE.Vector3(0, 0, 0))
      .dot(planeNormal) / axisNormalized.dot(planeNormal);
    const center = axisNormalized.clone().multiplyScalar(-t);
    
    // 创建圆上的点
    const perpAxis1 = new THREE.Vector3(1, 0, 0);
    if (Math.abs(axisNormalized.dot(perpAxis1)) > 0.99) {
      perpAxis1.set(0, 0, 1);
    }
    const uAxis = new THREE.Vector3().crossVectors(axisNormalized, perpAxis1).normalize();
    const vAxis = new THREE.Vector3().crossVectors(axisNormalized, uAxis).normalize();
    
    for (let i = 0; i < segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const point = center.clone()
        .add(uAxis.clone().multiplyScalar(Math.cos(angle) * cylinderRadius))
        .add(vAxis.clone().multiplyScalar(Math.sin(angle) * cylinderRadius));
      points.push(point);
    }
    
    return {
      points3D: points,
      loops: [{ points, isClosed: true }],
      isClosed: true,
      curveType: 'circle'
    };
  }
  
  // 如果平面与轴平行（cosAngle ≈ 0），截交线是两条直线
  if (cosAngle < 0.001) {
    // 这种情况比较复杂，暂时使用网格切割法
    return {
      points3D: [],
      loops: [],
      isClosed: false,
      curveType: 'polygon'
    };
  }
  
  // 其他情况，截交线是椭圆
  // 计算椭圆参数
  const sinAngle = Math.sqrt(1 - cosAngle * cosAngle);
  const majorRadius = cylinderRadius / sinAngle;  // 长轴半径
  const minorRadius = cylinderRadius;              // 短轴半径
  
  // 计算椭圆中心
  const center = planePoint.clone();
  
  // 计算椭圆的主轴方向
  const majorAxis = new THREE.Vector3().crossVectors(planeNormal, axisNormalized).normalize();
  const minorAxis = new THREE.Vector3().crossVectors(planeNormal, majorAxis).normalize();
  
  // 生成椭圆上的点
  const points: THREE.Vector3[] = [];
  const segments = 64;
  
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const point = center.clone()
      .add(majorAxis.clone().multiplyScalar(Math.cos(angle) * majorRadius))
      .add(minorAxis.clone().multiplyScalar(Math.sin(angle) * minorRadius));
    points.push(point);
  }
  
  return {
    points3D: points,
    loops: [{ points, isClosed: true }],
    isClosed: true,
    curveType: 'ellipse',
    ellipseParams: {
      center,
      majorAxis,
      minorAxis,
      majorRadius,
      minorRadius
    }
  };
}

/**
 * 计算圆锥与平面的截交线（解析法）
 * @param coneRadius 圆锥底面半径
 * @param coneHeight 圆锥高度
 * @param coneAxis 圆锥轴向（默认Y轴，顶点在上）
 * @param planePoint 平面上的一点
 * @param planeNormal 平面法向量
 * @returns 截交线结果
 */
export function calculateConeSection(
  coneRadius: number,
  coneHeight: number,
  coneAxis: THREE.Vector3 = new THREE.Vector3(0, 1, 0),
  planePoint: THREE.Vector3,
  planeNormal: THREE.Vector3
): SectionResult {
  // 计算圆锥半顶角
  const halfAngle = Math.atan(coneRadius / coneHeight);
  
  // 计算平面与圆锥轴的夹角
  const axisNormalized = coneAxis.clone().normalize();
  const normalNormalized = planeNormal.clone().normalize();
  const cosAngle = Math.abs(axisNormalized.dot(normalNormalized));
  const planeAngle = Math.acos(cosAngle);  // 平面与轴的夹角
  
  // 判断截交线类型
  // θ = 90° → 圆
  // θ > α → 椭圆
  // θ = α → 抛物线
  // θ < α → 双曲线
  
  const tolerance = 0.01;  // 角度容差
  
  if (Math.abs(planeAngle - Math.PI / 2) < tolerance) {
    // 圆形截面
    return {
      points3D: [],
      loops: [],
      isClosed: true,
      curveType: 'circle'
    };
  } else if (planeAngle > halfAngle + tolerance) {
    // 椭圆
    return {
      points3D: [],
      loops: [],
      isClosed: true,
      curveType: 'ellipse'
    };
  } else if (Math.abs(planeAngle - halfAngle) < tolerance) {
    // 抛物线
    return {
      points3D: [],
      loops: [],
      isClosed: false,
      curveType: 'parabola'
    };
  } else {
    // 双曲线
    return {
      points3D: [],
      loops: [],
      isClosed: false,
      curveType: 'hyperbola'
    };
  }
}

/**
 * 将截交线投影到各视图平面
 * @param points3D 3D截交线点
 * @param viewPlane 视图平面 ('V' | 'H' | 'W' | 'R')
 * @returns 2D投影点
 */
export function projectSectionToView(
  points3D: THREE.Vector3[],
  viewPlane: 'V' | 'H' | 'W' | 'R'
): [number, number][] {
  return points3D.map(p => {
    switch (viewPlane) {
      case 'V':  // 主视图：XY平面，直接投影
        return [p.x, p.y];
      case 'H':  // 俯视图：从上往下看，XZ平面
        // H面有rotation={[-Math.PI/2, 0, 0]}，原Y轴->-Z轴，原Z轴->Y轴
        // 在局部坐标系中：x不变，y对应-z
        return [p.x, -p.z];
      case 'W':  // 左视图：从右往左看，ZY平面
        // W面有rotation={[0, -Math.PI/2, 0]}，原X轴->Z轴，原Z轴->-X轴
        // 在局部坐标系中：x对应-z，y不变
        return [-p.z, p.y];
      case 'R':  // 右视图：从左往右看，ZY平面
        // R面有rotation={[0, Math.PI/2, 0]}，原X轴->-Z轴，原Z轴->X轴
        // 在局部坐标系中：x对应z，y不变
        return [p.z, p.y];
      default:
        return [p.x, p.y];
    }
  });
}
