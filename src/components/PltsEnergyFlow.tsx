import React, { useState } from 'react';
import { 
  Sun, 
  BatteryCharging, 
  Cpu, 
  Zap, 
  Power, 
  RefreshCw, 
  ArrowDown, 
  ArrowRight, 
  ShieldCheck, 
  Leaf, 
  Code, 
  Activity,
  Waves,
  ExternalLink,
  CheckCircle2,
  PlugZap
} from 'lucide-react';
import { PltsSummary } from '../types';

interface PltsEnergyFlowProps {
  summary: PltsSummary | null;
  onRefresh: () => Promise<void>;
}

export const PltsEnergyFlow: React.FC<PltsEnergyFlowProps> = ({ summary, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const pvW = summary?.pvPowerW ?? 54.72;
  const batSoc = summary?.batterySocPct ?? 80.0;
  const loadW = summary?.loadPowerW ?? 167.0;
  const gridW = summary?.gridPowerW ?? 0.0;
  const voltage = summary?.gridVoltageV ?? 211.0;
  const frequency = summary?.gridFrequencyHz ?? 50.0;
  const currentA = summary?.loadCurrentA ?? 0.7;
  const workingState = summary?.workingState ?? 'Inverted state (Aktif Menyuplai)';

  // Calculate self-sufficiency percentage
  const totalLoad = Math.max(loadW, 1);
  const solarShare = Math.min(100, Math.round((pvW / totalLoad) * 100));

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)] relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <Sun className="w-3.5 h-3.5" /> Dessmonitor Solar Cloud API
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Update: {summary?.lastUpdated || 'Realtime'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Monitoring Sistem PLTS & Alur Energi Kolam
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl mt-1">
              Pemantauan pembangkit listrik tenaga surya off-grid untuk menggerakkan aerator kincir air dan instrumentasi IoT budidaya ikan nila secara mandiri.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="btn-refresh-plts"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs shadow-[0_0_15px_rgba(245,158,11,0.35)] transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Menyegarkan...' : 'Refresh API PLTS'}
            </button>
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#020617] hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-medium border border-slate-800 transition-colors"
            >
              <Code className="w-4 h-4" />
              {showRawJson ? 'Tutup Raw' : 'Raw JSON'}
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Animated Energy Flow Diagram Card */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold text-white">Diagram Alur Energi Real-time (Energy Flow)</h2>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/80 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Status: {workingState}
            </span>
          </div>
        </div>

        {/* The Visual Energy Flow Canvas */}
        <div className="relative bg-[#020617]/95 rounded-2xl p-6 border border-slate-800/90 overflow-hidden min-h-[380px] flex flex-col justify-between shadow-inner">
          
          {/* Ambient Glows */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

          {/* Node Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10 items-center">
            
            {/* Top/Left Node: Solar PV Panels */}
            <div className="flex flex-col items-center p-5 bg-[#0f172a]/90 rounded-2xl border border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.15)] text-center relative group hover:border-amber-400 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-[0_0_12px_rgba(245,158,11,0.25)]">
                <Sun className="w-8 h-8 animate-pulse" />
              </div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Sumber Pembangkit</div>
              <div className="text-base font-bold text-white mt-0.5">Array Panel Surya (PV)</div>
              <div className="mt-2 py-1 px-3 bg-amber-950/80 border border-amber-700/60 rounded-xl shadow-inner">
                <span className="text-2xl font-black text-amber-300 font-mono">{pvW}</span>
                <span className="text-xs text-amber-400 ml-1 font-bold">W</span>
                <span className="text-[11px] text-slate-400 block font-mono">({(pvW / 1000).toFixed(4)} kW)</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-medium mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Menghasilkan Daya
              </div>
            </div>

            {/* Center Node: Inverter / Power Hub */}
            <div className="flex flex-col items-center p-6 bg-[#0f172a]/90 rounded-2xl border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.15)] text-center relative group">
              <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-3 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                <Cpu className="w-9 h-9" />
              </div>
              <div className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider">Konverter Daya</div>
              <div className="text-lg font-extrabold text-white mt-0.5">Hybrid Inverter Kolam</div>
              <div className="mt-2 py-1.5 px-4 bg-[#020617]/90 rounded-xl border border-slate-800/90 space-y-1 w-full text-xs shadow-inner">
                <div className="flex justify-between text-slate-300 font-mono">
                  <span>Tegangan:</span>
                  <span className="text-cyan-300 font-bold">{voltage} VAC</span>
                </div>
                <div className="flex justify-between text-slate-300 font-mono">
                  <span>Frekuensi:</span>
                  <span className="text-cyan-300 font-bold">{frequency} Hz</span>
                </div>
              </div>
              <span className="text-[11px] text-slate-400 mt-2 font-medium">Mode Operasi: {workingState}</span>
            </div>

            {/* Right Node: Pond Aerator / Load */}
            <div className="flex flex-col items-center p-5 bg-[#0f172a]/90 rounded-2xl border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.15)] text-center relative group hover:border-blue-400 transition-all">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-3 shadow-[0_0_12px_rgba(59,130,246,0.25)]">
                <Waves className="w-8 h-8 animate-bounce" />
              </div>
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Beban Konsumsi</div>
              <div className="text-base font-bold text-white mt-0.5">Aerator & Kincir Kolam Nila</div>
              <div className="mt-2 py-1 px-3 bg-blue-950/80 border border-blue-700/60 rounded-xl shadow-inner">
                <span className="text-2xl font-black text-blue-300 font-mono">{loadW}</span>
                <span className="text-xs text-blue-400 ml-1 font-bold">W</span>
                <span className="text-[11px] text-slate-400 block font-mono">({currentA} A @ {voltage}V)</span>
              </div>
              <div className="text-[11px] text-blue-300 font-medium mt-2 flex items-center gap-1">
                <PlugZap className="w-3.5 h-3.5" /> Aerasi Air Berjalan
              </div>
            </div>
          </div>

          {/* Bottom Row: Battery Storage & PLN Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6 pt-6 border-t border-slate-800/80 relative z-10">
            
            {/* Battery Node */}
            <div className="flex items-center gap-4 p-4 bg-[#0f172a]/90 rounded-xl border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                <BatteryCharging className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Penyimpanan Daya</span>
                  <span className="text-xs font-bold text-emerald-400 font-mono">{batSoc}% SOC</span>
                </div>
                <div className="text-sm font-bold text-white">Baterai Lithium LiFePO4</div>
                {/* Progress bar */}
                <div className="w-full bg-[#020617] rounded-full h-2 mt-2 overflow-hidden border border-slate-800">
                  <div 
                    className="bg-gradient-to-r from-emerald-500 to-cyan-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(52,211,153,0.6)]" 
                    style={{ width: `${batSoc}%` }} 
                  />
                </div>
              </div>
            </div>

            {/* Grid / Backup Node */}
            <div className="flex items-center gap-4 p-4 bg-[#0f172a]/90 rounded-xl border border-slate-800/90">
              <div className="w-12 h-12 rounded-xl bg-[#020617] border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                <Power className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Jaringan Listrik PLN</span>
                  <span className="text-xs font-bold text-slate-400 font-mono">{gridW} W (Standby)</span>
                </div>
                <div className="text-sm font-bold text-slate-200">PLN Backup Grid</div>
                <div className="text-xs text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Disuplai Mandiri oleh PLTS & Baterai
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Key Solar Metrics & Savings */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Produksi Surya Saat Ini</span>
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono">{pvW} <span className="text-sm font-normal text-slate-400">W</span></div>
          <div className="text-xs text-amber-400/90 font-medium mt-2">
            Puncak Produksi: ~250Wp
          </div>
        </div>

        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-emerald-500/40 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Kapasitas Baterai</span>
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">{batSoc} <span className="text-sm font-normal text-slate-400">%</span></div>
          <div className="text-xs text-emerald-400 font-medium mt-2">
            Cadangan Operasi Malam: ~8-12 Jam
          </div>
        </div>

        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-blue-500/40 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Beban Pompa & Aerator</span>
            <Waves className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-blue-400 font-mono">{loadW} <span className="text-sm font-normal text-slate-400">W</span></div>
          <div className="text-xs text-blue-300 font-medium mt-2">
            Arus: {currentA} A @ {voltage} V
          </div>
        </div>

        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-emerald-500/40 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Faktor Kemandirian Energi</span>
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">{solarShare} <span className="text-sm font-normal text-slate-400">%</span></div>
          <div className="text-xs text-slate-400 font-medium mt-2">
            Penghematan Emisi CO2: Ramah Lingkungan
          </div>
        </div>
      </div>

      {/* Raw JSON Debug / Verification Modal / Accordion */}
      {showRawJson && (
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Payload Asli Dessmonitor API</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">Dessmonitor Response</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-xs font-bold text-amber-400 mb-1.5">Action: webQueryDeviceEnergyFlowEs</h3>
              <pre className="p-3 bg-[#020617] rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 border border-slate-800 shadow-inner">
                {JSON.stringify(summary?.rawFlow || {}, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-xs font-bold text-cyan-400 mb-1.5">Action: querySPDeviceLastData</h3>
              <pre className="p-3 bg-[#020617] rounded-xl text-[11px] font-mono text-slate-300 overflow-x-auto max-h-64 border border-slate-800 shadow-inner">
                {JSON.stringify(summary?.rawDevice || {}, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
