import React from 'react';
import { 
  Fish, 
  SunMedium, 
  Activity, 
  Cpu, 
  Terminal, 
  FileSpreadsheet, 
  BookOpen, 
  Wifi, 
  Radio, 
  User as UserIcon, 
  LogIn, 
  LogOut, 
  Settings, 
  Sparkles,
  Zap,
  Calculator,
  Wrench
} from 'lucide-react';
import { TelemetryData, PltsSummary, User } from '../types';

const GearWrenchIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <span className="relative inline-flex items-center justify-center shrink-0">
    <Settings className={className} />
    <Wrench className="w-[60%] h-[60%] absolute -bottom-0.5 -right-0.5 text-cyan-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]" />
  </span>
);

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  telemetry: TelemetryData | null;
  pltsSummary: PltsSummary | null;
  mqttStatus: { connected: boolean; broker?: string; topic?: string };
  user: User | null;
  onOpenLogin: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
  simulationActive: boolean;
  onToggleSimulation: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  telemetry,
  pltsSummary,
  mqttStatus,
  user,
  onOpenLogin,
  onOpenProfile,
  onOpenSettings,
  onLogout,
  simulationActive,
  onToggleSimulation,
}) => {
  const navItems = [
    { id: 'overview', label: 'Monitoring Kolam', icon: Fish },
    { id: 'hpp', label: 'Kalkulator HPP & Pakan', icon: Calculator },
    { id: 'plts', label: 'Dashboard PLTS', icon: SunMedium },
    { id: 'charts', label: 'Grafik & Riwayat', icon: Activity },
    { id: 'diagnostics', label: 'Diagnostik Sensor', icon: Cpu },
    { id: 'control', label: 'Kontrol & Kalibrasi', icon: GearWrenchIcon },
    { id: 'logs', label: 'Data Log', icon: FileSpreadsheet },
    { id: 'guide', label: 'Panduan Nila', icon: BookOpen },
  ];

  return (
    <header className="bg-[#0f172a]/85 backdrop-blur-xl border-b border-slate-800/80 text-white sticky top-0 z-30 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)]">
      {/* Top Banner: Status Indicators & Credentials info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between py-2 border-b border-slate-800/60 text-xs text-slate-400 gap-2">
          <div className="flex items-center flex-wrap gap-3">
            {/* MQTT status pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#020617]/90 border border-slate-800/90 shadow-sm">
              <span className={`w-2 h-2 rounded-full ${mqttStatus.connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse' : 'bg-red-400'}`} />
              <span className="font-medium text-slate-300">MQTT Broker:</span>
              <span className="text-slate-400">broker.emqx.io:1883</span>
              {mqttStatus.connected && <span className="text-emerald-400 font-semibold ml-1">Live</span>}
            </div>

            {/* Device ID pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#020617]/90 border border-slate-800/90 shadow-sm">
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium text-slate-300">Device:</span>
              <span className="text-cyan-300 font-mono font-semibold">{telemetry?.device || 'nila-E0F908'}</span>
              <span className="text-slate-500">({telemetry?.ip || '192.168.18.187'})</span>
            </div>

            {/* PLTS Status pill */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#020617]/90 border border-slate-800/90 shadow-sm">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium text-slate-300">PLTS Solar:</span>
              <span className="text-amber-300 font-semibold">{pltsSummary?.pvPowerW || 54.7} W</span>
              <span className="text-slate-500">| Bat: {pltsSummary?.batterySocPct || 80}%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Simulation toggle */}
            <button
              id="btn-toggle-sim"
              onClick={onToggleSimulation}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                simulationActive
                  ? 'bg-indigo-600/90 text-white shadow-[0_0_12px_rgba(99,102,241,0.5)] ring-1 ring-indigo-400'
                  : 'bg-[#020617] text-slate-300 hover:bg-slate-800 border border-slate-800'
              }`}
              title="Aktifkan simulasi variasi parameter telemetri"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              {simulationActive ? 'Mode Demo Aktif' : 'Simulasi Data'}
            </button>

            {/* User Account / Auth button */}
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  id="btn-user-profile"
                  onClick={onOpenProfile}
                  className="flex items-center gap-1.5 px-3 py-1 bg-[#020617] hover:bg-slate-800 rounded-lg border border-slate-800 text-slate-200 transition-colors"
                >
                  <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="font-medium">{user.name}</span>
                  <span className="px-1.5 py-0.2 bg-cyan-950/80 text-cyan-300 rounded text-[10px] uppercase font-bold border border-cyan-800/80">
                    {user.role}
                  </span>
                </button>
                <button
                  id="btn-logout"
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Keluar"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                id="btn-open-login"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-medium text-xs shadow-[0_0_12px_rgba(6,182,212,0.35)] transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                Login Akun
              </button>
            )}

            <button
              id="btn-open-settings"
              onClick={onOpenSettings}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
              title="Pengaturan Batas & Topik"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main Navbar Bar */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.4)] ring-1 ring-white/20">
              <Fish className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                  NilaSense IoT
                </span>
                <span className="bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 shadow-[0_0_8px_rgba(52,211,153,0.2)]">
                  v2.0 Telemetry
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Smart Aquaculture & PLTS Energy Monitoring System
              </p>
            </div>
          </div>

          {/* Navigation Tabs (Desktop) */}
          <nav className="hidden lg:flex items-center space-x-1 bg-[#020617]/90 p-1.5 rounded-xl border border-slate-800/90 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-tab-${item.id}`}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.45)]'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Mobile Navigation Scrollbar */}
        <div className="lg:hidden flex items-center space-x-1 overflow-x-auto pb-2.5 pt-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`nav-mobile-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(6,182,212,0.4)]'
                    : 'bg-[#020617] text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
