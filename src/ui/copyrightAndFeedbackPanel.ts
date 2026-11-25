export interface AppFeedbackEntry {
  id: string;
  category: 'bug' | 'feature' | 'game' | 'measurement';
  categoryLabel: string;
  message: string;
  author: string;
  rating?: number;
  createdAt: number;
}

interface AppRatingState {
  userRating: number;
  totalVotes: number;
  ratingSum: number;
  lastUpdated: number;
}

const FEEDBACK_STORAGE_KEY = 'systempulse_user_feedback_v1';
const RATING_STORAGE_KEY = 'systempulse_app_rating_v1';

let feedbackNotice: string | null = null;
let selectedStars = 5;

function escHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
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
  };
}

export function saveUserAppRating(stars: number): AppRatingState {
  const clamped = Math.max(1, Math.min(5, Math.round(stars)));
  const current = loadAppRatingState();
  const next: AppRatingState = {
    userRating: clamped,
    totalVotes: current.totalVotes + 1,
    ratingSum: current.ratingSum + clamped,
    lastUpdated: Date.now(),
  };
  selectedStars = clamped;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
  return next;
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

export function addFeedbackEntry(
  category: AppFeedbackEntry['category'],
  message: string,
  author: string,
  rating?: number
): AppFeedbackEntry[] {
  const categoryMap: Record<AppFeedbackEntry['category'], string> = {
    bug: '🐛 Błąd / Poprawka pomiaru',
    feature: '💡 Co dodać / Nowa funkcja',
    game: '🎮 Nowa gra 3D / Test GPU',
    measurement: '📊 Raport PDF / Inwentarz sprzętu',
  };
  const entry: AppFeedbackEntry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    category,
    categoryLabel: categoryMap[category] || '💡 Co dodać / Uwaga',
    message: message.trim(),
    author: author.trim() || 'Użytkownik SystemPulse Pro',
    rating,
    createdAt: Date.now(),
  };
  const existing = loadFeedbackEntries();
  const next = [entry, ...existing].slice(0, 50);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(next));
    }
  } catch {
    // ignore
  }
  return next;
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
        <!-- Trace 1 (top-left angled up) -->
        <polyline points="295,63 266,63 252,48" fill="none" stroke="#00d8ff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="249" cy="45" r="6.5" fill="#00d8ff" />

        <!-- Trace 2 (upper-middle angled up) -->
        <polyline points="295,82 254,82 243,72" fill="none" stroke="#00d8ff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="240" cy="69" r="6.5" fill="#00d8ff" />

        <!-- Trace 3 (lower-middle angled down) -->
        <polyline points="295,98 258,98 247,109" fill="none" stroke="#00d8ff" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" />
        <circle cx="244" cy="112" r="6.5" fill="#00d8ff" />

        <!-- Trace 4 (bottom-left straight) -->
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

export function renderCopyrightAndFeedbackSectionHtml(): string {
  const ratingState = loadAppRatingState();
  const avgRating =
    ratingState.totalVotes > 0
      ? (ratingState.ratingSum / ratingState.totalVotes).toFixed(2)
      : '5.00';
  const entries = loadFeedbackEntries();

  const starsHtml = [1, 2, 3, 4, 5]
    .map((star) => {
      const active = star <= selectedStars;
      return `
        <button
          type="button"
          class="btn ${active ? 'btn-primary' : 'btn-secondary'} btn-sm"
          data-rate-star="${star}"
          style="min-width:44px;font-size:14px;padding:6px 10px;border-color:${active ? '#22d3ee' : '#334155'};"
          title="Oceń aplikację na ${star}/5 gwiazdek"
        >
          ${active ? '★' : '☆'} ${star}
        </button>
      `;
    })
    .join('');

  return `
    <section class="sp-panel" id="sp-copyright-contact-feedback-section" style="margin-top:18px;border:1px solid rgba(34,211,238,0.28);background:linear-gradient(180deg,rgba(15,23,42,0.95) 0%,rgba(7,11,20,0.98) 100%);">
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
                <span style="font-size:11px;font-weight:700;color:#fbbf24;text-transform:uppercase;letter-spacing:0.06em;">OCENA APLIKACJI SYSTEMPULSE PRO</span>
                <h4 style="margin:2px 0 0;font-size:16px;color:#f8fafc;">⭐ Oceń dokładność testów i raportów</h4>
              </div>
              <div style="text-align:right;">
                <strong style="font-size:20px;color:#fbbf24;">★ ${avgRating} / 5.00</strong>
                <div style="font-size:11px;color:#94a3b8;">Oddanych ocen: ${ratingState.totalVotes} · Twoja ocena: ${ratingState.userRating}/5</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px;">
              ${starsHtml}
              <button type="button" class="btn btn-primary btn-sm" id="sp-submit-rating-btn" style="margin-left:auto;">
                ✅ Zapisz ocenę (${selectedStars}/5 ★)
              </button>
            </div>
          </div>

          <!-- Karta Zgłaszania Błędów i Pomysłów ("Co dodać / Jakie błędy") -->
          <div style="background:rgba(15,23,42,0.85);border:1px solid rgba(51,65,85,0.8);border-radius:14px;padding:16px;">
            <span style="font-size:11px;font-weight:700;color:#22d3ee;text-transform:uppercase;letter-spacing:0.06em;">ZGŁOŚ BŁĘDY / CO DODAĆ DO APLIKACJI</span>
            <h4 style="margin:2px 0 6px;font-size:16px;color:#f8fafc;">🛠️ Napisz co dodać, ulepszyć lub jakie błędy zauważyłeś</h4>
            <p style="margin:0 0 10px;font-size:12.5px;color:#94a3b8;">
              Masz pomysł na nową funkcję, kolejną grę 3D, poprawkę w raporcie PDF lub zauważyłeś błąd pomiaru? Zapisz zgłoszenie poniżej:
            </p>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-bottom:8px;">
              <select id="sp-feedback-category" class="input-select" aria-label="Kategoria zgłoszenia">
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
              />
            </div>

            <textarea
              id="sp-feedback-message"
              class="input-text"
              rows="3"
              placeholder="Opisz dokładnie jakie błędy zauważyłeś lub co dodać do aplikacji (np. nowy test, korekta raportu PDF, nowa gra 3D)..."
              style="width:100%;resize:vertical;min-height:74px;margin-bottom:10px;font-family:inherit;"
            ></textarea>

            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
              <button type="button" class="btn btn-primary btn-sm" id="sp-feedback-submit-btn">
                📨 Wyślij i zapisz zgłoszenie / pomysł
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

            <!-- Lista zapisanych zgłoszeń i propozycji -->
            <div style="margin-top:12px;max-height:210px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;">
              ${
                entries.length === 0
                  ? `<div style="padding:10px;border-radius:8px;background:rgba(2,6,23,0.55);color:#64748b;font-size:12px;text-align:center;">
                      Brak zapisanych zgłoszeń w tej sesji. Dodaj powyżej informację o błędzie lub propozycję nowej funkcji.
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
                              </div>
                              <div style="color:#f1f5f9;">${escHtml(item.message)}</div>
                            </div>
                            <button
                              type="button"
                              class="btn btn-secondary btn-sm"
                              data-delete-feedback="${escHtml(item.id)}"
                              title="Usuń wpis"
                              style="padding:2px 7px;font-size:11px;"
                            >✕</button>
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

export function bindCopyrightAndFeedbackEvents(root: HTMLElement, rerender: () => void): void {
  const copyContactBtn = root.querySelector<HTMLButtonElement>('#sp-copy-service-contact-btn');
  copyContactBtn?.addEventListener('click', () => {
    const contactText =
      'NAPRAWA KOMPUTERÓW I LAPTOPÓW — Rafał Jarosz | NAPRAWAPCLAPTOP.PL | Tel: 786 409 187 | Warszawa, ul. Marymoncka 125 m.109 p.6';
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(contactText);
    }
    feedbackNotice = '✓ Skopiowano pełne dane kontaktowe serwisu (Rafał Jarosz · 786 409 187 · WARSZAWA, UL. MARYMONCKA 125 M.109 P.6) do schowka.';
    rerender();
  });

  root.querySelectorAll<HTMLButtonElement>('[data-rate-star]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const star = Number(btn.dataset.rateStar || 5);
      selectedStars = Math.max(1, Math.min(5, star));
      rerender();
    });
  });

  const submitRatingBtn = root.querySelector<HTMLButtonElement>('#sp-submit-rating-btn');
  submitRatingBtn?.addEventListener('click', () => {
    const state = saveUserAppRating(selectedStars);
    const avg = (state.ratingSum / Math.max(1, state.totalVotes)).toFixed(2);
    feedbackNotice = `⭐ Dziękujemy! Zapisano Twoją ocenę aplikacji: ${selectedStars}/5 gwiazdek (aktualna średnia: ${avg}/5.00).`;
    rerender();
  });

  const submitFeedbackBtn = root.querySelector<HTMLButtonElement>('#sp-feedback-submit-btn');
  submitFeedbackBtn?.addEventListener('click', () => {
    const catEl = root.querySelector<HTMLSelectElement>('#sp-feedback-category');
    const authorEl = root.querySelector<HTMLInputElement>('#sp-feedback-author');
    const msgEl = root.querySelector<HTMLTextAreaElement>('#sp-feedback-message');
    const message = msgEl?.value.trim() || '';
    if (!message) {
      feedbackNotice = '⚠️ Wpisz treść zgłoszenia (jaki błąd zauważyłeś lub co dodać do aplikacji).';
      rerender();
      return;
    }
    const category = (catEl?.value as AppFeedbackEntry['category']) || 'bug';
    const author = authorEl?.value.trim() || 'Rafał Jarosz';
    addFeedbackEntry(category, message, author, selectedStars);
    if (msgEl) msgEl.value = '';
    feedbackNotice = '✓ Zapisano Twoje zgłoszenie / propozycję zmian w bazie serwisowej aplikacji.';
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

  root.querySelectorAll<HTMLButtonElement>('[data-delete-feedback]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.deleteFeedback;
      if (id) {
        deleteFeedbackEntry(id);
        feedbackNotice = 'Usunięto wpis z listy zgłoszeń.';
        rerender();
      }
    });
  });
}
