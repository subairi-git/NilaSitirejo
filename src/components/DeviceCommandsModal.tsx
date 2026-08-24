import React, { useState, useEffect } from 'react';
import { 
  Terminal, 
  Send, 
  RotateCcw, 
  Compass, 
  Power, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Radio, 
  Lock,
  Zap,
  Sliders,
  ShieldAlert,
  Download,
  UploadCloud,
  Cpu,
  Droplets,
  Settings,
  RefreshCw,
  Info,
  Check,
  AlertTriangle,
  Flame,
  Globe,
  Wifi,
  Database,
  Gauge,
  Wrench
} from 'lucide-react';
import { User, TelemetryData, MqttAck, EspDeviceInfo } from '../types';

interface DeviceCommandsModalProps {
  user: User | null;
  telemetry: TelemetryData | null;
  onOpenLogin: () => void;
}

export const DeviceCommandsModal: React.FC<DeviceCommandsModalProps> = ({ user, telemetry, onOpenLogin }) => {
  const [activeSubTab, setActiveSubTab] = useState<'ph' | 'do' | 'ota' | 'config' | 'console'>('ph');
  const [deviceId, setDeviceId] = useState<string>('nila-E0F908');
  const [commandToken, setCommandToken] = useState<string>(() => {
    return localStorage.getItem('nilasense_cmd_token') || 'change-this-token';
  });

  // pH Calibration State
  const [phStepProgress, setPhStepProgress] = useState<string>('ready');
  
  // DO Calibration State
  const [salinityInput, setSalinityInput] = useState<number>(telemetry?.do_salinity_ppt ?? 0);
  const [pressureInput, setPressureInput] = useState<number>(telemetry?.do_atmospheric_pressure_kpa ?? 101.33);
  const [publishIntervalInput, setPublishIntervalInput] = useState<number>(10000);

  // OTA State
  const [otaUrl, setOtaUrl] = useState<string>(
    'https://raw.githubusercontent.com/subairi/MonitorNila/main/FirmWareSitirejo.bin'
  );
  const [otaInProgress, setOtaInProgress] = useState<boolean>(false);
  const [otaProgressPct, setOtaProgressPct] = useState<number>(0);
  const [otaStatusText, setOtaStatusText] = useState<string>('');

  // Console / Custom Command State
  const [customCmd, setCustomCmd] = useState<string>('ping');
  const [customParams, setCustomParams] = useState<string>('{}');
  const [isSending, setIsSending] = useState(false);
  const [commandLogs, setCommandLogs] = useState<Array<{ id: string; time: string; cmd: string; payload: string; status: 'success' | 'error'; message: string }>>([
    {
      id: 'init-1',
      time: new Date().toLocaleTimeString('id-ID'),
      cmd: 'system_ready',
      payload: '{"protocol":"2.0","device":"nila-E0F908"}',
      status: 'success',
      message: 'Node online & mendengarkan topic aquaculture/nila/data/nila-E0F908/command'
    }
  ]);

  // Remote Device Info & Configuration State
  const [deviceInfo, setDeviceInfo] = useState<EspDeviceInfo | null>(null);
  const [configForm, setConfigForm] = useState({
    wifi_ssid: '',
    wifi_password: '',
    mqtt_host: 'broker.emqx.io',
    mqtt_port: 1883,
    mqtt_user: '',
    mqtt_pass: '',
    base_topic: 'aquaculture/nila/data',
    publish_interval_ms: 10000,
    command_token: 'change-this-token',
    do_slave_id: 1,
    do_baud: 4800,
    do_salinity_ppt: 0,
    do_pressure_kpa: 101.33,
    ph_voltage_multiplier: 1.0,
    ph_samples: 30,
    oled_i2c_addr: 0x3C
  });

  // Save command token in localStorage
  const handleTokenChange = (newToken: string) => {
    setCommandToken(newToken);
    localStorage.setItem('nilasense_cmd_token', newToken);
  };

  // Listen to Server-Sent Event acknowledgements
  useEffect(() => {
    const fetchAcks = async () => {
      try {
        const res = await fetch('/api/mqtt/acks');
        const data = await res.json();
        if (data.success && data.history?.length) {
          const formatted = data.history.slice(0, 30).map((ack: MqttAck) => ({
            id: ack.id || `ack-${Math.random()}`,
            time: ack.timestamp ? ack.timestamp.substring(11, 19) : new Date().toLocaleTimeString('id-ID'),
            cmd: ack.cmd || 'ack',
            payload: JSON.stringify({ req_id: ack.request_id, uptime: ack.uptime_s }),
            status: (ack.status === 'ok' ? 'success' : 'error') as 'success' | 'error',
            message: ack.message || 'Berhasil'
          }));
          setCommandLogs(prev => {
            const ids = new Set(prev.map(p => p.id));
            const fresh = formatted.filter((f: any) => !ids.has(f.id));
            return [...fresh, ...prev];
          });
        }
      } catch {}
    };

    fetchAcks();
  }, []);

  const sendMqttCommand = async (cmd: string, params: Record<string, any> = {}) => {
    if (!user) {
      onOpenLogin();
      return;
    }

    setIsSending(true);
    const timeStr = new Date().toLocaleTimeString('id-ID');
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    try {
      const token = localStorage.getItem('nilasense_token') || user.token;
      const res = await fetch('/api/mqtt/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          command: cmd,
          params,
          deviceId,
          token: commandToken,
          requestId
        })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setCommandLogs(prev => [
          {
            id: `log-${Date.now()}-${Math.random()}`,
            time: timeStr,
            cmd,
            payload: JSON.stringify({ cmd, ...params, token: '***', req: requestId }),
            status: 'success',
            message: `Terkirim ke ${data.result?.topic || 'aquaculture/nila/data/' + deviceId + '/command'}`
          },
          ...prev
        ]);
        return data.result;
      } else {
        throw new Error(data.error || 'Gagal mengirim perintah');
      }
    } catch (err: any) {
      setCommandLogs(prev => [
        {
          id: `log-${Date.now()}-${Math.random()}`,
          time: new Date().toLocaleTimeString('id-ID'),
          cmd,
          payload: JSON.stringify({ cmd, ...params }),
          status: 'error',
          message: err.message || 'Error koneksi'
        },
        ...prev
      ]);
      throw err;
    } finally {
      setIsSending(false);
    }
  };

  // pH Calibration Handlers
  const handleCalibratePh = async (point: '401' | '686' | '918') => {
    const cmdMap = {
      '401': 'cal_ph_401',
      '686': 'cal_ph_686',
      '918': 'cal_ph_918'
    };
    const labelMap = {
      '401': 'pH 4.01 (Asam)',
      '686': 'pH 6.86 (Netral)',
      '918': 'pH 9.18 (Basa)'
    };
    if (window.confirm(`Pastikan elektroda pH sudah dibilas air suling dan direndam dalam larutan buffer ${labelMap[point]}. Lanjutkan kalibrasi?`)) {
      setPhStepProgress(`Kalibrasi ${labelMap[point]} sedang diproses...`);
      await sendMqttCommand(cmdMap[point], { point: point === '401' ? 4.01 : point === '686' ? 6.86 : 9.18 });
      setPhStepProgress(`Titik ${labelMap[point]} berhasil dicatat pada sensor.`);
    }
  };

  const handleFinishPhCalibration = async () => {
    if (window.confirm('Kirim perintah cal_ph_finish untuk memverifikasi dan menyimpan data kalibrasi ke EEPROM/NVS ESP32?')) {
      setPhStepProgress('Memverifikasi kurva kalibrasi (delta mV >= 20mV)...');
      await sendMqttCommand('cal_ph_finish', {});
      setPhStepProgress('Kalibrasi pH selesai dan aktif!');
    }
  };

  const handleClearPhCalibration = async () => {
    if (window.confirm('PERINGATAN: Apakah Anda yakin ingin mereset/menghapus seluruh titik kalibrasi elektroda pH ke nilai default pabrik?')) {
      await sendMqttCommand('clear_ph_calibration', {});
      setPhStepProgress('Kalibrasi pH berhasil di-reset ke nilai pabrik.');
    }
  };

  // DO Calibration Handlers
  const handleCalibrateDo100 = async () => {
    if (window.confirm('Kalibrasi Saturasi Udara 100%: Angkat probe DO optik ke udara lembap di atas permukaan air dan tunggu hingga pembacaan stabil (~3-5 menit). Lanjutkan?')) {
      await sendMqttCommand('cal_do_100', { mode: 2 });
    }
  };

  const handleCalibrateDoZero = async () => {
    if (window.confirm('Kalibrasi Zero Oxygen: Rendam probe DO optik ke larutan Sodium Sulfit (Na2SO3) 5% (bebas oksigen). Lanjutkan?')) {
      await sendMqttCommand('cal_do_zero', { mode: 1 });
    }
  };

  const handleSaveSalinity = async () => {
    await sendMqttCommand('set_salinity', { value: Number(salinityInput), salinity_ppt: Number(salinityInput) });
  };

  const handleSavePressure = async () => {
    await sendMqttCommand('set_pressure', { value: Number(pressureInput), atmospheric_pressure_kpa: Number(pressureInput) });
  };

  const handleSaveCombinedCompensation = async () => {
    await sendMqttCommand('set_do_compensation', {
      salinity_ppt: Number(salinityInput),
      atmospheric_pressure_kpa: Number(pressureInput)
    });
  };

  // OTA Update Handler
  const handleStartOta = async () => {
    if (!otaUrl || !otaUrl.startsWith('http')) {
      alert('Masukkan URL binary firmware (.bin) yang valid!');
      return;
    }

    let normalizedUrl = otaUrl.trim();
    if (normalizedUrl.includes('github.com') && normalizedUrl.includes('/blob/')) {
      normalizedUrl = normalizedUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
      setOtaUrl(normalizedUrl);
    }

    if (!window.confirm(`PERINGATAN OTA FLASHING:\n\nApakah Anda yakin ingin memperbarui firmware perangkat ${deviceId} dengan binary berikut?\n\n${normalizedUrl}\n\nPastikan suplai listrik ESP32 stabil dan koneksi WiFi tidak terputus!`)) {
      return;
    }

    setOtaInProgress(true);
    setOtaProgressPct(15);
    setOtaStatusText('Mengirim perintah ota_update ke ESP32...');

    try {
      await sendMqttCommand('ota_update', { url: normalizedUrl });
      setOtaProgressPct(45);
      setOtaStatusText('ESP32 memulai download binary dari server GitHub...');
      
      setTimeout(() => {
        setOtaProgressPct(80);
        setOtaStatusText('Memvalidasi checksum & menulis partisi flash OTA...');
      }, 2500);

      setTimeout(() => {
        setOtaProgressPct(100);
        setOtaStatusText('Flashing selesai! ESP32 otomatis me-reboot ke firmware baru.');
        setOtaInProgress(false);
      }, 5000);
    } catch (err: any) {
      setOtaStatusText(`Gagal OTA: ${err.message}`);
      setOtaInProgress(false);
    }
  };

  // Maintenance & Diagnostic Handlers
  const handleSyncTime = async () => {
    await sendMqttCommand('sync_time', {});
  };

  const handlePublishNow = async () => {
    await sendMqttCommand('publish_now', {});
  };

  const handleGetDeviceInfo = async () => {
    await sendMqttCommand('get_device_info', {});
    await sendMqttCommand('calibration_status', {});
  };

  const handleGetConfig = async () => {
    await sendMqttCommand('get_config', {});
  };

  const handleRebootDevice = () => {
    if (window.confirm(`Apakah Anda yakin ingin me-restart mikrokontroler ${deviceId}?`)) {
      sendMqttCommand('restart', { reason: 'user_maintenance', force: true });
    }
  };

  const handleFactoryReset = () => {
    if (window.confirm(`PERINGATAN KERAS:\n\nApakah Anda yakin ingin melakukan FACTORY RESET pada node ${deviceId}?\nSemua setingan WiFi, MQTT, dan kalibrasi di NVS akan terhapus!`)) {
      sendMqttCommand('factory_reset', {});
    }
  };

  const handleSetPublishInterval = async () => {
    await sendMqttCommand('set_publish_interval', { interval_ms: Number(publishIntervalInput) });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Device Configuration Bar */}
      <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <span className="relative inline-flex items-center justify-center shrink-0">
                <Settings className="w-3.5 h-3.5 text-cyan-400" />
                <Wrench className="w-2.5 h-2.5 absolute -bottom-0.5 -right-0.5 text-cyan-300" />
              </span>
              Remote MQTT Command & Calibration Center
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              Protocol v2.0
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
              FW: {telemetry?.firmware_version || '2.0.0-mqtt-cmd'}
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Pusat Kalibrasi Sensor & Manajemen Firmware OTA
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl">
            Kirimkan instruksi MQTT langsung ke node <span className="font-mono text-cyan-300 font-bold">{deviceId}</span>. Mendukung kalibrasi 3-titik elektroda pH, kalibrasi saturasi DO RS485 Modbus, kompensasi salinitas/tekanan, dan flashing Over-The-Air (OTA).
          </p>
        </div>

        {/* Security & Target Device Setup */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#020617] border border-slate-800 p-3 rounded-xl">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-cyan-400 shrink-0" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Device ID</div>
              <input
                type="text"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                className="w-28 bg-[#0f172a] text-xs font-mono text-cyan-300 font-bold border border-slate-700 rounded px-2 py-0.5 focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />

          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-400">Command Token</div>
              <input
                type="password"
                value={commandToken}
                onChange={(e) => handleTokenChange(e.target.value)}
                placeholder="Token Otorisasi"
                className="w-32 bg-[#0f172a] text-xs font-mono text-amber-300 border border-slate-700 rounded px-2 py-0.5 focus:border-amber-500 outline-none"
              />
            </div>
          </div>

          {!user && (
            <button
              onClick={onOpenLogin}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_12px_rgba(245,158,11,0.3)] flex items-center justify-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" /> Login Admin
            </button>
          )}
        </div>
      </div>

      {/* Quick Status & Maintenance Toolbar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <button
          disabled={isSending}
          onClick={() => sendMqttCommand('ping', { echo: Date.now() })}
          className="p-3 bg-[#0f172a]/80 hover:bg-[#0f172a] border border-slate-800/80 hover:border-cyan-500/50 rounded-xl transition-all flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-cyan-300">Ping Test</div>
            <div className="text-[10px] text-slate-400">Cek Respons Latensi</div>
          </div>
        </button>

        <button
          disabled={isSending}
          onClick={handleSyncTime}
          className="p-3 bg-[#0f172a]/80 hover:bg-[#0f172a] border border-slate-800/80 hover:border-cyan-500/50 rounded-xl transition-all flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-blue-300">Sync NTP Waktu</div>
            <div className="text-[10px] text-slate-400">Sinkron Jam RTC</div>
          </div>
        </button>

        <button
          disabled={isSending}
          onClick={handlePublishNow}
          className="p-3 bg-[#0f172a]/80 hover:bg-[#0f172a] border border-slate-800/80 hover:border-emerald-500/50 rounded-xl transition-all flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-emerald-300">Publish Now</div>
            <div className="text-[10px] text-slate-400">Paksa Kirim Data</div>
          </div>
        </button>

        <button
          disabled={isSending}
          onClick={handleGetDeviceInfo}
          className="p-3 bg-[#0f172a]/80 hover:bg-[#0f172a] border border-slate-800/80 hover:border-purple-500/50 rounded-xl transition-all flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-purple-300">Info Hardware</div>
            <div className="text-[10px] text-slate-400">ESP32 & RS485 Chip</div>
          </div>
        </button>

        <button
          disabled={isSending}
          onClick={handleGetConfig}
          className="p-3 bg-[#0f172a]/80 hover:bg-[#0f172a] border border-slate-800/80 hover:border-amber-500/50 rounded-xl transition-all flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-white group-hover:text-amber-300">Ambil Config</div>
            <div className="text-[10px] text-slate-400">Baca Parameter NVS</div>
          </div>
        </button>

        <button
          disabled={isSending}
          onClick={handleRebootDevice}
          className="p-3 bg-red-950/20 hover:bg-red-950/40 border border-red-800/50 hover:border-red-500 rounded-xl transition-all flex items-center gap-3 text-left group"
        >
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 group-hover:scale-110 transition-transform">
            <RotateCcw className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-red-300 group-hover:text-red-200">Restart Node</div>
            <div className="text-[10px] text-red-400/80">Reboot Mikrokontroler</div>
          </div>
        </button>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveSubTab('ph')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeSubTab === 'ph'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]/60'
          }`}
        >
          <Compass className="w-4 h-4 text-cyan-400" />
          <span>Kalibrasi pH (3-Titik)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('do')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeSubTab === 'do'
              ? 'bg-gradient-to-r from-blue-500/20 to-indigo-500/20 text-blue-300 border border-blue-500/40 shadow-[0_0_12px_rgba(59,130,246,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]/60'
          }`}
        >
          <Droplets className="w-4 h-4 text-blue-400" />
          <span>Kalibrasi & Kompensasi DO</span>
        </button>

        <button
          onClick={() => setActiveSubTab('ota')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeSubTab === 'ota'
              ? 'bg-gradient-to-r from-purple-500/20 to-fuchsia-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]/60'
          }`}
        >
          <UploadCloud className="w-4 h-4 text-purple-400" />
          <span>Update Firmware OTA</span>
        </button>

        <button
          onClick={() => setActiveSubTab('config')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeSubTab === 'config'
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]/60'
          }`}
        >
          <Settings className="w-4 h-4 text-amber-400" />
          <span>Konfigurasi NVS ESP32</span>
        </button>

        <button
          onClick={() => setActiveSubTab('console')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeSubTab === 'console'
              ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]/60'
          }`}
        >
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Konsol Perintah & Log ACK</span>
        </button>
      </div>

      {/* TAB CONTENT: 1. KALIBRASI pH 3-TITIK */}
      {activeSubTab === 'ph' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">Kalibrasi Elektroda pH (3 Titik Standar Buffer)</h2>
                    <p className="text-xs text-slate-400">Protokol kalibrasi firmware v2.0 menggunakan interpolasi linear multi-segmen.</p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-mono">Tegangan Probe Saat Ini</div>
                  <div className="text-lg font-mono font-black text-cyan-300">
                    {telemetry?.ph_mv !== null && telemetry?.ph_mv !== undefined ? `${telemetry.ph_mv.toFixed(1)} mV` : '2598.5 mV'}
                  </div>
                </div>
              </div>

              {/* 3 Calibration Buffer Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Point 1: pH 6.86 */}
                <div className="bg-[#020617] border border-emerald-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Titik 1 - Netral</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      telemetry?.ph_cal_686 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {telemetry?.ph_cal_686 ? '✓ Tersimpan' : 'Belum'}
                    </span>
                  </div>

                  <div className="text-center py-2">
                    <div className="text-3xl font-black text-white font-mono">6.86</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Buffer Netral Standar</div>
                  </div>

                  <button
                    disabled={isSending}
                    onClick={() => handleCalibratePh('686')}
                    className="w-full py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)] disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Kalibrasi pH 6.86
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">MQTT Cmd: <span className="font-mono text-cyan-400">cal_ph_686</span></p>
                </div>

                {/* Point 2: pH 9.18 */}
                <div className="bg-[#020617] border border-blue-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-400 uppercase tracking-wider">Titik 2 - Basa</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      telemetry?.ph_cal_918 ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {telemetry?.ph_cal_918 ? '✓ Tersimpan' : 'Belum'}
                    </span>
                  </div>

                  <div className="text-center py-2">
                    <div className="text-3xl font-black text-white font-mono">9.18</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Buffer Basa Standar</div>
                  </div>

                  <button
                    disabled={isSending}
                    onClick={() => handleCalibratePh('918')}
                    className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_10px_rgba(59,130,246,0.2)] disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Kalibrasi pH 9.18
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">MQTT Cmd: <span className="font-mono text-cyan-400">cal_ph_918</span></p>
                </div>

                {/* Point 3: pH 4.01 */}
                <div className="bg-[#020617] border border-cyan-500/30 rounded-xl p-4 space-y-3 relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Titik 3 - Asam</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      telemetry?.ph_cal_401 ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {telemetry?.ph_cal_401 ? '✓ Tersimpan' : 'Belum'}
                    </span>
                  </div>

                  <div className="text-center py-2">
                    <div className="text-3xl font-black text-white font-mono">4.01</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Buffer Asam Standar</div>
                  </div>

                  <button
                    disabled={isSending}
                    onClick={() => handleCalibratePh('401')}
                    className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_10px_rgba(6,182,212,0.2)] disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Kalibrasi pH 4.01
                  </button>
                  <p className="text-[10px] text-slate-400 text-center">MQTT Cmd: <span className="font-mono text-cyan-400">cal_ph_401</span></p>
                </div>
              </div>

              {/* Action Buttons: Finish & Clear */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-800">
                <button
                  disabled={isSending}
                  onClick={handleClearPhCalibration}
                  className="w-full sm:w-auto px-4 py-2 bg-red-950/30 hover:bg-red-900/50 text-red-300 text-xs font-bold rounded-xl border border-red-800/60 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4 text-red-400" />
                  <span>Reset Kalibrasi pH (Default Pabrik)</span>
                </button>

                <button
                  disabled={isSending}
                  onClick={handleFinishPhCalibration}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Selesaikan & Simpan Kalibrasi (cal_ph_finish)</span>
                </button>
              </div>

              {phStepProgress !== 'ready' && (
                <div className="p-3 bg-cyan-950/30 border border-cyan-800/60 rounded-xl text-xs text-cyan-300 flex items-center gap-2">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>{phStepProgress}</span>
                </div>
              )}
            </div>
          </div>

          {/* Guide & Calibration Checklist */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Compass className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Panduan SOP Kalibrasi pH</h3>
            </div>

            <ol className="space-y-3 text-xs text-slate-300 list-decimal list-inside leading-relaxed">
              <li className="p-2 bg-[#020617] rounded-lg border border-slate-800/80">
                <strong className="text-white">Bilas Elektroda:</strong> Cuci probe pH dengan air suling/aquades dan keringkan perlahan dengan tisu halus.
              </li>
              <li className="p-2 bg-[#020617] rounded-lg border border-slate-800/80">
                <strong className="text-emerald-400">Titik 1 (pH 6.86):</strong> Celupkan ke larutan buffer 6.86, tunggu tegangan mV stabil (~60 detik), klik tombol <strong className="text-emerald-300">Kalibrasi pH 6.86</strong>.
              </li>
              <li className="p-2 bg-[#020617] rounded-lg border border-slate-800/80">
                <strong className="text-blue-400">Titik 2 (pH 9.18):</strong> Bilas probe lagi, celupkan ke buffer 9.18, tunggu stabil, klik <strong className="text-blue-300">Kalibrasi pH 9.18</strong>.
              </li>
              <li className="p-2 bg-[#020617] rounded-lg border border-slate-800/80">
                <strong className="text-cyan-400">Titik 3 (pH 4.01):</strong> Bilas probe lagi, celupkan ke buffer 4.01, tunggu stabil, klik <strong className="text-cyan-300">Kalibrasi pH 4.01</strong>.
              </li>
              <li className="p-2 bg-[#020617] rounded-lg border border-emerald-800/50">
                <strong className="text-emerald-300">Finalisasi:</strong> Klik <strong className="text-emerald-400">Selesaikan & Simpan</strong>. ESP32 memvalidasi delta tegangan minimal 20 mV antar titik kalibrasi.
              </li>
            </ol>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 2. KALIBRASI & KOMPENSASI DO */}
      {activeSubTab === 'do' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Sensor Calibration (100% Saturation & Zero Oxygen) */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/30">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Kalibrasi Sensor DO Optik (Modbus RS485)</h2>
                  <p className="text-xs text-slate-400">Menulis perintah kalibrasi register Modbus 0x1010 ke sensor SN-3002-LDO.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* 100% Air Calibration */}
              <div className="p-4 bg-[#020617] rounded-xl border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
                      1. Kalibrasi Saturasi Udara 100% (Air Calibration)
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Angkat probe DO dari air ke udara lembap di atas permukaan kolam. Diamkan 3-5 menit sampai pembacaan stabil.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-mono text-slate-400">Modbus: Reg 0x1010 = 0x0002</span>
                  <button
                    disabled={isSending}
                    onClick={handleCalibrateDo100}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_12px_rgba(59,130,246,0.25)] flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Kirim cal_do_100
                  </button>
                </div>
              </div>

              {/* Zero Oxygen Calibration */}
              <div className="p-4 bg-[#020617] rounded-xl border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                      2. Kalibrasi Titik Nol (Zero Oxygen Calibration)
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Celupkan probe DO ke larutan Sodium Sulfit (Na₂SO₃) 5% tanpa gelembung udara. Diamkan 5 menit.
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-mono text-slate-400">Modbus: Reg 0x1010 = 0x0001</span>
                  <button
                    disabled={isSending}
                    onClick={handleCalibrateDoZero}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-lg transition-all shadow-[0_0_12px_rgba(99,102,241,0.25)] flex items-center gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" /> Kirim cal_do_zero
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Salinity & Barometric Pressure Compensation */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                  <Gauge className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Kompensasi Salinitas & Tekanan Udara</h2>
                  <p className="text-xs text-slate-400">Kompensasi fisik optik otomatis untuk akurasi mg/L oksigen terlarut.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Salinity Input */}
              <div className="p-4 bg-[#020617] rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">Kompensasi Salinitas Air (PPT / ‰)</label>
                  <span className="text-xs font-mono text-cyan-400 font-bold">{salinityInput} PPT</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="0"
                    max="35"
                    step="0.5"
                    value={salinityInput}
                    onChange={(e) => setSalinityInput(parseFloat(e.target.value) || 0)}
                    className="flex-1 bg-[#0f172a] text-white text-xs font-mono rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                  <button
                    disabled={isSending}
                    onClick={handleSaveSalinity}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Set Salinitas
                  </button>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500">Preset:</span>
                  {[
                    { label: 'Tawar (0 PPT)', val: 0 },
                    { label: 'Payau Nila (5 PPT)', val: 5 },
                    { label: 'Payau Tinggi (15 PPT)', val: 15 },
                    { label: 'Laut (35 PPT)', val: 35 },
                  ].map(p => (
                    <button
                      key={p.val}
                      onClick={() => setSalinityInput(p.val)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Barometric Pressure Input */}
              <div className="p-4 bg-[#020617] rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200">Kompensasi Tekanan Atmosfer (kPa)</label>
                  <span className="text-xs font-mono text-cyan-400 font-bold">{pressureInput} kPa</span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min="80"
                    max="115"
                    step="0.01"
                    value={pressureInput}
                    onChange={(e) => setPressureInput(parseFloat(e.target.value) || 101.33)}
                    className="flex-1 bg-[#0f172a] text-white text-xs font-mono rounded-lg px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                  <button
                    disabled={isSending}
                    onClick={handleSavePressure}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Set Tekanan
                  </button>
                </div>
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[10px] text-slate-500">Preset:</span>
                  {[
                    { label: 'Laut (101.33 kPa)', val: 101.33 },
                    { label: 'Ketinggian 300m (97.8 kPa)', val: 97.8 },
                    { label: 'Ketinggian 700m (93.2 kPa)', val: 93.2 },
                  ].map(p => (
                    <button
                      key={p.val}
                      onClick={() => setPressureInput(p.val)}
                      className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 rounded"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Save Combined Compensation */}
              <button
                disabled={isSending}
                onClick={handleSaveCombinedCompensation}
                className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.2)] flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Kirim Kompensasi Serentak (set_do_compensation)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 3. OTA FIRMWARE UPDATE */}
      {activeSubTab === 'ota' && (
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/30">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Over-The-Air (OTA) Remote Firmware Flashing</h2>
                <p className="text-xs text-slate-400">Update firmware ESP32 dari jarak jauh melalui perintah MQTT dan HTTPS binary stream.</p>
              </div>
            </div>

            <div className="px-3 py-1 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-lg text-xs font-mono font-bold">
              HTTP/HTTPS Stream OTA
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 mb-1.5 block">
                URL Binary Firmware (.bin)
              </label>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="text"
                  value={otaUrl}
                  onChange={(e) => setOtaUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/.../firmware.bin"
                  className="flex-1 bg-[#020617] text-white text-xs font-mono rounded-xl px-4 py-3 border border-slate-700 focus:border-purple-500 outline-none"
                />
                <button
                  disabled={otaInProgress || isSending}
                  onClick={handleStartOta}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-[0_0_20px_rgba(168,85,247,0.3)] flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <Flame className="w-4 h-4 text-amber-300" />
                  <span>Mulai Update OTA Sekarang</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1.5">
                Default repository: <span className="font-mono text-purple-300">https://raw.githubusercontent.com/subairi/MonitorNila/main/FirmWareSitirejo.bin</span>
              </p>
            </div>

            {/* OTA Progress Indicator */}
            {(otaInProgress || otaProgressPct > 0) && (
              <div className="p-5 bg-[#020617] rounded-xl border border-purple-500/40 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-purple-300 flex items-center gap-2">
                    <RefreshCw className={`w-3.5 h-3.5 ${otaInProgress ? 'animate-spin' : ''}`} />
                    {otaStatusText || 'Proses OTA Berjalan...'}
                  </span>
                  <span className="font-mono text-white text-sm">{otaProgressPct}%</span>
                </div>

                <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-slate-700">
                  <div
                    className="bg-gradient-to-r from-purple-500 via-fuchsia-500 to-cyan-400 h-full rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(168,85,247,0.8)]"
                    style={{ width: `${otaProgressPct}%` }}
                  />
                </div>
              </div>
            )}

            {/* Warning Box */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-xs text-amber-200/90 leading-relaxed">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-300 block mb-1">Perhatian Keselamatan Flash:</strong>
                Pastikan mikrokontroler terhubung ke sumber daya yang stabil (disarankan bertenaga PLTS & baterai backup) dan sinyal WiFi stabil selama proses download & flashing. ESP32 akan melakukan reboot otomatis setelah binary berhasil diverifikasi.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 4. KONFIGURASI LENGKAP ESP32 */}
      {activeSubTab === 'config' && (
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/30">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Konfigurasi Perangkat (NVS Flash Preferences)</h2>
                <p className="text-xs text-slate-400">Atur parameter jaringan WiFi, MQTT broker, interval telemetri, dan RS485 Modbus.</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={isSending}
                onClick={handleGetConfig}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 rounded-lg transition-all flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Ambil dari Device
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Telemetry Publish Interval */}
            <div className="p-4 bg-[#020617] rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300">Interval Publish Telemetri (ms)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="1000"
                  max="600000"
                  step="1000"
                  value={publishIntervalInput}
                  onChange={(e) => setPublishIntervalInput(parseInt(e.target.value) || 10000)}
                  className="flex-1 bg-[#0f172a] text-white text-xs font-mono rounded-lg px-3 py-2 border border-slate-700 outline-none"
                />
                <button
                  disabled={isSending}
                  onClick={handleSetPublishInterval}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-all"
                >
                  Set
                </button>
              </div>
              <div className="flex gap-1 pt-1">
                {[
                  { label: '3 detik', val: 3000 },
                  { label: '5 detik', val: 5000 },
                  { label: '10 detik', val: 10000 },
                  { label: '30 detik', val: 30000 }
                ].map(item => (
                  <button
                    key={item.val}
                    onClick={() => setPublishIntervalInput(item.val)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-400 rounded"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* MQTT Broker Base Topic */}
            <div className="p-4 bg-[#020617] rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300">MQTT Base Topic</label>
              <input
                type="text"
                value={configForm.base_topic}
                onChange={(e) => setConfigForm({ ...configForm, base_topic: e.target.value })}
                className="w-full bg-[#0f172a] text-cyan-300 text-xs font-mono rounded-lg px-3 py-2 border border-slate-700 outline-none"
              />
              <span className="text-[10px] text-slate-500">Format: aquaculture/nila/data</span>
            </div>

            {/* RS485 DO Sensor Baud */}
            <div className="p-4 bg-[#020617] rounded-xl border border-slate-800 space-y-2">
              <label className="text-xs font-bold text-slate-300">RS485 DO Sensor Baudrate</label>
              <select
                value={configForm.do_baud}
                onChange={(e) => setConfigForm({ ...configForm, do_baud: parseInt(e.target.value) })}
                className="w-full bg-[#0f172a] text-white text-xs font-mono rounded-lg px-3 py-2 border border-slate-700 outline-none"
              >
                <option value={2400}>2400 bps</option>
                <option value={4800}>4800 bps (Default SN-3002-LDO)</option>
                <option value={9600}>9600 bps</option>
                <option value={19200}>19200 bps</option>
              </select>
              <span className="text-[10px] text-slate-500">Default: 4800 8N1</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800">
            <button
              disabled={isSending}
              onClick={handleFactoryReset}
              className="w-full sm:w-auto px-4 py-2.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-bold rounded-xl border border-red-800/80 transition-all flex items-center justify-center gap-2"
            >
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>Factory Reset NVS ESP32</span>
            </button>

            <button
              disabled={isSending}
              onClick={() => sendMqttCommand('set_config', { config: configForm })}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-xs font-extrabold rounded-xl transition-all shadow-[0_0_15px_rgba(245,158,11,0.25)] flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Simpan Konfigurasi ke NVS (set_config)</span>
            </button>
          </div>
        </div>
      )}

      {/* TAB CONTENT: 5. KONSOL PERINTAH & LOG ACK */}
      {activeSubTab === 'console' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Custom Command Dispatcher */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Kirim Perintah Custom JSON MQTT</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">Nama Command (cmd)</label>
                <input
                  type="text"
                  value={customCmd}
                  onChange={(e) => setCustomCmd(e.target.value)}
                  placeholder="e.g. ping, publish_now, sync_time, ota_update, cal_ph_686"
                  className="w-full bg-[#020617] text-cyan-300 text-xs font-mono rounded-xl px-4 py-2.5 border border-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 mb-1 block">Parameter JSON (params)</label>
                <textarea
                  rows={4}
                  value={customParams}
                  onChange={(e) => setCustomParams(e.target.value)}
                  placeholder='{"value": 100, "url": "https://..."}'
                  className="w-full bg-[#020617] text-slate-200 text-xs font-mono rounded-xl p-3 border border-slate-700 outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[11px] text-slate-400">Pilih Cepat:</span>
                {[
                  'ping',
                  'publish_now',
                  'sync_time',
                  'get_device_info',
                  'get_config',
                  'calibration_status',
                  'cal_do_100',
                  'restart'
                ].map(cmd => (
                  <button
                    key={cmd}
                    onClick={() => setCustomCmd(cmd)}
                    className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-cyan-300 rounded"
                  >
                    {cmd}
                  </button>
                ))}
              </div>

              <button
                disabled={isSending}
                onClick={async () => {
                  try {
                    const parsed = JSON.parse(customParams || '{}');
                    await sendMqttCommand(customCmd, parsed);
                  } catch (e: any) {
                    alert(`Format JSON params tidak valid: ${e.message}`);
                  }
                }}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.25)] flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Perintah ke MQTT Command Topic</span>
              </button>
            </div>
          </div>

          {/* Real-Time ACK & Response Log */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-bold text-white">Live Stream Acknowledgment (ACK) & Perintah</h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">{commandLogs.length} riwayat</span>
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {commandLogs.map(log => (
                <div key={log.id} className="p-3 bg-[#020617] rounded-xl border border-slate-800/90 text-xs font-mono space-y-1 shadow-inner">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${log.status === 'success' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-red-400'}`} />
                      <span className="text-slate-500">[{log.time}]</span>
                      <span className="text-cyan-300 font-bold">{log.cmd}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {log.status === 'success' ? 'ACK OK' : 'ERROR'}
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-300">
                    {log.message}
                  </div>

                  <div className="text-[10px] text-slate-500 truncate">
                    Payload: {log.payload}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
