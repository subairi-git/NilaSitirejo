import React, { useState } from 'react';
import { 
  X, 
  User as UserIcon, 
  ShieldCheck, 
  KeyRound, 
  Calendar, 
  LogOut, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';
import { User } from '../types';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
  onLogout: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onLogout,
}) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || !user) return null;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChangingPass(true);
    setMsg(null);

    try {
      const token = localStorage.getItem('nilasense_token') || user.token;
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ oldPassword, newPassword })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMsg({ type: 'success', text: 'Password berhasil diperbarui!' });
        setOldPassword('');
        setNewPassword('');
      } else {
        setMsg({ type: 'error', text: data.error || 'Gagal mengubah password' });
      }
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Error koneksi' });
    } finally {
      setIsChangingPass(false);
    }
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

        {/* Title */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-xl shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">{user.name}</h2>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
        </div>

        {/* User Details */}
        <div className="bg-[#020617]/90 p-3.5 rounded-xl border border-slate-800/90 space-y-2 mb-5 text-xs shadow-inner">
          <div className="flex justify-between items-center py-1 border-b border-slate-800/80">
            <span className="text-slate-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Peran Akun:
            </span>
            <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 font-bold uppercase tracking-wider text-[10px] border border-cyan-800 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
              {user.role}
            </span>
          </div>

          <div className="flex justify-between items-center py-1">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-400" /> Terdaftar Sejak:
            </span>
            <span className="text-slate-300 font-mono">
              {new Date(user.createdAt || Date.now()).toLocaleDateString('id-ID')}
            </span>
          </div>
        </div>

        {/* Change Password Section */}
        <div className="border-t border-slate-800/80 pt-4">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-cyan-400" /> Ubah Kata Sandi
          </h3>

          {msg && (
            <div className={`mb-3 p-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm ${
              msg.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'bg-red-950/80 text-red-300 border border-red-800'
            }`}>
              {msg.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
              <span>{msg.text}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Password Lama</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#020617] border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Password Baru</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-1.5 bg-[#020617] border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={isChangingPass}
              className="w-full py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl shadow-[0_0_15px_rgba(6,182,212,0.3)] transition-all"
            >
              {isChangingPass ? 'Menyimpan...' : 'Simpan Password Baru'}
            </button>
          </form>
        </div>

        {/* Logout Button */}
        <div className="mt-5 pt-4 border-t border-slate-800/80">
          <button
            onClick={() => {
              onLogout();
              onClose();
            }}
            className="w-full py-2.5 bg-red-950/40 hover:bg-red-600 hover:text-white text-red-300 text-xs font-bold rounded-xl border border-red-800/80 transition-all flex items-center justify-center gap-2 shadow-[0_0_10px_rgba(239,68,68,0.15)]"
          >
            <LogOut className="w-4 h-4" />
            Keluar dari Akun (Logout)
          </button>
        </div>
      </div>
    </div>
  );
};
