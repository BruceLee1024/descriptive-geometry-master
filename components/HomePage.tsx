import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { Layers, ArrowRight, Play } from 'lucide-react';

// 鼠标跟随的几何线条背景
const GeometricLinesBackground: React.FC<{ mousePosition: { x: number; y: number } }> = ({ mousePosition }) => {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.Mesh[]>([]);
  
  const { nodes, connections } = React.useMemo(() => {
    const nodes: [number, number, number][] = [];
    const connections: [number, number][] = [];
    for (let i = 0; i < 120; i++) {
      nodes.push([(Math.random() - 0.5) * 50, (Math.random() - 0.5) * 35, (Math.random() - 0.5) * 25 - 8]);
    }
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.sqrt(Math.pow(nodes[i][0] - nodes[j][0], 2) + Math.pow(nodes[i][1] - nodes[j][1], 2) + Math.pow(nodes[i][2] - nodes[j][2], 2));
        if (dist < 8) connections.push([i, j]);
      }
    }
    return { nodes, connections };
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, mousePosition.x * 0.3, 0.05);
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, mousePosition.y * 0.2, 0.05);
    nodesRef.current.forEach((node, i) => {
      if (node) node.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 2 + i * 0.5) * 0.3);
    });
  });

  return (
    <group ref={groupRef}>
      {nodes.map((pos, i) => (
        <mesh key={`node-${i}`} position={pos} ref={(el) => { if (el) nodesRef.current[i] = el; }}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={i % 3 === 0 ? "#6366f1" : i % 3 === 1 ? "#8b5cf6" : "#a855f7"} transparent opacity={0.8} />
        </mesh>
      ))}
      {connections.map(([i, j], idx) => (
        <primitive key={`line-${idx}`} object={new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...nodes[i]), new THREE.Vector3(...nodes[j])]), new THREE.LineBasicMaterial({ color: '#6366f1', transparent: true, opacity: 0.3 }))} />
      ))}
      <mesh position={[0, 0, -12]} rotation={[0.2, 0.3, 0]}><icosahedronGeometry args={[6, 0]} /><meshBasicMaterial color="#4f46e5" wireframe transparent opacity={0.12} /></mesh>
      <mesh position={[-12, 5, -10]} rotation={[0.5, 0.2, 0.3]}><octahedronGeometry args={[3.5, 0]} /><meshBasicMaterial color="#7c3aed" wireframe transparent opacity={0.18} /></mesh>
      <mesh position={[12, -4, -11]} rotation={[0.3, 0.6, 0.1]}><dodecahedronGeometry args={[4, 0]} /><meshBasicMaterial color="#8b5cf6" wireframe transparent opacity={0.15} /></mesh>
    </group>
  );
};


// 粒子系统
const ParticleField: React.FC<{ mousePosition: { x: number; y: number } }> = ({ mousePosition }) => {
  const particlesRef = useRef<THREE.Points>(null);
  const positions = React.useMemo(() => {
    const pos = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30 - 10;
    }
    return pos;
  }, []);

  useFrame((state) => {
    if (!particlesRef.current) return;
    particlesRef.current.rotation.y = state.clock.elapsedTime * 0.02 + mousePosition.x * 0.1;
    particlesRef.current.rotation.x = mousePosition.y * 0.05;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry><bufferAttribute attach="attributes-position" count={600} array={positions} itemSize={3} /></bufferGeometry>
      <pointsMaterial size={0.05} color="#a5b4fc" transparent opacity={0.6} sizeAttenuation />
    </points>
  );
};

// 3D 动画背景
const AnimatedBackground: React.FC<{ mousePosition: { x: number; y: number } }> = ({ mousePosition }) => (
  <>
    <ambientLight intensity={0.5} />
    <directionalLight position={[10, 10, 5]} intensity={0.8} />
    <GeometricLinesBackground mousePosition={mousePosition} />
    <ParticleField mousePosition={mousePosition} />
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh position={[-3, 1, -2]}><boxGeometry args={[1, 1, 1]} /><MeshDistortMaterial color="#6366f1" speed={2} distort={0.2} /></mesh>
    </Float>
    <Float speed={1.5} rotationIntensity={1.5} floatIntensity={1.5}>
      <mesh position={[3, -1, -3]}><octahedronGeometry args={[0.8]} /><MeshDistortMaterial color="#8b5cf6" speed={3} distort={0.3} /></mesh>
    </Float>
    <Float speed={0.8} rotationIntensity={0.5} floatIntensity={0.5}>
      <group position={[0, 0, 0]}>
        <mesh><boxGeometry args={[1.5, 1.5, 1.5]} /><meshStandardMaterial color="#4f46e5" transparent opacity={0.7} metalness={0.3} roughness={0.4} /></mesh>
        <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(1.5, 1.5, 1.5)]} /><lineBasicMaterial color="#a5b4fc" /></lineSegments>
      </group>
    </Float>
  </>
);

interface HomePageProps { onEnter: () => void; }

export const HomePage: React.FC<HomePageProps> = ({ onEnter }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const handleMouseMove = useCallback((e: MouseEvent) => {
    setMousePosition({ x: (e.clientX / window.innerWidth) * 2 - 1, y: -(e.clientY / window.innerHeight) * 2 + 1 });
  }, []);

  useEffect(() => {
    setIsVisible(true);
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div className="h-screen bg-[#0a0f1a] text-white overflow-hidden relative">
      {/* 科技感网格背景 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,transparent_70%)]" />
      </div>
      
      {/* 3D 背景 */}
      <div className="absolute inset-0 opacity-80">
        <Canvas camera={{ position: [0, 0, 12], fov: 60 }}>
          <AnimatedBackground mousePosition={mousePosition} />
        </Canvas>
      </div>

      {/* 渐变遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1a]/20 via-transparent to-[#0a0f1a]/80" />

      {/* 主要内容 */}
      <div className="relative z-10 h-full flex flex-col">
        {/* 中心内容 */}
        <div className={`flex-1 flex flex-col items-center justify-center px-6 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
          {/* Logo */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-indigo-500/50 mb-6 relative">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 to-transparent" />
            <Layers size={40} className="text-white relative z-10" />
          </div>

          {/* 标题 */}
          <h1 className="text-5xl md:text-7xl font-bold mb-3 bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent text-center">
            画法几何大师
          </h1>
          <p className="text-lg md:text-xl text-indigo-300/80 mb-2 tracking-widest font-light">DESCRIPTIVE GEOMETRY MASTER</p>
          <p className="text-base text-slate-400 max-w-xl mx-auto mb-8 text-center">交互式三维可视化学习平台 · 让抽象的投影原理变得直观易懂</p>

          {/* 开始按钮 */}
          <button onClick={onEnter} className="group px-10 py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 rounded-2xl text-lg font-semibold transition-all shadow-xl shadow-indigo-500/40 hover:shadow-indigo-500/60 hover:scale-105 active:scale-95 flex items-center gap-3 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <Play size={22} className="relative z-10" />
            <span className="relative z-10">开始学习</span>
            <ArrowRight size={22} className="relative z-10 group-hover:translate-x-1 transition-transform" />
          </button>
        </div>


        {/* 底部作者信息 */}
        <div className="pb-6 px-6">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-center gap-6">
            {/* 微信二维码 */}
            <div className="bg-white p-3 rounded-xl shadow-lg flex items-center gap-3">
              <img src="wechat-qr.png" alt="微信二维码" className="w-20 h-20 object-contain" />
              <div className="text-slate-800">
                <p className="font-semibold text-sm">工程设计 Engineer</p>
                <p className="text-xs text-slate-500">扫码添加微信</p>
              </div>
            </div>
            
            {/* 社交链接 */}
            <div className="flex gap-3">
              <a href="https://www.douyin.com/user/self?from_tab_name=main" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500/20 to-red-500/20 border border-pink-500/30 rounded-xl hover:border-pink-500/50 transition-all text-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                <span className="text-pink-300">抖音</span>
              </a>
              <a href="https://www.xiaohongshu.com/user/profile/67b884d2000000000e013859" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-xl hover:border-red-500/50 transition-all text-sm">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm-2-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/></svg>
                <span className="text-red-300">小红书</span>
              </a>
            </div>
          </div>
          
          {/* 版权 */}
          <p className="text-center text-slate-500 text-xs mt-4">Made with ❤️ by 工程设计 Engineer</p>
        </div>
      </div>
    </div>
  );
};
