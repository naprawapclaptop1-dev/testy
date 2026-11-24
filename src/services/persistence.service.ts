import {
  BatteryPowerCycleEntry,
  CpuTestResult,
  DiagnosticLogEntry,
  DiskTestResult,
  FanCurveConfig,
  GameBenchMetrics,
  GpuStressMetrics,
  NetworkTestResult,
  RamTestResult,
  ScheduledTestItem,
  SchedulerSummaryReport,
  StressSessionRecord,
} from '../types';

const DB_NAME = 'SystemPulseProStorage';
const DB_VERSION = 2;
const SNAPSHOT_STORE = 'diagnostic_snapshots';
const LOGS_STORE = 'diagnostic_logs';
const LATEST_KEY = 'latest_benchmark_state';
const MAX_LOGS = 500;

export interface PersistedDiagnosticState {
  savedAt: number;
  lastSuiteTimestamp: number | null;
  ramSizeMB: number;
  cpuState: CpuTestResult;
  ramState: RamTestResult;
  diskState: DiskTestResult;
  gpuState: GpuStressMetrics;
  gameState?: GameBenchMetrics;
  networkState?: NetworkTestResult;
  batteryCalibration: {
    designCapacityMWh: number;
    fullChargeCapacityMWh: number;
  };
  batteryPowerCycles?: BatteryPowerCycleEntry[];
  schedulerQueue?: ScheduledTestItem[];
  lastSchedulerReport?: SchedulerSummaryReport | null;
  fanCurve?: FanCurveConfig;
  stressHistory?: StressSessionRecord[];
}

function csvEscape(val: string | number | undefined): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

class PersistenceService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
          db.createObjectStore(SNAPSHOT_STORE);
        }
        if (!db.objectStoreNames.contains(LOGS_STORE)) {
          db.createObjectStore(LOGS_STORE, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        this.dbPromise = null;
        reject(req.error);
      };
    });
    return this.dbPromise;
  }

  public async saveState(snapshot: PersistedDiagnosticState): Promise<boolean> {
    try {
      const db = await this.openDb();
      return await new Promise<boolean>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
        tx.objectStore(SNAPSHOT_STORE).put(snapshot, LATEST_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      return false;
    }
  }

  public async loadState(): Promise<PersistedDiagnosticState | null> {
    try {
      const db = await this.openDb();
      return await new Promise<PersistedDiagnosticState | null>((resolve, reject) => {
        const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
        const req = tx.objectStore(SNAPSHOT_STORE).get(LATEST_KEY);
        req.onsuccess = () => resolve((req.result as PersistedDiagnosticState) || null);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return null;
    }
  }

  public async appendLog(
    entry: Omit<DiagnosticLogEntry, 'id' | 'timestamp' | 'isoTime'>
  ): Promise<void> {
    try {
      const db = await this.openDb();
      const now = Date.now();
      const record: Omit<DiagnosticLogEntry, 'id'> = {
        timestamp: now,
        isoTime: new Date(now).toISOString(),
        ...entry,
      };
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(LOGS_STORE, 'readwrite');
        const store = tx.objectStore(LOGS_STORE);
        store.add(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Prune oldest entries if exceeding MAX_LOGS
      const all = await this.getAllLogs();
      if (all.length > MAX_LOGS) {
        const excess = all.slice(0, all.length - MAX_LOGS);
        await new Promise<void>((resolve) => {
          const tx = db.transaction(LOGS_STORE, 'readwrite');
          const store = tx.objectStore(LOGS_STORE);
          for (const item of excess) {
            if (item.id !== undefined) store.delete(item.id);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch {
      // Ignore log persistence failure in restricted browsers
    }
  }

  public async appendLogsBatch(
    entries: Array<Omit<DiagnosticLogEntry, 'id' | 'timestamp' | 'isoTime'>>
  ): Promise<void> {
    if (!entries || entries.length === 0) return;
    try {
      const db = await this.openDb();
      const now = Date.now();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(LOGS_STORE, 'readwrite');
        const store = tx.objectStore(LOGS_STORE);
        for (const entry of entries) {
          const record: Omit<DiagnosticLogEntry, 'id'> = {
            timestamp: now,
            isoTime: new Date(now).toISOString(),
            ...entry,
          };
          store.add(record);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });

      // Prune oldest entries if exceeding MAX_LOGS
      const all = await this.getAllLogs();
      if (all.length > MAX_LOGS) {
        const excess = all.slice(0, all.length - MAX_LOGS);
        await new Promise<void>((resolve) => {
          const tx = db.transaction(LOGS_STORE, 'readwrite');
          const store = tx.objectStore(LOGS_STORE);
          for (const item of excess) {
            if (item.id !== undefined) store.delete(item.id);
          }
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      }
    } catch {
      // Ignore batch log persistence failure
    }
  }

  public async getAllLogs(): Promise<DiagnosticLogEntry[]> {
    try {
      const db = await this.openDb();
      return await new Promise<DiagnosticLogEntry[]>((resolve, reject) => {
        const tx = db.transaction(LOGS_STORE, 'readonly');
        const req = tx.objectStore(LOGS_STORE).getAll();
        req.onsuccess = () => resolve((req.result as DiagnosticLogEntry[]) || []);
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  public async downloadLogsAsCsv(): Promise<number> {
    const logs = await this.getAllLogs();
    const headers = ['ID', 'Timestamp_ISO', 'Modul', 'Poziom', 'Zdarzenie', 'Metryka', 'Wartosc', 'Szczegoly'];
    const rows = logs.map((l, idx) =>
      [
        l.id ?? idx + 1,
        l.isoTime,
        l.module,
        l.level,
        l.event,
        l.metric,
        l.value,
        l.details,
      ]
        .map(csvEscape)
        .join(',')
    );

    // UTF-8 BOM for proper Polish diacritics in Microsoft Excel / LibreOffice Calc
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `systempulse-logi-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    return logs.length;
  }

  public async clearAll(): Promise<void> {
    try {
      const db = await this.openDb();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction([SNAPSHOT_STORE, LOGS_STORE], 'readwrite');
        tx.objectStore(SNAPSHOT_STORE).delete(LATEST_KEY);
        tx.objectStore(LOGS_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      // Ignore
    }
  }
}

export const persistenceService = new PersistenceService();
