import React, { useState } from 'react';
import { 
  X, 
  Settings, 
  Radio, 
  SunMedium, 
  Volume2, 
  VolumeX, 
  Sliders, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  Save
} from 'lucide-react';
import { ThresholdSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  thresholds: ThresholdSettings;
  onSaveThresholds: (newThresholds: ThresholdSettings) => void;
  onReconnectMqtt: (broker: string, topic: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  thresholds,
  onSaveThresholds,
  onReconnectMqtt,
}) => {
  const [localThresholds, setLocalThresholds] = useState<ThresholdSettings>({ ...thresholds });
  const [brokerUrl, setBrokerUrl] = useState('mqtt://broker.emqx.io:1883');
  const [topic, setTopic] = useState('aquaculture/nila/data/nila-E0F908/telemetry');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveThresholds(localThresholds);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  const handleReconnect = () => {
    setIsReconnecting(true);
    onReconnectMqtt(brokerUrl, topic);
    setTimeout(() => {
      setIsReconnecting(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020617]/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl w-full max-w-lg p-6 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative overflow-hidden max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Pengaturan Sistem & Batas Kualitas Air</h2>
            <p className="text-xs text-slate-400">Kustomisasi Ambang Batas Sensor & Koneksi MQTT</p>
          </div>
        </div>

        {saveSuccess && (
          <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-800 rounded-xl text-xs text-emerald-300 flex items-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Pengaturan berhasil disimpan!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5 text-xs">
          
          {/* Section 1: Water Quality Thresholds */}
          <div className="bg-[#020617]/90 p-4 rounded-xl border border-slate-800/90 space-y-3 shadow-inner">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" /> Ambang Batas Kualitas Air Nila
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">pH Minimum Kritis</label>
                <input
                  type="number"
                  step="0.1"
                  value={localThresholds.phMin}
                  onChange={(e) => setLocalThresholds({ ...localThresholds, phMin: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-[#0f172a] border border-slate-700/80 rounded-lg text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">pH Maksimum Kritis</label>
                <input
                  type="number"
                  step="0.1"
                  value={localThresholds.phMax}
                  onChange={(e) => setLocalThresholds({ ...localThresholds, phMax: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-[#0f172a] border border-slate-700/80 rounded-lg text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">DO Minimum Kritis (mg/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={localThresholds.doMinWarning}
                  onChange={(e) => setLocalThresholds({ ...localThresholds, doMinWarning: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-[#0f172a] border border-slate-700/80 rounded-lg text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">DO Ideal Target (mg/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={localThresholds.doMinGood}
                  onChange={(e) => setLocalThresholds({ ...localThresholds, doMinGood: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-[#0f172a] border border-slate-700/80 rounded-lg text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Suhu Min Ideal (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={localThresholds.tempOptMin}
                  onChange={(e) => setLocalThresholds({ ...localThresholds, tempOptMin: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-[#0f172a] border border-slate-700/80 rounded-lg text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Suhu Max Ideal (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={localThresholds.tempOptMax}
                  onChange={(e) => setLocalThresholds({ ...localThresholds, tempOptMax: parseFloat(e.target.value) })}
                  className="w-full px-3 py-1.5 bg-[#0f172a] border border-slate-700/80 rounded-lg text-slate-200 font-mono focus:border-cyan-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
              <span className="text-slate-300">Notifikasi Alarm Audio Kritis:</span>
              <button
                type="button"
                onClick={() => setLocalThresholds({ ...localThresholds, enableAudioAlerts: !localThresholds.enableAudioAlerts })}
                className={`p-1.5 rounded-lg border flex items-center gap-1.5 ${
                  localThresholds.enableAudioAlerts 
                    ? 'bg-cyan-950 text-cyan-300 border-cyan-700 shadow-[0_0_10px_rgba(6,182,212,0.25)]' 
                    : 'bg-[#0f172a] text-slate-500 border-slate-800'
                }`}
              >
                {localThresholds.enableAudioAlerts ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                <span>{localThresholds.enableAudioAlerts ? 'Aktif' : 'Mute'}</span>
              </button>
            </div>
          </div>

          {/* Section 2: MQTT Broker Connection */}
          <div className="bg-[#020617]/90 p-4 rounded-xl border border-slate-800/90 space-y-3 shadow-inner">
            <h3 className="font-bold text-slate-200 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" /> Konfigurasi MQTT Broker
            </h3>

            <div>
              <label className="block text-slate-400 mb-1">Broker URI</label>
              <input
                type="text"
                value={brokerUrl}
                onChange={(e) => setBrokerUrl(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#0f172a] border border-slate-700/80 rounded-lg text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Topic Telemetri</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#0f172a] border border-slate-700/80 rounded-lg text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="w-full py-2 bg-[#0f172a] hover:bg-slate-800 text-cyan-400 rounded-lg font-semibold border border-slate-800 flex items-center justify-center gap-2 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
              {isReconnecting ? 'Menghubungkan Ulang...' : 'Hubungkan Ulang MQTT'}
            </button>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-[#020617] hover:bg-slate-800 text-slate-300 rounded-xl font-medium border border-slate-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.4)] flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              Simpan Pengaturan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
