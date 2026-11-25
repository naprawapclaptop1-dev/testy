export interface DisplayPatternDef {
  id: string;
  name: string;
  category:
    | 'Martwe piksele'
    | 'Podświetlenie'
    | 'Kolory i gradienty'
    | 'Ostrość i Hz'
    | 'Jednolitość'
    | 'Kontrast i Gamma'
    | 'Matryca i Oled';
  description: string;
  swatchStyle: string;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, tSec: number, showGrid: boolean) => void;
  animated?: boolean;
}

export const DISPLAY_PATTERNS: DisplayPatternDef[] = [
  {
    id: 'dead-black',
    name: 'Czysta czerń (Backlight Bleed)',
    category: 'Podświetlenie',
    description: 'Wykrywanie prześwitów podświetlenia (IPS Glow / Backlight Bleed) oraz świecących subpikseli.',
    swatchStyle: 'background:#000000;',
    draw: (ctx, w, h, _t, showGrid) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      if (showGrid) drawUniformityGuides(ctx, w, h, 'rgba(255,255,255,0.12)');
    },
  },
  {
    id: 'dead-white',
    name: 'Czysta biel (Martwe piksele)',
    category: 'Martwe piksele',
    description: 'Wykrywanie czarnych martwych pikseli, zabrudzeń pod matrycą i nierównomiernej bieli.',
    swatchStyle: 'background:#ffffff;',
    draw: (ctx, w, h, _t, showGrid) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      if (showGrid) drawUniformityGuides(ctx, w, h, 'rgba(0,0,0,0.12)');
    },
  },
  {
    id: 'dead-red',
    name: 'Kanał Czerwony (R 255)',
    category: 'Martwe piksele',
    description: 'Izolacja czerwonego subpiksela — ujawnia zablokowane subpiksele zielone i niebieskie.',
    swatchStyle: 'background:#ff0000;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#ff0000';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'dead-green',
    name: 'Kanał Zielony (G 255)',
    category: 'Martwe piksele',
    description: 'Izolacja zielonego subpiksela — najwyższa czułość ludzkiego oka na wady matrycy.',
    swatchStyle: 'background:#00ff00;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'dead-blue',
    name: 'Kanał Niebieski (B 255)',
    category: 'Martwe piksele',
    description: 'Izolacja niebieskiego subpiksela — sprawdzenie wypaleń OLED oraz jednorodności.',
    swatchStyle: 'background:#0000ff;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#0000ff';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'gray-uniformity',
    name: 'Szarość 8% (Uniformity / DSE)',
    category: 'Podświetlenie',
    description: 'Test jednorodności ciemnej szarości (Dirty Screen Effect, banding w matrycach OLED/VA).',
    swatchStyle: 'background:#141414;',
    draw: (ctx, w, h, _t, showGrid) => {
      ctx.fillStyle = '#141414';
      ctx.fillRect(0, 0, w, h);
      if (showGrid) drawUniformityGuides(ctx, w, h, 'rgba(255,255,255,0.15)');
    },
  },
  {
    id: 'rgb-gradients',
    name: 'Gradienty RGB + Szarość (Banding)',
    category: 'Kolory i gradienty',
    description: 'Płynne przejścia tonalne 0–255 dla wykrywania pasmowania kolorów (color banding).',
    swatchStyle: 'background:linear-gradient(90deg,#000,#f00,#0f0,#00f,#fff);',
    draw: (ctx, w, h) => {
      const bands: Array<[string, string]> = [
        ['#000000', '#ffffff'],
        ['#000000', '#ff0000'],
        ['#000000', '#00ff00'],
        ['#000000', '#0000ff'],
        ['#000000', '#00ffff'],
        ['#000000', '#ff00ff'],
        ['#000000', '#ffff00'],
      ];
      const bh = h / bands.length;
      bands.forEach(([c0, c1], i) => {
        const g = ctx.createLinearGradient(0, 0, w, 0);
        g.addColorStop(0, c0);
        g.addColorStop(1, c1);
        ctx.fillStyle = g;
        ctx.fillRect(0, i * bh, w, Math.ceil(bh) + 1);
      });
    },
  },
  {
    id: 'contrast-gamma',
    name: 'Skala kontrastu i Gamma 2.2',
    category: 'Kolory i gradienty',
    description: '32-stopniowa skala luminancji (0–255) do oceny detali w cieniach i światłach.',
    swatchStyle: 'background:repeating-linear-gradient(90deg,#000 0 12.5%,#333 12.5% 25%,#777 25% 37.5%,#ccc 37.5% 50%);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#090909';
      ctx.fillRect(0, 0, w, h);
      const steps = 16;
      const colW = w / steps;
      const halfH = h / 2;

      // Top row: Dark levels 0..60
      for (let i = 0; i < steps; i++) {
        const v = Math.round((i / (steps - 1)) * 60);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(i * colW, 0, Math.ceil(colW), halfH - 2);
        ctx.fillStyle = v > 28 ? '#000' : '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(String(v), i * colW + 8, 22);
      }

      // Bottom row: Full range 0..255
      for (let i = 0; i < steps; i++) {
        const v = Math.round((i / (steps - 1)) * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(i * colW, halfH + 2, Math.ceil(colW), halfH);
        ctx.fillStyle = v > 128 ? '#000' : '#cbd5e1';
        ctx.font = '12px monospace';
        ctx.fillText(String(v), i * colW + 8, halfH + 24);
      }
    },
  },
  {
    id: 'sharpness-grid',
    name: 'Ostrość i geometria 1:1',
    category: 'Ostrość i Hz',
    description: 'Siatka kalibracyjna + wzór szachownicy do weryfikacji ostrości czcionek i skalowania.',
    swatchStyle: 'background:repeating-conic-gradient(#1e293b 0% 25%, #06b6d4 0% 50%) 50% / 14px 14px;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, w, h);
      const step = 32;
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }
      // Center calibration circles
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1.5;
      const cx = w / 2;
      const cy = h / 2;
      for (const r of [48, 110, 175]) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 210, cy);
      ctx.lineTo(cx + 210, cy);
      ctx.moveTo(cx, cy - 210);
      ctx.lineTo(cx, cy + 210);
      ctx.stroke();

      // Fine 2px checkerboard corner blocks
      for (const [bx, by] of [
        [24, 24],
        [w - 104, 24],
        [24, h - 104],
        [w - 104, h - 104],
      ]) {
        for (let y = 0; y < 80; y += 4) {
          for (let x = 0; x < 80; x += 4) {
            ctx.fillStyle = ((x + y) / 4) % 2 === 0 ? '#ffffff' : '#000000';
            ctx.fillRect(bx + x, by + y, 4, 4);
          }
        }
      }
    },
  },
  {
    id: 'motion-hz',
    name: 'Test płynności i odświeżania (Hz)',
    category: 'Ostrość i Hz',
    description: 'Ruchome paski testowe do wykrywania smużenia matrycy (ghosting) i gubienia klatek.',
    swatchStyle: 'background:linear-gradient(90deg,#090d16 0 42%,#06b6d4 42% 52%,#090d16 52% 100%);',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      ctx.fillStyle = '#080b12';
      ctx.fillRect(0, 0, w, h);

      // Reference vertical ticks
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      for (let x = 0; x < w; x += 48) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }

      // 3 speed lanes for ghosting / response-time inspection
      const speeds = [280, 560, 920];
      const colors = ['#06b6d4', '#f1f5f9', '#f59e0b'];
      const labels = ['280 px/s', '560 px/s', '920 px/s'];
      const laneH = h / 3;

      speeds.forEach((spd, idx) => {
        const y0 = idx * laneH;
        const barW = 42;
        const x = ((tSec * spd) % (w + barW)) - barW;

        ctx.fillStyle = colors[idx];
        ctx.fillRect(x, y0 + 22, barW, laneH - 44);

        // Trailing sharp black/white edge strip to expose overshoot/ghosting
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + 12, y0 + 22, 6, laneH - 44);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 24, y0 + 22, 6, laneH - 44);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(labels[idx], 16, y0 + 20);
      });
    },
  },
  {
    id: 'dead-cyan',
    name: 'Kanał Cyjan (G+B 255)',
    category: 'Martwe piksele',
    description: 'Izolacja subpikseli zielonego i niebieskiego jednocześnie (test martwego kanału czerwonego).',
    swatchStyle: 'background:#00ffff;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#00ffff';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'dead-magenta',
    name: 'Kanał Magenta (R+B 255)',
    category: 'Martwe piksele',
    description: 'Izolacja subpikseli czerwonego i niebieskiego (wykrywa zablokowany zielony subpiksel).',
    swatchStyle: 'background:#ff00ff;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'dead-yellow',
    name: 'Kanał Żółty (R+G 255)',
    category: 'Martwe piksele',
    description: 'Izolacja subpikseli czerwonego i zielonego (wykrywa martwy niebieski subpiksel i przebarwienia).',
    swatchStyle: 'background:#ffff00;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#ffff00';
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'black-crush',
    name: 'Detale w czerni (Black Crush 1–20)',
    category: 'Kolory i gradienty',
    description: '20 subtelnych pól od RGB(1) do RGB(20) na tle czystej czerni #000 — test detali w cieniach.',
    swatchStyle: 'background:linear-gradient(90deg,#000,#0a0a0a,#181818);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const cols = 5;
      const rows = 4;
      const pad = Math.min(w, h) * 0.06;
      const cellW = (w - pad * (cols + 1)) / cols;
      const cellH = (h - pad * (rows + 1)) / rows;
      for (let i = 0; i < 20; i++) {
        const v = i + 1;
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = pad + c * (cellW + pad);
        const y = pad + r * (cellH + pad);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, cellW, cellH);
        ctx.fillStyle = '#64748b';
        ctx.font = '12px monospace';
        ctx.fillText(`RGB ${v}`, x + 8, y + 20);
      }
    },
  },
  {
    id: 'white-saturation',
    name: 'Prześwietlenie bieli (235–255)',
    category: 'Kolory i gradienty',
    description: '20 pól w zakresie 235–254 na czystej bieli #FFF — wykrywa wycinanie jasnych detali (White Clipping).',
    swatchStyle: 'background:linear-gradient(90deg,#e5e5e5,#f4f4f4,#ffffff);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      const cols = 5;
      const rows = 4;
      const pad = Math.min(w, h) * 0.06;
      const cellW = (w - pad * (cols + 1)) / cols;
      const cellH = (h - pad * (rows + 1)) / rows;
      for (let i = 0; i < 20; i++) {
        const v = 235 + i;
        const c = i % cols;
        const r = Math.floor(i / cols);
        const x = pad + c * (cellW + pad);
        const y = pad + r * (cellH + pad);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(x, y, cellW, cellH);
        ctx.fillStyle = '#64748b';
        ctx.font = '12px monospace';
        ctx.fillText(`RGB ${v}`, x + 8, y + 20);
      }
    },
  },
  {
    id: 'viewing-angles',
    name: 'Kąty widzenia i Gamma Shift',
    category: 'Podświetlenie',
    description: 'Powtarzalne wzorce referencyjne w narożnikach i centrum — ujawniają spadek kontrastu i zmianę barw pod kątem (TN/VA/IPS).',
    swatchStyle: 'background:radial-gradient(circle,#7c3aed 0%,#06b6d4 45%,#1e293b 100%);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, w, h);
      const pts = [
        [w * 0.2, h * 0.22],
        [w * 0.8, h * 0.22],
        [w * 0.5, h * 0.5],
        [w * 0.2, h * 0.78],
        [w * 0.8, h * 0.78],
      ];
      const rad = Math.min(w, h) * 0.13;
      for (const [cx, cy] of pts) {
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, rad);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, '#06b6d4');
        g.addColorStop(0.7, '#7c3aed');
        g.addColorStop(1, '#111827');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94a3b8';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    },
  },
  {
    id: 'text-subpixel',
    name: 'Ostrość tekstu i subpiksele (ClearType)',
    category: 'Ostrość i Hz',
    description: 'Weryfikacja czytelności małych czcionek (9–24 px) i krawędzi subpikseli RGB/BGR/OLED PenTile.',
    swatchStyle: 'background:linear-gradient(180deg,#ffffff 50%,#090d16 50%);',
    draw: (ctx, w, h) => {
      const half = h / 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, half);
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, half, w, half);

      const sample = 'SystemPulse Pro 0123456789 — Zażółć gęślą jaźń — RGB/BGR Subpixel Sharpness Test';
      const sizes = [9, 11, 13, 16, 20, 24];
      let yTop = 28;
      let yBot = half + 28;
      for (const sz of sizes) {
        ctx.font = `${sz}px sans-serif`;
        ctx.fillStyle = '#000000';
        ctx.fillText(`${sz}px: ${sample}`, 24, yTop);
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(`${sz}px: ${sample}`, 24, yBot);
        yTop += sz + 11;
        yBot += sz + 11;
      }
    },
  },
  {
    id: 'oled-burnin-check',
    name: 'Test wypalenia OLED / Powidoków (50% Szarość)',
    category: 'Podświetlenie',
    description: 'Jednolita neutralna szarość 50% (RGB 128) z punktami odniesienia — najlepiej ujawnia wypalenia paska zadań i powidoki.',
    swatchStyle: 'background:#808080;',
    draw: (ctx, w, h, _t, showGrid) => {
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, w, h);
      if (showGrid) drawUniformityGuides(ctx, w, h, 'rgba(0,0,0,0.18)');
    },
  },
  {
    id: 'frame-skipping-overdrive',
    name: 'Frame Skipping i Overdrive (Inverse Ghosting)',
    category: 'Ostrość i Hz',
    description: 'Sekwencyjna siatka klatek do sprawdzenia gubienia odświeżania (zrób zdjęcie 1/10s) oraz ciemne/jasne bloki dla artefaktów Overdrive.',
    swatchStyle: 'background:repeating-linear-gradient(90deg,#111827 0 16px,#f59e0b 16px 32px);',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      ctx.fillStyle = '#3f4756';
      ctx.fillRect(0, 0, w, h);
      const cols = 12;
      const boxW = Math.min(54, (w - 80) / cols);
      const startX = (w - cols * boxW) / 2;
      const frameIdx = Math.floor(tSec * 60) % cols;
      const rowY = h * 0.28;

      for (let i = 0; i < cols; i++) {
        ctx.fillStyle = i === frameIdx ? '#ffffff' : '#1e293b';
        ctx.fillRect(startX + i * boxW + 2, rowY, boxW - 4, boxW - 4);
        ctx.strokeStyle = '#94a3b8';
        ctx.strokeRect(startX + i * boxW + 2, rowY, boxW - 4, boxW - 4);
      }

      // Overdrive dark-on-gray & bright-on-gray moving targets
      const x1 = ((tSec * 640) % (w + 90)) - 90;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(x1, h * 0.62, 70, 44);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(((tSec * 640 + w * 0.5) % (w + 90)) - 90, h * 0.62, 70, 44);

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px monospace';
      ctx.fillText('Frame Skipping Grid (ciągły ślad białych pól = brak gubionych klatek)', startX, rowY - 14);
    },
  },
  {
    id: 'stuck-pixel-fixer',
    name: 'Naprawa zablokowanych pikseli (RGB Strobe)',
    category: 'Martwe piksele',
    description: 'Szybka cykliczna stymulacja subpikseli RGB (UWAGA: szybkie migotanie — nie używać przy fotowrażliwości).',
    swatchStyle: 'background:conic-gradient(#ff0000,#00ff00,#0000ff,#ff0000);',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffffff', '#000000'];
      const idx = Math.floor(tSec * 15) % colors.length;
      ctx.fillStyle = colors[idx];
      ctx.fillRect(0, 0, w, h);
    },
  },
  {
    id: 'oled-burnin-protection',
    name: 'OLED Burn-in Protection (30 min)',
    category: 'Podświetlenie',
    description:
      'Ruchomy wzór o bardzo niskiej jasności (pixel-shift) pracujący przez 30 minut w celu ochrony i wyrównania pikseli matryc OLED.',
    swatchStyle:
      'background:linear-gradient(135deg,#000000 0%,#0b1520 35%,#140d1c 70%,#000000 100%)',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      drawOledBurnInProtectionPattern(ctx, w, h, tSec);
    },
  },
  {
    id: 'ufo-motion-tracker',
    name: 'Test UFO Ghosting & MPRT (480 / 960 / 1440 px/s)',
    category: 'Ostrość i Hz',
    description:
      'Trzy tory szybkich obiektów UFO z siatką referencyjną 1px do precyzyjnej oceny smużenia (Ghosting), MPRT oraz Overdrive Coronas.',
    swatchStyle: 'background:linear-gradient(180deg,#0f172a 0 33%,#1e293b 33% 66%,#0f172a 66% 100%);',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      const lanes = [
        { speed: 480, label: '480 px/s (Standard Motion)', bg: '#111827', accent: '#38bdf8' },
        { speed: 960, label: '960 px/s (Competitive Gaming)', bg: '#1e293b', accent: '#22c55e' },
        { speed: 1440, label: '1440 px/s (Esports 165Hz–360Hz)', bg: '#0f172a', accent: '#f59e0b' },
      ];
      const laneH = h / lanes.length;
      lanes.forEach((lane, i) => {
        const y0 = i * laneH;
        ctx.fillStyle = lane.bg;
        ctx.fillRect(0, y0, w, laneH);
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        for (let gx = 0; gx < w; gx += 32) {
          ctx.beginPath();
          ctx.moveTo(gx + 0.5, y0);
          ctx.lineTo(gx + 0.5, y0 + laneH);
          ctx.stroke();
        }
        const ufoW = 76;
        const x = ((tSec * lane.speed) % (w + ufoW * 2)) - ufoW;
        const cy = y0 + laneH * 0.54;
        // UFO saucer dome & body
        ctx.fillStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.arc(x + ufoW * 0.5, cy - 8, 16, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = lane.accent;
        ctx.beginPath();
        ctx.ellipse(x + ufoW * 0.5, cy, 34, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        // High-contrast 2px vertical sync bars behind UFO
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 16, cy - 20, 3, 40);
        ctx.fillStyle = '#000000';
        ctx.fillRect(x - 22, cy - 20, 3, 40);
        ctx.fillStyle = '#cbd5e1';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(lane.label, 16, y0 + 20);
      });
    },
  },
  {
    id: 'vrr-flicker-sim',
    name: 'Test VRR / G-Sync / FreeSync Flicker (Near-Black)',
    category: 'Ostrość i Hz',
    description:
      'Symulacja skoków czasu klatki (48–165 Hz) na ciemnoszarym tle IRE 12% — ujawnia migotanie jasności gamma w matrycach VA i OLED przy włączonym VRR.',
    swatchStyle: 'background:linear-gradient(90deg,#1c1c1e,#27272a,#18181b);',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      const mod = Math.sin(tSec * 9.5) * 2;
      const base = Math.round(28 + mod);
      ctx.fillStyle = `rgb(${base},${base},${base})`;
      ctx.fillRect(0, 0, w, h);
      const barX = ((tSec * 520) % (w + 60)) - 60;
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(barX, h * 0.35, 48, h * 0.3);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px monospace';
      ctx.fillText('VRR Near-Black Gamma Flicker Zone (IRE 11%–13%) — obserwuj tło pod kątem pulsowania', 20, 28);
    },
  },
  {
    id: 'oled-near-black-5pct',
    name: 'OLED / VA Vertical Banding (5% & 10% IRE Dark Gray)',
    category: 'Podświetlenie',
    description:
      'Podział na ultraciemną szarość 5% IRE (RGB 13) oraz 10% IRE (RGB 26) — standardowy test serwisowy na pionowe pasy (Vertical Banding) i winietowanie matryc OLED.',
    swatchStyle: 'background:linear-gradient(90deg,#0d0d0d 50%,#1a1a1a 50%);',
    draw: (ctx, w, h, _t, showGrid) => {
      const half = Math.floor(w / 2);
      ctx.fillStyle = 'rgb(13,13,13)';
      ctx.fillRect(0, 0, half, h);
      ctx.fillStyle = 'rgb(26,26,26)';
      ctx.fillRect(half, 0, w - half, h);
      if (showGrid) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.font = '12px monospace';
        ctx.fillText('5% IRE (RGB 13,13,13)', 18, 26);
        ctx.fillText('10% IRE (RGB 26,26,26)', half + 18, 26);
      }
    },
  },
  {
    id: 'pwm-strobe-detector',
    name: 'Detektor migotania podświetlenia PWM (Flicker-Free)',
    category: 'Podświetlenie',
    description:
      'Szybka biała linia skanująca na czarnym tle — spójrz przez aparat smartfona (1/1000s) lub przesuń wzrok: ciągły ślad = Flicker-Free DC, przerywane kreski = PWM.',
    swatchStyle: 'background:repeating-linear-gradient(90deg,#000 0 18px,#fff 18px 22px);',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const speed = 1350;
      const x1 = (tSec * speed) % w;
      const x2 = (tSec * speed + w * 0.5) % w;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x1, 0, 10, h);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x2, 0, 10, h);
    },
  },
  {
    id: 'hdr-nit-clipping',
    name: 'Kalibracja HDR10 / SDR Peak Clipping & Tonemapping',
    category: 'Kolory i gradienty',
    description:
      'Szachownica referencyjna bieli 240–255 oraz nasyconych barw Rec.2020/P3 do sprawdzenia punktu odcięcia tonemappingu HDR i kontrastu lokalnego.',
    swatchStyle: 'background:linear-gradient(135deg,#0f172a,#f8fafc,#38bdf8);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#05070b';
      ctx.fillRect(0, 0, w, h);
      const levels = [240, 244, 248, 250, 252, 253, 254, 255];
      const boxW = (w - 64) / levels.length;
      const boxH = h * 0.42;
      levels.forEach((lvl, i) => {
        const x = 32 + i * boxW;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 4, 36, boxW - 8, boxH);
        ctx.fillStyle = `rgb(${lvl},${lvl},${lvl})`;
        ctx.fillRect(x + 18, 54, boxW - 36, boxH - 36);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`RGB ${lvl}`, x + 12, 50);
      });
      // Wide-gamut saturation strips
      const hues = ['#ff0040', '#ff8800', '#00ff66', '#00d4ff', '#7c3aed', '#ff00cc'];
      const stripW = (w - 64) / hues.length;
      hues.forEach((col, i) => {
        const x = 32 + i * stripW;
        const grad = ctx.createLinearGradient(x, h * 0.55, x + stripW - 8, h * 0.9);
        grad.addColorStop(0, col);
        grad.addColorStop(1, '#ffffff');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 4, h * 0.56, stripW - 8, h * 0.34);
      });
    },
  },
  {
    id: 'gamma-calibration-chart',
    name: 'Wzorzec kalibracji Gamma 1.8 / 2.0 / 2.2 / 2.4',
    category: 'Kolory i gradienty',
    description:
      'Pasy odniesienia 50% przeplatanej czerni i bieli obok odcieni szarości dla Gamma 1.8, 2.0, 2.2 (sRGB) i 2.4 (BT.1886) — prążek zlewający się z tłem wskazuje aktualną gammę matrycy.',
    swatchStyle: 'background:repeating-linear-gradient(0deg,#000 0 2px,#fff 2px 4px);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#111827';
      ctx.fillRect(0, 0, w, h);
      const gammas = [
        { g: 1.8, rgb: Math.round(Math.pow(0.5, 1 / 1.8) * 255), label: 'Gamma 1.8 (Mac Legacy)' },
        { g: 2.0, rgb: Math.round(Math.pow(0.5, 1 / 2.0) * 255), label: 'Gamma 2.0' },
        { g: 2.2, rgb: Math.round(Math.pow(0.5, 1 / 2.2) * 255), label: 'Gamma 2.2 (Standard sRGB / Windows)' },
        { g: 2.4, rgb: Math.round(Math.pow(0.5, 1 / 2.4) * 255), label: 'Gamma 2.4 (BT.1886 Kino / Dark Room)' },
      ];
      const colW = (w - 80) / gammas.length;
      gammas.forEach((item, i) => {
        const x0 = 40 + i * colW;
        // 1px alternating black/white reference dither
        for (let y = 40; y < h - 40; y += 2) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x0 + 8, y, colW - 16, 1);
          ctx.fillStyle = '#000000';
          ctx.fillRect(x0 + 8, y + 1, colW - 16, 1);
        }
        // Solid gamma patch in center
        ctx.fillStyle = `rgb(${item.rgb},${item.rgb},${item.rgb})`;
        ctx.fillRect(x0 + colW * 0.24, 65, colW * 0.52, h - 130);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`${item.label} [RGB ${item.rgb}]`, x0 + 10, 28);
      });
    },
  },
  {
    id: 'subpixel-fringe-inspector',
    name: 'Inspektor Subpikseli RGB / BGR / WOLED / QD-OLED Fringe',
    category: 'Ostrość i Hz',
    description:
      'Jednopikselowe linie i pierścienie o wysokim kontraście do wykrywania kolorowych obwódek (Color Fringing) na matrycach QD-OLED (trójkątny RGB), WOLED (RWBG) oraz BGR.',
    swatchStyle: 'background:linear-gradient(90deg,#ef4444 33%,#22c55e 33% 66%,#3b82f6 66%);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const colors = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#00ffff', '#ff00ff', '#ffff00'];
      const rowH = h / colors.length;
      colors.forEach((col, i) => {
        const y = Math.floor(i * rowH + rowH * 0.5);
        ctx.fillStyle = col;
        ctx.fillRect(30, y, w * 0.42, 1);
        ctx.fillRect(30, y + 4, w * 0.42, 2);
        ctx.font = '12px monospace';
        ctx.fillText(`1px & 2px Subpixel Edge (${col})`, 30, y - 6);
      });
      // Right side: white-on-black and black-on-white 1px text & crossbars
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w * 0.52, 24, w * 0.44, h - 48);
      ctx.fillStyle = '#000000';
      for (let x = Math.floor(w * 0.55); x < w * 0.93; x += 4) {
        ctx.fillRect(x, 44, 1, h * 0.35);
      }
      for (let y = Math.floor(h * 0.48); y < h * 0.88; y += 4) {
        ctx.fillRect(Math.floor(w * 0.55), y, w * 0.38, 1);
      }
    },
  },
  {
    id: 'miniled-fald-blooming',
    name: 'Test Stref Wygaszania Mini-LED FALD & Halo Blooming',
    category: 'Podświetlenie',
    description:
      'Ruchomy jasny kursor i gwiazdy 100% bieli na czystej czerni #000000 — pozwala policzyć strefy Local Dimming (FALD) i ocenić poświatę (Halo / Blooming) wokół jasnych obiektów.',
    swatchStyle: 'background:radial-gradient(circle,#ffffff 0 8%,#000000 22% 100%);',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      // Static tiny starfield
      ctx.fillStyle = '#ffffff';
      for (let i = 1; i <= 28; i++) {
        const sx = ((i * 197) % (w - 40)) + 20;
        const sy = ((i * 313) % (h - 40)) + 20;
        ctx.fillRect(sx, sy, 2, 2);
      }
      // Orbiting bright HDR square and circle
      const cx = w * 0.5 + Math.cos(tSec * 0.85) * (w * 0.32);
      const cy = h * 0.5 + Math.sin(tSec * 1.15) * (h * 0.3);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(cx, cy, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(w - cx - 20, h - cy - 20, 40, 40);
    },
  },
  {
    id: 'pixel-walk-inversion',
    name: 'Test Inwersji Napięcia LCD (Pixel-Walk / Crosstalk)',
    category: 'Martwe piksele',
    description:
      'Mikroszachownica 1×1 i 2×1 px wykrywająca asymetrię polaryzacji ciekłych kryształów (Pixel-Walk / Vertical Interlace Artifacts) przy wysokim odświeżaniu.',
    swatchStyle: 'background:repeating-conic-gradient(#000 0% 25%,#22c55e 0% 50%) 50%/6px 6px;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const step = 4;
      ctx.fillStyle = '#00ff66';
      for (let y = 0; y < h; y += step) {
        const shift = (y / step) % 2 === 0 ? 0 : 2;
        for (let x = shift; x < w; x += step) {
          ctx.fillRect(x, y, 2, 2);
        }
      }
      ctx.fillStyle = 'rgba(15,23,42,0.88)';
      ctx.fillRect(20, 20, 490, 40);
      ctx.fillStyle = '#f8fafc';
      ctx.font = '12px monospace';
      ctx.fillText('Wzorzec polaryzacji LCD Pixel-Walk — obraz powinien być stabilny bez mrowienia', 30, 45);
    },
  },
  {
    id: 'color-checker-24',
    name: 'Tablica Referencyjna 24 Barw ColorChecker Studio',
    category: 'Kolory i gradienty',
    description:
      '24 wzorcowe próbki kolorymetryczne (odcienie skóry, nieba, roślinności, barwy podstawowe CMYK/RGB i 6-stopniowa skala neutralnej szarości D65).',
    swatchStyle: 'background:linear-gradient(90deg,#735244,#c29682,#627a9d,#576c43,#c71f37,#0085a1);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, w, h);
      const patches = [
        ['#735244', 'Dark Skin'], ['#c29682', 'Light Skin'], ['#627a9d', 'Blue Sky'], ['#576c43', 'Foliage'],
        ['#8580b1', 'Blue Flower'], ['#67bdaa', 'Bluish Green'], ['#d67e2c', 'Orange'], ['#505ba6', 'Purplish Blue'],
        ['#c15a63', 'Moderate Red'], ['#5e3c6c', 'Purple'], ['#9dbc40', 'Yellow Green'], ['#e0a32e', 'Orange Yellow'],
        ['#383d96', 'Blue'], ['#469449', 'Green'], ['#af363c', 'Red'], ['#e7c71f', 'Yellow'],
        ['#bb5695', 'Magenta'], ['#0885a1', 'Cyan'], ['#f3f3f2', 'White 95%'], ['#c8c8c8', 'Neutral 8'],
        ['#a0a0a0', 'Neutral 6.5'], ['#7a7a79', 'Neutral 5'], ['#555555', 'Neutral 3.5'], ['#343434', 'Black 2'],
      ];
      const cols = 6;
      const rows = 4;
      const pad = 16;
      const cw = (w - pad * (cols + 1)) / cols;
      const ch = (h - pad * (rows + 1)) / rows;
      patches.forEach(([hex, name], idx) => {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        const x = pad + c * (cw + pad);
        const y = pad + r * (ch + pad);
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, cw, ch);
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(x, y + ch - 24, cw, 24);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '11px monospace';
        ctx.fillText(`${name} (${hex})`, x + 8, y + ch - 8);
      });
    },
  },
  {
    id: 'response-gtg-matrix',
    name: 'Matryca Czasu Reakcji GtG (Gray-to-Gray Overshoot)',
    category: 'Ostrość i Hz',
    description:
      '5 poziomów tła szarości (0%, 25%, 50%, 75%, 90%) z ruchomymi znacznikami kontrastowymi do oceny smużenia w ciemnych przejściach VA (Dark Smearing) i przebić Overdrive.',
    swatchStyle: 'background:linear-gradient(180deg,#0a0a0a,#404040,#808080,#bfbfbf,#e5e5e5);',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      const bgLevels = [12, 64, 128, 192, 230];
      const rowH = h / bgLevels.length;
      const x = ((tSec * 720) % (w + 120)) - 120;
      bgLevels.forEach((bg, idx) => {
        const y0 = idx * rowH;
        ctx.fillStyle = `rgb(${bg},${bg},${bg})`;
        ctx.fillRect(0, y0, w, rowH);
        // Moving dark & bright test blocks on each gray background
        ctx.fillStyle = '#000000';
        ctx.fillRect(x, y0 + 10, 44, rowH - 20);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 60, y0 + 10, 44, rowH - 20);
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(x + 120, y0 + 10, 44, rowH - 20);
        ctx.fillStyle = bg > 140 ? '#0f172a' : '#f8fafc';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`GtG Base RGB(${bg}) → #000 / #FFF / Cyan @ 720 px/s`, 16, y0 + 20);
      });
    },
  },
  {
    id: 'red-15-uniformity',
    name: 'Jednolitość Czerwieni 15% IRE (Tint / Clouding)',
    category: 'Jednolitość',
    description:
      'Ciemnoczerwone tło (#3a0808) z lekką siatką stref — wykrywa nierównomierne wybarwienie subpikseli R oraz prześwity w rogach matryc IPS/OLED.',
    swatchStyle: 'background:#3a0808;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#3a0808';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = 'rgba(255,120,120,0.16)';
      ctx.strokeRect(18, 18, w - 36, h - 36);
      ctx.fillStyle = '#fca5a5';
      ctx.font = '12px monospace';
      ctx.fillText('Jednolitość kanału R (15% IRE) — sprawdź narożniki pod kątem przebarwień', 28, 40);
    },
  },
  {
    id: 'green-15-uniformity',
    name: 'Jednolitość Zieleni 15% IRE (OLED Green Tint)',
    category: 'Jednolitość',
    description:
      'Ciemnozielona plansza 15% IRE (#083a14) do diagnozy zielonego zafarbu (Green Tint) przy niskim VRR/HDR na ekranach WOLED i LTPO.',
    swatchStyle: 'background:#083a14;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#083a14';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#86efac';
      ctx.font = '12px monospace';
      ctx.fillText('Jednolitość kanału G (15% IRE) — wykrywanie tintu przy niskiej luminancji', 28, 40);
    },
  },
  {
    id: 'blue-15-uniformity',
    name: 'Jednolitość Niebieskiego 15% IRE (DSE / Backlight)',
    category: 'Jednolitość',
    description:
      'Ciemnoniebieska plansza (#08183a) ujawniająca nierówności podświetlenia Edge-LED (Clouding) i zużycie niebieskich emiterów OLED.',
    swatchStyle: 'background:#08183a;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#08183a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#93c5fd';
      ctx.font = '12px monospace';
      ctx.fillText('Jednolitość kanału B (15% IRE) — test równomierności warstwy dyfuzora', 28, 40);
    },
  },
  {
    id: 'near-black-1-4-ire',
    name: 'Test Near-Black 1%–4% IRE (OLED Chrominance Overshoot)',
    category: 'Kontrast i Gamma',
    description:
      'Kroki jasności od RGB(1,1,1) do RGB(14,14,14) na absolutnej czerni #000000 do precyzyjnej oceny kruszenia detali w najgłębszych cieniach.',
    swatchStyle: 'background:linear-gradient(90deg,#000,#030303,#070707,#0b0b0b,#0f0f0f);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const count = 14;
      const bw = w / count;
      for (let i = 1; i <= count; i++) {
        const v = i;
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect((i - 1) * bw, h * 0.14, bw - 2, h * 0.72);
        ctx.fillStyle = '#64748b';
        ctx.font = '11px monospace';
        ctx.fillText(`${v}`, (i - 1) * bw + 8, h * 0.91);
      }
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      ctx.fillText('Near-Black IRE 1%→5%: każdy blok RGB(1..14) powinien subtelnie odcinać się od czerni #000', 24, 34);
    },
  },
  {
    id: 'hdr-peak-windows',
    name: 'Symulacja Okien HDR Peak (2% / 10% / 50% APL)',
    category: 'Kontrast i Gamma',
    description:
      'Białe okna o różnej powierzchni APL na czarnym tle — pozwala zaobserwować agresywność ogranicznika jasności ABL (Automatic Brightness Limiter).',
    swatchStyle: 'background:radial-gradient(circle,#ffffff 18%,#020617 20%);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      const sizes = [
        { pct: '2% APL (Peak)', frac: 0.12 },
        { pct: '10% APL', frac: 0.24 },
        { pct: '25% APL', frac: 0.36 },
      ];
      sizes.forEach((s, idx) => {
        const bw = w * s.frac * 0.75;
        const bh = h * s.frac * 0.75;
        const cx = ((idx + 1) / (sizes.length + 1)) * w;
        const cy = h * 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '12px monospace';
        ctx.fillText(s.pct, cx - 40, cy + bh / 2 + 22);
      });
    },
  },
  {
    id: 'kelvin-color-temp',
    name: 'Referencja Temperatury Barwowej (5000K – 9300K)',
    category: 'Kolory i gradienty',
    description:
      'Porównanie bieli D50 (ciepła), D65 (wzorzec sRGB 6500K), D75 i D93 (chłodna) — szybkie sprawdzenie bez kolorymetru czy ekran nie wpada w żółć lub błękit.',
    swatchStyle: 'background:linear-gradient(90deg,#ffdca8,#fff8ef,#ffffff,#e6f0ff,#cfe0ff);',
    draw: (ctx, w, h) => {
      const temps = [
        { label: 'D50 (5000K Ciepła)', hex: '#ffe3bd' },
        { label: 'D55 (5500K)', hex: '#ffedd4' },
        { label: 'D65 (6500K Wzorzec sRGB)', hex: '#ffffff' },
        { label: 'D75 (7500K Chłodna)', hex: '#ebf3ff' },
        { label: 'D93 (9300K Zimna)', hex: '#d4e5ff' },
      ];
      const sw = w / temps.length;
      temps.forEach((t, idx) => {
        ctx.fillStyle = t.hex;
        ctx.fillRect(idx * sw, 0, sw, h);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(t.label, idx * sw + 14, h * 0.5);
      });
    },
  },
  {
    id: 'lcd-image-retention',
    name: 'Test Retencji Obrazu (Image Retention / Powidoki)',
    category: 'Matryca i Oled',
    description:
      'Kontrastowa szachownica czarno-biała do 30-sekundowego testu utrwalania obrazu (po przełączeniu na szarość 50% nie powinno zostać żadne widmo).',
    swatchStyle: 'background:repeating-conic-gradient(#000 0% 25%,#fff 0% 50%) 50%/22px 22px;',
    draw: (ctx, w, h) => {
      const size = Math.max(36, Math.round(Math.min(w, h) / 8));
      for (let y = 0; y < h; y += size) {
        for (let x = 0; x < w; x += size) {
          const isEven = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0;
          ctx.fillStyle = isEven ? '#ffffff' : '#000000';
          ctx.fillRect(x, y, size, size);
        }
      }
    },
  },
  {
    id: 'overscan-1px-border',
    name: 'Ramka 1px Overscan & Geometria Krawędzi (1:1 Mapping)',
    category: 'Ostrość i Hz',
    description:
      'Jednopikselowa obwódka po samej krawędzi ekranu oraz znaczniki 5px/10px — weryfikuje czy monitor/TV nie ucina obrazu (Overscan 0%).',
    swatchStyle: 'background:#090d16;border:3px solid #22d3ee;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
      ctx.strokeStyle = '#22d3ee';
      ctx.strokeRect(4.5, 4.5, w - 9, h - 9);
      ctx.strokeStyle = '#f59e0b';
      ctx.strokeRect(10.5, 10.5, w - 21, h - 21);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '13px monospace';
      ctx.fillText(`Biała ramka = dokładna krawędź 1px (${w}×${h}) | Cyan = 4px | Pomarańcz = 10px`, 30, h * 0.5);
    },
  },
  {
    id: 'moire-clock-phase',
    name: 'Wzór Moiré (Synchronizacja Zegara i Fazy Clock/Phase)',
    category: 'Ostrość i Hz',
    description:
      'Naprzemienne pasy pionowe i poziome co 1px wykrywające błędne skalowanie DPI, kompresję podpróbkowania chroma 4:2:0 oraz błędy fazy HDMI/DP.',
    swatchStyle: 'background:repeating-linear-gradient(90deg,#000 0 2px,#fff 2px 4px);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      for (let x = 0; x < w * 0.5; x += 2) {
        ctx.fillRect(x, 0, 1, h);
      }
      for (let y = 0; y < h; y += 2) {
        ctx.fillRect(w * 0.5, y, w * 0.5, 1);
      }
    },
  },
  {
    id: 'micro-contrast-grid',
    name: 'Mikrokontrast ANSI (1×1 / 2×2 / 4×4 Checker)',
    category: 'Ostrość i Hz',
    description:
      'Trzy strefy gęstości szachownicy pixel-to-pixel sprawdzające ostrość optyki powłoki antyrefleksyjnej (AG Coating / Matte Grain).',
    swatchStyle: 'background:repeating-conic-gradient(#111 0% 25%,#ddd 0% 50%) 50%/8px 8px;',
    draw: (ctx, w, h) => {
      const bands = [2, 4, 8];
      const bw = w / 3;
      bands.forEach((step, bIdx) => {
        const x0 = Math.floor(bIdx * bw);
        for (let y = 0; y < h; y += step) {
          for (let x = x0; x < x0 + bw; x += step) {
            const on = (Math.floor(x / step) + Math.floor(y / step)) % 2 === 0;
            ctx.fillStyle = on ? '#ffffff' : '#000000';
            ctx.fillRect(x, y, step, step);
          }
        }
        ctx.fillStyle = 'rgba(2,6,23,0.85)';
        ctx.fillRect(x0 + 16, 16, 175, 28);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`Siatka ${step}×${step} px`, x0 + 26, 35);
      });
    },
  },
  {
    id: 'diagonal-45-aa',
    name: 'Linie Ukośne 45° (Test Subpixel Anti-Aliasing & Fringing)',
    category: 'Ostrość i Hz',
    description:
      'Ukośne równoległe linie o grubości 1px na czerni i bieli do oceny gładkości czcionek ClearType oraz struktury subpikseli.',
    swatchStyle: 'background:repeating-linear-gradient(45deg,#090d16 0 6px,#e2e8f0 6px 8px);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1;
      for (let i = -h; i < w + h; i += 10) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h, h);
        ctx.stroke();
      }
    },
  },
  {
    id: 'vrr-tear-strobe',
    name: 'Pionowy Pasek Szybkości (Tearing / VRR Flicker Strobe)',
    category: 'Ostrość i Hz',
    description:
      'Szybko poruszający się pionowy pas o wysokiej jasności na ciemnym tle — natychmiast ujawnia rozrywanie klatek (Screen Tearing) i migotanie G-Sync/FreeSync.',
    swatchStyle: 'background:linear-gradient(90deg,#0a0e1a 45%,#06b6d4 50%,#0a0e1a 55%);',
    animated: true,
    draw: (ctx, w, h, tSec) => {
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, w, h);
      const x = ((tSec * 1200) % (w + 60)) - 30;
      ctx.fillStyle = '#22d3ee';
      ctx.fillRect(x, 0, 14, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 5, 0, 4, h);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px monospace';
      ctx.fillText('Pasek 1200 px/s — powinien przesuwać się jednym kawałkiem bez załamań (VSync / VRR)', 24, 34);
    },
  },
  {
    id: 'cmy-saturation-bars',
    name: 'Pasy Nasycenia CMY + White Saturation Clipping',
    category: 'Kolory i gradienty',
    description:
      'Kontrola oddzielenia kanałów Cyjan, Magenta, Żółty oraz detekcja przycinania jasnych detali (White Crush 94%–100%).',
    swatchStyle: 'background:linear-gradient(90deg,#00ffff,#ff00ff,#ffff00,#f8fafc);',
    draw: (ctx, w, h) => {
      const bars = ['#00ffff', '#ff00ff', '#ffff00', '#ffffff', '#ef4444', '#22c55e', '#3b82f6'];
      const bw = w / bars.length;
      bars.forEach((col, i) => {
        ctx.fillStyle = col;
        ctx.fillRect(i * bw, 0, bw, h * 0.72);
      });
      const whiteSteps = [235, 240, 244, 248, 251, 253, 255];
      const sw = w / whiteSteps.length;
      whiteSteps.forEach((v, i) => {
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(i * sw, h * 0.72, sw, h * 0.28);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px monospace';
        ctx.fillText(`White ${v}`, i * sw + 12, h * 0.88);
      });
    },
  },
  {
    id: 'nine-zone-vignette',
    name: 'Matryca 9-Strefowej Jasności (Vignette & Center Uniformity)',
    category: 'Jednolitość',
    description:
      '9 jednakowych tarcz referencyjnych 50% bieli (#808080) rozmieszczonych w strefach pomiaru kolorymetrem (narożniki i środek).',
    swatchStyle: 'background:#808080;',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#6e6e6e';
      ctx.fillRect(0, 0, w, h);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          const cx = ((c + 0.5) / 3) * w;
          const cy = ((r + 0.5) / 3) * h;
          ctx.strokeStyle = 'rgba(255,255,255,0.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(cx, cy, Math.min(w, h) * 0.08, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#f8fafc';
          ctx.font = '11px monospace';
          ctx.fillText(`Z${r * 3 + c + 1} (50%)`, cx - 26, cy + 4);
        }
      }
    },
  },
  {
    id: 'grayscale-64-staircase',
    name: 'Schody 64-Bitowej Szarości (8-bit vs 10-bit Banding)',
    category: 'Kontrast i Gamma',
    description:
      '64 pionowe progi szarości pozwalające ocenić liniowość krzywej gamma 2.2 oraz obecność artefaktów kwantyzacji FRC na matrycach 6-bit+FRC.',
    swatchStyle: 'background:linear-gradient(90deg,#000,#333,#666,#999,#ccc,#fff);',
    draw: (ctx, w, h) => {
      const steps = 64;
      const sw = w / steps;
      for (let i = 0; i < steps; i++) {
        const v = Math.round((i / (steps - 1)) * 255);
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(i * sw, 0, Math.ceil(sw), h);
      }
    },
  },
  {
    id: 'pwm-flicker-slit',
    name: 'Test Migotania Podświetlenia PWM (Slit Camera Test)',
    category: 'Ostrość i Hz',
    description:
      'Biały pasek na ciemnym tle z linią referencyjną — spójrz przez aparat smartfona z krótkim czasem naświetlania (1/1000s), aby sprawdzić czy ekran stosuje PWM.',
    swatchStyle: 'background:linear-gradient(180deg,#000 35%,#fff 45%,#fff 55%,#000 65%);',
    draw: (ctx, w, h) => {
      ctx.fillStyle = '#09090b';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(w * 0.15, h * 0.43, w * 0.7, h * 0.14);
      ctx.fillStyle = '#09090b';
      ctx.font = 'bold 13px monospace';
      ctx.fillText('Skieruj kamerę telefonu (Tryb Pro 1/1000s) — czarne paski = PWM Flicker', w * 0.18, h * 0.51);
    },
  },
];

export const OLED_PROTECTION_DURATION_SEC = 60 * 60;

export function formatCountdownMmSs(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Renders a continuously moving, ultra-low-brightness pixel-shift pattern on a pure black (#000000)
 * background so OLED subpixels are gently and evenly exercised without static bright regions.
 */
export function drawOledBurnInProtectionPattern(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  tSec: number
): void {
  // True black base (OLED pixels off)
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, w, h);

  // Slow drifting diagonal low-brightness luminance bands (peak channel <= 36/255)
  const bandCount = 5;
  const diagSpan = w + h;
  const drift = (tSec * 28) % diagSpan;
  ctx.save();
  for (let i = 0; i < bandCount; i++) {
    const offset = ((i / bandCount) * diagSpan + drift) % diagSpan;
    const bandW = Math.max(90, Math.min(w, h) * 0.22);
    const phase = tSec * 0.18 + i * 1.35;
    const r = Math.round(14 + 12 * (0.5 + 0.5 * Math.sin(phase)));
    const g = Math.round(14 + 12 * (0.5 + 0.5 * Math.sin(phase + 2.094)));
    const b = Math.round(16 + 14 * (0.5 + 0.5 * Math.sin(phase + 4.188)));

    const grad = ctx.createLinearGradient(offset - bandW, 0, offset + bandW, h);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    grad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 0.85)`);
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  // Gently orbiting low-brightness soft radial glows (balanced R/G/B pixel exercise)
  const orbSpecs = [
    { fx: 0.11, fy: 0.08, px: 0.0, py: 0.5, color: 'rgba(26, 16, 20, 0.72)' },
    { fx: 0.07, fy: 0.13, px: 2.1, py: 1.4, color: 'rgba(14, 24, 22, 0.72)' },
    { fx: 0.09, fy: 0.06, px: 4.2, py: 2.8, color: 'rgba(16, 20, 30, 0.75)' },
  ];
  const radius = Math.max(w, h) * 0.28;
  for (const orb of orbSpecs) {
    const cx = w * (0.5 + 0.42 * Math.sin(tSec * orb.fx + orb.px));
    const cy = h * (0.5 + 0.42 * Math.cos(tSec * orb.fy + orb.py));
    const rGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    rGrad.addColorStop(0, orb.color);
    rGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = rGrad;
    ctx.fillRect(0, 0, w, h);
  }

  // Thin slow-sweeping pixel-shift wash bar moving horizontally and vertically
  const sweepX = ((tSec * 22) % (w + 140)) - 70;
  const hSweep = ctx.createLinearGradient(sweepX - 55, 0, sweepX + 55, 0);
  hSweep.addColorStop(0, 'rgba(0, 0, 0, 0)');
  hSweep.addColorStop(0.5, 'rgba(24, 28, 34, 0.55)');
  hSweep.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = hSweep;
  ctx.fillRect(Math.max(0, sweepX - 55), 0, 110, h);

  const sweepY = ((tSec * 14) % (h + 120)) - 60;
  const vSweep = ctx.createLinearGradient(0, sweepY - 45, 0, sweepY + 45);
  vSweep.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vSweep.addColorStop(0.5, 'rgba(22, 26, 30, 0.45)');
  vSweep.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = vSweep;
  ctx.fillRect(0, Math.max(0, sweepY - 45), w, 90);
  ctx.restore();
}

export interface OledProtectionOptions {
  durationSec?: number;
  onTick?: (remainingSec: number, progressPct: number) => void;
  onComplete?: () => void;
  onStop?: (completed: boolean) => void;
}

function drawUniformityGuides(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: string
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.strokeRect(18, 18, w - 36, h - 36);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
}

export class DisplayDiagnosticController {
  private canvas: HTMLCanvasElement | null = null;
  private rafId = 0;
  private startTs = performance.now();
  private patternIndex = 0;
  private showGrid = true;
  private fullscreenOverlay: HTMLDivElement | null = null;
  private fullscreenCanvas: HTMLCanvasElement | null = null;
  private hudHideTimer: number | null = null;
  private onPatternChange?: (index: number) => void;

  private oledProtectionActive = false;
  private oledDurationSec = OLED_PROTECTION_DURATION_SEC;
  private oledStartedAtMs = 0;
  private oledTimerId: number | null = null;
  private oledOptions: OledProtectionOptions | null = null;
  private oledHudTimerEl: HTMLElement | null = null;
  private oledHudProgressEl: HTMLElement | null = null;

  public getPatternIndex(): number {
    return this.patternIndex;
  }

  public getShowGrid(): boolean {
    return this.showGrid;
  }

  public setShowGrid(val: boolean): void {
    this.showGrid = val;
    this.renderOnce();
  }

  public setPattern(index: number): void {
    this.patternIndex = (index + DISPLAY_PATTERNS.length) % DISPLAY_PATTERNS.length;
    this.onPatternChange?.(this.patternIndex);
    this.updateFullscreenHudLabel();
    this.renderOnce();
    this.ensureLoop();
  }

  public isOledProtectionActive(): boolean {
    return this.oledProtectionActive;
  }

  public getOledProtectionRemainingSec(): number {
    if (!this.oledProtectionActive) return 0;
    const elapsedSec = (Date.now() - this.oledStartedAtMs) / 1000;
    return Math.max(0, Math.ceil(this.oledDurationSec - elapsedSec));
  }

  public getOledProtectionProgressPct(): number {
    if (!this.oledProtectionActive || this.oledDurationSec <= 0) return 0;
    const elapsedSec = (Date.now() - this.oledStartedAtMs) / 1000;
    return Math.max(0, Math.min(100, (elapsedSec / this.oledDurationSec) * 100));
  }

  public attachPreviewCanvas(
    canvas: HTMLCanvasElement,
    onPatternChange: (idx: number) => void
  ): void {
    this.canvas = canvas;
    this.onPatternChange = onPatternChange;
    this.syncCanvasSize(canvas);
    this.renderOnce();
    this.ensureLoop();
  }

  public detachPreviewCanvas(): void {
    if (!this.fullscreenCanvas) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    this.canvas = null;
  }

  private syncCanvasSize(canvas: HTMLCanvasElement): void {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(300, Math.round(rect.width * dpr));
    const h = Math.max(200, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  private renderTarget(canvas: HTMLCanvasElement | null, tSec: number): void {
    if (!canvas) return;
    this.syncCanvasSize(canvas);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (this.oledProtectionActive && canvas === this.fullscreenCanvas) {
      drawOledBurnInProtectionPattern(ctx, canvas.width, canvas.height, tSec);
      return;
    }
    const pat = DISPLAY_PATTERNS[this.patternIndex];
    pat.draw(ctx, canvas.width, canvas.height, tSec, this.showGrid);
  }

  private renderOnce(): void {
    const tSec = (performance.now() - this.startTs) / 1000;
    this.renderTarget(this.canvas, tSec);
    this.renderTarget(this.fullscreenCanvas, tSec);
  }

  private ensureLoop(): void {
    cancelAnimationFrame(this.rafId);
    const pat = DISPLAY_PATTERNS[this.patternIndex];
    if (!pat.animated && !this.oledProtectionActive) return;
    const loop = () => {
      if (!this.canvas && !this.fullscreenCanvas) return;
      if (!DISPLAY_PATTERNS[this.patternIndex].animated && !this.oledProtectionActive) return;
      this.renderOnce();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private hudLabelEl: HTMLElement | null = null;

  private updateFullscreenHudLabel(): void {
    if (!this.hudLabelEl) return;
    const pat = DISPLAY_PATTERNS[this.patternIndex];
    this.hudLabelEl.textContent = `${this.patternIndex + 1}/${DISPLAY_PATTERNS.length} · ${pat.name}`;
  }

  public startOledBurnInProtection(options?: OledProtectionOptions): void {
    if (this.oledProtectionActive) {
      this.stopOledBurnInProtection(false);
    } else if (this.fullscreenOverlay) {
      this.closeFullscreen();
    }

    const oledIdx = DISPLAY_PATTERNS.findIndex((p) => p.id === 'oled-burnin-protection');
    if (oledIdx >= 0) {
      this.patternIndex = oledIdx;
      this.onPatternChange?.(oledIdx);
    }

    const durationSec = Math.max(1, Math.round(options?.durationSec ?? OLED_PROTECTION_DURATION_SEC));
    this.oledProtectionActive = true;
    this.oledDurationSec = durationSec;
    this.oledStartedAtMs = Date.now();
    this.oledOptions = options ?? null;

    const overlay = document.createElement('div');
    overlay.className = 'display-fullscreen-overlay oled-protection-overlay show-hud';
    overlay.dataset.oledProtection = 'active';

    const fsCanvas = document.createElement('canvas');
    fsCanvas.style.width = '100vw';
    fsCanvas.style.height = '100vh';
    fsCanvas.style.display = 'block';

    const hud = document.createElement('div');
    hud.className = 'display-fullscreen-hud oled-protection-hud';

    const titleEl = document.createElement('span');
    titleEl.className = 'oled-hud-title';
    titleEl.textContent = 'OLED Burn-in Protection';

    const timerEl = document.createElement('span');
    timerEl.className = 'font-mono oled-hud-timer';
    timerEl.textContent = `Pozostało: ${formatCountdownMmSs(durationSec)} / ${formatCountdownMmSs(durationSec)}`;
    this.oledHudTimerEl = timerEl;

    const progressTrack = document.createElement('div');
    progressTrack.className = 'oled-hud-progress-track';
    const progressFill = document.createElement('div');
    progressFill.className = 'oled-hud-progress-fill';
    progressFill.style.width = '0%';
    progressTrack.appendChild(progressFill);
    this.oledHudProgressEl = progressFill;

    const stopBtn = document.createElement('button');
    stopBtn.className = 'btn btn-secondary btn-sm';
    stopBtn.textContent = 'Zatrzymaj (ESC)';
    stopBtn.onclick = (e) => {
      e.stopPropagation();
      this.stopOledBurnInProtection(false);
    };

    hud.append(titleEl, timerEl, progressTrack, stopBtn);
    overlay.append(fsCanvas, hud);
    document.body.appendChild(overlay);

    this.fullscreenOverlay = overlay;
    this.fullscreenCanvas = fsCanvas;

    const wakeHud = () => {
      overlay.classList.add('show-hud');
      hud.style.opacity = '0.78';
      if (this.hudHideTimer) clearTimeout(this.hudHideTimer);
      // Auto-hide completely so even the HUD never causes static pixel wear
      this.hudHideTimer = window.setTimeout(() => {
        overlay.classList.remove('show-hud');
        hud.style.opacity = '0';
      }, 2800);
    };

    overlay.addEventListener('mousemove', wakeHud);
    overlay.addEventListener('click', wakeHud);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.stopOledBurnInProtection(false);
      }
    };
    window.addEventListener('keydown', onKey);
    (overlay as any)._cleanupKey = () => window.removeEventListener('keydown', onKey);

    try {
      void overlay.requestFullscreen?.();
    } catch {
      // Fullscreen optional inside sandboxed iframe
    }

    const onFsChange = () => {
      this.renderOnce();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    (overlay as any)._cleanupFs = () => document.removeEventListener('fullscreenchange', onFsChange);

    const tick = () => {
      if (!this.oledProtectionActive) return;
      const elapsedSec = (Date.now() - this.oledStartedAtMs) / 1000;
      const remaining = Math.max(0, Math.ceil(this.oledDurationSec - elapsedSec));
      const progressPct = Math.max(0, Math.min(100, (elapsedSec / this.oledDurationSec) * 100));

      if (this.oledHudTimerEl) {
        this.oledHudTimerEl.textContent = `Pozostało: ${formatCountdownMmSs(remaining)} / ${formatCountdownMmSs(this.oledDurationSec)}`;
      }
      if (this.oledHudProgressEl) {
        this.oledHudProgressEl.style.width = `${progressPct.toFixed(1)}%`;
      }

      this.oledOptions?.onTick?.(remaining, progressPct);

      if (elapsedSec >= this.oledDurationSec) {
        this.stopOledBurnInProtection(true);
      }
    };

    this.oledTimerId = window.setInterval(tick, 1000);
    this.oledOptions?.onTick?.(durationSec, 0);

    wakeHud();
    this.renderOnce();
    this.ensureLoop();
  }

  public stopOledBurnInProtection(completed = false): void {
    if (!this.oledProtectionActive) return;
    this.oledProtectionActive = false;
    if (this.oledTimerId !== null) {
      clearInterval(this.oledTimerId);
      this.oledTimerId = null;
    }
    const callbacks = this.oledOptions;
    this.oledOptions = null;
    this.oledHudTimerEl = null;
    this.oledHudProgressEl = null;

    this.teardownFullscreenOverlay();

    if (completed) {
      callbacks?.onComplete?.();
    }
    callbacks?.onStop?.(completed);
  }

  public openFullscreen(): void {
    if (this.oledProtectionActive) {
      this.stopOledBurnInProtection(false);
    }
    if (this.fullscreenOverlay) return;

    const overlay = document.createElement('div');
    overlay.className = 'display-fullscreen-overlay show-hud';

    const fsCanvas = document.createElement('canvas');
    fsCanvas.style.width = '100vw';
    fsCanvas.style.height = '100vh';
    fsCanvas.style.display = 'block';

    const hud = document.createElement('div');
    hud.className = 'display-fullscreen-hud';

    const prevBtn = document.createElement('button');
    prevBtn.className = 'btn btn-secondary btn-sm';
    prevBtn.textContent = 'Poprzedni';
    prevBtn.onclick = (e) => {
      e.stopPropagation();
      this.setPattern(this.patternIndex - 1);
    };

    const label = document.createElement('span');
    label.className = 'font-mono';
    this.hudLabelEl = label;

    const nextBtn = document.createElement('button');
    nextBtn.className = 'btn btn-secondary btn-sm';
    nextBtn.textContent = 'Następny';
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      this.setPattern(this.patternIndex + 1);
    };

    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn btn-danger btn-sm';
    closeBtn.textContent = 'Zamknij (ESC)';
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      this.closeFullscreen();
    };

    hud.append(prevBtn, label, nextBtn, closeBtn);
    overlay.append(fsCanvas, hud);
    document.body.appendChild(overlay);

    this.fullscreenOverlay = overlay;
    this.fullscreenCanvas = fsCanvas;
    this.updateFullscreenHudLabel();

    const wakeHud = () => {
      overlay.classList.add('show-hud');
      hud.style.opacity = '1';
      if (this.hudHideTimer) clearTimeout(this.hudHideTimer);
      this.hudHideTimer = window.setTimeout(() => {
        overlay.classList.remove('show-hud');
        hud.style.opacity = '0';
      }, 2600);
    };

    overlay.addEventListener('mousemove', wakeHud);
    overlay.addEventListener('click', () => this.setPattern(this.patternIndex + 1));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') this.closeFullscreen();
      else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        this.setPattern(this.patternIndex + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.setPattern(this.patternIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    (overlay as any)._cleanupKey = () => window.removeEventListener('keydown', onKey);

    try {
      void overlay.requestFullscreen?.();
    } catch {
      // Fullscreen optional inside sandboxed iframe
    }

    const onFsChange = () => {
      this.renderOnce();
    };
    document.addEventListener('fullscreenchange', onFsChange);
    (overlay as any)._cleanupFs = () => document.removeEventListener('fullscreenchange', onFsChange);

    wakeHud();
    this.renderOnce();
    this.ensureLoop();
  }

  private teardownFullscreenOverlay(): void {
    if (!this.fullscreenOverlay) return;
    if (this.hudHideTimer) {
      clearTimeout(this.hudHideTimer);
      this.hudHideTimer = null;
    }
    (this.fullscreenOverlay as any)._cleanupKey?.();
    (this.fullscreenOverlay as any)._cleanupFs?.();
    if (document.fullscreenElement === this.fullscreenOverlay) {
      void document.exitFullscreen?.();
    }
    this.fullscreenOverlay.remove();
    this.fullscreenOverlay = null;
    this.fullscreenCanvas = null;
    this.hudLabelEl = null;
    if (!this.canvas) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  public closeFullscreen(): void {
    if (this.oledProtectionActive) {
      this.stopOledBurnInProtection(false);
      return;
    }
    this.teardownFullscreenOverlay();
  }
}

export const displayDiagnostics = new DisplayDiagnosticController();
