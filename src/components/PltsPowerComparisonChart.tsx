import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, RefreshCw, Sun, Waves } from 'lucide-react';

interface PltsHistoryPoint {
  timestamp: string;
  pvPowerW: number;
  loadPowerW: number;
  batteryPowerW?: number;
  gridPowerW?: number;
  batterySocPct?: number;
}

type RangeKey = '15m' | '30m' | '1h' | 'all';

const RANGE_POINTS: Record<RangeKey, number> = {
  // Backend PLTS polling is 15 seconds: ~4 samples/minute.
  '15m': 60,
  '30m': 120,
  '1h': 240,
  all: 500,
};

const RANGE_LABELS: Record<RangeKey, string> = {
  '15m': '15 Menit',
  '30m': '30 Menit',
  '1h': '1 Jam',
  all: 'Semua',
};

const formatClock = (value: string) => {
  if (!value) return '-';

  // Backward compatible with old HH:mm:ss history labels.
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) return value;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const timePart = value.includes(' ') ? value.split(' ')[1] : value;
    return timePart?.slice(0, 8) || value;
  }

  return parsed.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 1 }).format(value);

export const PltsPowerComparisonChart: React.FC = () => {
  const [history, setHistory] = useState<PltsHistoryPoint[]>([]);
  const [selectedRange, setSelectedRange] = useState<RangeKey>('30m');
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (manual = false) => {
    if (manual) setLoading(true);

    try {
      const response = await fetch('/api/plts/history', { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = await response.json();
      const rows = Array.isArray(payload?.history) ? payload.history : [];

      setHistory(
        rows
          .filter((row: any) => row && row.timestamp)
          .map((row: any) => ({
            timestamp: String(row.timestamp),
            pvPowerW: Math.max(0, Number(row.pvPowerW) || 0),
            loadPowerW: Math.max(0, Number(row.loadPowerW) || 0),
            batteryPowerW: Math.max(0, Number(row.batteryPowerW) || 0),
            gridPowerW: Math.max(0, Number(row.gridPowerW) || 0),
            batterySocPct: Number(row.batterySocPct) || 0,
          }))
      );
      setError(null);
      setLastUpdated(new Date().toLocaleTimeString('id-ID', { hour12: false }));
    } catch (err: any) {
      setError(err?.message || 'Gagal mengambil riwayat PLTS');
    } finally {
      if (manual) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
    const timer = window.setInterval(() => fetchHistory(), 15000);
    return () => window.clearInterval(timer);
  }, [fetchHistory]);

  const chartData = useMemo(() => {
    const count = RANGE_POINTS[selectedRange];
    return history.slice(-count).map((item) => ({
      ...item,
      time: formatClock(item.timestamp),
      pvPowerW: Number(item.pvPowerW.toFixed(1)),
      loadPowerW: Number(item.loadPowerW.toFixed(1)),
    }));
  }, [history, selectedRange]);

  const stats = useMemo(() => {
    if (chartData.length === 0) {
      return {
        currentPv: 0,
        currentLoad: 0,
        avgPv: 0,
        avgLoad: 0,
        balance: 0,
      };
    }

    const latest = chartData[chartData.length - 1];
    const pvTotal = chartData.reduce((sum, row) => sum + row.pvPowerW, 0);
    const loadTotal = chartData.reduce((sum, row) => sum + row.loadPowerW, 0);

    return {
      currentPv: latest.pvPowerW,
      currentLoad: latest.loadPowerW,
      avgPv: pvTotal / chartData.length,
      avgLoad: loadTotal / chartData.length,
      balance: latest.pvPowerW - latest.loadPowerW,
    };
  }, [chartData]);

  return (
    <section className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 sm:p-6 shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base sm:text-lg font-bold text-white">
              Perbandingan Daya PLTS dan Beban
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">
            Data historis dari snapshot energy-flow Dessmonitor, diperbarui setiap ±15 detik.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedRange(key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                selectedRange === key
                  ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300'
                  : 'bg-[#020617] border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {RANGE_LABELS[key]}
            </button>
          ))}

          <button
            type="button"
            onClick={() => fetchHistory(true)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#020617] border border-slate-800 text-slate-300 hover:border-cyan-700/70 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-xl bg-[#020617]/70 border border-amber-500/20 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
            <Sun className="w-3.5 h-3.5 text-amber-400" /> PLTS terakhir
          </div>
          <div className="text-lg font-bold font-mono text-amber-300">
            {formatNumber(stats.currentPv)} <span className="text-xs text-slate-500">W</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#020617]/70 border border-cyan-500/20 p-3">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-1">
            <Waves className="w-3.5 h-3.5 text-cyan-400" /> Beban terakhir
          </div>
          <div className="text-lg font-bold font-mono text-cyan-300">
            {formatNumber(stats.currentLoad)} <span className="text-xs text-slate-500">W</span>
          </div>
        </div>

        <div className="rounded-xl bg-[#020617]/70 border border-slate-800 p-3">
          <div className="text-[11px] text-slate-400 mb-1">Rata-rata PV / Beban</div>
          <div className="text-sm font-semibold font-mono text-slate-200">
            {formatNumber(stats.avgPv)} / {formatNumber(stats.avgLoad)} W
          </div>
        </div>

        <div className="rounded-xl bg-[#020617]/70 border border-slate-800 p-3">
          <div className="text-[11px] text-slate-400 mb-1">Selisih terakhir</div>
          <div className={`text-sm font-semibold font-mono ${stats.balance >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
            {stats.balance >= 0 ? '+' : ''}{formatNumber(stats.balance)} W
            <span className="block text-[10px] font-normal text-slate-500 mt-0.5">
              {stats.balance >= 0 ? 'PV ≥ beban' : 'PV < beban'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-800/60 bg-rose-950/30 px-3 py-2 text-xs text-rose-300">
          Riwayat PLTS belum dapat dimuat: {error}
        </div>
      )}

      {chartData.length < 2 ? (
        <div className="h-[300px] sm:h-[360px] flex items-center justify-center rounded-xl border border-dashed border-slate-800 bg-[#020617]/40 text-center px-6">
          <div>
            <Activity className="w-8 h-8 text-cyan-500/60 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-300">Menunggu data historis PLTS</p>
            <p className="text-xs text-slate-500 mt-1">
              Grafik akan muncul setelah tersedia sedikitnya dua snapshot energy-flow.
            </p>
          </div>
        </div>
      ) : (
        <div className="h-[300px] sm:h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 10, left: -10, bottom: 2 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis
                dataKey="time"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: '#334155' }}
                minTickGap={28}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={58}
                tickFormatter={(value) => `${Math.round(Number(value))} W`}
                domain={[0, 'auto']}
              />
              <Tooltip
                labelFormatter={(label) => `Waktu: ${label}`}
                formatter={(value: any, name: any) => [
                  `${formatNumber(Number(value) || 0)} W`,
                  name === 'pvPowerW' ? 'Daya PLTS' : 'Daya Beban',
                ]}
                contentStyle={{
                  background: '#020617',
                  border: '1px solid #334155',
                  borderRadius: '12px',
                  color: '#e2e8f0',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              />
              <Legend
                verticalAlign="top"
                height={34}
                formatter={(value) => (
                  <span className="text-xs text-slate-300">
                    {value === 'pvPowerW' ? 'Daya PLTS' : 'Daya Beban'}
                  </span>
                )}
              />
              <Line
                type="monotone"
                dataKey="pvPowerW"
                name="pvPowerW"
                stroke="#fbbf24"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="loadPowerW"
                name="loadPowerW"
                stroke="#38bdf8"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-500">
        <span>{chartData.length} titik ditampilkan dari {history.length} titik tersimpan di server.</span>
        <span>Update chart: {lastUpdated || '-'}</span>
      </div>
    </section>
  );
};
