import { SystemPulseApp } from './app';

function bootSystemPulse(): void {
  const root = document.getElementById('root') || document.getElementById('app') || document.body;
  if ((root as any).__systemPulseMounted) return;
  (root as any).__systemPulseMounted = true;

  const app = new SystemPulseApp(root);
  void app.mount();

  window.addEventListener('beforeunload', () => {
    app.dispose();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootSystemPulse);
} else {
  bootSystemPulse();
}
