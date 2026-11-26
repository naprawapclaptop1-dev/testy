import {
  NetworkAdapterInfo,
  NetworkPingSample,
  NetworkSpeedSample,
  NetworkTestResult,
  NetworkTransferDirection,
  SpeedTestServerProbe,
} from '../types';
import { getLocalBridgeBases, isHostedOnExeBridge } from './localBridge';

export interface CableStandardSpec {
  id: string;
  label: string;
  medium: 'Kabel (LAN)' | 'Wi-Fi';
  phyMbps: number;
  realTcpMaxMbps: number;
  maxDistance: string;
  note: string;
}

export const NETWORK_CABLE_AND_WIFI_STANDARDS: CableStandardSpec[] = [
  { id: 'cat5', label: 'Cat 5 (100BASE-TX)', medium: 'Kabel (LAN)', phyMbps: 100, realTcpMaxMbps: 94, maxDistance: '100 m', note: 'Stary przewód 4-żyłowy (max ~94 Mbps real)' },
  { id: 'cat5e', label: 'Cat 5e (1G / 2.5G BASE-T)', medium: 'Kabel (LAN)', phyMbps: 1000, realTcpMaxMbps: 940, maxDistance: '100 m (2.5G do 100 m)', note: 'Standard 1 Gbps (~940 Mbps real); do 2.5 Gbps na krótkich odcinkach' },
  { id: 'cat6', label: 'Cat 6 (1G / 5G / 10G < 55m)', medium: 'Kabel (LAN)', phyMbps: 2500, realTcpMaxMbps: 2350, maxDistance: '100 m (2.5G) / 55 m (10G)', note: 'Pewne 2.5G–5G Ethernet i 10GBASE-T do 37–55 m' },
  { id: 'cat6a', label: 'Cat 6a (10GBASE-T ekranowany)', medium: 'Kabel (LAN)', phyMbps: 10000, realTcpMaxMbps: 9400, maxDistance: '100 m @ 10 Gbps', note: 'Pełne 10 Gbps (9.4 Gbps real TCP) na pełnych 100 metrach' },
  { id: 'cat7_8', label: 'Cat 7 / Cat 8 / Światłowód SFP+', medium: 'Kabel (LAN)', phyMbps: 25000, realTcpMaxMbps: 23500, maxDistance: '30 m (Cat8) / 10 km (SFP+)', note: 'Ultra-niskie opóźnienia i 25G/40G do serwerów i routerów 10G' },
  { id: 'wifi5', label: 'Wi-Fi 5 (802.11ac 2×2 80 MHz)', medium: 'Wi-Fi', phyMbps: 867, realTcpMaxMbps: 520, maxDistance: 'Ściany tłumi ~50%', note: 'Realnie 350–550 Mbps TCP przy idealnym zasięgu 5 GHz' },
  { id: 'wifi6', label: 'Wi-Fi 6 / 6E (802.11ax 160 MHz)', medium: 'Wi-Fi', phyMbps: 2402, realTcpMaxMbps: 1650, maxDistance: 'Średni zasięg 5/6 GHz', note: 'Realnie 1.1–1.7 Gbps TCP z kartą Intel AX200/AX210 lub MediaTek' },
  { id: 'wifi7', label: 'Wi-Fi 7 (802.11be 320 MHz MLO)', medium: 'Wi-Fi', phyMbps: 5764, realTcpMaxMbps: 4200, maxDistance: 'Krótki zasięg 6 GHz MLO', note: 'Multi-Link Operation — do 4.2+ Gbps bez kabla' },
];

export const NET_ADAPTER_PS_COMMAND =
  'Get-NetAdapter | Select-Object Name,InterfaceDescription,Status,LinkSpeed,MacAddress | Format-Table -AutoSize | Out-String -Width 400 | Set-Clipboard';

function classifyLinkStandard(linkMbps: number, type: NetworkAdapterInfo['type']): { standard: string; tcpMax: number } {
  if (type === 'Wi-Fi') {
    if (linkMbps >= 4000) return { standard: 'Wi-Fi 7 (802.11be MLO 320 MHz)', tcpMax: Math.round(linkMbps * 0.72) };
    if (linkMbps >= 1800) return { standard: 'Wi-Fi 6 / 6E (802.11ax 160 MHz)', tcpMax: Math.round(linkMbps * 0.7) };
    if (linkMbps >= 700) return { standard: 'Wi-Fi 5 / Wi-Fi 6 (80 MHz)', tcpMax: Math.round(linkMbps * 0.65) };
    return { standard: 'Wi-Fi 4 / 2.4 GHz lub słaby zasięg', tcpMax: Math.round(linkMbps * 0.55) };
  }
  if (linkMbps >= 25000) return { standard: 'SFP28 / Cat 8 (25+ Gbps)', tcpMax: Math.round(linkMbps * 0.94) };
  if (linkMbps >= 10000) return { standard: '10GBASE-T / SFP+ (Cat 6a / Światłowód)', tcpMax: 9400 };
  if (linkMbps >= 5000) return { standard: '5GBASE-T (Cat 6 / Cat 6a)', tcpMax: 4700 };
  if (linkMbps >= 2500) return { standard: '2.5GBASE-T (Cat 5e krótkie / Cat 6)', tcpMax: 2350 };
  if (linkMbps >= 1000) return { standard: '1000BASE-T Gigabit (Cat 5e / Cat 6)', tcpMax: 940 };
  if (linkMbps >= 100) return { standard: '100BASE-TX Fast Ethernet (Cat 5 lub uszkodzona żyła!)', tcpMax: 94 };
  return { standard: 'Brak negocjacji PHY', tcpMax: 0 };
}

export function parseLinkSpeedTextToMbps(raw: string): number {
  const m = raw.match(/(\d+(?:[.,]\d+)?)\s*(Gbps|Mbps|Kbps|bps)/i);
  if (!m) return 0;
  const val = parseFloat(m[1].replace(',', '.'));
  const unit = m[2].toLowerCase();
  if (unit === 'gbps') return Math.round(val * 1000);
  if (unit === 'mbps') return Math.round(val);
  if (unit === 'kbps') return Number((val / 1000).toFixed(2));
  return Math.round(val / 1_000_000);
}

export function parseNetAdapterPaste(rawText: string): NetworkAdapterInfo[] {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const parsed: NetworkAdapterInfo[] = [];
  for (const line of lines) {
    if (/^[-=]+$/.test(line) || /^Name\s+InterfaceDescription/i.test(line)) continue;
    const speedMatch = line.match(/(\d+(?:[.,]\d+)?\s*(?:Gbps|Mbps|Kbps|bps))/i);
    if (!speedMatch) continue;
    const linkMbps = parseLinkSpeedTextToMbps(speedMatch[1]);
    const isUp = /\bUp\b/i.test(line);
    const macMatch = line.match(/([0-9A-Fa-f]{2}(?:[-:][0-9A-Fa-f]{2}){5})/);
    const isWifi = /wi-?fi|wireless|wlan|ax20\d|ax21\d|be200|802\.11/i.test(line);
    const isEth = /ethernet|realtek|intel\(r\)\s*ethernet|i225|i226|r8125|killer|marvell|aquantia|sfp|lan/i.test(line);
    const type: NetworkAdapterInfo['type'] = isWifi ? 'Wi-Fi' : isEth ? 'Ethernet (LAN)' : 'VPN / Inne';
    const beforeStatus = line.split(/\b(?:Up|Disconnected|Disabled|Not Present)\b/i)[0].trim();
    const parts = beforeStatus.split(/\s{2,}/);
    const name = parts[0] || (isWifi ? 'Wi-Fi' : 'Ethernet');
    const description = parts.slice(1).join(' ') || beforeStatus;
    const cls = classifyLinkStandard(linkMbps, type);
    parsed.push({
      name,
      description,
      type,
      status: isUp ? 'Up' : 'Disconnected',
      linkSpeedMbps: linkMbps,
      maxStandardLabel: cls.standard,
      theoreticalMaxTcpMbps: cls.tcpMax,
      macAddress: macMatch ? macMatch[1] : '',
    });
  }
  return parsed;
}

export async function probeLocalNetworkAdapters(force = false): Promise<{
  adapters: NetworkAdapterInfo[];
  source: string;
}> {
  const fromApi: NetworkAdapterInfo[] = [];
  const bases = getLocalBridgeBases(force);
  for (const base of bases) {
    try {
      const resp = await fetch(`${base}/api/network/adapters`, { cache: 'no-store' });
      if (resp.ok) {
        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('json')) continue;
        const json = (await resp.json()) as {
          adapters?: Array<{
            name?: string;
            description?: string;
            type?: string;
            status?: string;
            linkSpeedMbps?: number;
            macAddress?: string;
          }>;
        };
        for (const raw of json.adapters || []) {
          const type: NetworkAdapterInfo['type'] =
            raw.type === 'Wi-Fi' ? 'Wi-Fi' : raw.type === 'Ethernet' ? 'Ethernet (LAN)' : 'VPN / Inne';
          const linkMbps = Number(raw.linkSpeedMbps) || 0;
          const cls = classifyLinkStandard(linkMbps, type);
          fromApi.push({
            name: raw.name || 'Interfejs',
            description: raw.description || '',
            type,
            status: raw.status === 'Up' ? 'Up' : 'Disconnected',
            linkSpeedMbps: linkMbps,
            maxStandardLabel: cls.standard,
            theoreticalMaxTcpMbps: cls.tcpMax,
            macAddress: raw.macAddress || '',
          });
        }
        if (fromApi.length > 0) break;
      }
    } catch {
      // Running outside Windows .EXE local server -> fall back to Navigator Connection API hint
    }
  }

  if (fromApi.length > 0) {
    return { adapters: fromApi, source: 'Windows .EXE Native NetworkInterface API' };
  }

  const nav = navigator as any;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  if (conn) {
    const typeRaw = String(conn.type || '').toLowerCase();
    const dl = typeof conn.downlink === 'number' ? conn.downlink : 0;
    const type: NetworkAdapterInfo['type'] = typeRaw === 'wifi' ? 'Wi-Fi' : 'Ethernet (LAN)';
    return {
      adapters: [
        {
          name: type === 'Wi-Fi' ? 'Połączenie Wi-Fi (Przeglądarka API)' : 'Połączenie Sieciowe (Przeglądarka API)',
          description: `Profil ${String(conn.effectiveType || '4g').toUpperCase()} · limit raportowany przez przeglądarkę`,
          type,
          status: navigator.onLine ? 'Up' : 'Disconnected',
          linkSpeedMbps: dl > 0 ? dl : 0,
          maxStandardLabel: 'Wklej PowerShell Get-NetAdapter lub uruchom .EXE, aby poznać fizyczny link PHY (1G/2.5G/10G / Wi-Fi 6/7)',
          theoreticalMaxTcpMbps: dl > 0 ? dl : 0,
          macAddress: '',
        },
      ],
      source: 'Browser Network Information API (ograniczone przez sandbox)',
    };
  }

  return { adapters: [], source: 'Brak bezpośredniego dostępu do kart LAN/Wi-Fi w przeglądarce' };
}

export function getCableCapacityComparison(
  adapters: NetworkAdapterInfo[],
  measuredMbps: number
): {
  primaryAdapter: NetworkAdapterInfo | null;
  saturationPct: number;
  bottleneckNote: string;
} {
  const upAdapters = adapters.filter((a) => a.status === 'Up' && a.linkSpeedMbps > 0);
  const primary =
    upAdapters.sort((a, b) => b.linkSpeedMbps - a.linkSpeedMbps)[0] ||
    adapters[0] ||
    null;
  if (!primary || primary.theoreticalMaxTcpMbps <= 0) {
    return {
      primaryAdapter: primary,
      saturationPct: 0,
      bottleneckNote:
        measuredMbps >= 1000
          ? `Zmierzono ${measuredMbps} Mbps (>1 Gbps) — używasz minimum kabla Cat 5e/Cat 6 (2.5G/10G) lub Wi-Fi 6/6E/7.`
          : 'Uruchom w SystemPulse .EXE lub wklej wynik PowerShell Get-NetAdapter, aby obliczyć ile % przepustowości kabla LAN/Wi-Fi wykorzystujesz.',
    };
  }
  const sat = Math.min(100, Math.round((measuredMbps / primary.theoreticalMaxTcpMbps) * 100));
  let note = `Karta „${primary.name}” zestawiła link ${primary.linkSpeedMbps >= 1000 ? `${(primary.linkSpeedMbps / 1000).toFixed(1)} Gbps` : `${primary.linkSpeedMbps} Mbps`} (${primary.maxStandardLabel}) → maks. realny transfer TCP to ok. ${primary.theoreticalMaxTcpMbps} Mbps.`;
  if (primary.type === 'Ethernet (LAN)' && primary.linkSpeedMbps === 100) {
    note += ' ⚠️ Link spadł do 100 Mbps! Sprawdź przewód RJ-45 (uszkodzona para żył / stary kabel Cat 5) lub gniazdo routera.';
  } else if (measuredMbps > 0) {
    note += ` Zmierzony test wykorzystał ${sat}% maksimum fizycznego przewodu/radia.`;
  }
  return { primaryAdapter: primary, saturationPct: sat, bottleneckNote: note };
}

export interface SpeedTestServerDefinition {
  id: string;
  city: string;
  country: string;
  region: 'PL' | 'EU' | 'WORLD';
  provider: string;
  capacityGbps: number;
  distanceKm: number;
  probeUrl: string;
}

export const SPEEDTEST_SERVER_CATALOG: SpeedTestServerDefinition[] = [
  // === POLSKA (16 WĘZŁÓW IXP / ISP / CDN) ===
  {
    id: 'pl-waw-cloudflare',
    city: 'Warszawa',
    country: 'Polska',
    region: 'PL',
    provider: 'Cloudflare Edge WAW (Real Anycast Multi-Stream 400G)',
    capacityGbps: 400,
    distanceKm: 12,
    probeUrl: 'https://speed.cloudflare.com/__down?bytes=0',
  },
  {
    id: 'pl-waw-plix',
    city: 'Warszawa',
    country: 'Polska',
    region: 'PL',
    provider: 'PLIX / Equinix WA1 (Polish Internet Exchange)',
    capacityGbps: 400,
    distanceKm: 12,
    probeUrl: 'https://www.plix.pl/favicon.ico',
  },
  {
    id: 'pl-waw-atman',
    city: 'Warszawa',
    country: 'Polska',
    region: 'PL',
    provider: 'ATMAN Data Center WAW-1 (Thinx IX)',
    capacityGbps: 400,
    distanceKm: 15,
    probeUrl: 'https://www.atman.pl/favicon.ico',
  },
  {
    id: 'pl-waw-orange',
    city: 'Warszawa',
    country: 'Polska',
    region: 'PL',
    provider: 'Orange Polska Światłowód Core (XGS-PON 10G)',
    capacityGbps: 100,
    distanceKm: 18,
    probeUrl: 'https://www.orange.pl/favicon.ico',
  },
  {
    id: 'pl-krk-cyfronet',
    city: 'Kraków',
    country: 'Polska',
    region: 'PL',
    provider: 'ACK Cyfronet AGH / PIONIER 100G',
    capacityGbps: 100,
    distanceKm: 252,
    probeUrl: 'https://www.cyfronet.pl/favicon.ico',
  },
  {
    id: 'pl-ktw-epix',
    city: 'Katowice',
    country: 'Polska',
    region: 'PL',
    provider: 'EPIX Katowice (Silesia Core IXP)',
    capacityGbps: 400,
    distanceKm: 258,
    probeUrl: 'https://www.epix.net.pl/favicon.ico',
  },
  {
    id: 'pl-poz-psnc',
    city: 'Poznań',
    country: 'Polska',
    region: 'PL',
    provider: 'PCSS / PIONIER Poznań (MAN)',
    capacityGbps: 400,
    distanceKm: 278,
    probeUrl: 'https://www.man.poznan.pl/favicon.ico',
  },
  {
    id: 'pl-gda-task',
    city: 'Gdańsk',
    country: 'Polska',
    region: 'PL',
    provider: 'TASK Politechnika Gdańska / GDA-IX',
    capacityGbps: 100,
    distanceKm: 284,
    probeUrl: 'https://task.gda.pl/favicon.ico',
  },
  {
    id: 'pl-wro-wcss',
    city: 'Wrocław',
    country: 'Polska',
    region: 'PL',
    provider: 'WCSS Politechnika Wrocławska / WRIX',
    capacityGbps: 100,
    distanceKm: 304,
    probeUrl: 'https://www.wcss.pl/favicon.ico',
  },
  {
    id: 'pl-ldz-lodman',
    city: 'Łódź',
    country: 'Polska',
    region: 'PL',
    provider: 'LODMAN Łódzka Sieć Miejska',
    capacityGbps: 100,
    distanceKm: 118,
    probeUrl: 'https://www.lodman.pl/favicon.ico',
  },
  {
    id: 'pl-szc-msk',
    city: 'Szczecin',
    country: 'Polska',
    region: 'PL',
    provider: 'Uniwersytet Szczeciński / MSK Szczecin',
    capacityGbps: 100,
    distanceKm: 454,
    probeUrl: 'https://usz.edu.pl/favicon.ico',
  },
  {
    id: 'pl-lub-lubman',
    city: 'Lublin',
    country: 'Polska',
    region: 'PL',
    provider: 'LUBMAN UMCS Wschodni Węzeł Światłowodowy',
    capacityGbps: 100,
    distanceKm: 154,
    probeUrl: 'https://www.umcs.pl/favicon.ico',
  },
  {
    id: 'pl-bia-biaman',
    city: 'Białystok',
    country: 'Polska',
    region: 'PL',
    provider: 'BIAMAN Politechnika Białostocka IXP',
    capacityGbps: 40,
    distanceKm: 176,
    probeUrl: 'https://pb.edu.pl/favicon.ico',
  },
  {
    id: 'pl-rze-rzman',
    city: 'Rzeszów',
    country: 'Polska',
    region: 'PL',
    provider: 'RzMAN Politechnika Rzeszowska Core',
    capacityGbps: 40,
    distanceKm: 295,
    probeUrl: 'https://w.prz.edu.pl/favicon.ico',
  },
  {
    id: 'pl-byd-byman',
    city: 'Bydgoszcz / Toruń',
    country: 'Polska',
    region: 'PL',
    provider: 'BYMAN / UMK Toruń IXP',
    capacityGbps: 40,
    distanceKm: 225,
    probeUrl: 'https://www.umk.pl/favicon.ico',
  },
  {
    id: 'pl-ols-olman',
    city: 'Olsztyn',
    country: 'Polska',
    region: 'PL',
    provider: 'OLMAN UWM Olsztyn Core',
    capacityGbps: 40,
    distanceKm: 175,
    probeUrl: 'https://uwm.edu.pl/favicon.ico',
  },

  // === EUROPA I ŚWIAT (16 WĘZŁÓW GLOBALNYCH TIER-1) ===
  {
    id: 'eu-fra-decix',
    city: 'Frankfurt',
    country: 'Niemcy',
    region: 'EU',
    provider: 'DE-CIX Frankfurt (World #1 IXP Core)',
    capacityGbps: 400,
    distanceKm: 890,
    probeUrl: 'https://www.de-cix.net/favicon.ico',
  },
  {
    id: 'eu-ams-amsix',
    city: 'Amsterdam',
    country: 'Holandia',
    region: 'EU',
    provider: 'AMS-IX Amsterdam Core',
    capacityGbps: 400,
    distanceKm: 1095,
    probeUrl: 'https://www.ams-ix.net/favicon.ico',
  },
  {
    id: 'eu-prg-nixcz',
    city: 'Praga',
    country: 'Czechy',
    region: 'EU',
    provider: 'NIX.CZ Prague IX',
    capacityGbps: 200,
    distanceKm: 518,
    probeUrl: 'https://www.nix.cz/favicon.ico',
  },
  {
    id: 'eu-vie-vix',
    city: 'Wiedeń',
    country: 'Austria',
    region: 'EU',
    provider: 'VIX Vienna Internet Exchange',
    capacityGbps: 200,
    distanceKm: 556,
    probeUrl: 'https://www.vix.at/favicon.ico',
  },
  {
    id: 'eu-sto-netnod',
    city: 'Sztokholm',
    country: 'Szwecja',
    region: 'EU',
    provider: 'Netnod Stockholm IX',
    capacityGbps: 200,
    distanceKm: 810,
    probeUrl: 'https://www.netnod.se/favicon.ico',
  },
  {
    id: 'eu-lon-linx',
    city: 'Londyn',
    country: 'Wielka Brytania',
    region: 'EU',
    provider: 'LINX London IX',
    capacityGbps: 400,
    distanceKm: 1450,
    probeUrl: 'https://www.linx.net/favicon.ico',
  },
  {
    id: 'eu-par-franceix',
    city: 'Paryż',
    country: 'Francja',
    region: 'EU',
    provider: 'France-IX Paris',
    capacityGbps: 400,
    distanceKm: 1365,
    probeUrl: 'https://www.franceix.net/favicon.ico',
  },
  {
    id: 'eu-zrh-swissix',
    city: 'Zurych',
    country: 'Szwajcaria',
    region: 'EU',
    provider: 'SwissIX Zurich',
    capacityGbps: 200,
    distanceKm: 1040,
    probeUrl: 'https://www.swissix.ch/favicon.ico',
  },
  {
    id: 'eu-mad-espanix',
    city: 'Madryt',
    country: 'Hiszpania',
    region: 'EU',
    provider: 'ESPANIX Madrid Core Node',
    capacityGbps: 200,
    distanceKm: 2290,
    probeUrl: 'https://www.espanix.net/favicon.ico',
  },
  {
    id: 'us-nyc-equinix',
    city: 'Nowy Jork / Ashburn',
    country: 'USA (Wschód)',
    region: 'WORLD',
    provider: 'Equinix US-East / Fastly Anycast',
    capacityGbps: 400,
    distanceKm: 6850,
    probeUrl: 'https://www.fastly.com/favicon.ico',
  },
  {
    id: 'us-chi-coresite',
    city: 'Chicago',
    country: 'USA (Centrum)',
    region: 'WORLD',
    provider: 'CoreSite US-Central / Cloudflare',
    capacityGbps: 200,
    distanceKm: 7520,
    probeUrl: 'https://www.cloudflare.com/favicon.ico',
  },
  {
    id: 'us-lax-wilshire',
    city: 'Los Angeles',
    country: 'USA (Zachód)',
    region: 'WORLD',
    provider: 'Pacific Gateway LAX (Akamai / Edge)',
    capacityGbps: 400,
    distanceKm: 9620,
    probeUrl: 'https://www.akamai.com/favicon.ico',
  },
  {
    id: 'sa-gru-ixbr',
    city: 'São Paulo',
    country: 'Brazylia',
    region: 'WORLD',
    provider: 'IX.br NIC.br São Paulo',
    capacityGbps: 200,
    distanceKm: 10340,
    probeUrl: 'https://ix.br/favicon.ico',
  },
  {
    id: 'as-tyo-jpnap',
    city: 'Tokio',
    country: 'Japonia',
    region: 'WORLD',
    provider: 'JPNAP / WIDE Project Tokyo',
    capacityGbps: 400,
    distanceKm: 8580,
    probeUrl: 'https://www.wide.ad.jp/favicon.ico',
  },
  {
    id: 'as-sin-sgix',
    city: 'Singapur',
    country: 'Singapur',
    region: 'WORLD',
    provider: 'SGIX Singapore Internet Exchange',
    capacityGbps: 400,
    distanceKm: 9410,
    probeUrl: 'https://www.sgix.sg/favicon.ico',
  },
  {
    id: 'oc-syd-ix',
    city: 'Sydney',
    country: 'Australia',
    region: 'WORLD',
    provider: 'IX Australia Sydney',
    capacityGbps: 100,
    distanceKm: 15600,
    probeUrl: 'https://www.internet.asn.au/favicon.ico',
  },
];

export class NetworkTestService {
  private running = false;
  private abortRequested = false;
  private activeStreams = 8;
  private selectedServerId = 'pl-waw-cloudflare';
  private transferDirection: NetworkTransferDirection = 'both';
  // 0 = Auto (Multi-Stream Real HTTP), kept for API compatibility with UI selectors
  private linkProfileGbps = 0;
  private cachedServerProbes: SpeedTestServerProbe[] = [];
  private activeControllers = new Set<AbortController>();
  private activeXhrs = new Set<XMLHttpRequest>();

  public isRunning(): boolean {
    return this.running;
  }

  public getTransferDirection(): NetworkTransferDirection {
    return this.transferDirection;
  }

  public setTransferDirection(direction: NetworkTransferDirection): void {
    this.transferDirection = direction;
  }

  public getActiveStreams(): number {
    return this.activeStreams;
  }

  public setActiveStreams(streams: number): void {
    this.activeStreams = Math.max(4, Math.min(16, Math.round(streams)));
  }

  public getSelectedServerId(): string {
    return this.selectedServerId;
  }

  public getSelectedServer(): SpeedTestServerDefinition {
    return (
      SPEEDTEST_SERVER_CATALOG.find((s) => s.id === this.selectedServerId) ||
      SPEEDTEST_SERVER_CATALOG[0]
    );
  }

  public setSelectedServerId(serverId: string): void {
    if (SPEEDTEST_SERVER_CATALOG.some((s) => s.id === serverId)) {
      this.selectedServerId = serverId;
    }
  }

  public getLinkProfileGbps(): number {
    return this.linkProfileGbps;
  }

  public setLinkProfileGbps(gbps: number): void {
    this.linkProfileGbps = gbps;
    if (gbps >= 10) this.activeStreams = 12;
    else if (gbps >= 2.5) this.activeStreams = 10;
    else this.activeStreams = 8;
  }

  public getCachedServerProbes(): SpeedTestServerProbe[] {
    if (this.cachedServerProbes.length === 0) {
      this.cachedServerProbes = SPEEDTEST_SERVER_CATALOG.map((srv) => ({
        id: srv.id,
        city: srv.city,
        country: srv.country,
        region: srv.region,
        provider: srv.provider,
        capacityGbps: srv.capacityGbps,
        distanceKm: srv.distanceKm,
        pingMs: 0,
        jitterMs: 0,
        status: 'PROBING',
      }));
    }
    return this.cachedServerProbes;
  }

  public stopTest(): void {
    this.abortRequested = true;
    for (const ctrl of this.activeControllers) {
      try {
        ctrl.abort();
      } catch {
        // Ignore abort errors
      }
    }
    this.activeControllers.clear();
    for (const xhr of this.activeXhrs) {
      try {
        xhr.abort();
      } catch {
        // Ignore xhr abort errors
      }
    }
    this.activeXhrs.clear();
  }

  public createInitialState(): NetworkTestResult {
    const nav = navigator as unknown as {
      connection?: { downlink?: number; effectiveType?: string; rtt?: number; type?: string };
      mozConnection?: { downlink?: number; effectiveType?: string; rtt?: number; type?: string };
      webkitConnection?: { downlink?: number; effectiveType?: string; rtt?: number; type?: string };
    };
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    const rawDownlink = typeof conn?.downlink === 'number' && conn.downlink > 0 ? conn.downlink : null;
    const connType = conn?.type ? String(conn.type).toUpperCase() : '';
    const effType = conn?.effectiveType ? String(conn.effectiveType).toUpperCase() : '';
    const effectiveType = !navigator.onLine
      ? 'Offline'
      : connType
        ? `${connType}${effType ? ` (${effType})` : ''}`
        : 'Real HTTP/3 Multi-Stream (Cloudflare Edge)';
    const srv = this.getSelectedServer();

    return {
      status: 'idle',
      progress: 0,
      online: navigator.onLine,
      effectiveType,
      downlinkMbps: rawDownlink,
      nativeRttMs: typeof conn?.rtt === 'number' && conn.rtt > 0 ? conn.rtt : null,
      pingMinMs: 0,
      pingAvgMs: 0,
      pingMaxMs: 0,
      jitterMs: 0,
      bufferbloatMs: 0,
      dnsLookupMs: 0,
      voipMosScore: 0,
      cdnEdgeMs: 0,
      activeStreams: this.activeStreams,
      selectedServerId: srv.id,
      selectedServerName: `${srv.city} (${srv.country}) — ${srv.provider}`,
      linkProfileGbps: this.linkProfileGbps,
      serverScanResults: this.getCachedServerProbes(),
      packetLossPct: 0,
      downloadEstMbps: 0,
      peakDownloadMbps: 0,
      uploadEstMbps: 0,
      peakUploadMbps: 0,
      transferredMB: 0,
      continuousMode: false,
      transferDirection: this.transferDirection,
      targetSamples: 24,
      samples: [],
      speedSamples: [],
      qualityGrade: navigator.onLine ? 'DOBRA' : 'OFFLINE',
    };
  }

  /**
   * Probes local LAN/Wi-Fi adapters, executes same-origin gateway RTT bursts,
   * checks local bridge loopback throughput if available, and evaluates RJ-45 / Wi-Fi link saturation.
   */
  public async runLanLocalProbe(currentResult?: NetworkTestResult): Promise<{
    adapters: NetworkAdapterInfo[];
    adapterSource: string;
    lanGatewayRttMs: number;
    lanLoopbackMbps: number;
    lanCableCategoryHint: string;
    lanStatusNote: string;
  }> {
    const adapterProbe = await probeLocalNetworkAdapters();
    const rttSamples: number[] = [];
    for (let i = 0; i < 5; i++) {
      const p = await this.measureSingleHttpPing(`${window.location.origin}/?lan_probe=${i}`, 1200);
      if (p.ok) rttSamples.push(p.latencyMs);
    }
    const lanGatewayRttMs =
      rttSamples.length > 0
        ? Number((rttSamples.reduce((a, b) => a + b, 0) / rttSamples.length).toFixed(2))
        : 0;

    let lanLoopbackMbps = 0;
    if (isHostedOnExeBridge()) {
      const ctrl = new AbortController();
      const timer = window.setTimeout(() => ctrl.abort(), 1600);
      try {
        const t0 = performance.now();
        const resp = await fetch(
          `${window.location.origin}/api/speedtest/download?bytes=${8 * 1024 * 1024}&_lan=${Date.now()}`,
          { cache: 'no-store', signal: ctrl.signal }
        );
        if (resp.ok) {
          const buf = await resp.arrayBuffer();
          const sec = Math.max(0.002, (performance.now() - t0) / 1000);
          lanLoopbackMbps = Number((((buf.byteLength * 8) / 1_000_000) / sec).toFixed(1));
        }
      } catch {
        // Same-origin local bridge endpoint optional outside .EXE wrapper
      } finally {
        window.clearTimeout(timer);
      }
    }

    const measuredPeak = Math.max(
      currentResult?.downloadEstMbps || 0,
      currentResult?.uploadEstMbps || 0,
      lanLoopbackMbps
    );
    const cmp = getCableCapacityComparison(adapterProbe.adapters, measuredPeak);
    const primary = cmp.primaryAdapter;
    const lanCableCategoryHint = primary
      ? primary.maxStandardLabel
      : measuredPeak >= 1000
        ? 'Cat 6 / Cat 6a lub Wi-Fi 6E/7 (>1 Gbps)'
        : navigator.onLine
          ? 'Ethernet 1G (Cat 5e/6) lub Wi-Fi 5/6'
          : 'Brak aktywnego połączenia';

    return {
      adapters: adapterProbe.adapters,
      adapterSource: adapterProbe.source,
      lanGatewayRttMs,
      lanLoopbackMbps,
      lanCableCategoryHint,
      lanStatusNote: cmp.bottleneckNote,
    };
  }

  private async measureSingleHttpPing(url: string, timeoutMs = 2400): Promise<{ ok: boolean; latencyMs: number }> {
    const ctrl = new AbortController();
    this.activeControllers.add(ctrl);
    const timer = window.setTimeout(() => ctrl.abort(), timeoutMs);
    const sep = url.includes('?') ? '&' : '?';
    const bustUrl = `${url}${sep}_pt=${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    try {
      const t0 = performance.now();
      await fetch(bustUrl, {
        method: 'GET',
        mode: url.startsWith(window.location.origin) ? 'same-origin' : 'no-cors',
        cache: 'no-store',
        signal: ctrl.signal,
      });
      const rtt = performance.now() - t0;
      return { ok: true, latencyMs: Number(Math.max(0.2, rtt).toFixed(1)) };
    } catch {
      return { ok: false, latencyMs: 0 };
    } finally {
      window.clearTimeout(timer);
      this.activeControllers.delete(ctrl);
    }
  }

  /**
   * Probes all 32 Polish & Global servers with REAL HTTP requests concurrently.
   * Any unreachable server is marked 'TIMEOUT' cleanly without fabricated latency numbers.
   */
  public async scanAllServers(
    onUpdate?: (probes: SpeedTestServerProbe[]) => void
  ): Promise<SpeedTestServerProbe[]> {
    const results: SpeedTestServerProbe[] = this.getCachedServerProbes().map((p) => ({
      ...p,
      status: 'PROBING',
    }));
    this.cachedServerProbes = results;
    onUpdate?.([...results]);

    const batchSize = 8;
    for (let i = 0; i < SPEEDTEST_SERVER_CATALOG.length; i += batchSize) {
      const batch = SPEEDTEST_SERVER_CATALOG.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (srv, offset) => {
          const idx = i + offset;
          // Probe twice: first establishes TCP/TLS socket, second measures clean warm HTTP RTT
          const p1 = await this.measureSingleHttpPing(srv.probeUrl, 2200);
          if (!p1.ok) {
            results[idx] = {
              id: srv.id,
              city: srv.city,
              country: srv.country,
              region: srv.region,
              provider: srv.provider,
              capacityGbps: srv.capacityGbps,
              distanceKm: srv.distanceKm,
              pingMs: 0,
              jitterMs: 0,
              status: 'TIMEOUT',
            };
            return;
          }

          const p2 = await this.measureSingleHttpPing(srv.probeUrl, 2200);
          const p3 = await this.measureSingleHttpPing(srv.probeUrl, 2200);
          const warmSamples = [p2.ok ? p2.latencyMs : p1.latencyMs, p3.ok ? p3.latencyMs : p1.latencyMs];
          const avgPing = warmSamples.reduce((a, b) => a + b, 0) / warmSamples.length;
          const jitter = Math.abs(warmSamples[0] - (warmSamples[1] ?? warmSamples[0]));

          results[idx] = {
            id: srv.id,
            city: srv.city,
            country: srv.country,
            region: srv.region,
            provider: srv.provider,
            capacityGbps: srv.capacityGbps,
            distanceKm: srv.distanceKm,
            pingMs: Number(avgPing.toFixed(1)),
            jitterMs: Number(jitter.toFixed(1)),
            status: 'ONLINE',
          };
        })
      );
      this.cachedServerProbes = [...results];
      onUpdate?.([...results]);
    }

    return [...results];
  }

  private getDownloadStreamUrl(bytes: number, burstIndex: number, streamIdx: number): string {
    return `https://speed.cloudflare.com/__down?bytes=${bytes}&_r=${Date.now()}_${burstIndex}_${streamIdx}`;
  }

  private getUploadEndpointUrl(burstIndex: number, streamIdx: number): string {
    return `https://speed.cloudflare.com/__up?_r=${Date.now()}_${burstIndex}_${streamIdx}`;
  }

  private fillHighEntropyUploadPayload(buf: Uint8Array, seed: number): void {
    let state = (seed ^ 0x9e3779b9) >>> 0;
    if (state === 0) state = 0x6d2b79f5;
    const len32 = buf.byteLength >>> 2;
    const view32 = new Uint32Array(buf.buffer, buf.byteOffset, len32);
    for (let i = 0; i < len32; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      view32[i] = state >>> 0;
    }
    for (let i = len32 << 2; i < buf.byteLength; i++) {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      buf[i] = state & 0xff;
    }
  }

  /**
   * Detects transparent HTTP compression (e.g. proxy/ISP gzip/br on Cloudflare's zero-filled __down)
   * using PerformanceResourceTiming. Returns a wire-to-decoded correction factor in (0, 1].
   */
  private detectCompressionCorrectionFactor(urls: string[]): number {
    if (typeof performance === 'undefined' || typeof performance.getEntriesByName !== 'function') {
      return 1;
    }
    let totalEncoded = 0;
    let totalDecoded = 0;
    for (const url of urls) {
      const entries = performance.getEntriesByName(url) as PerformanceResourceTiming[];
      for (const e of entries) {
        if (
          typeof e.encodedBodySize === 'number' &&
          typeof e.decodedBodySize === 'number' &&
          e.encodedBodySize > 0 &&
          e.decodedBodySize > 0
        ) {
          totalEncoded += e.encodedBodySize;
          totalDecoded += e.decodedBodySize;
        }
      }
    }
    if (totalEncoded > 0 && totalDecoded > totalEncoded * 1.2) {
      return Math.max(0.01, Math.min(1, totalEncoded / totalDecoded));
    }
    return 1;
  }

  /**
   * Sustained multi-second multi-stream HTTP Download test (Ookla / M-Lab NDT7 steady-state method):
   * - Streams 25 MB payloads continuously across parallel workers for `durationMs` (5.5s standard).
   * - Completely discards the first `warmupMs` (1.5s) to exclude TCP Slow-Start, TLS handshakes,
   *   and local antivirus proxy (e.g. Bitdefender Encrypted Web Scan) initial buffer flushes.
   * - Measures strictly `deltaBytes / deltaSec` inside the sustained steady-state window with ZERO
   *   artificial time multipliers (`0.8`) and ZERO RTT subtraction tricks.
   */
  private async runSustainedDownload(options: {
    durationMs: number;
    warmupMs: number;
    streams: number;
    probeUrl: string;
    onTick: (liveMbps: number, totalBytes: number, windowMbps: number | null) => void;
    onLoadedPing: (latencyMs: number) => void;
  }): Promise<{
    sustainedMbps: number;
    peakMbps: number;
    totalBytes: number;
    windowSamples: number[];
    sourceLabel: string;
  }> {
    const { durationMs, warmupMs, streams, probeUrl, onTick, onLoadedPing } = options;
    const workerCount = Math.max(3, Math.min(6, streams));
    const chunkBytes = 25_000_000;
    const isLocalOrigin =
      typeof window !== 'undefined' &&
      (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');

    const runWorkers = async (useLocalFallback: boolean) => {
      const tStart = performance.now();
      let totalDownBytes = 0;
      let verifiedColo = '';
      let seqCounter = 0;
      const requestedUrls: string[] = [];
      const timeline: ThroughputTimelinePoint[] = [{ elapsedMs: 0, totalBytes: 0 }];
      const windowSamples: number[] = [];
      const activeCtrls = new Set<AbortController>();
      let stopped = false;

      const abortAll = () => {
        stopped = true;
        for (const c of activeCtrls) {
          try {
            c.abort();
          } catch {
            // ignore
          }
        }
        activeCtrls.clear();
      };

      const stopTimer = window.setTimeout(abortAll, durationMs);
      let lastWindowPushMs = warmupMs;

      const ticker = window.setInterval(() => {
        if (this.abortRequested) {
          abortAll();
          return;
        }
        const elapsedMs = performance.now() - tStart;
        timeline.push({ elapsedMs, totalBytes: totalDownBytes });
        if (elapsedMs >= warmupMs + 450 && totalDownBytes > 0) {
          const stats = computeSteadyStateThroughput(timeline, warmupMs);
          let pushedWin: number | null = null;
          if (elapsedMs - lastWindowPushMs >= 500 && stats.latestWindowMbps > 0) {
            lastWindowPushMs = elapsedMs;
            pushedWin = stats.latestWindowMbps;
            windowSamples.push(pushedWin);
          }
          onTick(stats.sustainedMbps, totalDownBytes, pushedWin);
        }
      }, 250);

      // Periodic loaded ping during heavy download to measure true Bufferbloat
      const pingTicker = window.setInterval(() => {
        if (stopped || this.abortRequested) return;
        void this.measureSingleHttpPing(probeUrl, 1800).then((p) => {
          if (p.ok && p.latencyMs > 0) onLoadedPing(p.latencyMs);
        });
      }, 900);

      const workerLoop = async (workerIdx: number) => {
        while (!stopped && !this.abortRequested && performance.now() - tStart < durationMs - 80) {
          const reqId = ++seqCounter;
          const ctrl = new AbortController();
          activeCtrls.add(ctrl);
          this.activeControllers.add(ctrl);
          const url = useLocalFallback
            ? `${window.location.origin}/api/speedtest/download?bytes=${8 * 1024 * 1024}&_r=${Date.now()}_${reqId}_${workerIdx}`
            : this.getDownloadStreamUrl(chunkBytes, reqId, workerIdx);
          requestedUrls.push(url);

          try {
            const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
            if (!res.ok) {
              await new Promise((r) => setTimeout(r, 120));
              continue;
            }
            if (!verifiedColo && !useLocalFallback) {
              const colo = res.headers.get('cf-meta-colo') || '';
              const city = res.headers.get('cf-meta-city') || '';
              if (colo) verifiedColo = city ? `${colo} · ${city}` : colo;
            }
            if (res.body && typeof res.body.getReader === 'function') {
              const reader = res.body.getReader();
              while (!stopped && !this.abortRequested) {
                const { done, value } = await reader.read();
                if (done) break;
                totalDownBytes += value.byteLength;
                if (performance.now() - tStart >= durationMs) {
                  try {
                    await reader.cancel();
                  } catch {
                    // ignore
                  }
                  break;
                }
              }
            } else {
              const buf = await res.arrayBuffer();
              totalDownBytes += buf.byteLength;
            }
          } catch {
            // Aborted at end of window or transient network error
            if (stopped || this.abortRequested) break;
            await new Promise((r) => setTimeout(r, 120));
          } finally {
            activeCtrls.delete(ctrl);
            this.activeControllers.delete(ctrl);
          }
        }
      };

      try {
        await Promise.all(Array.from({ length: workerCount }, (_, idx) => workerLoop(idx)));
      } finally {
        window.clearTimeout(stopTimer);
        window.clearInterval(ticker);
        window.clearInterval(pingTicker);
        abortAll();
      }

      const finalElapsedMs = performance.now() - tStart;
      timeline.push({ elapsedMs: finalElapsedMs, totalBytes: totalDownBytes });

      const compressionFactor = useLocalFallback ? 1 : this.detectCompressionCorrectionFactor(requestedUrls);
      const correctedTimeline =
        compressionFactor < 1
          ? timeline.map((p) => ({ elapsedMs: p.elapsedMs, totalBytes: Math.round(p.totalBytes * compressionFactor) }))
          : timeline;
      const correctedBytes = Math.round(totalDownBytes * compressionFactor);
      const stats = computeSteadyStateThroughput(correctedTimeline, warmupMs);
      const correctedWindows =
        compressionFactor < 1
          ? windowSamples.map((v) => Number((v * compressionFactor).toFixed(1)))
          : windowSamples;

      return {
        sustainedMbps: stats.sustainedMbps,
        peakMbps: stats.peakMbps,
        totalBytes: correctedBytes,
        windowSamples: correctedWindows.length > 0 ? correctedWindows : stats.sustainedMbps > 0 ? [stats.sustainedMbps] : [],
        sourceLabel: useLocalFallback
          ? 'Localhost Bridge (.EXE) — Pętla lokalna (Tryb Offline)'
          : verifiedColo
            ? `Cloudflare Edge [${verifiedColo}] (Real HTTPS Steady-State)`
            : 'Cloudflare Edge Multi-Stream (Real HTTPS Steady-State)',
      };
    };

    const primary = await runWorkers(false);
    if (primary.totalBytes === 0 && !this.abortRequested && isLocalOrigin) {
      return runWorkers(true);
    }
    return primary;
  }

  /**
   * Sustained multi-second multi-stream HTTP Upload test:
   * - Sends high-entropy incompressible Xorshift32 payloads back-to-back across parallel workers.
   * - Counts bytes ONLY upon confirmed HTTP 200 OK from the remote server (`res.ok`), preventing
   *   local OS TCP send buffer (`SO_SNDBUF`) or AV proxy buffers from faking upload speed.
   * - Discards the first `warmupMs` (1.5s) so buffers are 100% saturated before steady-state measurement.
   */
  private async runSustainedUpload(options: {
    durationMs: number;
    warmupMs: number;
    streams: number;
    probeUrl: string;
    preferLocalFallback: boolean;
    onTick: (liveMbps: number, totalBytes: number, windowMbps: number | null) => void;
    onLoadedPing: (latencyMs: number) => void;
  }): Promise<{
    sustainedMbps: number;
    peakMbps: number;
    totalBytes: number;
    windowSamples: number[];
    sourceLabel: string;
  }> {
    const { durationMs, warmupMs, streams, probeUrl, preferLocalFallback, onTick, onLoadedPing } = options;
    const workerCount = Math.max(2, Math.min(4, Math.round(streams / 2)));
    const isLocalOrigin =
      typeof window !== 'undefined' &&
      (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost');

    // Pre-generate 4 MB of incompressible Xorshift32 pseudo-random bytes once
    const masterPool = new Uint8Array(4 * 1024 * 1024);
    this.fillHighEntropyUploadPayload(masterPool, Date.now() ^ 0x517cc1b7);

    const runWorkers = async (useLocalFallback: boolean) => {
      const tStart = performance.now();
      let confirmedUpBytes = 0;
      let seqCounter = 0;
      let adaptiveChunkSize = 512 * 1024; // Starts at 512 KB, adapts smoothly up to 4 MB
      const timeline: ThroughputTimelinePoint[] = [{ elapsedMs: 0, totalBytes: 0 }];
      const windowSamples: number[] = [];
      const activeCtrls = new Set<AbortController>();
      let stopped = false;

      const abortAll = () => {
        stopped = true;
        for (const c of activeCtrls) {
          try {
            c.abort();
          } catch {
            // ignore
          }
        }
        activeCtrls.clear();
      };

      const stopTimer = window.setTimeout(abortAll, durationMs + 300);
      let lastWindowPushMs = warmupMs;

      const ticker = window.setInterval(() => {
        if (this.abortRequested) {
          abortAll();
          return;
        }
        const elapsedMs = performance.now() - tStart;
        timeline.push({ elapsedMs, totalBytes: confirmedUpBytes });
        if (elapsedMs >= warmupMs + 500 && confirmedUpBytes > 0) {
          const stats = computeSteadyStateThroughput(timeline, warmupMs);
          let pushedWin: number | null = null;
          if (elapsedMs - lastWindowPushMs >= 500 && stats.latestWindowMbps > 0) {
            lastWindowPushMs = elapsedMs;
            pushedWin = stats.latestWindowMbps;
            windowSamples.push(pushedWin);
          }
          onTick(stats.sustainedMbps, confirmedUpBytes, pushedWin);
        }
      }, 250);

      const pingTicker = window.setInterval(() => {
        if (stopped || this.abortRequested) return;
        void this.measureSingleHttpPing(probeUrl, 1800).then((p) => {
          if (p.ok && p.latencyMs > 0) onLoadedPing(p.latencyMs);
        });
      }, 950);

      const workerLoop = async (workerIdx: number) => {
        while (!stopped && !this.abortRequested && performance.now() - tStart < durationMs) {
          const reqId = ++seqCounter;
          const sz = adaptiveChunkSize;
          const maxOffset = Math.max(0, masterPool.byteLength - sz);
          const offset = maxOffset > 0 ? ((reqId * 65521 + workerIdx * 4093) % maxOffset) : 0;
          const payload = masterPool.subarray(offset, offset + sz);

          const ctrl = new AbortController();
          activeCtrls.add(ctrl);
          this.activeControllers.add(ctrl);
          const url = useLocalFallback
            ? `${window.location.origin}/api/speedtest/upload?_r=${Date.now()}_${reqId}_${workerIdx}`
            : this.getUploadEndpointUrl(reqId, workerIdx);

          const chunkT0 = performance.now();
          try {
            const res = await fetch(url, {
              method: 'POST',
              body: payload,
              cache: 'no-store',
              signal: ctrl.signal,
            });
            if (!res.ok) {
              await new Promise((r) => setTimeout(r, 120));
              continue;
            }
            const chunkMs = Math.max(1, performance.now() - chunkT0);
            confirmedUpBytes += sz;
            timeline.push({ elapsedMs: performance.now() - tStart, totalBytes: confirmedUpBytes });

            // Adapt chunk size so each POST takes ~300-650ms (smooth steady-state saturation without huge tail latency)
            if (chunkMs < 180 && adaptiveChunkSize < 4 * 1024 * 1024) {
              adaptiveChunkSize = Math.min(4 * 1024 * 1024, adaptiveChunkSize * 2);
            } else if (chunkMs > 1200 && adaptiveChunkSize > 256 * 1024) {
              adaptiveChunkSize = Math.max(256 * 1024, Math.round(adaptiveChunkSize / 2));
            }
          } catch {
            if (stopped || this.abortRequested) break;
            await new Promise((r) => setTimeout(r, 120));
          } finally {
            activeCtrls.delete(ctrl);
            this.activeControllers.delete(ctrl);
          }
        }
      };

      try {
        await Promise.all(Array.from({ length: workerCount }, (_, idx) => workerLoop(idx)));
      } finally {
        window.clearTimeout(stopTimer);
        window.clearInterval(ticker);
        window.clearInterval(pingTicker);
        abortAll();
      }

      const finalElapsedMs = performance.now() - tStart;
      timeline.push({ elapsedMs: finalElapsedMs, totalBytes: confirmedUpBytes });
      const stats = computeSteadyStateThroughput(timeline, warmupMs);
      return {
        sustainedMbps: stats.sustainedMbps,
        peakMbps: stats.peakMbps,
        totalBytes: confirmedUpBytes,
        windowSamples: windowSamples.length > 0 ? windowSamples : stats.sustainedMbps > 0 ? [stats.sustainedMbps] : [],
        sourceLabel: useLocalFallback
          ? 'Localhost Bridge (.EXE) — Pętla lokalna (Tryb Offline)'
          : 'Cloudflare Edge Multi-Stream (Real HTTPS Steady-State)',
      };
    };

    const primary = await runWorkers(preferLocalFallback);
    if (primary.totalBytes === 0 && !preferLocalFallback && isLocalOrigin && !this.abortRequested) {
      return runWorkers(true);
    }
    return primary;
  }

  public async runTest(
    onProgress: (res: NetworkTestResult) => void,
    options?: {
      continuous?: boolean;
      sampleCount?: number;
      streams?: number;
      serverId?: string;
      linkProfileGbps?: number;
      direction?: NetworkTransferDirection;
    }
  ): Promise<NetworkTestResult> {
    if (this.running) {
      this.stopTest();
      await new Promise((r) => setTimeout(r, 120));
    }
    this.running = true;
    this.abortRequested = false;

    if (typeof options?.serverId === 'string') {
      this.setSelectedServerId(options.serverId);
    }
    if (typeof options?.linkProfileGbps === 'number') {
      this.setLinkProfileGbps(options.linkProfileGbps);
    }
    if (typeof options?.streams === 'number') {
      this.setActiveStreams(options.streams);
    }
    if (options?.direction) {
      this.setTransferDirection(options.direction);
    }

    const direction = this.transferDirection;
    const srv = this.getSelectedServer();
    const continuous = Boolean(options?.continuous);
    const pingProbeCount = continuous ? 6 : Math.max(8, Math.min(16, options?.sampleCount ?? 12));

    const result = this.createInitialState();
    result.status = 'running';
    result.continuousMode = continuous;
    result.transferDirection = direction;
    result.targetSamples = continuous ? 0 : pingProbeCount;
    result.activeStreams = this.activeStreams;
    result.selectedServerId = srv.id;
    result.selectedServerName = `${srv.city} (${srv.country}) — ${srv.provider}`;
    result.linkProfileGbps = this.linkProfileGbps;
    result.progress = 3;

    onProgress({ ...result });

    const samples: NetworkPingSample[] = [];
    const speedSamples: NetworkSpeedSample[] = [];
    const loadedPings: number[] = [];
    let totalPingAttempts = 0;
    let failedPings = 0;
    let totalBytesTransferred = 0;

    const recomputePingStats = () => {
      const validLats = samples.filter((s) => s.ok && s.latencyMs > 0).map((s) => s.latencyMs);
      if (validLats.length > 0) {
        result.pingMinMs = Number(Math.min(...validLats).toFixed(1));
        result.pingMaxMs = Number(Math.max(...validLats).toFixed(1));
        const sorted = [...validLats].sort((a, b) => a - b);
        // Drop single highest outlier when >= 6 warm probes (prevents one GC pause from skewing ping)
        const trimmed = sorted.length >= 6 ? sorted.slice(0, -1) : sorted;
        result.pingAvgMs = Number((trimmed.reduce((a, b) => a + b, 0) / trimmed.length).toFixed(1));

        if (validLats.length > 1) {
          let diffSum = 0;
          for (let j = 1; j < validLats.length; j++) {
            diffSum += Math.abs(validLats[j] - validLats[j - 1]);
          }
          result.jitterMs = Number((diffSum / (validLats.length - 1)).toFixed(1));
        }

        const effectiveLatency = result.pingAvgMs + result.jitterMs * 2 + 10;
        const rFactor = Math.max(
          10,
          Math.min(
            93.2,
            93.2 -
              (effectiveLatency > 160
                ? (effectiveLatency - 120) * 0.25
                : effectiveLatency * 0.08) -
              result.packetLossPct * 2.5
          )
        );
        const mos = 1 + 0.035 * rFactor + rFactor * (rFactor - 60) * (100 - rFactor) * 7e-6;
        result.voipMosScore = Number(Math.max(1.0, Math.min(4.5, mos)).toFixed(2));
        result.cdnEdgeMs = result.pingMinMs;
      }
      result.packetLossPct =
        totalPingAttempts > 0 ? Number(((failedPings / totalPingAttempts) * 100).toFixed(1)) : 0;

      if (loadedPings.length > 0 && result.pingMinMs > 0) {
        const avgLoaded = loadedPings.reduce((a, b) => a + b, 0) / loadedPings.length;
        result.bufferbloatMs = Number(Math.max(0, avgLoaded - result.pingMinMs).toFixed(1));
      } else if (result.pingMaxMs > 0 && result.pingMinMs > 0) {
        result.bufferbloatMs = Number(Math.max(0, result.pingMaxMs - result.pingMinMs).toFixed(1));
      }

      if (!navigator.onLine || result.packetLossPct >= 50) {
        result.qualityGrade = 'OFFLINE';
      } else if (result.packetLossPct > 5 || result.jitterMs > 25 || result.pingAvgMs > 180) {
        result.qualityGrade = 'NIESTABILNA';
      } else if (result.pingAvgMs <= 65 && result.jitterMs <= 12) {
        result.qualityGrade = 'WZOROWA';
      } else {
        result.qualityGrade = 'DOBRA';
      }
      result.samples = [...samples];
      result.speedSamples = [...speedSamples];
    };

    // 1. Measure genuine cold DNS + TCP + TLS handshake RTT before warm idle pings
    const coldPing = await this.measureSingleHttpPing(srv.probeUrl, 2500);
    const warmupPing = await this.measureSingleHttpPing(srv.probeUrl, 2500);
    if (coldPing.ok && warmupPing.ok) {
      result.dnsLookupMs = Number(Math.max(0.2, coldPing.latencyMs - warmupPing.latencyMs).toFixed(1));
    } else if (coldPing.ok) {
      result.dnsLookupMs = coldPing.latencyMs;
    }

    const runOneCycle = async (cycleIdx: number) => {
      const probesThisCycle = cycleIdx === 0 ? pingProbeCount : 4;
      for (let i = 1; i <= probesThisCycle; i++) {
        if (this.abortRequested) return;
        const p = await this.measureSingleHttpPing(srv.probeUrl, 2200);
        totalPingAttempts++;
        if (!p.ok) failedPings++;
        samples.push({
          seq: totalPingAttempts,
          latencyMs: p.ok ? p.latencyMs : 0,
          ok: p.ok,
        });
        if (samples.length > 120) samples.shift();
        recomputePingStats();
        result.progress = continuous ? 100 : Math.min(22, Math.round((i / probesThisCycle) * 20) + 2);
        onProgress({ ...result });
        if (!this.abortRequested) await new Promise((r) => setTimeout(r, 40));
      }

      if (this.abortRequested) return;

      const runDownload = direction === 'both' || direction === 'download';
      const runUpload = direction === 'both' || direction === 'upload';
      let usedLocalFallback = false;

      // 2. Sustained Multi-Second Steady-State Download Phase
      if (runDownload && !this.abortRequested) {
        const dlDurationMs = continuous ? 3200 : 5600;
        const dlWarmupMs = continuous ? 1000 : 1500;
        const dlStartBytes = totalBytesTransferred;
        const dlRes = await this.runSustainedDownload({
          durationMs: dlDurationMs,
          warmupMs: dlWarmupMs,
          streams: this.activeStreams,
          probeUrl: srv.probeUrl,
          onLoadedPing: (lat) => loadedPings.push(lat),
          onTick: (liveMbps, phaseBytes, winMbps) => {
            if (this.abortRequested) return;
            result.downloadEstMbps = liveMbps;
            if (winMbps !== null) {
              speedSamples.push({
                seq: speedSamples.length + 1,
                downloadMbps: winMbps,
                uploadMbps: result.uploadEstMbps || 0,
              });
              if (speedSamples.length > 60) speedSamples.shift();
              result.speedSamples = [...speedSamples];
            }
            result.transferredMB = Number(((dlStartBytes + phaseBytes) / (1024 * 1024)).toFixed(1));
            result.progress = continuous
              ? 100
              : Math.min(runUpload ? 62 : 96, 22 + Math.round((speedSamples.length / 8) * (runUpload ? 38 : 72)));
            onProgress({ ...result });
          },
        });

        totalBytesTransferred += dlRes.totalBytes;
        usedLocalFallback = dlRes.sourceLabel.startsWith('Localhost');
        result.effectiveType = dlRes.sourceLabel;
        if (dlRes.sustainedMbps > 0) {
          result.downloadEstMbps = dlRes.sustainedMbps;
          result.peakDownloadMbps = Math.max(result.peakDownloadMbps ?? 0, dlRes.peakMbps, dlRes.sustainedMbps);
        }
        result.transferredMB = Number((totalBytesTransferred / (1024 * 1024)).toFixed(1));
        recomputePingStats();
        result.progress = continuous ? 100 : runUpload ? 62 : 98;
        onProgress({ ...result });
      } else if (direction === 'upload') {
        result.downloadEstMbps = 0;
        result.peakDownloadMbps = 0;
      }

      // 3. Sustained Multi-Second Steady-State Upload Phase
      if (runUpload && !this.abortRequested) {
        const ulDurationMs = continuous ? 3200 : 5200;
        const ulWarmupMs = continuous ? 1000 : 1500;
        const ulStartBytes = totalBytesTransferred;
        let ulTicks = 0;
        const ulRes = await this.runSustainedUpload({
          durationMs: ulDurationMs,
          warmupMs: ulWarmupMs,
          streams: this.activeStreams,
          probeUrl: srv.probeUrl,
          preferLocalFallback: usedLocalFallback,
          onLoadedPing: (lat) => loadedPings.push(lat),
          onTick: (liveMbps, phaseBytes, winMbps) => {
            if (this.abortRequested) return;
            result.uploadEstMbps = liveMbps;
            if (winMbps !== null) {
              if (runDownload && ulTicks < speedSamples.length) {
                // Pair upload curve cleanly onto existing timeline points for a balanced dual chart
                speedSamples[ulTicks] = {
                  ...speedSamples[ulTicks],
                  uploadMbps: winMbps,
                };
              } else {
                speedSamples.push({
                  seq: speedSamples.length + 1,
                  downloadMbps: runDownload ? result.downloadEstMbps : 0,
                  uploadMbps: winMbps,
                });
                if (speedSamples.length > 60) speedSamples.shift();
              }
              ulTicks++;
              result.speedSamples = [...speedSamples];
            }
            result.transferredMB = Number(((ulStartBytes + phaseBytes) / (1024 * 1024)).toFixed(1));
            result.progress = continuous
              ? 100
              : Math.min(98, (runDownload ? 62 : 24) + Math.round((ulTicks / 7) * (runDownload ? 34 : 72)));
            onProgress({ ...result });
          },
        });

        totalBytesTransferred += ulRes.totalBytes;
        if (!runDownload) result.effectiveType = ulRes.sourceLabel;
        if (ulRes.sustainedMbps > 0) {
          result.uploadEstMbps = ulRes.sustainedMbps;
          result.peakUploadMbps = Math.max(result.peakUploadMbps ?? 0, ulRes.peakMbps, ulRes.sustainedMbps);
        }
        result.transferredMB = Number((totalBytesTransferred / (1024 * 1024)).toFixed(1));
        recomputePingStats();
        result.progress = continuous ? 100 : 99;
        onProgress({ ...result });
      } else if (direction === 'download') {
        result.uploadEstMbps = 0;
        result.peakUploadMbps = 0;
      }
    };

    let cycle = 0;
    do {
      await runOneCycle(cycle);
      cycle++;
    } while (continuous && !this.abortRequested);

    const probes = this.getCachedServerProbes();
    const probeIdx = probes.findIndex((p) => p.id === srv.id);
    if (probeIdx >= 0 && result.pingAvgMs > 0) {
      probes[probeIdx] = {
        ...probes[probeIdx],
        pingMs: result.pingAvgMs,
        jitterMs: result.jitterMs,
        status: 'ONLINE',
      };
    }
    result.serverScanResults = [...probes];

    result.progress = 100;
    result.status = 'completed';
    result.continuousMode = false;
    onProgress({ ...result });
    this.running = false;
    this.abortRequested = false;
    this.activeControllers.clear();
    this.activeXhrs.clear();
    return result;
  }
}

export interface ThroughputTimelinePoint {
  elapsedMs: number;
  totalBytes: number;
}

export interface SteadyStateThroughputResult {
  sustainedMbps: number;
  peakMbps: number;
  latestWindowMbps: number;
  steadyBytes: number;
  steadyDurationSec: number;
}

/**
 * Pure scientific steady-state throughput estimator (Ookla / M-Lab NDT7 sliding-window model).
 * - Excludes initial `warmupMs` slow-start / proxy-buffer ramp-up completely.
 * - Uses strict wall-clock `deltaBytes / deltaSec` with ZERO artificial time scaling.
 * - Computes 1.0-second rolling windows inside steady-state for honest peak calculation
 *   (immune to 50 ms RAM/proxy burst spikes).
 */
export function computeSteadyStateThroughput(
  timeline: ThroughputTimelinePoint[],
  warmupMs = 1500
): SteadyStateThroughputResult {
  if (!timeline || timeline.length < 2) {
    return { sustainedMbps: 0, peakMbps: 0, latestWindowMbps: 0, steadyBytes: 0, steadyDurationSec: 0 };
  }

  const sorted = [...timeline].sort((a, b) => a.elapsedMs - b.elapsedMs);
  const last = sorted[sorted.length - 1];
  if (last.totalBytes <= 0 || last.elapsedMs < 100) {
    return { sustainedMbps: 0, peakMbps: 0, latestWindowMbps: 0, steadyBytes: 0, steadyDurationSec: 0 };
  }

  // Find exact steady-state start point at t >= warmupMs (with linear interpolation for precision)
  let baseElapsedMs = 0;
  let baseBytes = 0;
  const hasSteadyWindow = last.elapsedMs >= warmupMs + 500;
  if (hasSteadyWindow) {
    let idx = sorted.findIndex((p) => p.elapsedMs >= warmupMs);
    if (idx <= 0) {
      baseElapsedMs = sorted[0].elapsedMs;
      baseBytes = sorted[0].totalBytes;
    } else {
      const prev = sorted[idx - 1];
      const curr = sorted[idx];
      const span = Math.max(1, curr.elapsedMs - prev.elapsedMs);
      const frac = Math.max(0, Math.min(1, (warmupMs - prev.elapsedMs) / span));
      baseElapsedMs = warmupMs;
      baseBytes = prev.totalBytes + (curr.totalBytes - prev.totalBytes) * frac;
    }
  } else {
    baseElapsedMs = sorted[0].elapsedMs;
    baseBytes = sorted[0].totalBytes;
  }

  let steadyBytes = Math.max(0, last.totalBytes - baseBytes);
  let steadySec = Math.max(0.1, (last.elapsedMs - baseElapsedMs) / 1000);

  // Ultra-slow link fallback where all confirmed chunks arrived before warmup boundary
  if (steadyBytes <= 0 && last.totalBytes > 0) {
    steadyBytes = last.totalBytes;
    steadySec = Math.max(0.1, last.elapsedMs / 1000);
  }

  const sustainedMbps = Number((((steadyBytes * 8) / 1_000_000) / steadySec).toFixed(1));

  // Rolling 1.0-second windows strictly inside the steady-state region
  const steadyPoints = sorted.filter((p) => p.elapsedMs >= baseElapsedMs);
  const rollingWindows: number[] = [];
  for (let i = 0; i < steadyPoints.length; i++) {
    const pEnd = steadyPoints[i];
    if (pEnd.elapsedMs - baseElapsedMs < 900) continue;
    // Find latest point at least 900ms prior to pEnd (and >= baseElapsedMs)
    let pStart: ThroughputTimelinePoint | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (pEnd.elapsedMs - steadyPoints[j].elapsedMs >= 900) {
        pStart = steadyPoints[j];
        break;
      }
    }
    if (!pStart) continue;
    const dBytes = Math.max(0, pEnd.totalBytes - pStart.totalBytes);
    const dSec = (pEnd.elapsedMs - pStart.elapsedMs) / 1000;
    if (dBytes > 0 && dSec >= 0.85) {
      rollingWindows.push(Number((((dBytes * 8) / 1_000_000) / dSec).toFixed(1)));
    }
  }

  const latestWindowMbps =
    rollingWindows.length > 0 ? rollingWindows[rollingWindows.length - 1] : sustainedMbps;

  let peakMbps = sustainedMbps;
  if (rollingWindows.length > 0) {
    const sortedWin = [...rollingWindows].sort((a, b) => a - b);
    const p90Idx = Math.min(sortedWin.length - 1, Math.floor((sortedWin.length - 1) * 0.9));
    // Clamp absurd single-window proxy stall+flush bursts to at most 1.35x sustained steady-state
    peakMbps = Number(Math.max(sustainedMbps, Math.min(sortedWin[p90Idx], sustainedMbps * 1.35)).toFixed(1));
  }

  return {
    sustainedMbps,
    peakMbps,
    latestWindowMbps,
    steadyBytes: Math.round(steadyBytes),
    steadyDurationSec: Number(steadySec.toFixed(2)),
  };
}

export const networkTestService = new NetworkTestService();
