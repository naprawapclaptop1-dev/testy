export function iconSvg(name: string, size = 16): string {
  const common = `width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;

  switch (name) {
    case 'pulse':
      return `<svg ${common}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`;
    case 'cpu':
      return `<svg ${common}><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`;
    case 'ram':
      return `<svg ${common}><rect x="2" y="7" width="20" height="10" rx="2"/><line x1="6" y1="7" x2="6" y2="17"/><line x1="10" y1="7" x2="10" y2="17"/><line x1="14" y1="7" x2="14" y2="17"/><line x1="18" y1="7" x2="18" y2="17"/><line x1="5" y1="17" x2="5" y2="20"/><line x1="9" y1="17" x2="9" y2="20"/><line x1="15" y1="17" x2="15" y2="20"/><line x1="19" y1="17" x2="19" y2="20"/></svg>`;
    case 'disk':
      return `<svg ${common}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`;
    case 'gpu':
      return `<svg ${common}><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="9" cy="12" r="3"/><circle cx="16.5" cy="12" r="2"/><line x1="6" y1="18" x2="6" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></svg>`;
    case 'display':
      return `<svg ${common}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`;
    case 'battery':
      return `<svg ${common}><rect x="2" y="7" width="18" height="10" rx="2"/><line x1="22" y1="11" x2="22" y2="13"/><line x1="6" y1="10" x2="6" y2="14"/><line x1="10" y1="10" x2="10" y2="14"/><line x1="14" y1="10" x2="14" y2="14"/></svg>`;
    case 'play':
      return `<svg ${common}><polygon points="6 4 20 12 6 20 6 4"/></svg>`;
    case 'stop':
      return `<svg ${common}><rect x="5" y="5" width="14" height="14" rx="1"/></svg>`;
    case 'download':
      return `<svg ${common}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;
    case 'maximize':
      return `<svg ${common}><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
    case 'pdf':
      return `<svg ${common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`;
    case 'trash':
      return `<svg ${common}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    case 'contrast':
      return `<svg ${common}><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/></svg>`;
    case 'peripherals':
      return `<svg ${common}><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="10" x2="6.01" y2="10"/><line x1="10" y1="10" x2="10.01" y2="10"/><line x1="14" y1="10" x2="14.01" y2="10"/><line x1="18" y1="10" x2="18.01" y2="10"/><line x1="7" y1="14" x2="17" y2="14"/></svg>`;
    case 'network':
      return `<svg ${common}><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>`;
    case 'csv':
      return `<svg ${common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h5"/></svg>`;
    case 'scheduler':
      return `<svg ${common}><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h2"/><path d="M12 14h4"/><path d="M8 17h4"/></svg>`;
    case 'thermal':
      return `<svg ${common}><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>`;
    case 'game':
      return `<svg ${common}><rect x="2" y="6" width="20" height="12" rx="4"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15.5" cy="11" r="1"/><circle cx="17.5" cy="13" r="1"/></svg>`;
    case 'fan':
      return `<svg ${common}><circle cx="12" cy="12" r="2.2"/><path d="M12 9.8C12 6 15 3 18 4.5c2 1 1 5-3.8 6.5"/><path d="M14.2 12c3.8 0 6.8 3 5.3 6-1 2-5 1-6.5-3.8"/><path d="M12 14.2c0 3.8-3 6.8-6 5.3-2-1-1-5 3.8-6.5"/><path d="M9.8 12C6 12 3 9 4.5 6c1-2 5-1 6.5 3.8"/></svg>`;
    case 'volume-on':
      return `<svg ${common}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
    case 'volume-off':
      return `<svg ${common}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
    case 'excel':
      return `<svg ${common}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13l3 4"/><path d="M11 13l-3 4"/><line x1="14" y1="13" x2="17" y2="13"/><line x1="14" y1="17" x2="17" y2="17"/></svg>`;
    case 'shield':
      return `<svg ${common}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
    default:
      return `<svg ${common}><circle cx="12" cy="12" r="8"/></svg>`;
  }
}
