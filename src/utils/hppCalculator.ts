import { HppCycleConfig, HppCalculationResult, DailyAquacultureLog } from '../types';

export const defaultHppConfig: HppCycleConfig = {
  id: 'cycle-nila-sitirejo-01',
  cycleName: 'Siklus Pembesaran Nila Hitam & Merah (Bioflok PLTS)',
  pondName: 'Kolam Bioflok Terpal D-4 (Sitirejo)',
  pondVolumeM3: 15.0, // Diameter 4m, kedalaman 1.2m
  startDate: '2026-05-15',
  durationDays: 100, // 100 hari (3.3 bulan)
  
  // Bibit Ikan Nila
  seedCount: 5000, // 5.000 ekor benih
  seedPricePerUnit: 450, // Rp 450 per ekor (ukuran 5-7 cm)
  seedSizeCm: '5-7 cm',
  survivalRatePct: 90.0, // Survival Rate 90% (4.500 ekor panen)
  targetHarvestAbwGram: 333.3, // Rata-rata 333g (isi 3 ekor / kg)
  
  // Pakan Ikan
  feedPriceAvgPerKg: 13500, // Rp 13.500 / kg (kombinasi starter + grower 781)
  targetFcr: 1.15, // FCR efisien dengan bioflok & probiotik
  actualFeedTotalKg: 1725, // 1.725 kg pakan untuk 1.500 kg panen
  
  // Listrik & PLTS Surya Mandiri
  plnTariffPerKwh: 1444.70, // Tarif Listrik PLN Golongan R-1/TR (Rp 1.444,70 / kWh)
  dailyKwhUsage: 8.5, // Aerator kincir 250W x 2 + Pompa 100W running 24 jam = ~8.4 kWh/hari
  pltsSolarPortionPct: 70.0, // 70% energi dipasok PLTS NilaSense, 30% grid PLN
  
  // Vitamin, Probiotik, Kimia Air
  probioticsBudget: 450000, // EM4 Perikanan / Bacillus subtilis (fermentasi)
  vitaminsBudget: 350000, // Vitamin C & Multivitamin pakan
  molassesBudget: 250000, // Molase / Tetes tebu karbon bioflok
  dolomiteSaltBudget: 300000, // Kapur dolomit & garam krosok desinfeksi
  
  // Tenaga Kerja & Operasional
  laborCostPerCycle: 1500000, // Rp 1.500.000 per siklus (3 bulan perawatan paruh waktu)
  waterElectricityMaintenance: 400000, // Pengisian sumur bor & servis aerator
  
  // Penyusutan Aset (Depresiasi per siklus)
  pondDepreciationPerCycle: 600000, // Kolam terpal rangka pipa galvanis (umur 3 tahun / 9 siklus)
  aeratorEquipmentDepreciation: 500000, // Aerator, inverter PLTS, baterai, sensor IoT (umur 4-5 tahun)
  otherContingencyCost: 350000, // Biaya tak terduga / cadangan darurat (3%)
  
  // Penjualan
  expectedSellingPricePerKg: 32000, // Harga jual pasar Rp 32.000 / kg ikan hidup segar
};

export function calculateHpp(config: HppCycleConfig, dailyLogs?: DailyAquacultureLog[]): HppCalculationResult {
  // Calculate total feed from daily logs if available and valid
  let totalFeedKg = config.actualFeedTotalKg ?? (config.seedCount * (config.survivalRatePct / 100) * (config.targetHarvestAbwGram / 1000) * config.targetFcr);
  if (dailyLogs && dailyLogs.length > 0) {
    const sumFeedLogs = dailyLogs.reduce((acc, l) => acc + (l.feedTotalKg || 0), 0);
    if (sumFeedLogs > 0) {
      totalFeedKg = sumFeedLogs;
    }
  }

  // 1. Biaya Bibit
  const totalSeedCost = config.seedCount * config.seedPricePerUnit;

  // 2. Biaya Pakan
  const totalFeedCost = totalFeedKg * config.feedPriceAvgPerKg;

  // 3. Biaya Listrik (PLTS vs PLN)
  const totalKwhCycle = config.dailyKwhUsage * config.durationDays;
  const pltsSolarKwh = totalKwhCycle * (config.pltsSolarPortionPct / 100);
  const plnGridKwh = totalKwhCycle * (1 - (config.pltsSolarPortionPct / 100));

  const totalElectricityPlnCost = plnGridKwh * config.plnTariffPerKwh;
  const totalElectricityWithoutPlts = totalKwhCycle * config.plnTariffPerKwh;
  const pltsSavingsRupiah = pltsSolarKwh * config.plnTariffPerKwh;

  // 4. Biaya Vitamin & Kimia Air
  const totalSupplementsCost =
    config.probioticsBudget +
    config.vitaminsBudget +
    config.molassesBudget +
    config.dolomiteSaltBudget;

  // 5. Tenaga Kerja
  const totalLaborCost = config.laborCostPerCycle;

  // 6. Air & Perawatan
  const totalMaintenanceCost = config.waterElectricityMaintenance;

  // 7. Penyusutan Aset
  const totalDepreciationCost =
    config.pondDepreciationPerCycle +
    config.aeratorEquipmentDepreciation;

  // 8. Biaya Tak Terduga (Contingency)
  const totalContingencyCost = config.otherContingencyCost;

  // Total Biaya Produksi (HPP Total Siklus)
  const totalProductionCost =
    totalSeedCost +
    totalFeedCost +
    totalElectricityPlnCost +
    totalSupplementsCost +
    totalLaborCost +
    totalMaintenanceCost +
    totalDepreciationCost +
    totalContingencyCost;

  // Metrik Produksi Ikan
  const totalHarvestFishCount = Math.round(config.seedCount * (config.survivalRatePct / 100));
  const totalHarvestWeightKg = (totalHarvestFishCount * config.targetHarvestAbwGram) / 1000;

  const hppPerKg = totalHarvestWeightKg > 0 ? totalProductionCost / totalHarvestWeightKg : 0;
  const hppPerFish = totalHarvestFishCount > 0 ? totalProductionCost / totalHarvestFishCount : 0;
  const fcr = totalHarvestWeightKg > 0 ? totalFeedKg / totalHarvestWeightKg : config.targetFcr;

  // Pendapatan & Profitabilitas
  const totalRevenue = totalHarvestWeightKg * config.expectedSellingPricePerKg;
  const netProfit = totalRevenue - totalProductionCost;
  const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  const bepKg = config.expectedSellingPricePerKg > 0 ? totalProductionCost / config.expectedSellingPricePerKg : 0;
  const bepRupiah = totalProductionCost;
  const roiPct = totalProductionCost > 0 ? (netProfit / totalProductionCost) * 100 : 0;

  // Breakdown Komposisi Biaya
  const rawBreakdown = [
    { name: 'Pakan Ikan', category: 'Pakan', amount: totalFeedCost, color: '#38bdf8' },
    { name: 'Bibit Ikan', category: 'Bibit', amount: totalSeedCost, color: '#34d399' },
    { name: 'Tenaga Kerja', category: 'Operasional', amount: totalLaborCost, color: '#a78bfa' },
    { name: 'Penyusutan Alat & Kolam', category: 'Investasi', amount: totalDepreciationCost, color: '#fbbf24' },
    { name: 'Vitamin & Probiotik', category: 'Kimia & Suplemen', amount: totalSupplementsCost, color: '#f472b6' },
    { name: 'Air & Maintenance', category: 'Operasional', amount: totalMaintenanceCost, color: '#60a5fa' },
    { name: 'Biaya Tak Terduga', category: 'Cadangan', amount: totalContingencyCost, color: '#94a3b8' },
    { name: 'Listrik PLN (Sisa non-PLTS)', category: 'Energi', amount: totalElectricityPlnCost, color: '#f87171' },
  ];

  const costBreakdown = rawBreakdown.map((item) => ({
    ...item,
    percentage: totalProductionCost > 0 ? (item.amount / totalProductionCost) * 100 : 0,
  }));

  return {
    totalSeedCost,
    totalFeedCost,
    totalElectricityPlnCost,
    totalElectricityWithoutPlts,
    pltsSavingsRupiah,
    totalSupplementsCost,
    totalLaborCost,
    totalMaintenanceCost,
    totalDepreciationCost,
    totalContingencyCost,
    totalProductionCost,
    totalHarvestFishCount,
    totalHarvestWeightKg,
    hppPerKg,
    hppPerFish,
    fcr,
    totalRevenue,
    netProfit,
    profitMarginPct,
    bepKg,
    bepRupiah,
    roiPct,
    costBreakdown,
  };
}

export function formatRupiah(num: number): string {
  return 'Rp ' + Math.round(num).toLocaleString('id-ID');
}

export function formatNumber(num: number, decimals: number = 1): string {
  return Number(num || 0).toLocaleString('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Generate standard initial daily aquaculture logs (sample for 20 recent days across culture)
export function generateSampleDailyLogs(): DailyAquacultureLog[] {
  const logs: DailyAquacultureLog[] = [];
  const baseDate = new Date('2026-05-15');

  // Sample data points across 20 representative culture days
  const samplePoints = [
    { doc: 1, morning: 1.5, afternoon: 1.5, evening: 1.0, type: 'PF-1000 (Larva)', abw: 5.0, mort: 15, note: 'Tebar benih 5.000 ekor. Aklimatisasi suhu 28.5°C.' },
    { doc: 3, morning: 2.0, afternoon: 2.0, evening: 1.5, type: 'PF-1000 (Larva)', abw: 7.5, mort: 8, note: 'Pemberian probiotik EM4 50ml + Molase 100ml.' },
    { doc: 7, morning: 3.0, afternoon: 3.0, evening: 2.0, type: 'PF-1000 (Larva)', abw: 12.0, mort: 5, note: 'Aerator kincir aktif bertenaga PLTS.' },
    { doc: 14, morning: 4.5, afternoon: 4.5, evening: 3.0, type: '781-1 (Starter)', abw: 22.0, mort: 4, note: 'Transisi pakan pelet 1mm. Penambahan garam 5kg.' },
    { doc: 21, morning: 6.0, afternoon: 6.0, evening: 4.0, type: '781-1 (Starter)', abw: 38.0, mort: 3, note: 'Floc terbentuk baik. Cek DO 5.8 mg/L.' },
    { doc: 28, morning: 8.0, afternoon: 8.0, evening: 5.0, type: '781-1 (Starter)', abw: 58.0, mort: 2, note: 'Sampling bobot 58g/ekor. Nafsu makan agresif.' },
    { doc: 35, morning: 10.0, afternoon: 10.0, evening: 6.0, type: '781-2 (Grower)', abw: 82.0, mort: 2, note: 'Ganti ke pakan pelet 2mm protein 32%.' },
    { doc: 42, morning: 12.0, afternoon: 12.0, evening: 8.0, type: '781-2 (Grower)', abw: 110.0, mort: 1, note: 'Penambahan dolomit 2kg untuk jaga pH 7.6.' },
    { doc: 50, morning: 14.0, afternoon: 14.0, evening: 9.0, type: '781-2 (Grower)', abw: 145.0, mort: 1, note: 'Pembersihan central drain & buang endapan flok.' },
    { doc: 58, morning: 16.0, afternoon: 16.0, evening: 10.0, type: '781-2 (Grower)', abw: 180.0, mort: 0, note: 'Cuaca terik, solar PV surplus 100% suplai aerator.' },
    { doc: 65, morning: 18.0, afternoon: 18.0, evening: 12.0, type: '781 (Grower)', abw: 215.0, mort: 2, note: 'Sampling ABW 215g (isi ~4.6 ekor/kg).' },
    { doc: 72, morning: 20.0, afternoon: 20.0, evening: 13.0, type: '781 (Finisher)', abw: 250.0, mort: 1, note: 'Suplementasi Vitamin C 20g campur pakan.' },
    { doc: 80, morning: 22.0, afternoon: 22.0, evening: 14.0, type: '781 (Finisher)', abw: 285.0, mort: 0, note: 'Kondisi air optimal: DO 6.2 mg/L, pH 7.8.' },
    { doc: 88, morning: 24.0, afternoon: 24.0, evening: 15.0, type: '781 (Finisher)', abw: 310.0, mort: 1, note: 'Persiapan sortir ukuran pasar.' },
    { doc: 95, morning: 25.0, afternoon: 25.0, evening: 15.0, type: '781 (Finisher)', abw: 328.0, mort: 0, note: 'Pemberian pakan finishing protein 28%.' },
    { doc: 100, morning: 20.0, afternoon: 15.0, evening: 0.0, type: '781 (Finisher)', abw: 335.0, mort: 0, note: 'Puasa sebelum panen total. Target 1.500 kg terpenuhi.' },
  ];

  samplePoints.forEach((p, idx) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + p.doc - 1);
    const dateStr = d.toISOString().split('T')[0];
    const totalFeed = p.morning + p.afternoon + p.evening;
    const estAlive = 5000 - (idx * 3);
    const biomass = (estAlive * p.abw) / 1000;

    logs.push({
      id: `log-${p.doc}-${Date.now()}`,
      date: dateStr,
      doc: p.doc,
      feedMorningKg: p.morning,
      feedAfternoonKg: p.afternoon,
      feedEveningKg: p.evening,
      feedTotalKg: Number(totalFeed.toFixed(2)),
      feedType: p.type,
      feedPricePerKg: p.type.includes('PF') ? 16500 : 13500,
      mortalityCount: p.mort,
      abwGram: p.abw,
      estimatedBiomassKg: Number(biomass.toFixed(1)),
      supplements: [
        { name: 'Probiotik EM4', amount: 50, unit: 'ml', cost: 5000 },
        { name: 'Molase', amount: 100, unit: 'ml', cost: 3000 }
      ],
      waterExchangePct: p.doc % 14 === 0 ? 10 : 0,
      waterTemp: 28.2 + (Math.sin(p.doc) * 0.8),
      waterPh: 7.4 + (Math.cos(p.doc) * 0.3),
      waterDo: 5.6 + (Math.sin(p.doc * 0.5) * 0.6),
      powerSource: 'PLTS',
      notes: p.note,
    });
  });

  return logs;
}
