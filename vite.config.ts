import { fileURLToPath, URL } from 'node:url';
import { loadEnv, type ProxyOptions } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const deepseekKey = env.DEEPSEEK_API_KEY?.trim();

  const proxy: Record<string, ProxyOptions> = {
    // 后端 Agent 网关（SSE）。未启动后端时前端自动回退到 mock 传输层。
    '/api': {
      target: process.env.VITE_PROXY_TARGET ?? env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000',
      changeOrigin: true,
    },
  };

  // 开发代理：DeepSeek Key 只留在 Node 侧，浏览器请求同源 /deepseek
  if (deepseekKey) {
    proxy['/deepseek'] = {
      target: env.DEEPSEEK_API_URL?.trim() || 'https://api.deepseek.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/deepseek/, ''),
      headers: { Authorization: `Bearer ${deepseekKey}` },
    };
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      proxy,
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'react',
                test: /[\\/]node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/,
              },
              { name: 'antd', test: /[\\/]node_modules[\\/](antd|@ant-design|@rc-component|rc-)/ },
              {
                name: 'markdown',
                test: /[\\/]node_modules[\\/](react-markdown|remark|rehype|unified|micromark|hast|mdast)/,
              },
            ],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
