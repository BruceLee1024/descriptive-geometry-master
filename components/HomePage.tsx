import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { 
  Layers, 
  BookOpen, 
  Eye, 
  Compass, 
  ArrowRight,
  Play,
  Sparkles,
  GraduationCap,
  Target,
  Lightbulb,
  ChevronDown,
  X
} from 'lucide-react';

// 鼠标跟随的几何线条背景
const GeometricLinesBackground: React.FC<{ mousePosition: { x: number; y: number } }> = ({ mousePosition }) => {
  const groupRef = useRef<THREE.Group>(null);
  const nodesRef = useRef<THREE.Mesh[]>([]);
  
  // 生成网格节点和连接线
  const { nodes, connections } = React.useMemo(() => {
    const nodes: [number, number, number][] = [];
    const connections: [number, number][] = [];
    
    // 创建随机分布的节点 - 增加到150个
    for (let i = 0; i < 150; i++) {
      nodes.push([
        (Math.random() - 0.5) * 50,
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 25 - 8
      ]);
    }
    
    // 连接相近的节点 - 增加连接距离
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = Math.sqrt(
          Math.pow(nodes[i][0] - nodes[j][0], 2) +
          Math.pow(nodes[i][1] - nodes[j][1], 2) +
          Math.pow(nodes[i][2] - nodes[j][2], 2)
        );
        if (dist < 8) {
          connections.push([i, j]);
        }
      }
    }
    
    return { nodes, connections };
  }, []);

  useFrame((state) => {
    if (!groupRef.current) return;
    
    // 根据鼠标位置旋转整个组
    const targetRotationY = mousePosition.x * 0.3;
    const targetRotationX = mousePosition.y * 0.2;
    
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      targetRotationY,
      0.05
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(
      groupRef.current.rotation.x,
      targetRotationX,
      0.05
    );
    
    // 节点呼吸动画
    nodesRef.current.forEach((node, i) => {
      if (node) {
        const scale = 1 + Math.sin(state.clock.elapsedTime * 2 + i * 0.5) * 0.3;
        node.scale.setScalar(scale);
      }
    });
  });

  return (
    <group ref={groupRef}>
      {/* 节点 */}
      {nodes.map((pos, i) => (
        <mesh
          key={`node-${i}`}
          position={pos}
          ref={(el) => { if (el) nodesRef.current[i] = el; }}
        >
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial 
            color={i % 3 === 0 ? "#6366f1" : i % 3 === 1 ? "#8b5cf6" : "#a855f7"} 
            transparent 
            opacity={0.8} 
          />
        </mesh>
      ))}
      
      {/* 连接线 */}
      {connections.map(([i, j], idx) => {
        const points = [
          new THREE.Vector3(...nodes[i]),
          new THREE.Vector3(...nodes[j])
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        return (
          <primitive key={`line-${idx}`} object={new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: '#6366f1', transparent: true, opacity: 0.3 }))} />
        );
      })}
      
      {/* 装饰性几何框架 - 更多更大 */}
      <mesh position={[0, 0, -12]} rotation={[0.2, 0.3, 0]}>
        <icosahedronGeometry args={[6, 0]} />
        <meshBasicMaterial color="#4f46e5" wireframe transparent opacity={0.12} />
      </mesh>
      
      <mesh position={[-12, 5, -10]} rotation={[0.5, 0.2, 0.3]}>
        <octahedronGeometry args={[3.5, 0]} />
        <meshBasicMaterial color="#7c3aed" wireframe transparent opacity={0.18} />
      </mesh>
      
      <mesh position={[12, -4, -11]} rotation={[0.3, 0.6, 0.1]}>
        <dodecahedronGeometry args={[4, 0]} />
        <meshBasicMaterial color="#8b5cf6" wireframe transparent opacity={0.15} />
      </mesh>
      
      <mesh position={[-6, -6, -8]} rotation={[0.8, 0.4, 0.2]}>
        <tetrahedronGeometry args={[3, 0]} />
        <meshBasicMaterial color="#a855f7" wireframe transparent opacity={0.2} />
      </mesh>
      
      <mesh position={[10, 6, -9]} rotation={[0.1, 0.7, 0.4]}>
        <icosahedronGeometry args={[2.5, 0]} />
        <meshBasicMaterial color="#c084fc" wireframe transparent opacity={0.18} />
      </mesh>
      
      <mesh position={[-15, -2, -14]} rotation={[0.6, 0.3, 0.5]}>
        <boxGeometry args={[4, 4, 4]} />
        <meshBasicMaterial color="#6366f1" wireframe transparent opacity={0.12} />
      </mesh>
      
      <mesh position={[15, 2, -13]} rotation={[0.4, 0.5, 0.2]}>
        <octahedronGeometry args={[3, 0]} />
        <meshBasicMaterial color="#818cf8" wireframe transparent opacity={0.15} />
      </mesh>
    </group>
  );
};

// 粒子系统
const ParticleField: React.FC<{ mousePosition: { x: number; y: number } }> = ({ mousePosition }) => {
  const particlesRef = useRef<THREE.Points>(null);
  
  const particleCount = 800; // 增加到800个粒子
  const positions = React.useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
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
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#a5b4fc"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
};

// 3D 动画背景组件
const AnimatedBackground: React.FC<{ mousePosition: { x: number; y: number } }> = ({ mousePosition }) => {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      
      {/* 几何线条网格背景 */}
      <GeometricLinesBackground mousePosition={mousePosition} />
      
      {/* 粒子场 */}
      <ParticleField mousePosition={mousePosition} />
      
      {/* 漂浮的几何体 */}
      <Float speed={2} rotationIntensity={1} floatIntensity={2}>
        <mesh position={[-3, 1, -2]}>
          <boxGeometry args={[1, 1, 1]} />
          <MeshDistortMaterial color="#6366f1" speed={2} distort={0.2} />
        </mesh>
      </Float>
      
      <Float speed={1.5} rotationIntensity={1.5} floatIntensity={1.5}>
        <mesh position={[3, -1, -3]}>
          <octahedronGeometry args={[0.8]} />
          <MeshDistortMaterial color="#8b5cf6" speed={3} distort={0.3} />
        </mesh>
      </Float>
      
      <Float speed={2.5} rotationIntensity={0.8} floatIntensity={2.5}>
        <mesh position={[0, 2, -4]}>
          <tetrahedronGeometry args={[0.7]} />
          <MeshDistortMaterial color="#a855f7" speed={2.5} distort={0.25} />
        </mesh>
      </Float>
      
      <Float speed={1.8} rotationIntensity={1.2} floatIntensity={1.8}>
        <mesh position={[-4, -2, -5]}>
          <dodecahedronGeometry args={[0.6]} />
          <MeshDistortMaterial color="#c084fc" speed={2} distort={0.2} />
        </mesh>
      </Float>
      
      <Float speed={2.2} rotationIntensity={1} floatIntensity={2}>
        <mesh position={[4, 1.5, -4]}>
          <icosahedronGeometry args={[0.5]} />
          <MeshDistortMaterial color="#e879f9" speed={2.8} distort={0.15} />
        </mesh>
      </Float>

      {/* 投影演示立方体 */}
      <Float speed={0.8} rotationIntensity={0.5} floatIntensity={0.5}>
        <group position={[0, 0, 0]}>
          <mesh>
            <boxGeometry args={[1.5, 1.5, 1.5]} />
            <meshStandardMaterial 
              color="#4f46e5" 
              transparent 
              opacity={0.7}
              metalness={0.3}
              roughness={0.4}
            />
          </mesh>
          {/* 投影线效果 */}
          <lineSegments>
            <edgesGeometry args={[new THREE.BoxGeometry(1.5, 1.5, 1.5)]} />
            <lineBasicMaterial color="#a5b4fc" linewidth={2} />
          </lineSegments>
        </group>
      </Float>
    </>
  );
};

interface HomePageProps {
  onEnter: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onEnter }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [activeFeature, setActiveFeature] = useState(0);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [showWechatQR, setShowWechatQR] = useState(false);

  // 鼠标移动跟踪
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const x = (e.clientX / window.innerWidth) * 2 - 1;
    const y = -(e.clientY / window.innerHeight) * 2 + 1;
    setMousePosition({ x, y });
  }, []);

  useEffect(() => {
    setIsVisible(true);
    window.addEventListener('mousemove', handleMouseMove);
    
    const interval = setInterval(() => {
      setActiveFeature(prev => (prev + 1) % 4);
    }, 3000);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      clearInterval(interval);
    };
  }, [handleMouseMove]);

  const features = [
    {
      icon: <Eye size={24} />,
      title: '三视图投影',
      desc: '理解主视图、俯视图、左视图的投影原理',
      color: 'from-red-500 to-rose-600'
    },
    {
      icon: <Compass size={24} />,
      title: '轴测投影',
      desc: '掌握等轴测、二等轴测、斜二测的绘制方法',
      color: 'from-violet-500 to-purple-600'
    },
    {
      icon: <Target size={24} />,
      title: '投影规律',
      desc: '深入理解"长对正、高平齐、宽相等"',
      color: 'from-cyan-500 to-blue-600'
    },
    {
      icon: <Lightbulb size={24} />,
      title: 'AI 辅助学习',
      desc: 'DeepSeek AI 助教实时解答疑问',
      color: 'from-amber-500 to-orange-600'
    }
  ];

  const principles = [
    { title: '长对正', desc: '主视图与俯视图的长度对齐', color: '#ef4444' },
    { title: '高平齐', desc: '主视图与左视图的高度对齐', color: '#22c55e' },
    { title: '宽相等', desc: '俯视图与左视图的宽度相等', color: '#3b82f6' }
  ];

  return (
    <div className="bg-[#0a0f1a] text-white relative" style={{ minHeight: '100vh' }}>
      {/* 科技感网格背景 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.15)_0%,transparent_70%)]" />
      </div>
      
      {/* 3D 背景 - 固定在视口 */}
      <div className="fixed inset-0 opacity-80 pointer-events-none z-0">
        <Canvas camera={{ position: [0, 0, 12], fov: 60 }}>
          <AnimatedBackground mousePosition={mousePosition} />
        </Canvas>
      </div>

      {/* 渐变遮罩 - 固定 */}
      <div className="fixed inset-0 bg-gradient-to-b from-[#0a0f1a]/20 via-[#0a0f1a]/50 to-[#0a0f1a] pointer-events-none z-0" />

      {/* 内容 - 可滚动 */}
      <div className="relative z-10" style={{ position: 'relative' }}>
        {/* Hero Section */}
        <section className="min-h-screen flex flex-col items-center justify-center px-6">
          <div className={`text-center transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {/* Logo */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-indigo-500/50 relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-white/30 to-transparent" />
                <Layers size={40} className="text-white relative z-10" />
              </div>
            </div>

            {/* 标题 */}
            <h1 className="text-6xl md:text-8xl font-bold mb-4 bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent drop-shadow-lg">
              画法几何大师
            </h1>
            
            <p className="text-xl md:text-2xl text-indigo-300/80 mb-3 tracking-widest font-light">
              DESCRIPTIVE GEOMETRY MASTER
            </p>
            
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              交互式三维可视化学习平台，让抽象的投影原理变得直观易懂
            </p>

            {/* CTA 按钮 */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <button
                onClick={onEnter}
                className="group px-10 py-5 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:via-purple-500 hover:to-pink-500 rounded-2xl text-lg font-semibold transition-all shadow-xl shadow-indigo-500/40 hover:shadow-indigo-500/60 hover:scale-105 active:scale-95 flex items-center gap-3 relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <Play size={22} className="relative z-10" />
                <span className="relative z-10">开始学习</span>
                <ArrowRight size={22} className="relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
              
              <button
                onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
                className="px-8 py-5 bg-white/5 hover:bg-white/10 border border-indigo-500/30 hover:border-indigo-500/50 rounded-2xl text-lg transition-all flex items-center gap-2 backdrop-blur-sm"
              >
                <BookOpen size={20} />
                了解更多
              </button>
            </div>

            {/* 滚动提示 - 可点击 */}
            <button 
              onClick={() => document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' })}
              className="animate-bounce cursor-pointer hover:scale-110 transition-transform"
            >
              <ChevronDown size={32} className="text-slate-400 hover:text-indigo-400 transition-colors" />
            </button>
          </div>
        </section>

        {/* 什么是画法几何 */}
        <section id="about" className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-900/50 rounded-full text-indigo-300 text-sm mb-4">
                <GraduationCap size={16} />
                基础知识
              </span>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                什么是<span className="text-indigo-400">画法几何</span>？
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <p className="text-lg text-slate-300 leading-relaxed">
                  <span className="text-indigo-400 font-semibold">画法几何（Descriptive Geometry）</span>是研究在平面上表达空间几何形体的图示方法的学科，是工程制图的理论基础。
                </p>
                
                <p className="text-slate-400 leading-relaxed">
                  它由法国数学家蒙日（Gaspard Monge）在18世纪创立，通过正投影法将三维物体投影到二维平面上，形成工程图纸。这是机械、建筑、土木等工程领域的必备技能。
                </p>

                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Sparkles size={20} className="text-amber-400" />
                    核心投影规律
                  </h3>
                  <div className="space-y-3">
                    {principles.map((p, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: p.color }}
                        />
                        <span className="font-medium text-white">{p.title}</span>
                        <span className="text-slate-400">— {p.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700 rounded-3xl p-8">
                <h3 className="text-xl font-semibold mb-6 text-center">三视图投影原理</h3>
                <div className="aspect-square relative">
                  {/* 简化的三视图示意图 */}
                  <svg viewBox="0 0 200 200" className="w-full h-full">
                    {/* 主视图 V */}
                    <rect x="60" y="20" width="80" height="60" fill="#fecaca" fillOpacity="0.3" stroke="#f87171" strokeWidth="2" />
                    <text x="100" y="55" textAnchor="middle" fill="#fca5a5" fontSize="12">V 主视图</text>
                    
                    {/* 俯视图 H */}
                    <rect x="60" y="100" width="80" height="60" fill="#bae6fd" fillOpacity="0.3" stroke="#38bdf8" strokeWidth="2" />
                    <text x="100" y="135" textAnchor="middle" fill="#7dd3fc" fontSize="12">H 俯视图</text>
                    
                    {/* 左视图 W */}
                    <rect x="150" y="20" width="40" height="60" fill="#bbf7d0" fillOpacity="0.3" stroke="#4ade80" strokeWidth="2" />
                    <text x="170" y="55" textAnchor="middle" fill="#86efac" fontSize="10">W</text>
                    
                    {/* 连接线 */}
                    <line x1="100" y1="80" x2="100" y2="100" stroke="#64748b" strokeDasharray="4" />
                    <line x1="140" y1="50" x2="150" y2="50" stroke="#64748b" strokeDasharray="4" />
                    
                    {/* 标注 */}
                    <text x="45" y="90" fill="#94a3b8" fontSize="10">长对正</text>
                    <text x="145" y="90" fill="#94a3b8" fontSize="10">高平齐</text>
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 功能特点 */}
        <section className="py-24 px-6 bg-slate-800/30">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-purple-900/50 rounded-full text-purple-300 text-sm mb-4">
                <Sparkles size={16} />
                平台特色
              </span>
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                为什么选择<span className="text-purple-400">画法几何大师</span>？
              </h2>
              <p className="text-slate-400 max-w-2xl mx-auto">
                告别枯燥的课本，通过交互式3D可视化，让画法几何学习变得有趣高效
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`group p-6 rounded-2xl border transition-all duration-500 cursor-pointer ${
                    activeFeature === index
                      ? 'bg-slate-800 border-indigo-500/50 scale-105 shadow-lg shadow-indigo-500/20'
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                  }`}
                  onMouseEnter={() => setActiveFeature(index)}
                >
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    {feature.icon}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-slate-400 text-sm">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 学习内容 */}
        <section className="py-24 px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                你将学到什么？
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  num: '01',
                  title: '基本形体投影',
                  items: ['正方体、圆柱、圆锥', '棱柱、棱锥', '组合体分析'],
                  color: 'indigo'
                },
                {
                  num: '02',
                  title: '投影变换',
                  items: ['三视图展开与折叠', '投影面炸开效果', '投影线追踪'],
                  color: 'purple'
                },
                {
                  num: '03',
                  title: '实践应用',
                  items: ['自定义模型导入', 'SketchUp风格绘制', '轴测图绘制'],
                  color: 'pink'
                }
              ].map((section, i) => (
                <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 hover:border-slate-600 transition-all">
                  <span className={`text-5xl font-bold text-${section.color}-500/30`}>{section.num}</span>
                  <h3 className="text-xl font-semibold mt-2 mb-4">{section.title}</h3>
                  <ul className="space-y-2">
                    {section.items.map((item, j) => (
                      <li key={j} className="flex items-center gap-2 text-slate-400">
                        <div className={`w-1.5 h-1.5 rounded-full bg-${section.color}-500`} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <div className="bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-3xl p-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                准备好开始学习了吗？
              </h2>
              <p className="text-slate-300 mb-8 max-w-xl mx-auto">
                无需注册，立即体验交互式画法几何学习平台
              </p>
              <button
                onClick={onEnter}
                className="group px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 rounded-2xl text-xl font-semibold transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 flex items-center gap-3 mx-auto"
              >
                <Play size={24} />
                进入学习平台
                <ArrowRight size={24} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </section>

        {/* 作者信息 */}
        <section className="py-16 px-6 bg-gradient-to-b from-transparent to-slate-800/30">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h3 className="text-2xl font-bold mb-2">关于作者</h3>
              <p className="text-slate-400">工程设计 Engineer</p>
            </div>
            
            <div className="flex flex-row items-center justify-center gap-6">
              {/* 微信按钮 */}
              <button
                onClick={() => setShowWechatQR(true)}
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-xl hover:border-green-500/50 hover:scale-105 transition-all group"
              >
                <svg className="w-6 h-6 text-green-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178A1.17 1.17 0 014.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 01-1.162 1.178 1.17 1.17 0 01-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 01.598.082l1.584.926a.272.272 0 00.14.045c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 01-.023-.156.49.49 0 01.201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.269-.03-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 01-.969.983.976.976 0 01-.969-.983c0-.542.434-.982.969-.982z"/>
                </svg>
                <span className="text-green-300 group-hover:text-green-200">添加微信</span>
              </button>
              
              {/* 抖音 */}
              <a
                href="https://www.douyin.com/user/self?from_tab_name=main"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-pink-500/20 to-red-500/20 border border-pink-500/30 rounded-xl hover:border-pink-500/50 hover:scale-105 transition-all group"
              >
                <svg className="w-6 h-6 text-pink-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
                <span className="text-pink-300 group-hover:text-pink-200">关注抖音</span>
              </a>
              
              {/* 小红书 */}
              <a
                href="https://www.xiaohongshu.com/user/profile/67b884d2000000000e013859"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-red-500/20 to-orange-500/20 border border-red-500/30 rounded-xl hover:border-red-500/50 hover:scale-105 transition-all group"
              >
                <svg className="w-6 h-6 text-red-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-6h2v6zm4 0h-2v-6h2v6zm-2-8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
                </svg>
                <span className="text-red-300 group-hover:text-red-200">关注小红书</span>
              </a>
            </div>
          </div>
        </section>

        {/* 微信二维码弹窗 */}
        {showWechatQR && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowWechatQR(false)}>
            <div className="bg-white p-6 rounded-2xl shadow-2xl relative" onClick={e => e.stopPropagation()}>
              <button 
                onClick={() => setShowWechatQR(false)}
                className="absolute -top-3 -right-3 w-8 h-8 bg-slate-800 rounded-full flex items-center justify-center text-white hover:bg-slate-700 transition-colors"
              >
                <X size={18} />
              </button>
              <img 
                src={(import.meta as any).env?.BASE_URL ? (import.meta as any).env.BASE_URL + 'wechat-qr.png' : '/wechat-qr.png'} 
                alt="微信二维码" 
                className="w-64 h-64 object-contain" 
              />
              <p className="text-center text-slate-800 text-sm mt-3 font-medium">扫码添加微信</p>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="py-8 px-6 border-t border-slate-800">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Layers size={20} className="text-indigo-400" />
              <span className="text-slate-400">画法几何大师</span>
            </div>
            <p className="text-slate-500 text-sm">
              Made with ❤️ by 工程设计 Engineer · 交互式工程制图学习平台
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
};
