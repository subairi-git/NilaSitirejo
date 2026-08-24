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
  public deviceStatus: 'online' | 'offline' | 'unknown' = 'online';

  public isConnected: boolean = false;
  public connectionError: string | null = null;
  public lastMessageTime: number = 0;
  public messageCount: number = 0;
  public simulationActive: boolean = false;
  private simInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.initDefaultTelemetry();
    this.connect();
  }

  private initDefaultTelemetry() {
    // Initial baseline data from the user's sample
    this.latestTelemetry = {
      device: 'nila-E0F908',
      firmware_version: '2.0.0-mqtt-cmd',
      command_protocol: '2.0',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      uptime_s: 18156,
      ph: 7.65,
      ph_mv: 2598.5,
      ph_cal_401: true,
      ph_cal_686: true,
      ph_cal_918: true,
      do_mg_l: 7.89,
      do_saturation_pct: 98.7,
      water_temperature_c: 26.6,
      do_ok: true,
      modbus_code: 0,
      do_raw: [16252, 49569, 16636, 39993, 16852, 64058],
      do_salinity_ppt: 0,
      do_atmospheric_pressure_kpa: 101.33,
      wifi_connected: true,
      wifi_rssi: -76,
      ip: '192.168.18.187',
      ap_active: true,
      ap_ip: '192.168.4.1',
      mqtt_connected: true,
      received_at: new Date().toISOString()
    };
    this.telemetryHistory.push({ ...this.latestTelemetry });

    this.latestAck = {
      id: 'init-ack',
      status: 'ok',
      message: 'System ready - firmware 2.0.0-mqtt-cmd protocol 2.0',
      device: 'nila-E0F908',
      protocol: '2.0',
      cmd: 'ping',
      request_id: 'boot',
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
      uptime_s: 18156,
      received_at: new Date().toISOString()
    };
    this.ackHistory.push({ ...this.latestAck });
  }

  public connect(newBrokerUrl?: string, newBaseTopic?: string) {
    if (newBrokerUrl) this.brokerUrl = newBrokerUrl;
    if (newBaseTopic) {
      this.baseTopic = newBaseTopic.replace(/\/+$/, '');
      this.topic = `${this.baseTopic}/+/telemetry`;
    }

    if (this.client) {
      try {
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
        console.log(`[MQTT] Connected to ${this.brokerUrl}`);
        
        // Subscribe to all device subtopics in wildcard: telemetry, ack, config, status
        const subTopics = [
          `${this.baseTopic}/#`,
          `${this.baseTopic}/+/telemetry`,
          `${this.baseTopic}/+/ack`,
          `${this.baseTopic}/+/config`,
          `${this.baseTopic}/+/status`,
          `aquaculture/nila/data/#`
        ];

        subTopics.forEach((tp) => {
          this.client?.subscribe(tp, (err) => {
            if (err) {
              console.error(`[MQTT] Subscribe error on ${tp}:`, err);
            } else {
              console.log(`[MQTT] Subscribed to ${tp}`);
            }
          });
        });

        this.emit('status', { connected: true, broker: this.brokerUrl, baseTopic: this.baseTopic });
      });

      this.client.on('message', (topic, message) => {
        try {
          const str = message.toString();
          this.lastMessageTime = Date.now();
          this.messageCount++;

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
            this.emit('device_status', { status: this.deviceStatus, topic, timestamp: new Date().toISOString() });
          } else {
            // General JSON fallback
            try {
              const parsed = JSON.parse(str);
              if (parsed.ph !== undefined || parsed.do_mg_l !== undefined) {
                this.handleIncomingTelemetry(parsed);
              } else if (parsed.status === 'ok' || parsed.status === 'error') {
                this.handleIncomingAck(parsed);
              }
            } catch {}
          }
        } catch (err) {
          console.error('[MQTT] Failed to handle message on topic:', topic, err);
        }
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        this.connectionError = err.message;
        console.error('[MQTT] Connection error:', err);
        this.emit('status', { connected: false, error: err.message });
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.emit('status', { connected: false });
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
      status: (data.status === 'error' ? 'error' : 'ok'),
      message: data.message || (data.status === 'ok' ? 'Success' : 'Error'),
      device: data.device || this.defaultDeviceId,
      protocol: data.protocol || '2.0',
      cmd: data.cmd || '',
      request_id: data.request_id || '',
      timestamp: data.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
      uptime_s: data.uptime_s || 0,
      received_at: new Date().toISOString()
    };

    this.latestAck = ack;
    this.ackHistory.unshift(ack);
    if (this.ackHistory.length > 200) {
      this.ackHistory.pop();
    }

    this.emit('ack', ack);
    console.log(`[MQTT ACK] [${ack.status.toUpperCase()}] cmd: ${ack.cmd || 'N/A'} - ${ack.message}`);
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

  public handleIncomingTelemetry(data: Partial<TelemetryPayload>) {
    this.lastMessageTime = Date.now();
    this.messageCount++;

    const payload: TelemetryPayload = {
      device: data.device || 'nila-E0F908',
      firmware_version: data.firmware_version || '2.0.0-mqtt-cmd',
      command_protocol: data.command_protocol || '2.0',
      timestamp: data.timestamp || new Date().toISOString().replace('T', ' ').substring(0, 19),
      uptime_s: typeof data.uptime_s === 'number' ? data.uptime_s : (this.latestTelemetry?.uptime_s || 0) + 5,
      ph: typeof data.ph === 'number' ? data.ph : (data.ph === null ? null : (this.latestTelemetry?.ph ?? 7.65)),
      ph_mv: typeof data.ph_mv === 'number' ? data.ph_mv : (this.latestTelemetry?.ph_mv ?? 2598),
      ph_cal_401: data.ph_cal_401 ?? true,
      ph_cal_686: data.ph_cal_686 ?? true,
      ph_cal_918: data.ph_cal_918 ?? true,
      do_mg_l: typeof data.do_mg_l === 'number' ? data.do_mg_l : (data.do_mg_l === null ? null : (this.latestTelemetry?.do_mg_l ?? 7.89)),
      do_saturation_pct: typeof data.do_saturation_pct === 'number' ? data.do_saturation_pct : (data.do_saturation_pct === null ? null : (this.latestTelemetry?.do_saturation_pct ?? 98.7)),
      water_temperature_c: typeof data.water_temperature_c === 'number' ? data.water_temperature_c : (data.water_temperature_c === null ? null : (this.latestTelemetry?.water_temperature_c ?? 26.6)),
      do_ok: data.do_ok ?? (data.do_mg_l !== null && data.do_mg_l !== undefined),
      modbus_code: typeof data.modbus_code === 'number' ? data.modbus_code : 0,
      do_raw: Array.isArray(data.do_raw) ? data.do_raw : [16252, 49569, 16636, 39993, 16852, 64058],
      do_salinity_ppt: typeof data.do_salinity_ppt === 'number' ? data.do_salinity_ppt : 0,
      do_atmospheric_pressure_kpa: typeof data.do_atmospheric_pressure_kpa === 'number' ? data.do_atmospheric_pressure_kpa : 101.33,
      wifi_connected: data.wifi_connected ?? true,
      wifi_rssi: typeof data.wifi_rssi === 'number' ? data.wifi_rssi : -76,
      ip: data.ip || '192.168.18.187',
      ap_active: data.ap_active ?? true,
      ap_ip: data.ap_ip || '192.168.4.1',
      mqtt_connected: data.mqtt_connected ?? true,
      received_at: new Date().toISOString()
    };

    this.latestTelemetry = payload;
    this.telemetryHistory.push(payload);

    // Keep ring buffer limited to last 1000 items
    if (this.telemetryHistory.length > 1000) {
      this.telemetryHistory.shift();
    }

    this.emit('telemetry', payload);
  }

  public publishCommand(
    command: string,
    params: Record<string, any> = {},
    options?: { deviceId?: string; token?: string; requestId?: string; targetTopic?: string }
  ) {
    return new Promise((resolve, reject) => {
      if (!this.client || !this.isConnected) {
        return reject(new Error('MQTT Broker tidak terhubung'));
      }

      const deviceId = options?.deviceId || params.device_id || this.defaultDeviceId;
      const targetTopic = options?.targetTopic || `${this.baseTopic}/${deviceId}/command`;
      const requestId = options?.requestId || params.request_id || `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const token = options?.token || params.token || 'change-this-token';

      // Construct command payload according to NilaWaterMonitor.ino v2 format
      const payloadObj: Record<string, any> = {
        cmd: command,
        request_id: requestId,
        token: token,
        ...params
      };

      const payloadStr = JSON.stringify(payloadObj);

      this.client.publish(targetTopic, payloadStr, { qos: 1 }, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`[MQTT] Published command to ${targetTopic}:`, payloadStr);

          // If simulation is active or in dev mode without real ESP32, generate instant mock ACK for immediate UI feedback
          if (this.simulationActive) {
            setTimeout(() => {
              let mockMsg = 'Command executed successfully';
              if (command.startsWith('cal_ph_')) {
                const point = command.replace('cal_ph_', '');
                mockMsg = `ph_${point === '401' ? '4.01' : point === '686' ? '6.86' : '9.18'}_saved_at_${(2500 + Math.random() * 50).toFixed(1)}mV`;
              } else if (command === 'cal_ph_finish') {
                mockMsg = 'ph_3_point_calibration_ready';
              } else if (command === 'cal_do_100') {
                mockMsg = 'do_100_percent_calibration_written';
              } else if (command === 'cal_do_zero') {
                mockMsg = 'do_zero_calibration_written';
              } else if (command === 'sync_time') {
                mockMsg = `time_synced_${new Date().toISOString().replace('T', ' ').substring(0, 19)}`;
              } else if (command === 'ota_update' || command === 'update_firmware') {
                mockMsg = 'ota_download_started';
                setTimeout(() => {
                  this.handleIncomingAck({
                    cmd: command,
                    request_id: requestId,
                    status: 'ok',
                    message: 'ota_success_restarting'
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
                uptime_s: this.latestTelemetry?.uptime_s || 18200
              });
            }, 600);
          }

          resolve({
            success: true,
            command,
            requestId,
            topic: targetTopic,
            payload: payloadObj,
            timestamp: new Date().toISOString()
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
        const basePh = 7.5 + Math.sin(Date.now() / 60000) * 0.3 + (Math.random() - 0.5) * 0.05;
        const baseDo = 6.8 + Math.cos(Date.now() / 90000) * 1.1 + (Math.random() - 0.5) * 0.1;
        const baseTemp = 27.2 + Math.sin(Date.now() / 120000) * 1.5 + (Math.random() - 0.5) * 0.08;

        this.handleIncomingTelemetry({
          device: 'nila-E0F908',
          timestamp: now.toISOString().replace('T', ' ').substring(0, 19),
          uptime_s: (this.latestTelemetry?.uptime_s || 18000) + 3,
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
          do_raw: [16250 + Math.floor(Math.random() * 20), 49560 + Math.floor(Math.random() * 20), 16630, 39990, 16850, 64050],
          do_salinity_ppt: 0,
          do_atmospheric_pressure_kpa: 101.32,
          wifi_connected: true,
          wifi_rssi: -65 + Math.floor((Math.random() - 0.5) * 6),
          ip: '192.168.18.187',
          ap_active: true,
          ap_ip: '192.168.4.1',
          mqtt_connected: true
        });
      }, 3000);
    } else {
      if (this.simInterval) {
        clearInterval(this.simInterval);
        this.simInterval = null;
      }
    }

    return this.simulationActive;
  }

  public getStatus() {
    return {
      connected: this.isConnected,
      broker: this.brokerUrl,
      topic: this.topic,
      cmdTopic: this.cmdTopic,
      error: this.connectionError,
      lastMessageTime: this.lastMessageTime,
      messageCount: this.messageCount,
      simulationActive: this.simulationActive,
      historyCount: this.telemetryHistory.length,
    };
  }
}

export const mqttService = new MqttAquacultureService();
