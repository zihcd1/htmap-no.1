import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {
  // 获取环境变量（包括 Render 里的）
  const env = loadEnv(mode, process.cwd(), '');
  
  // 优先获取我们在 Render 设置的 Key
  const finalKey = process.env.GOOGLE_API_KEY || process.env.VITE_GOOGLE_API_KEY || env.GOOGLE_API_KEY || '';

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      // 🛡️ 保险 1：如果代码里写了 process.env.xxx，这里直接把 Key 填进去
      'process.env.GEMINI_API_KEY': JSON.stringify(finalKey),
      'process.env.API_KEY': JSON.stringify(finalKey),
      'process.env.GOOGLE_API_KEY': JSON.stringify(finalKey),
      'process.env.VITE_GOOGLE_API_KEY': JSON.stringify(finalKey),
      
      // 🛡️ 保险 2：如果代码里直接用了 process.env（没有点），防止它报错
      'process.env': JSON.stringify({
         GEMINI_API_KEY: finalKey,
         API_KEY: finalKey,
         GOOGLE_API_KEY: finalKey
      }),
    },
  };
});