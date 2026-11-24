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

  /**
   * Executes a 100% REAL multi-stream HTTP download + upload measurement.
   * Uses ReadableStream byte-counting starting after response headers arrive so throughput
   * reflects genuine wire transfer rate over parallel TCP/HTTP streams. Zero synthetic caps or fake RAM copies.
   */
  private async measureRealBandwidthPhase(
    burstIndex: number,
    direction: NetworkTransferDirection,
    onLiveSample?: (phase: 'down' | 'up', liveMbps: number, liveBytes: number) => void
  ): Promise<{
    downloadMbps: number;
    uploadMbps: number;
    bytesTransferred: number;
    loadedPingMs: number;
    sourceLabel: string;
  }> {
    const srv = this.getSelectedServer();
    const streamCount = Math.max(6, Math.min(12, this.activeStreams));
    const chunkBytes = burstIndex <= 2 ? 12_000_000 : 25_000_000;
    const maxWindowMs = direction === 'both' ? 2200 : 2800;

    let totalDownBytes = 0;
    let firstByteTs = 0;
    let lastByteTs = 0;
    let loadedPingMs = 0;
    let sourceLabel = 'Cloudflare Edge Multi-Stream (HTTPS)';

    const runDownload = direction === 'both' || direction === 'download';
    const runUpload = direction === 'both' || direction === 'upload';

    // Fire a loaded ping simultaneously during heavy traffic to measure real Bufferbloat
    const loadedPingPromise = this.measureSingleHttpPing(srv.probeUrl, 2200);

    const runDownloadStreams = async (useLocalFallback: boolean): Promise<number> => {
      totalDownBytes = 0;
      firstByteTs = 0;
      lastByteTs = 0;
      let lastReportTs = performance.now();

      const streamCtrls: AbortController[] = [];
      const windowTimer = window.setTimeout(() => {
        for (const c of streamCtrls) {
          try {
            c.abort();
          } catch {
            // ignore
          }
        }
      }, maxWindowMs + 1400);

      try {
        await Promise.all(
          Array.from({ length: streamCount }, async (_, k) => {
            if (this.abortRequested) return;
            const ctrl = new AbortController();
            streamCtrls.push(ctrl);
            this.activeControllers.add(ctrl);

            const url = useLocalFallback
              ? `${window.location.origin}/api/speedtest/download?bytes=${8 * 1024 * 1024}&_r=${Date.now()}_${burstIndex}_${k}`
              : this.getDownloadStreamUrl(chunkBytes, burstIndex, k);

            try {
              const res = await fetch(url, { cache: 'no-store', signal: ctrl.signal });
              if (!res.ok) return;

              if (res.body && typeof res.body.getReader === 'function') {
                const reader = res.body.getReader();
                while (!this.abortRequested) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  const now = performance.now();
                  if (firstByteTs === 0) firstByteTs = now;
                  lastByteTs = now;
                  totalDownBytes += value.byteLength;

                  if (onLiveSample && now - firstByteTs > 120 && now - lastReportTs > 130) {
                    lastReportTs = now;
                    const sec = Math.max(0.05, (now - firstByteTs) / 1000);
                    const liveMbps = Number((((totalDownBytes * 8) / 1_000_000) / sec).toFixed(1));
                    onLiveSample('down', liveMbps, totalDownBytes);
                  }

                  if (now - firstByteTs >= maxWindowMs) {
                    try {
                      await reader.cancel();
                    } catch {
                      // ignore
                    }
                    break;
                  }
                }
              } else {
                const tBody0 = performance.now();
                const buf = await res.arrayBuffer();
                const tBody1 = performance.now();
                if (firstByteTs === 0 || tBody0 < firstByteTs) firstByteTs = tBody0;
                if (tBody1 > lastByteTs) lastByteTs = tBody1;
                totalDownBytes += buf.byteLength;
              }
            } catch {
              // Aborted at window limit or connection error
            } finally {
              this.activeControllers.delete(ctrl);
            }
          })
        );
      } finally {
        window.clearTimeout(windowTimer);
      }
      return totalDownBytes;
    };

    if (runDownload) {
      await runDownloadStreams(false);
      if (
        totalDownBytes === 0 &&
        !this.abortRequested &&
        (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
      ) {
        const localBytes = await runDownloadStreams(true);
        if (localBytes > 0) {
          sourceLabel = 'Localhost Bridge (.EXE) — Pętla lokalna';
        }
      }
    }

    const loadedRes = await loadedPingPromise;
    loadedPingMs = loadedRes.ok ? loadedRes.latencyMs : 0;

    const dlSec = firstByteTs > 0 && lastByteTs > firstByteTs ? (lastByteTs - firstByteTs) / 1000 : 0;
    const downloadMbps =
      runDownload && totalDownBytes > 0 && dlSec > 0
        ? Number((((totalDownBytes * 8) / 1_000_000) / dlSec).toFixed(1))
        : 0;

    // 2. Real Multi-Stream Upload via XHR upload.onprogress (live streaming) with fetch fallback
    let totalUpBytes = 0;
    let uploadMbps = 0;
    if (runUpload && !this.abortRequested) {
      const upStreams = Math.max(4, Math.min(10, direction === 'upload' ? streamCount : Math.round(streamCount * 0.65)));
      const uploadChunkSize = (direction === 'upload' ? 6 : 4) * 1024 * 1024;
      const upPayload = new Uint8Array(uploadChunkSize);
      for (let i = 0; i < uploadChunkSize; i += 64) {
        upPayload[i] = (i * 31 + burstIndex) & 0xff;
      }

      const isLocalOrigin =
        window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';
      const useLocalUp = sourceLabel.startsWith('Localhost');

      const runUploadPass = async (localFallback: boolean): Promise<{ bytes: number; sec: number }> => {
        const streamLoaded = new Array<number>(upStreams).fill(0);
        const tUp0 = performance.now();
        let lastUpReportTs = tUp0;

        const sendOneStream = async (k: number): Promise<number> => {
          if (this.abortRequested) return 0;
          const url = localFallback
            ? `${window.location.origin}/api/speedtest/upload?_r=${Date.now()}_${burstIndex}_${k}`
            : this.getUploadEndpointUrl(burstIndex, k);

          if (typeof XMLHttpRequest !== 'undefined') {
            return await new Promise<number>((resolve) => {
              const xhr = new XMLHttpRequest();
              this.activeXhrs.add(xhr);
              const timer = window.setTimeout(() => {
                try {
                  xhr.abort();
                } catch {
                  // ignore
                }
              }, maxWindowMs + 1600);

              let settled = false;
              const finish = (bytesSent: number) => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timer);
                this.activeXhrs.delete(xhr);
                resolve(bytesSent);
              };

              xhr.open('POST', url, true);
              xhr.upload.onprogress = (ev) => {
                if (this.abortRequested) return;
                streamLoaded[k] = ev.loaded;
                const now = performance.now();
                const aggBytes = streamLoaded.reduce((a, b) => a + b, 0);
                if (onLiveSample && now - tUp0 > 130 && now - lastUpReportTs > 130 && aggBytes > 0) {
                  lastUpReportTs = now;
                  const sec = Math.max(0.05, (now - tUp0) / 1000);
                  const liveUpMbps = Number((((aggBytes * 8) / 1_000_000) / sec).toFixed(1));
                  onLiveSample('up', liveUpMbps, totalDownBytes + aggBytes);
                }
              };
              xhr.onload = () => {
                const ok = xhr.status >= 200 && xhr.status < 300;
                finish(ok ? Math.max(streamLoaded[k], uploadChunkSize) : streamLoaded[k]);
              };
              xhr.onerror = () => finish(0);
              xhr.onabort = () => finish(streamLoaded[k]);
              try {
                xhr.send(upPayload);
              } catch {
                finish(0);
              }
            });
          }

          const ctrl = new AbortController();
          this.activeControllers.add(ctrl);
          const timer = window.setTimeout(() => ctrl.abort(), maxWindowMs + 1600);
          try {
            const res = await fetch(url, {
              method: 'POST',
              body: upPayload,
              cache: 'no-store',
              signal: ctrl.signal,
            });
            return res.ok ? uploadChunkSize : 0;
          } catch {
            return 0;
          } finally {
            window.clearTimeout(timer);
            this.activeControllers.delete(ctrl);
          }
        };

        const sentPerStream = await Promise.all(
          Array.from({ length: upStreams }, (_, k) => sendOneStream(k))
        );
        const bytes = sentPerStream.reduce((a, b) => a + b, 0);
        const sec = Math.max(0.02, (performance.now() - tUp0) / 1000);
        return { bytes, sec };
      };

      let upPass = await runUploadPass(useLocalUp);
      if (upPass.bytes === 0 && !useLocalUp && isLocalOrigin && !this.abortRequested) {
        upPass = await runUploadPass(true);
        if (upPass.bytes > 0) {
          sourceLabel = 'Localhost Bridge (.EXE) — Pętla lokalna';
        }
      }
      totalUpBytes = upPass.bytes;
      if (totalUpBytes > 0) {
        uploadMbps = Number((((totalUpBytes * 8) / 1_000_000) / upPass.sec).toFixed(1));
      }
    }

    return {
      downloadMbps,
      uploadMbps,
      bytesTransferred: totalDownBytes + totalUpBytes,
      loadedPingMs,
      sourceLabel,
    };
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
    const totalProbes = continuous ? 999999 : (options?.sampleCount ?? 24);

    const result = this.createInitialState();
    result.status = 'running';
    result.continuousMode = continuous;
    result.transferDirection = direction;
    result.targetSamples = continuous ? 0 : totalProbes;
    result.activeStreams = this.activeStreams;
    result.selectedServerId = srv.id;
    result.selectedServerName = `${srv.city} (${srv.country}) — ${srv.provider}`;
    result.linkProfileGbps = this.linkProfileGbps;
    result.progress = 3;

    onProgress({ ...result });

    // 1. Measure genuine DNS + TCP + TLS handshake cold RTT before warm pings
    const coldPing = await this.measureSingleHttpPing(srv.probeUrl, 2500);
    const warmupPing = await this.measureSingleHttpPing(srv.probeUrl, 2500);
    if (coldPing.ok && warmupPing.ok) {
      result.dnsLookupMs = Number(Math.max(0.2, coldPing.latencyMs - warmupPing.latencyMs).toFixed(1));
    } else if (coldPing.ok) {
      result.dnsLookupMs = coldPing.latencyMs;
    }

    const samples: NetworkPingSample[] = [];
    const speedSamples: NetworkSpeedSample[] = [];
    const loadedPings: number[] = [];
    let failed = 0;
    let totalBytesTransferred = 0;
    const speedProbeInterval = continuous ? 1 : totalProbes <= 16 ? 3 : 4;

    for (let i = 1; i <= totalProbes; i++) {
      if (this.abortRequested) break;

      const pingRes = await this.measureSingleHttpPing(srv.probeUrl, 2400);
      if (!pingRes.ok) failed++;

      samples.push({
        seq: i,
        latencyMs: pingRes.ok ? pingRes.latencyMs : 0,
        ok: pingRes.ok,
      });
      if (samples.length > 120) samples.shift();

      const validLats = samples.filter((s) => s.ok && s.latencyMs > 0).map((s) => s.latencyMs);
      if (validLats.length > 0) {
        result.pingMinMs = Number(Math.min(...validLats).toFixed(1));
        result.pingMaxMs = Number(Math.max(...validLats).toFixed(1));
        result.pingAvgMs = Number(
          (validLats.reduce((a, b) => a + b, 0) / validLats.length).toFixed(1)
        );

        if (validLats.length > 1) {
          let diffSum = 0;
          for (let j = 1; j < validLats.length; j++) {
            diffSum += Math.abs(validLats[j] - validLats[j - 1]);
          }
          result.jitterMs = Number((diffSum / (validLats.length - 1)).toFixed(1));
        }
      }

      if (i === 1 || i % speedProbeInterval === 0 || i === totalProbes) {
        const burstIdx = speedSamples.length + 1;
        const burst = await this.measureRealBandwidthPhase(
          burstIdx,
          direction,
          (phase, liveMbps, liveBytes) => {
            if (this.abortRequested) return;
            if (phase === 'down') {
              result.downloadEstMbps = liveMbps;
              result.peakDownloadMbps = Math.max(result.peakDownloadMbps || 0, liveMbps);
            } else {
              result.uploadEstMbps = liveMbps;
              result.peakUploadMbps = Math.max(result.peakUploadMbps || 0, liveMbps);
            }
            result.transferredMB = Number(((totalBytesTransferred + liveBytes) / (1024 * 1024)).toFixed(1));
            onProgress({ ...result });
          }
        );

        if (this.abortRequested && burst.bytesTransferred === 0) break;

        result.effectiveType = burst.sourceLabel;
        totalBytesTransferred += burst.bytesTransferred;
        if (burst.loadedPingMs > 0) loadedPings.push(burst.loadedPingMs);

        speedSamples.push({
          seq: speedSamples.length + 1,
          downloadMbps: burst.downloadMbps,
          uploadMbps: burst.uploadMbps,
        });
        if (speedSamples.length > 60) speedSamples.shift();

        const validDl = speedSamples.map((s) => s.downloadMbps).filter((v) => v > 0);
        const validUl = speedSamples.map((s) => s.uploadMbps).filter((v) => v > 0);

        if (validDl.length > 0 && (direction === 'both' || direction === 'download')) {
          const sortedDl = [...validDl].sort((a, b) => a - b);
          const trimmedDl = sortedDl.length >= 3 ? sortedDl.slice(1) : sortedDl;
          result.downloadEstMbps = Number(
            (trimmedDl.reduce((a, b) => a + b, 0) / trimmedDl.length).toFixed(1)
          );
          result.peakDownloadMbps = Number(Math.max(...validDl).toFixed(1));
        } else if (direction === 'upload') {
          result.downloadEstMbps = 0;
          result.peakDownloadMbps = 0;
        }
        if (validUl.length > 0 && (direction === 'both' || direction === 'upload')) {
          const sortedUl = [...validUl].sort((a, b) => a - b);
          const trimmedUl = sortedUl.length >= 3 ? sortedUl.slice(1) : sortedUl;
          result.uploadEstMbps = Number(
            (trimmedUl.reduce((a, b) => a + b, 0) / trimmedUl.length).toFixed(1)
          );
          result.peakUploadMbps = Number(Math.max(...validUl).toFixed(1));
        } else if (direction === 'download') {
          result.uploadEstMbps = 0;
          result.peakUploadMbps = 0;
        }

        result.transferredMB = Number((totalBytesTransferred / (1024 * 1024)).toFixed(1));

        if (loadedPings.length > 0 && result.pingMinMs > 0) {
          const avgLoaded = loadedPings.reduce((a, b) => a + b, 0) / loadedPings.length;
          result.bufferbloatMs = Number(Math.max(0, avgLoaded - result.pingMinMs).toFixed(1));
        } else {
          result.bufferbloatMs = Number(Math.max(0, result.pingMaxMs - result.pingMinMs).toFixed(1));
        }
      }

      result.packetLossPct = Number(((failed / i) * 100).toFixed(1));
      if (validLats.length > 0) {
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

      result.samples = [...samples];
      result.speedSamples = [...speedSamples];
      result.progress = continuous ? 100 : Math.min(99, Math.round((i / totalProbes) * 100));

      if (!navigator.onLine || result.packetLossPct >= 50) {
        result.qualityGrade = 'OFFLINE';
      } else if (result.packetLossPct > 5 || result.jitterMs > 25 || result.pingAvgMs > 180) {
        result.qualityGrade = 'NIESTABILNA';
      } else if (result.pingAvgMs <= 65 && result.jitterMs <= 12) {
        result.qualityGrade = 'WZOROWA';
      } else {
        result.qualityGrade = 'DOBRA';
      }

      onProgress({ ...result });
      if (!this.abortRequested) {
        await new Promise((r) => setTimeout(r, 45));
      }
    }

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

export const networkTestService = new NetworkTestService();
