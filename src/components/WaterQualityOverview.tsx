import React from 'react';
import { 
  Droplet, 
  Wind, 
  Thermometer, 
  Sun, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Cpu, 
  Wifi, 
  Clock, 
  BatteryMedium, 
  ArrowRight,
  ShieldCheck,
  Zap,
  Info,
  Waves,
  Calculator
} from 'lucide-react';
import { TelemetryData, PltsSummary, ThresholdSettings } from '../types';

interface WaterQualityOverviewProps {
  telemetry: TelemetryData | null;
  pltsSummary: PltsSummary | null;
  thresholds: ThresholdSettings;
  onNavigateToPlts: () => void;
  onNavigateToDiagnostics: () => void;
  onNavigateToControl: () => void;
  onNavigateToHpp?: () => void;
}

export const WaterQualityOverview: React.FC<WaterQualityOverviewProps> = ({
  telemetry,
  pltsSummary,
  thresholds,
  onNavigateToPlts,
  onNavigateToDiagnostics,
  onNavigateToControl,
  onNavigateToHpp,
}) => {
  // Format uptime in human readable
  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (days > 0) return `${days}h ${hours}j ${mins}m`;
    if (hours > 0) return `${hours}j ${mins}m ${secs}d`;
    return `${mins}m ${secs}d`;
  };

  const ph = telemetry?.ph ?? 7.65;
  const doMg = telemetry?.do_mg_l ?? 7.89;
  const doSat = telemetry?.do_saturation_pct ?? 98.7;
  const temp = telemetry?.water_temperature_c ?? 26.6;
  const isDoOk = telemetry?.do_ok ?? true;

  // Evaluate status for pH
  let phStatus: 'good' | 'warning' | 'danger' = 'good';
  let phLabel = 'Optimal (Ideal untuk Ikan Nila)';
  if (ph < thresholds.phMin || ph > thresholds.phMax) {
    phStatus = 'danger';
    phLabel = ph < thresholds.phMin ? 'Terlalu Asam (Bahaya Asidosis)' : 'Terlalu Basa (Bahaya Alkalosis)';
  } else if (ph < thresholds.phWarningMin || ph > thresholds.phWarningMax) {
    phStatus = 'warning';
    phLabel = 'Perlu Pemantauan pH';
  }

  // Evaluate status for DO
  let doStatus: 'good' | 'warning' | 'danger' = 'good';
  let doLabel = 'Sangat Baik (> 5.0 mg/L)';
  if (!isDoOk || doMg < thresholds.doMinWarning) {
    doStatus = 'danger';
    doLabel = !isDoOk ? 'Sensor DO Offline / E226' : 'Kritis: Bahaya Asfiksia Ikan (< 3 mg/L)';
  } else if (doMg < thresholds.doMinGood) {
    doStatus = 'warning';
    doLabel = 'Waspada: Nyalakan Aerator (3.0 - 5.0 mg/L)';
  }

  // Evaluate status for Temp
  let tempStatus: 'good' | 'warning' | 'danger' = 'good';
  let tempLabel = 'Suhu Ideal (Pertumbuhan Cepat)';
  if (temp < thresholds.tempMin || temp > thresholds.tempMax) {
    tempStatus = 'danger';
    tempLabel = temp < thresholds.tempMin ? 'Air Terlalu Dingin (< 22°C)' : 'Air Terlalu Panas (> 35°C)';
  } else if (temp < thresholds.tempOptMin || temp > thresholds.tempOptMax) {
    tempStatus = 'warning';
    tempLabel = 'Di Luar Suhu Optimal (25-30°C)';
  }

  // Calculate Overall Tilapia Pond Health Score (0 - 100)
  let healthScore = 100;
  if (phStatus === 'danger') healthScore -= 35;
  else if (phStatus === 'warning') healthScore -= 15;

  if (doStatus === 'danger') healthScore -= 45;
  else if (doStatus === 'warning') healthScore -= 20;

  if (tempStatus === 'danger') healthScore -= 20;
  else if (tempStatus === 'warning') healthScore -= 10;

  healthScore = Math.max(0, Math.min(100, healthScore));

  const getHealthBadge = (score: number) => {
    if (score >= 85) {
      return {
        text: 'Kondisi Kolam Sangat Sehat (Optimal)',
        color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]',
        bgGlow: 'from-emerald-950/40 via-cyan-950/30 to-[#0f172a]',
        desc: 'Semua parameter air (pH, DO, Suhu) berada dalam rentang ideal untuk metabolisme dan pertumbuhan maksimal ikan nila.',
      };
    }
    if (score >= 60) {
      return {
        text: 'Kondisi Kolam Memerlukan Perhatian',
        color: 'bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.2)]',
        bgGlow: 'from-amber-950/40 via-yellow-950/30 to-[#0f172a]',
        desc: 'Salah satu parameter air mendekati batas toleransi. Periksa aerasi atau kualitas sirkulasi air.',
      };
    }
    return {
      text: 'Peringatan Kritis Kualitas Air!',
      color: 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_12px_rgba(239,68,68,0.2)]',
      bgGlow: 'from-red-950/40 via-orange-950/30 to-[#0f172a]',
      desc: 'Parameter air membahayakan kelangsungan hidup ikan nila. Segera ambil tindakan darurat (aerasi darurat, pergantian air).',
    };
  };

  const healthBadge = getHealthBadge(healthScore);

  return (
    <div className="space-y-6">
      {/* Top Banner: Pond Health Index & Summary */}
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-r ${healthBadge.bgGlow} bg-[#0f172a] border border-slate-800/90 p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)] backdrop-blur-xl`}>
        {/* Subtle decorative glow */}
        <div className="absolute -right-10 -top-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${healthBadge.color} flex items-center gap-1.5`}>
                <ShieldCheck className="w-4 h-4" />
                {healthBadge.text}
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Update: {telemetry?.timestamp || 'Baru saja'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
              Monitoring Kualitas Air Kolam Nila
              <span className="text-xs sm:text-sm font-normal text-cyan-400 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800/80 font-mono shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                {telemetry?.device || 'nila-E0F908'}
              </span>
            </h1>
            <p className="text-sm text-slate-300 max-w-2xl">
              {healthBadge.desc} Terintegrasi dengan sistem PLTS Off-Grid untuk pasokan daya aerator ramah lingkungan.
            </p>
          </div>

          {/* Health Gauge Widget */}
          <div className="flex items-center gap-4 bg-[#020617]/90 p-4 rounded-xl border border-slate-800/90 self-start md:self-auto min-w-[210px] justify-between shadow-inner">
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Health Index</div>
              <div className="text-3xl font-black text-white flex items-baseline gap-1 font-mono">
                {healthScore}
                <span className="text-sm font-medium text-slate-500">/100</span>
              </div>
              <div className="text-[11px] text-emerald-400 font-semibold flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {healthScore >= 80 ? 'Status Aman' : healthScore >= 60 ? 'Waspada' : 'Kritis'}
              </div>
            </div>
            <div className="w-14 h-14 rounded-full border-4 border-slate-800 border-t-emerald-500 border-r-cyan-500 flex items-center justify-center font-extrabold text-white text-sm bg-[#0f172a] shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              {healthScore}%
            </div>
          </div>
        </div>
      </div>

      {/* 4 Main Parameter Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: pH Level */}
        <div id="card-ph-level" className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-cyan-500/50 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(6,182,212,0.15)] relative overflow-hidden transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                <Droplet className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Derajat Keasaman</h2>
                <span className="text-sm font-bold text-slate-200">pH Air Kolam</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              phStatus === 'good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]' :
              phStatus === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
              'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {phStatus === 'good' ? 'Optimal' : phStatus === 'warning' ? 'Waspada' : 'Bahaya'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-extrabold text-white tracking-tight font-mono">
              {ph !== null ? ph.toFixed(2) : '--'}
            </span>
            <span className="text-sm text-cyan-400 font-semibold">pH</span>
          </div>

          <div className="text-xs text-slate-400 mb-4 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Tegangan Sensor:</span>
            <span className="font-mono text-cyan-300 font-semibold">
              {telemetry?.ph_mv !== null && telemetry?.ph_mv !== undefined ? `${telemetry.ph_mv} mV` : '--'}
            </span>
          </div>

          {/* Calibration 3-point status */}
          <div className="bg-[#020617]/90 rounded-xl p-2.5 border border-slate-800/90 text-[11px] space-y-1.5 shadow-inner">
            <div className="text-slate-400 font-medium flex items-center justify-between">
              <span>Status Kalibrasi pH:</span>
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Tervalidasi
              </span>
            </div>
            <div className="flex items-center justify-between gap-1 pt-0.5 text-[10px]">
              <span className={`px-2 py-0.5 rounded-md ${telemetry?.ph_cal_401 !== false ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                pH 4.01 ✓
              </span>
              <span className={`px-2 py-0.5 rounded-md ${telemetry?.ph_cal_686 !== false ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                pH 6.86 ✓
              </span>
              <span className={`px-2 py-0.5 rounded-md ${telemetry?.ph_cal_918 !== false ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'}`}>
                pH 9.18 ✓
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Dissolved Oxygen (DO) */}
        <div id="card-dissolved-oxygen" className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-blue-500/50 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] relative overflow-hidden transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.2)]">
                <Wind className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Oksigen Terlarut</h2>
                <span className="text-sm font-bold text-slate-200">DO Sensor RS485</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              doStatus === 'good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]' :
              doStatus === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
              'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {isDoOk ? (doStatus === 'good' ? 'Aman' : 'Rendah') : 'Error E226'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-extrabold text-white tracking-tight font-mono">
              {doMg !== null ? doMg.toFixed(2) : '--'}
            </span>
            <span className="text-sm text-blue-400 font-semibold">mg/L</span>
          </div>

          <div className="text-xs text-slate-400 mb-4 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Saturasi Oksigen:</span>
            <span className="font-mono text-blue-300 font-semibold">
              {doSat !== null ? `${doSat.toFixed(1)}%` : '--'}
            </span>
          </div>

          {/* DO Additional Info */}
          <div className="bg-[#020617]/90 rounded-xl p-2.5 border border-slate-800/90 text-[11px] space-y-1.5 shadow-inner">
            <div className="flex items-center justify-between text-slate-400">
              <span>Tekanan Barometer:</span>
              <span className="font-mono text-slate-200">{telemetry?.do_atmospheric_pressure_kpa || 101.33} kPa</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Salinitas Kolam:</span>
              <span className="font-mono text-slate-200">{telemetry?.do_salinity_ppt || 0} ppt (Air Tawar)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Water Temperature */}
        <div id="card-water-temperature" className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-orange-500/50 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(249,115,22,0.15)] relative overflow-hidden transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.2)]">
                <Thermometer className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Temperatur Kolam</h2>
                <span className="text-sm font-bold text-slate-200">Suhu Air</span>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
              tempStatus === 'good' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_8px_rgba(16,185,129,0.2)]' :
              tempStatus === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
              'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              {tempStatus === 'good' ? 'Nyaman' : tempStatus === 'warning' ? 'Waspada' : 'Ekstrem'}
            </span>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-extrabold text-white tracking-tight font-mono">
              {temp !== null ? temp.toFixed(1) : '--'}
            </span>
            <span className="text-sm text-orange-400 font-semibold">°C</span>
          </div>

          <div className="text-xs text-slate-400 mb-4 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Rentang Optimal Nila:</span>
            <span className="font-mono text-emerald-300 font-semibold">25.0 - 30.0 °C</span>
          </div>

          {/* Biological Feeding Recommendation */}
          <div className="bg-[#020617]/90 rounded-xl p-2.5 border border-slate-800/90 text-[11px] space-y-1 shadow-inner">
            <div className="text-slate-400 font-medium flex items-center justify-between">
              <span>Rekomendasi Pakan:</span>
              <span className="text-cyan-300 font-bold">100% Porsi Normal</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Metabolisme aktif. FCR konversi pakan dalam kondisi sangat baik.
            </p>
          </div>
        </div>

        {/* Card 4: PLTS Solar & Energy Supply */}
        <div id="card-plts-summary" className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 hover:border-amber-500/50 rounded-2xl p-5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] relative overflow-hidden transition-all group">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                <Sun className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Energi Surya</h2>
                <span className="text-sm font-bold text-slate-200">PLTS Dessmonitor</span>
              </div>
            </div>
            <button
              onClick={onNavigateToPlts}
              className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-slate-800/80 rounded-lg transition-all"
              title="Lihat Alur Energi Lengkap"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-4xl font-extrabold text-amber-400 tracking-tight font-mono">
              {pltsSummary?.pvPowerW ?? 54.72}
            </span>
            <span className="text-sm text-amber-300 font-semibold">Watt PV</span>
          </div>

          <div className="text-xs text-slate-400 mb-4 flex items-center justify-between border-t border-slate-800/80 pt-2">
            <span>Baterai Lithium SOC:</span>
            <span className="font-mono text-emerald-300 font-bold">
              {pltsSummary?.batterySocPct ?? 80}%
            </span>
          </div>

          {/* Inverter & Load info */}
          <div className="bg-[#020617]/90 rounded-xl p-2.5 border border-slate-800/90 text-[11px] space-y-1 shadow-inner">
            <div className="flex items-center justify-between text-slate-400">
              <span>Beban Aerator:</span>
              <span className="font-mono text-slate-200">{pltsSummary?.loadPowerW ?? 167} W ({pltsSummary?.loadCurrentA ?? 0.7} A)</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Tegangan Inverter:</span>
              <span className="font-mono text-slate-200">{pltsSummary?.gridVoltageV ?? 211} V / 50 Hz</span>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Biological & Operational Action Panel & Hardware Telemetry Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tilapia Farming Action & Recommendations (2 Cols) */}
        <div className="lg:col-span-2 bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Rekomendasi Manajemen Budidaya Nila & Aerasi
                </h2>
                <p className="text-xs text-slate-400">Optimasi rasio pakan dan jadwal aerator kolam</p>
              </div>
            </div>
            <button
              onClick={onNavigateToControl}
              className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 px-3 py-1.5 bg-[#020617] hover:bg-slate-800 rounded-xl border border-slate-800 transition-all shadow-sm"
            >
              Kontrol Aerator <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Aeration status */}
            <div className="bg-[#020617]/90 border border-slate-800/90 rounded-xl p-4 space-y-2 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Wind className="w-4 h-4 text-cyan-400" />
                  Strategi Aerasi Kolam
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                  Mode Hemat Surya
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                DO saat ini <strong className="text-cyan-300 font-mono">{doMg !== null ? doMg.toFixed(2) : '7.89'} mg/L</strong> (Sangat Baik). Pada siang hari, manfaatkan fotosintesis alga dan energi PLTS. Operasikan aerator penuh pada malam hari (22:00 - 06:00) saat respirasi meningkat.
              </p>
            </div>

            {/* Feeding Strategy */}
            <div className="bg-[#020617]/90 border border-slate-800/90 rounded-xl p-4 space-y-2 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-emerald-400" />
                  Pemberian Pakan (Feeding)
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/80">
                  Respon Cepat
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Suhu air <strong className="text-orange-300 font-mono">{temp !== null ? temp.toFixed(1) : '26.6'}°C</strong> dan pH <strong className="text-cyan-300 font-mono">{ph !== null ? ph.toFixed(2) : '7.65'}</strong> mendukung daya cerna optimal. Berikan pakan pelet terapung protein 28-32% dengan takaran 3-4% biomassa per hari.
              </p>
            </div>
          </div>

          {/* Quick Notice Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-cyan-950/60 via-slate-900/80 to-emerald-950/60 border border-emerald-500/30 rounded-xl p-4 text-xs text-slate-200 shadow-md">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/40">
                <Calculator className="w-4 h-4" />
              </div>
              <div>
                <strong className="font-semibold text-white block">Kalkulator HPP & Catatan Pakan Ikan Nila:</strong>
                <span className="text-slate-400">Analisis biaya pakan, bibit, tenaga kerja, serta penghematan listrik energi surya PLTS per kg panen.</span>
              </div>
            </div>
            {onNavigateToHpp && (
              <button
                onClick={onNavigateToHpp}
                className="px-3.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold rounded-lg border border-emerald-500/40 flex items-center gap-1.5 transition-all text-xs whitespace-nowrap shadow-sm shrink-0"
              >
                Buka Kalkulator HPP <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Device & Hardware Health Card (1 Col) */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white">Status Node IoT Kolam</h2>
            </div>
            <button
              onClick={onNavigateToDiagnostics}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-0.5"
            >
              Detail <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-slate-500" /> Device ID:
              </span>
              <span className="font-mono text-cyan-300 font-semibold">{telemetry?.device || 'nila-E0F908'}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" /> Uptime Sistem:
              </span>
              <span className="font-mono text-slate-200">{formatUptime(telemetry?.uptime_s || 18156)}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5 text-slate-500" /> WiFi RSSI:
              </span>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-slate-200">{telemetry?.wifi_rssi ?? -76} dBm</span>
                <span className={`w-2 h-2 rounded-full ${
                  (telemetry?.wifi_rssi ?? -76) > -70 ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' :
                  (telemetry?.wifi_rssi ?? -76) > -85 ? 'bg-yellow-400' : 'bg-red-400'
                }`} />
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">IP Station:</span>
              <span className="font-mono text-slate-200">{telemetry?.ip || '192.168.18.187'}</span>
            </div>

            <div className="flex items-center justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-400">IP Access Point:</span>
              <span className="font-mono text-slate-200">{telemetry?.ap_ip || '192.168.4.1'}</span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-400">Modbus Status:</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                telemetry?.modbus_code === 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-red-950 text-red-300 border border-red-800'
              }`}>
                Code {telemetry?.modbus_code ?? 0} ({telemetry?.modbus_code === 0 ? 'Normal' : 'Fault'})
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onNavigateToDiagnostics}
              className="w-full py-2 bg-[#020617] hover:bg-slate-800 text-slate-200 text-xs font-semibold rounded-xl border border-slate-800 transition-colors flex items-center justify-center gap-1.5"
            >
              Lihat Register Modbus & Raw Data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
