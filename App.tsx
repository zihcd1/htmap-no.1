
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Download, RefreshCw, Sliders, Map as MapIcon, CheckCircle2, ZoomIn, ZoomOut, Maximize2, Minimize2, Droplets, Eraser, MousePointer2, Paintbrush, Sparkles, Undo2, Wand2, Thermometer, Flame, Target, ChevronRight, Share2, LogOut } from 'lucide-react';
import { ColorStop, IntensityMap, ProcessingState } from './types';
import { DEFAULT_STOPS, MAP_BG_COLOR } from './constants';
import { extractIntensity, renderHeatmap, addHeatPoint, removeHeatPoint, autoFillRegion } from './services/imageProcessing';
import ColorPicker from './components/ColorPicker';

const MAX_HISTORY = 20;

// Upgraded Premium Heatmap Icon
const HeatmapIcon = ({ size = "normal" }: { size?: "normal" | "large" }) => {
  const containerClass = size === "large" ? "w-20 h-20" : "w-8 h-8";
  const iconClass = size === "large" ? "w-10 h-10" : "w-4 h-4";
  return (
    <div className={`relative ${containerClass} flex items-center justify-center transition-transform hover:scale-110 duration-500`}>
      <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-lg animate-pulse" />
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl shadow-xl flex items-center justify-center overflow-hidden border border-white/20">
        <div className="absolute w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-amber-400/40 via-transparent to-transparent blur-md" />
        <Flame className={`${iconClass} text-white relative z-10 drop-shadow-md`} />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<ProcessingState>(ProcessingState.IDLE);
  const [stops, setStops] = useState<ColorStop[]>(DEFAULT_STOPS);
  const [history, setHistory] = useState<ColorStop[][]>([]);
  const [heatHistory, setHeatHistory] = useState<Float32Array[]>([]);
  const [intensityMap, setIntensityMap] = useState<IntensityMap | null>(null);
  const [opacity, setOpacity] = useState(1.0);
  const [sensitivity, setSensitivity] = useState(0.05); 
  const [blur, setBlur] = useState(0.3); 
  const [zoom, setZoom] = useState(1.0);
  const [interactionMode, setInteractionMode] = useState<'move' | 'draw' | 'erase'>('move');
  const [brushSize, setBrushSize] = useState(60);
  const [brushStrength, setBrushStrength] = useState(0.15); 
  const [brushAlpha, setBrushAlpha] = useState(1.0); 
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  
  const [isInteracting, setIsInteracting] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState({ left: 0, top: 0 });
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const calculateFitZoom = useCallback((mapWidth: number, mapHeight: number) => {
    if (!scrollContainerRef.current) return 1.0;
    const container = scrollContainerRef.current;
    const availableWidth = container.clientWidth - 128;
    const availableHeight = container.clientHeight - 128;
    const scaleX = availableWidth / mapWidth;
    const scaleY = availableHeight / mapHeight;
    return Math.min(scaleX, scaleY, 1.0);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setState(ProcessingState.LOADING);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = async () => {
        setRawImage(img);
        processImage(img, sensitivity);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const processImage = async (img: HTMLImageElement, sens: number) => {
    setState(ProcessingState.PROCESSING);
    try {
      const map = await extractIntensity(img, MAP_BG_COLOR, sens);
      setIntensityMap(map);
      setHeatHistory([]); 
      setState(ProcessingState.READY);
      
      if (state === ProcessingState.LOADING || state === ProcessingState.IDLE) {
        setTimeout(() => {
          const fitZoom = calculateFitZoom(map.width, map.height);
          setZoom(fitZoom);
        }, 50);
      }
    } catch (error) {
      console.error(error);
      setState(ProcessingState.ERROR);
    }
  };

  useEffect(() => {
    if (rawImage && state === ProcessingState.READY) {
      processImage(rawImage, sensitivity);
    }
  }, [sensitivity]);

  const handleStopsChange = (newStops: ColorStop[]) => {
    setHistory(prev => {
      const newHistory = [...prev, JSON.parse(JSON.stringify(stops))];
      if (newHistory.length > MAX_HISTORY) return newHistory.slice(newHistory.length - MAX_HISTORY);
      return newHistory;
    });
    setStops(newStops);
  };

  const handleUndo = useCallback(() => {
    if (history.length === 0) return;
    const prevHistory = [...history];
    const lastStops = prevHistory.pop()!;
    setStops(lastStops);
    setHistory(prevHistory);
  }, [history]);

  const handleHeatUndo = useCallback(() => {
    if (heatHistory.length === 0 || !intensityMap) return;
    const prevHeatHistory = [...heatHistory];
    const lastHeatData = prevHeatHistory.pop()!;
    intensityMap.data.set(lastHeatData);
    setHeatHistory(prevHeatHistory);
    triggerRender();
  }, [heatHistory, intensityMap]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if ((interactionMode === 'draw' || interactionMode === 'erase') && heatHistory.length > 0) {
          handleHeatUndo();
        } else if (history.length > 0) {
          handleUndo();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history, heatHistory, interactionMode, handleUndo, handleHeatUndo]);

  const triggerRender = useCallback(() => {
    if (state === ProcessingState.READY && intensityMap && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d', { willReadFrequently: true });
      if (ctx) renderHeatmap(ctx, intensityMap, stops, opacity, blur);
    }
  }, [state, intensityMap, stops, opacity, blur]);

  useEffect(() => {
    triggerRender();
  }, [triggerRender]);

  const saveHeatSnapshot = () => {
    if (!intensityMap) return;
    const snapshot = new Float32Array(intensityMap.data);
    setHeatHistory(prev => {
      const next = [...prev, snapshot];
      if (next.length > MAX_HISTORY) return next.slice(next.length - MAX_HISTORY);
      return next;
    });
  };

  const handleAutoColor = () => {
    if (!intensityMap) return;
    saveHeatSnapshot();
    intensityMap.data.fill(0); 
    autoFillRegion(intensityMap, MAP_BG_COLOR);
    triggerRender();
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    if (state !== ProcessingState.READY) return;
    if (e.button !== 0) return;
    
    setIsInteracting(true);
    setDragStart({ x: e.clientX, y: e.clientY });

    if (interactionMode === 'move' && scrollContainerRef.current) {
      setScrollStart({
        left: scrollContainerRef.current.scrollLeft,
        top: scrollContainerRef.current.scrollTop
      });
    } else if ((interactionMode === 'draw' || interactionMode === 'erase') && intensityMap && canvasRef.current) {
      saveHeatSnapshot();
      handleDraw(e);
    }

    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDraw = (e: React.PointerEvent) => {
    if (!intensityMap || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    
    if (interactionMode === 'draw') {
      addHeatPoint(intensityMap, x, y, brushSize, brushStrength, brushAlpha);
    } else if (interactionMode === 'erase') {
      removeHeatPoint(intensityMap, x, y, brushSize, brushStrength, brushAlpha);
    }
    
    triggerRender();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isInteracting) return;
    if (interactionMode === 'move' && scrollContainerRef.current) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      scrollContainerRef.current.scrollLeft = scrollStart.left - dx;
      scrollContainerRef.current.scrollTop = scrollStart.top - dy;
    } else if (interactionMode === 'draw' || interactionMode === 'erase') {
      handleDraw(e);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsInteracting(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'htmap-no.1-output.png';
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  const reset = () => {
    setIntensityMap(null);
    setRawImage(null);
    setState(ProcessingState.IDLE);
    setStops(DEFAULT_STOPS);
    setHistory([]);
    setHeatHistory([]);
    setOpacity(1.0);
    setZoom(1.0);
    setSensitivity(0.05);
    setBlur(0.3);
    setInteractionMode('move');
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans select-none relative">
      {/* Mesh Background for IDLE */}
      {state === ProcessingState.IDLE && (
        <>
          <div className="mesh-bg" />
          <div className="animated-blob" style={{ top: '10%', left: '10%' }} />
          <div className="animated-blob" style={{ bottom: '10%', right: '10%', animationDelay: '-5s', background: 'radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%)' }} />
        </>
      )}

      {/* Side Panel: Shown only when READY */}
      {state === ProcessingState.READY && (
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shadow-2xl z-30 relative shrink-0 animate-in slide-in-from-left duration-500">
          <div className="p-6 border-b border-slate-100 bg-gradient-to-br from-white to-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <HeatmapIcon />
              <h1 className="text-xl font-black text-slate-800 tracking-tight">htmap-no.1</h1>
            </div>
            <button onClick={reset} className="p-2 text-slate-300 hover:text-red-500 transition-colors" title="回到首页">
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="animate-in fade-in zoom-in duration-500 space-y-6">
              <div className="space-y-3 p-4 bg-indigo-50 rounded-2xl border border-indigo-100 shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-black text-indigo-700 uppercase tracking-widest flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> 笔触精控
                  </label>
                  <button 
                    onClick={handleHeatUndo} 
                    disabled={heatHistory.length === 0}
                    className={`p-1.5 rounded-lg transition-all ${heatHistory.length > 0 ? 'text-indigo-600 bg-indigo-200 shadow-sm hover:scale-105' : 'text-slate-300'}`}
                    title="撤销笔刷 (Ctrl+Z)"
                  >
                    <Undo2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button onClick={() => setInteractionMode('move')} className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${interactionMode === 'move' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}><MousePointer2 className="w-3.5 h-3.5" /> 拖拽</button>
                  <button onClick={() => setInteractionMode('draw')} className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${interactionMode === 'draw' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}><Paintbrush className="w-3.5 h-3.5" /> 涂抹</button>
                  <button onClick={() => setInteractionMode('erase')} className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${interactionMode === 'erase' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}><Eraser className="w-3.5 h-3.5" /> 擦除</button>
                  <button onClick={handleAutoColor} className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white shadow-lg hover:bg-emerald-700 transition-all border border-emerald-500"><Wand2 className="w-3.5 h-3.5" /> 智能色域</button>
                </div>

                {(interactionMode === 'draw' || interactionMode === 'erase') && (
                  <div className="space-y-4 pt-2 border-t border-indigo-100/50 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-tight"><span>半径</span><span>{brushSize}px</span></div>
                      <input type="range" min="5" max="300" value={brushSize} onChange={(e) => setBrushSize(parseInt(e.target.value))} className="w-full h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-tight"><span>笔触强度</span><span>{Math.round(brushStrength * 100)}%</span></div>
                      <input type="range" min="0.01" max="0.5" step="0.01" value={brushStrength} onChange={(e) => setBrushStrength(parseFloat(e.target.value))} className="w-full h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-tight"><span>笔尖浓度</span><span>{Math.round(brushAlpha * 100)}%</span></div>
                      <input type="range" min="0.1" max="1.0" step="0.01" value={brushAlpha} onChange={(e) => setBrushAlpha(parseFloat(e.target.value))} className="w-full h-1 bg-indigo-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><Sliders className="w-3.5 h-3.5" /> 色级解构</label>
                <ColorPicker stops={stops} onChange={handleStopsChange} onUndo={handleUndo} canUndo={history.length > 0} historyLength={history.length} />
              </div>

              <div className="space-y-3 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-black text-slate-600 flex items-center gap-2"><Droplets className="w-3 h-3 text-indigo-400" /> 边缘羽化</label>
                  <span className="text-[10px] font-black text-indigo-600">{Math.round(blur * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.01" value={blur} onChange={(e) => setBlur(parseFloat(e.target.value))} className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
              </div>

              <div className="grid grid-cols-1 gap-3 pt-4">
                <button onClick={handleDownload} className="w-full flex items-center justify-center gap-3 px-4 py-4 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all shadow-xl active:scale-95 font-black text-sm tracking-widest uppercase">
                  <Download className="w-4 h-4 text-amber-400" /> 导出作品
                </button>
                <button onClick={reset} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white text-slate-400 rounded-2xl border border-slate-200 hover:text-red-500 hover:border-red-200 transition-all font-bold text-[11px] uppercase tracking-widest">
                  <RefreshCw className="w-3.5 h-3.5" /> 全部重置回到首页
                </button>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Viewport */}
      <main className="flex-1 relative overflow-hidden z-10 flex flex-col">
        {state === ProcessingState.IDLE ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-8 relative z-20">
            <div className="max-w-xl w-full text-center space-y-12">
              <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                <HeatmapIcon size="large" />
                <h1 className="mt-8 text-7xl font-black text-white tracking-tighter drop-shadow-[0_10px_30px_rgba(99,102,241,0.5)]">
                  htmap-no.1
                </h1>
                <div className="h-1 w-24 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mt-4 opacity-50" />
                <p className="mt-6 text-indigo-200/70 text-lg font-medium tracking-wide">
                  下一代专业热力图色域重构引擎
                </p>
              </div>

              <div className="relative group animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-200">
                <div className="absolute -inset-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-[3rem] blur opacity-25 group-hover:opacity-100 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative bg-white/10 backdrop-blur-3xl border border-white/20 rounded-[3rem] p-16 flex flex-col items-center gap-8 transition-all duration-300 group-hover:bg-white/15 shadow-2xl">
                  <div className="w-24 h-24 bg-indigo-500/30 rounded-full flex items-center justify-center mb-2 shadow-inner ring-4 ring-white/5">
                    <Upload className="w-10 h-10 text-indigo-200 animate-bounce" />
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black text-white tracking-tight">开始您的创作</h3>
                    <p className="text-indigo-100/40 text-sm font-medium">支持上传常规地图或原始热力底图</p>
                  </div>
                  <button className="mt-4 px-12 py-5 bg-white text-indigo-950 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-[0_15px_30px_-10px_rgba(255,255,255,0.3)] hover:scale-105 transition-transform active:scale-95 flex items-center gap-3 relative overflow-hidden">
                    选择文件 <ChevronRight className="w-4 h-4" />
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-center gap-10 text-white/20 text-[10px] font-black uppercase tracking-[0.4em] animate-in fade-in duration-1000 delay-500">
                <span className="flex items-center gap-2 group cursor-default hover:text-indigo-400 transition-colors"><Target className="w-3.5 h-3.5" /> 高斯核笔刷</span>
                <span className="flex items-center gap-2 group cursor-default hover:text-purple-400 transition-colors"><CheckCircle2 className="w-3.5 h-3.5" /> 地名强保护</span>
                <span className="flex items-center gap-2 group cursor-default hover:text-pink-400 transition-colors"><Share2 className="w-3.5 h-3.5" /> 导出 PNG/SVG</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full relative">
            {state === ProcessingState.READY && (
              <div className="absolute top-6 left-6 z-40 flex flex-col gap-2 bg-white/90 backdrop-blur shadow-2xl border border-slate-200 p-2 rounded-2xl animate-in slide-in-from-left-4">
                <button onClick={() => setZoom(prev => Math.min(prev + 0.1, 5))} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-slate-600 hover:text-indigo-600 border border-slate-100 shadow-sm"><ZoomIn className="w-5 h-5" /></button>
                <div className="text-[10px] font-black text-slate-400 text-center py-1">{Math.round(zoom * 100)}%</div>
                <button onClick={() => setZoom(prev => Math.max(prev - 0.1, 0.05))} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-slate-600 hover:text-indigo-600 border border-slate-100 shadow-sm"><ZoomOut className="w-5 h-5" /></button>
                <div className="h-[1px] bg-slate-100 my-1 mx-1" />
                <button onClick={() => intensityMap && setZoom(calculateFitZoom(intensityMap.width, intensityMap.height))} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-slate-600 hover:text-indigo-600 border border-slate-100 shadow-sm" title="适应窗口"><Minimize2 className="w-5 h-5" /></button>
                <button onClick={() => setZoom(1.0)} className="p-2 hover:bg-indigo-50 rounded-xl transition-colors text-slate-600 hover:text-indigo-600 border border-slate-100 shadow-sm" title="原始比例"><Maximize2 className="w-5 h-5" /></button>
              </div>
            )}

            <div 
              ref={scrollContainerRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className={`w-full h-full overflow-auto custom-scrollbar flex p-24 items-center justify-center transition-colors ${isInteracting && interactionMode === 'move' ? 'cursor-grabbing bg-slate-200/50' : (state === ProcessingState.READY ? (interactionMode === 'draw' ? 'cursor-crosshair' : (interactionMode === 'erase' ? 'cursor-alias' : 'cursor-grab')) : '')}`}
            >
              {(state === ProcessingState.LOADING || state === ProcessingState.PROCESSING) && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0f172a]/90 backdrop-blur-2xl">
                  <div className="relative">
                    <div className="w-24 h-24 border-[8px] border-indigo-500/10 border-t-indigo-500 rounded-full animate-spin shadow-[0_0_50px_rgba(99,102,241,0.3)]"></div>
                    <Flame className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 text-indigo-400 animate-pulse" />
                  </div>
                  <p className="mt-10 text-sm font-black text-indigo-400 tracking-[0.6em] uppercase animate-pulse drop-shadow-lg">Initializing htmap Engine...</p>
                </div>
              )}

              {intensityMap && (
                <div 
                  className={`relative transition-transform duration-200 ease-out shadow-[0_60px_120px_-30px_rgba(0,0,0,0.6)] bg-white border-[16px] border-white rounded-[3rem] overflow-hidden shrink-0 pointer-events-none`}
                  style={{ width: intensityMap.width, height: intensityMap.height, transform: `scale(${zoom})`, transformOrigin: 'center center' }}
                >
                  <canvas ref={canvasRef} width={intensityMap.width} height={intensityMap.height} className="block" />
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
