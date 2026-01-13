
import { ColorStop } from './types';

// 根据最新要求：1级在最顶层（最高值），4级在最底层（最低值/基座）
export const DEFAULT_STOPS: ColorStop[] = [
  { offset: 1.0, color: '#ef4444', alpha: 0.8 },   // 等级1: 最高 (Red) - 顶层
  { offset: 0.66, color: '#fbbf24', alpha: 0.8 },  // 等级2: 中高 (Yellow)
  { offset: 0.33, color: '#10b981', alpha: 0.8 },  // 等级3: 中低 (Green)
  { offset: 0.0, color: '#3b82f6', alpha: 0.8 }    // 等级4: 最低 (Blue) - 底层/基座
];

export const MAP_BG_COLOR = { r: 247, g: 247, b: 247 };
