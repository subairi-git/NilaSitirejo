import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { mqttService } from './server/mqttService';
import { pltsService } from './server/pltsService';
import { databaseService } from './server/databaseService';
import { authenticateUser, registerUser, verifyAuthToken, changeUserPassword, getAllUsers } from './server/authService';

const FIVE_MINUTES_MS = 5 * 60 * 1000;

function normalizeDays(value: unknown): 1 | 7 | 30 {
  const parsed = Number(value);
  if (parsed === 7) return 7;
  if (parsed === 30) return 30;
  return 1;
}

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  await databaseService.connect();

  app.use(express.json());

  // CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Auth Middleware helper
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Token autentikasi tidak ditemukan. Harap login.' });
    }
    const token = authHeader.split(' ')[1];
    const user = verifyAuthToken(token);
    if (!user) {
      return res.status(401).json({ error: 'Sesi kedaluwarsa atau token tidak valid.' });
    }
    (req as any).user = user;
    next();
  };

  // Simpan snapshot hanya jika bucket 5 menit saat ini belum punya data.
  const persistLatestTelemetry = async () => {
    const latest = mqttService.latestTelemetry;

    // mqttService mempunyai data awal/default; received_at menjadi indikator bahwa
    // data telemetri aktual sudah pernah diterima.
    if (!latest || !latest.received_at) return false;

    const plts = pltsService.lastSummary;

    const pltsSnapshot = plts
      ? {
          pvPowerW: Number.isFinite(plts.pvPowerW) ? plts.pvPowerW : null,
          pvPowerKW: Number.isFinite(plts.pvPowerKW) ? plts.pvPowerKW : null,
          batterySocPct: Number.isFinite(plts.batterySocPct) ? plts.batterySocPct : null,
          batteryPowerW: Number.isFinite(plts.batteryPowerW) ? plts.batteryPowerW : null,
          loadPowerW: Number.isFinite(plts.loadPowerW) ? plts.loadPowerW : null,
          gridPowerW: Number.isFinite(plts.gridPowerW) ? plts.gridPowerW : null,
          gridVoltageV: Number.isFinite(plts.gridVoltageV) ? plts.gridVoltageV : null,
          gridFrequencyHz: Number.isFinite(plts.gridFrequencyHz) ? plts.gridFrequencyHz : null,
          loadCurrentA: Number.isFinite(plts.loadCurrentA) ? plts.loadCurrentA : null,
          workingState: plts.workingState || null,
          isGridActive:
            typeof plts.isGridActive === 'boolean' ? plts.isGridActive : null,
          isGridAvailable:
            typeof (plts as any).isGridAvailable === 'boolean'
              ? (plts as any).isGridAvailable
              : null,
          batteryDirection: plts.batteryDirection || null,
          gridDirection: (plts as any).gridDirection || null,
          connected: Boolean(plts.connected),
          lastUpdated: plts.lastUpdated || null,
        }
      : null;

    return databaseService.saveTelemetryIfDue(latest, pltsSnapshot);
  };

  // Backup scheduler. cron-job.org ke /api/health juga memanggil fungsi yang sama.
  const databaseTimer = setInterval(() => {
    void persistLatestTelemetry();
  }, FIVE_MINUTES_MS);

  // --- API ROUTES ---

  // Health check + trigger persistence untuk cron-job.org
  app.get('/api/health', async (req, res) => {
    const snapshotSaved = await persistLatestTelemetry();

    res.json({
      status: 'ok',
      time: new Date().toISOString(),
      mqttConnected: mqttService.isConnected,
      pltsConnected: pltsService.isConnected,
      mongodbConnected: databaseService.isConnected,
      mongodbLastError: databaseService.lastError,
      mongodbLastSavedAt: databaseService.lastSavedAt?.toISOString() || null,
      snapshotSaved,
      telemetryRecords: databaseService.isConnected
        ? await databaseService.countTelemetry()
        : 0,
    });
  });

  // Auth Endpoints
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email dan password wajib diisi' });
    }
    const authResult = authenticateUser(email, password);
    if (!authResult) {
      return res.status(401).json({ error: 'Email atau password salah' });
    }
    res.json({ success: true, ...authResult });
  });

  app.post('/api/auth/register', (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nama, email, dan password wajib diisi' });
    }
    try {
      const authResult = registerUser(name, email, password, role || 'operator');
      res.json({ success: true, ...authResult });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ success: true, user: (req as any).user });
  });

  app.post('/api/auth/change-password', requireAuth, (req, res) => {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Password lama dan baru wajib diisi' });
    }
    try {
      changeUserPassword((req as any).user.id, oldPassword, newPassword);
      res.json({ success: true, message: 'Password berhasil diperbarui' });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/auth/users', requireAuth, (req, res) => {
    res.json({ success: true, users: getAllUsers() });
  });

  // Aquaculture Telemetry Endpoints
  app.get('/api/telemetry/latest', (req, res) => {
    res.json({
      success: true,
      telemetry: mqttService.latestTelemetry,
      mqttStatus: mqttService.getStatus(),
    });
  });

  // MongoDB history: /api/telemetry/history?days=1|7|30&limit=10000
  app.get('/api/telemetry/history', async (req, res) => {
    try {
      const days = normalizeDays(req.query.days);
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 10000, 1),
        10000
      );
      const device = typeof req.query.device === 'string' ? req.query.device : undefined;

      if (databaseService.isConnected) {
        const history = await databaseService.getHistory({ days, limit, device });

        return res.json({
          success: true,
          source: 'mongodb',
          days,
          count: history.length,
          history,
        });
      }

      // Fallback RAM jika Atlas sedang tidak tersedia.
      const history = mqttService.telemetryHistory.slice(-Math.min(limit, 200));

      return res.json({
        success: true,
        source: 'memory',
        days,
        count: history.length,
        history,
      });
    } catch (error: any) {
      console.error('[API] telemetry history error:', error);
      res.status(500).json({
        success: false,
        error: error?.message || 'Gagal mengambil riwayat telemetry',
      });
    }
  });

  app.get('/api/telemetry/stats', async (req, res) => {
    try {
      const days = normalizeDays(req.query.days);
      const device = typeof req.query.device === 'string' ? req.query.device : undefined;

      const stats = databaseService.isConnected
        ? await databaseService.getStats(days, device)
        : {
            count: 0,
            firstRecordedAt: null,
            lastRecordedAt: null,
            ph: { avg: null, min: null, max: null },
            dissolvedOxygen: { avg: null, min: null, max: null },
            temperature: { avg: null, min: null, max: null },
            plts: {
              pvPowerW: { avg: null, min: null, max: null },
              batterySocPct: { avg: null, min: null, max: null },
              loadPowerW: { avg: null, min: null, max: null },
              gridPowerW: { avg: null, min: null, max: null },
              gridAvailableCount: 0,
              gridActiveCount: 0,
              latestGridAvailable: null,
              latestGridActive: null,
            },
          };

      res.json({
        success: true,
        days,
        source: databaseService.isConnected ? 'mongodb' : 'memory',
        stats,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error?.message || 'Gagal menghitung statistik',
      });
    }
  });

  // Export CSV langsung dari MongoDB.
  app.get('/api/telemetry/export.csv', async (req, res) => {
    try {
      const days = normalizeDays(req.query.days);
      const device = typeof req.query.device === 'string' ? req.query.device : undefined;
      const rows = databaseService.isConnected
        ? await databaseService.getHistory({ days, limit: 10000, device })
        : mqttService.telemetryHistory.slice(-200);

      const headers = [
        'Recorded_At',
        'Timestamp_Device',
        'Device',
        'pH',
        'pH_mV',
        'DO_mg_L',
        'DO_Saturation_pct',
        'Temperature_C',
        'DO_OK',
        'Modbus_Code',
        'WiFi_Connected',
        'WiFi_RSSI',
        'MQTT_Connected',
        'IP',
        'Uptime_s',
        'PLTS_Power_W',
        'Battery_SOC_pct',
        'Battery_Power_W',
        'Load_Power_W',
        'Grid_Power_W',
        'Grid_Voltage_V',
        'Grid_Frequency_Hz',
        'PLN_Available',
        'PLN_Active_Flow',
        'Battery_Direction',
        'Grid_Direction',
        'PLTS_Connected',
        'PLTS_Last_Updated',
      ];

      const csvRows = rows.map((row: any) => [
        escapeCsv(row.recordedAt ? new Date(row.recordedAt).toISOString() : row.received_at || ''),
        escapeCsv(row.timestamp || ''),
        escapeCsv(row.device || ''),
        escapeCsv(row.ph),
        escapeCsv(row.ph_mv),
        escapeCsv(row.do_mg_l),
        escapeCsv(row.do_saturation_pct),
        escapeCsv(row.water_temperature_c),
        escapeCsv(row.do_ok),
        escapeCsv(row.modbus_code),
        escapeCsv(row.wifi_connected),
        escapeCsv(row.wifi_rssi),
        escapeCsv(row.mqtt_connected),
        escapeCsv(row.ip),
        escapeCsv(row.uptime_s),
        escapeCsv(row.plts?.pvPowerW),
        escapeCsv(row.plts?.batterySocPct),
        escapeCsv(row.plts?.batteryPowerW),
        escapeCsv(row.plts?.loadPowerW),
        escapeCsv(row.plts?.gridPowerW),
        escapeCsv(row.plts?.gridVoltageV),
        escapeCsv(row.plts?.gridFrequencyHz),
        escapeCsv(row.plts?.isGridAvailable),
        escapeCsv(row.plts?.isGridActive),
        escapeCsv(row.plts?.batteryDirection),
        escapeCsv(row.plts?.gridDirection),
        escapeCsv(row.plts?.connected),
        escapeCsv(row.plts?.lastUpdated),
      ]);

      const csv = '\ufeff' + [
        headers.join(','),
        ...csvRows.map((row) => row.join(',')),
      ].join('\r\n');

      const filename = `telemetri-nilasense-${days}hari-${new Date().toISOString().slice(0, 10)}.csv`;

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error?.message || 'Gagal export CSV',
      });
    }
  });

  app.get('/api/telemetry/mqtt-status', (req, res) => {
    res.json({
      success: true,
      status: mqttService.getStatus(),
    });
  });

  app.post('/api/telemetry/simulate', (req, res) => {
    const { enable } = req.body;
    const active = mqttService.toggleSimulation(enable);
    res.json({ success: true, simulationActive: active });
  });

  app.post('/api/telemetry/reconnect', (req, res) => {
    const { broker, topic } = req.body;
    mqttService.connect(broker, topic);
    res.json({ success: true, message: 'Reconnecting to MQTT broker...' });
  });

  app.post('/api/mqtt/publish', requireAuth, async (req, res) => {
    const { command, params, deviceId, token, requestId, targetTopic } = req.body;
    if (!command) {
      return res.status(400).json({ error: 'Command parameter wajib diisi' });
    }
    try {
      const result = await mqttService.publishCommand(
        command,
        params || {},
        { deviceId, token, requestId, targetTopic }
      );
      res.json({ success: true, result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/mqtt/acks', (req, res) => {
    res.json({
      success: true,
      latestAck: mqttService.latestAck,
      history: mqttService.ackHistory,
      deviceStatus: mqttService.deviceStatus,
    });
  });

  app.get('/api/mqtt/device-info', (req, res) => {
    res.json({
      success: true,
      deviceInfo: mqttService.latestDeviceInfo,
      config: mqttService.latestConfig,
      deviceStatus: mqttService.deviceStatus,
    });
  });

  // Server-Sent Events (SSE) stream for real-time live telemetry & PLTS
  app.get('/api/telemetry/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Send initial snapshot
    res.write(`data: ${JSON.stringify({
      type: 'initial',
      telemetry: mqttService.latestTelemetry,
      mqttStatus: mqttService.getStatus(),
      plts: pltsService.lastSummary,
      latestAck: mqttService.latestAck,
      deviceInfo: mqttService.latestDeviceInfo,
      config: mqttService.latestConfig,
      deviceStatus: mqttService.deviceStatus,
    })}\n\n`);

    const onTelemetry = (data: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'telemetry',
        telemetry: data,
        mqttStatus: mqttService.getStatus(),
      })}\n\n`);
    };

    const onAck = (ack: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'ack',
        ack,
      })}\n\n`);
    };

    const onDeviceInfo = (info: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'device_info',
        deviceInfo: info,
      })}\n\n`);
    };

    const onConfig = (cfg: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'config',
        config: cfg,
      })}\n\n`);
    };

    const onDeviceStatus = (st: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'device_status',
        deviceStatus: st.status,
      })}\n\n`);
    };

    const onPlts = (data: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'plts',
        plts: data,
      })}\n\n`);
    };

    const onStatus = (_status: any) => {
      res.write(`data: ${JSON.stringify({
        type: 'status',
        mqttStatus: mqttService.getStatus(),
      })}\n\n`);
    };

    mqttService.on('telemetry', onTelemetry);
    mqttService.on('ack', onAck);
    mqttService.on('device_info', onDeviceInfo);
    mqttService.on('config', onConfig);
    mqttService.on('device_status', onDeviceStatus);
    mqttService.on('status', onStatus);
    pltsService.on('update', onPlts);

    // Heartbeat every 15s to keep connection alive
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      mqttService.off('telemetry', onTelemetry);
      mqttService.off('ack', onAck);
      mqttService.off('device_info', onDeviceInfo);
      mqttService.off('config', onConfig);
      mqttService.off('device_status', onDeviceStatus);
      mqttService.off('status', onStatus);
      pltsService.off('update', onPlts);
      res.end();
    });
  });

  // PLTS Solar Endpoints
  app.get('/api/plts/summary', (req, res) => {
    res.json({
      success: true,
      summary: pltsService.lastSummary,
      isConnected: pltsService.isConnected,
      lastFetchTime: pltsService.lastFetchTime,
      lastError: pltsService.lastError,
    });
  });

  app.get('/api/plts/flow', (req, res) => {
    res.json({
      success: true,
      data: pltsService.lastEnergyFlow,
      summary: pltsService.lastSummary,
      lastUpdated: pltsService.lastSummary?.lastUpdated,
      isConnected: pltsService.isConnected,
      lastFetchTime: pltsService.lastFetchTime,
    });
  });

  app.get('/api/plts/history', (req, res) => {
    res.json({
      success: true,
      history: pltsService.history,
    });
  });

  app.post('/api/plts/refresh', async (req, res) => {
    const summary = await pltsService.fetchLivePltsData();
    res.json({ success: true, summary });
  });

  app.post('/api/plts/config', requireAuth, async (req, res) => {
    const { deviceUrl, flowUrl } = req.body;
    const summary = await pltsService.setEndpoints(deviceUrl, flowUrl);
    res.json({ success: true, summary, config: pltsService.getEndpoints() });
  });

  // --- VITE & STATIC FILES ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NilaSense Server] Running on http://0.0.0.0:${PORT}`);
    console.log('[NilaSense Server] MongoDB:', databaseService.isConnected ? 'CONNECTED' : 'DISCONNECTED');
    console.log('[NilaSense Server] MQTT Target: broker.emqx.io:1883 | Topic: aquaculture/nila/data/nila-E0F908/telemetry');
  });

  const shutdown = async () => {
    clearInterval(databaseTimer);
    await databaseService.disconnect();
    httpServer.close(() => process.exit(0));
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

startServer().catch((error) => {
  console.error('[NilaSense Server] Fatal startup error:', error);
  process.exit(1);
});
