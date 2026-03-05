import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'
import fs from 'fs'
import type { ViteDevServer } from 'vite'
import type { IncomingMessage, ServerResponse } from 'http'

// 数据文件路径
const TASKS_FILE = resolve(__dirname, '..', 'task.json')
const LOCK_FILE = resolve(__dirname, '..', 'task.lock')
const AGENT_STATUS_FILE = resolve(__dirname, '..', 'agent-status.json')

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept',
  'Content-Type': 'application/json'
}

// 读取 JSON 文件
function readJsonFile(filePath: string): any {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    console.error(`[API] Error reading ${filePath}:`, err)
    return null
  }
}

// 状态映射
const STATUS_MAPPING: Record<string, string> = {
  "pending": "pending",
  "in_progress": "running",
  "done": "completed",
  "error": "failed",
  "ready_to_integrate": "ready_to_integrate",
  "running": "running",
  "completed": "completed",
  "failed": "failed"
}

// 转换任务状态
function convertTaskStatus(task: any): any {
  const backendStatus = task.status || "pending"
  return {
    ...task,
    status: STATUS_MAPPING[backendStatus] || backendStatus
  }
}

// API 插件
const apiPlugin = {
  name: 'api-plugin',
  configureServer(server: ViteDevServer) {
    server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
      const url = req.url || ''
      
      // 处理 CORS 预检请求
      if (req.method === 'OPTIONS') {
        res.writeHead(200, corsHeaders)
        res.end()
        return
      }

      // API 路由
      if (url === '/api/tasks') {
        console.log('[API] GET /api/tasks')
        const data = readJsonFile(TASKS_FILE)
        if (data && data.tasks) {
          data.tasks = data.tasks.map(convertTaskStatus)
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify(data))
        } else {
          res.writeHead(200, corsHeaders)
          res.end(JSON.stringify({ version: '1.0', tasks: [] }))
        }
        return
      }

      if (url === '/api/locks') {
        console.log('[API] GET /api/locks')
        const data = readJsonFile(LOCK_FILE)
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify(data || { version: '1.0', locks: [] }))
        return
      }

      if (url === '/api/dashboard') {
        console.log('[API] GET /api/dashboard')
        const tasksData = readJsonFile(TASKS_FILE) || { version: '1.0', tasks: [] }
        const locksData = readJsonFile(LOCK_FILE) || { version: '1.0', locks: [] }
        
        const tasks = tasksData.tasks || []
        const stats = {
          total: tasks.length,
          pending: tasks.filter((t: any) => t.status === 'pending').length,
          running: tasks.filter((t: any) => t.status === 'in_progress' || t.status === 'running').length,
          completed: tasks.filter((t: any) => t.status === 'done' || t.status === 'completed').length,
          failed: tasks.filter((t: any) => t.status === 'error' || t.status === 'failed').length,
          ready_to_integrate: tasks.filter((t: any) => t.status === 'ready_to_integrate').length,
        }

        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({
          tasks: tasksData,
          locks: locksData,
          stats,
          timestamp: new Date().toISOString()
        }))
        return
      }

      if (url === '/api/agents') {
        console.log('[API] GET /api/agents')
        const data = readJsonFile(AGENT_STATUS_FILE)
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify(data || { updated_at: new Date().toISOString(), workers: {}, history: [] }))
        return
      }

      if (url === '/api/health') {
        res.writeHead(200, corsHeaders)
        res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
        return
      }

      next()
    })
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), apiPlugin],
  server: {
    port: 3000,
    open: true,
    hmr: {
      timeout: 30000
    },
    watch: {
      usePolling: true,
      interval: 100
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  }
})
