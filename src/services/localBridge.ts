export function isHostedOnExeBridge(): boolean {
  if (typeof window === 'undefined') return false;
  const winAny = window as unknown as { __SYSTEMPULSE_EXE_BRIDGE__?: boolean };
  if (winAny.__SYSTEMPULSE_EXE_BRIDGE__ === true) return true;
  const host = window.location?.hostname || '';
  const port = window.location?.port || '';
  return (host === '127.0.0.1' || host === 'localhost') && port === '45880';
}

/**
 * Returns local C# / PowerShell desktop bridge base URLs safe to query without
 * triggering browser Mixed-Content errors or unsolicited ERR_CONNECTION_REFUSED
 * console noise in pure web / Vite dev / HTTPS preview sessions.
 */
export function getLocalBridgeBases(force = false): string[] {
  if (typeof window === 'undefined') return [];
  if (isHostedOnExeBridge()) return [''];
  if (force && window.location?.protocol === 'http:') {
    return ['http://127.0.0.1:45880'];
  }
  return [];
}
