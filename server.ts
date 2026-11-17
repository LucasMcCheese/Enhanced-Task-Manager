import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  isWindowsPlatform,
  WindowsHostRequiredError,
  WindowsNativeProvider,
} from './server/windowsNativeProvider.ts';
import type { ProcessPriority } from './src/services/systemService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function createAppServer() {
  const app = express();
  app.use(express.json());

  const provider = new WindowsNativeProvider();

  app.get('/api/windows/status', (_req, res) => {
    const win = isWindowsPlatform();
    res.json({
      isWindowsHost: win,
      platform: process.platform,
      arch: process.arch,
      hostname: os.hostname(),
      runtime: process.env.ELECTRON_APP === '1' ? 'electron-exe' : 'node-web',
      error: win ? null : 'WINDOWS_HOST_REQUIRED',
      message: win
        ? 'Connected to local Windows CIM/WMI native telemetry.'
        : `Windows detection failed: running on "${process.platform}" web environment. Run the code version locally on Windows or package as an .exe to access real Windows hardware and processes.`,
    });
  });

  app.get('/api/windows/snapshot', async (_req, res) => {
    try {
      const snapshot = await provider.getSnapshot();
      res.json(snapshot);
    } catch (err) {
      if (err instanceof WindowsHostRequiredError) {
        res.status(503).json({
          error: err.code,
          platform: err.platform,
          message: err.message,
        });
        return;
      }
      res.status(500).json({
        error: 'WINDOWS_TELEMETRY_FAILED',
        message: err instanceof Error ? err.message : 'Failed to query Windows telemetry.',
      });
    }
  });

  app.post('/api/windows/process/end', async (req, res) => {
    const pid = Number(req.body?.pid);
    try {
      await provider.endProcess(pid);
      res.json({ ok: true, pid });
    } catch (err) {
      if (err instanceof WindowsHostRequiredError) {
        res.status(503).json({ error: err.code, message: err.message });
        return;
      }
      res.status(400).json({
        error: 'END_PROCESS_FAILED',
        message: err instanceof Error ? err.message : 'Failed to terminate process.',
      });
    }
  });

  app.post('/api/windows/process/priority', async (req, res) => {
    const pid = Number(req.body?.pid);
    const priority = req.body?.priority as ProcessPriority;
    try {
      await provider.setProcessPriority(pid, priority);
      res.json({ ok: true, pid, priority });
    } catch (err) {
      if (err instanceof WindowsHostRequiredError) {
        res.status(503).json({ error: err.code, message: err.message });
        return;
      }
      res.status(400).json({
        error: 'SET_PRIORITY_FAILED',
        message: err instanceof Error ? err.message : 'Failed to change process priority.',
      });
    }
  });

  app.post('/api/windows/startup/toggle', async (req, res) => {
    const name = String(req.body?.name ?? '');
    const enabled = Boolean(req.body?.enabled);
    try {
      await provider.toggleStartupApp(name, enabled);
      res.json({ ok: true, name, enabled });
    } catch (err) {
      if (err instanceof WindowsHostRequiredError) {
        res.status(503).json({ error: err.code, message: err.message });
        return;
      }
      res.status(400).json({
        error: 'TOGGLE_STARTUP_FAILED',
        message: err instanceof Error ? err.message : 'Failed to toggle Windows startup item.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  return app;
}

const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

if (isDirectRun) {
  const port = Number(process.env.PORT) || 3000;
  createAppServer().then((app) => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Windows 11 Task Manager server listening on http://localhost:${port}`);
    });
  });
}
