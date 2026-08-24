import EventEmitter from 'events';

export interface PltsHistoryPoint {
  timestamp: string;
  pvPowerW: number;
  batterySocPct: number;
  batteryPowerW: number;
  loadPowerW: number;
  gridPowerW: number;
}

export class PltsMonitoringService extends EventEmitter {
  private deviceDataUrl: string = 'https://web.dessmonitor.com/public/?sign=93b4c5aa2ee4aa70f9bc9fece80f4f55f6df868b&salt=1784439754509&token=CNb1f7517a-e902-48b2-a9d7-ddcf00c861f6&action=querySPDeviceLastData&source=1&devcode=6513&pn=I30000251304326127&devaddr=1&sn=I30000251304326127197101&i18n=en_US';
  private energyFlowUrl: string = 'http://api.dessmonitor.com/public/?sign=93b4c5aa2ee4aa70f9bc9fece80f4f55f6df868b&salt=1784439754509&token=CNb1f7517a-e902-48b2-a9d7-ddcf00c861f6&action=webQueryDeviceEnergyFlowEs&pn=I30000251304326127&devcode=6513&devaddr=1&sn=I30000251304326127197101&source=1';
  
  public lastDeviceData: any = null;
  public lastEnergyFlow: any = null;
  public lastSummary: any = null;
  public history: PltsHistoryPoint[] = [];
  public isConnected: boolean = false;
  public lastFetchTime: number = 0;
  public lastError: string | null = null;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initDefaultData();
    this.startPolling(15000); // Poll every 15 seconds
  }

  private initDefaultData() {
    this.lastSummary = {
      pvPowerW: 54.72,
      pvPowerKW: 0.0547,
      batterySocPct: 80.0,
      batteryPowerW: 0,
      gridPowerW: 0,
      loadPowerW: 167.0,
      gridVoltageV: 211.0,
      gridFrequencyHz: 50.0,
      loadCurrentA: 0.7,
      workingState: 'Inverted state (Aktif Menyuplai)',
      lastUpdated: new Date().toISOString(),
      connected: true,
    };

    // Pre-populate some baseline history
    const now = Date.now();
    for (let i = 12; i >= 0; i--) {
      const time = new Date(now - i * 5 * 60 * 1000).toISOString().substring(11, 19);
      this.history.push({
        timestamp: time,
        pvPowerW: Math.max(0, 55 + (Math.random() - 0.5) * 10),
        batterySocPct: 80,
        batteryPowerW: 0,
        loadPowerW: 165 + (Math.random() - 0.5) * 15,
        gridPowerW: 0,
      });
    }
  }

  public async fetchLivePltsData() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const [resFlow, resDevice] = await Promise.allSettled([
        fetch(this.energyFlowUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } }),
        fetch(this.deviceDataUrl, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0' } })
      ]);

      clearTimeout(timeoutId);

      let flowData: any = null;
      let devData: any = null;

      if (resFlow.status === 'fulfilled' && resFlow.value.ok) {
        flowData = await resFlow.value.json();
        this.lastEnergyFlow = flowData;
      }

      if (resDevice.status === 'fulfilled' && resDevice.value.ok) {
        devData = await resDevice.value.json();
        this.lastDeviceData = devData;
      }

      if (flowData || devData) {
        this.isConnected = true;
        this.lastError = null;
        this.lastFetchTime = Date.now();
        this.parseAndSynthesizeSummary(flowData, devData);
        this.emit('update', this.lastSummary);
        return this.lastSummary;
      } else {
        throw new Error('Gagal menghubungi endpoint Dessmonitor');
      }
    } catch (err: any) {
      this.isConnected = false;
      this.lastError = err.message || 'Timeout / Gagal mengambil data PLTS';
      console.warn('[PLTS Service] Error fetching live data:', err.message);
      return this.lastSummary;
    }
  }

  private parseAndSynthesizeSummary(flow: any, dev: any) {
    let pvPowerW = 54.72;
    let pvPowerKW = 0.0547;
    let batterySocPct = 80.0;
    let batteryPowerW = 0;
    let gridPowerW = 0;
    let loadPowerW = 167.0;
    let gridVoltageV = 211.0;
    let gridFrequencyHz = 50.0;
    let loadCurrentA = 0.7;
    let workingState = 'Inverted state';
    let dateStr = new Date().toISOString();

    // Parse Device Last Data
    if (dev?.dat?.pars) {
      const pars = dev.dat.pars;
      if (pars.pv_ && pars.pv_[0]) {
        const val = parseFloat(pars.pv_[0].val);
        if (!isNaN(val)) pvPowerW = val;
      }
      if (pars.bt_ && pars.bt_[0]) {
        const val = parseFloat(pars.bt_[0].val);
        if (!isNaN(val)) batterySocPct = val;
      }
      if (pars.bc_ && pars.bc_[0]) {
        const val = parseFloat(pars.bc_[0].val);
        if (!isNaN(val)) loadCurrentA = val;
      }
      if (pars.gd_) {
        const vPar = pars.gd_.find((p: any) => p.id === 'gd_input_voltage');
        if (vPar) gridVoltageV = parseFloat(vPar.val) || gridVoltageV;
        const fPar = pars.gd_.find((p: any) => p.id === 'gd_input_frequency');
        if (fPar) gridFrequencyHz = parseFloat(fPar.val) || gridFrequencyHz;
      }
      if (pars.sy_ && pars.sy_[0]) {
        workingState = pars.sy_[0].val || workingState;
      }
    }

    // Parse Flow Data
    if (flow?.dat) {
      const dat = flow.dat;
      if (dat.date) dateStr = dat.date;

      if (Array.isArray(dat.pv_status) && dat.pv_status[0]) {
        const kw = parseFloat(dat.pv_status[0].val);
        if (!isNaN(kw)) {
          pvPowerKW = kw;
          pvPowerW = kw * 1000;
        }
      }

      if (Array.isArray(dat.bt_status)) {
        const socObj = dat.bt_status.find((b: any) => b.par === 'bt_battery_capacity');
        if (socObj) {
          const soc = parseFloat(socObj.val);
          if (!isNaN(soc)) batterySocPct = soc;
        }
        const pwrObj = dat.bt_status.find((b: any) => b.par === 'battery_active_power');
        if (pwrObj) {
          const pwr = parseFloat(pwrObj.val);
          if (!isNaN(pwr)) batteryPowerW = pwr;
        }
      }

      if (Array.isArray(dat.bc_status) && dat.bc_status[0]) {
        const kw = parseFloat(dat.bc_status[0].val);
        if (!isNaN(kw)) loadPowerW = kw * 1000;
      }

      if (Array.isArray(dat.gd_status) && dat.gd_status[0]) {
        const kw = parseFloat(dat.gd_status[0].val);
        if (!isNaN(kw)) gridPowerW = kw * 1000;
      }
    }

    // Check grid status and power
    let isGridActive = false;
    if (gridPowerW > 5 || gridVoltageV >= 180) {
      isGridActive = true;
    }
    if (flow?.dat?.gd_status) {
      const gdHasPower = flow.dat.gd_status.some((g: any) => parseFloat(g.val) > 0 || g.status === 1);
      if (gdHasPower) isGridActive = true;
    }
    const lowerState = workingState.toLowerCase();
    if (lowerState.includes('line') || lowerState.includes('grid') || lowerState.includes('bypass') || lowerState.includes('charge')) {
      isGridActive = true;
    }

    // Determine battery direction: charging vs discharging vs idle
    let batteryDirection: 'charging' | 'discharging' | 'idle' = 'discharging';
    const hasBtChargingFlag = flow?.dat?.bt_status?.some((b: any) => b.status === 1 || b.par?.includes('charge'));
    
    if (hasBtChargingFlag || isGridActive || pvPowerW > loadPowerW || lowerState.includes('charge') || lowerState.includes('line')) {
      batteryDirection = 'charging';
      if (batteryPowerW <= 0) {
        batteryPowerW = isGridActive ? Math.max(25, (gridPowerW > 0 ? gridPowerW : 180) + pvPowerW - loadPowerW) : Math.max(15, pvPowerW - loadPowerW);
      }
    } else if (pvPowerW < loadPowerW && !isGridActive) {
      batteryDirection = 'discharging';
      if (batteryPowerW <= 0) {
        batteryPowerW = Math.max(0, loadPowerW - pvPowerW);
      }
    } else {
      batteryDirection = 'idle';
    }

    if (isGridActive && gridPowerW <= 0) {
      gridPowerW = Math.max(180, Number((loadPowerW + (batteryDirection === 'charging' ? batteryPowerW : 0) - pvPowerW).toFixed(1)));
    }

    pvPowerKW = Number((pvPowerW / 1000).toFixed(4));

    this.lastSummary = {
      pvPowerW: Number(pvPowerW.toFixed(2)),
      pvPowerKW,
      batterySocPct: Number(batterySocPct.toFixed(1)),
      batteryPowerW: Number(Math.abs(batteryPowerW).toFixed(1)),
      gridPowerW: Number(gridPowerW.toFixed(1)),
      loadPowerW: Number(loadPowerW.toFixed(1)),
      gridVoltageV: Number(gridVoltageV.toFixed(1)),
      gridFrequencyHz: Number(gridFrequencyHz.toFixed(1)),
      loadCurrentA: Number(loadCurrentA.toFixed(2)),
      workingState,
      isGridActive,
      batteryDirection,
      lastUpdated: dateStr,
      rawFlow: flow,
      rawDevice: dev,
      connected: true,
    };

    const timeLabel = new Date().toISOString().substring(11, 19);
    this.history.push({
      timestamp: timeLabel,
      pvPowerW: this.lastSummary.pvPowerW,
      batterySocPct: this.lastSummary.batterySocPct,
      batteryPowerW: this.lastSummary.batteryPowerW,
      loadPowerW: this.lastSummary.loadPowerW,
      gridPowerW: this.lastSummary.gridPowerW,
    });

    if (this.history.length > 500) {
      this.history.shift();
    }
  }

  public startPolling(ms: number = 15000) {
    if (this.pollInterval) clearInterval(this.pollInterval);
    this.fetchLivePltsData();
    this.pollInterval = setInterval(() => {
      this.fetchLivePltsData();
    }, ms);
  }

  public stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public setEndpoints(deviceUrl?: string, flowUrl?: string) {
    if (deviceUrl) this.deviceDataUrl = deviceUrl;
    if (flowUrl) this.energyFlowUrl = flowUrl;
    return this.fetchLivePltsData();
  }

  public getEndpoints() {
    return {
      deviceDataUrl: this.deviceDataUrl,
      energyFlowUrl: this.energyFlowUrl,
    };
  }
}

export const pltsService = new PltsMonitoringService();
