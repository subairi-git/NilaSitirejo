import React from 'react';
import { 
  BookOpen, 
  Fish, 
  Droplet, 
  Wind, 
  Thermometer, 
  Sun, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck,
  Zap,
  Layers
} from 'lucide-react';

export const TilapiaGuideModal: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#0f172a]/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.5)]">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 flex items-center gap-1.5 shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <BookOpen className="w-3.5 h-3.5" /> Standar Budidaya SNI & FAO
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Panduan Manajemen Kualitas Air Budidaya Ikan Nila (Oreochromis niloticus)
        </h1>
        <p className="text-sm text-slate-300 max-w-3xl mt-1">
          Rujukan teknis parameter fisika-kimia air kolam dan integrasi sistem aerasi berbasis tenaga surya untuk memaksimalkan survival rate (SR) dan efisiensi pakan (FCR).
        </p>
      </div>

      {/* Main Parameters Table Card */}
      <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
            <Fish className="w-4 h-4" />
          </div>
          <h2 className="text-base font-bold text-white">Tabel Batas Toleransi & Kondisi Optimal Ikan Nila</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-[#020617] text-slate-400 uppercase font-semibold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Parameter Kualitas Air</th>
                <th className="py-3 px-4">Rentang Optimal (Ideal)</th>
                <th className="py-3 px-4">Batas Toleransi (Waspada)</th>
                <th className="py-3 px-4">Kondisi Kritis (Bahaya)</th>
                <th className="py-3 px-4">Dampak Terhadap Ikan Nila</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 font-sans">
              <tr className="hover:bg-slate-800/40">
                <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                  <Droplet className="w-4 h-4 text-cyan-400" /> Derajat Keasaman (pH)
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">7.0 – 8.0 pH</td>
                <td className="py-3.5 px-4 text-amber-300">6.5 – 7.0 atau 8.0 – 8.5</td>
                <td className="py-3.5 px-4 text-red-400 font-bold">&lt; 6.0 atau &gt; 9.0</td>
                <td className="py-3.5 px-4 text-slate-400">
                  pH asam merusak insang dan nafsu makan drop. pH basa tinggi memicu keracunan amonia bebas (NH3).
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                  <Wind className="w-4 h-4 text-blue-400" /> Oksigen Terlarut (DO)
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">&gt; 5.0 mg/L</td>
                <td className="py-3.5 px-4 text-amber-300">3.0 – 5.0 mg/L</td>
                <td className="py-3.5 px-4 text-red-400 font-bold">&lt; 3.0 mg/L</td>
                <td className="py-3.5 px-4 text-slate-400">
                  DO rendah menyebabkan asfiksia (ikan megap-megap di permukaan), kematian massal pada dini hari.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-orange-400" /> Suhu Air Kolam
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">26.0 – 30.0 °C</td>
                <td className="py-3.5 px-4 text-amber-300">22.0 – 25.0 °C</td>
                <td className="py-3.5 px-4 text-red-400 font-bold">&lt; 20 °C atau &gt; 35 °C</td>
                <td className="py-3.5 px-4 text-slate-400">
                  Suhu memengaruhi laju metabolisme enzim pencernaan. Di bawah 22°C pakan tidak terserap maksimal.
                </td>
              </tr>

              <tr className="hover:bg-slate-800/40">
                <td className="py-3.5 px-4 font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" /> Salinitas
                </td>
                <td className="py-3.5 px-4 text-emerald-400 font-bold">0 – 5 ppt</td>
                <td className="py-3.5 px-4 text-amber-300">5 – 15 ppt</td>
                <td className="py-3.5 px-4 text-red-400 font-bold">&gt; 25 ppt (tanpa aklimatisasi)</td>
                <td className="py-3.5 px-4 text-slate-400">
                  Nila adalah euryhaline, namun kolam air tawar standar beroperasi pada 0-2 ppt untuk efisiensi energi osmoregulasi.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Guide Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Card: Manajemen Aerasi & PLTS */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/30 shadow-[0_0_8px_rgba(245,158,11,0.2)]">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Manajemen Aerasi Cerdas dengan PLTS</h2>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Siang Hari (09:00 - 16:00):</strong> Panel surya mengisi daya baterai lithium sambil menggerakkan kincir aerator dengan surplus daya. DO air kolam terbantu oleh proses fotosintesis alga.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Malam Hari (22:00 - 06:00):</strong> Seluruh organisme kolam berespirasi menyerap oksigen. Baterai PLTS LiFePO4 otomatis menyuplai aerator untuk menjaga DO tetap di atas 5.0 mg/L.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong>Efisiensi Biaya:</strong> Memangkas ketergantungan listrik PLN hingga 70-85% dan memastikan ikan tidak mati lemas ketika terjadi pemadaman listrik PLN mendadak.
              </span>
            </li>
          </ul>
        </div>

        {/* Card: Panduan Pakan */}
        <div className="bg-[#0f172a]/90 backdrop-blur-md border border-slate-800/90 rounded-2xl p-6 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.5)] space-y-3">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/30 shadow-[0_0_8px_rgba(6,182,212,0.2)]">
              <Fish className="w-4 h-4" />
            </div>
            <h2 className="text-base font-bold text-white">Protokol Pemberian Pakan (Feeding Strategy)</h2>
          </div>
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong>Kadar Protein Pelet:</strong> 28% – 32% untuk fase pembesaran, dan 35% – 38% untuk fase benih (fingerling).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong>Frekuensi Makan:</strong> 2 – 3 kali sehari (08:30, 13:00, 16:30). Jangan memberi makan saat DO di bawah 3.5 mg/L atau suhu di bawah 23°C karena pakan tidak dicerna dan mencemari air kolam.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong>Sampling & FCR Target:</strong> Lakukan penimbangan berkala tiap 2 minggu dengan target rasio konversi pakan (FCR) berkisar antara 1.1 hingga 1.3.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
