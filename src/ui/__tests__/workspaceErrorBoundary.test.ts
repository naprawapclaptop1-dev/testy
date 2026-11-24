import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  WorkspaceErrorBoundary,
  WorkspaceErrorRecord,
} from '../workspaceErrorBoundary';

interface MockButton {
  textContent: string;
  isConnected: boolean;
  addEventListener: (event: string, fn: (e: { currentTarget: MockButton }) => void) => void;
  click: () => void;
}

function createMockHost() {
  const buttons = new Map<string, MockButton>();

  const ensureButton = (selector: string): MockButton => {
    let existing = buttons.get(selector);
    if (!existing) {
      const listeners: Array<(e: { currentTarget: MockButton }) => void> = [];
      existing = {
        textContent: '',
        isConnected: true,
        addEventListener: (event: string, fn: (e: { currentTarget: MockButton }) => void) => {
          if (event === 'click') listeners.push(fn);
        },
        click: () => {
          for (const fn of listeners) fn({ currentTarget: existing! });
        },
      };
      buttons.set(selector, existing);
    }
    return existing;
  };

  const host = {
    innerHTML: '',
    querySelector: (selector: string) => {
      if (
        selector === '#error-boundary-retry-btn' ||
        selector === '#error-boundary-dashboard-btn' ||
        selector === '#error-boundary-copy-btn'
      ) {
        return ensureButton(selector);
      }
      return null;
    },
  };

  return {
    host: host as unknown as HTMLElement,
    getButton: (selector: string) => buttons.get(selector),
  };
}

describe('WorkspaceErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes through normal module rendering without recording an error', () => {
    const onError = vi.fn();
    const boundary = new WorkspaceErrorBoundary({ onError });
    const { host } = createMockHost();

    const ok = boundary.render('cpu', host, () => {
      host.innerHTML = '<div id="cpu-ok">CPU View</div>';
    });

    expect(ok).toBe(true);
    expect(host.innerHTML).toContain('CPU View');
    expect(boundary.getLastError()).toBeNull();
    expect(boundary.getErrorHistory()).toHaveLength(0);
    expect(onError).not.toHaveBeenCalled();
  });

  it('catches synchronous render errors, logs them, and renders a recovery fallback UI', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const logged: WorkspaceErrorRecord[] = [];
    const onRetry = vi.fn();
    const onReturnToDashboard = vi.fn();

    const boundary = new WorkspaceErrorBoundary({
      onError: (rec) => logged.push(rec),
      onRetry,
      onReturnToDashboard,
    });
    const { host, getButton } = createMockHost();

    const ok = boundary.render('gpu', host, () => {
      throw new TypeError('WebGL context lost unexpectedly');
    });

    expect(ok).toBe(false);
    expect(consoleSpy).toHaveBeenCalled();
    expect(logged).toHaveLength(1);
    expect(logged[0].module).toBe('gpu');
    expect(logged[0].moduleLabel).toBe('Karta graficzna (GPU 3D)');
    expect(logged[0].phase).toBe('render');
    expect(logged[0].name).toBe('TypeError');
    expect(logged[0].message).toBe('WebGL context lost unexpectedly');

    expect(boundary.getLastError()?.message).toBe('WebGL context lost unexpectedly');
    expect(boundary.getErrorHistory()).toHaveLength(1);
    expect(host.innerHTML).toContain('workspace-error-boundary');
    expect(host.innerHTML).toContain('Karta graficzna (GPU 3D)');
    expect(host.innerHTML).toContain('WebGL context lost unexpectedly');

    // Clicking Retry resets error state and calls onRetry with the failed module
    getButton('#error-boundary-retry-btn')?.click();
    expect(boundary.getLastError()).toBeNull();
    expect(onRetry).toHaveBeenCalledWith('gpu');

    // Clicking Return to Dashboard calls onReturnToDashboard
    getButton('#error-boundary-dashboard-btn')?.click();
    expect(onReturnToDashboard).toHaveBeenCalledTimes(1);
  });

  it('captures async module errors and caps history at 25 entries', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const boundary = new WorkspaceErrorBoundary();
    const { host } = createMockHost();

    for (let i = 0; i < 30; i++) {
      boundary.captureError('ram', host, new Error(`Async fault #${i}`), 'async');
    }

    const history = boundary.getErrorHistory();
    expect(history).toHaveLength(25);
    expect(history[0].message).toBe('Async fault #5');
    expect(history[24].message).toBe('Async fault #29');
    expect(boundary.getLastError()?.phase).toBe('async');
  });

  it('does not crash if onError callback itself throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const boundary = new WorkspaceErrorBoundary({
      onError: () => {
        throw new Error('IndexedDB unavailable');
      },
    });
    const { host } = createMockHost();

    const ok = boundary.render('disk', host, () => {
      throw new Error('Disk read timeout');
    });

    expect(ok).toBe(false);
    expect(host.innerHTML).toContain('Disk read timeout');
  });
});
