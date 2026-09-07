import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from 'recharts';
import {
  Activity,
  Download,
  Droplet,
  FileSpreadsheet,
  RefreshCw,
  Thermometer,
  Wind,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TelemetryData, PltsSummary, ThresholdSettings } from '../types';

type RangeMode = '1d' | '7d' | '30d' | 'custom';

type PersistedTelemetry = TelemetryData & {
  _id?: string;
  recordedAt?: string;
  bucket5m?: string;
  plts?: {
    pvPowerW: number | null;
    pvPowerKW: number | null;
    batterySocPct: number | null;
    batteryPowerW: number | null;
    loadPowerW: number | null;
    gridPowerW: number | null;
    gridVoltageV: number | null;
    gridFrequencyHz: number | null;
    isGridAvailable: boolean | null;
    isGridActive: boolean | null;
    batteryDirection: string | null;
    gridDirection: string | null;
    connected: boolean;
    lastUpdated: string | null;
  } | null;
};

interface TelemetryStats {
  count: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  ph: { avg: number | null; min: number | null; max: number | null };
  dissolvedOxygen: { avg: number | null; min: number | null; max: number | null };
  temperature: { avg: number | null; min: number | null; max: number | null };
  plts: {
    pvPowerW: { avg: number | null; min: number | null; max: number | null };
    batterySocPct: { avg: number | null; min: number | null; max: number | null };
    loadPowerW: { avg: number | null; min: number | null; max: number | null };
    gridPowerW: { avg: number | null; min: number | null; max: number | null };
    gridAvailableCount: number;
    gridActiveCount: number;
    latestGridAvailable: boolean | null;
    latestGridActive: boolean | null;
  };
}

interface TelemetryChartsProps {
  history: TelemetryData[];
  pltsSummary: PltsSummary | null;
  thresholds: ThresholdSettings;
}

const RANGE_OPTIONS: Array<{ mode: RangeMode; label: string }> = [
  { mode: '1d', label: '1 Hari' },
  { mode: '7d', label: '7 Hari' },
  { mode: '30d', label: '30 Hari' },
  { mode: 'custom', label: 'Custom' },
];

function jakartaDateInputValue(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
}

function formatDateLabel(value: string): string {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatRecordedTime(item: PersistedTelemetry, compact: boolean) {
  const raw = item.recordedAt || item.received_at;
  if (!raw) return item.timestamp || '-';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return item.timestamp || '-';

  if (compact) {
    return date.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function valueOrNull(value: number | null | undefined, digits = 2) {
  return typeof value === 'number' && Number.isFinite(value)
    ? Number(value.toFixed(digits))
    : null;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({
  history: liveHistory,
  thresholds,
}) => {
  const today = useMemo(() => jakartaDateInputValue(), []);
  const [rangeMode, setRangeMode] = useState<RangeMode>('1d');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [appliedFromDate, setAppliedFromDate] = useState(today);
  const [appliedToDate, setAppliedToDate] = useState(today);
  const [history, setHistory] = useState<PersistedTelemetry[]>([]);
  const [stats, setStats] = useState<TelemetryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'mongodb' | 'memory' | string>('mongodb');
  const [error, setError] = useState<string | null>(null);

  const rangeQuery = useMemo(() => {
    if (rangeMode === '1d') return 'days=1';
    if (rangeMode === '7d') return 'days=7';
    if (rangeMode === '30d') return 'days=30';
    return `from=${encodeURIComponent(appliedFromDate)}&to=${encodeURIComponent(appliedToDate)}`;
  }, [rangeMode, appliedFromDate, appliedToDate]);

  const rangeLabel = useMemo(() => {
    if (rangeMode === '1d') return '1 hari terakhir';
    if (rangeMode === '7d') return '7 hari terakhir';
    if (rangeMode === '30d') return '30 hari terakhir';
    return `${formatDateLabel(appliedFromDate)} s.d. ${formatDateLabel(appliedToDate)}`;
  }, [rangeMode, appliedFromDate, appliedToDate]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const [historyResponse, statsResponse] = await Promise.all([
        fetch(`/api/telemetry/history?${rangeQuery}&limit=10000`),
        fetch(`/api/telemetry/stats?${rangeQuery}`),
      ]);

      if (!historyResponse.ok) {
        const json = await historyResponse.json().catch(() => ({}));
        throw new Error(json.error || `History HTTP ${historyResponse.status}`);
      }

      const historyJson = await historyResponse.json();
      setHistory(Array.isArray(historyJson.history) ? historyJson.history : []);
      setSource(historyJson.source || 'mongodb');

      if (statsResponse.ok) {
        const statsJson = await statsResponse.json();
        setStats(statsJson.stats || null);
      } else {
        setStats(null);
      }
    } catch (err: any) {
      console.error('MongoDB analytics load error:', err);
      setError(
        err?.message ||
          'Data MongoDB belum dapat dibaca. Menampilkan buffer data live sementara.'
      );
      setHistory(liveHistory as PersistedTelemetry[]);
      setSource('memory');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeQuery]);

  const applyCustomRange = () => {
    setError(null);

    if (!fromDate || !toDate) {
      setError('Tanggal awal dan tanggal akhir wajib diisi.');
      return;
    }

    if (fromDate > toDate) {
      setError('Tanggal awal tidak boleh setelah tanggal akhir.');
      return;
    }

    const from = new Date(`${fromDate}T00:00:00+07:00`);
    const to = new Date(`${toDate}T00:00:00+07:00`);
    const days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;

    if (!Number.isFinite(days) || days < 1) {
      setError('Rentang tanggal tidak valid.');
      return;
    }

    if (days > 366) {
      setError('Rentang tanggal custom maksimal 366 hari.');
      return;
    }

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);

    if (fromDate === appliedFromDate && toDate === appliedToDate) {
      void loadHistory();
    }
  };

  const chartData = useMemo(
    () =>
      history.map((item, index) => ({
        index,
        time: formatRecordedTime(
          item,
          rangeMode === '1d' ||
            (rangeMode === 'custom' && appliedFromDate === appliedToDate)
        ),
        recordedAt: item.recordedAt || item.received_at || item.timestamp,
        ph: valueOrNull(item.ph, 2),
        dissolvedOxygen: valueOrNull(item.do_mg_l, 2),
        temperature: valueOrNull(item.water_temperature_c, 1),
        pvPowerW: valueOrNull(item.plts?.pvPowerW, 1),
        batterySocPct: valueOrNull(item.plts?.batterySocPct, 1),
        loadPowerW: valueOrNull(item.plts?.loadPowerW, 1),
        gridPowerW: valueOrNull(item.plts?.gridPowerW, 1),
        gridAvailable: item.plts?.isGridAvailable === true ? 1 : 0,
        gridActive: item.plts?.isGridActive === true ? 1 : 0,
      })),
    [history, rangeMode, appliedFromDate, appliedToDate]
  );

  const exportCsv = () => {
    window.location.href = `/api/telemetry/export.csv?${rangeQuery}`;
  };

  const exportExcel = () => {
    if (history.length === 0) return;

    const worksheetRows = history.map((row) => ({
      'Waktu Rekam WIB': row.recordedAt
        ? new Date(row.recordedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
        : row.received_at || row.timestamp,
      'Recorded At UTC': row.recordedAt
        ? new Date(row.recordedAt).toISOString()
        : row.received_at || '',
      'Timestamp Device': row.timestamp,
      Device: row.device,
      pH: row.ph,
      'pH mV': row.ph_mv,
      'DO mg/L': row.do_mg_l,
      'DO Saturation %': row.do_saturation_pct,
      'Suhu °C': row.water_temperature_c,
      'DO OK': row.do_ok ? 'Ya' : 'Tidak',
      'Modbus Code': row.modbus_code,
      'WiFi RSSI dBm': row.wifi_rssi,
      'WiFi Connected': row.wifi_connected ? 'Ya' : 'Tidak',
      'MQTT Connected': row.mqtt_connected ? 'Ya' : 'Tidak',
      IP: row.ip,
      'Uptime detik': row.uptime_s,
      'Daya PLTS W': row.plts?.pvPowerW ?? '',
      'Baterai %': row.plts?.batterySocPct ?? '',
      'Daya Baterai W': row.plts?.batteryPowerW ?? '',
      'Daya Beban W': row.plts?.loadPowerW ?? '',
      'Daya PLN W': row.plts?.gridPowerW ?? '',
      'Tegangan PLN V': row.plts?.gridVoltageV ?? '',
      'Frekuensi PLN Hz': row.plts?.gridFrequencyHz ?? '',
      'PLN Tersedia':
        row.plts?.isGridAvailable === true
          ? 'Ya'
          : row.plts?.isGridAvailable === false
          ? 'Tidak'
          : '',
      'PLN Aktif/Aliran':
        row.plts?.isGridActive === true
          ? 'Ya'
          : row.plts?.isGridActive === false
          ? 'Tidak'
          : '',
      'Arah Baterai': row.plts?.batteryDirection ?? '',
      'Arah PLN': row.plts?.gridDirection ?? '',
      'PLTS Connected':
        row.plts?.connected === true
          ? 'Ya'
          : row.plts?.connected === false
          ? 'Tidak'
          : '',
      'Update PLTS': row.plts?.lastUpdated ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
    worksheet['!cols'] = [
      { wch: 22 },
      { wch: 26 },
      { wch: 20 },
      { wch: 18 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 18 },
      { wch: 12 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 17 },
      { wch: 16 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Telemetri');

    const filename =
      rangeMode === 'custom'
        ? `telemetri-nilasense-${appliedFromDate}-sd-${appliedToDate}.xlsx`
        : `telemetri-nilasense-${rangeMode === '1d' ? '1' : rangeMode === '7d' ? '7' : '30'}hari-${today}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  const statCards = [
    {
      title: 'pH Air',
      icon: Droplet,
      avg: stats?.ph.avg,
      min: stats?.ph.min,
      max: stats?.ph.max,
      unit: '',
    },
    {
      title: 'Dissolved Oxygen',
      icon: Wind,
      avg: stats?.dissolvedOxygen.avg,
      min: stats?.dissolvedOxygen.min,
      max: stats?.dissolvedOxygen.max,
      unit: ' mg/L',
    },
    {
      title: 'Suhu Air',
      icon: Thermometer,
      avg: stats?.temperature.avg,
      min: stats?.temperature.min,
      max: stats?.temperature.max,
      unit: ' °C',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5" />
                Analitik MongoDB
              </span>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                  source === 'mongodb'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                Sumber: {source === 'mongodb' ? 'MongoDB Atlas' : 'Memory'}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              History & Analitik Kualitas Air
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Snapshot sensor disimpan per 5 menit. Pilih rentang data untuk grafik dan laporan.
            </p>
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap bg-[#020617] p-1 rounded-xl border border-slate-800">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.mode}
                    onClick={() => setRangeMode(option.mode)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                      rangeMode === option.mode
                        ? 'bg-cyan-600 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => void loadHistory()}
                disabled={loading}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold border border-slate-700"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <button
                onClick={exportCsv}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-semibold"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>

              <button
                onClick={exportExcel}
                disabled={history.length === 0}
                className="flex items-center gap-1.5 px-3.5 py-2.5 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </button>
            </div>

            {rangeMode === 'custom' && (
              <div className="flex flex-wrap items-end gap-2 p-3 bg-[#020617] border border-cyan-900/60 rounded-xl">
                <label className="text-[11px] text-slate-400">
                  <span className="block mb-1">Dari tanggal</span>
                  <input
                    type="date"
                    value={fromDate}
                    max={today}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </label>

                <label className="text-[11px] text-slate-400">
                  <span className="block mb-1">Sampai tanggal</span>
                  <input
                    type="date"
                    value={toDate}
                    max={today}
                    onChange={(e) => setToDate(e.target.value)}
                    className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  />
                </label>

                <button
                  onClick={applyCustomRange}
                  className="px-4 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-semibold"
                >
                  Terapkan Tanggal
                </button>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">
            Jumlah Snapshot
          </div>
          <div className="text-3xl font-black text-white">
            {loading ? '...' : stats?.count ?? history.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            rentang {rangeLabel}
          </div>
        </div>

        {statCards.map(({ title, icon: Icon, avg, min, max, unit }) => (
          <div key={title} className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-slate-500 mb-2">
              <Icon className="w-4 h-4" />
              {title}
            </div>
            <div className="text-2xl font-black text-white">
              {avg ?? '--'}
              <span className="text-xs font-medium text-slate-400">{unit}</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1">
              Min {min ?? '--'} • Max {max ?? '--'}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Daya PLTS</div>
          <div className="text-2xl font-black text-white">
            {stats?.plts.pvPowerW.avg ?? '--'} <span className="text-xs text-slate-400">W avg</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Min {stats?.plts.pvPowerW.min ?? '--'} W • Max {stats?.plts.pvPowerW.max ?? '--'} W
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Baterai PLTS</div>
          <div className="text-2xl font-black text-white">
            {stats?.plts.batterySocPct.avg ?? '--'} <span className="text-xs text-slate-400">% avg</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Min {stats?.plts.batterySocPct.min ?? '--'}% • Max {stats?.plts.batterySocPct.max ?? '--'}%
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Daya Beban</div>
          <div className="text-2xl font-black text-white">
            {stats?.plts.loadPowerW.avg ?? '--'} <span className="text-xs text-slate-400">W avg</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Min {stats?.plts.loadPowerW.min ?? '--'} W • Max {stats?.plts.loadPowerW.max ?? '--'} W
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-5">
          <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">Status PLN Terakhir</div>
          <div className={`text-xl font-black ${stats?.plts.latestGridAvailable ? 'text-emerald-400' : 'text-amber-400'}`}>
            {stats?.plts.latestGridAvailable === true ? 'TERSEDIA' : stats?.plts.latestGridAvailable === false ? 'TIDAK TERSEDIA' : '--'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Aliran PLN: {stats?.plts.latestGridActive === true ? 'Aktif' : stats?.plts.latestGridActive === false ? 'Tidak aktif' : '--'}
          </div>
        </div>
      </div>

      <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-bold text-white">Daya PLTS vs Daya Beban</h2>
          <p className="text-xs text-slate-500">Riwayat daya panel surya dan beban sistem dari MongoDB.</p>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={35} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 'auto']} />
              <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: 12 }} />
              <Legend />
              <Line type="monotone" dataKey="pvPowerW" name="PLTS W" stroke="#eab308" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="loadPowerW" name="Beban W" stroke="#a855f7" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-bold text-white">Persentase Baterai PLTS</h2>
          <p className="text-xs text-slate-500">State of Charge (SOC) baterai, 0–100%.</p>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={35} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#020617', border: '1px solid #334155', borderRadius: 12 }} />
              <Legend />
              <Line type="monotone" dataKey="batterySocPct" name="Baterai %" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-bold text-white">Tren pH Air</h2>
          <p className="text-xs text-slate-500">
            Acuan warning {thresholds.phWarningMin}–{thresholds.phWarningMax}
          </p>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={35} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#020617',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
              />
              <Legend />
              <ReferenceLine y={thresholds.phWarningMin} stroke="#f59e0b" strokeDasharray="5 5" />
              <ReferenceLine y={thresholds.phWarningMax} stroke="#f59e0b" strokeDasharray="5 5" />
              <Line
                type="monotone"
                dataKey="ph"
                name="pH"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-bold text-white">Tren Dissolved Oxygen (DO)</h2>
          <p className="text-xs text-slate-500">
            Target baik ≥ {thresholds.doMinGood} mg/L
          </p>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={35} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#020617',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
              />
              <Legend />
              <ReferenceLine y={thresholds.doMinGood} stroke="#10b981" strokeDasharray="5 5" />
              <ReferenceLine y={thresholds.doMinWarning} stroke="#f59e0b" strokeDasharray="5 5" />
              <Line
                type="monotone"
                dataKey="dissolvedOxygen"
                name="DO mg/L"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6">
        <div className="mb-4">
          <h2 className="font-bold text-white">Tren Suhu Air</h2>
          <p className="text-xs text-slate-500">
            Rentang optimal {thresholds.tempOptMin}–{thresholds.tempOptMax} °C
          </p>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} minTickGap={35} />
              <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#020617',
                  border: '1px solid #334155',
                  borderRadius: 12,
                }}
              />
              <Legend />
              <ReferenceLine y={thresholds.tempOptMin} stroke="#10b981" strokeDasharray="5 5" />
              <ReferenceLine y={thresholds.tempOptMax} stroke="#10b981" strokeDasharray="5 5" />
              <Line
                type="monotone"
                dataKey="temperature"
                name="Suhu °C"
                stroke="#fb923c"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {!loading && history.length === 0 && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
          Belum ada snapshot MongoDB pada rentang ini. Setelah cron berjalan, data akan mulai muncul per 5 menit.
        </div>
      )}
    </div>
  );
};
