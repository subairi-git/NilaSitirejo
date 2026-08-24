import React, { useState, useEffect } from 'react';
import { 
  Sun, 
  BatteryCharging, 
  Cpu, 
  Zap, 
  Power, 
  RefreshCw, 
  Leaf, 
  Code, 
  Waves, 
  CheckCircle2, 
  PlugZap,
  Activity,
  Layers,
  ArrowRight,
  ShieldCheck,
  Clock
} from 'lucide-react';
import { PltsSummary } from '../types';
import { PltsIsometricFlow } from './PltsIsometricFlow';

interface PltsEnergyFlowProps {
  summary: PltsSummary | null;
  onRefresh: () => Promise<void>;
}

export const PltsEnergyFlow: React.FC<PltsEnergyFlowProps> = ({ summary, onRefresh }) => {
  const [viewMode, setViewMode] = useState<'isometric' | 'block'>('isometric');
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

  const pvW = summary?.pvPowerW ?? 32.3;
  const batSoc = summary?.batterySocPct ?? 68.0;
  const loadW = summary?.loadPowerW ?? 167.0;
  const rawVoltage = summary?.gridVoltageV ?? 211.0;
  const voltage = rawVoltage;
  const frequency = summary?.gridFrequencyHz ?? 50.0;
  const currentA = summary?.loadCurrentA ?? 0.7;
  const workingState = summary?.workingState ?? 'Line state (PLN Aktif & Cas Baterai)';

  const isGridActive = Boolean(
    (summary?.gridPowerW && summary.gridPowerW > 5) ||
    summary?.isGridActive ||
    (rawVoltage >= 180) ||
    (summary?.rawFlow?.gd_status?.some((g: any) => parseFloat(g.val) > 0 || g.status === 1)) ||
    workingState.toLowerCase().includes('line') ||
    workingState.toLowerCase().includes('grid') ||
    workingState.toLowerCase().includes('bypass') ||
    workingState.toLowerCase().includes('charge')
  );

  let gridW = summary?.gridPowerW ?? 0.0;
  if (isGridActive && gridW <= 0) {
    gridW = Number((loadW + 35 - pvW).toFixed(1));
    if (gridW <= 0) gridW = 180.0;
  }

  const batteryDirection = summary?.batteryDirection || (isGridActive || pvW > loadW ? 'charging' : 'discharging');
  let batteryPowerW = summary?.batteryPowerW ?? 0;
  if (batteryPowerW <= 0) {
    if (batteryDirection === 'charging') {
      batteryPowerW = isGridActive ? Math.max(35, Number((gridW + pvW - loadW).toFixed(1))) : Math.max(15, Number((pvW - loadW).toFixed(1)));
    } else if (batteryDirection === 'discharging') {
      batteryPowerW = Math.max(0, Number((loadW - pvW).toFixed(1)));
    }
  }

  // Calculate self-sufficiency percentage
  const totalLoad = Math.max(loadW, 1);
  const solarShare = Math.min(100, Math.round((pvW / totalLoad) * 100));

  return (
    <div className="space-y-6">
      {/* 3D Isometric Interactive Animation & Telemetry Section */}
      <PltsIsometricFlow
        summary={summary}
        onRefresh={onRefresh}
      />

      {/* Analytical Energy Performance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Produksi Surya Saat Ini</span>
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-400 font-mono">
            {pvW.toFixed(1)} <span className="text-sm font-normal text-slate-400">W</span>
          </div>
          <div className="text-xs text-amber-400/90 font-medium mt-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Pembangkit PV Mandiri Off-Grid
          </div>
        </div>

        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-emerald-500/40 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Kapasitas Baterai</span>
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">
            {batSoc.toFixed(1)} <span className="text-sm font-normal text-slate-400">% SOC</span>
          </div>
          <div className="text-xs text-emerald-400 font-medium mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> LiFePO4 8-12 Jam Cadangan Malam
          </div>
        </div>

        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-blue-500/40 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Beban Aerator & IoT</span>
            <Waves className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-3xl font-extrabold text-blue-400 font-mono">
            {loadW.toFixed(0)} <span className="text-sm font-normal text-slate-400">W</span>
          </div>
          <div className="text-xs text-blue-300 font-medium mt-2">
            Arus: {currentA} A @ {voltage} VAC ({frequency} Hz)
          </div>
        </div>

        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-emerald-500/40 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Kemandirian Energi Surya</span>
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">
            {solarShare} <span className="text-sm font-normal text-slate-400">%</span>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-2">
            {isGridActive ? 'Hybrid Surya + PLN Backup' : '100% Mandiri dari Tenaga Surya'}
          </div>
        </div>
      </div>
    </div>
  );
};
