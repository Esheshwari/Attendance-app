import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import healthHandler from './api/health.ts';
import authHandler from './api/auth.ts';
import attendanceHandler from './api/attendance.ts';
import leavesHandler from './api/leaves.ts';
import teamHandler from './api/team.ts';
import resetHandler from './api/reset.ts';
import exportHandler from './api/export.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json());

// Mount Vercel-compatible API handlers locally for AI Studio preview & full-stack Node runs
app.all('/api/health', (req, res) => healthHandler(req as any, res as any));
app.all('/api/auth', (req, res) => authHandler(req as any, res as any));
app.all('/api/attendance', (req, res) => attendanceHandler(req as any, res as any));
app.all('/api/leaves', (req, res) => leavesHandler(req as any, res as any));
app.all('/api/team', (req, res) => teamHandler(req as any, res as any));
app.all('/api/reset', (req, res) => resetHandler(req as any, res as any));
app.all('/api/export', (req, res) => exportHandler(req as any, res as any));

async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Vantrex Attendance Portal server running on http://0.0.0.0:${PORT}`);
  });
}

start();
