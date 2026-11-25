export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaInstallState {
  isInstallable: boolean;
  isInstalled: boolean;
  isIOS: boolean;
  isOnline: boolean;
}

type Listener = (state: PwaInstallState) => void;

class PwaInstallService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private isInstalled = false;
  private isIOS = false;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private initialized = false;
  private listeners = new Set<Listener>();

  public init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    const standaloneFlag = Boolean(
      (window as unknown as { __SYSTEMPULSE_STANDALONE_OFFLINE__?: boolean })
        .__SYSTEMPULSE_STANDALONE_OFFLINE__
    );
    const isStandaloneMedia =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches;
    const isNavigatorStandalone =
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    this.isInstalled = standaloneFlag || isStandaloneMedia || isNavigatorStandalone;

    const ua = (window.navigator?.userAgent || '').toLowerCase();
    this.isIOS = /iphone|ipad|ipod/.test(ua);
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.emit();
    });

    window.addEventListener('appinstalled', () => {
      this.isInstalled = true;
      this.deferredPrompt = null;
      this.emit();
    });

    window.addEventListener('online', () => {
      this.isOnline = true;
      this.emit();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.emit();
    });

    // Register service worker on http(s) origins (never on file:// offline launches)
    if (
      (window.location.protocol === 'https:' ||
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1') &&
      'serviceWorker' in navigator &&
      !standaloneFlag
    ) {
      void this.registerServiceWorker();
    }
  }

  private async registerServiceWorker(): Promise<void> {
    try {
      const mod = await import('virtual:pwa-register');
      if (typeof mod.registerSW === 'function') {
        mod.registerSW({ immediate: true });
      }
    } catch {
      // Ignore in non-Vite or test environments
    }
  }

  public getState(): PwaInstallState {
    return {
      isInstallable: this.deferredPrompt !== null,
      isInstalled: this.isInstalled,
      isIOS: this.isIOS,
      isOnline: this.isOnline,
    };
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(state);
      } catch {
        // Ignore subscriber error
      }
    }
  }

  public async promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!this.deferredPrompt) return 'unavailable';
    try {
      await this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        this.isInstalled = true;
        this.deferredPrompt = null;
        this.emit();
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }
}

export const pwaInstallService = new PwaInstallService();
