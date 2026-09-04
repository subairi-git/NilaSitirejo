import { Collection, Db, MongoClient } from 'mongodb';
import type { TelemetryPayload } from './mqttService';

export interface PltsSnapshot {
  pvPowerW: number | null;
  pvPowerKW: number | null;
  batterySocPct: number | null;
  batteryPowerW: number | null;
  loadPowerW: number | null;
  gridPowerW: number | null;
  gridVoltageV: number | null;
  gridFrequencyHz: number | null;
  loadCurrentA: number | null;
  workingState: string | null;
  isGridActive: boolean | null;
  isGridAvailable: boolean | null;
  batteryDirection: string | null;
  gridDirection: string | null;
  connected: boolean;
  lastUpdated: string | null;
}

export interface TelemetryDocument extends TelemetryPayload {
  recordedAt: Date;
  bucket5m: Date;
  plts?: PltsSnapshot | null;
}

export interface MetricStats {
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface TelemetryStats {
  count: number;
  firstRecordedAt: string | null;
  lastRecordedAt: string | null;
  ph: MetricStats;
  dissolvedOxygen: MetricStats;
  temperature: MetricStats;
  plts: {
    pvPowerW: MetricStats;
    batterySocPct: MetricStats;
    loadPowerW: MetricStats;
    gridPowerW: MetricStats;
    gridAvailableCount: number;
    gridActiveCount: number;
    latestGridAvailable: boolean | null;
    latestGridActive: boolean | null;
  };
}

const FIVE_MINUTES_MS = 5 * 60 * 1000;
const MAX_HISTORY_LIMIT = 10000;

function normalizeDays(days: number): number {
  if (days === 7 || days === 30) return days;
  return 1;
}

function toNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function summarize(values: Array<number | null>): MetricStats {
  const valid = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (valid.length === 0) {
    return { avg: null, min: null, max: null };
  }

  const sum = valid.reduce((total, value) => total + value, 0);
  return {
    avg: Number((sum / valid.length).toFixed(3)),
    min: Number(Math.min(...valid).toFixed(3)),
    max: Number(Math.max(...valid).toFixed(3)),
  };
}

class DatabaseService {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private telemetryCollection: Collection<TelemetryDocument> | null = null;

  public isConnected = false;
  public lastError: string | null = null;
  public lastSavedAt: Date | null = null;

  async connect(): Promise<void> {
    const uri = process.env.MONGODB_URI;
    const dbName = process.env.MONGODB_DB || 'nilasitirejo';

    if (!uri) {
      this.lastError = 'MONGODB_URI belum diset';
      console.warn('[MongoDB] MONGODB_URI belum diset. Penyimpanan database dinonaktifkan.');
      return;
    }

    try {
      this.client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 10000,
      });

      await this.client.connect();
      await this.client.db('admin').command({ ping: 1 });

      this.db = this.client.db(dbName);
      this.telemetryCollection = this.db.collection<TelemetryDocument>('telemetry');

      await this.telemetryCollection.createIndex(
        { device: 1, bucket5m: 1 },
        { unique: true, name: 'uniq_device_bucket5m' }
      );
      await this.telemetryCollection.createIndex(
        { recordedAt: -1 },
        { name: 'recordedAt_desc' }
      );
      await this.telemetryCollection.createIndex(
        { device: 1, recordedAt: -1 },
        { name: 'device_recordedAt_desc' }
      );

      this.isConnected = true;
      this.lastError = null;

      console.log(`[MongoDB] Connected: database=${dbName}, collection=telemetry`);
    } catch (error: any) {
      this.isConnected = false;
      this.lastError = error?.message || String(error);
      console.error('[MongoDB] Connection error:', error);
    }
  }

  private getBucket5m(date = new Date()): Date {
    const bucketMs = Math.floor(date.getTime() / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
    return new Date(bucketMs);
  }

  async saveTelemetryIfDue(
    data: TelemetryPayload | null | undefined,
    plts: PltsSnapshot | null = null
  ): Promise<boolean> {
    if (!data || !this.telemetryCollection || !this.isConnected) return false;
    if (!data.device) return false;

    const now = new Date();
    const bucket5m = this.getBucket5m(now);

    try {
      const document: TelemetryDocument = {
        ...data,
        recordedAt: now,
        bucket5m,
        plts,
      };

      const result = await this.telemetryCollection.updateOne(
        { device: data.device, bucket5m },
        { $setOnInsert: document },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        this.lastSavedAt = now;
        console.log(
          `[MongoDB] Snapshot tersimpan: device=${data.device}, bucket=${bucket5m.toISOString()}, ` +
          `PV=${plts?.pvPowerW ?? 'NA'}W, Battery=${plts?.batterySocPct ?? 'NA'}%, ` +
          `Load=${plts?.loadPowerW ?? 'NA'}W, PLN=${plts?.isGridAvailable ?? 'NA'}`
        );
        return true;
      }

      return false;
    } catch (error: any) {
      if (error?.code === 11000) return false;
      this.lastError = error?.message || String(error);
      console.error('[MongoDB] Save telemetry error:', error);
      return false;
    }
  }

  async getHistory(options?: {
    days?: number;
    limit?: number;
    device?: string;
  }): Promise<TelemetryDocument[]> {
    if (!this.telemetryCollection || !this.isConnected) return [];

    const days = normalizeDays(Number(options?.days || 1));
    const limit = Math.min(
      Math.max(Number(options?.limit || MAX_HISTORY_LIMIT), 1),
      MAX_HISTORY_LIMIT
    );

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const query: Record<string, unknown> = {
      recordedAt: { $gte: since },
    };

    if (options?.device) query.device = options.device;

    return this.telemetryCollection
      .find(query)
      .sort({ recordedAt: 1 })
      .limit(limit)
      .toArray();
  }

  async getStats(days = 1, device?: string): Promise<TelemetryStats> {
    const history = await this.getHistory({
      days,
      device,
      limit: MAX_HISTORY_LIMIT,
    });

    const first = history[0];
    const last = history[history.length - 1];

    return {
      count: history.length,
      firstRecordedAt: first?.recordedAt?.toISOString?.() || null,
      lastRecordedAt: last?.recordedAt?.toISOString?.() || null,
      ph: summarize(history.map((row) => toNumberOrNull(row.ph))),
      dissolvedOxygen: summarize(history.map((row) => toNumberOrNull(row.do_mg_l))),
      temperature: summarize(history.map((row) => toNumberOrNull(row.water_temperature_c))),
      plts: {
        pvPowerW: summarize(history.map((row) => toNumberOrNull(row.plts?.pvPowerW))),
        batterySocPct: summarize(history.map((row) => toNumberOrNull(row.plts?.batterySocPct))),
        loadPowerW: summarize(history.map((row) => toNumberOrNull(row.plts?.loadPowerW))),
        gridPowerW: summarize(history.map((row) => toNumberOrNull(row.plts?.gridPowerW))),
        gridAvailableCount: history.filter((row) => row.plts?.isGridAvailable === true).length,
        gridActiveCount: history.filter((row) => row.plts?.isGridActive === true).length,
        latestGridAvailable: last?.plts?.isGridAvailable ?? null,
        latestGridActive: last?.plts?.isGridActive ?? null,
      },
    };
  }

  async countTelemetry(): Promise<number> {
    if (!this.telemetryCollection || !this.isConnected) return 0;
    return this.telemetryCollection.countDocuments();
  }

  async disconnect(): Promise<void> {
    try {
      await this.client?.close();
    } finally {
      this.client = null;
      this.db = null;
      this.telemetryCollection = null;
      this.isConnected = false;
    }
  }
}

export const databaseService = new DatabaseService();
