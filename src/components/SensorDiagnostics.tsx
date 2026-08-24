import React, { useState } from 'react';
import { 
  Cpu, 
  Wifi, 
  Radio, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Code, 
  Server, 
  Clock, 
  ShieldCheck, 
  Layers, 
  RefreshCw,
  Compass,
  Zap,
  Sliders
} from 'lucide-react';
import { TelemetryData } from '../types';

interface SensorDiagnosticsProps {
  telemetry: TelemetryData | null;
}

export const SensorDiagnostics: React.FC<SensorDiagnosticsProps> = ({ telemetry }) => {
  const [showJson, setShowJson] = useState(false);

  const modbusCode = telemetry?.modbus_code ?? 0;
  const isModbusOk = modbusCode === 0 && (telemetry?.do_ok ?? true);
  const rawRegisters = telemetry?.do_raw || [16252, 49569, 16636, 39993, 16852, 64058];

  const getRssiQuality = (rssi: number) => {
    if (rssi >= -65) return { label: 'Sangat Kuat (Excellent)', color: 'text-emerald-400', bar: 'w-full bg-emerald-500' };
    if (rssi >= -75) return { label: 'Kuat (Good)', color: 'text-emerald-300', bar: 'w-3/4 bg-emerald-400' };
    if (rssi >= -85) return { label: 'Sedang (Fair)', color: 'text-amber-400', bar: 'w-1/2 bg-amber-400' };
    return { label: 'Lemah (Weak / Packet Loss Risk)', color: 'text-red-400', bar: 'w-1/4 bg-red-500' };
  };

  const rssiInfo = getRssiQuality(telemetry?.wifi_rssi ?? -76);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Cpu className="w-3.5 h-3.5" /> Hardware & Telemetry Diagnostics
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Diagnostik Sensor & Protokol Modbus
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Inspeksi register probe RS485 Modbus RTU, status 3-point kalibrasi elektroda, dan kestabilan transmisi MQTT.
          </p>
        </div>

        <button
          onClick={() => setShowJson(!showJson)}
          className="flex items-center gap-2 px-4 py-2 bg-[#020617] hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold border border-slate-800 transition-colors self-start md:self-auto shadow-sm"
        >
          <Code className="w-4 h-4 text-cyan-400" />
          {showJson ? 'Sembunyikan JSON' : 'Lihat Payload JSON'}
        </button>
      </div>

      {/* Row 1: Modbus RTU & Probe Registers Diagnostic */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Modbus & DO Probe Diagnostic */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)]">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Status Probe RS485 Modbus RTU</h2>
                <span className="text-xs text-slate-400">Sensor Oksigen Terlarut & Temperatur</span>
              </div>
            </div>
            <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
              isModbusOk 
                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80 shadow-[0_0_8px_rgba(16,185,129,0.2)]' 
                : 'bg-red-950/80 text-red-300 border-red-800/80 shadow-[0_0_8px_rgba(239,68,68,0.2)]'
            }`}>
              {isModbusOk ? 'Modbus Code: 0 (Normal)' : `Modbus Error: ${modbusCode}`}
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Status Komunikasi Probe DO:</span>
              <span className="font-semibold text-white flex items-center gap-1.5">
                {telemetry?.do_ok ? (
                  <span className="text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Normal & Terbaca</span>
                ) : (
                  <span className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-4 h-4" /> Probe Offline / Modbus Code 226</span>
                )}
              </span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Kompensasi Salinitas Kolam:</span>
              <span className="font-mono text-cyan-300 font-bold">{telemetry?.do_salinity_ppt ?? 0} ppt (Air Tawar Nila)</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Kompensasi Tekanan Barometrik:</span>
              <span className="font-mono text-cyan-300 font-bold">{telemetry?.do_atmospheric_pressure_kpa ?? 101.33} kPa</span>
            </div>

            {/* Raw Registers Array View */}
            <div className="pt-2">
              <span className="text-slate-400 block mb-2 font-medium">Raw Register Array Modbus (do_raw):</span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 font-mono text-center">
                {rawRegisters.map((reg, idx) => (
                  <div key={idx} className="bg-[#020617] p-2 rounded-xl border border-slate-800 text-xs shadow-inner">
                    <div className="text-[10px] text-slate-500 mb-0.5">Reg[{idx}]</div>
                    <div className="font-bold text-cyan-300">{reg}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Register berisi representasi raw 16-bit register untuk DO mg/L, saturasi %, temperatur, dan checksum Modbus.
              </p>
            </div>
          </div>
        </div>

        {/* pH Probe 3-Point Calibration & Voltage */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
                <Compass className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Kalibrasi Elektroda pH</h2>
                <span className="text-xs text-slate-400">Sensor Analog mV & Kurva Nernst</span>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
              3-Point Cal
            </span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between items-center py-2 border-b border-slate-800/80">
              <span className="text-slate-400">Tegangan Output ADC (pH mV):</span>
              <span className="font-mono text-cyan-300 font-bold text-sm">
                {telemetry?.ph_mv ?? 2598.5} mV
              </span>
            </div>

            {/* Calibration flags */}
            <div className="py-2 border-b border-slate-800/80 space-y-2">
              <span className="text-slate-400 font-medium block">Poin Buffer Kalibrasi Tersimpan:</span>
              <div className="grid grid-cols-3 gap-2">
                <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                  telemetry?.ph_cal_401 !== false 
                    ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                    : 'bg-[#020617] border-slate-800 text-slate-500'
                }`}>
                  <span className="font-bold text-xs">Buffer 4.01</span>
                  <span className="text-[10px] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Kalibrasi Asam
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                  telemetry?.ph_cal_686 !== false 
                    ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                    : 'bg-[#020617] border-slate-800 text-slate-500'
                }`}>
                  <span className="font-bold text-xs">Buffer 6.86</span>
                  <span className="text-[10px] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Kalibrasi Netral
                  </span>
                </div>

                <div className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 ${
                  telemetry?.ph_cal_918 !== false 
                    ? 'bg-emerald-950/80 border-emerald-800/80 text-emerald-300 shadow-[0_0_10px_rgba(16,185,129,0.15)]' 
                    : 'bg-[#020617] border-slate-800 text-slate-500'
                }`}>
                  <span className="font-bold text-xs">Buffer 9.18</span>
                  <span className="text-[10px] font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Kalibrasi Basa
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
              Kalibrasi 3-titik memastikan linearitas pembacaan akurat di seluruh spektrum pH asam hingga basa, sangat penting untuk mendeteksi perubahan mendadak akibat blooming alga di kolam nila.
            </p>
          </div>
        </div>
      </div>

      {/* Row 2: Microcontroller & Network Telemetry */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <Wifi className="w-5 h-5 text-cyan-400" />
          <h2 className="text-base font-bold text-white">Status Jaringan dan Kontroller</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {/* Box 1 */}
          <div className="bg-[#020617] p-4 rounded-xl border border-slate-800 space-y-2 shadow-inner">
            <div className="text-slate-400 font-medium">Kekuatan Sinyal WiFi (RSSI)</div>
            <div className="text-xl font-bold text-white font-mono flex items-baseline gap-1">
              {telemetry?.wifi_rssi ?? -76} <span className="text-xs text-slate-400 font-normal">dBm</span>
            </div>
            <div className="w-full bg-[#0f172a] h-1.5 rounded-full overflow-hidden border border-slate-800">
              <div className={`h-full rounded-full ${rssiInfo.bar}`} />
            </div>
            <div className={`text-[11px] font-medium ${rssiInfo.color}`}>
              {rssiInfo.label}
            </div>
          </div>

          {/* Box 2 */}
          <div className="bg-[#020617] p-4 rounded-xl border border-slate-800 space-y-2 shadow-inner">
            <div className="text-slate-400 font-medium">Alamat IP Jaringan</div>
            <div className="space-y-1">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Station IP:</span>
                <span className="text-cyan-300 font-bold">{telemetry?.ip || '192.168.18.187'}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">AP Mode:</span>
                <span className="text-slate-300">{telemetry?.ap_active ? 'Aktif (192.168.4.1)' : 'Non-aktif'}</span>
              </div>
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1 pt-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> WiFi Terhubung
            </div>
          </div>

          {/* Box 3 */}
          <div className="bg-[#020617] p-4 rounded-xl border border-slate-800 space-y-2 shadow-inner">
            <div className="text-slate-400 font-medium">Firmware & Protokol</div>
            <div className="space-y-1">
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Firmware:</span>
                <span className="text-white font-bold">{telemetry?.firmware_version || '2.0.0-mqtt-cmd'}</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-slate-500">Protokol:</span>
                <span className="text-cyan-300 font-bold">v{telemetry?.command_protocol || '2.0'}</span>
              </div>
            </div>
            <div className="text-[11px] text-cyan-400 font-semibold">
              Mendukung Perintah Remote MQTT
            </div>
          </div>

          {/* Box 4 */}
          <div className="bg-[#020617] p-4 rounded-xl border border-slate-800 space-y-2 shadow-inner">
            <div className="text-slate-400 font-medium">MQTT Broker & Topic</div>
            <div className="text-[11px] font-mono text-slate-300 truncate">
              broker.emqx.io:1883
            </div>
            <div className="text-[10px] font-mono text-cyan-400 break-all">
              aquaculture/nila/data/{telemetry?.device || 'nila-E0F908'}/telemetry
            </div>
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              <Radio className="w-3.5 h-3.5 animate-pulse" /> Subscribed Realtime
            </div>
          </div>
        </div>
      </div>

      {/* Raw JSON Accordion */}
      {showJson && (
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" />
              Full Raw Telemetry Payload
            </h2>
            <span className="text-xs text-slate-400 font-mono">JSON Format</span>
          </div>
          <pre className="p-4 bg-[#020617] rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto border border-slate-800 max-h-96 shadow-inner">
            {JSON.stringify(telemetry || {}, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
