import { SystemSpecs } from '../types';

export async function detectRefreshRate(): Promise<number> {
  return new Promise((resolve) => {
    const samples: number[] = [];
    let last = 0;
    const count = 18;
    const step = (ts: number) => {
      if (last > 0) {
        const dt = ts - last;
        if (dt > 2 && dt < 100) samples.push(1000 / dt);
      }
      last = ts;
      if (samples.length >= count) {
        samples.sort((a, b) => a - b);
        const median = samples[Math.floor(samples.length / 2)] || 60;
        const standard = [60, 75, 90, 100, 120, 144, 165, 240, 360];
        let closest = Math.round(median);
        for (const hz of standard) {
          if (Math.abs(median - hz) <= 4) {
            closest = hz;
            break;
          }
        }
        resolve(closest);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

export async function getSystemSpecs(): Promise<SystemSpecs> {
  const nav = navigator as any;
  const ua: string = nav.userAgent || '';

  // Universal High-Entropy Client Hints (works across Windows 10/11, macOS Intel/Apple Silicon, Linux, ChromeOS, Android)
  let arch = '';
  let bitness = '';
  let deviceModel = '';
  let platformVer = '';
  let hintPlatform = '';

  try {
    if (nav.userAgentData?.getHighEntropyValues) {
      const hints = await nav.userAgentData.getHighEntropyValues([
        'architecture',
        'bitness',
        'model',
        'platform',
        'platformVersion',
      ]);
      arch = hints.architecture || '';
      bitness = hints.bitness || '';
      deviceModel = hints.model || '';
      platformVer = hints.platformVersion || '';
      hintPlatform = hints.platform || '';
    }
  } catch {
    // Ignore restricted client hints
  }

  let os = 'Nieznany system';
  if (/Windows/i.test(hintPlatform) || /Windows NT/i.test(ua)) {
    const majorVer = parseInt(platformVer.split('.')[0] || '0', 10);
    if (majorVer >= 13) os = 'Windows 11';
    else if (majorVer >= 1) os = 'Windows 10';
    else if (/Windows NT 10\.0/i.test(ua)) os = 'Windows 10 / 11';
    else os = 'Windows';
  } else if (/macOS|Mac/i.test(hintPlatform) || /Mac OS X/i.test(ua)) {
    os = platformVer ? `macOS ${platformVer.split('.').slice(0, 2).join('.')}` : 'macOS';
  } else if (/Chrome OS|CrOS/i.test(hintPlatform) || /CrOS/i.test(ua)) {
    os = 'ChromeOS';
  } else if (/Android/i.test(hintPlatform) || /Android/i.test(ua)) {
    os = deviceModel ? `Android (${deviceModel})` : 'Android';
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    os = 'iOS / iPadOS';
  } else if (/Linux/i.test(hintPlatform) || /Linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Przeglądarka Web';
  if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
  else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
  else if (/Firefox\//i.test(ua)) browser = 'Mozilla Firefox';
  else if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) browser = 'Google Chrome';
  else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Apple Safari';

  let gpuRenderer = 'Nieznany układ GPU';
  let gpuVendor = 'Nieznany producent';
  let webglVersion = 'Brak WebGL';
  let maxTextureSize = 0;

  // Probe WebGPU adapter info first (provides rich architecture/device info on modern PC/Mac/Laptops)
  let webgpuSummary = '';
  try {
    if (nav.gpu?.requestAdapter) {
      const adapter = await nav.gpu.requestAdapter({ powerPreference: 'high-performance' });
      const info = adapter?.info;
      if (info) {
        const parts = [info.vendor, info.architecture, info.device, info.description].filter(Boolean);
        if (parts.length > 0) webgpuSummary = parts.join(' ');
      }
    }
  } catch {
    // WebGPU optional
  }

  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    const gl = gl2 || canvas.getContext('webgl');
    if (gl) {
      webglVersion = gl2 ? 'WebGL 2.0' : 'WebGL 1.0';
      maxTextureSize = Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) || 0;
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        gpuVendor = String(gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || gpuVendor);
        gpuRenderer = String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || gpuRenderer);
      } else {
        gpuRenderer = String(gl.getParameter(gl.RENDERER) || gpuRenderer);
        gpuVendor = String(gl.getParameter(gl.VENDOR) || gpuVendor);
      }
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch {
    // Ignore probe errors
  }

  if (webgpuSummary && (/SwiftShader|ANGLE \(Google|WebGL/i.test(gpuRenderer) || gpuRenderer === 'Nieznany układ GPU')) {
    gpuRenderer = `${gpuRenderer} | WebGPU: ${webgpuSummary}`;
  } else if (webgpuSummary && !gpuRenderer.toLowerCase().includes(webgpuSummary.toLowerCase().slice(0, 12))) {
    webglVersion = `${webglVersion} + WebGPU`;
  }

  // Detect CPU architecture + Laptop vs Desktop heuristic
  const archStr = arch
    ? `${arch.toUpperCase()}${bitness ? ` ${bitness}-bit` : ''}`
    : /ARM|aarch64/i.test(ua) || /Apple M\d/i.test(gpuRenderer)
      ? 'ARM64'
      : 'x86-64';

  let formFactor = 'PC / Laptop';
  try {
    if (typeof nav.getBattery === 'function') {
      const bat = await nav.getBattery();
      if (bat && (!bat.charging || bat.level < 0.99 || Number.isFinite(bat.dischargingTime))) {
        formFactor = 'Laptop / Mobilny';
      } else {
        formFactor = window.screen.width >= 2200 ? 'Komputer Stacjonarny / Stacja robocza' : 'Laptop / PC';
      }
    }
  } catch {
    // Ignore
  }

  const platformBase = hintPlatform || nav.platform || 'Desktop';
  const platform = `${platformBase} · ${archStr} · ${formFactor}${deviceModel ? ` · ${deviceModel}` : ''}`;

  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  let storageQuotaGB: number | null = null;
  let storageUsageMB: number | null = null;
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      if (est.quota) storageQuotaGB = Number((est.quota / 1024 ** 3).toFixed(1));
      if (est.usage !== undefined) storageUsageMB = Number((est.usage / 1024 ** 2).toFixed(1));
    }
  } catch {
    // Ignore storage estimate failure
  }

  const estimatedRefreshRate = await detectRefreshRate();

  return {
    os,
    browser,
    platform,
    cpuCores: nav.hardwareConcurrency || 4,
    deviceMemory: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : 'Nieznana',
    gpuRenderer,
    gpuVendor,
    webglVersion,
    maxTextureSize,
    screenResolution: `${window.screen.width} × ${window.screen.height}`,
    viewportSize: `${window.innerWidth} × ${window.innerHeight}`,
    colorDepth: window.screen.colorDepth || 24,
    devicePixelRatio: Number((window.devicePixelRatio || 1).toFixed(2)),
    estimatedRefreshRate,
    online: navigator.onLine,
    connectionType: conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : 'Ethernet / Wi-Fi',
    downlink: typeof conn?.downlink === 'number' ? conn.downlink : 'Nieznana',
    rtt: typeof conn?.rtt === 'number' ? conn.rtt : 'Nieznana',
    storageQuotaGB,
    storageUsageMB,
  };
}
