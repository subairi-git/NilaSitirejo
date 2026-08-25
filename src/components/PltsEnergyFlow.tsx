import React from 'react';
import {
  Sun,
  BatteryCharging,
  Leaf,
  Waves,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { PltsSummary } from '../types';
import { PltsIsometricFlow } from './PltsIsometricFlow';
import { PltsPowerComparisonChart } from './PltsPowerComparisonChart';

interface PltsEnergyFlowProps {
  summary: PltsSummary | null;
  onRefresh: () => Promise<void>;
}

const normalizeStatus = (value: unknown): -1 | 0 | 1 => {
  const n = Number(value);
  return n === 1 ? 1 : n === -1 ? -1 : 0;
};

export const PltsEnergyFlow: React.FC<PltsEnergyFlowProps> = ({ summary, onRefresh }) => {
  const pvW = Math.max(0, summary?.pvPowerW ?? 0);
  const flowPvW = Math.max(0, (summary as any)?.flowPvPowerW ?? pvW);
  const batSoc = Math.max(0, Math.min(100, summary?.batterySocPct ?? 0));
  const loadW = Math.max(0, summary?.loadPowerW ?? 0);
  const voltage = summary?.gridVoltageV ?? 0;
  const frequency = summary?.gridFrequencyHz ?? 0;
  const currentA = summary?.loadCurrentA ?? 0;
  const sourceStatus = (summary as any)?.sourceStatus ?? {};
  const deviceUpdatedAt = (summary as any)?.deviceUpdatedAt ?? null;
  const flowUpdatedAt = (summary as any)?.flowUpdatedAt ?? null;

  const rawFlowResponse = summary?.rawFlow as any;
  const flowDat = rawFlowResponse?.dat ?? rawFlowResponse ?? null;
  const rawGridItem = Array.isArray(flowDat?.gd_status)
    ? flowDat.gd_status.find((item: any) => item?.par === 'grid_active_power') ?? flowDat.gd_status[0]
    : undefined;
  const batteryItems = Array.isArray(flowDat?.bt_status) ? flowDat.bt_status : [];
  const rawBatteryPowerItem = batteryItems.find(
    (item: any) => item?.par === 'battery_active_power'
  );
  const rawBatteryStatusItem =
    batteryItems.find((item: any) => normalizeStatus(item?.status) !== 0) ??
    batteryItems.find((item: any) => item?.status !== undefined) ??
    batteryItems[0];

  const summaryFlowStatus = (summary as any)?.flowStatus;
  const gridStatus = rawGridItem
    ? normalizeStatus(rawGridItem.status)
    : normalizeStatus(summaryFlowStatus?.grid ?? 0);
  const batteryStatus = rawBatteryStatusItem
    ? normalizeStatus(rawBatteryStatusItem.status)
    : normalizeStatus(summaryFlowStatus?.battery ?? 0);

  const gridPowerW = Math.max(0, Math.abs(summary?.gridPowerW ?? 0));
  const batteryPowerW = Math.max(0, Math.abs(summary?.batteryPowerW ?? 0));

  // Direction comes from gd_status.status, not from gridPowerW magnitude.
  const gridDirection: 'importing' | 'exporting' | 'idle' =
    gridStatus === 1
      ? 'importing'
      : gridStatus === -1
        ? 'exporting'
        : 'idle';
  const batteryDirection: 'charging' | 'discharging' | 'idle' =
    batteryStatus === -1
      ? 'charging'
      : batteryStatus === 1
        ? 'discharging'
        : 'idle';

  const batteryPowerAvailable = (summary as any)?.batteryPowerAvailable ?? Boolean(rawBatteryPowerItem);

  // This is only an instantaneous PV-to-load ratio, not a claim about total daily self-sufficiency.
  const pvLoadRatio = loadW > 0 ? Math.round((flowPvW / loadW) * 100) : 0;
  const solarShare = Math.min(100, pvLoadRatio);

  const energyModeText =
    gridDirection === 'importing'
      ? 'PLN sedang menyuplai sistem'
      : gridDirection === 'exporting'
        ? 'Surplus energi sedang diekspor ke PLN'
        : batteryDirection === 'discharging'
          ? 'Baterai sedang membantu menyuplai beban'
          : batteryDirection === 'charging'
            ? 'Baterai sedang menerima pengisian'
            : 'Tidak ada aliran PLN/Baterai terdeteksi';

  return (
    <div className="space-y-6">
      {/* Main live diagram. All directions are status-driven by Dessmonitor. */}
      <PltsIsometricFlow summary={summary} onRefresh={onRefresh} />

      {/* Line chart requested below the animated PLTS flow diagram. */}
      <PltsPowerComparisonChart />

      <div className="flex flex-wrap gap-2 text-[11px]">
        <span className={`px-2.5 py-1 rounded-lg border ${sourceStatus.device ? 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300' : 'border-rose-700/60 bg-rose-950/30 text-rose-300'}`}>
          Device Last Data: {sourceStatus.device ? 'OK' : 'Tidak tersedia'}
        </span>
        <span className={`px-2.5 py-1 rounded-lg border ${sourceStatus.energyFlow ? 'border-cyan-700/60 bg-cyan-950/30 text-cyan-300' : 'border-rose-700/60 bg-rose-950/30 text-rose-300'}`}>
          Energy Flow: {sourceStatus.energyFlow ? 'OK' : 'Tidak tersedia'}
        </span>
      </div>

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
            <CheckCircle2 className="w-3.5 h-3.5" /> querySPDeviceLastData{deviceUpdatedAt ? ` • ${deviceUpdatedAt}` : ''}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Snapshot diagram: {flowPvW.toFixed(1)} W{flowUpdatedAt ? ` • ${flowUpdatedAt}` : ''}
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
            <ShieldCheck className="w-3.5 h-3.5" />
            {batteryDirection === 'charging'
              ? `Status API: charging (-1)${batteryPowerAvailable && batteryPowerW > 0.5 ? ` • ${batteryPowerW.toFixed(0)} W` : ''}`
              : batteryDirection === 'discharging'
                ? `Status API: discharging (1)${batteryPowerAvailable && batteryPowerW > 0.5 ? ` • ${batteryPowerW.toFixed(0)} W` : ''}`
                : 'Status aliran: idle (0)'}
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
          <div className="text-xs text-blue-300 font-medium mt-2 space-y-1">
            <div>Arus: {currentA} A @ {voltage} VAC ({frequency} Hz)</div>
            <div className="text-[11px] text-slate-500">
              Daya: energy-flow API{flowUpdatedAt ? ` • ${flowUpdatedAt}` : ''}
            </div>
          </div>
        </div>

        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-emerald-500/40 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] transition-all">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Cakupan Beban oleh PV</span>
            <Leaf className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">
            {solarShare} <span className="text-sm font-normal text-slate-400">%</span>
          </div>
          <div className="text-xs text-slate-400 font-medium mt-2 space-y-1">
            <div>{energyModeText}</div>
            <div className="text-[11px] text-slate-500">Rasio PV/Beban snapshot flow: {pvLoadRatio}%</div>
          </div>
        </div>
      </div>
    </div>
  );
};
