// vite.config.ts / vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // 本地开发（可选）
  server: {
    host: '0.0.0.0',
    // 如果你还要允许通过外部域名访问 dev server，可加：
    // allowedHosts: ['yardinventory.onrender.com']
  },

  // 生产预览（Render 用的是 vite preview）
  preview: {
    host: true, // 监听 0.0.0.0
    port: Number(process.env.PORT) || 4173,
    allowedHosts: ['yardinventory.onrender.com'], // 关键！
  },
});
