import * as d3 from 'd3';
import { ComponentScanCard, DiskTestResult, RamTestResult } from '../types';

export function renderDiskThroughputD3Chart(container: HTMLElement, d: DiskTestResult): void {
  container.innerHTML = '';
  const data = [
    { label: 'Odczyt Sekwencyjny', value: d.seqReadMBs || 0, color: '#06b6d4' },
    { label: 'DirectStorage 128K', value: d.directStorageBurstMBs || 0, color: '#38bdf8' },
    { label: 'Zapis Sekwencyjny', value: d.seqWriteMBs || 0, color: '#10b981' },
    { label: 'Mixed 70/30 R/W', value: d.mixedRwMBs || 0, color: '#8b5cf6' },
    { label: 'Zapis Termiczny SLC', value: d.thermalSustainedWriteMBs || 0, color: '#f59e0b' },
  ];

  const maxVal = Math.max(100, ...data.map((item) => item.value)) * 1.15;
  const hasData = data.some((item) => item.value > 0);

  if (!hasData) {
    container.innerHTML = `
      <div style="height:210px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Wybierz dysk i kliknij „Testuj dysk”, aby wygenerować wykres D3.js przepustowości (MB/s).
      </div>`;
    return;
  }

  const width = Math.max(360, container.clientWidth || 540);
  const height = 215;
  const margin = { top: 14, right: 78, bottom: 26, left: 148 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3.scaleLinear().domain([0, maxVal]).range([0, innerW]);
  const y = d3
    .scaleBand()
    .domain(data.map((item) => item.label))
    .range([0, innerH])
    .padding(0.28);

  // Gridlines
  g.append('g')
    .selectAll('line')
    .data(x.ticks(4))
    .enter()
    .append('line')
    .attr('x1', (v) => x(v))
    .attr('x2', (v) => x(v))
    .attr('y1', 0)
    .attr('y2', innerH)
    .attr('stroke', 'rgba(148,163,184,0.14)')
    .attr('stroke-dasharray', '3,3');

  // Track backgrounds
  g.selectAll('.bar-bg')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', 0)
    .attr('y', (item) => y(item.label) ?? 0)
    .attr('width', innerW)
    .attr('height', y.bandwidth())
    .attr('rx', 5)
    .attr('fill', 'rgba(30,41,59,0.55)');

  // Data bars
  g.selectAll('.bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', 0)
    .attr('y', (item) => y(item.label) ?? 0)
    .attr('width', (item) => Math.max(4, x(item.value)))
    .attr('height', y.bandwidth())
    .attr('rx', 5)
    .attr('fill', (item) => item.color)
    .attr('fill-opacity', 0.9);

  // Labels left
  g.selectAll('.lbl-left')
    .data(data)
    .enter()
    .append('text')
    .attr('x', -10)
    .attr('y', (item) => (y(item.label) ?? 0) + y.bandwidth() / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('fill', '#cbd5e1')
    .attr('font-size', 11.5)
    .attr('font-weight', 600)
    .text((item) => item.label);

  // Value labels right
  g.selectAll('.lbl-val')
    .data(data)
    .enter()
    .append('text')
    .attr('x', (item) => Math.min(innerW + 6, x(item.value) + 8))
    .attr('y', (item) => (y(item.label) ?? 0) + y.bandwidth() / 2 + 4)
    .attr('fill', '#f8fafc')
    .attr('font-size', 11.5)
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-weight', 700)
    .text((item) => `${item.value.toFixed(1)} MB/s`);

  // Bottom axis
  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(4).tickFormat((v) => `${v}`))
    .call((axis) => axis.selectAll('path, line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((axis) => axis.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 10).attr('font-family', 'JetBrains Mono, monospace'));
}

export function renderDiskIopsLatencyD3Chart(container: HTMLElement, d: DiskTestResult): void {
  container.innerHTML = '';
  const hasData = d.rand4kIops > 0 || (d.latencySamplesMs && d.latencySamplesMs.length > 0);
  if (!hasData) {
    container.innerHTML = `
      <div style="height:210px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Wykres D3.js skalowania IOPS (4K / QD32 / QD64) oraz opóźnień (ms) pojawi się po uruchomieniu testu.
      </div>`;
    return;
  }

  const iopsData = [
    { label: '4K QD1', value: d.rand4kIops || 0, color: '#22d3ee' },
    { label: 'QD32', value: d.qd32Iops || 0, color: '#3b82f6' },
    { label: 'QD64', value: d.qd64Iops || 0, color: '#a855f7' },
    { label: 'DB WAL', value: d.dbCommitIops || 0, color: '#10b981' },
    { label: 'Meta FS', value: d.metaOpsPerSec || 0, color: '#f59e0b' },
  ];

  const width = Math.max(360, container.clientWidth || 540);
  const height = 215;
  const margin = { top: 20, right: 20, bottom: 32, left: 54 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(iopsData.map((item) => item.label))
    .range([0, innerW])
    .padding(0.32);

  const maxIops = Math.max(500, ...iopsData.map((item) => item.value)) * 1.18;
  const y = d3.scaleLinear().domain([0, maxIops]).range([innerH, 0]);

  g.append('g')
    .selectAll('line')
    .data(y.ticks(4))
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', (v) => y(v))
    .attr('y2', (v) => y(v))
    .attr('stroke', 'rgba(148,163,184,0.14)');

  g.selectAll('.iops-bar')
    .data(iopsData)
    .enter()
    .append('rect')
    .attr('x', (item) => x(item.label) ?? 0)
    .attr('y', (item) => y(item.value))
    .attr('width', x.bandwidth())
    .attr('height', (item) => Math.max(2, innerH - y(item.value)))
    .attr('rx', 5)
    .attr('fill', (item) => item.color)
    .attr('fill-opacity', 0.88);

  g.selectAll('.iops-val')
    .data(iopsData)
    .enter()
    .append('text')
    .attr('x', (item) => (x(item.label) ?? 0) + x.bandwidth() / 2)
    .attr('y', (item) => y(item.value) - 6)
    .attr('text-anchor', 'middle')
    .attr('fill', '#f8fafc')
    .attr('font-size', 10.5)
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-weight', 700)
    .text((item) => item.value.toLocaleString('pl-PL'));

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .call((axis) => axis.selectAll('path, line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((axis) => axis.selectAll('text').attr('fill', '#cbd5e1').attr('font-size', 11));

  g.append('g')
    .call(d3.axisLeft(y).ticks(4).tickFormat((v) => `${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v}`))
    .call((axis) => axis.selectAll('path, line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((axis) => axis.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 10).attr('font-family', 'JetBrains Mono, monospace'));
}

export function renderRamBandwidthD3Chart(container: HTMLElement, r: RamTestResult): void {
  container.innerHTML = '';
  const data = [
    { label: 'Cache L1/L2', value: r.cacheL1L2MBs || 0, color: '#38bdf8' },
    { label: 'Cache L3', value: r.cacheL3MBs || 0, color: '#06b6d4' },
    { label: 'RAM Odczyt', value: r.bandwidthReadMBs || 0, color: '#10b981' },
    { label: 'RAM Zapis', value: r.bandwidthWriteMBs || 0, color: '#22c55e' },
    { label: 'Kopiowanie DMA', value: r.copyBandwidthMBs || 0, color: '#8b5cf6' },
    { label: 'STREAM Triad', value: r.streamCopyMBs || 0, color: '#f59e0b' },
  ];

  const hasData = data.some((item) => item.value > 0);
  if (!hasData) {
    container.innerHTML = `
      <div style="height:215px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Uruchom 14-etapowy test pamięci RAM, aby wygenerować wykres D3.js hierarchii przepustowości (L1/L2/L3/DRAM MB/s).
      </div>`;
    return;
  }

  const width = Math.max(360, container.clientWidth || 620);
  const height = 225;
  const margin = { top: 14, right: 92, bottom: 26, left: 122 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const maxVal = Math.max(1000, ...data.map((item) => item.value)) * 1.12;
  const x = d3.scaleLinear().domain([0, maxVal]).range([0, innerW]);
  const y = d3
    .scaleBand()
    .domain(data.map((item) => item.label))
    .range([0, innerH])
    .padding(0.26);

  g.append('g')
    .selectAll('line')
    .data(x.ticks(5))
    .enter()
    .append('line')
    .attr('x1', (v) => x(v))
    .attr('x2', (v) => x(v))
    .attr('y1', 0)
    .attr('y2', innerH)
    .attr('stroke', 'rgba(148,163,184,0.14)')
    .attr('stroke-dasharray', '3,3');

  g.selectAll('.ram-bg')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', 0)
    .attr('y', (item) => y(item.label) ?? 0)
    .attr('width', innerW)
    .attr('height', y.bandwidth())
    .attr('rx', 5)
    .attr('fill', 'rgba(30,41,59,0.55)');

  g.selectAll('.ram-bar')
    .data(data)
    .enter()
    .append('rect')
    .attr('x', 0)
    .attr('y', (item) => y(item.label) ?? 0)
    .attr('width', (item) => Math.max(4, x(item.value)))
    .attr('height', y.bandwidth())
    .attr('rx', 5)
    .attr('fill', (item) => item.color)
    .attr('fill-opacity', 0.9);

  g.selectAll('.ram-lbl')
    .data(data)
    .enter()
    .append('text')
    .attr('x', -10)
    .attr('y', (item) => (y(item.label) ?? 0) + y.bandwidth() / 2 + 4)
    .attr('text-anchor', 'end')
    .attr('fill', '#cbd5e1')
    .attr('font-size', 11.5)
    .attr('font-weight', 600)
    .text((item) => item.label);

  g.selectAll('.ram-val')
    .data(data)
    .enter()
    .append('text')
    .attr('x', (item) => Math.min(innerW + 6, x(item.value) + 8))
    .attr('y', (item) => (y(item.label) ?? 0) + y.bandwidth() / 2 + 4)
    .attr('fill', '#f8fafc')
    .attr('font-size', 11.5)
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-weight', 700)
    .text((item) => `${Math.round(item.value).toLocaleString('pl-PL')} MB/s`);

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickFormat((v) => `${Number(v) >= 1000 ? `${(Number(v) / 1000).toFixed(0)}k` : v}`))
    .call((axis) => axis.selectAll('path, line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((axis) => axis.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 10).attr('font-family', 'JetBrains Mono, monospace'));
}

export function renderHardwareHealthD3Chart(container: HTMLElement, cards: ComponentScanCard[]): void {
  container.innerHTML = '';
  if (!cards || cards.length === 0) {
    container.innerHTML = `
      <div style="height:210px;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;">
        Trwa automatyczne skanowanie 12 podzespołów sprzętowych...
      </div>`;
    return;
  }

  const width = Math.max(420, container.clientWidth || 760);
  const height = 215;
  const margin = { top: 22, right: 18, bottom: 44, left: 38 };
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const svg = d3
    .select(container)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%')
    .style('height', `${height}px`)
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(cards.map((c) => c.category))
    .range([0, innerW])
    .padding(0.28);

  const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

  g.append('g')
    .selectAll('line')
    .data([0, 25, 50, 75, 100])
    .enter()
    .append('line')
    .attr('x1', 0)
    .attr('x2', innerW)
    .attr('y1', (v) => y(v))
    .attr('y2', (v) => y(v))
    .attr('stroke', 'rgba(148,163,184,0.14)');

  const getColor = (c: ComponentScanCard) =>
    c.score >= 90 ? '#10b981' : c.score >= 75 ? '#06b6d4' : c.score >= 55 ? '#f59e0b' : '#ef4444';

  g.selectAll('.hw-bar-bg')
    .data(cards)
    .enter()
    .append('rect')
    .attr('x', (c) => x(c.category) ?? 0)
    .attr('y', 0)
    .attr('width', x.bandwidth())
    .attr('height', innerH)
    .attr('rx', 5)
    .attr('fill', 'rgba(30,41,59,0.45)');

  g.selectAll('.hw-bar')
    .data(cards)
    .enter()
    .append('rect')
    .attr('x', (c) => x(c.category) ?? 0)
    .attr('y', (c) => y(c.score))
    .attr('width', x.bandwidth())
    .attr('height', (c) => Math.max(3, innerH - y(c.score)))
    .attr('rx', 5)
    .attr('fill', (c) => getColor(c))
    .attr('fill-opacity', 0.9)
    .append('title')
    .text((c) => `${c.title}: ${c.score}/100 (${c.headline})`);

  g.selectAll('.hw-val')
    .data(cards)
    .enter()
    .append('text')
    .attr('x', (c) => (x(c.category) ?? 0) + x.bandwidth() / 2)
    .attr('y', (c) => y(c.score) - 5)
    .attr('text-anchor', 'middle')
    .attr('fill', '#f8fafc')
    .attr('font-size', 10)
    .attr('font-family', 'JetBrains Mono, monospace')
    .attr('font-weight', 700)
    .text((c) => `${c.score}%`);

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x))
    .call((axis) => axis.selectAll('path, line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((axis) =>
      axis
        .selectAll('text')
        .attr('fill', '#cbd5e1')
        .attr('font-size', 9.5)
        .attr('font-family', 'JetBrains Mono, monospace')
        .attr('transform', 'rotate(-20)')
        .style('text-anchor', 'end')
    );

  g.append('g')
    .call(d3.axisLeft(y).ticks(4).tickFormat((v) => `${v}%`))
    .call((axis) => axis.selectAll('path, line').attr('stroke', 'rgba(148,163,184,0.25)'))
    .call((axis) => axis.selectAll('text').attr('fill', '#94a3b8').attr('font-size', 9.5).attr('font-family', 'JetBrains Mono, monospace'));
}
