import { ActiveModule } from '../types';
import { iconSvg } from './icons';

export interface WorkspaceErrorRecord {
  module: ActiveModule;
  moduleLabel: string;
  phase: 'render' | 'async' | 'runtime';
  name: string;
  message: string;
  stack: string;
  timestamp: number;
}

export interface WorkspaceErrorBoundaryOptions {
  onError?: (record: WorkspaceErrorRecord) => void;
  onRetry?: (module: ActiveModule) => void;
  onReturnToDashboard?: () => void;
}

const MODULE_LABELS: Record<ActiveModule, string> = {
  dashboard: 'Pulpit główny',
  scheduler: 'Harmonogram testów',
  game: 'Gra 3D MAX (HYPERION)',
  cpu: 'Procesor (CPU)',
  ram: 'Pamięć RAM',
  disk: 'Dysk SSD/HDD i SMART',
  gpu: 'Karta graficzna (GPU 3D)',
  display: 'Diagnostyka ekranu',
  battery: 'Monitor baterii',
  peripherals: 'Peryferia i wentylatory',
  network: 'Sieć i opóźnienia',
};

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeError(err: unknown): { name: string; message: string; stack: string } {
  if (err instanceof Error) {
    return {
      name: err.name || 'Error',
      message: err.message || 'Nieznany błąd wykonania w module diagnostycznym.',
      stack: err.stack || `${err.name}: ${err.message}`,
    };
  }
  const msg = typeof err === 'string' ? err : JSON.stringify(err ?? 'Nieznany wyjątek');
  return {
    name: 'RuntimeError',
    message: msg || 'Nieznany błąd wykonania.',
    stack: msg,
  };
}

/**
 * Vanilla TypeScript Error Boundary component wrapping the main workspace host (`#workspace-host`).
 * Catches synchronous render crashes and unhandled module runtime errors, logs them via callback
 * (e.g. IndexedDB persistence), and renders a graceful recovery UI without breaking the shell.
 */
export class WorkspaceErrorBoundary {
  private options: WorkspaceErrorBoundaryOptions;
  private activeModule: ActiveModule = 'dashboard';
  private activeHost: HTMLElement | null = null;
  private lastError: WorkspaceErrorRecord | null = null;
  private errorLog: WorkspaceErrorRecord[] = [];
  private globalAttached = false;

  private readonly onWindowError = (event: ErrorEvent): void => {
    // Ignore benign ResizeObserver or cross-origin script noise
    if (event.message && /ResizeObserver loop/i.test(event.message)) return;
    if (!this.activeHost) return;
    const err = event.error ?? new Error(event.message || 'Nieobsłużony błąd skryptu');
    this.handleCaughtError(this.activeModule, this.activeHost, err, 'runtime');
  };

  private readonly onUnhandledRejection = (event: PromiseRejectionEvent): void => {
    if (!this.activeHost) return;
    this.handleCaughtError(this.activeModule, this.activeHost, event.reason, 'async');
  };

  constructor(options: WorkspaceErrorBoundaryOptions = {}) {
    this.options = options;
  }

  public attachGlobalListeners(): void {
    if (this.globalAttached || typeof window === 'undefined') return;
    window.addEventListener('error', this.onWindowError);
    window.addEventListener('unhandledrejection', this.onUnhandledRejection);
    this.globalAttached = true;
  }

  public detachGlobalListeners(): void {
    if (!this.globalAttached || typeof window === 'undefined') return;
    window.removeEventListener('error', this.onWindowError);
    window.removeEventListener('unhandledrejection', this.onUnhandledRejection);
    this.globalAttached = false;
  }

  public getLastError(): WorkspaceErrorRecord | null {
    return this.lastError;
  }

  public getErrorHistory(): WorkspaceErrorRecord[] {
    return [...this.errorLog];
  }

  public reset(): void {
    this.lastError = null;
  }

  /**
   * Executes a module render function inside the Error Boundary.
   * Returns `true` if rendering succeeded, or `false` if an error was caught and fallback rendered.
   */
  public render(module: ActiveModule, host: HTMLElement, renderFn: () => void): boolean {
    this.activeModule = module;
    this.activeHost = host;
    this.lastError = null;

    try {
      renderFn();
      return true;
    } catch (err) {
      this.handleCaughtError(module, host, err, 'render');
      return false;
    }
  }

  /**
   * Manually report an error caught in an async module operation into the boundary.
   */
  public captureError(
    module: ActiveModule,
    host: HTMLElement,
    err: unknown,
    phase: WorkspaceErrorRecord['phase'] = 'async'
  ): WorkspaceErrorRecord {
    return this.handleCaughtError(module, host, err, phase);
  }

  private handleCaughtError(
    module: ActiveModule,
    host: HTMLElement,
    err: unknown,
    phase: WorkspaceErrorRecord['phase']
  ): WorkspaceErrorRecord {
    const norm = normalizeError(err);
    const record: WorkspaceErrorRecord = {
      module,
      moduleLabel: MODULE_LABELS[module] || module,
      phase,
      name: norm.name,
      message: norm.message,
      stack: norm.stack,
      timestamp: Date.now(),
    };

    this.lastError = record;
    this.errorLog.push(record);
    if (this.errorLog.length > 25) {
      this.errorLog = this.errorLog.slice(-25);
    }

    console.error(`[WorkspaceErrorBoundary:${module}/${phase}]`, err);
    try {
      this.options.onError?.(record);
    } catch {
      // Never allow error logger failure to cascade
    }

    this.renderFallbackUi(host, record);
    return record;
  }

  private renderFallbackUi(host: HTMLElement, record: WorkspaceErrorRecord): void {
    const timeStr = new Date(record.timestamp).toLocaleTimeString('pl-PL');
    const isDashboard = record.module === 'dashboard';

    host.innerHTML = `
      <div class="panel stack-md" id="workspace-error-boundary" role="alert" style="border-color:var(--accent-rose);max-width:860px;margin:24px auto;">
        <div class="panel-header" style="margin-bottom:0;align-items:flex-start;gap:12px;">
          <div class="row-wrap" style="gap:10px;align-items:center;">
            <span class="status-err">${iconSvg('pulse', 20)}</span>
            <div>
              <h2 class="panel-title status-err">Błąd wykonania w module: ${esc(record.moduleLabel)}</h2>
              <span class="panel-caption">
                Granica błędów (Workspace Error Boundary) przechwyciła wyjątek i zabezpieczyła pozostałe moduły aplikacji.
              </span>
            </div>
          </div>
          <span class="font-mono" style="font-size:11.5px;color:var(--text-muted);">${esc(timeStr)} · ${esc(record.phase)}</span>
        </div>

        <div style="padding:12px 14px;border-radius:8px;background:var(--bg-inset);border:1px solid var(--border-hairline);">
          <div class="font-mono status-err" style="font-size:13px;font-weight:700;margin-bottom:4px;">
            ${esc(record.name)}: ${esc(record.message)}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);">
            Zdarzenie zostało automatycznie zapisane w dzienniku diagnostycznym IndexedDB (dostępne do eksportu CSV).
          </div>
        </div>

        <details style="font-size:12px;color:var(--text-secondary);">
          <summary style="cursor:pointer;font-weight:600;color:var(--text-primary);user-select:none;">
            Szczegóły techniczne (Stack Trace)
          </summary>
          <pre class="font-mono" style="margin:8px 0 0;padding:10px 12px;background:var(--bg-inset);border:1px solid var(--border-hairline);border-radius:6px;overflow-x:auto;font-size:11.5px;line-height:1.45;white-space:pre-wrap;word-break:break-word;">${esc(record.stack)}</pre>
        </details>

        <div class="row-wrap" style="gap:8px;">
          <button id="error-boundary-retry-btn" type="button" class="btn btn-primary btn-sm">
            Spróbuj ponownie (Odśwież moduł)
          </button>
          ${
            !isDashboard
              ? `<button id="error-boundary-dashboard-btn" type="button" class="btn btn-secondary btn-sm">Wróć na Pulpit</button>`
              : ''
          }
          <button id="error-boundary-copy-btn" type="button" class="btn btn-secondary btn-sm">
            Kopiuj raport błędu
          </button>
        </div>
      </div>
    `;

    host.querySelector<HTMLButtonElement>('#error-boundary-retry-btn')?.addEventListener('click', () => {
      this.reset();
      this.options.onRetry?.(record.module);
    });

    host.querySelector<HTMLButtonElement>('#error-boundary-dashboard-btn')?.addEventListener('click', () => {
      this.reset();
      this.options.onReturnToDashboard?.();
    });

    host.querySelector<HTMLButtonElement>('#error-boundary-copy-btn')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget as HTMLButtonElement;
      const report = JSON.stringify(record, null, 2);
      try {
        await navigator.clipboard?.writeText(report);
        btn.textContent = 'Skopiowano raport ✓';
        window.setTimeout(() => {
          if (btn.isConnected) btn.textContent = 'Kopiuj raport błędu';
        }, 2000);
      } catch {
        btn.textContent = 'Brak dostępu do schowka';
      }
    });
  }
}
