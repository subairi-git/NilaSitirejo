import React, { useState } from 'react';
import { 
  FileSpreadsheet, 
  Search, 
  Download, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  Cpu, 
  Layers,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { TelemetryData } from '../types';

interface TelemetryHistoryTableProps {
  history: TelemetryData[];
}

export const TelemetryHistoryTable: React.FC<TelemetryHistoryTableProps> = ({ history }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'normal' | 'error'>('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  const filteredHistory = history.filter(item => {
    const matchesSearch = 
      item.device.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.timestamp && item.timestamp.includes(searchTerm)) ||
      (item.ip && item.ip.includes(searchTerm));
    
    if (filterStatus === 'error') {
      return matchesSearch && (!item.do_ok || item.modbus_code !== 0);
    }
    if (filterStatus === 'normal') {
      return matchesSearch && item.do_ok && item.modbus_code === 0;
    }
    return matchesSearch;
  });

  const totalPages = Math.ceil(filteredHistory.length / itemsPerPage) || 1;
  const currentItems = filteredHistory.slice().reverse().slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const exportCsv = () => {
    if (filteredHistory.length === 0) return;
    const headers = ['Timestamp', 'Device', 'pH', 'pH_mV', 'DO_mg_L', 'DO_Sat_%', 'Temp_C', 'DO_OK', 'Modbus_Code', 'WiFi_RSSI', 'IP_Station', 'AP_IP'];
    const rows = filteredHistory.map(h => [
      `"${h.timestamp || h.received_at || ''}"`,
      `"${h.device}"`,
      h.ph ?? '',
      h.ph_mv ?? '',
      h.do_mg_l ?? '',
      h.do_saturation_pct ?? '',
      h.water_temperature_c ?? '',
      h.do_ok ? 'TRUE' : 'FALSE',
      h.modbus_code ?? 0,
      h.wifi_rssi ?? '',
      `"${h.ip || ''}"`,
      `"${h.ap_ip || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `data_telemetri_nila_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Database Log Telemetri
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Riwayat Log Data Sensor Kolam Nila
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Menampilkan {filteredHistory.length} catatan telemetri MQTT broker.emqx.io.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all"
          >
            <Download className="w-4 h-4" />
            Download Log CSV
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-4 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari timestamp, IP, atau device..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-[#020617] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">Filter:</span>
          <div className="flex bg-[#020617] p-1 rounded-xl border border-slate-800 text-xs shadow-inner">
            {(['all', 'normal', 'error'] as const).map(f => (
              <button
                key={f}
                onClick={() => { setFilterStatus(f); setPage(1); }}
                className={`px-3 py-1 rounded-lg font-medium capitalize transition-all ${
                  filterStatus === f
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {f === 'all' ? 'Semua' : f === 'normal' ? 'Normal' : 'Fault/E226'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#020617] text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Waktu (Timestamp)</th>
                <th className="py-3.5 px-4">Perangkat</th>
                <th className="py-3.5 px-4">pH Air</th>
                <th className="py-3.5 px-4">pH (mV)</th>
                <th className="py-3.5 px-4">DO (mg/L)</th>
                <th className="py-3.5 px-4">DO Sat (%)</th>
                <th className="py-3.5 px-4">Suhu (°C)</th>
                <th className="py-3.5 px-4">Modbus</th>
                <th className="py-3.5 px-4">WiFi RSSI</th>
                <th className="py-3.5 px-4">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
              {currentItems.length > 0 ? (
                currentItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-sans text-slate-200">{item.timestamp || item.received_at}</td>
                    <td className="py-3 px-4 text-cyan-300 font-semibold">{item.device}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        (item.ph ?? 7) >= 6.5 && (item.ph ?? 7) <= 8.5 ? 'text-emerald-400 bg-emerald-950/40' : 'text-red-400 bg-red-950/40'
                      }`}>
                        {item.ph !== null && item.ph !== undefined ? item.ph.toFixed(2) : '--'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{item.ph_mv ?? '--'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded font-bold ${
                        (item.do_mg_l ?? 0) >= 5.0 ? 'text-blue-400 bg-blue-950/40' : 'text-amber-400 bg-amber-950/40'
                      }`}>
                        {item.do_mg_l !== null && item.do_mg_l !== undefined ? item.do_mg_l.toFixed(2) : '--'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{item.do_saturation_pct !== null && item.do_saturation_pct !== undefined ? `${item.do_saturation_pct.toFixed(1)}%` : '--'}</td>
                    <td className="py-3 px-4 text-orange-300">{item.water_temperature_c !== null && item.water_temperature_c !== undefined ? `${item.water_temperature_c.toFixed(1)}°C` : '--'}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        item.modbus_code === 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80' : 'bg-red-950 text-red-300 border border-red-800/80'
                      }`}>
                        {item.modbus_code === 0 ? 'OK (0)' : `Err (${item.modbus_code})`}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300">{item.wifi_rssi} dBm</td>
                    <td className="py-3 px-4 text-slate-400">{item.ip}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500 font-sans">
                    Tidak ada data telemetri yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="bg-[#020617] p-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            Menampilkan halaman <strong className="text-white">{page}</strong> dari <strong className="text-white">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-800 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-40 text-slate-300 rounded-lg border border-slate-800 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
