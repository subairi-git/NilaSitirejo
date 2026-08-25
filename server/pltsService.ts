import EventEmitter from 'events';

export interface PltsHistoryPoint {
  timestamp: string;
  pvPowerW: number;
  batterySocPct: number;
  batteryPowerW: number;
  loadPowerW: number;
  gridPowerW: number;
}

type FlowStatus = -1 | 0 | 1;
type BatteryDirection = 'charging' | 'discharging' | 'idle';
type GridDirection = 'importing' | 'exporting' | 'idle';

export class PltsMonitoringService extends EventEmitter {
  private deviceDataUrl: string =
    'https://web.dessmonitor.com/public/?sign=93b4c5aa2ee4aa70f9bc9fece80f4f55f6df868b&salt=1784439754509&token=CNb1f7517a-e902-48b2-a9d7-ddcf00c861f6&action=querySPDeviceLastData&source=1&devcode=6513&pn=I30000251304326127&devaddr=1&sn=I30000251304326127197101&i18n=en_US';

  // Use HTTPS. This endpoint is the authoritative source for energy-flow direction.
  private energyFlowUrl: string =
    'https://api.dessmonitor.com/public/?sign=93b4c5aa2ee4aa70f9bc9fece80f4f55f6df868b&salt=1784439754509&token=CNb1f7517a-e902-48b2-a9d7-ddcf00c861f6&action=webQueryDeviceEnergyFlowEs&pn=I30000251304326127&devcode=6513&devaddr=1&sn=I30000251304326127197101&source=1';

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
    this.startPolling(15000);
  }

  /**
   * Do not seed the dashboard with fabricated live power values.
   * Before the first successful fetch every flow is idle/0 W.
   */
  private initDefaultData() {
    this.lastSummary = {
      pvPowerW: 0,
      pvPowerKW: 0,
      batterySocPct: 0,
      batteryPowerW: 0,
      gridPowerW: 0,
      loadPowerW: 0,
      gridVoltageV: 0,
      gridFrequencyHz: 0,
      loadCurrentA: 0,
      workingState: 'Menunggu data Dessmonitor',
      lastUpdated: new Date().toISOString(),
      isGridActive: false,
      isGridAvailable: false,
      batteryDirection: 'idle' as BatteryDirection,
      gridDirection: 'idle' as GridDirection,
      flowStatus: {
        pv: 0 as FlowStatus,
        battery: 0 as FlowStatus,
        grid: 0 as FlowStatus,
        load: 0 as FlowStatus,
      },
      rawFlow: null,
      rawDevice: null,
      connected: false,
    };
  }

  private normalizeStatus(value: unknown): FlowStatus {
    const status = Number(value);
    if (status === 1) return 1;
    if (status === -1) return -1;
    return 0;
  }

  private findFlowItem(items: any, par: string): any | undefined {
    if (!Array.isArray(items)) return undefined;
    return items.find((item: any) => item?.par === par) ?? items[0];
  }

  /**
   * Dessmonitor may return W or kW depending on device/protocol.
   * Never multiply blindly by 1000: use the unit returned by the API.
   */
  private toWatts(item: any, fallbackUnit: string = 'W'): number {
    if (!item) return 0;

    const value = Number.parseFloat(String(item.val ?? ''));
    if (!Number.isFinite(value)) return 0;

    const unit = String(item.unit ?? fallbackUnit)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '');

    if (unit === 'kw') return Math.abs(value * 1000);
    if (unit === 'mw') return Math.abs(value * 1_000_000);
    return Math.abs(value);
  }

  private toNumber(value: unknown, fallback = 0): number {
    const parsed = Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : fallback;
  }


  private parseDeviceTimestamp(value: unknown): string | null {
    const raw = String(value ?? '').trim();
    if (!raw) return null;

    const epoch = Number(raw);
    if (Number.isFinite(epoch)) {
      const ms = epoch > 1_000_000_000_000 ? epoch : epoch * 1000;
      const date = new Date(ms);
      if (!Number.isNaN(date.getTime())) return date.toISOString();
    }

    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private findDeviceItem(items: any, ids: string[], keywords: string[]): any | undefined {
    if (!Array.isArray(items)) return undefined;

    const normalizedIds = ids.map((id) => id.toLowerCase());
    const normalizedKeywords = keywords.map((keyword) => keyword.toLowerCase());

    return items.find((item: any) => {
      const id = String(item?.id ?? '').toLowerCase();
      const par = String(item?.par ?? '').toLowerCase();
      return (
        normalizedIds.includes(id) ||
        normalizedKeywords.some((keyword) => id.includes(keyword) || par.includes(keyword))
      );
    });
  }

  public async fetchLivePltsData() {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const [resFlow, resDevice] = await Promise.allSettled([
        fetch(this.energyFlowUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
        fetch(this.deviceDataUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        }),
      ]);

      let flowData: any = null;
      let devData: any = null;

      if (resFlow.status === 'fulfilled' && resFlow.value.ok) {
        flowData = await resFlow.value.json();
        if (flowData?.err === 0 || flowData?.success === true || flowData?.dat) {
          this.lastEnergyFlow = flowData;
        } else {
          flowData = null;
        }
      }

      if (resDevice.status === 'fulfilled' && resDevice.value.ok) {
        devData = await resDevice.value.json();
        this.lastDeviceData = devData;
      }

      if (!flowData && !devData) {
        throw new Error('Gagal menghubungi endpoint Dessmonitor');
      }

      this.isConnected = true;
      this.lastError = null;
      this.lastFetchTime = Date.now();
      this.parseLiveSummary(flowData, devData);
      this.emit('update', this.lastSummary);
      return this.lastSummary;
    } catch (err: any) {
      this.isConnected = false;
      this.lastError = err?.name === 'AbortError'
        ? 'Timeout saat mengambil data Dessmonitor'
        : err?.message || 'Gagal mengambil data PLTS';

      this.lastSummary = {
        ...this.lastSummary,
        connected: false,
        error: this.lastError,
      };

      console.warn('[PLTS Service] Error fetching live data:', this.lastError);
      return this.lastSummary;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse both Dessmonitor endpoints without inventing electrical power.
   *
   * Data-source priority:
   * - querySPDeviceLastData:
   *     PV power, battery SOC, grid voltage/frequency, load current, working state.
   *     This endpoint is the "last device data" endpoint and should win for
   *     overlapping telemetry values such as PV power and SOC.
   * - webQueryDeviceEnergyFlowEs:
   *     load active power, grid active power, battery active power and all
   *     energy-flow directions (status).
   *
   * Direction rules from Dessmonitor:
   *   pv_status:  1 generation, 0 idle
   *   bt_status:  1 discharge, 0 idle, -1 charging
   *   gd_status:  1 import/buy, 0 idle, -1 export/sell
   *   bc_status: -1 consumption, 0 idle
   *
   * IMPORTANT:
   * bt_status[j].status is the battery energy-flow direction, regardless of
   * which bt_status item carries it (for this device it can be
   * bt_battery_capacity). Therefore status=-1 must animate Inverter -> Battery
   * even when battery_active_power is absent or reports 0 W.
   */
  private parseLiveSummary(flow: any, dev: any) {
    const previous = this.lastSummary ?? {};

    let pvPowerW = 0;
    let flowPvPowerW = 0;
    let batterySocPct = previous.batterySocPct ?? 0;
    let flowBatterySocPct: number | null = null;
    let batteryPowerW = 0;
    let batteryPowerAvailable = false;
    let batteryStatusSource: string | null = null;
    let gridPowerW = 0;
    let loadPowerW = 0;

    let gridVoltageV = previous.gridVoltageV ?? 0;
    let gridFrequencyHz = previous.gridFrequencyHz ?? 0;
    let loadCurrentA = previous.loadCurrentA ?? 0;
    let workingState = previous.workingState ?? 'Unknown';

    let deviceUpdatedAt: string | null = null;
    let flowUpdatedAt: string | null = null;

    let hasDevicePv = false;
    let hasDeviceSoc = false;

    const devicePars = dev?.dat?.pars;

    // -----------------------------------------------------------------------
    // 1) querySPDeviceLastData — preferred for current telemetry
    // -----------------------------------------------------------------------
    if (devicePars) {
      const pvItem = this.findDeviceItem(
        devicePars.pv_,
        ['pv_output_power'],
        ['pv_output_power', 'pv power']
      );
      if (pvItem) {
        pvPowerW = this.toWatts(pvItem, 'W');
        hasDevicePv = true;
      }

      const batterySocItem = this.findDeviceItem(
        devicePars.bt_,
        ['bt_battery_capacity'],
        ['battery_capacity', 'capacity soc', 'soc']
      );
      if (batterySocItem) {
        batterySocPct = this.toNumber(batterySocItem.val, batterySocPct);
        hasDeviceSoc = true;
      }

      const gridVoltageItem = this.findDeviceItem(
        devicePars.gd_,
        ['gd_input_voltage'],
        ['input_voltage', 'input voltage', 'grid_voltage']
      );
      if (gridVoltageItem) {
        gridVoltageV = this.toNumber(gridVoltageItem.val, gridVoltageV);
      }

      const gridFrequencyItem = this.findDeviceItem(
        devicePars.gd_,
        ['gd_input_frequency'],
        ['input_frequency', 'input frequency', 'grid_frequency', 'frequency']
      );
      if (gridFrequencyItem) {
        gridFrequencyHz = this.toNumber(gridFrequencyItem.val, gridFrequencyHz);
      }

      const loadCurrentItem = this.findDeviceItem(
        devicePars.bc_,
        ['bc_load_current', 'bc_output_current'],
        ['load_current', 'load current', 'output_current', 'current']
      );
      if (loadCurrentItem) {
        loadCurrentA = this.toNumber(loadCurrentItem.val, loadCurrentA);
      }

      const stateItem = this.findDeviceItem(
        devicePars.sy_,
        ['sy_status', 'sy_working_state'],
        ['working state', 'working_state', 'work_state', 'state']
      ) ?? (Array.isArray(devicePars.sy_) ? devicePars.sy_[0] : undefined);

      if (stateItem?.val) {
        workingState = String(stateItem.val);
      }

      deviceUpdatedAt = this.parseDeviceTimestamp(dev?.dat?.gts);
    }

    let pvStatus: FlowStatus = 0;
    let batteryStatus: FlowStatus = 0;
    let gridStatus: FlowStatus = 0;
    let loadStatus: FlowStatus = 0;

    // -----------------------------------------------------------------------
    // 2) webQueryDeviceEnergyFlowEs — authoritative for flow direction/power
    // -----------------------------------------------------------------------
    if (flow?.dat) {
      const dat = flow.dat;
      flowUpdatedAt = dat.date ? String(dat.date) : null;

      const pvItem = this.findFlowItem(dat.pv_status, 'pv_output_power');
      if (pvItem) {
        // Keep a separate PV value for the flow diagram so every animated
        // wattage belongs to the same energy-flow snapshot.
        flowPvPowerW = this.toWatts(pvItem, 'W');
        pvStatus = this.normalizeStatus(pvItem.status);
        if (!hasDevicePv) {
          pvPowerW = flowPvPowerW;
        }
      }

      const flowSocItem = Array.isArray(dat.bt_status)
        ? dat.bt_status.find((item: any) => item?.par === 'bt_battery_capacity')
        : undefined;
      if (flowSocItem) {
        flowBatterySocPct = this.toNumber(flowSocItem.val, batterySocPct);
        if (!hasDeviceSoc) {
          batterySocPct = flowBatterySocPct;
        }
      }

      const batteryItems = Array.isArray(dat.bt_status) ? dat.bt_status : [];
      const batteryPowerItem = batteryItems.find(
        (item: any) => item?.par === 'battery_active_power'
      );

      // Dessmonitor defines bt_status[j].status as the BATTERY FLOW DIRECTION.
      // On this protocol the direction can be attached to bt_battery_capacity,
      // so do not require battery_active_power to determine charging/discharging.
      const batteryDirectionItem =
        batteryItems.find((item: any) => this.normalizeStatus(item?.status) !== 0) ??
        batteryItems.find((item: any) => item?.status !== undefined) ??
        batteryItems[0];

      if (batteryDirectionItem) {
        batteryStatus = this.normalizeStatus(batteryDirectionItem.status);
        batteryStatusSource = String(batteryDirectionItem.par ?? 'bt_status');
      }

      if (batteryPowerItem) {
        // Power magnitude is optional and independent from the direction status.
        batteryPowerW = this.toWatts(batteryPowerItem, 'W');
        batteryPowerAvailable = true;
      }

      const gridItem = this.findFlowItem(dat.gd_status, 'grid_active_power');
      if (gridItem) {
        // Official Dessmonitor examples use kW for grid_active_power. Respect
        // an explicit unit; otherwise default to kW. Zero remains zero either way.
        gridPowerW = this.toWatts(gridItem, 'kW');
        gridStatus = this.normalizeStatus(gridItem.status);
      }

      const loadItem = this.findFlowItem(dat.bc_status, 'load_active_power');
      if (loadItem) {
        loadPowerW = this.toWatts(loadItem, 'W');
        loadStatus = this.normalizeStatus(loadItem.status);
      }
    }

    // Never animate direction when actual measured power is effectively zero.
    if (flowPvPowerW <= 0.5 && flow?.dat) pvStatus = 0;
    if (!flow?.dat && pvPowerW <= 0.5) pvStatus = 0;
    // Do NOT force batteryStatus to idle from batteryPowerW. The Dessmonitor
    // protocol can report direction on bt_battery_capacity without a power item.
    if (gridPowerW <= 0.5) gridStatus = 0;
    if (loadPowerW <= 0.5) loadStatus = 0;

    const batteryDirection: BatteryDirection =
      batteryStatus === -1
        ? 'charging'
        : batteryStatus === 1
          ? 'discharging'
          : 'idle';

    const gridDirection: GridDirection =
      gridStatus === 1
        ? 'importing'
        : gridStatus === -1
          ? 'exporting'
          : 'idle';

    // Voltage means PLN is physically present/available, not necessarily flowing.
    const isGridAvailable = gridVoltageV >= 180;
    const isGridActive = gridStatus !== 0 && gridPowerW > 0.5;

    const pvPowerKW = pvPowerW / 1000;
    const lastUpdated =
      deviceUpdatedAt ??
      flowUpdatedAt ??
      new Date().toISOString();

    this.lastSummary = {
      pvPowerW: Number(pvPowerW.toFixed(2)),
      pvPowerKW: Number(pvPowerKW.toFixed(4)),
      flowPvPowerW: Number(flowPvPowerW.toFixed(2)),
      batterySocPct: Number(Math.max(0, Math.min(100, batterySocPct)).toFixed(1)),
      flowBatterySocPct: flowBatterySocPct == null
        ? null
        : Number(Math.max(0, Math.min(100, flowBatterySocPct)).toFixed(1)),
      batteryPowerW: Number(batteryPowerW.toFixed(1)),
      batteryPowerAvailable,
      batteryStatusSource,
      gridPowerW: Number(gridPowerW.toFixed(1)),
      loadPowerW: Number(loadPowerW.toFixed(1)),
      gridVoltageV: Number(gridVoltageV.toFixed(1)),
      gridFrequencyHz: Number(gridFrequencyHz.toFixed(1)),
      loadCurrentA: Number(loadCurrentA.toFixed(2)),
      workingState,
      isGridActive,
      isGridAvailable,
      batteryDirection,
      gridDirection,
      flowStatus: {
        pv: pvStatus,
        battery: batteryStatus,
        grid: gridStatus,
        load: loadStatus,
      },
      sourceStatus: {
        device: Boolean(devicePars),
        energyFlow: Boolean(flow?.dat),
      },
      deviceUpdatedAt,
      flowUpdatedAt,
      lastUpdated,
      rawFlow: flow,
      rawDevice: dev,
      connected: Boolean(devicePars || flow?.dat),
      error: undefined,
    };

    // Store PV and Load from the SAME energy-flow snapshot whenever available.
    // This makes the comparison chart electrically meaningful instead of mixing
    // querySPDeviceLastData PV with a different webQueryDeviceEnergyFlowEs timestamp.
    const historyTimestamp = flowUpdatedAt ?? deviceUpdatedAt ?? new Date().toISOString();
    this.history.push({
      timestamp: historyTimestamp,
      pvPowerW: flow?.dat ? this.lastSummary.flowPvPowerW : this.lastSummary.pvPowerW,
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

    this.fetchLivePltsData().catch((err) => {
      console.warn('[PLTS Service] Initial fetch failed:', err);
    });

    this.pollInterval = setInterval(() => {
      this.fetchLivePltsData().catch((err) => {
        console.warn('[PLTS Service] Poll failed:', err);
      });
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
