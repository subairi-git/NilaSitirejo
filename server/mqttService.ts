import mqtt, { MqttClient } from 'mqtt';
import EventEmitter from 'events';

export interface TelemetryPayload {
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

export interface MqttAckPayload {
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

export type TelemetryFreshness = 'waiting' | 'live' | 'delayed' | 'stale';

export class MqttAquacultureService extends EventEmitter {
  private client: MqttClient | null = null;
  private brokerUrl: string = 'mqtt://broker.emqx.io:1883';
  private baseTopic: string = 'aquaculture/nila/data';
  private defaultDeviceId: string = 'nila-E0F908';
  private topic: string = 'aquaculture/nila/data/+/telemetry';
  private cmdTopic: string = 'aquaculture/nila/data/nila-E0F908/command';

  public latestTelemetry: TelemetryPayload | null = null;
  public telemetryHistory: TelemetryPayload[] = [];
  public ackHistory: MqttAckPayload[] = [];
  public latestAck: MqttAckPayload | null = null;
  public latestDeviceInfo: Record<string, any> | null = null;
  public latestConfig: Record<string, any> | null = null;
  public deviceStatus: 'online' | 'offline' | 'unknown' = 'unknown';
  public isConnected: boolean = false;
  public connectionError: string | null = null;

  /** Waktu pesan MQTT apa pun terakhir diterima (telemetry/status/ack/config). */
  public lastMessageTime: number = 0;

  /** Waktu TELEMETRY sensor terakhir benar-benar diterima. */
  public lastTelemetryTime: number = 0;

  public messageCount: number = 0;
  public simulationActive: boolean = false;

  private simInterval: NodeJS.Timeout | null = null;
  private watchdogInterval: NodeJS.Timeout | null = null;
  private brokerConnectedAt: number = 0;
  private lastWatchdogReconnectAt: number = 0;
  private watchdogReconnectCount: number = 0;

  // Freshness policy. Sensor normal mengirim lebih cepat dari batas ini.
  private readonly TELEMETRY_LIVE_MS = 30_000;
  private readonly TELEMETRY_DELAYED_MS = 60_000;
  private readonly TELEMETRY_RECONNECT_MS = 90_000;
  private readonly WATCHDOG_INTERVAL_MS = 15_000;
  private readonly WATCHDOG_RECONNECT_COOLDOWN_MS = 5 * 60_000;

  constructor() {
    super();
    this.initDefaultTelemetry();
    this.startTelemetryWatchdog();
    this.connect();
  }

  private initDefaultTelemetry() {
    // Baseline UI saja. received_at sengaja tidak diisi agar tidak dianggap
    // sebagai telemetry nyata dan tidak tersimpan ke MongoDB sebagai data sensor.
    this.latestTelemetry = {
      device: 'nila-E0F908',
      firmware_version: '2.0.0-mqtt-cmd',
      command_protocol: '2.0',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      uptime_s: 0,
      ph: null,
      ph_mv: null,
      ph_cal_401: false,
      ph_cal_686: false,
      ph_cal_918: false,
      do_mg_l: null,
      do_saturation_pct: null,
      water_temperature_c: null,
      do_ok: false,
      modbus_code: 0,
      do_raw: [],
      do_salinity_ppt: 0,
      do_atmospheric_pressure_kpa: 101.33,
      wifi_connected: false,
      wifi_rssi: 0,
      ip: '',
      ap_active: false,
      ap_ip: '',
      mqtt_connected: false,
      received_at: undefined,
    };

    this.latestAck = {
      id: 'init-ack',
      status: 'ok',
      message: 'System ready - waiting for live MQTT telemetry',
      device: 'nila-E0F908',
      protocol: '2.0',
      cmd: 'ping',
      request_id: 'boot',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      uptime_s: 0,
      received_at: new Date().toISOString(),
    };
    this.ackHistory.push({ ...this.latestAck });
  }

  private toNullableNumber(value: unknown, fallback: number | null): number | null {
    if (value === null) return null;
    if (value === undefined || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  private toNumber(value: unknown, fallback: number): number {
    const parsed = this.toNullableNumber(value, fallback);
    return parsed === null ? fallback : parsed;
  }

  private toBoolean(value: unknown, fallback: boolean): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', '1', 'yes', 'on', 'ok'].includes(normalized)) return true;
      if (['false', '0', 'no', 'off'].includes(normalized)) return false;
    }
    return fallback;
  }

  private getTelemetryFreshness(now = Date.now()): {
    telemetryState: TelemetryFreshness;
    telemetryFresh: boolean;
    telemetryAgeSec: number | null;
  } {
    if (this.simulationActive) {
      return {
        telemetryState: 'live',
        telemetryFresh: true,
        telemetryAgeSec: 0,
      };
    }

    if (this.lastTelemetryTime > 0) {
      const ageMs = Math.max(0, now - this.lastTelemetryTime);
      const telemetryAgeSec = Math.floor(ageMs / 1000);
      if (ageMs <= this.TELEMETRY_LIVE_MS) {
        return { telemetryState: 'live', telemetryFresh: true, telemetryAgeSec };
      }
      if (ageMs <= this.TELEMETRY_DELAYED_MS) {
        return { telemetryState: 'delayed', telemetryFresh: false, telemetryAgeSec };
      }
      return { telemetryState: 'stale', telemetryFresh: false, telemetryAgeSec };
    }

    // Broker baru tersambung tetapi belum ada telemetry sensor nyata.
    if (this.isConnected && this.brokerConnectedAt > 0) {
      const waitMs = Math.max(0, now - this.brokerConnectedAt);
      if (waitMs <= this.TELEMETRY_DELAYED_MS) {
        return {
          telemetryState: 'waiting',
          telemetryFresh: false,
          telemetryAgeSec: null,
        };
      }
    }

    return {
      telemetryState: 'stale',
      telemetryFresh: false,
      telemetryAgeSec: null,
    };
  }

  private startTelemetryWatchdog() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);

    this.watchdogInterval = setInterval(() => {
      if (!this.client || !this.isConnected || this.simulationActive) return;

      const now = Date.now();
      const referenceTime = this.lastTelemetryTime || this.brokerConnectedAt;
      if (!referenceTime) return;

      const staleForMs = now - referenceTime;
      const reconnectAllowed =
        now - this.lastWatchdogReconnectAt >= this.WATCHDOG_RECONNECT_COOLDOWN_MS;

      if (staleForMs > this.TELEMETRY_RECONNECT_MS && reconnectAllowed) {
        this.lastWatchdogReconnectAt = now;
        this.watchdogReconnectCount += 1;

        console.warn(
          `[MQTT WATCHDOG] Telemetry sensor tidak diterima selama ${Math.floor(
            staleForMs / 1000
          )}s. Mencoba reconnect subscriber MQTT...`
        );

        try {
          this.client.reconnect();
        } catch (error) {
          console.error('[MQTT WATCHDOG] reconnect() gagal, membuat koneksi baru:', error);
          this.connect();
        }

        // Dorong status ke SSE agar UI langsung tahu kondisi stale/reconnect.
        this.emit('status', this.getStatus());
      }
    }, this.WATCHDOG_INTERVAL_MS);
  }

  public connect(newBrokerUrl?: string, newBaseTopic?: string) {
    if (newBrokerUrl) this.brokerUrl = newBrokerUrl;
    if (newBaseTopic) {
      this.baseTopic = newBaseTopic.replace(/\/+$/, '');
      this.topic = `${this.baseTopic}/+/telemetry`;
      this.cmdTopic = `${this.baseTopic}/${this.defaultDeviceId}/command`;
    }

    if (this.client) {
      try {
        this.client.removeAllListeners();
        this.client.end(true);
      } catch (e) {
        console.error('Error closing previous MQTT client', e);
      }
    }

    console.log(`Connecting to MQTT broker: ${this.brokerUrl} on base: ${this.baseTopic}`);

    try {
      this.client = mqtt.connect(this.brokerUrl, {
        clientId: `nila_web_${Math.random().toString(16).substring(2, 10)}`,
        clean: true,
        connectTimeout: 8000,
        reconnectPeriod: 5000,
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        this.connectionError = null;
        this.brokerConnectedAt = Date.now();
        console.log(`[MQTT] Connected to ${this.brokerUrl}`);

        // Satu wildcard sudah mencakup telemetry, ack, config, dan status.
        // Topic eksplisit dipertahankan untuk kompatibilitas bila broker/filter berubah.
        const subTopics = Array.from(
          new Set([
            `${this.baseTopic}/#`,
            `${this.baseTopic}/+/telemetry`,
            `${this.baseTopic}/+/ack`,
            `${this.baseTopic}/+/config`,
            `${this.baseTopic}/+/status`,
          ])
        );

        subTopics.forEach((tp) => {
          this.client?.subscribe(tp, (err) => {
            if (err) {
              console.error(`[MQTT] Subscribe error on ${tp}:`, err);
            } else {
              console.log(`[MQTT] Subscribed to ${tp}`);
            }
          });
        });

        this.emit('status', this.getStatus());
      });

      this.client.on('message', (topic, message) => {
        try {
          const str = message.toString();

          // Ini aktivitas broker umum, BUKAN indikator freshness telemetry sensor.
          this.lastMessageTime = Date.now();
          this.messageCount += 1;

          if (topic.endsWith('/telemetry')) {
            const parsed = JSON.parse(str);
            this.handleIncomingTelemetry(parsed);
          } else if (topic.endsWith('/ack')) {
            const parsed = JSON.parse(str);
            this.handleIncomingAck(parsed);
          } else if (topic.endsWith('/config')) {
            const parsed = JSON.parse(str);
            this.handleIncomingConfig(parsed);
          } else if (topic.endsWith('/status')) {
            const statusStr = str.trim().toLowerCase();
            this.deviceStatus = statusStr === 'online' ? 'online' : 'offline';
            this.emit('device_status', {
              status: this.deviceStatus,
              topic,
              timestamp: new Date().toISOString(),
            });
          } else {
            // General JSON fallback jika firmware publish ke topic yang sedikit berbeda.
            try {
              const parsed = JSON.parse(str);
              if (
                parsed.ph !== undefined ||
                parsed.do_mg_l !== undefined ||
                parsed.water_temperature_c !== undefined
              ) {
                this.handleIncomingTelemetry(parsed);
              } else if (parsed.status === 'ok' || parsed.status === 'error') {
                this.handleIncomingAck(parsed);
              }
            } catch {
              // Non-JSON message boleh diabaikan.
            }
          }
        } catch (err) {
          console.error('[MQTT] Failed to handle message on topic:', topic, err);
        }
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.connectionError = err.message;
        console.error('[MQTT] Connection error:', err);
        this.emit('status', this.getStatus());
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.emit('status', this.getStatus());
      });

      this.client.on('reconnect', () => {
        console.log('[MQTT] Reconnecting...');
      });
    } catch (err: any) {
      this.isConnected = false;
      this.connectionError = err.message;
      console.error('[MQTT] Initialization error:', err);
    }
  }

  public handleIncomingAck(data: Partial<MqttAckPayload>) {
    const ack: MqttAckPayload = {
      id: `ack-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      status: data.status === 'error' ? 'error' : 'ok',
      message: data.message || (data.status === 'ok' ? 'Success' : 'Error'),
      device: data.device || this.defaultDeviceId,
      protocol: data.protocol || '2.0',
      cmd: data.cmd || '',
      request_id: data.request_id || '',
      timestamp:
        data.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
      uptime_s: this.toNumber(data.uptime_s, 0),
      received_at: new Date().toISOString(),
    };

    this.latestAck = ack;
    this.ackHistory.unshift(ack);
    if (this.ackHistory.length > 200) {
      this.ackHistory.pop();
    }

    this.emit('ack', ack);
    console.log(
      `[MQTT ACK] [${ack.status.toUpperCase()}] cmd: ${ack.cmd || 'N/A'} - ${ack.message}`
    );
  }

  public handleIncomingConfig(data: Record<string, any>) {
    if (data.chip_model || data.do_sensor_model) {
      this.latestDeviceInfo = data;
      this.emit('device_info', data);
    } else if (data.ph_401 !== undefined || data.ph_mv_686 !== undefined) {
      this.emit('calibration_status', data);
    } else {
      this.latestConfig = data;
      this.emit('config', data);
    }
  }

  public handleIncomingTelemetry(data: Partial<TelemetryPayload> | Record<string, any>) {
    const now = Date.now();
    const receivedAt = new Date(now).toISOString();

    // Freshness hanya berubah di sini: pesan status/ack/config tidak dianggap telemetry.
    this.lastTelemetryTime = now;
    this.deviceStatus = 'online';

    const previous = this.latestTelemetry;

    const ph = this.toNullableNumber(data.ph, previous?.ph ?? null);
    const doMgL = this.toNullableNumber(data.do_mg_l, previous?.do_mg_l ?? null);
    const doSaturation = this.toNullableNumber(
      data.do_saturation_pct,
      previous?.do_saturation_pct ?? null
    );
    const waterTemperature = this.toNullableNumber(
      data.water_temperature_c,
      previous?.water_temperature_c ?? null
    );

    const payload: TelemetryPayload = {
      device: typeof data.device === 'string' && data.device ? data.device : this.defaultDeviceId,
      firmware_version:
        typeof data.firmware_version === 'string'
          ? data.firmware_version
          : previous?.firmware_version || '2.0.0-mqtt-cmd',
      command_protocol:
        typeof data.command_protocol === 'string'
          ? data.command_protocol
          : previous?.command_protocol || '2.0',
      timestamp:
        typeof data.timestamp === 'string' && data.timestamp
          ? data.timestamp
          : new Date().toISOString().replace('T', ' ').substring(0, 19),
      uptime_s: this.toNumber(data.uptime_s, previous?.uptime_s ?? 0),
      ph,
      ph_mv: this.toNullableNumber(data.ph_mv, previous?.ph_mv ?? null),
      ph_cal_401: this.toBoolean(data.ph_cal_401, previous?.ph_cal_401 ?? false),
      ph_cal_686: this.toBoolean(data.ph_cal_686, previous?.ph_cal_686 ?? false),
      ph_cal_918: this.toBoolean(data.ph_cal_918, previous?.ph_cal_918 ?? false),
      do_mg_l: doMgL,
      do_saturation_pct: doSaturation,
      water_temperature_c: waterTemperature,
      do_ok: this.toBoolean(data.do_ok, doMgL !== null),
      modbus_code: this.toNumber(data.modbus_code, previous?.modbus_code ?? 0),
      do_raw: Array.isArray(data.do_raw)
        ? data.do_raw
            .map((value: unknown) => Number(value))
            .filter((value: number) => Number.isFinite(value))
        : previous?.do_raw || [],
      do_salinity_ppt: this.toNumber(
        data.do_salinity_ppt,
        previous?.do_salinity_ppt ?? 0
      ),
      do_atmospheric_pressure_kpa: this.toNumber(
        data.do_atmospheric_pressure_kpa,
        previous?.do_atmospheric_pressure_kpa ?? 101.33
      ),
      wifi_connected: this.toBoolean(
        data.wifi_connected,
        previous?.wifi_connected ?? false
      ),
      wifi_rssi: this.toNumber(data.wifi_rssi, previous?.wifi_rssi ?? 0),
      ip: typeof data.ip === 'string' ? data.ip : previous?.ip || '',
      ap_active: this.toBoolean(data.ap_active, previous?.ap_active ?? false),
      ap_ip: typeof data.ap_ip === 'string' ? data.ap_ip : previous?.ap_ip || '',
      mqtt_connected: this.toBoolean(data.mqtt_connected, true),
      received_at: receivedAt,
    };

    this.latestTelemetry = payload;
    this.telemetryHistory.push(payload);

    // Keep ring buffer limited to last 1000 items.
    if (this.telemetryHistory.length > 1000) {
      this.telemetryHistory.shift();
    }

    this.emit('telemetry', payload);
  }

  public publishCommand(
    command: string,
    params: Record<string, any> = {},
    options?: {
      deviceId?: string;
      token?: string;
      requestId?: string;
      targetTopic?: string;
    }
  ) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        return reject(new Error('MQTT Broker tidak terhubung'));
      }

      const deviceId = options?.deviceId || params.device_id || this.defaultDeviceId;
      const targetTopic = options?.targetTopic || `${this.baseTopic}/${deviceId}/command`;
      const requestId =
        options?.requestId ||
        params.request_id ||
        `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const token = options?.token || params.token || 'change-this-token';

      // Construct command payload according to NilaWaterMonitor.ino v2 format.
      const payloadObj: Record<string, any> = {
        cmd: command,
        request_id: requestId,
        token,
        ...params,
      };

      const payloadStr = JSON.stringify(payloadObj);

      this.client.publish(targetTopic, payloadStr, { qos: 1 }, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`[MQTT] Published command to ${targetTopic}:`, payloadStr);

          // Jika simulation aktif, buat mock ACK untuk feedback UI.
          if (this.simulationActive) {
            setTimeout(() => {
              let mockMsg = 'Command executed successfully';
              if (command.startsWith('cal_ph_')) {
                const point = command.replace('cal_ph_', '');
                mockMsg = `ph_${
                  point === '401' ? '4.01' : point === '686' ? '6.86' : '9.18'
                }_saved_at_${(2500 + Math.random() * 50).toFixed(1)}mV`;
              } else if (command === 'cal_ph_finish') {
                mockMsg = 'ph_3_point_calibration_ready';
              } else if (command === 'cal_do_100') {
                mockMsg = 'do_100_percent_calibration_written';
              } else if (command === 'cal_do_zero') {
                mockMsg = 'do_zero_calibration_written';
              } else if (command === 'sync_time') {
                mockMsg = `time_synced_${new Date()
                  .toISOString()
                  .replace('T', ' ')
                  .substring(0, 19)}`;
              } else if (command === 'ota_update' || command === 'update_firmware') {
                mockMsg = 'ota_download_started';
                setTimeout(() => {
                  this.handleIncomingAck({
                    cmd: command,
                    request_id: requestId,
                    status: 'ok',
                    message: 'ota_success_restarting',
                  });
                }, 3000);
              } else if (command === 'restart') {
                mockMsg = 'restarting';
              }

              this.handleIncomingAck({
                device: deviceId,
                cmd: command,
                request_id: requestId,
                status: 'ok',
                message: mockMsg,
                timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
                uptime_s: this.latestTelemetry?.uptime_s || 0,
              });
            }, 600);
          }

          resolve({
            success: true,
            command,
            requestId,
            topic: targetTopic,
            payload: payloadObj,
            timestamp: new Date().toISOString(),
          });
        }
      });
    });
  }

  public toggleSimulation(enable?: boolean) {
    if (enable === undefined) {
      this.simulationActive = !this.simulationActive;
    } else {
      this.simulationActive = enable;
    }

    if (this.simulationActive) {
      if (this.simInterval) clearInterval(this.simInterval);
      this.simInterval = setInterval(() => {
        if (!this.simulationActive) return;

        const now = new Date();
        const basePh =
          7.5 +
          Math.sin(Date.now() / 60000) * 0.3 +
          (Math.random() - 0.5) * 0.05;
        const baseDo =
          6.8 +
          Math.cos(Date.now() / 90000) * 1.1 +
          (Math.random() - 0.5) * 0.1;
        const baseTemp =
          27.2 +
          Math.sin(Date.now() / 120000) * 1.5 +
          (Math.random() - 0.5) * 0.08;

        this.handleIncomingTelemetry({
          device: 'nila-E0F908',
          timestamp: now.toISOString().replace('T', ' ').substring(0, 19),
          uptime_s: (this.latestTelemetry?.uptime_s || 0) + 3,
          ph: Number(basePh.toFixed(2)),
          ph_mv: Number((2500 + (7.0 - basePh) * 58.2).toFixed(1)),
          ph_cal_401: true,
          ph_cal_686: true,
          ph_cal_918: true,
          do_mg_l: Number(baseDo.toFixed(2)),
          do_saturation_pct: Number(((baseDo / 8.0) * 100).toFixed(1)),
          water_temperature_c: Number(baseTemp.toFixed(1)),
          do_ok: true,
          modbus_code: 0,
          do_raw: [
            16250 + Math.floor(Math.random() * 20),
            49560 + Math.floor(Math.random() * 20),
            16630,
            39990,
            16850,
            64050,
          ],
          do_salinity_ppt: 0,
          do_atmospheric_pressure_kpa: 101.32,
          wifi_connected: true,
          wifi_rssi: -65 + Math.floor((Math.random() - 0.5) * 6),
          ip: '192.168.18.187',
          ap_active: true,
          ap_ip: '192.168.4.1',
          mqtt_connected: true,
        });
      }, 3000);
    } else if (this.simInterval) {
      clearInterval(this.simInterval);
      this.simInterval = null;
    }

    this.emit('status', this.getStatus());
    return this.simulationActive;
  }

  public getStatus() {
    const freshness = this.getTelemetryFreshness();

    return {
      connected: this.isConnected,
      broker: this.brokerUrl,
      topic: this.topic,
      cmdTopic: this.cmdTopic,
      error: this.connectionError,
      deviceStatus: this.deviceStatus,

      // Pesan MQTT apa pun.
      lastMessageTime: this.lastMessageTime,
      lastMessageAt:
        this.lastMessageTime > 0 ? new Date(this.lastMessageTime).toISOString() : null,
      messageCount: this.messageCount,

      // Telemetry sensor secara khusus.
      lastTelemetryTime: this.lastTelemetryTime,
      lastTelemetryAt:
        this.lastTelemetryTime > 0
          ? new Date(this.lastTelemetryTime).toISOString()
          : null,
      telemetryAgeSec: freshness.telemetryAgeSec,
      telemetryState: freshness.telemetryState,
      telemetryFresh: freshness.telemetryFresh,

      simulationActive: this.simulationActive,
      historyCount: this.telemetryHistory.length,
      watchdogReconnectCount: this.watchdogReconnectCount,
    };
  }
}

export const mqttService = new MqttAquacultureService();
