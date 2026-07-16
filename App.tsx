import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import ReactMarkdown from 'react-markdown';
import { 
  Box, Layers, Maximize, Minimize, ChevronRight, ChevronLeft,
  BookOpen, Eye, EyeOff, SlidersHorizontal, PenTool, Video, Scan,
  Settings, Key, X, RotateCcw, Sparkles, Upload, Trash2, Home,
  StopCircle, MessageSquare
} from 'lucide-react';
import { GlassBoxScene } from './components/GlassBoxScene';
import { HomePage } from './components/HomePage';
import { GeometryType, GEOMETRIES, GeometryParams } from './types';
import {
  explainGeometryStream,
  getApiKey,
  setApiKey,
  clearApiKey,
  chatWithTutorStream,
  generateWelcomeMessage,
  ChatMessage
} from './services/deepseekService';
import { useHighlightStore } from './features/highlight/store';
import { HoverLegend } from './features/highlight/HoverLegend';
import { ModelLibraryPanel } from './features/modelLibrary/ModelLibraryPanel';
import { useModelLibraryStore } from './features/modelLibrary/store';
import type { ModelEntry } from './features/modelLibrary/store';
import { CSGWorkshopPanel } from './features/csgWorkshop/CSGWorkshopPanel';
import { useWorkshopStore } from './features/csgWorkshop/store';
import { evaluateSteps, summarizeSteps, buildProjectFromGeometry } from './features/csgWorkshop/model';
import { exportGeometryAsGLB } from './features/csgWorkshop/exporters';
import * as THREE from 'three';

const App: React.FC = () => {
  const [showHomePage, setShowHomePage] = useState(true);
  const [currentGeometry, setCurrentGeometry] = useState<GeometryType>(GeometryType.CUT_BLOCK);
  const [geoParams, setGeoParams] = useState<GeometryParams>({
    width: 2, height: 2, depth: 2, cutSize: 0.5
  });
  
  const [isUnfolded, setIsUnfolded] = useState(false);
  const [showObject, setShowObject] = useState(true);
  const [showProjectors, setShowProjectors] = useState(true);
  const [useOrthographic, setUseOrthographic] = useState(false);
  const [showAxonometric, setShowAxonometric] = useState(false);
  const [axonometricType, setAxonometricType] = useState<'isometric' | 'dimetric' | 'cabinet'>('isometric');

  const highlightEnabled = useHighlightStore((s) => s.enabled);
  const setHighlightEnabled = useHighlightStore((s) => s.setEnabled);
  const correspondenceLinesEnabled = useHighlightStore((s) => s.correspondenceLinesEnabled);
  const setCorrespondenceLinesEnabled = useHighlightStore((s) => s.setCorrespondenceLinesEnabled);
  const csgSteps = useWorkshopStore((s) => s.steps);
  const saveCsgProject = useWorkshopStore((s) => s.saveProject);
  const openCsgProject = useWorkshopStore((s) => s.openProject);
  const csgSummary = currentGeometry === GeometryType.CSG_WORKSHOP ? summarizeSteps(csgSteps) : '';
  const csgProjectSignature = useMemo(() => JSON.stringify(csgSteps.map((step) => ({
    id: step.id,
    op: step.op,
    disabled: !!step.disabled,
    primitive: step.primitive,
    position: step.position,
    rotation: step.rotation,
    scale: step.scale,
  }))), [csgSteps]);
  
  const [aiExplanation, setAiExplanation] = useState<string>("");
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true); // 右侧栏状态
  
  // 对话式AI助教状态
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState("");
  const [currentAssistantMessage, setCurrentAssistantMessage] = useState("");
  
  const [showApiKeyModal, setShowApiKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [hasApiKey, setHasApiKey] = useState(!!getApiKey());
  
  const [customModelUrl, setCustomModelUrl] = useState<string | null>(null);
  const [activeModelId, setActiveModelId] = useState<string | null>(null);
  
  const [drawCompleted, setDrawCompleted] = useState(false);
  const [drawnPoints, setDrawnPoints] = useState<[number, number][]>([]);
  const [drawnDepth, setDrawnDepth] = useState(2);
  
  // 截平面相关状态
  const [showSectionPlane, setShowSectionPlane] = useState(false);
  const [sectionPlanePosition, setSectionPlanePosition] = useState<[number, number, number]>([0, 0.5, 0]);
  const [sectionPlaneRotation, setSectionPlaneRotation] = useState<[number, number, number]>([Math.PI / 2, 0, 0]);

  const aiContentRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const shouldAutoScrollRef = useRef(true);

  // 检查是否应该自动滚动（用户没有手动向上滚动）
  const checkShouldAutoScroll = useCallback(() => {
    if (!aiContentRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = aiContentRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  const fetchAiExplanationStream = useCallback((shapeName: string, promptContext: string = "") => {
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoadingAi(true);
    setAiExplanation("");
    shouldAutoScrollRef.current = true;
    let fullText = "";
    explainGeometryStream(shapeName, promptContext,
      (chunk) => {
        if (controller.signal.aborted) return;
        fullText += chunk;
        setAiExplanation(fullText);
      },
      () => {
        if (controller.signal.aborted) return;
        setIsLoadingAi(false);
        abortControllerRef.current = null;
      },
      (error) => {
        if (controller.signal.aborted) return;
        setAiExplanation(error);
        setIsLoadingAi(false);
        abortControllerRef.current = null;
      },
      controller.signal
    );
  }, []);

  // 平滑滚动到底部
  useEffect(() => {
    if (aiContentRef.current && shouldAutoScrollRef.current) {
      const el = aiContentRef.current;
      requestAnimationFrame(() => {
        el.scrollTop = el.scrollHeight;
      });
    }
  }, [chatMessages, currentAssistantMessage, isLoadingAi]);

  // 切换形体时生成欢迎消息
  useEffect(() => {
    const geoInfo = GEOMETRIES.find(g => g.id === currentGeometry);
    if (geoInfo) {
      // 清空对话历史，生成新的欢迎消息
      const welcomeMsg = generateWelcomeMessage(geoInfo.name);
      setChatMessages([{ role: 'assistant', content: welcomeMsg }]);
      setCurrentAssistantMessage("");
      setAiExplanation("");
    }
  }, [currentGeometry]);

  // 发送用户消息
  const handleSendMessage = useCallback(() => {
    if (!userInput.trim() || isLoadingAi) return;
    
    const geoInfo = GEOMETRIES.find(g => g.id === currentGeometry);
    const userMessage: ChatMessage = { role: 'user', content: userInput.trim() };
    const newMessages = [...chatMessages, userMessage];
    setChatMessages(newMessages);
    setUserInput("");
    setIsLoadingAi(true);
    setCurrentAssistantMessage("");
    shouldAutoScrollRef.current = true;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    let fullResponse = "";
    chatWithTutorStream(
      newMessages,
      `${geoInfo?.name || "这个物体"}${csgSummary ? `\n${csgSummary}` : ''}`,
      (chunk) => {
        if (controller.signal.aborted) return;
        fullResponse += chunk;
        setCurrentAssistantMessage(fullResponse);
      },
      () => {
        if (controller.signal.aborted) return;
        setChatMessages(prev => [...prev, { role: 'assistant', content: fullResponse }]);
        setCurrentAssistantMessage("");
        setIsLoadingAi(false);
        abortControllerRef.current = null;
      },
      (error) => {
        if (controller.signal.aborted) return;
        setChatMessages(prev => [...prev, { role: 'assistant', content: error }]);
        setCurrentAssistantMessage("");
        setIsLoadingAi(false);
        abortControllerRef.current = null;
      },
      controller.signal
    );
  }, [userInput, isLoadingAi, chatMessages, currentGeometry, csgSummary]);

  // 处理回车发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleAskAI = () => {
    const geoInfo = GEOMETRIES.find(g => g.id === currentGeometry);
    const prompt = `目前的几何体参数为：宽${geoParams.width}, 高${geoParams.height}, 深${geoParams.depth}。${csgSummary ? `${csgSummary}。` : ''}请解释一下它的三视图长什么样？重点解释一下"长对正、高平齐、宽相等"在这个物体上是如何体现的？`;
    fetchAiExplanationStream(geoInfo?.name || "这个物体", prompt);
  };

  const handleStopAi = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setCurrentAssistantMessage("");
    setIsLoadingAi(false);
  };
  const updateLibraryScale = useModelLibraryStore((s) => s.updateScale);
  const addModelFromBlob = useModelLibraryStore((s) => s.addFromBlob);

  // CSG 工作台：订阅步骤变化，重算 geometry 注入到 geoParams
  useEffect(() => {
    if (currentGeometry !== GeometryType.CSG_WORKSHOP || csgSteps.length === 0) return;
    saveCsgProject();
    const geo = evaluateSteps(csgSteps);
    setGeoParams((prev) => ({
      ...prev,
      csgGeometry: geo ?? undefined,
      csgGeometryKey: `${csgSteps.length}-${csgSteps.map(s => s.id + (s.disabled ? 'd' : '')).join(',')}`,
    }));
  }, [csgProjectSignature, currentGeometry, csgSteps.length, saveCsgProject]);

  const handleParamChange = (key: keyof GeometryParams, value: number) => {
    setGeoParams(prev => ({ ...prev, [key]: value }));
    if (key === 'customModelScale' && activeModelId) {
      updateLibraryScale(activeModelId, value).catch(() => {});
    }
  };
  const handleResetParams = () => setGeoParams({ width: 2, height: 2, depth: 2, cutSize: 0.5, customModelScale: 1 });

  const handleSelectLibraryModel = (entry: ModelEntry) => {
    if (entry.source === 'csg' && entry.csgProjectId) {
      openCsgProject(entry.csgProjectId);
      setCurrentGeometry(GeometryType.CSG_WORKSHOP);
      setActiveModelId(null);
      setCustomModelUrl(null);
      return;
    }
    if (entry.source === 'drawn') {
      setCustomModelUrl(entry.objectUrl);
      setActiveModelId(entry.id);
      setCurrentGeometry(GeometryType.CUSTOM);
      setGeoParams(prev => ({
        ...prev,
        customModelUrl: entry.objectUrl,
        customModelScale: entry.scale,
      }));
      return;
    }
    setCustomModelUrl(entry.objectUrl);
    setActiveModelId(entry.id);
    setCurrentGeometry(GeometryType.CUSTOM);
    setGeoParams(prev => ({
      ...prev,
      customModelUrl: entry.objectUrl,
      customModelScale: entry.scale,
    }));
  };

  const handleClearCustomModel = () => {
    setCustomModelUrl(null);
    setActiveModelId(null);
    setGeoParams(prev => ({ ...prev, customModelUrl: undefined }));
    if (currentGeometry === GeometryType.CUSTOM) setCurrentGeometry(GeometryType.CUBE);
  };

  const handleDrawComplete = (points: [number, number][], depth: number) => {
    setDrawnPoints(points); setDrawnDepth(depth); setDrawCompleted(true);
    setGeoParams(prev => ({ ...prev, drawPoints: points, drawDepth: depth }));
  };
  const handleBackToDraw = () => setDrawCompleted(false);
  const handleSaveDrawnToLibrary = async () => {
    if (!drawCompleted || drawnPoints.length < 3) return;
    const shape = new THREE.Shape();
    shape.moveTo(drawnPoints[0][0], drawnPoints[0][1]);
    drawnPoints.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: drawnDepth, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, drawnDepth / 2, 0);
    const blob = await exportGeometryAsGLB(geometry, '绘制模型');
    await addModelFromBlob(blob, {
      name: `绘制模型 ${new Date().toLocaleDateString('zh-CN')}`,
      fileName: 'drawn-model.glb',
      mimeType: 'model/gltf-binary',
      source: 'drawn',
    });
    geometry.dispose();
  };
  const handleConvertDrawnToCsg = () => {
    if (!drawCompleted || drawnPoints.length < 3) return;
    const shape = new THREE.Shape();
    shape.moveTo(drawnPoints[0][0], drawnPoints[0][1]);
    drawnPoints.slice(1).forEach(([x, y]) => shape.lineTo(x, y));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: drawnDepth, bevelEnabled: false });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, drawnDepth / 2, 0);
    const project = buildProjectFromGeometry(geometry, `绘制转 CSG ${new Date().toLocaleDateString('zh-CN')}`);
    useWorkshopStore.getState().importProject(JSON.stringify({ schema: 1, ...project }));
    setCurrentGeometry(GeometryType.CSG_WORKSHOP);
    geometry.dispose();
  };
  const handleSaveApiKey = () => { if (apiKeyInput.trim()) { setApiKey(apiKeyInput.trim()); setHasApiKey(true); setShowApiKeyModal(false); setApiKeyInput(""); } };
  const handleClearApiKey = () => { clearApiKey(); setHasApiKey(false); setApiKeyInput(""); };

  if (showHomePage) return <HomePage onEnter={() => setShowHomePage(false)} />;

  return (
    <div className="flex h-screen w-full bg-[#0a0f1a] text-white overflow-hidden font-sans">
      {/* 科技感背景网格 */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/10 via-transparent to-purple-900/10" />
      </div>
      
      {/* API Key Modal */}
      {showApiKeyModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-gradient-to-br from-slate-800/95 to-slate-900/95 border border-indigo-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-indigo-500/10 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.05)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                    <Settings size={16} className="text-white" />
                  </div>
                  DeepSeek API 设置
                </h3>
                <button onClick={() => setShowApiKeyModal(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-2">API Key</label>
                  <input type="password" value={apiKeyInput} onChange={(e) => setApiKeyInput(e.target.value)} placeholder={hasApiKey ? "已设置 (输入新值可覆盖)" : "sk-..."} className="w-full px-4 py-3 bg-slate-900/80 border border-indigo-500/30 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all" />
                </div>
                <p className="text-xs text-slate-400">获取 API Key → <a href="https://platform.deepseek.com/api_keys" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 underline">platform.deepseek.com</a></p>
                <div className="flex gap-3 pt-2">
                  <button onClick={handleSaveApiKey} disabled={!apiKeyInput.trim()} className="flex-1 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/25">保存</button>
                  {hasApiKey && <button onClick={handleClearApiKey} className="px-5 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl text-sm transition-all border border-red-500/30">清除</button>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Left Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} shrink-0 transition-all duration-300 ease-out bg-gradient-to-b from-slate-800/98 to-slate-900/98 backdrop-blur-xl border-r border-indigo-500/20 flex flex-col relative z-20 overflow-hidden`}>
        {/* 侧边栏装饰线 */}
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-indigo-500/50 via-purple-500/30 to-transparent" />
        
        <div className="p-4 border-b border-indigo-500/20 flex items-center justify-between shrink-0 relative">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowHomePage(true)} className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center hover:from-indigo-400 hover:to-purple-500 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 hover:scale-105" title="返回主页">
              <Layers size={18} className="text-white" />
            </button>
            <div>
              <h1 className="text-base font-bold bg-gradient-to-r from-indigo-300 via-purple-300 to-pink-300 bg-clip-text text-transparent">画法几何大师</h1>
              <p className="text-[9px] text-slate-500 tracking-wider">DESCRIPTIVE GEOMETRY</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setShowHomePage(true)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white" title="返回主页"><Home size={14} /></button>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"><ChevronLeft size={16} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4 scrollbar-thin scrollbar-thumb-indigo-500/30 scrollbar-track-transparent">
          {/* Geometry Selector */}
          <section>
            <h2 className="text-[10px] font-semibold text-indigo-400/80 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
              <Box size={12} className="text-indigo-400" /> 选择形体
              <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/30 to-transparent ml-2" />
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {GEOMETRIES.filter(g => g.id !== GeometryType.CUSTOM && g.id !== GeometryType.DRAW).map((geo) => (
                <button key={geo.id} onClick={() => setCurrentGeometry(geo.id)} className={`p-2.5 rounded-lg text-[11px] text-left transition-all border backdrop-blur-sm ${currentGeometry === geo.id ? 'bg-gradient-to-r from-indigo-600/90 to-purple-600/90 border-indigo-400/50 text-white shadow-lg shadow-indigo-500/30' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-indigo-500/30 hover:text-white'}`}>{geo.name}</button>
              ))}
            </div>
            <div className="mt-2 space-y-1.5">
              <button onClick={() => { setCurrentGeometry(GeometryType.DRAW); if (!drawCompleted) { setDrawnPoints([]); setDrawnDepth(2); } }} className={`w-full p-2.5 rounded-lg text-[11px] text-left transition-all border flex items-center gap-1.5 ${currentGeometry === GeometryType.DRAW ? 'bg-gradient-to-r from-cyan-600/90 to-teal-600/90 border-cyan-400/50 text-white shadow-lg shadow-cyan-500/30' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-cyan-500/30'}`}>✏️ 绘制建模{drawCompleted && <span className="ml-auto text-[9px] bg-emerald-500 px-1.5 py-0.5 rounded-full font-medium">已完成</span>}</button>
              {currentGeometry === GeometryType.DRAW && drawCompleted && <button onClick={handleBackToDraw} className="w-full p-2 rounded-lg text-[10px] bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 flex items-center justify-center gap-1">← 返回编辑</button>}
              {currentGeometry === GeometryType.DRAW && drawCompleted && (
                <button onClick={handleSaveDrawnToLibrary} className="w-full p-2 rounded-lg text-[10px] bg-cyan-500/10 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/20 flex items-center justify-center gap-1">
                  保存绘制模型到模型库
                </button>
              )}
              {currentGeometry === GeometryType.DRAW && drawCompleted && (
                <button onClick={handleConvertDrawnToCsg} className="w-full p-2 rounded-lg text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500/20 flex items-center justify-center gap-1">
                  一键转为 CSG
                </button>
              )}
            </div>
            <div className="mt-3 pt-3 border-t border-white/10">
              <ModelLibraryPanel
                activeId={currentGeometry === GeometryType.CUSTOM ? activeModelId : null}
                onSelect={handleSelectLibraryModel}
                onClear={handleClearCustomModel}
              />
            </div>
          </section>

          {/* Parameters */}
          <section className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-3.5 rounded-xl border border-indigo-500/20 relative overflow-hidden">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[10px] font-semibold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <SlidersHorizontal size={12} /> 尺寸参数
                </h2>
                <button onClick={handleResetParams} className="p-1 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white hover:rotate-[-180deg] duration-300" title="重置参数"><RotateCcw size={12} /></button>
              </div>
              <div className="space-y-3">
                {[{ key: 'width' as const, label: '宽度', value: geoParams.width, color: 'indigo' }, { key: 'height' as const, label: '高度', value: geoParams.height, color: 'purple' }, { key: 'depth' as const, label: '深度', value: geoParams.depth, color: 'pink' }].map(({ key, label, value, color }) => (
                  <div key={key} className="flex items-center gap-2">
                    <label className="text-[10px] text-slate-400 w-8">{label}</label>
                    <input type="range" min="1" max="4" step="0.1" value={value} onChange={(e) => handleParamChange(key, parseFloat(e.target.value))} className={`flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-${color}-500`} />
                    <span className="text-[10px] text-indigo-300 w-8 text-right font-mono bg-white/5 px-1.5 py-0.5 rounded">{value.toFixed(1)}</span>
                  </div>
                ))}
                {currentGeometry === GeometryType.CUT_BLOCK && (
                  <div className="pt-2 mt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-amber-400 w-8 font-medium">切角</label>
                      <input type="range" min="0" max="2" step="0.1" value={geoParams.cutSize} onChange={(e) => handleParamChange('cutSize', parseFloat(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-amber-500" />
                      <span className="text-[10px] text-amber-300 w-8 text-right font-mono bg-amber-500/10 px-1.5 py-0.5 rounded">{geoParams.cutSize.toFixed(1)}</span>
                    </div>
                  </div>
                )}
                {currentGeometry === GeometryType.CUSTOM && customModelUrl && (
                  <div className="pt-2 mt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-purple-400 w-8 font-medium">缩放</label>
                      <input type="range" min="0.2" max="3" step="0.1" value={geoParams.customModelScale || 1} onChange={(e) => handleParamChange('customModelScale' as keyof GeometryParams, parseFloat(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500" />
                      <span className="text-[10px] text-purple-300 w-8 text-right font-mono bg-purple-500/10 px-1.5 py-0.5 rounded">{(geoParams.customModelScale || 1).toFixed(1)}</span>
                    </div>
                  </div>
                )}
                {currentGeometry === GeometryType.CUSTOM_PRISM && (
                  <div className="pt-2 mt-2 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-cyan-400 w-10 font-medium">边数</label>
                      <input type="range" min="3" max="12" step="1" value={geoParams.prismSides ?? 6} onChange={(e) => handleParamChange('prismSides' as keyof GeometryParams, parseInt(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                      <span className="text-[10px] text-cyan-300 w-8 text-right font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded">{geoParams.prismSides ?? 6}</span>
                    </div>
                  </div>
                )}
                {currentGeometry === GeometryType.CUSTOM_STEPPED && (
                  <div className="pt-2 mt-2 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-cyan-400 w-10 font-medium">层数</label>
                      <input type="range" min="2" max="5" step="1" value={geoParams.stepCount ?? 3} onChange={(e) => handleParamChange('stepCount' as keyof GeometryParams, parseInt(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                      <span className="text-[10px] text-cyan-300 w-8 text-right font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded">{geoParams.stepCount ?? 3}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-cyan-400 w-10 font-medium">样式</label>
                      <button onClick={() => setGeoParams(p => ({ ...p, stepStyle: 'pyramid' }))} className={`flex-1 text-[10px] py-1.5 rounded transition-all ${(geoParams.stepStyle ?? 'pyramid') === 'pyramid' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>金字塔</button>
                      <button onClick={() => setGeoParams(p => ({ ...p, stepStyle: 'stair' }))} className={`flex-1 text-[10px] py-1.5 rounded transition-all ${geoParams.stepStyle === 'stair' ? 'bg-cyan-500/30 text-cyan-200' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>阶梯</button>
                    </div>
                  </div>
                )}
                {currentGeometry === GeometryType.CUSTOM_HOLE_BLOCK && (
                  <div className="pt-2 mt-2 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-cyan-400 w-10 font-medium">孔数</label>
                      <input type="range" min="1" max="4" step="1" value={geoParams.holeCount ?? 2} onChange={(e) => handleParamChange('holeCount' as keyof GeometryParams, parseInt(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                      <span className="text-[10px] text-cyan-300 w-8 text-right font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded">{geoParams.holeCount ?? 2}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-cyan-400 w-10 font-medium">孔径</label>
                      <input type="range" min="0.2" max="1.2" step="0.05" value={geoParams.holeDiameter ?? 0.5} onChange={(e) => handleParamChange('holeDiameter' as keyof GeometryParams, parseFloat(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                      <span className="text-[10px] text-cyan-300 w-8 text-right font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded">{(geoParams.holeDiameter ?? 0.5).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {currentGeometry === GeometryType.CUSTOM_DOUBLE_SLOT && (
                  <div className="pt-2 mt-2 border-t border-white/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-cyan-400 w-10 font-medium">槽宽</label>
                      <input type="range" min="0.1" max="1.2" step="0.05" value={geoParams.slotWidth ?? 0.4} onChange={(e) => handleParamChange('slotWidth' as keyof GeometryParams, parseFloat(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                      <span className="text-[10px] text-cyan-300 w-8 text-right font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded">{(geoParams.slotWidth ?? 0.4).toFixed(2)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-[10px] text-cyan-400 w-10 font-medium">槽深</label>
                      <input type="range" min="0.1" max="1.8" step="0.05" value={geoParams.slotDepth ?? 1.0} onChange={(e) => handleParamChange('slotDepth' as keyof GeometryParams, parseFloat(e.target.value))} className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500" />
                      <span className="text-[10px] text-cyan-300 w-8 text-right font-mono bg-cyan-500/10 px-1.5 py-0.5 rounded">{(geoParams.slotDepth ?? 1.0).toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {currentGeometry === GeometryType.CSG_WORKSHOP && (
                  <div className="pt-2 mt-2 border-t border-white/10">
                    <CSGWorkshopPanel />
                  </div>
                )}
              </div>
            </div>
          </section>
          <section>
            <h2 className="text-[10px] font-semibold text-indigo-400/80 mb-2.5 flex items-center gap-1.5 uppercase tracking-wider">
              <Eye size={12} className="text-indigo-400" /> 视图控制
              <div className="flex-1 h-px bg-gradient-to-r from-indigo-500/30 to-transparent ml-2" />
            </h2>
            <div className="space-y-1.5">
              <button onClick={() => setIsUnfolded(!isUnfolded)} className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all border group ${isUnfolded ? 'bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-emerald-500/30 text-emerald-300' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-emerald-500/30'}`}>
                <span className="flex items-center gap-1.5 text-[11px]">{isUnfolded ? <Minimize size={14} /> : <Maximize size={14} />}{isUnfolded ? '折叠投影面' : '展开投影面'}</span>
                <div className={`w-2 h-2 rounded-full transition-all ${isUnfolded ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-slate-500'}`} />
              </button>
              <button onClick={() => setShowAxonometric(!showAxonometric)} className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all border ${showAxonometric ? 'bg-gradient-to-r from-violet-600/20 to-purple-600/20 border-violet-500/30 text-violet-300' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-violet-500/30'}`}>
                <span className="flex items-center gap-1.5 text-[11px]">📐 轴测投影</span>
                <div className={`w-2 h-2 rounded-full transition-all ${showAxonometric ? 'bg-violet-400 shadow-lg shadow-violet-400/50' : 'bg-slate-500'}`} />
              </button>
              {showAxonometric && (
                <div className="flex gap-1 p-1.5 bg-violet-500/10 rounded-lg border border-violet-500/20">
                  {[{ id: 'isometric' as const, label: '等轴测' }, { id: 'dimetric' as const, label: '二等轴测' }, { id: 'cabinet' as const, label: '斜二测' }].map(({ id, label }) => (
                    <button key={id} onClick={() => setAxonometricType(id)} className={`flex-1 py-1.5 rounded-md text-[9px] transition-all ${axonometricType === id ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}>{label}</button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                <button onClick={() => setUseOrthographic(!useOrthographic)} className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-[11px] transition-all border ${useOrthographic ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}>{useOrthographic ? <Scan size={12} /> : <Video size={12} />}{useOrthographic ? '正交' : '透视'}</button>
                <button onClick={() => setShowObject(!showObject)} className={`flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-[11px] transition-all border ${showObject ? 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10' : 'bg-white/5 text-slate-500 border-white/10'}`}>{showObject ? <Eye size={12} /> : <EyeOff size={12} />}{showObject ? '实体' : '隐藏'}</button>
              </div>
              <button onClick={() => setShowProjectors(!showProjectors)} className={`w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-[11px] transition-all border ${showProjectors ? 'bg-gradient-to-r from-rose-600/20 to-pink-600/20 text-rose-300 border-rose-500/30' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}><PenTool size={12} />{showProjectors ? '投影线 ON' : '投影线 OFF'}</button>

              <button onClick={() => setHighlightEnabled(!highlightEnabled)} className={`w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-[11px] transition-all border ${highlightEnabled ? 'bg-gradient-to-r from-amber-600/20 to-yellow-600/20 text-amber-300 border-amber-500/30' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}><Sparkles size={12} />{highlightEnabled ? '联动高亮 ON' : '联动高亮 OFF'}</button>

              <button onClick={() => setCorrespondenceLinesEnabled(!correspondenceLinesEnabled)} disabled={!highlightEnabled} className={`w-full flex items-center justify-center gap-1.5 p-2.5 rounded-lg text-[11px] transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${correspondenceLinesEnabled && highlightEnabled ? 'bg-gradient-to-r from-emerald-600/20 to-cyan-600/20 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'}`}><Layers size={12} />{correspondenceLinesEnabled ? '三等关系辅助线 ON' : '三等关系辅助线 OFF'}</button>
              
              {/* 截平面控制 */}
              <button onClick={() => setShowSectionPlane(!showSectionPlane)} className={`w-full flex items-center justify-between p-2.5 rounded-lg transition-all border ${showSectionPlane ? 'bg-gradient-to-r from-red-600/20 to-orange-600/20 border-red-500/30 text-red-300' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-red-500/30'}`}>
                <span className="flex items-center gap-1.5 text-[11px]">✂️ 截平面</span>
                <div className={`w-2 h-2 rounded-full transition-all ${showSectionPlane ? 'bg-red-400 shadow-lg shadow-red-400/50' : 'bg-slate-500'}`} />
              </button>
              {showSectionPlane && (
                <div className="space-y-2 p-2.5 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-red-400 w-12">高度 Y</label>
                    <input 
                      type="range" 
                      min={-1.5} 
                      max={1.5} 
                      step={0.1} 
                      value={sectionPlanePosition[1]} 
                      onChange={(e) => setSectionPlanePosition([sectionPlanePosition[0], parseFloat(e.target.value), sectionPlanePosition[2]])} 
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-red-500" 
                    />
                    <span className="text-[10px] text-red-300 w-8 text-right font-mono">{sectionPlanePosition[1].toFixed(1)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-orange-400 w-12">旋转 X</label>
                    <input 
                      type="range" 
                      min={0} 
                      max={Math.PI} 
                      step={0.1} 
                      value={sectionPlaneRotation[0]} 
                      onChange={(e) => setSectionPlaneRotation([parseFloat(e.target.value), sectionPlaneRotation[1], sectionPlaneRotation[2]])} 
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500" 
                    />
                    <span className="text-[10px] text-orange-300 w-8 text-right font-mono">{(sectionPlaneRotation[0] * 180 / Math.PI).toFixed(0)}°</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[10px] text-yellow-400 w-12">旋转 Y</label>
                    <input 
                      type="range" 
                      min={-Math.PI / 2} 
                      max={Math.PI / 2} 
                      step={0.1} 
                      value={sectionPlaneRotation[1]} 
                      onChange={(e) => setSectionPlaneRotation([sectionPlaneRotation[0], parseFloat(e.target.value), sectionPlaneRotation[2]])} 
                      className="flex-1 h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-yellow-500" 
                    />
                    <span className="text-[10px] text-yellow-300 w-8 text-right font-mono">{(sectionPlaneRotation[1] * 180 / Math.PI).toFixed(0)}°</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Left Sidebar Toggle */}
      {!sidebarOpen && (
        <button onClick={() => setSidebarOpen(true)} className="absolute top-4 left-4 z-30 p-2.5 bg-gradient-to-br from-slate-800/95 to-slate-900/95 backdrop-blur-xl rounded-xl shadow-lg border border-indigo-500/30 text-white hover:border-indigo-500/50 hover:shadow-indigo-500/20 transition-all group">
          <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform" />
        </button>
      )}

      {/* 3D Canvas */}
      <div className="flex-1 relative">
        {/* Legend */}
        <div className="absolute top-4 left-4 z-10">
          <div className="bg-gradient-to-br from-slate-900/95 to-slate-800/95 backdrop-blur-xl px-4 py-3 rounded-xl border border-indigo-500/20 text-white shadow-xl shadow-black/20">
            <h4 className="text-[10px] font-semibold text-indigo-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              投影面
            </h4>
            <div className="space-y-1.5 text-[10px]">
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-gradient-to-br from-red-300 to-red-400 shadow-sm"></span><span className="text-slate-300">V - 主视图</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-gradient-to-br from-sky-300 to-sky-400 shadow-sm"></span><span className="text-slate-300">H - 俯视图</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-gradient-to-br from-green-300 to-green-400 shadow-sm"></span><span className="text-slate-300">W - 左视图</span></div>
              <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-md bg-gradient-to-br from-amber-300 to-amber-400 shadow-sm"></span><span className="text-slate-300">R - 右视图</span></div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="absolute bottom-4 left-4 z-10">
          <div className="bg-gradient-to-r from-slate-900/95 to-slate-800/95 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-indigo-500/20 text-white shadow-xl shadow-black/20">
            <p className="text-[10px] text-slate-400 flex items-center gap-2">
              <span className="text-indigo-400">💡</span>
              <span>拖拽旋转</span>
              <span className="text-indigo-500/50">·</span>
              <span>滚轮缩放</span>
              <span className="text-indigo-500/50">·</span>
              <span>右键平移</span>
            </p>
          </div>
        </div>

        {/* 当前形体名称 */}
        <div className="absolute top-4 right-4 z-10">
          <div className="bg-gradient-to-r from-indigo-600/90 to-purple-600/90 backdrop-blur-xl px-4 py-2 rounded-xl border border-indigo-400/30 text-white shadow-xl shadow-indigo-500/20">
            <p className="text-sm font-medium">{GEOMETRIES.find(g => g.id === currentGeometry)?.name || '形体'}</p>
          </div>
        </div>

        <Canvas shadows dpr={[1, 2]}>
          <GlassBoxScene 
            geometryType={currentGeometry} 
            geometryParams={geoParams} 
            isUnfolded={isUnfolded} 
            showObject={showObject} 
            showProjectors={showProjectors} 
            useOrthographic={useOrthographic} 
            showAxonometric={showAxonometric} 
            axonometricType={axonometricType} 
            drawCompleted={drawCompleted} 
            drawnPoints={drawnPoints} 
            drawnDepth={drawnDepth} 
            onDrawComplete={handleDrawComplete}
            showSectionPlane={showSectionPlane}
            sectionPlanePosition={sectionPlanePosition}
            sectionPlaneRotation={sectionPlaneRotation}
          />
        </Canvas>
        <HoverLegend geometryType={currentGeometry} params={geoParams} />
      </div>

      {/* Right Sidebar - AI Assistant */}
      <div className={`${rightSidebarOpen ? 'w-80' : 'w-0'} shrink-0 transition-all duration-300 ease-out bg-gradient-to-b from-slate-800/98 to-slate-900/98 backdrop-blur-xl border-l border-indigo-500/20 flex flex-col relative z-20 overflow-hidden`}>
        {/* 侧边栏装饰线 */}
        <div className="absolute top-0 left-0 w-px h-full bg-gradient-to-b from-purple-500/50 via-indigo-500/30 to-transparent" />
        
        <div className="p-4 border-b border-indigo-500/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/40 relative">
              <Sparkles size={18} className="text-white" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/20 to-transparent" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white flex items-center gap-1.5">
                AI 助教
                {isLoadingAi && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />}
              </h2>
              <p className="text-[9px] text-indigo-400/80 tracking-wider">DEEPSEEK POWERED</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {isLoadingAi && (
              <div className="flex items-center gap-1 px-2 py-1 bg-indigo-500/20 rounded-lg border border-indigo-500/30">
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </span>
              </div>
            )}
            <button onClick={() => setShowApiKeyModal(true)} className={`p-1.5 rounded-lg transition-all ${hasApiKey ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-amber-400 hover:bg-amber-500/20 animate-pulse'}`} title={hasApiKey ? "API Key 已设置" : "设置 API Key"}><Key size={14} /></button>
            <button onClick={() => setRightSidebarOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          {!hasApiKey && (
            <div className="mb-3 p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-xl text-[11px] text-amber-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <span className="text-lg">🔑</span>
              </div>
              <div><p className="font-medium">需要 API Key</p><p className="text-amber-300/70 text-[9px]">点击右上角钥匙图标设置</p></div>
            </div>
          )}
          
          {/* 对话消息区域 */}
          <div ref={aiContentRef} onScroll={() => { shouldAutoScrollRef.current = checkShouldAutoScroll(); }} className="flex-1 bg-gradient-to-br from-slate-900/80 to-slate-800/80 rounded-xl p-3 border border-indigo-500/20 overflow-y-auto scrollbar-thin scrollbar-thumb-indigo-500/30 scrollbar-track-transparent relative">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.02)_1px,transparent_1px)] bg-[size:15px_15px] pointer-events-none rounded-xl" />
            <div className="relative z-10 space-y-3">
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 py-8">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                    <MessageSquare size={24} className="text-indigo-400/50" />
                  </div>
                  <p className="text-xs text-slate-400">选择形体开始学习</p>
                </div>
              ) : (
                <>
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
                          : 'bg-slate-700/50 border border-slate-600/30'
                      }`}>
                        <div className="prose prose-sm prose-invert max-w-none prose-p:text-[12px] prose-p:leading-relaxed prose-p:my-1 prose-strong:text-indigo-300 prose-ul:text-[12px] prose-ol:text-[12px] prose-li:my-0.5">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  ))}
                  {/* 正在生成的消息 */}
                  {currentAssistantMessage && (
                    <div className="flex justify-start">
                      <div className="max-w-[85%] rounded-xl px-3 py-2 bg-slate-700/50 border border-slate-600/30">
                        <div className="prose prose-sm prose-invert max-w-none prose-p:text-[12px] prose-p:leading-relaxed prose-p:my-1 prose-strong:text-indigo-300">
                          <ReactMarkdown>{currentAssistantMessage}</ReactMarkdown>
                          <span className="inline-block w-1.5 h-4 bg-gradient-to-t from-indigo-400 to-purple-400 animate-pulse ml-0.5 align-middle rounded-sm"></span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* 输入区域 */}
          <div className="mt-3 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入你的问题或回答..."
                disabled={!hasApiKey || isLoadingAi}
                className="flex-1 px-3 py-2.5 bg-slate-800/80 border border-indigo-500/30 rounded-xl text-[12px] text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-all disabled:opacity-50"
              />
              {isLoadingAi ? (
                <button onClick={handleStopAi} className="px-3 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-xl transition-all border border-red-500/30">
                  <StopCircle size={16} />
                </button>
              ) : (
                <button 
                  onClick={handleSendMessage} 
                  disabled={!hasApiKey || !userInput.trim()} 
                  className="px-3 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                  <ChevronRight size={16} />
                </button>
              )}
            </div>
            <p className="text-[9px] text-slate-500 text-center">按 Enter 发送 · AI 老师会引导你学习画法几何</p>
          </div>
        </div>
      </div>

      {/* Right Sidebar Toggle */}
      {!rightSidebarOpen && (
        <button onClick={() => setRightSidebarOpen(true)} className="absolute top-16 right-4 z-30 p-3 bg-gradient-to-br from-indigo-600 to-purple-600 backdrop-blur-xl rounded-xl shadow-lg shadow-indigo-500/30 border border-indigo-400/30 text-white hover:from-indigo-500 hover:to-purple-500 hover:shadow-indigo-500/50 hover:scale-105 transition-all flex items-center gap-2 group">
          <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-medium">AI 助教</span>
        </button>
      )}
    </div>
  );
};

export default App;
