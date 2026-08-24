import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine, 
  Legend 
} from 'recharts';
import { 
  Activity, 
  Download, 
  Droplet, 
  Wind, 
  Thermometer, 
  Sun, 
  Calendar,
  Layers
} from 'lucide-react';
import { TelemetryData, PltsSummary, ThresholdSettings } from '../types';

interface TelemetryChartsProps {
  history: TelemetryData[];
  pltsSummary: PltsSummary | null;
  thresholds: ThresholdSettings;
}

export const TelemetryCharts: React.FC<TelemetryChartsProps> = ({ history, pltsSummary, thresholds }) => {
  const [selectedRange, setSelectedRange] = useState<number>(30);
  const [chartType, setChartType] = useState<'all' | 'ph' | 'do' | 'temp' | 'solar'>('all');

  // Format data for chart display
  const slicedData = history.slice(-selectedRange);
  const chartData = slicedData.map((item, index) => {
    let timeLabel = item.timestamp;
    if (timeLabel && timeLabel.includes(' ')) {
      timeLabel = timeLabel.split(' ')[1];
    } else if (item.received_at) {
      timeLabel = new Date(item.received_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    return {
      index,
      time: timeLabel || `#${index + 1}`,
      ph: item.ph !== null ? Number(item.ph.toFixed(2)) : null,
      do: item.do_mg_l !== null ? Number(item.do_mg_l.toFixed(2)) : null,
      doSat: item.do_saturation_pct !== null ? Number(item.do_saturation_pct.toFixed(1)) : null,
      temp: item.water_temperature_c !== null ? Number(item.water_temperature_c.toFixed(1)) : null,
      pvPower: pltsSummary?.pvPowerW ?? 54.7,
      loadPower: pltsSummary?.loadPowerW ?? 167.0,
    };
  });

  // Export CSV handler
  const exportCsv = () => {
    if (history.length === 0) return;
    const headers = ['Timestamp', 'Device', 'pH', 'pH_mV', 'DO_mg_L', 'DO_Saturation_%', 'Temp_C', 'Modbus_Code', 'WiFi_RSSI', 'IP'];
    const rows = history.map(h => [
      `"${h.timestamp || h.received_at || ''}"`,
      `"${h.device}"`,
      h.ph ?? '',
      h.ph_mv ?? '',
      h.do_mg_l ?? '',
      h.do_saturation_pct ?? '',
      h.water_temperature_c ?? '',
      h.modbus_code ?? 0,
      h.wifi_rssi ?? '',
      `"${h.ip || ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `telemetri_kolam_nila_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Controls */}
      <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
              <Activity className="w-3.5 h-3.5" /> Analitik & Tren Telemetri
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Grafik Riwayat Kualitas Air Kolam Nila
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Data real-time disinkronkan dari broker MQTT EMQX & Dessmonitor PLTS Cloud ({history.length} titik tersimpan).
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {/* Range Selector */}
          <div className="flex bg-[#020617]/90 p-1 rounded-xl border border-slate-800/90 text-xs shadow-inner">
            {[
              { label: '15 Data', val: 15 },
              { label: '30 Data', val: 30 },
              { label: '100 Data', val: 100 },
              { label: 'Semua', val: 1000 },
            ].map(r => (
              <button
                key={r.val}
                onClick={() => setSelectedRange(r.val)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedRange === r.val
                    ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <button
            id="btn-export-csv"
            onClick={exportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-[#020617] hover:bg-slate-800 text-slate-200 rounded-xl text-xs font-semibold border border-slate-800 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-emerald-400" />
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Chart 1: pH Level Chart */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
              <Droplet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Tren Derajat Keasaman (pH)</h2>
              <span className="text-xs text-slate-400">Rentang ideal ikan nila: 6.50 – 8.50 pH</span>
            </div>
          </div>
          <span className="text-xs text-emerald-400 font-mono font-semibold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-800/80 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
            Optimal: 7.0 – 8.0
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
              <YAxis domain={[5.0, 9.5]} stroke="#64748b" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', boxShadow: '0 0 15px rgba(0,0,0,0.7)' }}
                labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
              />
              <ReferenceLine y={8.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Batas Max (8.5)', fill: '#ef4444', fontSize: 10 }} />
              <ReferenceLine y={6.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Batas Min (6.5)', fill: '#ef4444', fontSize: 10 }} />
              <ReferenceLine y={7.5} stroke="#10b981" strokeDasharray="2 2" />
              <Line 
                type="monotone" 
                dataKey="ph" 
                name="pH Air Kolam" 
                stroke="#06b6d4" 
                strokeWidth={3} 
                dot={{ r: 3, fill: '#06b6d4' }} 
                activeDot={{ r: 6 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 2: Dissolved Oxygen (DO) Chart */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.2)]">
              <Wind className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Tren Oksigen Terlarut (DO mg/L)</h2>
              <span className="text-xs text-slate-400">Target kelangsungan hidup nila: &gt; 5.0 mg/L (Kritis &lt; 3.0 mg/L)</span>
            </div>
          </div>
          <span className="text-xs text-blue-400 font-mono font-semibold bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-800/80 shadow-[0_0_8px_rgba(59,130,246,0.2)]">
            Aman: &gt; 5.0 mg/L
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
              <YAxis domain={[0, 12]} stroke="#64748b" fontSize={11} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', boxShadow: '0 0 15px rgba(0,0,0,0.7)' }}
                labelStyle={{ color: '#94a3b8', fontSize: '11px' }}
              />
              <ReferenceLine y={5.0} stroke="#10b981" strokeDasharray="3 3" label={{ value: 'Batas Ideal (5.0)', fill: '#10b981', fontSize: 10 }} />
              <ReferenceLine y={3.0} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Batas Kritis (3.0)', fill: '#ef4444', fontSize: 10 }} />
              <Area 
                type="monotone" 
                dataKey="do" 
                name="DO (mg/L)" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                fillOpacity={1} 
                fill="url(#colorDo)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Two Column Row: Temperature & Solar Power */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temperature Chart */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Thermometer className="w-5 h-5 text-orange-400" />
              <h2 className="text-base font-bold text-white">Suhu Air Kolam (°C)</h2>
            </div>
            <span className="text-xs text-orange-400 font-mono">Ideal: 25 - 30°C</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                <YAxis domain={[20, 36]} stroke="#64748b" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', boxShadow: '0 0 15px rgba(0,0,0,0.7)' }}
                />
                <ReferenceLine y={30} stroke="#f97316" strokeDasharray="3 3" />
                <ReferenceLine y={25} stroke="#f97316" strokeDasharray="3 3" />
                <Line 
                  type="monotone" 
                  dataKey="temp" 
                  name="Temperatur (°C)" 
                  stroke="#f97316" 
                  strokeWidth={2.5} 
                  dot={{ r: 2 }} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Solar vs Load Power Chart */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <Sun className="w-5 h-5 text-amber-400" />
              <h2 className="text-base font-bold text-white">Produksi Surya vs Beban Kolam (Watt)</h2>
            </div>
            <span className="text-xs text-amber-400 font-mono">PLTS Dessmonitor</span>
          </div>

          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 15, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#020617', borderColor: '#334155', borderRadius: '0.75rem', color: '#f8fafc', boxShadow: '0 0 15px rgba(0,0,0,0.7)' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', color: '#94a3b8' }} />
                <Line 
                  type="monotone" 
                  dataKey="pvPower" 
                  name="PV Power (Watt)" 
                  stroke="#f59e0b" 
                  strokeWidth={2.5} 
                />
                <Line 
                  type="monotone" 
                  dataKey="loadPower" 
                  name="Beban Aerator (Watt)" 
                  stroke="#38bdf8" 
                  strokeWidth={2} 
                  strokeDasharray="4 4" 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
