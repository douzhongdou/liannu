import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import fs from 'fs'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/tasks', (req, res, next) => {
          try {
            const data = fs.readFileSync(path.resolve(__dirname, '../dev-tasks.json'), 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(data)
          } catch (e) {
            res.statusCode = 500
            res.end(JSON.stringify({ error: 'Failed to read tasks file' }))
          }
        })
        server.middlewares.use('/api/locks', (req, res, next) => {
          try {
            const data = fs.readFileSync(path.resolve(__dirname, '../dev-task.lock'), 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(data)
          } catch (e) {
            res.statusCode = 404
            res.end(JSON.stringify({ version: '1.0', locks: [] }))
          }
        })
      },
    },
  ],
  server: {
    fs: {
      allow: [
        path.resolve(__dirname, '.'),
        path.resolve(__dirname, '..'),
      ],
    },
  },
})
