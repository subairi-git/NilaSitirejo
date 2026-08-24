export interface TelemetryData {
  device: string;
  firmware_version?: string;
  command_protocol?: string;
  timestamp: string;
  uptime_s: number;
  ph: number | null;
  ph_mv: number | null;
  ph_cal_401?: boolean;
  ph_cal_686?: boolean;
  ph_cal_918?: boolean;
  do_mg_l: number | null;
  do_saturation_pct: number | null;
  water_temperature_c: number | null;
  do_ok: boolean;
  modbus_code: number;
  do_raw: number[];
  do_salinity_ppt: number;
  do_atmospheric_pressure_kpa: number;
  wifi_connected: boolean;
  wifi_rssi: number;
  ip: string;
  ap_active: boolean;
  ap_ip: string;
  mqtt_connected: boolean;
  received_at?: string;
}

export interface MqttAck {
  id?: string;
  status: 'ok' | 'error';
  message: string;
  device?: string;
  protocol?: string;
  cmd?: string;
  request_id?: string;
  timestamp?: string;
  uptime_s?: number;
  received_at?: string;
}

export interface EspDeviceInfo {
  device: string;
  firmware_version: string;
  command_protocol: string;
  chip_model?: string;
  chip_revision?: number;
  cpu_mhz?: number;
  flash_size?: number;
  free_heap?: number;
  uptime_s?: number;
  do_sensor_model?: string;
  do_slave_id?: number;
  do_baud?: number;
  do_ok?: boolean;
  modbus_code?: number;
}

export interface EspCalibrationStatus {
  device: string;
  ph_401: boolean;
  ph_686: boolean;
  ph_918: boolean;
  ph_mv_401: number;
  ph_mv_686: number;
  ph_mv_918: number;
  do_calibration_stored_in_sensor?: boolean;
  do_ok?: boolean;
  do_saturation_pct?: number;
  do_mg_l?: number;
}

export interface EspDeviceConfig {
  device_id: string;
  wifi: {
    ssid: string;
    password?: string;
  };
  mqtt: {
    host: string;
    port: number;
    user: string;
    password?: string;
    base_topic: string;
    publish_interval_ms: number;
    command_token?: string;
    firmware_url: string;
  };
  web: {
    user: string;
    password?: string;
  };
  do: {
    slave_id: number;
    baud: number;
    serial_format: string;
    function: number;
    register: number;
    data_type: string;
    scale: number;
    offset: number;
    salinity_ppt: number;
    atmospheric_pressure_kpa: number;
  };
  ph: {
    mv401: number;
    mv686: number;
    mv918: number;
    calibrated_2_point?: boolean;
    calibrated_3_point?: boolean;
    voltage_multiplier: number;
    samples: number;
  };
  display: {
    i2c_address: number;
  };
}

export interface PltsEnergyFlow {
  brand?: number;
  status?: number;
  date: string;
  bt_status: Array<{
    par: string;
    val: string;
    unit?: string;
    status: number;
  }>;
  pv_status: Array<{
    par: string;
    val: string;
    unit?: string;
    status: number;
  }>;
  gd_status: Array<{
    par: string;
    val: string;
    unit?: string;
    status: number;
  }>;
  bc_status: Array<{
    par: string;
    val: string;
    unit?: string;
    status: number;
  }>;
  ol_status?: Array<{
    par: string;
    val: string;
    unit?: string;
    status: number;
  }>;
  we_status?: Array<{
    par: string;
    val: string;
    unit?: string;
    status: number;
  }>;
}

export interface PltsDeviceData {
  gts?: string;
  pars?: {
    gd_?: Array<{ id: string; par: string; val: string; unit: string }>;
    sy_?: Array<{ id: string; par: string; val: string }>;
    pv_?: Array<{ id: string; par: string; val: string; unit: string }>;
    bt_?: Array<{ id: string; par: string; val: string; unit: string }>;
    bc_?: Array<{ id: string; par: string; val: string; unit: string }>;
  };
}

export interface PltsSummary {
  pvPowerW: number;
  pvPowerKW: number;
  batterySocPct: number;
  batteryPowerW: number;
  gridPowerW: number;
  loadPowerW: number;
  gridVoltageV: number;
  gridFrequencyHz: number;
  loadCurrentA: number;
  workingState: string;
  lastUpdated: string;
  rawFlow?: PltsEnergyFlow;
  rawDevice?: PltsDeviceData;
  connected: boolean;
  error?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'operator' | 'viewer';
  avatar?: string;
  token?: string;
  createdAt: string;
}

export interface ThresholdSettings {
  phMin: number;
  phMax: number;
  phWarningMin: number;
  phWarningMax: number;
  doMinGood: number;
  doMinWarning: number;
  tempMin: number;
  tempMax: number;
  tempOptMin: number;
  tempOptMax: number;
  enableAudioAlerts: boolean;
}

export interface AlertLogItem {
  id: string;
  timestamp: string;
  level: 'info' | 'warning' | 'critical';
  category: 'ph' | 'do' | 'temp' | 'network' | 'plts' | 'sensor';
  title: string;
  message: string;
  acknowledged?: boolean;
}

export interface DailySupplementItem {
  name: string;
  amount: number;
  unit: string;
  cost: number;
}

export interface DailyAquacultureLog {
  id: string;
  date: string;
  doc: number; // Day of Culture (1..120)
  feedMorningKg: number;
  feedAfternoonKg: number;
  feedEveningKg: number;
  feedTotalKg: number;
  feedType: string;
  feedPricePerKg: number;
  mortalityCount: number;
  abwGram: number; // Average Body Weight in grams
  estimatedBiomassKg: number;
  supplements: DailySupplementItem[];
  waterExchangePct?: number;
  waterTemp?: number;
  waterPh?: number;
  waterDo?: number;
  powerSource?: 'PLTS' | 'PLN' | 'HYBRID';
  notes?: string;
}

export interface HppCycleConfig {
  id: string;
  cycleName: string;
  pondName: string;
  pondVolumeM3: number;
  startDate: string;
  durationDays: number;
  // Bibit
  seedCount: number;
  seedPricePerUnit: number;
  seedSizeCm: string;
  survivalRatePct: number;
  targetHarvestAbwGram: number;
  // Pakan
  feedPriceAvgPerKg: number;
  targetFcr: number;
  actualFeedTotalKg?: number;
  // Listrik & PLTS
  plnTariffPerKwh: number;
  dailyKwhUsage: number;
  pltsSolarPortionPct: number; // % supplied by Solar PV
  // Vitamin & Kimia Air
  probioticsBudget: number;
  vitaminsBudget: number;
  molassesBudget: number;
  dolomiteSaltBudget: number;
  // Operasional & Tenaga Kerja
  laborCostPerCycle: number;
  waterElectricityMaintenance: number;
  // Penyusutan Aset
  pondDepreciationPerCycle: number; // Kolam terpal/beton
  aeratorEquipmentDepreciation: number; // Kincir, inverter, sensor
  otherContingencyCost: number;
  // Penjualan
  expectedSellingPricePerKg: number;
}

export interface HppCalculationResult {
  totalSeedCost: number;
  totalFeedCost: number;
  totalElectricityPlnCost: number;
  totalElectricityWithoutPlts: number;
  pltsSavingsRupiah: number;
  totalSupplementsCost: number;
  totalLaborCost: number;
  totalMaintenanceCost: number;
  totalDepreciationCost: number;
  totalContingencyCost: number;
  totalProductionCost: number;
  // Production Metrics
  totalHarvestFishCount: number;
  totalHarvestWeightKg: number;
  hppPerKg: number;
  hppPerFish: number;
  fcr: number;
  // Revenue & Profitability
  totalRevenue: number;
  netProfit: number;
  profitMarginPct: number;
  bepKg: number;
  bepRupiah: number;
  roiPct: number;
  costBreakdown: Array<{
    name: string;
    category: string;
    amount: number;
    percentage: number;
    color: string;
  }>;
}
