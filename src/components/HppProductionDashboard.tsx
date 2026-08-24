import React, { useState, useEffect, useMemo } from 'react';
import {
  Calculator,
  DollarSign,
  TrendingUp,
  Scale,
  Fish,
  Zap,
  SunMedium,
  Droplets,
  Calendar,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Info,
  PieChart as PieIcon,
  BarChart3,
  Percent,
  Sliders,
  Sparkles,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Printer
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import {
  HppCycleConfig,
  HppCalculationResult,
  DailyAquacultureLog,
  DailySupplementItem,
  TelemetryData,
  PltsSummary
} from '../types';
import {
  defaultHppConfig,
  calculateHpp,
  formatRupiah,
  formatNumber,
  generateSampleDailyLogs
} from '../utils/hppCalculator';

interface HppProductionDashboardProps {
  telemetry?: TelemetryData | null;
  pltsSummary?: PltsSummary | null;
}

export const HppProductionDashboard: React.FC<HppProductionDashboardProps> = ({
  telemetry,
  pltsSummary
}) => {
  // State for HPP Configuration & Local Storage
  const [config, setConfig] = useState<HppCycleConfig>(() => {
    const saved = localStorage.getItem('nilasense_hpp_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved HPP config', e);
      }
    }
    return defaultHppConfig;
  });

  // State for Daily Logs & Local Storage
  const [dailyLogs, setDailyLogs] = useState<DailyAquacultureLog[]>(() => {
    const saved = localStorage.getItem('nilasense_daily_logs');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse saved daily logs', e);
      }
    }
    return generateSampleDailyLogs();
  });

  // Active Sub-Tab: 'calculator' | 'daily_logs' | 'analysis' | 'recommendations'
  const [activeTab, setActiveTab] = useState<'calculator' | 'daily_logs' | 'analysis' | 'recommendations'>('calculator');

  // UI state for adding / editing daily log
  const [isLogModalOpen, setIsLogModalOpen] = useState<boolean>(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);

  // Filter & search state for daily log table
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logSortOrder, setLogSortOrder] = useState<'asc' | 'desc'>('desc');

  // Form State for Daily Log Modal
  const [logForm, setLogForm] = useState({
    date: new Date().toISOString().split('T')[0],
    doc: 1,
    feedMorningKg: 0,
    feedAfternoonKg: 0,
    feedEveningKg: 0,
    feedType: '781-2 (Grower)',
    feedPricePerKg: 13500,
    mortalityCount: 0,
    abwGram: 100,
    waterExchangePct: 0,
    waterTemp: telemetry?.temperature ?? 28.5,
    waterPh: telemetry?.ph ?? 7.5,
    waterDo: telemetry?.do_mg_l ?? 5.5,
    powerSource: 'PLTS' as 'PLTS' | 'PLN' | 'HYBRID',
    notes: '',
    supplementName: '',
    supplementAmount: 0,
    supplementUnit: 'ml',
    supplementCost: 0,
  });

  // Save config to LocalStorage on change
  useEffect(() => {
    localStorage.setItem('nilasense_hpp_config', JSON.stringify(config));
  }, [config]);

  // Save daily logs to LocalStorage on change
  useEffect(() => {
    localStorage.setItem('nilasense_daily_logs', JSON.stringify(dailyLogs));
  }, [dailyLogs]);

  // Recalculate HPP results dynamically
  const hppResult: HppCalculationResult = useMemo(() => {
    return calculateHpp(config, dailyLogs);
  }, [config, dailyLogs]);

  // Accumulator summaries from daily logs
  const logStats = useMemo(() => {
    const totalFeedAccumulated = dailyLogs.reduce((sum, l) => sum + (l.feedTotalKg || 0), 0);
    const totalMortality = dailyLogs.reduce((sum, l) => sum + (l.mortalityCount || 0), 0);
    const latestLog = dailyLogs.length > 0
      ? [...dailyLogs].sort((a, b) => b.doc - a.doc)[0]
      : null;
    const latestAbw = latestLog ? latestLog.abwGram : config.targetHarvestAbwGram;
    const remainingFish = Math.max(0, config.seedCount - totalMortality);
    const currentBiomassKg = (remainingFish * latestAbw) / 1000;
    const actualSr = config.seedCount > 0 ? (remainingFish / config.seedCount) * 100 : 0;
    const currentFcr = currentBiomassKg > 0 ? totalFeedAccumulated / currentBiomassKg : 0;

    return {
      totalFeedAccumulated,
      totalMortality,
      latestAbw,
      remainingFish,
      currentBiomassKg,
      actualSr,
      currentFcr,
      latestDoc: latestLog ? latestLog.doc : 1,
    };
  }, [dailyLogs, config.seedCount, config.targetHarvestAbwGram]);

  // Sorted and filtered daily logs
  const filteredLogs = useMemo(() => {
    return dailyLogs
      .filter((l) => {
        if (!logSearchQuery) return true;
        const q = logSearchQuery.toLowerCase();
        return (
          l.date.includes(q) ||
          l.feedType.toLowerCase().includes(q) ||
          (l.notes && l.notes.toLowerCase().includes(q)) ||
          `doc ${l.doc}`.includes(q)
        );
      })
      .sort((a, b) => {
        return logSortOrder === 'asc' ? a.doc - b.doc : b.doc - a.doc;
      });
  }, [dailyLogs, logSearchQuery, logSortOrder]);

  // Growth & Feeding Progress Chart Data from Daily Logs
  const growthChartData = useMemo(() => {
    return [...dailyLogs]
      .sort((a, b) => a.doc - b.doc)
      .map((l) => ({
        doc: `Hari ${l.doc}`,
        abw: l.abwGram,
        feed: l.feedTotalKg,
        biomass: l.estimatedBiomassKg,
        mortality: l.mortalityCount,
      }));
  }, [dailyLogs]);

  // Handle open add / edit modal
  const handleOpenAddModal = () => {
    setEditingLogId(null);
    const nextDoc = logStats.latestDoc + 1;
    const today = new Date().toISOString().split('T')[0];
    setLogForm({
      date: today,
      doc: nextDoc > config.durationDays ? config.durationDays : nextDoc,
      feedMorningKg: 5.0,
      feedAfternoonKg: 5.0,
      feedEveningKg: 3.0,
      feedType: '781-2 (Grower)',
      feedPricePerKg: config.feedPriceAvgPerKg,
      mortalityCount: 0,
      abwGram: logStats.latestAbw + 2.5,
      waterExchangePct: 0,
      waterTemp: telemetry?.temperature ?? 28.5,
      waterPh: telemetry?.ph ?? 7.5,
      waterDo: telemetry?.do_mg_l ?? 5.5,
      powerSource: 'PLTS',
      notes: '',
      supplementName: '',
      supplementAmount: 0,
      supplementUnit: 'ml',
      supplementCost: 0,
    });
    setIsLogModalOpen(true);
  };

  const handleOpenEditModal = (log: DailyAquacultureLog) => {
    setEditingLogId(log.id);
    const firstSupp = log.supplements && log.supplements[0];
    setLogForm({
      date: log.date,
      doc: log.doc,
      feedMorningKg: log.feedMorningKg,
      feedAfternoonKg: log.feedAfternoonKg,
      feedEveningKg: log.feedEveningKg,
      feedType: log.feedType,
      feedPricePerKg: log.feedPricePerKg,
      mortalityCount: log.mortalityCount,
      abwGram: log.abwGram,
      waterExchangePct: log.waterExchangePct || 0,
      waterTemp: log.waterTemp ?? 28.5,
      waterPh: log.waterPh ?? 7.5,
      waterDo: log.waterDo ?? 5.5,
      powerSource: log.powerSource || 'PLTS',
      notes: log.notes || '',
      supplementName: firstSupp ? firstSupp.name : '',
      supplementAmount: firstSupp ? firstSupp.amount : 0,
      supplementUnit: firstSupp ? firstSupp.unit : 'ml',
      supplementCost: firstSupp ? firstSupp.cost : 0,
    });
    setIsLogModalOpen(true);
  };

  const handleSaveDailyLog = (e: React.FormEvent) => {
    e.preventDefault();
    const feedTotal = Number((logForm.feedMorningKg + logForm.feedAfternoonKg + logForm.feedEveningKg).toFixed(2));
    const estimatedBiomass = Number((((config.seedCount - logForm.mortalityCount) * logForm.abwGram) / 1000).toFixed(1));

    const supplementsList: DailySupplementItem[] = [];
    if (logForm.supplementName && logForm.supplementAmount > 0) {
      supplementsList.push({
        name: logForm.supplementName,
        amount: logForm.supplementAmount,
        unit: logForm.supplementUnit,
        cost: logForm.supplementCost,
      });
    }

    if (editingLogId) {
      setDailyLogs((prev) =>
        prev.map((item) =>
          item.id === editingLogId
            ? {
                ...item,
                date: logForm.date,
                doc: Number(logForm.doc),
                feedMorningKg: Number(logForm.feedMorningKg),
                feedAfternoonKg: Number(logForm.feedAfternoonKg),
                feedEveningKg: Number(logForm.feedEveningKg),
                feedTotalKg: feedTotal,
                feedType: logForm.feedType,
                feedPricePerKg: Number(logForm.feedPricePerKg),
                mortalityCount: Number(logForm.mortalityCount),
                abwGram: Number(logForm.abwGram),
                estimatedBiomassKg: estimatedBiomass,
                waterExchangePct: Number(logForm.waterExchangePct),
                waterTemp: Number(logForm.waterTemp),
                waterPh: Number(logForm.waterPh),
                waterDo: Number(logForm.waterDo),
                powerSource: logForm.powerSource,
                notes: logForm.notes,
                supplements: supplementsList.length > 0 ? supplementsList : item.supplements,
              }
            : item
        )
      );
    } else {
      const newEntry: DailyAquacultureLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        date: logForm.date,
        doc: Number(logForm.doc),
        feedMorningKg: Number(logForm.feedMorningKg),
        feedAfternoonKg: Number(logForm.feedAfternoonKg),
        feedEveningKg: Number(logForm.feedEveningKg),
        feedTotalKg: feedTotal,
        feedType: logForm.feedType,
        feedPricePerKg: Number(logForm.feedPricePerKg),
        mortalityCount: Number(logForm.mortalityCount),
        abwGram: Number(logForm.abwGram),
        estimatedBiomassKg: estimatedBiomass,
        supplements: supplementsList,
        waterExchangePct: Number(logForm.waterExchangePct),
        waterTemp: Number(logForm.waterTemp),
        waterPh: Number(logForm.waterPh),
        waterDo: Number(logForm.waterDo),
        powerSource: logForm.powerSource,
        notes: logForm.notes,
      };
      setDailyLogs((prev) => [...prev, newEntry].sort((a, b) => a.doc - b.doc));
    }

    setIsLogModalOpen(false);
  };

  const handleDeleteLog = (id: string) => {
    if (window.confirm('Hapus baris catatan log harian ini?')) {
      setDailyLogs((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleResetToDefault = () => {
    if (window.confirm('Reset seluruh konfigurasi HPP dan data log harian ke template standar budidaya Nila Bioflok PLTS?')) {
      setConfig(defaultHppConfig);
      setDailyLogs(generateSampleDailyLogs());
      localStorage.removeItem('nilasense_hpp_config');
      localStorage.removeItem('nilasense_daily_logs');
    }
  };

  // Export Daily Logs to CSV
  const handleExportCsv = () => {
    const headers = [
      'DoC (Hari)',
      'Tanggal',
      'Pakan Pagi (kg)',
      'Pakan Siang (kg)',
      'Pakan Sore (kg)',
      'Total Pakan (kg)',
      'Jenis Pakan',
      'Kematian (ekor)',
      'Sampling ABW (gram)',
      'Biomassa Est (kg)',
      'Suhu Air (°C)',
      'pH Air',
      'DO (mg/L)',
      'Sumber Energi',
      'Catatan'
    ];

    const rows = dailyLogs.map((l) => [
      l.doc,
      l.date,
      l.feedMorningKg,
      l.feedAfternoonKg,
      l.feedEveningKg,
      l.feedTotalKg,
      `"${l.feedType}"`,
      l.mortalityCount,
      l.abwGram,
      l.estimatedBiomassKg,
      l.waterTemp?.toFixed(1) || '-',
      l.waterPh?.toFixed(2) || '-',
      l.waterDo?.toFixed(2) || '-',
      l.powerSource || 'PLTS',
      `"${l.notes || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Laporan_Pakan_HPP_Nila_${config.cycleName.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              <Calculator className="w-3.5 h-3.5" /> Analisis Biaya Pokok Produksi (HPP)
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1">
              <Fish className="w-3 h-3" /> Budidaya Nila Bioflok & RAS
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30 flex items-center gap-1">
              <Zap className="w-3 h-3" /> Solar Hybrid PV
            </span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Kalkulasi HPP & Pencatatan Pakan Harian
          </h1>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            Hitung biaya per kg dan margin keuntungan budidaya ikan nila secara presisi. Meliputi pakan, benih, energi mandiri PLTS vs PLN, vitamin/probiotik bioflok, tenaga kerja, serta penyusutan kolam.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 text-amber-400" /> Cetak
          </button>
          <button
            onClick={handleResetToDefault}
            className="px-3.5 py-2 bg-slate-900/80 hover:bg-red-950/40 text-slate-400 hover:text-red-300 border border-slate-800 hover:border-red-800/60 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5"
            title="Reset ke template standar"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reset Template
          </button>
        </div>
      </div>

      {/* 6 Top Key KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Card 1: HPP per Kg */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">HPP / Kg Panen</span>
            <DollarSign className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {formatRupiah(hppResult.hppPerKg)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Target Jual:</span>
            <span className="font-bold text-cyan-300">{formatRupiah(config.expectedSellingPricePerKg)}/kg</span>
          </div>
        </div>

        {/* Card 2: Estimasi Laba Bersih */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-cyan-500/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(6,182,212,0.15)] relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Laba Bersih Siklus</span>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {formatRupiah(hppResult.netProfit)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Margin Profit:</span>
            <span className={`font-bold ${hppResult.profitMarginPct >= 25 ? 'text-emerald-400' : 'text-amber-400'}`}>
              +{formatNumber(hppResult.profitMarginPct, 1)}%
            </span>
          </div>
        </div>

        {/* Card 3: Total Modal / Biaya Produksi */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-400">Total Modal HPP</span>
            <Scale className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {formatRupiah(hppResult.totalProductionCost)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">ROI Modal:</span>
            <span className="font-bold text-purple-300">+{formatNumber(hppResult.roiPct, 1)}%</span>
          </div>
        </div>

        {/* Card 4: FCR (Feed Conversion Ratio) */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400">FCR Pakan</span>
            <Fish className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {formatNumber(hppResult.fcr, 2)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Total Pakan:</span>
            <span className="font-bold text-blue-300">
              {formatNumber(dailyLogs.length > 0 ? logStats.totalFeedAccumulated : (config.actualFeedTotalKg || 1725), 0)} kg
            </span>
          </div>
        </div>

        {/* Card 5: Total Panen & Survival Rate */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 shadow-lg relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Target Panen</span>
            <Percent className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-white font-mono tracking-tight">
            {formatNumber(hppResult.totalHarvestWeightKg, 0)} <span className="text-sm font-normal text-slate-400">Kg</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">SR Hidup:</span>
            <span className="font-bold text-amber-300">{formatNumber(config.survivalRatePct, 1)}% ({formatNumber(hppResult.totalHarvestFishCount, 0)} ekor)</span>
          </div>
        </div>

        {/* Card 6: Penghematan Listrik PLTS Surya */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-amber-500/40 rounded-2xl p-4 shadow-[0_0_20px_rgba(245,158,11,0.15)] relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Hemat Listrik PLTS</span>
            <SunMedium className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-black text-amber-300 font-mono tracking-tight">
            {formatRupiah(hppResult.pltsSavingsRupiah)}
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Porsi Surya:</span>
            <span className="font-bold text-emerald-400">{config.pltsSolarPortionPct}% Mandiri</span>
          </div>
        </div>
      </div>

      {/* Main Tab Controls */}
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('calculator')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'calculator'
              ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]/60'
          }`}
        >
          <Sliders className="w-4 h-4 text-emerald-400" />
          <span>Kalkulator & Parameter Biaya Siklus</span>
        </button>

        <button
          onClick={() => setActiveTab('daily_logs')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'daily_logs'
              ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]/60'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
          <span>Tabel Catatan Pakan & Harian ({dailyLogs.length} Entri)</span>
        </button>

        <button
          onClick={() => setActiveTab('analysis')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'analysis'
              ? 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]/60'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-purple-400" />
          <span>Grafik Pertumbuhan, FCR & Struktur Biaya</span>
        </button>

        <button
          onClick={() => setActiveTab('recommendations')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'recommendations'
              ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#0f172a]/60'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>SOP & Rekomendasi Efisiensi Nila</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: KALKULATOR & PARAMETER BIAYA PRODUKSI SIKLUS     */}
      {/* ======================================================== */}
      {activeTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Form Input Parameter HPP */}
          <div className="lg:col-span-2 space-y-6">
            {/* Section 1: Informasi Siklus & Target Panen */}
            <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Fish className="w-5 h-5 text-cyan-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">1. Parameter Kolam, Bibit & Target Panen</h3>
                  <p className="text-[11px] text-slate-400">Atur jumlah benih, ukuran tebar, durasi pemeliharaan, dan perkiraan bobot panen.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Nama Siklus / Batch</label>
                  <input
                    type="text"
                    value={config.cycleName}
                    onChange={(e) => setConfig({ ...config, cycleName: e.target.value })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Jumlah Tebar Bibit (Ekor)</label>
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    step="500"
                    value={config.seedCount}
                    onChange={(e) => setConfig({ ...config, seedCount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-cyan-300 font-bold text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Harga Bibit per Ekor (Rp)</label>
                  <input
                    type="number"
                    min="50"
                    max="5000"
                    step="50"
                    value={config.seedPricePerUnit}
                    onChange={(e) => setConfig({ ...config, seedPricePerUnit: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Survival Rate (SR %)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="50"
                      max="100"
                      step="1"
                      value={config.survivalRatePct}
                      onChange={(e) => setConfig({ ...config, survivalRatePct: parseFloat(e.target.value) || 0 })}
                      className="flex-1 accent-emerald-500"
                    />
                    <span className="text-xs font-mono font-bold text-emerald-400 w-12 text-right">{config.survivalRatePct}%</span>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Target Bobot Akhir (Gram/Ekor)</label>
                  <input
                    type="number"
                    min="100"
                    max="1000"
                    step="10"
                    value={config.targetHarvestAbwGram}
                    onChange={(e) => setConfig({ ...config, targetHarvestAbwGram: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Isi {(1000 / (config.targetHarvestAbwGram || 333)).toFixed(1)} ekor/kg</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Lama Siklus (Hari)</label>
                  <input
                    type="number"
                    min="30"
                    max="200"
                    step="5"
                    value={config.durationDays}
                    onChange={(e) => setConfig({ ...config, durationDays: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Pakan & Efisiensi FCR */}
            <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Scale className="w-5 h-5 text-blue-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">2. Biaya Pakan & Target FCR (Feed Conversion Ratio)</h3>
                  <p className="text-[11px] text-slate-400">Pakan menyumbang 60-70% dari seluruh biaya produksi nila.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Rata-rata Harga Pakan (Rp/Kg)</label>
                  <input
                    type="number"
                    min="5000"
                    max="30000"
                    step="250"
                    value={config.feedPriceAvgPerKg}
                    onChange={(e) => setConfig({ ...config, feedPriceAvgPerKg: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-blue-300 font-bold text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Target FCR (Feed Ratio)</label>
                  <input
                    type="number"
                    min="0.8"
                    max="2.5"
                    step="0.05"
                    value={config.targetFcr}
                    onChange={(e) => setConfig({ ...config, targetFcr: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 focus:border-blue-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Bioflok optimal: 1.10 - 1.25</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Estimasi Total Pakan Dibutuhkan</label>
                  <div className="px-3 py-2 bg-[#020617] rounded-xl border border-slate-700 text-xs font-mono text-cyan-300 font-bold">
                    {formatNumber(hppResult.totalHarvestWeightKg * config.targetFcr, 1)} Kg ({Math.ceil((hppResult.totalHarvestWeightKg * config.targetFcr) / 30)} Karung @30kg)
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Listrik & Efisiensi PLTS */}
            <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <SunMedium className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">3. Listrik Aerator: PLTS Surya Mandiri vs Grid PLN</h3>
                  <p className="text-[11px] text-slate-400">Penghematan nyata dari PLTS off-grid / hybrid menurunkan HPP secara signifikan.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Konsumsi Listrik Aerator & Pompa (kWh/Hari)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={config.dailyKwhUsage}
                    onChange={(e) => setConfig({ ...config, dailyKwhUsage: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 focus:border-amber-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">2x Aerator 250W = ~8.5 kWh/hari</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Tarif Listrik PLN (Rp/kWh)</label>
                  <input
                    type="number"
                    min="500"
                    max="5000"
                    step="50"
                    value={config.plnTariffPerKwh}
                    onChange={(e) => setConfig({ ...config, plnTariffPerKwh: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 focus:border-amber-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500">Tarif R-1 1300VA: Rp 1.444,70</span>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Porsi Energi dari PLTS Surya (%)</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={config.pltsSolarPortionPct}
                      onChange={(e) => setConfig({ ...config, pltsSolarPortionPct: parseFloat(e.target.value) || 0 })}
                      className="flex-1 accent-amber-500"
                    />
                    <span className="text-xs font-mono font-bold text-amber-400 w-12 text-right">{config.pltsSolarPortionPct}%</span>
                  </div>
                  <span className="text-[10px] text-emerald-400">Hemat {formatRupiah(hppResult.pltsSavingsRupiah)} / siklus</span>
                </div>
              </div>
            </div>

            {/* Section 4: Suplemen, Tenaga Kerja & Penyusutan */}
            <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <Droplets className="w-5 h-5 text-purple-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">4. Vitamin, Kimia Bioflok, Tenaga Kerja & Penyusutan Alat</h3>
                  <p className="text-[11px] text-slate-400">Komponen biaya pendukung agar kualitas air dan imunitas ikan terjaga stabil.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Probiotik & Bakteri (Rp)</label>
                  <input
                    type="number"
                    step="50000"
                    value={config.probioticsBudget}
                    onChange={(e) => setConfig({ ...config, probioticsBudget: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Vitamin & Mineral (Rp)</label>
                  <input
                    type="number"
                    step="50000"
                    value={config.vitaminsBudget}
                    onChange={(e) => setConfig({ ...config, vitaminsBudget: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Molase & Karbon (Rp)</label>
                  <input
                    type="number"
                    step="50000"
                    value={config.molassesBudget}
                    onChange={(e) => setConfig({ ...config, molassesBudget: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Dolomit & Garam (Rp)</label>
                  <input
                    type="number"
                    step="50000"
                    value={config.dolomiteSaltBudget}
                    onChange={(e) => setConfig({ ...config, dolomiteSaltBudget: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Upah Tenaga Kerja (Rp)</label>
                  <input
                    type="number"
                    step="100000"
                    value={config.laborCostPerCycle}
                    onChange={(e) => setConfig({ ...config, laborCostPerCycle: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Air & Perawatan (Rp)</label>
                  <input
                    type="number"
                    step="50000"
                    value={config.waterElectricityMaintenance}
                    onChange={(e) => setConfig({ ...config, waterElectricityMaintenance: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Penyusutan Kolam (Rp)</label>
                  <input
                    type="number"
                    step="50000"
                    value={config.pondDepreciationPerCycle}
                    onChange={(e) => setConfig({ ...config, pondDepreciationPerCycle: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Penyusutan Alat & IoT (Rp)</label>
                  <input
                    type="number"
                    step="50000"
                    value={config.aeratorEquipmentDepreciation}
                    onChange={(e) => setConfig({ ...config, aeratorEquipmentDepreciation: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Target Harga Jual */}
            <div className="bg-[#0f172a]/90 backdrop-blur-md border border-emerald-500/40 rounded-2xl p-6 shadow-xl space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    5. Target Harga Jual Ikan Nila Segar ke Pasar / Pengepul
                  </h3>
                  <p className="text-[11px] text-slate-400">Harga pasar ikan nila hidup di tingkat pembudidaya.</p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-slate-400">Estimasi Omset:</span>
                  <div className="text-lg font-black text-emerald-400 font-mono">
                    {formatRupiah(hppResult.totalRevenue)}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <input
                    type="number"
                    min="15000"
                    max="60000"
                    step="500"
                    value={config.expectedSellingPricePerKg}
                    onChange={(e) => setConfig({ ...config, expectedSellingPricePerKg: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-emerald-300 font-black text-sm font-mono rounded-xl pl-4 pr-16 py-2.5 border border-emerald-500/50 focus:border-emerald-400 outline-none"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">/ Kg</span>
                </div>
                <div className="flex items-center gap-1.5 w-full sm:w-auto">
                  {[28000, 30000, 32000, 35000].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setConfig({ ...config, expectedSellingPricePerKg: preset })}
                      className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono rounded-lg transition-all"
                    >
                      {preset / 1000}k
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: HPP Summary & Cost Breakdown Card */}
          <div className="space-y-6">
            <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-5 sticky top-24">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/30">
                    <PieIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Struktur Biaya HPP</h3>
                    <p className="text-[11px] text-slate-400">Total Modal: {formatRupiah(hppResult.totalProductionCost)}</p>
                  </div>
                </div>
              </div>

              {/* Donut Chart */}
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hppResult.costBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="amount"
                    >
                      {hppResult.costBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke="#0f172a" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [formatRupiah(val), 'Biaya']}
                      contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Cost Item Breakdown List */}
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {hppResult.costBreakdown.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-[#020617] border border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-300 font-medium">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-white">{formatRupiah(item.amount)}</div>
                      <div className="text-[10px] text-slate-500">{formatNumber(item.percentage, 1)}%</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Key Highlights Table */}
              <div className="p-4 bg-[#020617] rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">BEP Produksi (Titik Impas):</span>
                  <span className="font-mono font-bold text-cyan-300">{formatNumber(hppResult.bepKg, 1)} Kg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">HPP per Ekor Ikan:</span>
                  <span className="font-mono font-bold text-white">{formatRupiah(hppResult.hppPerFish)} / ekor</span>
                </div>
                <div className="flex justify-between border-t border-slate-800/80 pt-2">
                  <span className="text-slate-400">Potensi Keuntungan per Kg:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{formatRupiah(config.expectedSellingPricePerKg - hppResult.hppPerKg)} / kg
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TABEL PENCATATAN PAKAN & HARIAN                    */}
      {/* ======================================================== */}
      {activeTab === 'daily_logs' && (
        <div className="space-y-4">
          {/* Action Bar & Quick Stats */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleOpenAddModal}
                className="px-4 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Catat Pakan Hari Ini
              </button>

              <div className="text-xs text-slate-400 hidden sm:block">
                Total Pakan Terpakai: <span className="font-mono font-bold text-cyan-300">{formatNumber(logStats.totalFeedAccumulated, 1)} Kg</span> • Mortalitas: <span className="font-mono font-bold text-red-400">{logStats.totalMortality} Ekor</span>
              </div>
            </div>

            {/* Search & Filter */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Cari DoC, tanggal, jenis pakan..."
                className="bg-[#020617] text-white text-xs rounded-xl px-3 py-2 border border-slate-700 focus:border-cyan-500 outline-none w-56"
              />
              <button
                onClick={() => setLogSortOrder(logSortOrder === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1"
                title="Urutkan Tanggal"
              >
                {logSortOrder === 'desc' ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                <span>{logSortOrder === 'desc' ? 'Terbaru' : 'Awal'}</span>
              </button>
            </div>
          </div>

          {/* Daily Log Table Card */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-[#020617] text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800 font-bold">
                  <tr>
                    <th className="py-3 px-3">DoC</th>
                    <th className="py-3 px-3">Tanggal</th>
                    <th className="py-3 px-3 text-right">Pagi (kg)</th>
                    <th className="py-3 px-3 text-right">Siang (kg)</th>
                    <th className="py-3 px-3 text-right">Sore (kg)</th>
                    <th className="py-3 px-3 text-right font-black text-cyan-400">Total Pakan</th>
                    <th className="py-3 px-3">Jenis Pakan</th>
                    <th className="py-3 px-3 text-right">ABW (g)</th>
                    <th className="py-3 px-3 text-right">Mati (ekor)</th>
                    <th className="py-3 px-3 text-right">Biomassa (kg)</th>
                    <th className="py-3 px-3">Kualitas Air</th>
                    <th className="py-3 px-3">Suplemen & Catatan</th>
                    <th className="py-3 px-3 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono text-xs">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-bold text-cyan-400">
                        Hari ke-{log.doc}
                      </td>
                      <td className="py-3 px-3 text-slate-400 font-sans whitespace-nowrap">
                        {log.date}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {formatNumber(log.feedMorningKg, 1)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {formatNumber(log.feedAfternoonKg, 1)}
                      </td>
                      <td className="py-3 px-3 text-right text-slate-300">
                        {formatNumber(log.feedEveningKg, 1)}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-cyan-300 bg-cyan-950/20">
                        {formatNumber(log.feedTotalKg, 2)} kg
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-300 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">
                          {log.feedType}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-emerald-400">
                        {formatNumber(log.abwGram, 1)} g
                      </td>
                      <td className="py-3 px-3 text-right text-red-400 font-bold">
                        {log.mortalityCount > 0 ? `-${log.mortalityCount}` : '0'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-white">
                        {formatNumber(log.estimatedBiomassKg, 1)} kg
                      </td>
                      <td className="py-3 px-3 font-sans text-[11px] text-slate-400">
                        {log.waterDo ? `DO: ${log.waterDo.toFixed(1)} mg/L, ` : ''}
                        {log.waterPh ? `pH: ${log.waterPh.toFixed(1)}` : '-'}
                      </td>
                      <td className="py-3 px-3 font-sans text-xs text-slate-300 max-w-xs truncate">
                        {log.notes || (log.supplements && log.supplements.length > 0 ? log.supplements.map(s => `${s.name} ${s.amount}${s.unit}`).join(', ') : '-')}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenEditModal(log)}
                            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1 hover:bg-slate-700 text-slate-400 hover:text-red-400 rounded transition-colors"
                            title="Hapus"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={13} className="py-8 text-center text-slate-500 font-sans">
                        Tidak ada data log yang sesuai dengan filter pencarian.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: GRAFIK PERTUMBUHAN, FCR & ANALISIS FINANSIAL      */}
      {/* ======================================================== */}
      {activeTab === 'analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Kurva Pertumbuhan ABW (Average Body Weight) */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Kurva Pertumbuhan Bobot Ikan (Gram/Ekor)</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Target Akhir: {config.targetHarvestAbwGram}g</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={growthChartData}>
                  <defs>
                    <linearGradient id="abwGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="doc" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} unit="g" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                    formatter={(val: number) => [`${val} gram`, 'Rata-rata Bobot (ABW)']}
                  />
                  <Area type="monotone" dataKey="abw" stroke="#10b981" strokeWidth={2.5} fill="url(#abwGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Akumulasi Pakan Harian */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Scale className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Distribusi Konsumsi Pakan Harian (Kg)</h3>
              </div>
              <span className="text-[10px] font-mono text-cyan-300">Total: {formatNumber(logStats.totalFeedAccumulated, 1)} kg</span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={growthChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="doc" stroke="#64748b" fontSize={10} />
                  <YAxis stroke="#64748b" fontSize={10} unit="kg" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '11px' }}
                    formatter={(val: number) => [`${val} kg`, 'Pakan Harian']}
                  />
                  <Bar dataKey="feed" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card 3: Komparasi Dengan PLTS Surya vs Hanya PLN */}
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4 lg:col-span-2">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <SunMedium className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Dampak Penggunaan PLTS Surya terhadap Penurunan HPP</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-[#020617] rounded-xl border border-red-500/30 space-y-2">
                <div className="text-[11px] font-bold text-red-400 uppercase">Skenario 100% Grid PLN</div>
                <div className="text-xl font-black text-white font-mono">
                  {formatRupiah(hppResult.totalElectricityWithoutPlts)}
                </div>
                <p className="text-xs text-slate-400">
                  Biaya listrik aerator dan pompa bila seluruh daya bersumber dari PLN tanpa tenaga surya.
                </p>
                <div className="text-[11px] text-slate-300 font-mono pt-1">
                  HPP per kg: <strong className="text-white">{formatRupiah(hppResult.hppPerKg + (hppResult.pltsSavingsRupiah / hppResult.totalHarvestWeightKg))}</strong>
                </div>
              </div>

              <div className="p-4 bg-[#020617] rounded-xl border border-emerald-500/30 space-y-2">
                <div className="text-[11px] font-bold text-emerald-400 uppercase">Skenario Hybrid PLTS NilaSense ({config.pltsSolarPortionPct}% Surya)</div>
                <div className="text-xl font-black text-emerald-300 font-mono">
                  {formatRupiah(hppResult.totalElectricityPlnCost)}
                </div>
                <p className="text-xs text-slate-400">
                  Biaya riil listrik PLN yang dibayarkan berkat pemanfaatan panel surya & baterai inverter.
                </p>
                <div className="text-[11px] text-emerald-300 font-mono pt-1">
                  HPP Efisien: <strong className="text-white">{formatRupiah(hppResult.hppPerKg)}</strong>
                </div>
              </div>

              <div className="p-4 bg-gradient-to-br from-amber-500/10 to-emerald-500/10 rounded-xl border border-amber-500/30 space-y-2">
                <div className="text-[11px] font-bold text-amber-400 uppercase">Total Penghematan Energi</div>
                <div className="text-2xl font-black text-amber-300 font-mono">
                  {formatRupiah(hppResult.pltsSavingsRupiah)}
                </div>
                <p className="text-xs text-slate-300">
                  Penurunan beban biaya sebesar <strong className="text-emerald-400">{formatRupiah(hppResult.pltsSavingsRupiah / (hppResult.totalHarvestWeightKg || 1))}/kg</strong> ikan panen secara konsisten tiap siklus.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: SOP & REKOMENDASI EFISIENSI HPP                   */}
      {/* ======================================================== */}
      {activeTab === 'recommendations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-white">Strategi Menekan FCR (Pakan Efisien)</h3>
            </div>
            <ul className="space-y-3 text-xs text-slate-300 leading-relaxed list-disc list-inside">
              <li>
                <strong className="text-white">Fermentasi Pakan:</strong> Bibis pakan dengan probiotik EM4 / Bacillus subtilis + molase 15 menit sebelum ditebar untuk meningkatkan kecernaan protein hingga 12-15%.
              </li>
              <li>
                <strong className="text-white">Feeding Regimen Sesuai Suhu:</strong> Nila paling aktif makan pada suhu air 28-30°C. Maksimalkan feeding rate siang hari saat aerasi bertenaga surya penuh.
              </li>
              <li>
                <strong className="text-white">Manajemen Flok Bioflok:</strong> Pertahankan volume flok 15-25 ml/L (Imhoff cone) sebagai sumber pakan alami kedua berprotein tinggi.
              </li>
            </ul>
          </div>

          <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
              <SunMedium className="w-5 h-5 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Optimasi Siklus Aerasi Berbasis PLTS</h3>
            </div>
            <ul className="space-y-3 text-xs text-slate-300 leading-relaxed list-disc list-inside">
              <li>
                <strong className="text-white">Puncak Solar (09:00 - 15:00):</strong> Jalankan aerator kincir pada kapasitas 100% menggunakan direct solar power untuk saturasi oksigen maksimum (&gt;6.0 mg/L).
              </li>
              <li>
                <strong className="text-white">Malam Hari (22:00 - 05:00):</strong> Aerator venturi / blower disuplai baterai & PLN grid, menjaga DO stabil di atas ambang batas 4.0 mg/L.
              </li>
              <li>
                <strong className="text-white">Pencegahan Mortalitas:</strong> Alarm sensor otomatis berbunyi jika DO &lt; 3.0 mg/L untuk mencegah kematian massal ikan.
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: INPUT / EDIT CATATAN LOG PAKAN HARIAN            */}
      {/* ======================================================== */}
      {isLogModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/30">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {editingLogId ? 'Edit Catatan Harian' : 'Catat Pakan & Kondisi Harian Baru'}
                  </h3>
                  <p className="text-[11px] text-slate-400">Pencatatan rutin pakan pagi, siang, sore, dan mortalitas ikan.</p>
                </div>
              </div>
              <button
                onClick={() => setIsLogModalOpen(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDailyLog} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Tanggal</label>
                  <input
                    type="date"
                    required
                    value={logForm.date}
                    onChange={(e) => setLogForm({ ...logForm, date: e.target.value })}
                    className="w-full bg-[#020617] text-white text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">DoC (Hari ke-)</label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    required
                    value={logForm.doc}
                    onChange={(e) => setLogForm({ ...logForm, doc: parseInt(e.target.value) || 1 })}
                    className="w-full bg-[#020617] text-cyan-300 font-bold text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Jenis Pakan Pelet</label>
                  <select
                    value={logForm.feedType}
                    onChange={(e) => setLogForm({ ...logForm, feedType: e.target.value })}
                    className="w-full bg-[#020617] text-white text-xs rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  >
                    <option value="PF-500 (Larva 0.5mm)">PF-500 (Larva 0.5mm)</option>
                    <option value="PF-1000 (Benih 1.0mm)">PF-1000 (Benih 1.0mm)</option>
                    <option value="781-1 (Starter 1-2mm)">781-1 (Starter 1-2mm)</option>
                    <option value="781-2 (Grower 2-3mm)">781-2 (Grower 2-3mm)</option>
                    <option value="781 (Finisher 3-4mm)">781 (Finisher 3-4mm)</option>
                    <option value="Feng-Li 0/1/2">Feng-Li 0/1/2</option>
                  </select>
                </div>
              </div>

              {/* Pakan Sesi Pagi, Siang, Sore */}
              <div className="p-4 bg-[#020617] rounded-xl border border-cyan-500/30 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-cyan-300">Pemberian Pakan 3 Sesi (Kg)</span>
                  <span className="text-xs font-mono font-bold text-white">
                    Total: {formatNumber(logForm.feedMorningKg + logForm.feedAfternoonKg + logForm.feedEveningKg, 2)} Kg
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">1. Pagi (08:00)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={logForm.feedMorningKg}
                      onChange={(e) => setLogForm({ ...logForm, feedMorningKg: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#0f172a] text-white text-xs font-mono rounded-lg px-2.5 py-1.5 border border-slate-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">2. Siang (12:30)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={logForm.feedAfternoonKg}
                      onChange={(e) => setLogForm({ ...logForm, feedAfternoonKg: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#0f172a] text-white text-xs font-mono rounded-lg px-2.5 py-1.5 border border-slate-700 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">3. Sore (16:30)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={logForm.feedEveningKg}
                      onChange={(e) => setLogForm({ ...logForm, feedEveningKg: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-[#0f172a] text-white text-xs font-mono rounded-lg px-2.5 py-1.5 border border-slate-700 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sampling ABW & Mortalitas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Sampling Rata-rata Bobot (ABW Gram)</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    step="0.5"
                    value={logForm.abwGram}
                    onChange={(e) => setLogForm({ ...logForm, abwGram: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-emerald-300 font-bold text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-300 block mb-1">Mortalitas / Ikan Mati Hari Ini (Ekor)</label>
                  <input
                    type="number"
                    min="0"
                    max="5000"
                    value={logForm.mortalityCount}
                    onChange={(e) => setLogForm({ ...logForm, mortalityCount: parseInt(e.target.value) || 0 })}
                    className="w-full bg-[#020617] text-red-300 font-bold text-xs font-mono rounded-xl px-3 py-2 border border-slate-700 outline-none"
                  />
                </div>
              </div>

              {/* Tambahan Vitamin / Probiotik */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-[#020617] rounded-xl border border-slate-800">
                <div className="sm:col-span-2">
                  <label className="text-[10px] text-slate-400 block mb-1">Suplemen / Probiotik (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: EM4 50ml + Molase 100ml"
                    value={logForm.supplementName}
                    onChange={(e) => setLogForm({ ...logForm, supplementName: e.target.value })}
                    className="w-full bg-[#0f172a] text-white text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">Biaya Tambahan (Rp)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={logForm.supplementCost}
                    onChange={(e) => setLogForm({ ...logForm, supplementCost: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-[#0f172a] text-white text-xs font-mono rounded-lg px-2.5 py-1.5 border border-slate-700 outline-none"
                  />
                </div>
              </div>

              {/* Catatan Tindakan */}
              <div>
                <label className="text-[11px] font-bold text-slate-300 block mb-1">Catatan Operasional / Kualitas Air</label>
                <textarea
                  rows={2}
                  value={logForm.notes}
                  onChange={(e) => setLogForm({ ...logForm, notes: e.target.value })}
                  placeholder="Contoh: Nafsu makan agresif, flok terbentuk baik, buang endapan central drain..."
                  className="w-full bg-[#020617] text-white text-xs rounded-xl px-3 py-2 border border-slate-700 outline-none"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsLogModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black rounded-xl transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Simpan Data Harian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
