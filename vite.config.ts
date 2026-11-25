import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const APP_VERSION = '5.4.0';
const BUILD_TIMESTAMP = Date.now();

interface StoredGlobalRankingEntry {
  id: string;
  name: string;
  tierLabel: string;
  category: string;
  cpuSummary: string;
  gpuSummary: string;
  ramSummary?: string;
  diskSummary?: string;
  cpuScore: number;
  gpuScore: number;
  ramScore: number;
  diskScore: number;
  overallScore: number;
  testedCount?: number;
  isCurrentPc?: boolean;
  isUserSaved?: boolean;
  savedAt?: number;
}

function createSystemPulseGlobalServerPlugin(): Plugin {
  const dataDir = path.resolve(process.cwd(), 'data');
  const rankingsFile = path.join(dataDir, 'global-rankings.json');

  const readRankings = (): StoredGlobalRankingEntry[] => {
    try {
      if (!fs.existsSync(rankingsFile)) return [];
      const raw = fs.readFileSync(rankingsFile, 'utf-8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item: StoredGlobalRankingEntry) =>
          item &&
          typeof item.id === 'string' &&
          !item.id.startsWith('ref_') &&
          typeof item.name === 'string' &&
          typeof item.overallScore === 'number' &&
          item.overallScore > 0
      );
    } catch {
      return [];
    }
  };

  const writeRankings = (list: StoredGlobalRankingEntry[]): void => {
    try {
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(rankingsFile, JSON.stringify(list.slice(0, 100), null, 2), 'utf-8');
    } catch {
      // Ignore write error on read-only fs
    }
  };

  const attachMiddleware = (middlewares: any) => {
    middlewares.use((req: any, res: any, next: any) => {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      const pathname = urlObj.pathname;

      if (pathname === '/api/app/version') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.end(
          JSON.stringify({
            ok: true,
            version: APP_VERSION,
            buildTimestamp: BUILD_TIMESTAMP,
            releasedAtIso: new Date(BUILD_TIMESTAMP).toISOString(),
            features: [
              'Globalny Ranking LIVE (automatyczna publikacja i synchronizacja prawdziwych wyników na cały świat)',
              'Prawdziwy pomiar Speed Testu odporny na buforowanie proxy antywirusa (Bitdefender / OS TCP Buffer)',
              'Kalibracja DDR5-6000 Kingston (99/100 WZOROWY) + 0 zmyślonych komputerów referencyjnych',
              'Automatyczna kompilacja natywnego SystemPulse-Pro.exe i SystemPulse-Pro-Setup.exe (csc.exe)',
            ],
          })
        );
        return;
      }

      if (pathname === '/api/global/rankings') {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        if (req.method === 'GET') {
          const entries = readRankings().sort((a, b) => b.overallScore - a.overallScore);
          res.end(
            JSON.stringify({
              ok: true,
              version: APP_VERSION,
              totalGlobalEntries: entries.length,
              entries,
            })
          );
          return;
        }

        if (req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => {
            body += String(chunk);
            if (body.length > 256 * 1024) req.destroy();
          });
          req.on('end', () => {
            try {
              const payload = JSON.parse(body || '{}');
              const incoming: any[] = Array.isArray(payload.entries)
                ? payload.entries
                : payload.entry
                  ? [payload.entry]
                  : payload.id
                    ? [payload]
                    : [];

              const current = readRankings();
              for (const item of incoming) {
                if (!item || typeof item.id !== 'string' || item.id.startsWith('ref_')) continue;
                const hasRealScore =
                  Number(item.cpuScore) > 0 ||
                  Number(item.gpuScore) > 0 ||
                  Number(item.ramScore) > 0 ||
                  Number(item.diskScore) > 0;
                if (!hasRealScore || Number(item.overallScore) <= 0) continue;

                const cleanEntry: StoredGlobalRankingEntry = {
                  id: String(item.id).slice(0, 80),
                  name: String(item.name || item.label || 'Komputer PC').slice(0, 120),
                  tierLabel: String(item.tierLabel || item.tierBadge || 'A BARDZO DOBRY').slice(0, 40),
                  category: 'Twój Zapisany PC',
                  cpuSummary: String(item.cpuSummary || item.cpuModel || 'CPU').slice(0, 140),
                  gpuSummary: String(item.gpuSummary || item.gpuModel || 'GPU').slice(0, 140),
                  ramSummary: String(item.ramSummary || 'RAM').slice(0, 140),
                  diskSummary: String(item.diskSummary || item.diskModel || 'Dysk').slice(0, 140),
                  cpuScore: Math.max(0, Math.min(100, Math.round(Number(item.cpuScore) || 0))),
                  gpuScore: Math.max(0, Math.min(100, Math.round(Number(item.gpuScore) || 0))),
                  ramScore: Math.max(0, Math.min(100, Math.round(Number(item.ramScore) || 0))),
                  diskScore: Math.max(0, Math.min(100, Math.round(Number(item.diskScore) || 0))),
                  overallScore: Math.max(1, Math.min(100, Math.round(Number(item.overallScore) || 0))),
                  testedCount: Math.max(1, Math.min(4, Math.round(Number(item.testedCount) || 1))),
                  isCurrentPc: false,
                  isUserSaved: true,
                  savedAt: Number(item.savedAt) || Date.now(),
                };

                const existingIdx = current.findIndex((e) => e.id === cleanEntry.id);
                if (existingIdx >= 0) {
                  current[existingIdx] = cleanEntry;
                } else {
                  current.unshift(cleanEntry);
                }
              }

              current.sort((a, b) => b.overallScore - a.overallScore);
              const trimmed = current.slice(0, 100);
              writeRankings(trimmed);
              res.end(
                JSON.stringify({
                  ok: true,
                  totalGlobalEntries: trimmed.length,
                  entries: trimmed,
                })
              );
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ ok: false, error: String(err) }));
            }
          });
          return;
        }

        if (req.method === 'DELETE') {
          const targetId = urlObj.searchParams.get('id');
          if (targetId) {
            const filtered = readRankings().filter((e) => e.id !== targetId);
            writeRankings(filtered);
            res.end(JSON.stringify({ ok: true, entries: filtered }));
          } else {
            writeRankings([]);
            res.end(JSON.stringify({ ok: true, entries: [] }));
          }
          return;
        }
      }

      next();
    });
  };

  return {
    name: 'systempulse-global-server',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig({
  plugins: [
    createSystemPulseGlobalServerPlugin(),
    ...(!process.env.VITEST
      ? [
          VitePWA({
            registerType: 'autoUpdate',
            includeAssets: [
              'favicon.ico',
              'apple-touch-icon.png',
              'icon.svg',
              'icon-maskable.svg',
            ],
            manifest: {
              id: '/',
              name: 'SystemPulse Pro — Diagnostyka PC i Benchmarki 3D',
              short_name: 'SystemPulse',
              description:
                'Kompleksowy pakiet diagnostyki sprzętu PC i laptopa, benchmarki GPU 3D, CPU, RAM, dysków i analiza gier.',
              theme_color: '#070b14',
              background_color: '#070b14',
              display: 'standalone',
              start_url: '/',
              scope: '/',
              icons: [
                {
                  src: '/pwa-192x192.png',
                  sizes: '192x192',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: '/pwa-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'any',
                },
                {
                  src: '/pwa-maskable-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
              globIgnores: ['**/portable-bundle.js', '**/portable-styles.css'],
              runtimeCaching: [
                {
                  urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'google-fonts-cache',
                    expiration: {
                      maxEntries: 10,
                      maxAgeSeconds: 60 * 60 * 24 * 365,
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
                {
                  urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
                  handler: 'CacheFirst',
                  options: {
                    cacheName: 'gstatic-fonts-cache',
                    expiration: {
                      maxEntries: 10,
                      maxAgeSeconds: 60 * 60 * 24 * 365,
                    },
                    cacheableResponse: {
                      statuses: [0, 200],
                    },
                  },
                },
              ],
            },
            devOptions: {
              enabled: true,
              type: 'module',
            },
          }),
        ]
      : []),
  ],
  build: {
    chunkSizeWarningLimit: 5000,
  },
});
