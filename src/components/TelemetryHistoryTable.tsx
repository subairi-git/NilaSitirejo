import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { TelemetryData } from '../types';

type RangeMode = 'today' | '7d' | '30d' | 'custom';

type PersistedTelemetry = TelemetryData & {
  _id?: string;
  recordedAt?: string;
  bucket5m?: string;
  plts?: {
    pvPowerW: number | null;
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

interface TelemetryHistoryTableProps {
  history: TelemetryData[];
}

const RANGE_OPTIONS: Array<{ mode: RangeMode; label: string }> = [
  { mode: 'today', label: 'Hari Ini' },
  { mode: '7d', label: '7 Hari' },
  { mode: '30d', label: '30 Hari' },
  { mode: 'custom', label: 'Custom' },
];

function localDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function displayDate(item: PersistedTelemetry): string {
  const raw = item.recordedAt || item.received_at;
  if (raw) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleString('id-ID', {
        timeZone: 'Asia/Jakarta',
      });
    }
  }
  return item.timestamp || '-';
}

function formatDateLabel(value: string): string {
  if (!value) return '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function safeFilenameDate(value: string): string {
  return value || localDateInputValue();
}

export const TelemetryHistoryTable: React.FC<TelemetryHistoryTableProps> = ({
  history: liveHistory,
}) => {
  const today = useMemo(() => localDateInputValue(), []);

  const [history, setHistory] = useState<PersistedTelemetry[]>([]);
  const [rangeMode, setRangeMode] = useState<RangeMode>('today');
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [appliedFromDate, setAppliedFromDate] = useState(today);
  const [appliedToDate, setAppliedToDate] = useState(today);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'normal' | 'error'>('all');
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<string>('mongodb');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const itemsPerPage = 20;

  const rangeQuery = useMemo(() => {
    if (rangeMode === 'today') {
      return `from=${encodeURIComponent(today)}&to=${encodeURIComponent(today)}`;
    }
    if (rangeMode === '7d') return 'days=7';
    if (rangeMode === '30d') return 'days=30';
    return `from=${encodeURIComponent(appliedFromDate)}&to=${encodeURIComponent(appliedToDate)}`;
  }, [rangeMode, today, appliedFromDate, appliedToDate]);

  const rangeLabel = useMemo(() => {
    if (rangeMode === 'today') return `hari ini (${formatDateLabel(today)})`;
    if (rangeMode === '7d') return '7 hari terakhir';
    if (rangeMode === '30d') return '30 hari terakhir';
    return `${formatDateLabel(appliedFromDate)} s.d. ${formatDateLabel(appliedToDate)}`;
  }, [rangeMode, today, appliedFromDate, appliedToDate]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/telemetry/history?${rangeQuery}&limit=10000`
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      const rows = Array.isArray(data.history) ? data.history : [];
      setHistory(rows);
      setSource(data.source || 'mongodb');
      setTotalCount(Number.isFinite(data.totalCount) ? data.totalCount : rows.length);
      setTruncated(Boolean(data.truncated));
      setPage(1);
    } catch (err: any) {
      console.error('History database error:', err);
      setHistory(liveHistory as PersistedTelemetry[]);
      setSource('memory');
      setTotalCount(liveHistory.length);
      setTruncated(false);
      setError(
        err?.message ||
          'MongoDB belum dapat diakses. Tabel sementara memakai data live di memory.'
      );
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
    if (days > 366) {
      setError('Rentang tanggal custom maksimal 366 hari.');
      return;
    }

    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);

    // Bila tanggal sama dengan range yang sudah diterapkan, paksa refresh manual.
    if (fromDate === appliedFromDate && toDate === appliedToDate) {
      void loadHistory();
    }
  };

  const filteredHistory = useMemo(
    () =>
      history.filter((item) => {
        const keyword = searchTerm.trim().toLowerCase();
        const matchesSearch =
          !keyword ||
          (item.device || '').toLowerCase().includes(keyword) ||
          (item.timestamp || '').toLowerCase().includes(keyword) ||
          displayDate(item).toLowerCase().includes(keyword) ||
          (item.ip || '').toLowerCase().includes(keyword);

        if (!matchesSearch) return false;

        if (filterStatus === 'error') {
          return !item.do_ok || item.modbus_code !== 0;
        }

        if (filterStatus === 'normal') {
          return item.do_ok && item.modbus_code === 0;
        }

        return true;
      }),
    [history, searchTerm, filterStatus]
  );

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / itemsPerPage));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const currentItems = filteredHistory
    .slice()
    .reverse()
    .slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const exportCsv = () => {
    window.location.href = `/api/telemetry/export.csv?${rangeQuery}`;
  };

  const exportExcel = () => {
    if (history.length === 0) return;

    const rows = history.map((row) => ({
      'Waktu Rekam WIB': displayDate(row),
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

    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet['!cols'] = [
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
    XLSX.utils.book_append_sheet(workbook, sheet, 'Telemetry');

    const filename =
      rangeMode === 'custom'
        ? `log-telemetri-nilasense-${safeFilenameDate(appliedFromDate)}-sd-${safeFilenameDate(appliedToDate)}.xlsx`
        : rangeMode === 'today'
        ? `log-telemetri-nilasense-hari-ini-${today}.xlsx`
        : `log-telemetri-nilasense-${rangeMode === '7d' ? '7' : '30'}hari-${today}.xlsx`;

    XLSX.writeFile(workbook, filename);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Database Log Telemetri
              </span>
              <span
                className={`px-3 py-1 rounded-full text-[11px] font-semibold border ${
                  source === 'mongodb'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                }`}
              >
                {source === 'mongodb' ? 'MongoDB Atlas' : 'Memory'}
              </span>
            </div>

            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Riwayat Data Sensor Kolam Nila
            </h1>

            <p className="text-xs text-slate-400 mt-1">
              {loading
                ? 'Memuat data...'
                : `${filteredHistory.length.toLocaleString('id-ID')} catatan tampil untuk ${rangeLabel}.`}
            </p>

            {!loading && totalCount > 0 && (
              <p className="text-[11px] text-slate-500 mt-1">
                Database: {totalCount.toLocaleString('id-ID')} snapshot pada periode ini.
                {truncated
                  ? ' Tabel menampilkan maksimal 10.000 snapshot terbaru; CSV tetap mengunduh seluruh data pada periode terpilih.'
                  : ''}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-3 xl:items-end">
            <div className="flex flex-wrap gap-2">
              <div className="flex flex-wrap bg-[#020617] p-1 rounded-xl border border-slate-800">
                {RANGE_OPTIONS.map((option) => (
                  <button
                    key={option.mode}
                    onClick={() => setRangeMode(option.mode)}
                    className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
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
              <div className="flex flex-wrap items-end gap-2 p-3 bg-[#020617] border border-slate-800 rounded-xl">
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
                  className="px-3.5 py-2 bg-cyan-700 hover:bg-cyan-600 text-white rounded-lg text-xs font-semibold"
                >
                  Terapkan
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

      <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl p-4 flex flex-col md:flex-row gap-4 md:items-center justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari waktu, IP, atau device..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-[#020617] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <div className="flex bg-[#020617] p-1 rounded-xl border border-slate-800 text-xs">
            {(['all', 'normal', 'error'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => {
                  setFilterStatus(filter);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  filterStatus === filter
                    ? 'bg-cyan-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {filter === 'all' ? 'Semua' : filter === 'normal' ? 'Normal' : 'Fault'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#0f172a]/90 border border-slate-800/90 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#020617] text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Waktu Rekam</th>
                <th className="py-3.5 px-4">Perangkat</th>
                <th className="py-3.5 px-4">pH</th>
                <th className="py-3.5 px-4">DO mg/L</th>
                <th className="py-3.5 px-4">DO Sat.</th>
                <th className="py-3.5 px-4">Suhu</th>
                <th className="py-3.5 px-4">Modbus</th>
                <th className="py-3.5 px-4">WiFi</th>
                <th className="py-3.5 px-4">IP</th>
                <th className="py-3.5 px-4">PLTS</th>
                <th className="py-3.5 px-4">Baterai</th>
                <th className="py-3.5 px-4">Beban</th>
                <th className="py-3.5 px-4">PLN</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
              {currentItems.length > 0 ? (
                currentItems.map((item, index) => (
                  <tr
                    key={item._id || `${item.recordedAt || item.timestamp}-${index}`}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-sans text-slate-200 whitespace-nowrap">
                      {displayDate(item)}
                    </td>
                    <td className="py-3 px-4 text-cyan-300 font-semibold">
                      {item.device}
                    </td>
                    <td className="py-3 px-4">
                      {item.ph !== null && item.ph !== undefined
                        ? item.ph.toFixed(2)
                        : '--'}
                    </td>
                    <td className="py-3 px-4">
                      {item.do_mg_l !== null && item.do_mg_l !== undefined
                        ? item.do_mg_l.toFixed(2)
                        : '--'}
                    </td>
                    <td className="py-3 px-4">
                      {item.do_saturation_pct !== null &&
                      item.do_saturation_pct !== undefined
                        ? `${item.do_saturation_pct.toFixed(1)}%`
                        : '--'}
                    </td>
                    <td className="py-3 px-4 text-orange-300">
                      {item.water_temperature_c !== null &&
                      item.water_temperature_c !== undefined
                        ? `${item.water_temperature_c.toFixed(1)}°C`
                        : '--'}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.modbus_code === 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                            : 'bg-red-950 text-red-300 border border-red-800/80'
                        }`}
                      >
                        {item.modbus_code === 0 ? 'OK' : `Err ${item.modbus_code}`}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {item.wifi_rssi ?? '--'} dBm
                    </td>
                    <td className="py-3 px-4 text-slate-400">{item.ip || '--'}</td>
                    <td className="py-3 px-4 text-yellow-300 whitespace-nowrap">
                      {item.plts?.pvPowerW !== null && item.plts?.pvPowerW !== undefined
                        ? `${item.plts.pvPowerW.toFixed(1)} W`
                        : '--'}
                    </td>
                    <td className="py-3 px-4 text-emerald-300 whitespace-nowrap">
                      {item.plts?.batterySocPct !== null &&
                      item.plts?.batterySocPct !== undefined
                        ? `${item.plts.batterySocPct.toFixed(1)}%`
                        : '--'}
                    </td>
                    <td className="py-3 px-4 text-violet-300 whitespace-nowrap">
                      {item.plts?.loadPowerW !== null && item.plts?.loadPowerW !== undefined
                        ? `${item.plts.loadPowerW.toFixed(1)} W`
                        : '--'}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          item.plts?.isGridAvailable === true
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                            : item.plts?.isGridAvailable === false
                            ? 'bg-slate-900 text-slate-400 border border-slate-700'
                            : 'bg-slate-900 text-slate-500 border border-slate-800'
                        }`}
                      >
                        {item.plts?.isGridAvailable === true
                          ? 'TERSEDIA'
                          : item.plts?.isGridAvailable === false
                          ? 'OFF'
                          : '--'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={13}
                    className="py-10 text-center text-slate-500 font-sans"
                  >
                    {loading
                      ? 'Sedang memuat data MongoDB...'
                      : 'Belum ada data telemetri pada kriteria ini.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="bg-[#020617] p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Halaman <strong className="text-white">{page}</strong> dari{' '}
            <strong className="text-white">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="p-1.5 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              disabled={page >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="p-1.5 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
