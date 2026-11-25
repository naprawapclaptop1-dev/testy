import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DISPLAY_PATTERNS,
  DisplayDiagnosticController,
  OLED_PROTECTION_DURATION_SEC,
  oledProtectionDurationSec,
  drawOledBurnInProtectionPattern,
  formatCountdownMmSs,
} from '../displayDiagnostics';

function createMockCanvasContext() {
  const colorStops: string[] = [];
  const createGradient = () => ({
    addColorStop: vi.fn((_offset: number, color: string) => {
      colorStops.push(color);
    }),
  });
  const ctx = {
    fillStyle: '' as string | CanvasGradient,
    fillRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    createLinearGradient: vi.fn(createGradient),
    createRadialGradient: vi.fn(createGradient),
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, colorStops };
}

interface FakeEl {
  tagName: string;
  className: string;
  dataset: Record<string, string>;
  style: Record<string, string>;
  textContent: string;
  children: FakeEl[];
  width: number;
  height: number;
  classList: { add: (c: string) => void; remove: (c: string) => void };
  listeners: Map<string, Array<(ev: unknown) => void>>;
  append: (...nodes: FakeEl[]) => void;
  appendChild: (node: FakeEl) => FakeEl;
  addEventListener: (name: string, fn: (ev: unknown) => void) => void;
  remove: () => void;
  getBoundingClientRect: () => { width: number; height: number };
  getContext: () => CanvasRenderingContext2D;
  onclick?: (ev: unknown) => void;
}

function setupFakeDom() {
  const bodyChildren: FakeEl[] = [];
  const windowListeners = new Map<string, Array<(ev: unknown) => void>>();
  const docListeners = new Map<string, Array<(ev: unknown) => void>>();

  const makeEl = (tag: string): FakeEl => {
    const el: FakeEl = {
      tagName: tag.toUpperCase(),
      className: '',
      dataset: {},
      style: {},
      textContent: '',
      children: [],
      width: 1280,
      height: 720,
      classList: {
        add: vi.fn(),
        remove: vi.fn(),
      },
      listeners: new Map(),
      append(...nodes: FakeEl[]) {
        el.children.push(...nodes);
      },
      appendChild(node: FakeEl) {
        el.children.push(node);
        return node;
      },
      addEventListener(name: string, fn: (ev: unknown) => void) {
        const list = el.listeners.get(name) ?? [];
        list.push(fn);
        el.listeners.set(name, list);
      },
      remove() {
        const idx = bodyChildren.indexOf(el);
        if (idx >= 0) bodyChildren.splice(idx, 1);
      },
      getBoundingClientRect: () => ({ width: 1280, height: 720 }),
      getContext: () => createMockCanvasContext().ctx,
    };
    return el;
  };

  const fakeDoc = {
    body: {
      children: bodyChildren,
      appendChild(node: FakeEl) {
        bodyChildren.push(node);
        return node;
      },
    },
    fullscreenElement: null,
    createElement: (tag: string) => makeEl(tag),
    addEventListener: (name: string, fn: (ev: unknown) => void) => {
      const list = docListeners.get(name) ?? [];
      list.push(fn);
      docListeners.set(name, list);
    },
    removeEventListener: (name: string, fn: (ev: unknown) => void) => {
      const list = docListeners.get(name) ?? [];
      docListeners.set(
        name,
        list.filter((f) => f !== fn)
      );
    },
  };

  const fakeWin = {
    devicePixelRatio: 1,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
    addEventListener: (name: string, fn: (ev: unknown) => void) => {
      const list = windowListeners.get(name) ?? [];
      list.push(fn);
      windowListeners.set(name, list);
    },
    removeEventListener: (name: string, fn: (ev: unknown) => void) => {
      const list = windowListeners.get(name) ?? [];
      windowListeners.set(
        name,
        list.filter((f) => f !== fn)
      );
    },
    dispatchKeydown: (key: string) => {
      for (const fn of [...(windowListeners.get('keydown') ?? [])]) {
        fn({ key, preventDefault: vi.fn() });
      }
    },
  };

  vi.stubGlobal('document', fakeDoc);
  vi.stubGlobal('window', fakeWin);
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());

  return { bodyChildren, fakeWin };
}

describe('OLED Burn-in Protection Mode', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('registers OLED Burn-in Protection pattern and defaults to 60 minutes (3600s)', () => {
    expect(OLED_PROTECTION_DURATION_SEC).toBe(3600);
    expect(formatCountdownMmSs(3600)).toBe('60:00');
    expect(formatCountdownMmSs(65)).toBe('01:05');
    expect(formatCountdownMmSs(-10)).toBe('00:00');

    const pat = DISPLAY_PATTERNS.find((p) => p.id === 'oled-burnin-protection');
    expect(pat).toBeDefined();
    expect(pat?.animated).toBe(true);
  });

  it('draws a moving, low-brightness pattern over a pure black base', () => {
    const { ctx, colorStops } = createMockCanvasContext();
    drawOledBurnInProtectionPattern(ctx, 1920, 1080, 12.5);

    expect((ctx.fillRect as unknown as ReturnType<typeof vi.fn>).mock.calls[0]).toEqual([
      0, 0, 1920, 1080,
    ]);
    expect(colorStops.length).toBeGreaterThan(0);
    // Ensure every non-transparent RGB stop stays strictly low-brightness (<= 40/255)
    for (const stop of colorStops) {
      const m = stop.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (m) {
        expect(Number(m[1])).toBeLessThanOrEqual(40);
        expect(Number(m[2])).toBeLessThanOrEqual(40);
        expect(Number(m[3])).toBeLessThanOrEqual(40);
      }
    }
  });

  it('runs for 60 minutes, emits countdown ticks, and auto-completes at 00:00', () => {
    const { bodyChildren } = setupFakeDom();
    const controller = new DisplayDiagnosticController();
    const ticks: number[] = [];
    const onComplete = vi.fn();
    const onStop = vi.fn();

    controller.startOledBurnInProtection({
      onTick: (remaining) => ticks.push(remaining),
      onComplete,
      onStop,
    });

    expect(controller.isOledProtectionActive()).toBe(true);
    expect(bodyChildren.length).toBe(1);
    expect(bodyChildren[0].dataset.oledProtection).toBe('active');
    expect(ticks[0]).toBe(3600);

    // Advance 20 minutes
    vi.advanceTimersByTime(20 * 60 * 1000);
    expect(controller.isOledProtectionActive()).toBe(true);
    expect(controller.getOledProtectionRemainingSec()).toBe(2400);

    // Advance remaining 40 minutes
    vi.advanceTimersByTime(40 * 60 * 1000);
    expect(controller.isOledProtectionActive()).toBe(false);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledWith(true);
    expect(bodyChildren.length).toBe(0);
  });

  it('stops cleanly on Escape key without triggering completion', () => {
    const { bodyChildren, fakeWin } = setupFakeDom();
    const controller = new DisplayDiagnosticController();
    const onComplete = vi.fn();
    const onStop = vi.fn();

    controller.startOledBurnInProtection({ onComplete, onStop });
    expect(controller.isOledProtectionActive()).toBe(true);
    expect(bodyChildren.length).toBe(1);

    fakeWin.dispatchKeydown('Escape');

    expect(controller.isOledProtectionActive()).toBe(false);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onStop).toHaveBeenCalledWith(false);
    expect(bodyChildren.length).toBe(0);
  });

  it('renders a visual remaining-time progress indicator inside .oled-protection-hud that depletes from 100% to 0%', () => {
    const { bodyChildren } = setupFakeDom();
    const controller = new DisplayDiagnosticController();

    controller.startOledBurnInProtection({ durationSec: 100 });

    const overlay = bodyChildren[0];
    const hud = overlay.children.find((el) => el.className.includes('oled-protection-hud'));
    expect(hud).toBeDefined();

    const progressWrap = hud!.children.find((el) => el.className.includes('oled-hud-progress-wrap'));
    expect(progressWrap).toBeDefined();

    const track = progressWrap!.children.find((el) => el.className.includes('oled-hud-progress-track'));
    const pctLabel = progressWrap!.children.find((el) => el.className.includes('oled-hud-remaining-pct'));
    expect(track).toBeDefined();
    expect(pctLabel).toBeDefined();

    const fill = track!.children.find((el) => el.className.includes('oled-hud-progress-fill'));
    expect(fill).toBeDefined();

    // Initially 100% remaining
    expect(fill!.style.width).toBe('100%');
    expect(pctLabel!.textContent).toBe('100%');
    expect(track!.dataset.remainingState).toBe('high');

    // After 75s of 100s -> 25% remaining (mid state)
    vi.advanceTimersByTime(75 * 1000);
    expect(fill!.style.width).toBe('25.0%');
    expect(pctLabel!.textContent).toBe('25%');
    expect(track!.dataset.remainingState).toBe('mid');

    // After 95s of 100s -> 5% remaining (low state)
    vi.advanceTimersByTime(20 * 1000);
    expect(fill!.style.width).toBe('5.0%');
    expect(pctLabel!.textContent).toBe('5%');
    expect(track!.dataset.remainingState).toBe('low');

    controller.stopOledBurnInProtection(false);
  });

  it('displays a dynamic MM:SS countdown element inside .oled-protection-hud synced with oledProtectionDurationSec', () => {
    const { bodyChildren } = setupFakeDom();
    const controller = new DisplayDiagnosticController();

    expect(oledProtectionDurationSec).toBe(OLED_PROTECTION_DURATION_SEC);
    controller.startOledBurnInProtection();

    const overlay = bodyChildren[0];
    const hud = overlay.children.find((el) => el.className.includes('oled-protection-hud'));
    const timer = hud!.children.find((el) => el.className.includes('oled-hud-timer'));
    expect(timer).toBeDefined();
    expect(timer!.dataset.durationSec).toBe(String(oledProtectionDurationSec));

    const countdown = timer!.children.find((el) => el.className.includes('oled-hud-countdown'));
    expect(countdown).toBeDefined();
    expect(countdown!.textContent).toBe(formatCountdownMmSs(oledProtectionDurationSec));

    // Advance 1 minute and 15 seconds (75s)
    vi.advanceTimersByTime(75 * 1000);
    expect(countdown!.textContent).toBe(formatCountdownMmSs(oledProtectionDurationSec - 75));
    expect(countdown!.dataset.remainingMmss).toBe('58:45');

    controller.stopOledBurnInProtection(false);
  });
});
