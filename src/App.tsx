import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { WaterQualityOverview } from './components/WaterQualityOverview';
import { PltsEnergyFlow } from './components/PltsEnergyFlow';
import { TelemetryCharts } from './components/TelemetryCharts';
import { SensorDiagnostics } from './components/SensorDiagnostics';
import { DeviceCommandsModal } from './components/DeviceCommandsModal';
import { TelemetryHistoryTable } from './components/TelemetryHistoryTable';
import { TilapiaGuideModal } from './components/TilapiaGuideModal';
import { HppProductionDashboard } from './components/HppProductionDashboard';
import { LoginModal } from './components/LoginModal';
import { UserProfileModal } from './components/UserProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { TelemetryData, PltsSummary, User, ThresholdSettings } from './types';

export interface MqttStatus {
  connected: boolean;
  broker?: string;
  topic?: string;
  cmdTopic?: string;
  error?: string | null;
  deviceStatus?: 'online' | 'offline' | 'unknown';
  lastMessageTime?: number;
  lastMessageAt?: string | null;
  messageCount?: number;
  lastTelemetryTime?: number;
  lastTelemetryAt?: string | null;
  telemetryAgeSec?: number | null;
  telemetryState?: 'waiting' | 'live' | 'delayed' | 'stale';
  telemetryFresh?: boolean;
  simulationActive?: boolean;
  historyCount?: number;
  watchdogReconnectCount?: number;
}

const DEFAULT_THRESHOLDS: ThresholdSettings = {
  phMin: 6.0,
  phMax: 9.0,
  phWarningMin: 6.5,
  phWarningMax: 8.5,
  doMinGood: 5.0,
  doMinWarning: 3.0,
  tempMin: 20.0,
  tempMax: 35.0,
  tempOptMin: 25.0,
  tempOptMax: 30.0,
  enableAudioAlerts: false,
};

function formatTelemetryAge(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return 'belum ada data sensor';
  if (seconds < 60) return `${seconds} detik lalu`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} menit lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return `${Math.floor(seconds / 86400)} hari lalu`;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);
  const [history, setHistory] = useState<TelemetryData[]>([]);
  const [pltsSummary, setPltsSummary] = useState<PltsSummary | null>(null);
  const [mqttStatus, setMqttStatus] = useState<MqttStatus>({
    connected: false,
    broker: 'mqtt://broker.emqx.io:1883',
    topic: 'aquaculture/nila/data/+/telemetry',
    telemetryState: 'waiting',
    telemetryFresh: false,
    telemetryAgeSec: null,
  });
  const [simulationActive, setSimulationActive] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [thresholds, setThresholds] = useState<ThresholdSettings>(() => {
    const saved = localStorage.getItem('nilasense_thresholds');
    return saved ? JSON.parse(saved) : DEFAULT_THRESHOLDS;
  });

  // Modal states
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Restore User Session
  useEffect(() => {
    const savedToken = localStorage.getItem('nilasense_token');
    const savedUser = localStorage.getItem('nilasense_user');
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser({ ...parsed, token: savedToken });
      } catch (e) {
        localStorage.removeItem('nilasense_user');
      }
    }
  }, []);

  // Live data only. cache:no-store mencegah browser/proxy memakai response lama.
  const fetchLiveData = useCallback(async () => {
    try {
      const [resTel, resPlts] = await Promise.allSettled([
        fetch('/api/telemetry/latest', { cache: 'no-store' }),
        fetch('/api/plts/summary', { cache: 'no-store' }),
      ]);

      if (resTel.status === 'fulfilled' && resTel.value.ok) {
        const data = await resTel.value.json();
        if (data.telemetry) setTelemetry(data.telemetry);
        if (data.mqttStatus) {
          setMqttStatus(data.mqttStatus);
          setSimulationActive(!!data.mqttStatus.simulationActive);
        }
      }

      if (resPlts.status === 'fulfilled' && resPlts.value.ok) {
        const data = await resPlts.value.json();
        if (data.summary) setPltsSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching live data:', err);
    }
  }, []);

  // Riwayat tidak perlu diminta setiap 8 detik. SSE akan menambahkan telemetry baru.
  const fetchInitialHistory = useCallback(async () => {
    try {
      const response = await fetch('/api/telemetry/history?limit=100', {
        cache: 'no-store',
      });
      if (!response.ok) return;
      const data = await response.json();
      if (Array.isArray(data.history)) setHistory(data.history);
    } catch (err) {
      console.error('Error fetching initial telemetry history:', err);
    }
  }, []);

  // Connect to SSE Stream for live real-time push from MQTT.
  useEffect(() => {
    void fetchLiveData();
    void fetchInitialHistory();

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/telemetry/stream');

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);

          if (parsed.type === 'initial' || parsed.type === 'telemetry') {
            if (parsed.telemetry) {
              setTelemetry(parsed.telemetry);

              // Hanya tambahkan event telemetry nyata; initial snapshot tidak perlu diduplikasi.
              if (parsed.type === 'telemetry') {
                setHistory((prev) => {
                  const next = [...prev, parsed.telemetry];
                  return next.slice(-200);
                });
              }
            }

            if (parsed.mqttStatus) {
              setMqttStatus(parsed.mqttStatus);
              setSimulationActive(!!parsed.mqttStatus.simulationActive);
            }
          }

          if (parsed.type === 'plts' && parsed.plts) {
            setPltsSummary(parsed.plts);
          }

          if (parsed.type === 'status' && parsed.mqttStatus) {
            setMqttStatus(parsed.mqttStatus);
            setSimulationActive(!!parsed.mqttStatus.simulationActive);
          }
        } catch (e) {
          console.error('Error parsing SSE data:', e);
        }
      };

      eventSource.onerror = () => {
        console.warn('SSE disconnected, browser will reconnect automatically...');
      };
    } catch (err) {
      console.error('EventSource initialization error:', err);
    }

    // Fallback polling tetap hidup bila SSE terputus atau proxy bermasalah.
    const interval = setInterval(() => {
      void fetchLiveData();
    }, 8000);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, [fetchLiveData, fetchInitialHistory]);

  // Refresh PLTS manually
  const handleRefreshPlts = async () => {
    try {
      const res = await fetch('/api/plts/refresh', {
        method: 'POST',
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.summary) {
        setPltsSummary(data.summary);
      }
    } catch (e) {
      console.error('Error refreshing PLTS data:', e);
    }
  };

  // Toggle Simulation Mode
  const handleToggleSimulation = async () => {
    try {
      const res = await fetch('/api/telemetry/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: !simulationActive }),
      });
      const data = await res.json();
      setSimulationActive(data.simulationActive);
      void fetchLiveData();
    } catch (e) {
      console.error('Error toggling simulation:', e);
    }
  };

  // Reconnect MQTT
  const handleReconnectMqtt = async (broker: string, topic: string) => {
    try {
      await fetch('/api/telemetry/reconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broker, topic }),
      });
      setTimeout(() => void fetchLiveData(), 1200);
    } catch (e) {
      console.error('Error reconnecting MQTT:', e);
    }
  };

  // Save Thresholds
  const handleSaveThresholds = (newThresholds: ThresholdSettings) => {
    setThresholds(newThresholds);
    localStorage.setItem('nilasense_thresholds', JSON.stringify(newThresholds));
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('nilasense_token');
    localStorage.removeItem('nilasense_user');
    setUser(null);
  };

  const telemetryState = mqttStatus.telemetryState || 'waiting';
  const telemetryStale = !simulationActive && telemetryState === 'stale';
  const telemetryDelayed = !simulationActive && telemetryState === 'delayed';

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        telemetry={telemetry}
        pltsSummary={pltsSummary}
        mqttStatus={mqttStatus}
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenProfile={() => setIsProfileOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLogout={handleLogout}
        simulationActive={simulationActive}
        onToggleSimulation={handleToggleSimulation}
      />

      {/* Warning global bila broker hidup tetapi telemetry sensor tidak fresh. */}
      {(telemetryStale || telemetryDelayed) && (
        <div
          className={`border-b px-4 py-2 text-sm ${
            telemetryStale
              ? 'bg-red-950/80 border-red-800/70 text-red-200'
              : 'bg-amber-950/80 border-amber-800/70 text-amber-200'
          }`}
        >
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <span className="font-semibold">
              {telemetryStale ? '⚠ Data sensor MQTT STALE' : '⚠ Data sensor MQTT terlambat'}
            </span>
            <span>
              Telemetry terakhir: {formatTelemetryAge(mqttStatus.telemetryAgeSec)}. Data PLTS dapat tetap live karena menggunakan jalur API yang berbeda.
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'overview' && (
          <WaterQualityOverview
            telemetry={telemetry}
            pltsSummary={pltsSummary}
            thresholds={thresholds}
            onNavigateToPlts={() => setActiveTab('plts')}
            onNavigateToDiagnostics={() => setActiveTab('diagnostics')}
            onNavigateToControl={() => setActiveTab('control')}
            onNavigateToHpp={() => setActiveTab('hpp')}
          />
        )}

        {activeTab === 'hpp' && (
          <HppProductionDashboard telemetry={telemetry} pltsSummary={pltsSummary} />
        )}

        {activeTab === 'plts' && (
          <PltsEnergyFlow summary={pltsSummary} onRefresh={handleRefreshPlts} />
        )}

        {activeTab === 'charts' && (
          <TelemetryCharts
            history={history}
            pltsSummary={pltsSummary}
            thresholds={thresholds}
          />
        )}

        {activeTab === 'diagnostics' && <SensorDiagnostics telemetry={telemetry} />}

        {activeTab === 'control' && (
          <DeviceCommandsModal
            user={user}
            telemetry={telemetry}
            onOpenLogin={() => setIsLoginOpen(true)}
          />
        )}

        {activeTab === 'logs' && <TelemetryHistoryTable history={history} />}

        {activeTab === 'guide' && <TilapiaGuideModal />}
      </main>

      {/* Footer */}
      <footer className="bg-[#0f172a]/80 backdrop-blur-md border-t border-slate-800/80 py-6 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">NilaSense IoT</span>
            <span>•</span>
            <span>Sistem Monitoring Kolam Budidaya Nila & PLTS Surya</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-500">
            <span>Broker: broker.emqx.io:1883</span>
            <span>•</span>
            <span>Cloud: Dessmonitor API</span>
            <span>•</span>
            <span>SNI 7550:2009</span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={(loggedUser) => setUser(loggedUser)}
      />

      <UserProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        user={user}
        onLogout={handleLogout}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        thresholds={thresholds}
        onSaveThresholds={handleSaveThresholds}
        onReconnectMqtt={handleReconnectMqtt}
      />
    </div>
  );
}
