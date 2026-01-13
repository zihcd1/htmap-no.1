
import React from 'react';
import { ColorStop } from '../types';
import { Undo2, Hash, Percent, Layers } from 'lucide-react';

interface ColorPickerProps {
  stops: ColorStop[];
  onChange: (stops: ColorStop[]) => void;
  onUndo: () => void;
  canUndo: boolean;
  historyLength: number;
}

const ColorPicker: React.FC<ColorPickerProps> = ({ stops, onChange, onUndo, canUndo, historyLength }) => {
  const handleColorChange = (index: number, color: string) => {
    const formattedColor = color.startsWith('#') ? color : `#${color}`;
    const newStops = stops.map((s, i) => i === index ? { ...s, color: formattedColor } : s);
    onChange(newStops);
  };

  const handleAlphaChange = (index: number, alpha: number) => {
    const clampedAlpha = Math.min(1, Math.max(0, alpha));
    const newStops = stops.map((s, i) => i === index ? { ...s, alpha: clampedAlpha } : s);
    onChange(newStops);
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          4层叠加热力渲染
        </h3>
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            canUndo 
            ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 shadow-sm active:scale-95' 
            : 'text-slate-300 bg-slate-50 cursor-not-allowed'
          }`}
        >
          <Undo2 className="w-3.5 h-3.5" />
          回退 ({historyLength})
        </button>
      </div>
      
      <div className="space-y-6">
        {stops.map((stop, idx) => (
          <div key={idx} className="space-y-2 group p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100 relative">
            <div className="flex items-center justify-between gap-3">
               <div className="flex items-center gap-2 flex-1">
                  <div className="flex flex-col items-center">
                    <span className="text-[9px] font-black text-slate-400 mb-1">L{idx + 1}</span>
                    <div className="relative shrink-0">
                      <input
                        type="color"
                        value={stop.color}
                        onChange={(e) => handleColorChange(idx, e.target.value)}
                        className="w-8 h-8 rounded-md cursor-pointer border border-slate-200 shadow-sm p-0 bg-transparent overflow-hidden"
                      />
                    </div>
                  </div>
                  <div className="relative flex-1 self-end">
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400">
                      <Hash className="w-3 h-3" />
                    </span>
                    <input
                      type="text"
                      value={stop.color.replace('#', '')}
                      onChange={(e) => handleColorChange(idx, e.target.value)}
                      className="w-full pl-6 pr-2 py-1 text-[11px] font-mono border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none"
                      placeholder="HEX"
                      maxLength={6}
                    />
                  </div>
               </div>

               <div className="flex items-center gap-2 w-24 self-end">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={Math.round(stop.alpha * 100)}
                      onChange={(e) => handleAlphaChange(idx, parseInt(e.target.value) / 100)}
                      className="w-full pl-2 pr-5 py-1 text-[11px] font-mono border border-slate-200 rounded-md focus:ring-1 focus:ring-indigo-500 outline-none text-right"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400">
                      <Percent className="w-2.5 h-2.5" />
                    </span>
                  </div>
               </div>
            </div>

            <div className="px-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={stop.alpha}
                onChange={(e) => handleAlphaChange(idx, parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
            
            {idx === 0 && <span className="absolute -right-1 top-0 text-[8px] font-bold text-indigo-500 bg-indigo-50 px-1 rounded">顶层</span>}
            {idx === 3 && <span className="absolute -right-1 bottom-0 text-[8px] font-bold text-slate-500 bg-slate-50 px-1 rounded">底层</span>}
          </div>
        ))}
      </div>

      <div className="relative pt-2">
        <p className="text-[10px] text-slate-400 mb-2 font-bold uppercase tracking-tight">叠加预览 (从 L4 到 L1)</p>
        <div className="w-full h-8 rounded-lg shadow-inner border border-slate-100 overflow-hidden flex relative bg-slate-50">
          {/* 这里模拟叠加视觉效果 */}
          {[3, 2, 1, 0].map((idx) => {
            const s = stops[idx];
            return (
              <div 
                key={idx}
                className="absolute inset-y-0"
                style={{
                  left: `${(3 - idx) * 25}%`,
                  right: 0,
                  backgroundColor: s.color,
                  opacity: s.alpha,
                  zIndex: 4 - idx
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-1.5 px-1">
          <span className="text-[9px] text-slate-400 font-bold tracking-tighter uppercase">基座 (L4)</span>
          <span className="text-[9px] text-slate-400 font-bold tracking-tighter uppercase">峰值 (L1)</span>
        </div>
      </div>
    </div>
  );
};

export default ColorPicker;
