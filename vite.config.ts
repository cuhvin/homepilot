/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// In production, Vercel serves api/plan.ts as a serverless function.
// In `npm run dev`, this plugin routes /api/plan to the same handler so no Vercel CLI is needed.
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/plan', async (req, res) => {
        try {
          const mod = await server.ssrLoadModule('/api/plan.ts')
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const request = new Request(`http://localhost${req.originalUrl ?? '/api/plan'}`, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
          })
          const handler = req.method === 'POST' ? mod.POST : mod.GET
          const response: Response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (e) {
          res.statusCode = 500
          res.end(JSON.stringify({ ok: false, code: 'dev_error', message: String(e) }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // expose GEMINI_API_KEY / GEMINI_MODEL / MOCK_LLM from .env.local to the dev API (server only)
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK_MODEL', 'MOCK_LLM']) if (env[k]) process.env[k] = env[k]
  return {
    plugins: [react(), devApi()],
    test: { include: ['tests/**/*.test.ts'] },
    build: { chunkSizeWarningLimit: 1200 },
  }
})
