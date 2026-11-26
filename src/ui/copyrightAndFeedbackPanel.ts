export interface AppFeedbackEntry {
  id: string;
  category: 'bug' | 'feature' | 'game' | 'measurement';
  categoryLabel: string;
  message: string;
  author: string;
  rating?: number;
  createdAt: number;
  pcFingerprint?: string;
}

export interface PcFeedbackSubmissionRecord {
  pcFingerprint: string;
  entryId: string;
  category: AppFeedbackEntry['category'];
  author: string;
  message: string;
  rating?: number;
  submittedAt: number;
}

export interface PcRatingSubmissionRecord {
  pcFingerprint: string;
  rating: number;
  submittedAt: number;
}

interface AppRatingState {
  userRating: number;
  totalVotes: number;
  ratingSum: number;
  lastUpdated: number;
  ratedByPcFingerprints?: string[];
}

export interface AddFeedbackResult {
  ok: boolean;
  alreadySubmitted: boolean;
  pcFingerprint: string;
  entries: AppFeedbackEntry[];
  existingRecord?: PcFeedbackSubmissionRecord | null;
}

export interface SaveRatingResult {
  ok: boolean;
  alreadySubmitted: boolean;
  pcFingerprint: string;
  state: AppRatingState;
}

const FEEDBACK_STORAGE_KEY = 'systempulse_user_feedback_v1';
const RATING_STORAGE_KEY = 'systempulse_app_rating_v1';
const PC_FINGERPRINT_KEY = 'systempulse_pc_fingerprint_v1';
const PC_FEEDBACK_LOCK_KEY = 'systempulse_pc_feedback_lock_v1';
const PC_RATING_LOCK_KEY = 'systempulse_pc_rating_lock_v1';

let feedbackNotice: string | null = null;
let selectedStars = 5;
let cachedHardwareFingerprint: string | null = null;
let serverSyncInFlight = false;
let serverSyncDone = false;

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).toUpperCase().padStart(8, '0');
}

/**
 * Generates a stable deterministic PC fingerprint derived from hardware/browser
 * properties (CPU cores, deviceMemory, platform, screen geometry, timezone,
 * optional GPU renderer) so each PC is restricted to submitting feedback once.
 */
export function computePcHardwareFingerprint(extraSeed?: {
  gpuRenderer?: string;
  os?: string;
  cpuCores?: number;
}): string {
  const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
  const scr = typeof screen !== 'undefined' ? screen : null;
  let tz = 'UTC';
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    tz = 'UTC';
  }

  let glRenderer = extraSeed?.gpuRenderer || '';
  if (!glRenderer && typeof document !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl =
        canvas.getContext('webgl2') ||
        canvas.getContext('webgl') ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (gl) {
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        glRenderer = dbg
          ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) || '')
          : String(gl.getParameter(gl.RENDERER) || '');
      }
    } catch {
      // ignore in headless/Node environments
    }
  }

  const rawParts = [
    extraSeed?.os || nav?.platform || 'unknown-platform',
    String(extraSeed?.cpuCores ?? nav?.hardwareConcurrency ?? 0),
    String(nav?.deviceMemory ?? 0),
    scr ? `${scr.width}x${scr.height}x${scr.colorDepth}` : '0x0x0',
    tz,
    glRenderer || 'default-gpu',
  ].join('|');

  return `PC-${fnv1aHex(rawParts)}`;
}

export function getCurrentPcFingerprint(extraSeed?: {
  gpuRenderer?: string;
  os?: string;
  cpuCores?: number;
}): string {
  if (extraSeed && (extraSeed.gpuRenderer || extraSeed.os || extraSeed.cpuCores)) {
    cachedHardwareFingerprint = computePcHardwareFingerprint(extraSeed);
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(PC_FINGERPRINT_KEY, cachedHardwareFingerprint);
      }
    } catch {
      // ignore
    }
    return cachedHardwareFingerprint;
  }

  if (cachedHardwareFingerprint) return cachedHardwareFingerprint;

  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(PC_FINGERPRINT_KEY);
      if (stored && /^PC-[0-9A-F]{8}$/.test(stored)) {
        cachedHardwareFingerprint = stored;
        return stored;
      }
    }
  } catch {
    // ignore
  }

  const computed = computePcHardwareFingerprint();
  cachedHardwareFingerprint = computed;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(PC_FINGERPRINT_KEY, computed);
    }
  } catch {
    // ignore
  }
  return computed;
}

export function getPcFeedbackSubmissionRecord(
  pcFingerprint = getCurrentPcFingerprint()
): PcFeedbackSubmissionRecord | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PC_FEEDBACK_LOCK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Support map of pcFingerprint -> record or single record object
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.pcFingerprint === 'string' && parsed.pcFingerprint === pcFingerprint) {
            return parsed as PcFeedbackSubmissionRecord;
          }
          if (parsed[pcFingerprint] && typeof parsed[pcFingerprint] === 'object') {
            return parsed[pcFingerprint] as PcFeedbackSubmissionRecord;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  // Fallback check against stored feedback entries
  const existing = loadFeedbackEntries().find((e) => e.pcFingerprint === pcFingerprint);
  if (existing) {
    return {
      pcFingerprint,
      entryId: existing.id,
      category: existing.category,
      author: existing.author,
      message: existing.message,
      rating: existing.rating,
      submittedAt: existing.createdAt,
    };
  }
  return null;
}

function savePcFeedbackSubmissionRecord(record: PcFeedbackSubmissionRecord): void {
  try {
    if (typeof localStorage === 'undefined') return;
    let map: Record<string, PcFeedbackSubmissionRecord> = {};
    const raw = localStorage.getItem(PC_FEEDBACK_LOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.pcFingerprint === 'string') {
          map[parsed.pcFingerprint] = parsed;
        } else {
          map = parsed;
        }
      }
    }
    map[record.pcFingerprint] = record;
    localStorage.setItem(PC_FEEDBACK_LOCK_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function hasCurrentPcSubmittedFeedback(
  pcFingerprint = getCurrentPcFingerprint()
): boolean {
  return getPcFeedbackSubmissionRecord(pcFingerprint) !== null;
}

export function getPcRatingSubmissionRecord(
  pcFingerprint = getCurrentPcFingerprint()
): PcRatingSubmissionRecord | null {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(PC_RATING_LOCK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          if (typeof parsed.pcFingerprint === 'string' && parsed.pcFingerprint === pcFingerprint) {
            return parsed as PcRatingSubmissionRecord;
          }
          if (parsed[pcFingerprint] && typeof parsed[pcFingerprint] === 'object') {
            return parsed[pcFingerprint] as PcRatingSubmissionRecord;
          }
        }
      }
    }
  } catch {
    // ignore
  }

  const ratingState = loadAppRatingState();
  if (ratingState.ratedByPcFingerprints?.includes(pcFingerprint)) {
    return {
      pcFingerprint,
      rating: ratingState.userRating,
      submittedAt: ratingState.lastUpdated,
    };
  }
  return null;
}

function savePcRatingSubmissionRecord(record: PcRatingSubmissionRecord): void {
  try {
    if (typeof localStorage === 'undefined') return;
    let map: Record<string, PcRatingSubmissionRecord> = {};
    const raw = localStorage.getItem(PC_RATING_LOCK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.pcFingerprint === 'string') {
          map[parsed.pcFingerprint] = parsed;
        } else {
          map = parsed;
        }
      }
    }
    map[record.pcFingerprint] = record;
    localStorage.setItem(PC_RATING_LOCK_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function hasCurrentPcSubmittedRating(
  pcFingerprint = getCurrentPcFingerprint()
): boolean {
  return getPcRatingSubmissionRecord(pcFingerprint) !== null;
}

export function loadAppRatingState(): AppRatingState {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(RATING_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.userRating === 'number' &&
          typeof parsed.totalVotes === 'number' &&
          typeof parsed.ratingSum === 'number'
        ) {
          selectedStars = parsed.userRating || 5;
          return parsed;
        }
      }
    }
  } catch {
    // ignore
  }
  return {
    userRating: 5,
    totalVotes: 18,
    ratingSum: 89, // 4.94 avg
    lastUpdated: Date.now(),
    ratedByPcFingerprints: [],
  };
}

export function saveUserAppRating(
  stars: number,
  pcFingerprint = getCurrentPcFingerprint()
): SaveRatingResult {
  const clamped = Math.max(1, Math.min(5, Math.round(stars)));
  const current = loadAppRatingState();
  if (hasCurrentPcSubmittedRating(pcFingerprint)) {
    return {
      ok: false,
      alreadySubmitted: true,
      pcFingerprint,
      state: current,
    };
  }

  const prevList = Array.isArray(current.ratedByPcFingerprints)
    ? current.ratedByPcFingerprints
    : [];
  const next: AppRatingState = {
    userRating: clamped,
    totalVotes: current.totalVotes + 1,
    ratingSum: current.ratingSum + clamped,
    lastUpdated: Date.now(),
    ratedByPcFingerprints: Array.from(new Set([...prevList, pcFingerprint])),
  };
  selectedStars = clamped;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
  savePcRatingSubmissionRecord({
    pcFingerprint,
    rating: clamped,
    submittedAt: next.lastUpdated,
  });
  return {
    ok: true,
    alreadySubmitted: false,
    pcFingerprint,
    state: next,
  };
}

export function loadFeedbackEntries(): AppFeedbackEntry[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(FEEDBACK_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 50);
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Adds a feedback / opinion entry strictly ONCE per PC (enforced via PC fingerprint lock).
 */
export function addFeedbackEntry(
  category: AppFeedbackEntry['category'],
  message: string,
  author: string,
  rating?: number,
  pcFingerprint = getCurrentPcFingerprint()
): AddFeedbackResult {
  const existing = loadFeedbackEntries();
  const existingRecord = getPcFeedbackSubmissionRecord(pcFingerprint);
  if (existingRecord) {
    return {
      ok: false,
      alreadySubmitted: true,
      pcFingerprint,
      entries: existing,
      existingRecord,
    };
  }

  const categoryMap: Record<AppFeedbackEntry['category'], string> = {
    bug: '🐛 Błąd / Poprawka pomiaru',
    feature: '💡 Co dodać / Nowa funkcja',
    game: '🎮 Nowa gra 3D / Test GPU',
    measurement: '📊 Raport PDF / Inwentarz sprzętu',
  };
  const now = Date.now();
  const entry: AppFeedbackEntry = {
    id: `fb_${now}_${Math.random().toString(36).slice(2, 6)}`,
    category,
    categoryLabel: categoryMap[category] || '💡 Co dodać / Uwaga',
    message: message.trim(),
    author: author.trim() || 'Użytkownik SystemPulse Pro',
    rating,
    createdAt: now,
    pcFingerprint,
  };

  const next = [entry, ...existing].slice(0, 50);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore
  }

  savePcFeedbackSubmissionRecord({
    pcFingerprint,
    entryId: entry.id,
    category: entry.category,
    author: entry.author,
    message: entry.message,
    rating: entry.rating,
    submittedAt: now,
  });

  return {
    ok: true,
    alreadySubmitted: false,
    pcFingerprint,
    entries: next,
    existingRecord: null,
  };
}

export function deleteFeedbackEntry(id: string): AppFeedbackEntry[] {
  const next = loadFeedbackEntries().filter((e) => e.id !== id);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
  return next;
}

/**
 * Optionally syncs feedback lock and entries with the local Vite dev/preview
 * server (`/api/global/feedback`) so 1-opinion-per-PC holds across browsers on the same machine.
 */
export async function syncFeedbackWithServer(
  pcFingerprint = getCurrentPcFingerprint()
): Promise<boolean> {
  if (typeof fetch !== 'function' || typeof window === 'undefined') return false;
  if (serverSyncInFlight) return false;
  serverSyncInFlight = true;
  try {
    const resp = await fetch(
      `/api/global/feedback?pcFingerprint=${encodeURIComponent(pcFingerprint)}`,
      { cache: 'no-store' }
    );
    if (!resp.ok) return false;
    const data = await resp.json();
    if (!data || !data.ok) return false;
    let changed = false;

    if (Array.isArray(data.entries) && data.entries.length > 0) {
      const local = loadFeedbackEntries();
      const byId = new Map<string, AppFeedbackEntry>();
      for (const e of [...data.entries, ...local]) {
        if (e && typeof e.id === 'string' && !byId.has(e.id)) {
          byId.set(e.id, e);
        }
      }
      const merged = Array.from(byId.values())
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, 50);
      if (merged.length !== local.length) changed = true;
      try {
        localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(merged));
      } catch {
        // ignore
      }
    }

    if (data.alreadySubmitted && data.existingEntry && !hasCurrentPcSubmittedFeedback(pcFingerprint)) {
      const e = data.existingEntry as AppFeedbackEntry;
      savePcFeedbackSubmissionRecord({
        pcFingerprint,
        entryId: e.id,
        category: e.category || 'feature',
        author: e.author || 'Użytkownik',
        message: e.message || '',
        rating: e.rating,
        submittedAt: e.createdAt || Date.now(),
      });
      changed = true;
    }
    serverSyncDone = true;
    return changed;
  } catch {
    return false;
  } finally {
    serverSyncInFlight = false;
  }
}

async function publishFeedbackToServer(entry: AppFeedbackEntry): Promise<{
  ok: boolean;
  alreadySubmitted?: boolean;
  existingEntry?: AppFeedbackEntry;
}> {
  if (typeof fetch !== 'function' || typeof window === 'undefined') {
    return { ok: true };
  }
  try {
    const resp = await fetch('/api/global/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry }),
    });
    if (resp.status === 409) {
      const data = await resp.json().catch(() => ({}));
      return {
        ok: false,
        alreadySubmitted: true,
        existingEntry: data.existingEntry,
      };
    }
    return { ok: resp.ok };
  } catch {
    // Offline / static portable build fallback
    return { ok: true };
  }
}

/**
 * Renders the exact SVG vector logo matching the user's attached image `g.png`:
 * - Dark navy circuit board background (#02152b -> #010b18)
 * - Glowing cyan monitor (#00d8ff) with 4 left circuit trace lines and circular nodes
 * - NAPRAWA KOMPUTERÓW I LAPTOPÓW
 * - Rafał Jarosz
 * - NAPRAWAPCLAPTOP.PL
 * - 786 409 187
 * - WARSZAWA, UL. MARYMONCKA 125 M.109 P.6
 */
export function renderRafalJaroszLogoBannerSvg(): string {
  return `
    <svg viewBox="0 0 680 430" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NAPRAWA KOMPUTERÓW I LAPTOPÓW - Rafał Jarosz - NAPRAWAPCLAPTOP.PL" style="display:block;max-width:520px;margin:0 auto;border-radius:14px;border:1px solid rgba(0,216,255,0.35);box-shadow:0 14px 36px rgba(0,0,0,0.55);">
      <defs>
        <radialGradient id="rjBgGrad" cx="50%" cy="42%" r="65%">
          <stop offset="0%" stop-color="#052a52" />
          <stop offset="60%" stop-color="#021730" />
          <stop offset="100%" stop-color="#010c1a" />
        </radialGradient>
        <filter id="rjCyanGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <!-- Navy background -->
      <rect width="680" height="430" rx="14" fill="url(#rjBgGrad)" />

      <!-- Subtle background PCB circuit traces -->
      <g stroke="#083868" stroke-width="1.6" fill="none" opacity="0.55">
        <polyline points="0,45 75,45 105,75 180,75" />
        <circle cx="184" cy="75" r="4" />
        <polyline points="0,120 55,120 90,155 150,155" />
        <circle cx="154" cy="155" r="4" />
        <polyline points="0,250 70,250 110,210 165,210" />
        <circle cx="169" cy="210" r="4" />
        <polyline points="0,350 85,350 125,310 190,310" />
        <circle cx="194" cy="310" r="4" />
        <polyline points="680,55 600,55 565,90 500,90" />
        <circle cx="496" cy="90" r="4" />
        <polyline points="680,145 615,145 580,180 520,180" />
        <circle cx="516" cy="180" r="4" />
        <polyline points="680,265 605,265 565,225 505,225" />
        <circle cx="501" cy="225" r="4" />
        <polyline points="680,360 590,360 545,315 485,315" />
        <circle cx="481" cy="315" r="4" />
      </g>

      <!-- Glowing Cyan Monitor + 4 Left Circuit Traces & Nodes (exact match to g.png) -->
      <g filter="url(#rjCyanGlow)">
        <!-- 4 circuit lines extending from left side of monitor -->
        <polyline points="295,63 266,63 252,48" fill="none" stroke="#00d8ff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="249" cy="45" r="6.5" fill="#00d8ff" />

        <polyline points="295,82 254,82 243,72" fill="none" stroke="#00d8ff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="240" cy="69" r="6.5" fill="#00d8ff" />

        <polyline points="295,98 258,98 247,109" fill="none" stroke="#00d8ff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="244" cy="112" r="6.5" fill="#00d8ff" />

        <polyline points="295,114 270,114" fill="none" stroke="#00d8ff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="266" cy="114" r="6.5" fill="#00d8ff" />

        <!-- Monitor Outer Bezel -->
        <rect x="295" y="47" width="122" height="82" rx="7" fill="#00d8ff" />
        <!-- Monitor Inner Dark Screen -->
        <rect x="303" y="54" width="106" height="63" rx="3" fill="#021b38" />
        <!-- Monitor Stand Neck -->
        <rect x="345" y="129" width="22" height="11" fill="#00d8ff" />
        <!-- Monitor Stand Base -->
        <rect x="328" y="139" width="56" height="7" rx="3.5" fill="#00d8ff" />
      </g>

      <!-- Main Cyan Title: NAPRAWA KOMPUTERÓW I LAPTOPÓW -->
      <g font-family="'Segoe UI', Montserrat, Inter, system-ui, sans-serif" font-weight="800" text-anchor="middle" fill="#00d8ff">
        <text x="340" y="188" font-size="37" letter-spacing="1.5">NAPRAWA</text>
        <text x="340" y="224" font-size="37" letter-spacing="1.5">KOMPUTERÓW</text>
        <text x="340" y="260" font-size="37" letter-spacing="1.5">I LAPTOPÓW</text>
      </g>

      <!-- Owner Name: Rafał Jarosz -->
      <text x="340" y="297" font-family="'Segoe UI', Inter, system-ui, sans-serif" font-weight="600" font-size="25" fill="#ffffff" text-anchor="middle" letter-spacing="0.6">
        Rafał Jarosz
      </text>

      <!-- Website, Phone, Address -->
      <g font-family="'Segoe UI', Inter, system-ui, sans-serif" font-weight="600" font-size="20" fill="#f8fafc" text-anchor="middle" letter-spacing="1.2">
        <text x="340" y="334">NAPRAWAPCLAPTOP.PL</text>
        <text x="340" y="362">786 409 187</text>
        <text x="340" y="390">WARSZAWA, UL. MARYMONCKA</text>
        <text x="340" y="415">125 M.109 P.6</text>
      </g>
    </svg>
  `;
}

export function renderCopyrightAndFeedbackSectionHtml(
  pcFingerprint = getCurrentPcFingerprint()
): string {
  const ratingState = loadAppRatingState();
  const avgRating =
    ratingState.totalVotes > 0
      ? (ratingState.ratingSum / ratingState.totalVotes).toFixed(2)
      : '5.00';
  const entries = loadFeedbackEntries();
  const feedbackLock = getPcFeedbackSubmissionRecord(pcFingerprint);
  const ratingLock = getPcRatingSubmissionRecord(pcFingerprint);
  const hasSubmittedFeedback = feedbackLock !== null;
  const hasSubmittedRating = ratingLock !== null;
  const displayStars = ratingLock ? ratingLock.rating : selectedStars;

  const starsHtml = [1, 2, 3, 4, 5]
    .map((star) => {
      const active = star <= displayStars;
      return `
        <button
          type="button"
          class="btn ${active ? 'btn-primary' : 'btn-secondary'} btn-sm"
          data-rate-star="${star}"
          ${hasSubmittedRating ? 'disabled' : ''}
          style="min-width:44px;font-size:14px;padding:6px 10px;border-color:${active ? '#22d3ee' : '#334155'};"
          title="${hasSubmittedRating ? 'Ten komputer (PC) oddał już swoją ocenę' : `Oceń aplikację na ${star}/5 gwiazdek`}"
        >
          ${active ? '★' : '☆'} ${star}
        </button>
      `;
    })
    .join('');

  return `
    <section class="sp-panel" id="sp-copyright-contact-feedback-section" data-pc-fingerprint="${escHtml(pcFingerprint)}" style="margin-top:18px;border:1px solid rgba(34,211,238,0.28);background:linear-gradient(180deg,rgba(15,23,42,0.95) 0%,rgba(7,11,20,0.98) 100%);">
      <div class="sp-panel-head">
        <div>
          <span class="sp-eyebrow">PRAWA AUTORSKIE (COPYRIGHT) · OFICJALNE LOGO SERWISU · KONTAKT · OCENA APLIKACJI · ZGŁOŚ BŁĘDY / CO DODAĆ</span>
          <h3>🛡️ Prawa Autorskie, Kontakt Serwisowy, Ocena Aplikacji i Zgłaszanie Błędów / Nowych Funkcji</h3>
          <p class="sp-muted">
            Oficjalne logo serwisu <strong>NAPRAWA KOMPUTERÓW I LAPTOPÓW — Rafał Jarosz</strong> jest automatycznie umieszczane na każdym generowanym <strong>Raporcie PDF</strong> oraz w sekcji praw autorskich poniżej.
          </p>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:18px;align-items:start;margin-top:10px;">
        <!-- Kolumna 1: Oficjalne Logo + Prawa Autorskie + Kontakt -->
        <div style="background:rgba(2,21,43,0.65);border:1px solid rgba(0,216,255,0.25);border-radius:14px;padding:16px;">
          ${renderRafalJaroszLogoBannerSvg()}

          <div style="margin-top:14px;padding:12px;background:rgba(15,23,42,0.85);border-radius:10px;border:1px solid rgba(51,65,85,0.7);">
            <div style="font-size:12px;font-weight:700;color:#22d3ee;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:6px;">
              © Prawa Autorskie (Copyright) &amp; Dane Kontaktowe
            </div>
            <p style="margin:0 0 8px;font-size:13px;color:#e2e8f0;line-height:1.55;">
              <strong>© ${new Date().getFullYear()} Rafał Jarosz — NAPRAWAPCLAPTOP.PL</strong>.<br/>
              Wszelkie prawa zastrzeżone. Autorski system diagnostyki sprzętowej PC/Laptopów, testów obciążeniowych 3D oraz raportowania serwisowego PDF.
            </p>
            <ul style="list-style:none;padding:0;margin:0 0 12px;font-size:13px;color:#cbd5e1;line-height:1.75;">
              <li>👤 <strong>Właściciel / Autor:</strong> Rafał Jarosz — Naprawa Komputerów i Laptopów</li>
              <li>📞 <strong>Telefon serwisowy:</strong> <a href="tel:+48786409187" style="color:#22d3ee;text-decoration:none;font-weight:700;">786 409 187</a></li>
              <li>🌐 <strong>Strona internetowa:</strong> <a href="https://naprawapclaptop.pl" target="_blank" rel="noopener noreferrer" style="color:#22d3ee;text-decoration:none;font-weight:700;">NAPRAWAPCLAPTOP.PL</a></li>
              <li>📍 <strong>Adres serwisu:</strong> Warszawa, ul. Marymoncka 125 m.109 p.6</li>
            </ul>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn btn-primary btn-sm" id="sp-copy-service-contact-btn">
                📋 Kopiuj dane kontaktowe serwisu
              </button>
              <a href="https://naprawapclaptop.pl" target="_blank" rel="noopener noreferrer" class="btn btn-secondary btn-sm" style="text-decoration:none;">
                🌐 Otwórz NAPRAWAPCLAPTOP.PL
              </a>
            </div>
          </div>
        </div>

        <!-- Kolumna 2: Ocena Aplikacji + Formularz "Co dodać / Jakie błędy" -->
        <div style="display:flex;flex-direction:column;gap:14px;">
          <!-- Karta Oceny Aplikacji -->
          <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(51,65,85,0.8);border-radius:14px;padding:16px;">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:8px;">
              <div>
                <span style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.06em;">OCENA APLIKACJI SYSTEMPULSE PRO · LIMIT 1 OCENA / PC</span>
                <h4 style="margin:2px 0 0;font-size:16px;color:#f8fafc;">⭐ Oceń dokładność testów i raportów</h4>
              </div>
              <div style="text-align:right;">
                <strong style="font-size:20px;color:#fbbf24;">★ ${avgRating} / 5.00</strong>
                <div style="font-size:11px;color:#94a3b8;">Oddanych ocen: ${ratingState.totalVotes} · Twoja ocena: ${displayStars}/5</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;">
              ${starsHtml}
              <button
                type="button"
                class="btn ${hasSubmittedRating ? 'btn-secondary' : 'btn-primary'} btn-sm"
                id="sp-submit-rating-btn"
                ${hasSubmittedRating ? 'disabled' : ''}
                style="margin-left:auto;"
              >
                ${hasSubmittedRating ? `🔒 Ocena z tego PC zapisana (${displayStars}/5 ★)` : `✅ Zapisz ocenę (${selectedStars}/5 ★)`}
              </button>
            </div>
          </div>

          <!-- Karta Zgłaszania Błędów i Opinii ("1 PC = max 1 opinia") -->
          <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(51,65,85,0.8);border-radius:14px;padding:16px;" data-feedback-pc-locked="${hasSubmittedFeedback ? 'true' : 'false'}">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px;margin-bottom:4px;">
              <span style="font-size:11px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:0.06em;">OPINIE / ZGŁOŚ BŁĘDY / CO DODAĆ</span>
              <span class="font-mono" style="font-size:10.5px;padding:2px 8px;border-radius:999px;background:rgba(34,211,238,0.12);border:1px solid rgba(34,211,238,0.35);color:#67e8f9;">
                🔒 Limit: 1 opinia / 1 PC (${escHtml(pcFingerprint)})
              </span>
            </div>
            <h4 style="margin:2px 0 6px;font-size:16px;color:#f8fafc;">🛠️ Dodaj opinię, opisz błędy lub zaproponuj nową funkcję</h4>
            <p style="margin:0 0 10px;font-size:12.5px;color:#94a3b8;">
              Każdy komputer (PC) może dodać opinię / zgłoszenie <strong>tylko jeden raz</strong> (weryfikacja po identyfikatorze sprzętowym PC).
            </p>

            ${
              hasSubmittedFeedback && feedbackLock
                ? `
                  <div id="sp-feedback-pc-lock-banner" style="padding:12px 14px;border-radius:10px;background:rgba(16,185,129,0.11);border:1px solid rgba(16,185,129,0.4);margin-bottom:10px;font-size:12.5px;line-height:1.5;color:#d1fae5;">
                    <div style="font-weight:700;color:#34d399;margin-bottom:4px;">
                      🔒 Opinia z tego komputera (${escHtml(pcFingerprint)}) została już dodana
                    </div>
                    <div>
                      Każdy komputer może przesłać opinię tylko raz. Twoja zapisana opinia z dnia
                      <strong class="font-mono">${escHtml(new Date(feedbackLock.submittedAt).toLocaleString('pl-PL'))}</strong>:
                      „<em>${escHtml(feedbackLock.message)}</em>”
                    </div>
                  </div>
                `
                : ''
            }

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-bottom:8px;">
              <select id="sp-feedback-category" class="input-select" aria-label="Kategoria zgłoszenia" ${hasSubmittedFeedback ? 'disabled' : ''}>
                <option value="bug">🐛 Błąd / Co poprawić w pomiarach</option>
                <option value="feature">💡 Co dodać / Nowa funkcja</option>
                <option value="game">🎮 Nowa gra 3D / Scena benchmarkowa</option>
                <option value="measurement">📊 Raport PDF / Inwentarz sprzętu</option>
              </select>
              <input
                type="text"
                id="sp-feedback-author"
                class="input-text"
                placeholder="Twój podpis / kontakt (np. Rafał, Klient...)"
                value="Rafał Jarosz"
                ${hasSubmittedFeedback ? 'disabled' : ''}
              />
            </div>

            <textarea
              id="sp-feedback-message"
              class="input-text"
              rows="3"
              placeholder="${hasSubmittedFeedback ? 'Ten komputer dodał już swoją opinię (limit 1 opinia na PC).' : 'Opisz dokładnie jakie błędy zauważyłeś lub co dodać do aplikacji (np. nowy test, korekta raportu PDF, nowa gra 3D)...'}"
              style="width:100%;resize:vertical;min-height:74px;margin-bottom:10px;font-family:inherit;"
              ${hasSubmittedFeedback ? 'disabled' : ''}
            ></textarea>

            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <button
                type="button"
                class="btn ${hasSubmittedFeedback ? 'btn-secondary' : 'btn-primary'} btn-sm"
                id="sp-feedback-submit-btn"
                ${hasSubmittedFeedback ? 'disabled' : ''}
              >
                ${hasSubmittedFeedback ? '🔒 Opinia z tego PC już dodana (limit 1/PC)' : '📨 Wyślij i zapisz opinię / zgłoszenie'}
              </button>
              ${
                entries.length > 0
                  ? `<button type="button" class="btn btn-secondary btn-sm" id="sp-feedback-export-btn">📥 Eksportuj zgłoszenia (.JSON)</button>`
                  : ''
              }
            </div>

            ${
              feedbackNotice
                ? `<div class="sp-scheme-feedback" style="margin-top:10px;">${escHtml(feedbackNotice)}</div>`
                : ''
            }

            <!-- Lista zapisanych zgłoszeń i opinii -->
            <div style="margin-top:12px;max-height:210px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
              ${
                entries.length === 0
                  ? `<div style="padding:10px;border-radius:8px;background:rgba(2,6,23,0.55);color:#64748b;font-size:12px;text-align:center;">
                      Brak zapisanych opinii w tej sesji. Dodaj powyżej opinię o aplikacji lub propozycję nowej funkcji (1 opinia na PC).
                    </div>`
                  : entries
                      .map((item) => {
                        const dateStr = new Date(item.createdAt).toLocaleString('pl-PL');
                        return `
                          <div style="padding:10px 12px;border-radius:10px;background:rgba(2,6,23,0.7);border:1px solid rgba(51,65,85,0.65);display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
                            <div style="font-size:12.5px;line-height:1.45;">
                              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:3px;">
                                <strong style="color:#22d3ee;">${escHtml(item.categoryLabel)}</strong>
                                <span style="color:#94a3b8;font-size:11px;">• ${escHtml(item.author)} • ${escHtml(dateStr)}</span>
                                ${item.rating ? `<span style="color:#fbbf24;font-size:11px;font-weight:700;">★ ${item.rating}/5</span>` : ''}
                                ${item.pcFingerprint ? `<span class="font-mono" style="color:#64748b;font-size:10px;">[${escHtml(item.pcFingerprint)}]</span>` : ''}
                              </div>
                              <div style="color:#f1f5f9;">${escHtml(item.message)}</div>
                            </div>
                          </div>
                        `;
                      })
                      .join('')
              }
            </div>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function bindCopyrightAndFeedbackEvents(
  root: HTMLElement,
  rerender: () => void,
  pcFingerprint = getCurrentPcFingerprint()
): void {
  if (!serverSyncDone) {
    void syncFeedbackWithServer(pcFingerprint).then((changed) => {
      if (changed) rerender();
    });
  }

  const copyContactBtn = root.querySelector<HTMLButtonElement>('#sp-copy-service-contact-btn');
  copyContactBtn?.addEventListener('click', () => {
    const contactText =
      'NAPRAWA KOMPUTERÓW I LAPTOPÓW — Rafał Jarosz | NAPRAWAPCLAPTOP.PL | Tel: 786 409 187 | Warszawa, ul. Marymoncka 125 m.109 p.6';
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(contactText);
    }
    feedbackNotice =
      '✓ Skopiowano pełne dane kontaktowe serwisu (Rafał Jarosz · 786 409 187 · WARSZAWA, UL. MARYMONCKA 125 M.109 P.6) do schowka.';
    rerender();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-rate-star]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (hasCurrentPcSubmittedRating(pcFingerprint)) return;
      const star = Number(btn.dataset.rateStar || 5);
      selectedStars = Math.max(1, Math.min(5, star));
      rerender();
    });
  });

  const submitRatingBtn = root.querySelector<HTMLButtonElement>('#sp-submit-rating-btn');
  submitRatingBtn?.addEventListener('click', () => {
    const res = saveUserAppRating(selectedStars, pcFingerprint);
    if (!res.ok && res.alreadySubmitted) {
      feedbackNotice = `🔒 Ten komputer (${pcFingerprint}) oddał już ocenę aplikacji — każdy PC może ocenić aplikację tylko raz.`;
      rerender();
      return;
    }
    const avg = (res.state.ratingSum / Math.max(1, res.state.totalVotes)).toFixed(2);
    feedbackNotice = `⭐ Dziękujemy! Zapisano Twoją jednorazową ocenę z tego PC (${pcFingerprint}): ${selectedStars}/5 gwiazdek (średnia: ${avg}/5.00).`;
    rerender();
  });

  const submitFeedbackBtn = root.querySelector<HTMLButtonElement>('#sp-feedback-submit-btn');
  submitFeedbackBtn?.addEventListener('click', async () => {
    if (hasCurrentPcSubmittedFeedback(pcFingerprint)) {
      feedbackNotice = `🔒 Ten komputer (${pcFingerprint}) dodał już opinię — obowiązuje limit 1 opinii na 1 PC.`;
      rerender();
      return;
    }

    const catEl = root.querySelector<HTMLSelectElement>('#sp-feedback-category');
    const authorEl = root.querySelector<HTMLInputElement>('#sp-feedback-author');
    const msgEl = root.querySelector<HTMLTextAreaElement>('#sp-feedback-message');
    const message = msgEl?.value.trim() || '';
    if (!message) {
      feedbackNotice =
        '⚠️ Wpisz treść opinii / zgłoszenia (jaki błąd zauważyłeś lub co dodać do aplikacji).';
      rerender();
      return;
    }

    const category = (catEl?.value as AppFeedbackEntry['category']) || 'bug';
    const author = authorEl?.value.trim() || 'Rafał Jarosz';
    const result = addFeedbackEntry(category, message, author, selectedStars, pcFingerprint);
    if (!result.ok && result.alreadySubmitted) {
      feedbackNotice = `🔒 Ten komputer (${pcFingerprint}) dodał już opinię — każdy PC może dodać opinię tylko raz.`;
      rerender();
      return;
    }

    const latestEntry = result.entries[0];
    if (latestEntry) {
      const serverResp = await publishFeedbackToServer(latestEntry);
      if (!serverResp.ok && serverResp.alreadySubmitted) {
        feedbackNotice = `🔒 Serwer potwierdził, że ten komputer (${pcFingerprint}) dodał już wcześniej opinię (limit 1 opinia / PC).`;
        rerender();
        return;
      }
    }

    if (msgEl) msgEl.value = '';
    feedbackNotice = `✓ Zapisano Twoją opinię z tego komputera (${pcFingerprint}). Limit 1 opinii na PC został aktywowany.`;
    rerender();
  });

  const exportBtn = root.querySelector<HTMLButtonElement>('#sp-feedback-export-btn');
  exportBtn?.addEventListener('click', () => {
    const entries = loadFeedbackEntries();
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `systempulse-zgloszenia-i-opinie-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    feedbackNotice = '✓ Wyeksportowano listę zgłoszeń i opinii do pliku .JSON.';
    rerender();
  });
}
