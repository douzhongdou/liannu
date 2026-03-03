import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import fs from 'fs'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse, NextFunction } from 'http'

// 创建一个Vite插件来处理JSON文件请求
const jsonFilePlugin = {
  name: 'json-file-plugin',
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: NextFunction) => {
      if (req.url === '/dev-tasks.json') {
        const filePath = resolve(__dirname, '..', 'dev-tasks.json');
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.statusCode = 500;
            res.end('Error reading dev-tasks.json');
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
        });
      } else if (req.url === '/dev-task.lock') {
        const filePath = resolve(__dirname, '..', 'dev-task.lock');
        fs.readFile(filePath, (err, data) => {
          if (err) {
            res.statusCode = 500;
            res.end('Error reading dev-task.lock');
            return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(data);
        });
      } else {
        next();
      }
    });
  }
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), jsonFilePlugin],
  server: {
    port: 3000,
    open: true,
    // 确保热更新正常工作
    hmr: {
      enabled: true,
      // 增加超时时间，避免WSL环境下的连接问题
      timeout: 30000
    },
    // 增加文件监听的轮询间隔，解决Windows和WSL之间的文件系统问题
    watch: {
      usePolling: true,
      interval: 100
    }
  },
  // 配置别名，方便导入
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
