import React, { useState, useEffect } from 'react';
import {
  Sun,
  Zap,
  BatteryCharging,
  Power,
  RefreshCw,
  Code,
  Activity,
  ArrowRight,
  Info,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Layers,
  Cpu,
  Waves,
  Clock,
  Radio
} from 'lucide-react';
import { PltsSummary } from '../types';

interface PltsIsometricFlowProps {
  summary: PltsSummary | null;
  onRefresh: () => Promise<void>;
}

export const PltsIsometricFlow: React.FC<PltsIsometricFlowProps> = ({ summary, onRefresh }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);
  const [selectedNode, setSelectedNode] = useState<'pv' | 'device' | 'battery' | 'load' | 'grid' | null>(null);
  const [lastFetchTime, setLastFetchTime] = useState<string>(new Date().toLocaleTimeString('id-ID'));
  const [countdown, setCountdown] = useState<number>(10);

  // ---------------------------------------------------------------------------
  // Dessmonitor live energy-flow state
  // Direction MUST come from webQueryDeviceEnergyFlowEs.status:
  //   PV      :  1 generation, 0 idle
  //   Battery :  1 discharge, 0 idle, -1 charge
  //   Grid    :  1 import/buy, 0 idle, -1 export/sell
  //   Load    : -1 consuming, 0 idle
  // Do not infer energy flow from voltage, workingState, or power balance.
  // ---------------------------------------------------------------------------
  const rawFlowResponse = summary?.rawFlow as any;
  const flowDat = rawFlowResponse?.dat ?? rawFlowResponse ?? null;

  const findFlowItem = (items: any[] | undefined, par: string) =>
    Array.isArray(items) ? items.find((item: any) => item?.par === par) ?? items[0] : undefined;

  const pvFlowItem = findFlowItem(flowDat?.pv_status, 'pv_output_power');
  const batteryPowerItem = findFlowItem(flowDat?.bt_status, 'battery_active_power');
  const gridFlowItem = findFlowItem(flowDat?.gd_status, 'grid_active_power');
  const loadFlowItem = findFlowItem(flowDat?.bc_status, 'load_active_power');

  const normalizeStatus = (value: unknown): -1 | 0 | 1 => {
    const n = Number(value);
    return n === 1 ? 1 : n === -1 ? -1 : 0;
  };

  // The diagram uses the PV value from the same energy-flow snapshot as
  // load/grid/battery, while the KPI card can use newer device-last-data.
  const currentPvW = Math.max(0, summary?.pvPowerW ?? 0);
  const pvW = Math.max(0, (summary as any)?.flowPvPowerW ?? currentPvW);
  const batSoc = Math.max(0, Math.min(100, summary?.batterySocPct ?? 0));
  const batteryPowerW = Math.max(0, Math.abs(summary?.batteryPowerW ?? 0));
  const gridW = Math.max(0, Math.abs(summary?.gridPowerW ?? 0));
  const loadW = Math.max(0, summary?.loadPowerW ?? 0);
  const rawVoltage = summary?.gridVoltageV ?? 0;
  const rawFreq = summary?.gridFrequencyHz ?? 0;
  const rawCurrent = summary?.loadCurrentA ?? 0;
  const deviceUpdatedAt = (summary as any)?.deviceUpdatedAt ?? summary?.lastUpdated ?? null;
  const flowUpdatedAt = (summary as any)?.flowUpdatedAt ?? flowDat?.date ?? null;
  const sourceStatus = (summary as any)?.sourceStatus ?? {};
  const rawDate = deviceUpdatedAt || flowUpdatedAt || 'Live';
  const workingState = summary?.workingState ?? 'Unknown';

  // Prefer the raw status of the specific power item. This is important because
  // bt_battery_capacity can have status=-1 even when battery_active_power is 0.
  const summaryFlowStatus = (summary as any)?.flowStatus;

  const pvStatus = pvFlowItem
    ? normalizeStatus(pvFlowItem.status)
    : normalizeStatus(summaryFlowStatus?.pv ?? (pvW > 1 ? 1 : 0));
  const batteryStatus = batteryPowerItem
    ? normalizeStatus(batteryPowerItem.status)
    : normalizeStatus(summaryFlowStatus?.battery ?? 0);
  const gridStatus = gridFlowItem
    ? normalizeStatus(gridFlowItem.status)
    : normalizeStatus(summaryFlowStatus?.grid ?? 0);
  const loadStatus = loadFlowItem
    ? normalizeStatus(loadFlowItem.status)
    : normalizeStatus(summaryFlowStatus?.load ?? (loadW > 1 ? -1 : 0));

  const batteryDirection: 'charging' | 'discharging' | 'idle' =
    batteryPowerW <= 1
      ? 'idle'
      : batteryStatus === -1
        ? 'charging'
        : batteryStatus === 1
          ? 'discharging'
          : 'idle';

  const gridDirection: 'importing' | 'exporting' | 'idle' =
    gridW <= 1
      ? 'idle'
      : gridStatus === 1
        ? 'importing'
        : gridStatus === -1
          ? 'exporting'
          : 'idle';

  const pvActive = pvStatus === 1 && pvW > 1;
  const loadActive = loadStatus === -1 && loadW > 1;
  const batteryActive = batteryDirection !== 'idle' && batteryPowerW > 1;
  const isGridActive = gridDirection !== 'idle' && gridW > 1;
  const isGridAvailable = (summary as any)?.isGridAvailable ?? rawVoltage >= 180;

  const activeSources: string[] = [];
  const activeSinks: string[] = [];
  if (pvActive) activeSources.push(`PV (${pvW.toFixed(1)}W)`);
  if (gridDirection === 'importing' && isGridActive) activeSources.push(`PLN (${gridW.toFixed(0)}W)`);
  if (batteryDirection === 'discharging' && batteryActive) activeSources.push(`Baterai (${batteryPowerW.toFixed(0)}W)`);
  if (loadActive) activeSinks.push(`Beban Kolam (${loadW.toFixed(0)}W)`);
  if (batteryDirection === 'charging' && batteryActive) activeSinks.push(`Cas Baterai (${batteryPowerW.toFixed(0)}W)`);
  if (gridDirection === 'exporting' && isGridActive) activeSinks.push(`Ekspor PLN (${gridW.toFixed(0)}W)`);

  const activeFlowSummary = activeSources.length > 0
    ? `${activeSources.join(' + ')} ➔ Inverter${activeSinks.length ? ` ➔ ${activeSinks.join(' + ')}` : ''}`
    : activeSinks.length > 0
      ? `Inverter ➔ ${activeSinks.join(' + ')}`
      : 'Tidak ada aliran daya aktif (status API = 0)';

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
      setLastFetchTime(new Date().toLocaleTimeString('id-ID'));
      setCountdown(10);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fixed 10s auto refresh interval with live countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          onRefresh().catch(console.error);
          setLastFetchTime(new Date().toLocaleTimeString('id-ID'));
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRefresh]);

  // Standard fixed normal animation speed
  const animDuration = '2.2s';

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.25)]">
                <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> Dessmonitor Energy Flow Diagram
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950/80 text-emerald-300 border border-emerald-800/70 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                Live API: webQueryDeviceEnergyFlowEs
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Device: <strong className="text-slate-200">{deviceUpdatedAt ?? '-'}</strong>
                <span className="mx-1 text-slate-600">•</span>
                Flow: <strong className="text-slate-200">{flowUpdatedAt ?? '-'}</strong>
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Visualisasi Animasi Arus Daya PLTS Kolam Nila
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl mt-1">
              Diagram alur arus energi fotovoltaik (PV), baterai penyimpanan LiFePO4, inverter sentral kolam, beban aerator kincir air, dan interkoneksi PLN secara real-time langsung dari Dessmonitor API.
            </p>
          </div>

          {/* Quick Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              id="btn-refresh-flow"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white rounded-xl font-semibold text-xs shadow-[0_0_18px_rgba(6,182,212,0.4)] transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Mengambil Data...' : 'Refresh Sekarang'}
            </button>

            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#020617] hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-medium border border-slate-800 transition-colors"
            >
              <Code className="w-4 h-4 text-cyan-400" />
              {showRawJson ? 'Tutup Payload' : 'Lihat Raw API'}
            </button>
          </div>
        </div>

        {/* Toolbar: Live Mode & 10s Auto Refresh Info */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-cyan-400" /> Mode Alur:
            </span>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#020617] border border-cyan-500/30 text-cyan-300 font-semibold shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>📡 Dessmonitor: Device {sourceStatus.device ? '✓' : '×'} • Flow {sourceStatus.energyFlow ? '✓' : '×'}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            {/* Auto refresh badge with 10s countdown */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#020617] border border-slate-800 text-xs">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Auto-refresh:</span>
              <span className="font-mono font-bold text-cyan-300">{countdown}s</span>
              <span className="text-slate-600">|</span>
              <span className="text-[11px] text-slate-400">Update: {lastFetchTime}</span>
            </div>

            {/* Animation Speed Status */}
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
              <span>Kecepatan Alur:</span>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-semibold text-[11px]">Normal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Isometric Animated Canvas */}
      <div className="bg-[#0b131e] rounded-3xl border border-slate-800/90 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden p-4 sm:p-8">
        
        {/* Subtle Ambient Radial Light Halos behind nodes */}
        <div className="absolute top-[18%] left-[27%] -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[18%] left-[27%] -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-[18%] right-[27%] translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Live Power Overlay Tags placed accurately matching the image */}
        <div className="w-full relative select-none">
          
          <svg
            viewBox="0 0 1000 580"
            className="w-full h-auto drop-shadow-2xl overflow-visible"
            style={{ minHeight: '440px' }}
          >
            <defs>
              {/* Radial glow filter */}
              <filter id="glow-gold" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="glow-cyan" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="pedestal-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
              </filter>

              {/* Gradient definitions for pipes and pedestals */}
              <linearGradient id="pipe-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              <linearGradient id="pedestal-top" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>

              <linearGradient id="pedestal-rim" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.3" />
              </linearGradient>

              <linearGradient id="inverter-blue" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#0284c7" />
              </linearGradient>
            </defs>

            {/* Custom CSS Animation Keyframes for smooth continuous particle flow */}
            <style>
              {`
                @keyframes flowForward {
                  from { stroke-dashoffset: 44; }
                  to { stroke-dashoffset: 0; }
                }
                @keyframes flowBackward {
                  from { stroke-dashoffset: 0; }
                  to { stroke-dashoffset: 44; }
                }
                .flow-dots-forward {
                  animation: flowForward ${animDuration} linear infinite;
                }
                .flow-dots-backward {
                  animation: flowBackward ${animDuration} linear infinite;
                }
              `}
            </style>

            {/* ========================================================= */}
            {/* 1. PIPELINE TRACKS (Dark rounded conduits behind particles) */}
            {/* ========================================================= */}
            
            {/* Path 1: PV -> Device (From (275, 140) down to (275, 275) -> curve right -> to (455, 275)) */}
            <path
              d="M 275 145 L 275 255 A 20 20 0 0 0 295 275 L 455 275"
              fill="none"
              stroke="#1e293b"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />

            {/* Path 2: Grid -> Device (From (725, 145) down to (725, 275) -> curve left -> to (545, 275)) */}
            <path
              d="M 725 145 L 725 255 A 20 20 0 0 1 705 275 L 545 275"
              fill="none"
              stroke="#1e293b"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />

            {/* Path 3: Battery <-> Device (From (275, 435) up to (275, 315) -> curve right -> to (455, 315)) */}
            <path
              d="M 275 435 L 275 335 A 20 20 0 0 1 295 315 L 455 315"
              fill="none"
              stroke="#1e293b"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />

            {/* Path 4: Device -> Load (From (545, 315) right to (705, 315) -> curve down -> to (725, 435)) */}
            <path
              d="M 545 315 L 705 315 A 20 20 0 0 1 725 335 L 725 435"
              fill="none"
              stroke="#1e293b"
              strokeWidth="14"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.8"
            />

            {/* ========================================================= */}
            {/* 2. ANIMATED GLOWING PARTICLES ALONG PATHS */}
            {/* ========================================================= */}

            {/* Path 1 Animated Flow: PV -> Device (Inverter) */}
            {pvActive && (
              <path
                d="M 275 145 L 275 255 A 20 20 0 0 0 295 275 L 455 275"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeDasharray="0.1 22"
                filter="url(#glow-gold)"
                className="flow-dots-forward"
              />
            )}

            {/* Path 2 Animated Flow: Grid <-> Device. status=1 import, status=-1 export */}
            {isGridActive && (
              <path
                d="M 725 145 L 725 255 A 20 20 0 0 1 705 275 L 545 275"
                fill="none"
                stroke={gridDirection === 'importing' ? '#38bdf8' : '#a78bfa'}
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeDasharray="0.1 22"
                filter="url(#glow-cyan)"
                className={gridDirection === 'importing' ? 'flow-dots-forward' : 'flow-dots-backward'}
              />
            )}

            {/* Path 3 Animated Flow: Inverter -> Battery (Charging / Cas) */}
            {batteryDirection === 'charging' && batteryActive && (
              <path
                d="M 455 315 L 295 315 A 20 20 0 0 0 275 335 L 275 435"
                fill="none"
                stroke="#34d399"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeDasharray="0.1 22"
                filter="url(#glow-cyan)"
                className="flow-dots-forward"
              />
            )}

            {/* Path 3 Animated Flow: Battery -> Inverter (Discharging) */}
            {batteryDirection === 'discharging' && batteryActive && (
              <path
                d="M 275 435 L 275 335 A 20 20 0 0 1 295 315 L 455 315"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeDasharray="0.1 22"
                filter="url(#glow-gold)"
                className="flow-dots-forward"
              />
            )}

            {/* Path 4 Animated Flow: Inverter -> Load (Beban Aerator & Kincir) */}
            {loadActive && (
              <path
                d="M 545 315 L 705 315 A 20 20 0 0 1 725 335 L 725 435"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeDasharray="0.1 22"
                filter="url(#glow-gold)"
                className="flow-dots-forward"
              />
            )}

            {/* ========================================================= */}
            {/* 3. WATTAGE LABELS (Matching typography & placement in image) */}
            {/* ========================================================= */}
            
            {/* PV Output Power: e.g. "32.3W" in bright cyan over the horizontal pipe */}
            <g transform="translate(345, 252)">
              <text
                textAnchor="middle"
                className="font-mono font-bold select-none cursor-pointer"
                fill="#38bdf8"
                fontSize="17"
                letterSpacing="0.5"
                filter="drop-shadow(0 0 6px rgba(56,189,248,0.6))"
                onClick={() => setSelectedNode('pv')}
              >
                {pvW.toFixed(1)}W
              </text>
            </g>

            {/* Grid power is displayed only when the API reports actual import/export flow */}
            {isGridActive && (
              <g transform="translate(640, 252)">
                <text
                  textAnchor="middle"
                  className="font-mono font-bold select-none cursor-pointer"
                  fill={gridDirection === 'importing' ? '#38bdf8' : '#a78bfa'}
                  fontSize="17"
                  letterSpacing="0.5"
                  filter="drop-shadow(0 0 6px rgba(56,189,248,0.6))"
                  onClick={() => setSelectedNode('grid')}
                >
                  {gridDirection === 'importing' ? 'PLN ' : 'Ekspor '}{gridW.toFixed(0)}W
                </text>
              </g>
            )}

            {/* Battery Capacity % & Charging Status: e.g. "68% (Cas +45W)" */}
            <g transform="translate(355, 470)">
              <text
                textAnchor="start"
                className="font-mono font-bold select-none cursor-pointer"
                fill={batteryDirection === 'charging' ? '#34d399' : '#38bdf8'}
                fontSize="17"
                letterSpacing="0.5"
                filter="drop-shadow(0 0 6px rgba(56,189,248,0.6))"
                onClick={() => setSelectedNode('battery')}
              >
                {batSoc.toFixed(0)}%{batteryDirection === 'charging' ? ` (+${batteryPowerW.toFixed(0)}W)` : batteryDirection === 'discharging' ? ` (-${batteryPowerW.toFixed(0)}W)` : ' (Idle)'}
              </text>
            </g>

            {/* Load Power: e.g. "167W" over horizontal pipe to Load */}
            <g transform="translate(650, 355)">
              <text
                textAnchor="middle"
                className="font-mono font-bold select-none cursor-pointer"
                fill="#38bdf8"
                fontSize="17"
                letterSpacing="0.5"
                filter="drop-shadow(0 0 6px rgba(56,189,248,0.6))"
                onClick={() => setSelectedNode('load')}
              >
                {loadW.toFixed(0)}W
              </text>
            </g>

            {/* ========================================================= */}
            {/* 4. ISOMETRIC 3D PEDESTALS & NODE GRAPHICS */}
            {/* ========================================================= */}

            {/* --- NODE 1: PV (Top Left at 275, 115) --- */}
            <g
              transform="translate(275, 115)"
              className="cursor-pointer transition-all duration-300 hover:scale-105"
              onClick={() => setSelectedNode('pv')}
            >
              {/* Cyan ambient aura */}
              <ellipse cx="0" cy="15" rx="55" ry="25" fill="#38bdf8" opacity="0.2" filter="url(#pedestal-blur)" />

              {/* 3D Platform Bottom Facet */}
              <polygon
                points="-52,0 0,22 52,0 52,10 0,32 -52,10"
                fill="#0f172a"
                stroke="#1e293b"
                strokeWidth="1.5"
              />

              {/* 3D Platform Top Diamond */}
              <polygon
                points="0,-22 52,0 0,22 -52,0"
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeOpacity="0.8"
                filter="drop-shadow(0 0 8px rgba(56,189,248,0.4))"
              />

              {/* Inner Diamond Glow Ring */}
              <polygon
                points="0,-15 36,0 0,15 -36,0"
                fill="#0f172a"
                stroke="#7dd3fc"
                strokeWidth="1.2"
                strokeOpacity="0.9"
              />

              {/* Solar Panel 3D Icon Graphic */}
              <g transform="translate(0, -32)">
                {/* Solar Panel Frame */}
                <polygon
                  points="-24,-14 24,-14 30,10 -30,10"
                  fill="#0284c7"
                  stroke="#e0f2fe"
                  strokeWidth="1.5"
                />
                {/* Solar Cell Grid Lines */}
                <line x1="-12" y1="-14" x2="-15" y2="10" stroke="#bae6fd" strokeWidth="1" />
                <line x1="0" y1="-14" x2="0" y2="10" stroke="#bae6fd" strokeWidth="1" />
                <line x1="12" y1="-14" x2="15" y2="10" stroke="#bae6fd" strokeWidth="1" />
                <line x1="-27" y1="-2" x2="27" y2="-2" stroke="#bae6fd" strokeWidth="1" />
                {/* Stand */}
                <polygon points="-5,10 5,10 2,20 -2,20" fill="#cbd5e1" />
              </g>

              {/* Label "PV" */}
              <text
                y="52"
                textAnchor="middle"
                className="font-sans font-bold select-none text-sm"
                fill="#ffffff"
                fontSize="15"
                letterSpacing="0.5"
              >
                PV
              </text>
            </g>


            {/* --- NODE 2: GRID (Top Right at 725, 115) --- */}
            <g
              transform="translate(725, 115)"
              className="cursor-pointer transition-all duration-300 hover:scale-105"
              onClick={() => setSelectedNode('grid')}
            >
              {/* Standby/Dimmed Aura or Active Aura */}
              <ellipse
                cx="0"
                cy="15"
                rx="55"
                ry="25"
                fill={isGridActive ? "#38bdf8" : "#334155"}
                opacity={isGridActive ? "0.3" : "0.08"}
                filter="url(#pedestal-blur)"
              />

              {/* 3D Platform Bottom Facet */}
              <polygon
                points="-52,0 0,22 52,0 52,10 0,32 -52,10"
                fill="#0f172a"
                stroke="#1e293b"
                strokeWidth="1.5"
              />

              {/* 3D Platform Top Diamond */}
              <polygon
                points="0,-22 52,0 0,22 -52,0"
                fill="#1e293b"
                stroke={isGridActive ? "#38bdf8" : "#475569"}
                strokeWidth="2"
                strokeOpacity={isGridActive ? "0.95" : "0.4"}
                filter={isGridActive ? "drop-shadow(0 0 10px rgba(56,189,248,0.5))" : undefined}
              />

              {/* Transmission Tower (Pylon) Graphic */}
              <g transform="translate(0, -32)" opacity={isGridActive ? "1" : "0.4"}>
                {/* Pylon Main Legs */}
                <line x1="-16" y1="16" x2="-4" y2="-22" stroke={isGridActive ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8" />
                <line x1="16" y1="16" x2="4" y2="-22" stroke={isGridActive ? "#38bdf8" : "#94a3b8"} strokeWidth="1.8" />
                {/* Crossarms */}
                <line x1="-22" y1="-14" x2="22" y2="-14" stroke={isGridActive ? "#7dd3fc" : "#94a3b8"} strokeWidth="1.8" />
                <line x1="-18" y1="-2" x2="18" y2="-2" stroke={isGridActive ? "#7dd3fc" : "#94a3b8"} strokeWidth="1.8" />
                {/* Braces */}
                <line x1="-14" y1="8" x2="14" y2="8" stroke={isGridActive ? "#38bdf8" : "#94a3b8"} strokeWidth="1.2" />
                <line x1="-14" y1="8" x2="0" y2="-2" stroke={isGridActive ? "#38bdf8" : "#94a3b8"} strokeWidth="1.2" />
                <line x1="14" y1="8" x2="0" y2="-2" stroke={isGridActive ? "#38bdf8" : "#94a3b8"} strokeWidth="1.2" />
                <line x1="-10" y1="-2" x2="0" y2="-14" stroke={isGridActive ? "#7dd3fc" : "#94a3b8"} strokeWidth="1.2" />
                <line x1="10" y1="-2" x2="0" y2="-14" stroke={isGridActive ? "#7dd3fc" : "#94a3b8"} strokeWidth="1.2" />
                {isGridActive && (
                  <circle cx="0" cy="-22" r="3" fill="#38bdf8" filter="drop-shadow(0 0 6px #38bdf8)" />
                )}
              </g>

              {/* Label "Grid" */}
              <text
                y="52"
                textAnchor="middle"
                className="font-sans font-bold select-none text-sm"
                fill={isGridActive ? "#ffffff" : "#94a3b8"}
                fontSize="15"
                letterSpacing="0.5"
              >
                Grid
              </text>
            </g>


            {/* --- NODE 3: DEVICE (Center Inverter at 500, 295) --- */}
            <g
              transform="translate(500, 295)"
              className="cursor-pointer transition-all duration-300 hover:scale-105"
              onClick={() => setSelectedNode('device')}
            >
              {/* Cyan ambient glowing aura */}
              <ellipse cx="0" cy="18" rx="65" ry="30" fill="#38bdf8" opacity="0.35" filter="url(#pedestal-blur)" />

              {/* 3D Platform Bottom Facet */}
              <polygon
                points="-58,0 0,25 58,0 58,12 0,37 -58,12"
                fill="#0f172a"
                stroke="#1e293b"
                strokeWidth="1.5"
              />

              {/* 3D Platform Top Diamond */}
              <polygon
                points="0,-25 58,0 0,25 -58,0"
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth="2.5"
                strokeOpacity="0.9"
                filter="drop-shadow(0 0 12px rgba(56,189,248,0.6))"
              />

              {/* Inner Diamond Glow Ring */}
              <polygon
                points="0,-18 42,0 0,18 -42,0"
                fill="#0f172a"
                stroke="#e0f2fe"
                strokeWidth="1.5"
              />

              {/* Hybrid Inverter Box Graphic (Cyan box with LCD screen '- / ~') */}
              <g transform="translate(0, -36)">
                {/* Inverter body */}
                <rect
                  x="-20"
                  y="-22"
                  width="40"
                  height="44"
                  rx="6"
                  fill="url(#inverter-blue)"
                  stroke="#e0f2fe"
                  strokeWidth="1.5"
                  filter="drop-shadow(0 0 10px rgba(56,189,248,0.5))"
                />
                {/* LCD Display */}
                <rect
                  x="-13"
                  y="-14"
                  width="26"
                  height="22"
                  rx="3"
                  fill="#082f49"
                  stroke="#7dd3fc"
                  strokeWidth="1"
                />
                {/* Display text: "-/~" */}
                <text
                  x="0"
                  y="2"
                  textAnchor="middle"
                  className="font-mono font-black"
                  fill="#38bdf8"
                  fontSize="12"
                >
                  -/~
                </text>
                {/* Bottom Status LEDs */}
                <circle cx="-8" cy="14" r="1.8" fill="#4ade80" />
                <circle cx="0" cy="14" r="1.8" fill="#38bdf8" />
                <circle cx="8" cy="14" r="1.8" fill="#facc15" />
              </g>

              {/* Label "Device" */}
              <text
                y="58"
                textAnchor="middle"
                className="font-sans font-bold select-none text-sm"
                fill="#ffffff"
                fontSize="15"
                letterSpacing="0.5"
              >
                Device
              </text>
            </g>


            {/* --- NODE 4: BATTERY (Bottom Left at 275, 475) --- */}
            <g
              transform="translate(275, 475)"
              className="cursor-pointer transition-all duration-300 hover:scale-105"
              onClick={() => setSelectedNode('battery')}
            >
              {/* Ambient Aura */}
              <ellipse cx="0" cy="15" rx="55" ry="25" fill="#38bdf8" opacity="0.25" filter="url(#pedestal-blur)" />

              {/* 3D Platform Bottom Facet */}
              <polygon
                points="-52,0 0,22 52,0 52,10 0,32 -52,10"
                fill="#0f172a"
                stroke="#1e293b"
                strokeWidth="1.5"
              />

              {/* 3D Platform Top Diamond */}
              <polygon
                points="0,-22 52,0 0,22 -52,0"
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeOpacity="0.8"
                filter="drop-shadow(0 0 8px rgba(56,189,248,0.4))"
              />

              {/* Inner Ring */}
              <polygon
                points="0,-15 36,0 0,15 -36,0"
                fill="#0f172a"
                stroke="#7dd3fc"
                strokeWidth="1.2"
              />

              {/* Battery Graphic (Cyan Frame with glowing charge bars) */}
              <g transform="translate(0, -30)">
                {/* Battery Top Terminal */}
                <rect x="-6" y="-23" width="12" height="4" rx="1.5" fill="#38bdf8" />
                {/* Battery Outer Frame */}
                <rect
                  x="-22"
                  y="-19"
                  width="44"
                  height="36"
                  rx="5"
                  fill="#03243a"
                  stroke="#38bdf8"
                  strokeWidth="2"
                />
                {/* Horizontal Charging Bars */}
                <rect x="-16" y="8" width="32" height="4" rx="1" fill="#38bdf8" />
                <rect x="-16" y="0" width="32" height="4" rx="1" fill="#38bdf8" />
                <rect
                  x="-16"
                  y="-8"
                  width="32"
                  height="4"
                  rx="1"
                  fill={batSoc > 50 ? "#38bdf8" : "#0f334a"}
                />
                <rect
                  x="-16"
                  y="-16"
                  width="32"
                  height="4"
                  rx="1"
                  fill={batSoc > 75 ? "#38bdf8" : "#0f334a"}
                />
              </g>

              {/* Label "Battery" */}
              <text
                y="52"
                textAnchor="middle"
                className="font-sans font-bold select-none text-sm"
                fill="#ffffff"
                fontSize="15"
                letterSpacing="0.5"
              >
                Battery
              </text>
            </g>


            {/* --- NODE 5: LOAD (Bottom Right at 725, 475) --- */}
            <g
              transform="translate(725, 475)"
              className="cursor-pointer transition-all duration-300 hover:scale-105"
              onClick={() => setSelectedNode('load')}
            >
              {/* Ambient Aura */}
              <ellipse cx="0" cy="15" rx="55" ry="25" fill="#38bdf8" opacity="0.25" filter="url(#pedestal-blur)" />

              {/* 3D Platform Bottom Facet */}
              <polygon
                points="-52,0 0,22 52,0 52,10 0,32 -52,10"
                fill="#0f172a"
                stroke="#1e293b"
                strokeWidth="1.5"
              />

              {/* 3D Platform Top Diamond */}
              <polygon
                points="0,-22 52,0 0,22 -52,0"
                fill="#1e293b"
                stroke="#38bdf8"
                strokeWidth="2"
                strokeOpacity="0.8"
                filter="drop-shadow(0 0 8px rgba(56,189,248,0.4))"
              />

              {/* Inner Ring */}
              <polygon
                points="0,-15 36,0 0,15 -36,0"
                fill="#0f172a"
                stroke="#7dd3fc"
                strokeWidth="1.2"
              />

              {/* House/Load Graphic with glowing windows */}
              <g transform="translate(0, -32)">
                {/* Pitched Roof */}
                <polygon
                  points="0,-22 24,-2 20,2 0,-14 -20,2 -24,-2"
                  fill="#38bdf8"
                  stroke="#e0f2fe"
                  strokeWidth="1.5"
                />
                {/* House Walls */}
                <polygon
                  points="-18,2 18,2 18,18 -18,18"
                  fill="#03243a"
                  stroke="#38bdf8"
                  strokeWidth="1.8"
                />
                {/* Windows & Door */}
                <rect x="-12" y="6" width="6" height="6" rx="1" fill="#7dd3fc" />
                <rect x="6" y="6" width="6" height="6" rx="1" fill="#7dd3fc" />
                <rect x="-3" y="8" width="6" height="10" rx="1" fill="#e0f2fe" />
              </g>

              {/* Label "Load" */}
              <text
                y="52"
                textAnchor="middle"
                className="font-sans font-bold select-none text-sm"
                fill="#ffffff"
                fontSize="15"
                letterSpacing="0.5"
              >
                Load
              </text>
            </g>

          </svg>
        </div>

        {/* Legend / Status Overlay Bar on bottom of canvas */}
        <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-300">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-ping" />
              <span className="text-slate-400">Arus Daya Aktif:</span>
              <strong className="text-emerald-300 font-mono">
                {activeFlowSummary}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Klik elemen diagram untuk rincian modul
            </span>
          </div>
        </div>
      </div>

      {/* Selected Node Details Drawer or Quick Telemetry Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* PV Card */}
        <div
          onClick={() => setSelectedNode('pv')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedNode === 'pv'
              ? 'bg-[#0f172a] border-amber-500/80 shadow-[0_0_20px_rgba(245,158,11,0.25)] ring-1 ring-amber-400'
              : 'bg-[#0f172a]/90 backdrop-blur-md border-slate-800/90 hover:border-amber-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pembangkit PV</span>
            <Sun className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-xl font-black text-amber-400 font-mono">
            {pvW.toFixed(1)} <span className="text-xs text-slate-400">W</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-emerald-400 font-semibold">{pvW > 0 ? 'Aktif Menghasilkan' : 'Standby'}</span>
            </div>
            <div className="flex justify-between">
              <span>Alur:</span>
              <span className="text-cyan-300 font-mono text-[11px]">PV ➔ Inverter</span>
            </div>
          </div>
        </div>

        {/* Grid PLN Card */}
        <div
          onClick={() => setSelectedNode('grid')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedNode === 'grid'
              ? 'bg-[#0f172a] border-cyan-500/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400'
              : 'bg-[#0f172a]/90 backdrop-blur-md border-slate-800/90 hover:border-cyan-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Jaringan PLN</span>
            <Power className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-cyan-400 font-mono">
            {gridW.toFixed(0)} <span className="text-xs text-slate-400">W</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className={isGridActive ? "text-emerald-400 font-semibold" : "text-slate-400"}>
                {gridDirection === 'importing' && isGridActive
                  ? 'PLN Menyuplai'
                  : gridDirection === 'exporting' && isGridActive
                    ? 'Ekspor ke PLN'
                    : isGridAvailable
                      ? 'PLN Tersedia • Tanpa Aliran'
                      : 'PLN Tidak Tersedia'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Alur:</span>
              <span className="text-cyan-300 font-mono text-[11px]">
                {gridDirection === 'importing' && isGridActive
                  ? 'PLN ➔ Inverter'
                  : gridDirection === 'exporting' && isGridActive
                    ? 'Inverter ➔ PLN'
                    : 'Tidak ada aliran'}
              </span>
            </div>
          </div>
        </div>

        {/* Inverter Card */}
        <div
          onClick={() => setSelectedNode('device')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedNode === 'device'
              ? 'bg-[#0f172a] border-cyan-500/80 shadow-[0_0_20px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400'
              : 'bg-[#0f172a]/90 backdrop-blur-md border-slate-800/90 hover:border-cyan-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Inverter Hub</span>
            <Cpu className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-black text-cyan-400 font-mono">
            {rawVoltage} <span className="text-xs text-slate-400">VAC</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Frekuensi:</span>
              <span className="text-slate-200 font-mono">{rawFreq} Hz</span>
            </div>
            <div className="flex justify-between">
              <span>Mode:</span>
              <span className="text-cyan-300 truncate max-w-[120px] font-semibold text-[11px]">{workingState}</span>
            </div>
          </div>
        </div>

        {/* Battery Card */}
        <div
          onClick={() => setSelectedNode('battery')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedNode === 'battery'
              ? 'bg-[#0f172a] border-emerald-500/80 shadow-[0_0_20px_rgba(16,185,129,0.25)] ring-1 ring-emerald-400'
              : 'bg-[#0f172a]/90 backdrop-blur-md border-slate-800/90 hover:border-emerald-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Baterai LiFePO4</span>
            <BatteryCharging className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-black text-emerald-400 font-mono">
            {batSoc.toFixed(1)} <span className="text-xs text-slate-400">% SOC</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Status:</span>
              <span className="text-emerald-400 font-semibold capitalize">
                {batteryDirection === 'charging' && batteryActive
                  ? `Mengisi (+${batteryPowerW.toFixed(0)}W)`
                  : batteryDirection === 'discharging' && batteryActive
                    ? `Discharge (${batteryPowerW.toFixed(0)}W)`
                    : 'Idle (0W)'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Alur:</span>
              <span className="text-emerald-300 font-mono text-[11px]">
                {batteryDirection === 'charging' && batteryActive
                  ? 'Inverter ➔ Baterai'
                  : batteryDirection === 'discharging' && batteryActive
                    ? 'Baterai ➔ Inverter'
                    : 'Tidak ada aliran'}
              </span>
            </div>
          </div>
        </div>

        {/* Load Card */}
        <div
          onClick={() => setSelectedNode('load')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            selectedNode === 'load'
              ? 'bg-[#0f172a] border-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.25)] ring-1 ring-blue-400'
              : 'bg-[#0f172a]/90 backdrop-blur-md border-slate-800/90 hover:border-blue-500/40'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Beban Kolam</span>
            <Waves className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-black text-blue-400 font-mono">
            {loadW.toFixed(0)} <span className="text-xs text-slate-400">W</span>
          </div>
          <div className="text-xs text-slate-400 mt-2 space-y-1">
            <div className="flex justify-between">
              <span>Arus Konsumsi:</span>
              <span className="text-slate-200 font-mono">{rawCurrent} A</span>
            </div>
            <div className="flex justify-between">
              <span>Alur:</span>
              <span className="text-blue-300 font-mono text-[11px]">Inverter ➔ Beban</span>
            </div>
          </div>
        </div>
      </div>

      {/* Raw JSON Payload Inspector */}
      {showRawJson && (
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Payload Asli: 2 Endpoint Dessmonitor</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">querySPDeviceLastData + webQueryDeviceEnergyFlowEs</span>
          </div>

          <pre className="p-4 bg-[#020617] rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto max-h-80 border border-slate-800 shadow-inner">
            {JSON.stringify({
              querySPDeviceLastData: summary?.rawDevice ?? {
                dat: {
                  gts: deviceUpdatedAt,
                  pars: {
                    gd_: [
                      { id: 'gd_input_voltage', val: rawVoltage, unit: 'V' },
                      { id: 'gd_input_frequency', val: rawFreq, unit: 'Hz' }
                    ],
                    sy_: [{ id: 'sy_status', val: workingState }],
                    pv_: [{ id: 'pv_output_power', val: currentPvW, unit: 'W' }],
                    bt_: [{ id: 'bt_battery_capacity', val: batSoc, unit: '%' }],
                    bc_: [{ id: 'bc_load_current', val: rawCurrent, unit: 'A' }]
                  }
                }
              },
              webQueryDeviceEnergyFlowEs: summary?.rawFlow ?? {
                dat: {
                  date: flowUpdatedAt,
                  pv_status: [{ par: 'pv_output_power', val: pvW, unit: 'W', status: pvStatus }],
                  bt_status: [{ par: 'battery_active_power', val: batteryPowerW, unit: 'W', status: batteryStatus }],
                  gd_status: [{ par: 'grid_active_power', val: gridW, unit: 'W', status: gridStatus }],
                  bc_status: [{ par: 'load_active_power', val: loadW, unit: 'W', status: loadStatus }]
                }
              }
            }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
