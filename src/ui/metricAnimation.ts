export interface MetricAnimationOptions {
  durationMs?: number;
}

const activeAnimationFrames = new WeakMap<HTMLElement, number>();
const activeHighlightTimers = new WeakMap<HTMLElement, number>();

export function formatAnimatedMetricNumber(
  value: number,
  decimals = 0,
  useLocale = true,
  prefix = '',
  suffix = ''
): string {
  const safeVal = Number.isFinite(value) ? value : 0;
  const rounded = decimals > 0 ? Number(safeVal.toFixed(decimals)) : Math.round(safeVal);
  const formatted = useLocale
    ? rounded.toLocaleString('pl-PL', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })
    : rounded.toFixed(decimals);
  return `${prefix}${formatted}${suffix}`;
}

export function animateMetricValueElements(
  container: ParentNode | null | undefined,
  previousValues: Map<string, number>,
  options: MetricAnimationOptions = {}
): void {
  if (!container) return;
  const durationMs = Math.max(120, Math.min(1200, options.durationMs ?? 380));
  const elements = container.querySelectorAll<HTMLElement>('.metric-value[data-metric-key]');
  const reduceMotion =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  elements.forEach((el) => {
    const key = el.dataset.metricKey;
    const rawTarget = el.dataset.metricTarget;
    if (!key || rawTarget === undefined) return;

    const target = Number(rawTarget);
    if (!Number.isFinite(target) || target <= 0) {
      if (target === 0) previousValues.set(key, 0);
      return;
    }

    const prev = previousValues.get(key);
    previousValues.set(key, target);

    if (prev === undefined || Math.abs(prev - target) < 0.0001) {
      return;
    }

    const decimals = Math.max(0, Math.min(4, Number(el.dataset.metricDecimals || '0') || 0));
    const useLocale = el.dataset.metricLocale !== 'false';
    const prefix = el.dataset.metricPrefix || '';
    const suffix = el.dataset.metricSuffix || '';

    const prevRaf = activeAnimationFrames.get(el);
    if (prevRaf !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(prevRaf);
      activeAnimationFrames.delete(el);
    }
    const prevTimer = activeHighlightTimers.get(el);
    if (prevTimer !== undefined) {
      clearTimeout(prevTimer);
      activeHighlightTimers.delete(el);
    }

    if (reduceMotion || typeof requestAnimationFrame !== 'function') {
      el.textContent = formatAnimatedMetricNumber(target, decimals, useLocale, prefix, suffix);
      el.classList.remove('is-updating');
      return;
    }

    el.textContent = formatAnimatedMetricNumber(prev, decimals, useLocale, prefix, suffix);
    el.classList.remove('is-updating');
    // Force style frame before applying transition class so CSS transition always fires
    const startRaf = requestAnimationFrame(() => {
      if (!el.isConnected) return;
      el.classList.add('is-updating');
      const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();

      const step = (now: number) => {
        if (!el.isConnected) {
          activeAnimationFrames.delete(el);
          return;
        }
        const elapsed = Math.max(0, now - startTime);
        const t = Math.min(1, elapsed / durationMs);
        const eased = 1 - Math.pow(1 - t, 3);
        const current = prev + (target - prev) * eased;
        el.textContent = formatAnimatedMetricNumber(current, decimals, useLocale, prefix, suffix);

        if (t < 1) {
          const nextId = requestAnimationFrame(step);
          activeAnimationFrames.set(el, nextId);
        } else {
          el.textContent = formatAnimatedMetricNumber(target, decimals, useLocale, prefix, suffix);
          activeAnimationFrames.delete(el);
          const settleTimer = window.setTimeout(() => {
            if (el.isConnected) el.classList.remove('is-updating');
            activeHighlightTimers.delete(el);
          }, 260);
          activeHighlightTimers.set(el, settleTimer);
        }
      };

      const id = requestAnimationFrame(step);
      activeAnimationFrames.set(el, id);
    });
    activeAnimationFrames.set(el, startRaf);
  });
}
