import React, { useState } from 'react';
import { 
  X, 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  Lock, 
  Mail, 
  User as UserIcon, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  KeyRound
} from 'lucide-react';
import { User } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User, token: string) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, onLoginSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'admin' | 'operator' | 'viewer'>('operator');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister ? { name, email, password, role } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem('nilasense_token', data.token);
        localStorage.setItem('nilasense_user', JSON.stringify(data.user));
        onLoginSuccess({ ...data.user, token: data.token }, data.token);
        onClose();
      } else {
        setErrorMsg(data.error || 'Autentikasi gagal');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menghubungi server');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setIsRegister(false);
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#020617]/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#0f172a]/95 backdrop-blur-xl border border-slate-800/90 rounded-2xl w-full max-w-md p-6 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title & Icon */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {isRegister ? 'Pendaftaran Akun Baru' : 'Login NilaSense IoT'}
            </h2>
            <p className="text-xs text-slate-400">
              Sistem Autentikasi Pengelola Kolam & PLTS
            </p>
          </div>
        </div>

        {/* Demo One-Click Login Helper Box (For Evaluator & Publish convenience) */}
        {!isRegister && (
          <div className="mb-5 bg-[#020617]/90 border border-cyan-900/60 rounded-xl p-3.5 space-y-2.5 shadow-inner">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-cyan-300 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" /> Akun Siap Pakai (Publish / Demo):
              </span>
              <span className="text-slate-500 text-[10px]">Klik untuk isi otomatis</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@nila-iot.id', 'admin123')}
                className="p-2 rounded-lg bg-[#0f172a] hover:bg-cyan-950/80 border border-slate-800 hover:border-cyan-700/80 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-cyan-300 flex items-center justify-between">
                  <span>Administrator</span>
                  <span className="text-[9px] px-1 py-0.2 bg-cyan-950 text-cyan-300 rounded font-bold border border-cyan-800/60">Admin</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">admin@nila-iot.id</div>
                <div className="text-[10px] text-slate-500">Pass: admin123</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('operator@nila-iot.id', 'operator123')}
                className="p-2 rounded-lg bg-[#0f172a] hover:bg-cyan-950/80 border border-slate-800 hover:border-cyan-700/80 text-left transition-all group"
              >
                <div className="text-[11px] font-bold text-white group-hover:text-cyan-300 flex items-center justify-between">
                  <span>Teknisi Kolam</span>
                  <span className="text-[9px] px-1 py-0.2 bg-emerald-950 text-emerald-300 rounded font-bold border border-emerald-800/60">Operator</span>
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">operator@nila-iot.id</div>
                <div className="text-[10px] text-slate-500">Pass: operator123</div>
              </button>
            </div>
          </div>
        )}

        {/* Error / Success Alert */}
        {errorMsg && (
          <div className="mb-4 p-3 bg-red-950/80 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nama Lengkap</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-[#020617] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Pengguna</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                placeholder="nama@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#020617] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Kata Sandi (Password)</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="Minimal 6 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-[#020617] border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Hak Akses / Peran</label>
              <select
                value={role}
                onChange={(e: any) => setRole(e.target.value)}
                className="w-full px-3 py-2 bg-[#020617] border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-medium"
              >
                <option value="operator">Operator Kolam (Monitoring & Kontrol)</option>
                <option value="admin">Administrator (Akses Penuh)</option>
                <option value="viewer">Viewer / Peneliti (Hanya Lihat)</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-[0_0_15px_rgba(6,182,212,0.35)] transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <span>Memproses...</span>
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                Daftar Akun Baru
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Masuk ke Dashboard
              </>
            )}
          </button>
        </form>

        {/* Footer Toggle */}
        <div className="mt-5 text-center text-xs text-slate-400 border-t border-slate-800/80 pt-4">
          {isRegister ? (
            <span>
              Sudah punya akun?{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(false); setErrorMsg(null); }}
                className="text-cyan-400 font-bold hover:underline"
              >
                Login Sekarang
              </button>
            </span>
          ) : (
            <span>
              Belum memiliki akun?{' '}
              <button
                type="button"
                onClick={() => { setIsRegister(true); setErrorMsg(null); }}
                className="text-cyan-400 font-bold hover:underline"
              >
                Buat Akun Baru
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
