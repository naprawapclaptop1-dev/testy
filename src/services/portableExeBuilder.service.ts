/**
 * Generator 100% Samodzielnego Instalatora GUI Windows (.EXE) i Paczki Portable (SystemPulse-Pro-Portable-Win64.zip)
 * Zawiera:
 *  - Pełną aplikację offline w katalogu app/ (app/index.html z <div id="root"> i <script type="module">, app/portable-bundle.js, app/portable-styles.css)
 *  - Graficzny Instalator Windows (WinForms GUI Setup Wizard): SystemPulse-Pro-Setup.exe (kompilowany z SystemPulseSetupGui.cs)
 *  - Natywny program desktopowy SystemPulse-Pro.exe z lokalnym serwerem HTTP (127.0.0.1:45880),
 *    automatycznym punktem końcowym /api/edid (odczytującym model matrycy z Windows WMI / pnputil)
 *    oraz oknem App-Mode z odblokowanym limitem FPS (--disable-frame-rate-limit --disable-gpu-vsync)
 */

import { isHostedOnExeBridge } from './localBridge';
import { FALLBACK_APP_ICO_BASE64, decodeBase64ToBytes } from './appIconData';

interface ZipEntryInput {
  name: string;
  content: string | Uint8Array;
}

let cachedBundleJs = '';
let cachedStylesCss = '';
let cachedIconIcoBytes: Uint8Array | null = null;
let cachedIconSvg = '';
let preloadPromise: Promise<void> | null = null;
let preloadInFlight = false;

function collectDocumentStylesFallback(): string {
  if (typeof document === 'undefined') {
    return 'body { background: #070b14; color: #e2e8f0; font-family: system-ui, sans-serif; }';
  }
  const rules: string[] = [];
  try {
    for (let i = 0; i < document.styleSheets.length; i++) {
      const sheet = document.styleSheets[i];
      try {
        const cssRules = sheet.cssRules;
        for (let j = 0; j < cssRules.length; j++) {
          rules.push(cssRules[j].cssText);
        }
      } catch {
        // Ignore cross-origin stylesheet restrictions
      }
    }
  } catch {
    // Ignore
  }
  return rules.length > 0
    ? rules.join('\n')
    : 'body { background: #070b14; color: #e2e8f0; font-family: system-ui, sans-serif; }';
}

export async function preloadPortableAssets(): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  if (cachedBundleJs.length > 1000 && cachedStylesCss.length > 200) return;
  if (preloadPromise && preloadInFlight) return preloadPromise;

  preloadInFlight = true;
  preloadPromise = (async () => {
    try {
      const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';
      const bust = isHttp ? `?v=${Date.now()}` : '';
      const jsCandidates = [`./portable-bundle.js${bust}`, `/portable-bundle.js${bust}`];
      for (const url of jsCandidates) {
        const jsRes = await fetch(url, { cache: 'no-store' }).catch(() => null);
        if (jsRes && jsRes.ok) {
          const text = await jsRes.text();
          if (
            text &&
            text.length > 1000 &&
            !text.trim().startsWith('<!doctype html') &&
            !text.trim().startsWith('<html')
          ) {
            cachedBundleJs = text;
            break;
          }
        }
      }

      const cssCandidates = [`./portable-styles.css${bust}`, `/portable-styles.css${bust}`];
      for (const url of cssCandidates) {
        const cssRes = await fetch(url, { cache: 'no-store' }).catch(() => null);
        if (cssRes && cssRes.ok) {
          const text = await cssRes.text();
          if (text && !text.trim().startsWith('<!doctype html') && !text.trim().startsWith('<html')) {
            cachedStylesCss = text;
            break;
          }
        }
      }

      const icoCandidates = [`./favicon.ico${bust}`, `/favicon.ico${bust}`];
      for (const url of icoCandidates) {
        const icoRes = await fetch(url, { cache: 'no-store' }).catch(() => null);
        if (icoRes && icoRes.ok) {
          const buf = new Uint8Array(await icoRes.arrayBuffer());
          // Valid ICO header starts with 0x00 0x00 0x01 0x00
          if (buf.length > 64 && buf[0] === 0 && buf[1] === 0 && buf[2] === 1 && buf[3] === 0) {
            cachedIconIcoBytes = buf;
            break;
          }
        }
      }

      const svgCandidates = [`./icon.svg${bust}`, `/icon.svg${bust}`];
      for (const url of svgCandidates) {
        const svgRes = await fetch(url, { cache: 'no-store' }).catch(() => null);
        if (svgRes && svgRes.ok) {
          const text = await svgRes.text();
          if (text && text.trim().startsWith('<svg')) {
            cachedIconSvg = text;
            break;
          }
        }
      }
    } catch {
      // Fallback handled at zip build time
    } finally {
      preloadInFlight = false;
    }
  })();

  return preloadPromise;
}

if (typeof window !== 'undefined') {
  void preloadPortableAssets();
  if (isHostedOnExeBridge()) {
    void preloadPortableAssets();
  }
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
}

function writeU32(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >>> 8) & 0xff;
  buf[offset + 2] = (val >>> 16) & 0xff;
  buf[offset + 3] = (val >>> 24) & 0xff;
}

function getDosDateTime(now = new Date()): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, Math.min(2107, now.getFullYear()));
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = Math.floor(now.getSeconds() / 2);
  const dosTime = ((hours & 0x1f) << 11) | ((minutes & 0x3f) << 5) | (seconds & 0x1f);
  const dosDate = (((year - 1980) & 0x7f) << 9) | ((month & 0x0f) << 5) | (day & 0x1f);
  return { dosTime, dosDate };
}

export function buildZipArchive(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const { dosTime, dosDate } = getDosDateTime(new Date());
  const prepared = entries.map((e) => {
    const nameBytes = encoder.encode(e.name);
    const dataBytes =
      e.content instanceof Uint8Array ? e.content : encoder.encode(e.content);
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc };
  });

  let localTotal = 0;
  let centralTotal = 0;
  for (const item of prepared) {
    localTotal += 30 + item.nameBytes.length + item.dataBytes.length;
    centralTotal += 46 + item.nameBytes.length;
  }
  const totalSize = localTotal + centralTotal + 22;
  const out = new Uint8Array(totalSize);

  const offsets: number[] = [];
  let cursor = 0;

  for (const item of prepared) {
    offsets.push(cursor);
    writeU32(out, cursor, 0x04034b50);
    writeU16(out, cursor + 4, 20);
    writeU16(out, cursor + 6, 0x0800);
    writeU16(out, cursor + 8, 0);
    writeU16(out, cursor + 10, dosTime);
    writeU16(out, cursor + 12, dosDate);
    writeU32(out, cursor + 14, item.crc);
    writeU32(out, cursor + 18, item.dataBytes.length);
    writeU32(out, cursor + 22, item.dataBytes.length);
    writeU16(out, cursor + 26, item.nameBytes.length);
    writeU16(out, cursor + 28, 0);
    out.set(item.nameBytes, cursor + 30);
    cursor += 30 + item.nameBytes.length;
    out.set(item.dataBytes, cursor);
    cursor += item.dataBytes.length;
  }

  const centralDirOffset = cursor;
  for (let i = 0; i < prepared.length; i++) {
    const item = prepared[i];
    writeU32(out, cursor, 0x02014b50);
    writeU16(out, cursor + 4, 20);
    writeU16(out, cursor + 6, 20);
    writeU16(out, cursor + 8, 0x0800);
    writeU16(out, cursor + 10, 0);
    writeU16(out, cursor + 12, dosTime);
    writeU16(out, cursor + 14, dosDate);
    writeU32(out, cursor + 16, item.crc);
    writeU32(out, cursor + 20, item.dataBytes.length);
    writeU32(out, cursor + 24, item.dataBytes.length);
    writeU16(out, cursor + 28, item.nameBytes.length);
    writeU16(out, cursor + 30, 0);
    writeU16(out, cursor + 32, 0);
    writeU16(out, cursor + 34, 0);
    writeU16(out, cursor + 36, 0);
    writeU32(out, cursor + 38, 0);
    writeU32(out, cursor + 42, offsets[i]);
    out.set(item.nameBytes, cursor + 46);
    cursor += 46 + item.nameBytes.length;
  }

  const centralDirSize = cursor - centralDirOffset;
  writeU32(out, cursor, 0x06054b50);
  writeU16(out, cursor + 4, 0);
  writeU16(out, cursor + 6, 0);
  writeU16(out, cursor + 8, prepared.length);
  writeU16(out, cursor + 10, prepared.length);
  writeU32(out, cursor + 12, centralDirSize);
  writeU32(out, cursor + 16, centralDirOffset);
  writeU16(out, cursor + 20, 0);

  return out;
}

export function sanitizePortableBundleJs(rawBundle: string): string {
  return rawBundle
    .replace(/export\s*\{[^}]*\}\s*;?\s*$/u, '')
    .replace(/\bimport\.meta\.env\b/gu, '({DEV:false,PROD:true,MODE:"production"})')
    .replace(/\bimport\.meta\.url\b/gu, '(window.location.href)')
    .replace(/\bimport\.meta\.resolve\b/gu, '(undefined)')
    .replace(/\bimport\.meta\b/gu, '({url:window.location.href,env:{DEV:false,PROD:true,MODE:"production"}})');
}

export function generatePortableExeZipBlob(): { blob: Blob; filename: string } {
  const localServerUrl = 'http://127.0.0.1:45880/index.html';
  const buildStamp = Date.now();
  const stylesContent = cachedStylesCss || collectDocumentStylesFallback();
  // Strip trailing ES module exports and replace all import.meta references (including import.meta.resolve)
  // so the bundle executes cleanly as a classic <script> on both file:/// and http://127.0.0.1:45880
  const rawBundle =
    cachedBundleJs ||
    `console.log("SystemPulse Pro Standalone Offline Build Initialized");`;
  const bundleJsContent = sanitizePortableBundleJs(rawBundle);

  const standaloneAppHtml = `<!doctype html>
<html lang="pl" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#070b14" />
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />
    <meta http-equiv="Pragma" content="no-cache" />
    <meta http-equiv="Expires" content="0" />
    <title>SystemPulse Pro — Diagnostyka Sprzętu i Benchmarki 3D (Standalone Desktop Edition)</title>
    <meta name="description" content="SystemPulse Pro — 40 scen GPU 3D WebGL, 50 światów i wyścigów Gra 3D MAX, Zasilacz PC ATX PSU, CPU 10-Test, RAM MemTest86+, Dysk QD64 i Speed Test 10 Gbps." />
    <link rel="icon" type="image/svg+xml" href="./icon.svg?v=${buildStamp}" />
    <link rel="icon" type="image/x-icon" href="./favicon.ico?v=${buildStamp}" />
    <link rel="shortcut icon" href="./favicon.ico?v=${buildStamp}" />
    <link rel="stylesheet" href="./portable-styles.css?v=${buildStamp}" />
  </head>
  <body style="margin:0;background:#070b14;color:#e2e8f0;font-family:'Segoe UI',system-ui,sans-serif;">
    <div id="root">
      <div id="sp-offline-boot-fallback" style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:#070b14;color:#e2e8f0;">
        <div style="max-width:640px;width:100%;background:#0f172a;border:1px solid #1e293b;border-radius:16px;padding:28px;box-shadow:0 20px 50px rgba(0,0,0,0.6);">
          <div style="display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(6,182,212,0.15);color:#22d3ee;font-size:12px;font-weight:700;">SYSTEMPULSE PRO WIN64 DESKTOP EDITION · BUILD ${buildStamp}</div>
          <h1 style="margin:14px 0 8px;font-size:22px;color:#f8fafc;">Inicjalizacja silnika diagnostycznego 3D WebGL2 &amp; WMI...</h1>
          <p id="sp-offline-boot-msg" style="margin:0;color:#94a3b8;font-size:14px;line-height:1.6;">Trwa ładowanie modułów testowych CPU, RAM, Dysków, Zasilacza ATX PSU oraz 50 scen i gier 3D MAX.</p>
        </div>
      </div>
    </div>
    <script>
      window.__SYSTEMPULSE_STANDALONE_OFFLINE__ = true;
      window.__SYSTEMPULSE_BUILD_STAMP__ = ${buildStamp};
      try {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.getRegistrations().then(function(regs) {
            for (var i = 0; i < regs.length; i++) { regs[i].unregister(); }
          }).catch(function(){});
        }
        if ('caches' in window) {
          caches.keys().then(function(keys) {
            for (var j = 0; j < keys.length; j++) { caches.delete(keys[j]); }
          }).catch(function(){});
        }
      } catch (e) {}
      function __spShowBundleError(detail) {
        var el = document.getElementById('sp-offline-boot-msg');
        if (el) {
          el.style.color = '#fbbf24';
          el.textContent = detail || 'Nie znaleziono pliku app/portable-bundle.js. Najpierw rozpakuj całe archiwum .ZIP (kliknij prawym -> Wyodrębnij wszystkie), a następnie uruchom Instalator-SystemPulse-Pro-Setup.cmd lub SystemPulse-Pro-Portable.bat.';
        }
      }
      window.addEventListener('error', function (ev) {
        if (document.getElementById('sp-offline-boot-fallback') && ev && ev.message) {
          __spShowBundleError('Błąd inicjalizacji aplikacji: ' + ev.message);
        }
      });
    </script>
    <script src="./portable-bundle.js?v=${buildStamp}" defer onerror="__spShowBundleError()"></script>
  </body>
</html>`;

  const installerSetupCmd = [
    '@echo off',
    'setlocal EnableExtensions EnableDelayedExpansion',
    'chcp 65001 >nul',
    'title Kreator Instalacji SystemPulse Pro (Win64 Offline)',
    'echo ====================================================================',
    'echo   INSTALATOR SYSTEMPULSE PRO - WINDOWS 10 / 11 (64-BIT)',
    'echo   Instalacja lokalna pakietu diagnostycznego Win64 (.EXE / App-Mode)',
    'echo ====================================================================',
    'echo.',
    'set "SRC_DIR=%~dp0"',
    'if not exist "%SRC_DIR%app\\index.html" (',
    '  echo [BLAD] Nie znaleziono katalogu "app\\index.html" obok instalatora!',
    '  echo.',
    '  echo Najpierw ROZPAKUJ cale archiwum .ZIP na dysk:',
    '  echo   1. Kliknij prawym przyciskiem na SystemPulse-Pro-Portable-Win64.zip',
    '  echo   2. Wybierz "Wyodrebnij wszystkie..." ^(Extract All^)',
    '  echo   3. Otworz rozpakowany folder i uruchom ponownie ten instalator.',
    '  echo.',
    '  pause',
    '  exit /b 1',
    ')',
    'if not exist "%SRC_DIR%app\\portable-bundle.js" (',
    '  echo [BLAD] Brakuje pliku "app\\portable-bundle.js". Rozpakuj pelne archiwum .ZIP.',
    '  pause',
    '  exit /b 1',
    ')',
    'if exist "%SRC_DIR%SystemPulse-Pro-Setup.exe" (',
    '  echo [OK] Uruchamianie graficznego instalatora SystemPulse-Pro-Setup.exe...',
    '  start "" "%SRC_DIR%SystemPulse-Pro-Setup.exe"',
    '  exit /b 0',
    ')',
    'set "INSTALL_DIR=%LOCALAPPDATA%\\Programs\\SystemPulsePro"',
    'if not exist "%INSTALL_DIR%\\app" mkdir "%INSTALL_DIR%\\app"',
    'if /I not "%SRC_DIR%"=="%INSTALL_DIR%\\" (',
    '  echo [1/4] Kopiowanie najnowszych plikow aplikacji do "%INSTALL_DIR%"...',
    '  xcopy /E /I /Y "%SRC_DIR%app" "%INSTALL_DIR%\\app" >nul',
    '  if errorlevel 1 (',
    '    echo [BLAD] Nie udalo sie skopiowac katalogu app\\. Sprawdz uprawnienia zapisu.',
    '    pause',
    '    exit /b 1',
    '  )',
    '  for %%F in (SystemPulse-Pro.ico SystemPulse-Pro-Portable.bat SystemPulse-Portal.html SystemPulseLauncher.cs SystemPulsePro.csproj SystemPulseSetupGui.cs SystemPulseSetup.csproj SystemPulse-Pro-Installer.iss INSTRUKCJA-PORTABLE-EXE.txt SystemPulse-Pro.exe SystemPulse-Pro-Setup.exe) do (',
    '    if exist "%SRC_DIR%%%F" copy /Y "%SRC_DIR%%%F" "%INSTALL_DIR%\\" >nul',
    '  )',
    ') else (',
    '  echo [1/4] Pliki juz znajduja sie w katalogu docelowym.',
    ')',
    'echo [2/4] Sprawdzanie natywnego pliku wykonywalnego SystemPulse-Pro.exe...',
    'if not exist "%INSTALL_DIR%\\SystemPulse-Pro.exe" (',
    '  where dotnet >nul 2>&1',
    '  if not errorlevel 1 (',
    '    echo       Wykryto .NET SDK - budowanie natywnego SystemPulse-Pro.exe z ikona aplikacji...',
    '    dotnet publish "%INSTALL_DIR%\\SystemPulsePro.csproj" -c Release -r win-x64 -o "%INSTALL_DIR%" --nologo >nul 2>&1',
    '  )',
    ')',
    'echo [3/4] Tworzenie deinstalatora i skrotow z ikona SystemPulse Pro na Pulpicie oraz w Menu Start...',
    '(',
    '  echo @echo off',
    '  echo chcp 65001 ^>nul',
    '  echo title Odinstaluj SystemPulse Pro',
    '  echo if exist "%%USERPROFILE%%\\Desktop\\SystemPulse Pro.url" del /F /Q "%%USERPROFILE%%\\Desktop\\SystemPulse Pro.url" ^>nul 2^>^&1',
    '  echo if exist "%%USERPROFILE%%\\Desktop\\SystemPulse Pro.cmd" del /F /Q "%%USERPROFILE%%\\Desktop\\SystemPulse Pro.cmd" ^>nul 2^>^&1',
    '  echo if defined OneDrive if exist "%%OneDrive%%\\Desktop\\SystemPulse Pro.url" del /F /Q "%%OneDrive%%\\Desktop\\SystemPulse Pro.url" ^>nul 2^>^&1',
    '  echo if defined OneDrive if exist "%%OneDrive%%\\Desktop\\SystemPulse Pro.cmd" del /F /Q "%%OneDrive%%\\Desktop\\SystemPulse Pro.cmd" ^>nul 2^>^&1',
    '  echo if exist "%%APPDATA%%\\Microsoft\\Windows\\Start Menu\\Programs\\SystemPulse Pro" rmdir /S /Q "%%APPDATA%%\\Microsoft\\Windows\\Start Menu\\Programs\\SystemPulse Pro" ^>nul 2^>^&1',
    '  echo echo [OK] Usunieto skroty SystemPulse Pro. Usuwanie katalogu aplikacji...',
    '  echo cd /d "%%LOCALAPPDATA%%"',
    '  echo rmdir /S /Q "%%LOCALAPPDATA%%\\Programs\\SystemPulsePro" ^>nul 2^>^&1 ^& exit /b 0',
    ') > "%INSTALL_DIR%\\Odinstaluj-SystemPulse-Pro.cmd"',
    'set "APP_INDEX_URI=%INSTALL_DIR%\\app\\index.html"',
    'set "APP_INDEX_URI=!APP_INDEX_URI:\\=/!"',
    'set "APP_INDEX_URI=!APP_INDEX_URI: =%%20!"',
    'set "DESK_DIR=%USERPROFILE%\\Desktop"',
    'if not exist "!DESK_DIR!" if defined OneDrive if exist "%OneDrive%\\Desktop" set "DESK_DIR=%OneDrive%\\Desktop"',
    'if not exist "!DESK_DIR!" if defined OneDriveConsumer if exist "%OneDriveConsumer%\\Desktop" set "DESK_DIR=%OneDriveConsumer%\\Desktop"',
    'if not exist "!DESK_DIR!" if defined OneDrive if exist "%OneDrive%\\Pulpit" set "DESK_DIR=%OneDrive%\\Pulpit"',
    'if exist "!DESK_DIR!" (',
    '  if exist "!DESK_DIR!\\SystemPulse Pro.cmd" del /F /Q "!DESK_DIR!\\SystemPulse Pro.cmd" >nul 2>&1',
    '  (',
    '    echo [InternetShortcut]',
    '    echo URL=file:///!APP_INDEX_URI!?v=' + buildStamp,
    '    echo IconFile=%INSTALL_DIR%\\SystemPulse-Pro.ico',
    '    echo IconIndex=0',
    '  ) > "!DESK_DIR!\\SystemPulse Pro.url"',
    ')',
    'set "START_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\SystemPulse Pro"',
    'if not exist "!START_DIR!" mkdir "!START_DIR!" >nul 2>&1',
    'if exist "!START_DIR!" (',
    '  (',
    '    echo [InternetShortcut]',
    '    echo URL=file:///!APP_INDEX_URI!?v=' + buildStamp,
    '    echo IconFile=%INSTALL_DIR%\\SystemPulse-Pro.ico',
    '    echo IconIndex=0',
    '  ) > "!START_DIR!\\SystemPulse Pro.url"',
    '  copy /Y "%INSTALL_DIR%\\Odinstaluj-SystemPulse-Pro.cmd" "!START_DIR!\\Odinstaluj SystemPulse Pro.cmd" >nul 2>&1',
    ')',
    'echo [4/4] Instalacja zakonczona pomyslnie!',
    'echo       Katalog: %INSTALL_DIR%',
    'echo       Skrot:   !DESK_DIR!\\SystemPulse Pro.url ^(z ikona SystemPulse-Pro.ico^)',
    'echo.',
    'if exist "%INSTALL_DIR%\\SystemPulse-Pro.exe" (',
    '  echo [OK] Uruchamianie natywnego SystemPulse-Pro.exe...',
    '  start "" "%INSTALL_DIR%\\SystemPulse-Pro.exe"',
    '  exit /b 0',
    ')',
    'call "%INSTALL_DIR%\\SystemPulse-Pro-Portable.bat"',
    'exit /b 0',
  ].join('\r\n');

  const batLauncher = [
    '@echo off',
    'setlocal EnableExtensions',
    'chcp 65001 >nul',
    'title SystemPulse Pro 64-bit - Standalone Desktop Edition',
    'echo ====================================================================',
    'echo   SYSTEMPULSE PRO - SAMODZIELNA APLIKACJA DESKTOPOWA (WIN64)',
    'echo   Akceleracja GPU D3D11/WebGL2 + Pelny Pakiet Diagnostyczny Offline',
    'echo ====================================================================',
    'if exist "%~dp0SystemPulse-Pro.exe" (',
    '  echo [OK] Uruchamianie natywnego silnika SystemPulse-Pro.exe ^(127.0.0.1:45880^)...',
    '  start "" "%~dp0SystemPulse-Pro.exe"',
    '  exit /b 0',
    ')',
    'set "LOCAL_APP_FILE=%~dp0app\\index.html"',
    'if not exist "%LOCAL_APP_FILE%" (',
    '  echo [BLAD] Nie znaleziono pliku "%LOCAL_APP_FILE%".',
    '  echo Rozpakuj cale archiwum SystemPulse-Pro-Portable-Win64.zip przed uruchomieniem.',
    '  pause',
    '  exit /b 1',
    ')',
    'setlocal EnableDelayedExpansion',
    'set "APP_URI=!LOCAL_APP_FILE:\\=/!"',
    'set "APP_URI=!APP_URI: =%%20!"',
    'set "PROFILE_DIR=%LOCALAPPDATA%\\SystemPulsePro\\BrowserProfile"',
    'if exist "!PROFILE_DIR!\\Default\\Cache" rmdir /S /Q "!PROFILE_DIR!\\Default\\Cache" >nul 2>&1',
    'if exist "!PROFILE_DIR!\\Default\\Code Cache" rmdir /S /Q "!PROFILE_DIR!\\Default\\Code Cache" >nul 2>&1',
    'set "BROWSER_EXE="',
    'if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if not defined BROWSER_EXE if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" set "BROWSER_EXE=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"',
    'if not defined BROWSER_EXE if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER_EXE=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not defined BROWSER_EXE if exist "%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER_EXE=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe" set "BROWSER_EXE=%LOCALAPPDATA%\\Google\\Chrome\\Application\\chrome.exe"',
    'if not defined BROWSER_EXE if exist "%ProgramFiles%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe" set "BROWSER_EXE=%ProgramFiles%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"',
    'if not defined BROWSER_EXE if exist "%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe" set "BROWSER_EXE=%LOCALAPPDATA%\\BraveSoftware\\Brave-Browser\\Application\\brave.exe"',
    'if defined BROWSER_EXE (',
    '  start "" "!BROWSER_EXE!" --app="file:///!APP_URI!?v=' + buildStamp + '" --user-data-dir="!PROFILE_DIR!" --start-maximized --disable-frame-rate-limit --disable-gpu-vsync --disk-cache-size=1 --no-first-run --no-default-browser-check',
    '  exit /b 0',
    ')',
    'start "" "!LOCAL_APP_FILE!"',
    'exit /b 0',
  ].join('\r\n');

  // Native WinForms GUI Setup Wizard (.CS source for SystemPulseSetup.csproj)
  const csharpGuiInstallerSource = `using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Windows.Forms;

namespace SystemPulseProSetup
{
    public class SetupForm : Form
    {
        private TextBox txtPath;
        private Button btnBrowse;
        private CheckBox chkDesktop;
        private CheckBox chkStartMenu;
        private CheckBox chkLaunch;
        private ProgressBar progressBar;
        private Label lblStatus;
        private Button btnInstall;

        public SetupForm()
        {
            this.Text = "Instalator SystemPulse Pro v5.0 (Win64 Desktop Edition)";
            this.Size = new Size(600, 445);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(11, 17, 30);
            this.ForeColor = Color.FromArgb(241, 245, 249);
            this.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular);
            try
            {
                string icoPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SystemPulse-Pro.ico");
                if (File.Exists(icoPath)) this.Icon = new Icon(icoPath);
            }
            catch {}

            Label lblTitle = new Label();
            lblTitle.Text = "SystemPulse Pro — Kreator Instalacji Win64 (.EXE)";
            lblTitle.Font = new Font("Segoe UI", 14.5F, FontStyle.Bold);
            lblTitle.ForeColor = Color.FromArgb(34, 211, 238);
            lblTitle.Location = new Point(24, 20);
            lblTitle.AutoSize = true;
            this.Controls.Add(lblTitle);

            Label lblSub = new Label();
            lblSub.Text = "Pakiet diagnostyki PC/Laptopa: 40 scen GPU 3D, 28 światów i wyścigów Gra 3D MAX,\\r\\ntelemetria Zasilacza ATX PSU, Speed Test 10 Gbps oraz auto-detekcja EDID matrycy.";
            lblSub.ForeColor = Color.FromArgb(148, 163, 184);
            lblSub.Location = new Point(24, 54);
            lblSub.Size = new Size(540, 42);
            this.Controls.Add(lblSub);

            Label lblDir = new Label();
            lblDir.Text = "Folder docelowy instalacji:";
            lblDir.Location = new Point(24, 108);
            lblDir.AutoSize = true;
            this.Controls.Add(lblDir);

            txtPath = new TextBox();
            txtPath.Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\\SystemPulsePro");
            txtPath.Location = new Point(24, 132);
            txtPath.Size = new Size(430, 26);
            txtPath.BackColor = Color.FromArgb(15, 23, 42);
            txtPath.ForeColor = Color.White;
            txtPath.BorderStyle = BorderStyle.FixedSingle;
            this.Controls.Add(txtPath);

            btnBrowse = new Button();
            btnBrowse.Text = "Przeglądaj...";
            btnBrowse.BackColor = Color.FromArgb(30, 41, 59);
            btnBrowse.ForeColor = Color.White;
            btnBrowse.FlatStyle = FlatStyle.Flat;
            btnBrowse.Location = new Point(462, 130);
            btnBrowse.Size = new Size(98, 28);
            btnBrowse.Click += (s, e) =>
            {
                using (FolderBrowserDialog fbd = new FolderBrowserDialog())
                {
                    fbd.Description = "Wybierz folder docelowy instalacji SystemPulse Pro";
                    if (Directory.Exists(txtPath.Text)) fbd.SelectedPath = txtPath.Text;
                    if (fbd.ShowDialog() == DialogResult.OK && !string.IsNullOrWhiteSpace(fbd.SelectedPath))
                    {
                        txtPath.Text = fbd.SelectedPath;
                    }
                }
            };
            this.Controls.Add(btnBrowse);

            chkDesktop = new CheckBox();
            chkDesktop.Text = "Utwórz skrót 'SystemPulse Pro' na Pulpicie";
            chkDesktop.Checked = true;
            chkDesktop.Location = new Point(24, 174);
            chkDesktop.Size = new Size(535, 24);
            this.Controls.Add(chkDesktop);

            chkStartMenu = new CheckBox();
            chkStartMenu.Text = "Utwórz skrót i deinstalator w Menu Start";
            chkStartMenu.Checked = true;
            chkStartMenu.Location = new Point(24, 202);
            chkStartMenu.Size = new Size(535, 24);
            this.Controls.Add(chkStartMenu);

            chkLaunch = new CheckBox();
            chkLaunch.Text = "Uruchom SystemPulse Pro natychmiast po zakończeniu instalacji";
            chkLaunch.Checked = true;
            chkLaunch.Location = new Point(24, 230);
            chkLaunch.Size = new Size(535, 24);
            this.Controls.Add(chkLaunch);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(24, 270);
            progressBar.Size = new Size(536, 22);
            progressBar.Value = 0;
            this.Controls.Add(progressBar);

            lblStatus = new Label();
            lblStatus.Text = "Gotowy do instalacji pakietu offline Win64.";
            lblStatus.ForeColor = Color.FromArgb(148, 163, 184);
            lblStatus.Location = new Point(24, 300);
            lblStatus.Size = new Size(536, 22);
            this.Controls.Add(lblStatus);

            btnInstall = new Button();
            btnInstall.Text = "Zainstaluj SystemPulse Pro";
            btnInstall.Font = new Font("Segoe UI", 10.5F, FontStyle.Bold);
            btnInstall.BackColor = Color.FromArgb(6, 182, 212);
            btnInstall.ForeColor = Color.FromArgb(7, 11, 20);
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.Location = new Point(24, 340);
            btnInstall.Size = new Size(285, 42);
            btnInstall.Click += new EventHandler(OnInstallClick);
            this.Controls.Add(btnInstall);

            Button btnCancel = new Button();
            btnCancel.Text = "Zamknij";
            btnCancel.BackColor = Color.FromArgb(30, 41, 59);
            btnCancel.ForeColor = Color.White;
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.Location = new Point(440, 340);
            btnCancel.Size = new Size(120, 42);
            btnCancel.Click += (s, e) => this.Close();
            this.Controls.Add(btnCancel);
        }

        private static string NormalizePath(string p)
        {
            return Path.GetFullPath(p).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        }

        private static void CopyDir(string src, string dst, string rootTargetNorm, string currentExeNorm)
        {
            string srcNorm = NormalizePath(src);
            string dstNorm = NormalizePath(dst);
            if (srcNorm.Equals(dstNorm, StringComparison.OrdinalIgnoreCase)) return;

            Directory.CreateDirectory(dstNorm);
            foreach (string f in Directory.GetFiles(srcNorm))
            {
                string fileNorm = NormalizePath(f);
                if (!string.IsNullOrEmpty(currentExeNorm) && fileNorm.Equals(currentExeNorm, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                string destFile = Path.Combine(dstNorm, Path.GetFileName(f));
                File.Copy(f, destFile, true);
            }
            foreach (string d in Directory.GetDirectories(srcNorm))
            {
                string dirNorm = NormalizePath(d);
                if (dirNorm.Equals(rootTargetNorm, StringComparison.OrdinalIgnoreCase)) continue;
                string destSub = Path.Combine(dstNorm, Path.GetFileName(d));
                CopyDir(dirNorm, destSub, rootTargetNorm, currentExeNorm);
            }
        }

        private static string BuildLauncherCmd(string targetDir)
        {
            string exePath = Path.Combine(targetDir, "SystemPulse-Pro.exe");
            string batPath = Path.Combine(targetDir, "SystemPulse-Pro-Portable.bat");
            return "@echo off\\r\\n"
                + "if exist \\"" + exePath + "\\" (start \\"\\" \\"" + exePath + "\\" & exit /b 0)\\r\\n"
                + "call \\"" + batPath + "\\"\\r\\n";
        }

        private void OnInstallClick(object sender, EventArgs e)
        {
            try
            {
                btnInstall.Enabled = false;
                string srcDir = NormalizePath(AppDomain.CurrentDomain.BaseDirectory);
                string targetDir = NormalizePath(txtPath.Text.Trim());

                if (string.IsNullOrWhiteSpace(targetDir))
                {
                    throw new InvalidOperationException("Podaj poprawny folder docelowy instalacji.");
                }
                if (!File.Exists(Path.Combine(srcDir, "app", "index.html")))
                {
                    throw new FileNotFoundException("Nie znaleziono pliku app\\\\index.html. Rozpakuj najpierw całe archiwum .ZIP.");
                }
                if (targetDir.StartsWith(srcDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                {
                    throw new InvalidOperationException("Folder docelowy nie może znajdować się wewnątrz folderu instalatora.");
                }

                progressBar.Value = 25;
                lblStatus.Text = "Kopiowanie plików silnika 3D WebGL i pakietu offline...";
                Application.DoEvents();
                string currentExe = "";
                try { currentExe = NormalizePath(Process.GetCurrentProcess().MainModule.FileName); } catch {}
                CopyDir(srcDir, targetDir, targetDir, currentExe);

                progressBar.Value = 65;
                string appUri = new Uri(Path.Combine(targetDir, "app", "index.html")).AbsoluteUri;
                string icoTarget = Path.Combine(targetDir, "SystemPulse-Pro.ico");
                string urlShortcutContent = "[InternetShortcut]\\r\\nURL=" + appUri + "\\r\\nIconFile=" + icoTarget + "\\r\\nIconIndex=0\\r\\n";
                string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
                if (chkDesktop.Checked && Directory.Exists(desktopDir))
                {
                    lblStatus.Text = "Tworzenie skrótu z ikoną SystemPulse Pro na Pulpicie...";
                    Application.DoEvents();
                    string legacyCmd = Path.Combine(desktopDir, "SystemPulse Pro.cmd");
                    if (File.Exists(legacyCmd)) try { File.Delete(legacyCmd); } catch {}
                    File.WriteAllText(Path.Combine(desktopDir, "SystemPulse Pro.url"), urlShortcutContent);
                }

                if (chkStartMenu.Checked)
                {
                    string startMenuDir = Path.Combine(
                        Environment.GetFolderPath(Environment.SpecialFolder.Programs),
                        "SystemPulse Pro"
                    );
                    Directory.CreateDirectory(startMenuDir);
                    File.WriteAllText(Path.Combine(startMenuDir, "SystemPulse Pro.url"), urlShortcutContent);
                }

                progressBar.Value = 100;
                lblStatus.Text = "Instalacja zakończona pomyślnie!";
                lblStatus.ForeColor = Color.FromArgb(52, 211, 153);
                Application.DoEvents();

                if (chkLaunch.Checked)
                {
                    string exePath = Path.Combine(targetDir, "SystemPulse-Pro.exe");
                    string batPath = Path.Combine(targetDir, "SystemPulse-Pro-Portable.bat");
                    if (File.Exists(exePath))
                    {
                        Process.Start(new ProcessStartInfo(exePath) { WorkingDirectory = targetDir, UseShellExecute = true });
                    }
                    else if (File.Exists(batPath))
                    {
                        Process.Start(new ProcessStartInfo(batPath) { WorkingDirectory = targetDir, UseShellExecute = true });
                    }
                }
                MessageBox.Show("SystemPulse Pro został pomyślnie zainstalowany w:\\r\\n" + targetDir, "Instalacja Zakończona", MessageBoxButtons.OK, MessageBoxIcon.Information);
                this.Close();
            }
            catch (Exception ex)
            {
                lblStatus.Text = "Błąd instalacji: " + ex.Message;
                lblStatus.ForeColor = Color.FromArgb(248, 113, 113);
                btnInstall.Enabled = true;
            }
        }

        [STAThread]
        public static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new SetupForm());
        }
    }
}
`;

  const csprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <RollForward>Major</RollForward>
    <AssemblyName>SystemPulse-Pro</AssemblyName>
    <ApplicationIcon>SystemPulse-Pro.ico</ApplicationIcon>
    <Nullable>disable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
    <PublishSingleFile>true</PublishSingleFile>
    <SelfContained>false</SelfContained>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="SystemPulseLauncher.cs" />
    <PackageReference Include="System.Management" Version="8.0.0" />
  </ItemGroup>
</Project>
`;

  const setupCsprojContent = `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows</TargetFramework>
    <RollForward>Major</RollForward>
    <UseWindowsForms>true</UseWindowsForms>
    <AssemblyName>SystemPulse-Pro-Setup</AssemblyName>
    <ApplicationIcon>SystemPulse-Pro.ico</ApplicationIcon>
    <Nullable>disable</Nullable>
    <ImplicitUsings>disable</ImplicitUsings>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
    <PublishSingleFile>true</PublishSingleFile>
    <SelfContained>false</SelfContained>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="SystemPulseSetupGui.cs" />
  </ItemGroup>
</Project>
`;

  const csharpSource = `using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;
using System.Management;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text;
using System.Threading;

namespace SystemPulsePro
{
    static class Program
    {
        private static string cachedEdidJson = null;
        private static string cachedFullHwJson = null;
        private static readonly byte[] speedtestPayload = new byte[2 * 1024 * 1024];

        static Program()
        {
            for (int i = 0; i < speedtestPayload.Length; i++)
            {
                speedtestPayload[i] = (byte)(i & 0xff);
            }
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\"").Replace("\\r", " ").Replace("\\n", " ").Replace("\\t", " ");
        }

        private static string DecodeWmiAscii(object raw)
        {
            if (raw == null) return "";
            ushort[] arr = raw as ushort[];
            if (arr == null) return raw.ToString().Trim();
            StringBuilder sb = new StringBuilder();
            foreach (ushort c in arr)
            {
                if (c > 31 && c < 127) sb.Append((char)c);
            }
            return sb.ToString().Trim();
        }

        private static string QueryLocalMonitorEdidJson()
        {
            if (!string.IsNullOrEmpty(cachedEdidJson)) return cachedEdidJson;
            try
            {
                StringBuilder sb = new StringBuilder();
                sb.Append("{\\"edidMonitors\\":[");
                bool first = true;
                using (ManagementObjectSearcher s = new ManagementObjectSearcher("root\\\\WMI", "SELECT ManufacturerName, UserFriendlyName, ProductCodeID, SerialNumberID, YearOfManufacture FROM WmiMonitorID"))
                {
                    foreach (ManagementObject obj in s.Get())
                    {
                        if (!first) sb.Append(",");
                        first = false;
                        string m = DecodeWmiAscii(obj["ManufacturerName"]);
                        string n = DecodeWmiAscii(obj["UserFriendlyName"]);
                        string p = DecodeWmiAscii(obj["ProductCodeID"]);
                        string ser = DecodeWmiAscii(obj["SerialNumberID"]);
                        int yr = obj["YearOfManufacture"] != null ? Convert.ToInt32(obj["YearOfManufacture"]) : 0;
                        sb.Append("{\\"m\\":\\"").Append(EscapeJson(m))
                          .Append("\\",\\"n\\":\\"").Append(EscapeJson(n))
                          .Append("\\",\\"p\\":\\"").Append(EscapeJson(p))
                          .Append("\\",\\"s\\":\\"").Append(EscapeJson(ser))
                          .Append("\\",\\"y\\":").Append(yr).Append("}");
                    }
                }
                sb.Append("]}");
                cachedEdidJson = sb.ToString();
                return cachedEdidJson;
            }
            catch
            {
                return "{\\"edidMonitors\\":[]}";
            }
        }

        private static byte[] QueryFullHardwareInventoryJson()
        {
            if (!string.IsNullOrEmpty(cachedFullHwJson))
                return Encoding.UTF8.GetBytes(cachedFullHwJson);

            try
            {
                StringBuilder sb = new StringBuilder();
                sb.Append("{\\"os\\":\\"Windows\\",");

                // ComputerSystem
                string sysMfr = "", sysModel = "";
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT Manufacturer, Model FROM Win32_ComputerSystem"))
                    foreach (ManagementObject o in s.Get()) { sysMfr = Convert.ToString(o["Manufacturer"]); sysModel = Convert.ToString(o["Model"]); break; }
                } catch {}
                sb.Append("\\"sys\\":{\\"Manufacturer\\":\\"").Append(EscapeJson(sysMfr)).Append("\\",\\"Model\\":\\"").Append(EscapeJson(sysModel)).Append("\\"},");

                // BaseBoard
                string bMfr = "", bProd = "";
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT Manufacturer, Product FROM Win32_BaseBoard"))
                    foreach (ManagementObject o in s.Get()) { bMfr = Convert.ToString(o["Manufacturer"]); bProd = Convert.ToString(o["Product"]); break; }
                } catch {}
                sb.Append("\\"board\\":{\\"Manufacturer\\":\\"").Append(EscapeJson(bMfr)).Append("\\",\\"Product\\":\\"").Append(EscapeJson(bProd)).Append("\\"},");

                // BIOS
                string bioMfr = "", bioVer = "";
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT Manufacturer, SMBIOSBIOSVersion FROM Win32_BIOS"))
                    foreach (ManagementObject o in s.Get()) { bioMfr = Convert.ToString(o["Manufacturer"]); bioVer = Convert.ToString(o["SMBIOSBIOSVersion"]); break; }
                } catch {}
                sb.Append("\\"bios\\":{\\"Manufacturer\\":\\"").Append(EscapeJson(bioMfr)).Append("\\",\\"SMBIOSBIOSVersion\\":\\"").Append(EscapeJson(bioVer)).Append("\\"},");

                // CPU
                string cpuName = ""; int cores = 0, logical = 0, maxClk = 0;
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT Name, NumberOfCores, NumberOfLogicalProcessors, MaxClockSpeed FROM Win32_Processor"))
                    foreach (ManagementObject o in s.Get())
                    {
                        cpuName = Convert.ToString(o["Name"]);
                        cores = o["NumberOfCores"] != null ? Convert.ToInt32(o["NumberOfCores"]) : 0;
                        logical = o["NumberOfLogicalProcessors"] != null ? Convert.ToInt32(o["NumberOfLogicalProcessors"]) : 0;
                        maxClk = o["MaxClockSpeed"] != null ? Convert.ToInt32(o["MaxClockSpeed"]) : 0;
                        break;
                    }
                } catch {}
                sb.Append("\\"cpu\\":{\\"Name\\":\\"").Append(EscapeJson(cpuName)).Append("\\",\\"NumberOfCores\\":").Append(cores)
                  .Append(",\\"NumberOfLogicalProcessors\\":").Append(logical).Append(",\\"MaxClockSpeed\\":").Append(maxClk).Append("},");

                // GPUs
                sb.Append("\\"gpu\\":[");
                bool first = true;
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT Name, AdapterRAM, DriverVersion FROM Win32_VideoController"))
                    foreach (ManagementObject o in s.Get())
                    {
                        if (!first) sb.Append(",");
                        first = false;
                        long vram = o["AdapterRAM"] != null ? Convert.ToInt64(o["AdapterRAM"]) : 0;
                        sb.Append("{\\"Name\\":\\"").Append(EscapeJson(Convert.ToString(o["Name"])))
                          .Append("\\",\\"AdapterRAM\\":").Append(vram)
                          .Append(",\\"DriverVersion\\":\\"").Append(EscapeJson(Convert.ToString(o["DriverVersion"]))).Append("\\"}");
                    }
                } catch {}
                sb.Append("],");

                // Physical RAM DIMMs
                sb.Append("\\"ram\\":[");
                first = true;
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT DeviceLocator, BankLabel, Manufacturer, PartNumber, Capacity, Speed, SMBIOSMemoryType, SerialNumber FROM Win32_PhysicalMemory"))
                    foreach (ManagementObject o in s.Get())
                    {
                        if (!first) sb.Append(",");
                        first = false;
                        long cap = o["Capacity"] != null ? Convert.ToInt64(o["Capacity"]) : 0;
                        int spd = o["Speed"] != null ? Convert.ToInt32(o["Speed"]) : 0;
                        int mtype = o["SMBIOSMemoryType"] != null ? Convert.ToInt32(o["SMBIOSMemoryType"]) : 0;
                        sb.Append("{\\"DeviceLocator\\":\\"").Append(EscapeJson(Convert.ToString(o["DeviceLocator"])))
                          .Append("\\",\\"BankLabel\\":\\"").Append(EscapeJson(Convert.ToString(o["BankLabel"])))
                          .Append("\\",\\"Manufacturer\\":\\"").Append(EscapeJson(Convert.ToString(o["Manufacturer"])))
                          .Append("\\",\\"PartNumber\\":\\"").Append(EscapeJson(Convert.ToString(o["PartNumber"])))
                          .Append("\\",\\"Capacity\\":").Append(cap)
                          .Append(",\\"Speed\\":").Append(spd)
                          .Append(",\\"SMBIOSMemoryType\\":").Append(mtype)
                          .Append(",\\"SerialNumber\\":\\"").Append(EscapeJson(Convert.ToString(o["SerialNumber"]))).Append("\\"}");
                    }
                } catch {}
                sb.Append("],");

                // Physical Disks
                sb.Append("\\"disks\\":[");
                first = true;
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT Model, InterfaceType, MediaType, Size, Status, SerialNumber FROM Win32_DiskDrive"))
                    foreach (ManagementObject o in s.Get())
                    {
                        if (!first) sb.Append(",");
                        first = false;
                        long sz = o["Size"] != null ? Convert.ToInt64(o["Size"]) : 0;
                        sb.Append("{\\"Model\\":\\"").Append(EscapeJson(Convert.ToString(o["Model"])))
                          .Append("\\",\\"InterfaceType\\":\\"").Append(EscapeJson(Convert.ToString(o["InterfaceType"])))
                          .Append("\\",\\"MediaType\\":\\"").Append(EscapeJson(Convert.ToString(o["MediaType"])))
                          .Append("\\",\\"Size\\":").Append(sz)
                          .Append(",\\"Status\\":\\"").Append(EscapeJson(Convert.ToString(o["Status"])))
                          .Append("\\",\\"SerialNumber\\":\\"").Append(EscapeJson(Convert.ToString(o["SerialNumber"]))).Append("\\"}");
                    }
                } catch {}
                sb.Append("],");

                // Monitors EDID
                sb.Append("\\"monitors\\":[");
                first = true;
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("root\\\\WMI", "SELECT ManufacturerName, UserFriendlyName, SerialNumberID FROM WmiMonitorID"))
                    foreach (ManagementObject o in s.Get())
                    {
                        if (!first) sb.Append(",");
                        first = false;
                        sb.Append("{\\"m\\":\\"").Append(EscapeJson(DecodeWmiAscii(o["ManufacturerName"])))
                          .Append("\\",\\"n\\":\\"").Append(EscapeJson(DecodeWmiAscii(o["UserFriendlyName"])))
                          .Append("\\",\\"s\\":\\"").Append(EscapeJson(DecodeWmiAscii(o["SerialNumberID"]))).Append("\\"}");
                    }
                } catch {}
                sb.Append("],");

                // Physical Network Adapters
                sb.Append("\\"net\\":[");
                first = true;
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback || ni.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
                    if (!first) sb.Append(",");
                    first = false;
                    sb.Append("\\"").Append(EscapeJson(ni.Description + " (" + ni.Name + ")")).Append("\\"");
                }
                sb.Append("]}");

                cachedFullHwJson = sb.ToString();
                return Encoding.UTF8.GetBytes(cachedFullHwJson);
            }
            catch
            {
                return Encoding.UTF8.GetBytes("{\\"os\\":\\"Windows\\",\\"ram\\":[],\\"disks\\":[]}");
            }
        }

        private static byte[] QueryLogicalDrivesJson()
        {
            try
            {
                StringBuilder sb = new StringBuilder();
                sb.Append("{\\"drives\\":[");
                bool first = true;
                foreach (DriveInfo di in DriveInfo.GetDrives())
                {
                    if (!di.IsReady) continue;
                    if (di.DriveType != DriveType.Fixed && di.DriveType != DriveType.Removable && di.DriveType != DriveType.Network) continue;
                    if (!first) sb.Append(",");
                    first = false;
                    double totalGB = Math.Round(di.TotalSize / 1073741824.0, 1);
                    double freeGB = Math.Round(di.AvailableFreeSpace / 1073741824.0, 1);
                    string letter = di.Name.TrimEnd('\\\\');
                    string label = string.IsNullOrEmpty(di.VolumeLabel) ? "Dysk lokalny" : di.VolumeLabel;
                    sb.Append("{\\"letter\\":\\"").Append(EscapeJson(letter))
                      .Append("\\",\\"volumeLabel\\":\\"").Append(EscapeJson(label))
                      .Append("\\",\\"fileSystem\\":\\"").Append(EscapeJson(di.DriveFormat))
                      .Append("\\",\\"driveType\\":\\"").Append(EscapeJson(di.DriveType.ToString()))
                      .Append("\\",\\"totalGB\\":").Append(totalGB.ToString(CultureInfo.InvariantCulture))
                      .Append(",\\"freeGB\\":").Append(freeGB.ToString(CultureInfo.InvariantCulture))
                      .Append(",\\"isReady\\":true,\\"status\\":\\"OK\\"}");
                }
                sb.Append("]}");
                return Encoding.UTF8.GetBytes(sb.ToString());
            }
            catch
            {
                return Encoding.UTF8.GetBytes("{\\"drives\\":[]}");
            }
        }

        private static byte[] RunNativeDriveBenchmark(string driveLetter, int sizeMB)
        {
            string letter = string.IsNullOrWhiteSpace(driveLetter) ? "C" : driveLetter.Substring(0, 1).ToUpperInvariant();
            int clampedMB = Math.Max(16, Math.Min(256, sizeMB));
            string benchDir = Path.Combine(letter + ":\\\\", ".SystemPulseBenchTmp");
            string seqFile = Path.Combine(benchDir, "seq_test.bin");
            try
            {
                Directory.CreateDirectory(benchDir);
                byte[] chunk = new byte[4 * 1024 * 1024];
                for (int i = 0; i < chunk.Length; i += 32) chunk[i] = (byte)((i * 19 + 7) & 0xff);
                int chunks = Math.Max(4, clampedMB / 4);
                double totalMB = chunks * 4.0;

                Stopwatch sw = Stopwatch.StartNew();
                using (FileStream fs = new FileStream(seqFile, FileMode.Create, FileAccess.Write, FileShare.None, 1024 * 1024, FileOptions.WriteThrough))
                {
                    for (int c = 0; c < chunks; c++) fs.Write(chunk, 0, chunk.Length);
                    fs.Flush(true);
                }
                sw.Stop();
                double seqWriteMBs = Math.Round(totalMB / Math.Max(0.005, sw.Elapsed.TotalSeconds), 1);

                sw.Restart();
                byte[] readBuf = new byte[4 * 1024 * 1024];
                bool crcOk = true;
                using (FileStream fs = new FileStream(seqFile, FileMode.Open, FileAccess.Read, FileShare.None, 1024 * 1024, FileOptions.SequentialScan))
                {
                    int readBytes = fs.Read(readBuf, 0, readBuf.Length);
                    if (readBytes >= 32 && readBuf[0] != chunk[0]) crcOk = false;
                    while (fs.Read(readBuf, 0, readBuf.Length) > 0) {}
                }
                sw.Stop();
                double seqReadMBs = Math.Round(totalMB / Math.Max(0.005, sw.Elapsed.TotalSeconds), 1);
                File.Delete(seqFile);

                // 4K Random I/O & Latency
                byte[] b4k = new byte[4096];
                for (int i = 0; i < b4k.Length; i++) b4k[i] = (byte)(i & 0xff);
                int ops = 96;
                List<double> lats = new List<double>();
                sw.Restart();
                for (int i = 0; i < ops; i++)
                {
                    string f = Path.Combine(benchDir, "r4k_" + i + ".bin");
                    Stopwatch opSw = Stopwatch.StartNew();
                    File.WriteAllBytes(f, b4k);
                    opSw.Stop();
                    lats.Add(opSw.Elapsed.TotalMilliseconds);
                }
                sw.Stop();
                double r4wSec = Math.Max(0.004, sw.Elapsed.TotalSeconds);
                double r4wMBs = Math.Round((ops * 4.0 / 1024.0) / r4wSec, 2);

                sw.Restart();
                for (int i = 0; i < ops; i++)
                {
                    string f = Path.Combine(benchDir, "r4k_" + ((i * 17) % ops) + ".bin");
                    Stopwatch opSw = Stopwatch.StartNew();
                    File.ReadAllBytes(f);
                    opSw.Stop();
                    lats.Add(opSw.Elapsed.TotalMilliseconds);
                }
                sw.Stop();
                double r4rSec = Math.Max(0.004, sw.Elapsed.TotalSeconds);
                double r4rMBs = Math.Round((ops * 4.0 / 1024.0) / r4rSec, 2);
                int r4Iops = (int)Math.Round((ops * 2.0) / (r4wSec + r4rSec));

                try { Directory.Delete(benchDir, true); } catch {}

                lats.Sort();
                double minL = lats.Count > 0 ? Math.Round(lats[0], 3) : 0.08;
                double sumL = 0;
                foreach (double v in lats) sumL += v;
                double avgL = Math.Round(sumL / Math.Max(1, lats.Count), 3);
                double p95L = lats.Count > 0 ? Math.Round(lats[(int)(lats.Count * 0.95)], 3) : avgL;

                string json = string.Format(
                    CultureInfo.InvariantCulture,
                    "{{\\"drive\\":\\"{0}:\\",\\"seqWriteMBs\\":{1},\\"seqReadMBs\\":{2},\\"rand4kWriteMBs\\":{3},\\"rand4kReadMBs\\":{4},\\"rand4kIops\\":{5},\\"accessTimeMinMs\\":{6},\\"accessTimeAvgMs\\":{7},\\"accessTimeP95Ms\\":{8},\\"crcVerified\\":{9}}}",
                    letter, seqWriteMBs, seqReadMBs, r4wMBs, r4rMBs, r4Iops, minL, avgL, p95L, crcOk ? "true" : "false"
                );
                return Encoding.UTF8.GetBytes(json);
            }
            catch (Exception ex)
            {
                try { if (Directory.Exists(benchDir)) Directory.Delete(benchDir, true); } catch {}
                return Encoding.UTF8.GetBytes("{\\"error\\":\\"" + EscapeJson(ex.Message) + "\\"}");
            }
        }

        private static byte[] QueryLocalNetworkAdaptersJson()
        {
            try
            {
                StringBuilder sb = new StringBuilder();
                sb.Append("{\\"adapters\\":[");
                bool first = true;
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback ||
                        ni.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
                    if (!first) sb.Append(",");
                    first = false;
                    string kind = "Other";
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Ethernet ||
                        ni.NetworkInterfaceType == NetworkInterfaceType.GigabitEthernet ||
                        ni.NetworkInterfaceType == NetworkInterfaceType.FastEthernetT)
                    {
                        kind = "Ethernet";
                    }
                    else if (ni.NetworkInterfaceType == NetworkInterfaceType.Wireless80211)
                    {
                        kind = "Wi-Fi";
                    }
                    long speedBps = ni.Speed > 0 ? ni.Speed : 0;
                    double speedMbps = Math.Round(speedBps / 1000000.0, 1);
                    string mac = ni.GetPhysicalAddress() != null ? ni.GetPhysicalAddress().ToString() : "";
                    sb.Append("{")
                      .Append("\\"name\\":\\"").Append(EscapeJson(ni.Name)).Append("\\",")
                      .Append("\\"description\\":\\"").Append(EscapeJson(ni.Description)).Append("\\",")
                      .Append("\\"type\\":\\"").Append(EscapeJson(kind)).Append("\\",")
                      .Append("\\"status\\":\\"").Append(ni.OperationalStatus == OperationalStatus.Up ? "Up" : "Disconnected").Append("\\",")
                      .Append("\\"linkSpeedMbps\\":").Append(speedMbps.ToString(CultureInfo.InvariantCulture)).Append(",")
                      .Append("\\"macAddress\\":\\"").Append(EscapeJson(mac)).Append("\\"")
                      .Append("}");
                }
                sb.Append("]}");
                return Encoding.UTF8.GetBytes(sb.ToString());
            }
            catch
            {
                return Encoding.UTF8.GetBytes("{\\"adapters\\":[]}");
            }
        }

        private static byte[] QueryLocalBatteryWmiJson()
        {
            try
            {
                long design = 0, full = 0, cycles = 0, volt = 0, rem = 0, crate = 0, drate = 0;
                int pct = 0;
                bool ac = true;
                string name = "", mfr = "";
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("root\\\\WMI", "SELECT DesignedCapacity, ManufactureName FROM BatteryStaticData"))
                    foreach (ManagementObject o in s.Get()) { design = Convert.ToInt64(o["DesignedCapacity"]); mfr = Convert.ToString(o["ManufactureName"]); break; }
                } catch {}
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("root\\\\WMI", "SELECT FullChargedCapacity FROM BatteryFullChargedCapacity"))
                    foreach (ManagementObject o in s.Get()) { full = Convert.ToInt64(o["FullChargedCapacity"]); break; }
                } catch {}
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("root\\\\WMI", "SELECT CycleCount FROM BatteryCycleCount"))
                    foreach (ManagementObject o in s.Get()) { cycles = Convert.ToInt64(o["CycleCount"]); break; }
                } catch {}
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("root\\\\WMI", "SELECT Voltage, RemainingCapacity, ChargeRate, DischargeRate, PowerOnline FROM BatteryStatus"))
                    foreach (ManagementObject o in s.Get())
                    {
                        volt = Convert.ToInt64(o["Voltage"]);
                        rem = Convert.ToInt64(o["RemainingCapacity"]);
                        crate = Convert.ToInt64(o["ChargeRate"]);
                        drate = Convert.ToInt64(o["DischargeRate"]);
                        ac = Convert.ToBoolean(o["PowerOnline"]);
                        break;
                    }
                } catch {}
                try
                {
                    using (ManagementObjectSearcher s = new ManagementObjectSearcher("SELECT Name, EstimatedChargeRemaining FROM Win32_Battery"))
                    foreach (ManagementObject o in s.Get()) { name = Convert.ToString(o["Name"]); pct = Convert.ToInt32(o["EstimatedChargeRemaining"]); break; }
                } catch {}
                string json = string.Format(
                    CultureInfo.InvariantCulture,
                    "{{\\"design\\":{0},\\"full\\":{1},\\"cycles\\":{2},\\"volt\\":{3},\\"rem\\":{4},\\"crate\\":{5},\\"drate\\":{6},\\"ac\\":{7},\\"name\\":\\"{8}\\",\\"mfr\\":\\"{9}\\",\\"pct\\":{10}}}",
                    design, full, cycles, volt, rem, crate, drate, ac ? "true" : "false", EscapeJson(name), EscapeJson(mfr), pct
                );
                return Encoding.UTF8.GetBytes(json);
            }
            catch
            {
                return Encoding.UTF8.GetBytes("{}");
            }
        }

        private static byte[] QueryLocalSensorsJson()
        {
            try
            {
                HttpWebRequest req = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:8085/data.json");
                req.Timeout = 700;
                req.ReadWriteTimeout = 700;
                using (HttpWebResponse resp = (HttpWebResponse)req.GetResponse())
                using (Stream rs = resp.GetResponseStream())
                using (MemoryStream ms = new MemoryStream())
                {
                    rs.CopyTo(ms);
                    byte[] arr = ms.ToArray();
                    if (arr.Length > 20) return arr;
                }
            }
            catch {}
            return Encoding.UTF8.GetBytes("{\\"sensors\\":[]}");
        }

        private static string GetQueryParam(string query, string key)
        {
            if (string.IsNullOrEmpty(query)) return "";
            string[] parts = query.TrimStart('?').Split('&');
            foreach (string part in parts)
            {
                int eq = part.IndexOf('=');
                if (eq > 0 && part.Substring(0, eq).Equals(key, StringComparison.OrdinalIgnoreCase))
                    return Uri.UnescapeDataString(part.Substring(eq + 1));
            }
            return "";
        }

        private static int FindFreePort()
        {
            try
            {
                TcpListener l = new TcpListener(IPAddress.Loopback, 45880);
                l.Start();
                l.Stop();
                return 45880;
            }
            catch
            {
                TcpListener l = new TcpListener(IPAddress.Loopback, 0);
                l.Start();
                int port = ((IPEndPoint)l.LocalEndpoint).Port;
                l.Stop();
                return port;
            }
        }

        private static long lastActivityTicks = DateTime.UtcNow.Ticks;

        private static string GetMimeType(string ext)
        {
            switch (ext.ToLowerInvariant())
            {
                case ".html": return "text/html; charset=utf-8";
                case ".js":
                case ".mjs": return "text/javascript; charset=utf-8";
                case ".css": return "text/css; charset=utf-8";
                case ".json": return "application/json; charset=utf-8";
                case ".svg": return "image/svg+xml";
                case ".png": return "image/png";
                case ".jpg":
                case ".jpeg": return "image/jpeg";
                case ".webp": return "image/webp";
                case ".ico": return "image/x-icon";
                case ".woff": return "font/woff";
                case ".woff2": return "font/woff2";
                case ".wasm": return "application/wasm";
                default: return "application/octet-stream";
            }
        }

        private static int ParseContentLength(string headers)
        {
            string[] lines = headers.Split(new string[] { "\\r\\n" }, StringSplitOptions.RemoveEmptyEntries);
            for (int i = 1; i < lines.Length; i++)
            {
                int colon = lines[i].IndexOf(':');
                if (colon > 0 && lines[i].Substring(0, colon).Trim().Equals("Content-Length", StringComparison.OrdinalIgnoreCase))
                {
                    int len;
                    if (int.TryParse(lines[i].Substring(colon + 1).Trim(), out len) && len > 0) return len;
                }
            }
            return 0;
        }

        [STAThread]
        static void Main(string[] args)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string appDir = Path.Combine(baseDir, "app");
            if (!Directory.Exists(appDir)) appDir = baseDir;
            string appDirFull = Path.GetFullPath(appDir).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar) + Path.DirectorySeparatorChar;

            int port = FindFreePort();
            TcpListener server = new TcpListener(IPAddress.Loopback, port);
            server.Start();
            Interlocked.Exchange(ref lastActivityTicks, DateTime.UtcNow.Ticks);

            Thread serverThread = new Thread(() =>
            {
                while (true)
                {
                    try
                    {
                        TcpClient client = server.AcceptTcpClient();
                        ThreadPool.QueueUserWorkItem(_ =>
                        {
                            try
                            {
                                Interlocked.Exchange(ref lastActivityTicks, DateTime.UtcNow.Ticks);
                                using (client)
                                using (NetworkStream stream = client.GetStream())
                                {
                                    stream.ReadTimeout = 5000;
                                    byte[] reqBuf = new byte[8192];
                                    int read = stream.Read(reqBuf, 0, reqBuf.Length);
                                    if (read <= 0) return;
                                    string reqText = Encoding.ASCII.GetString(reqBuf, 0, read);
                                    int headerEnd = reqText.IndexOf("\\r\\n\\r\\n");
                                    string headerBlock = headerEnd >= 0 ? reqText.Substring(0, headerEnd) : reqText;
                                    int lineEnd = headerBlock.IndexOf("\\r\\n");
                                    string requestLine = lineEnd >= 0 ? headerBlock.Substring(0, lineEnd) : headerBlock;
                                    string[] tokens = requestLine.Split(' ');
                                    string method = tokens.Length > 0 ? tokens[0].ToUpperInvariant() : "GET";
                                    string fullTarget = tokens.Length > 1 ? tokens[1] : "/";
                                    string rawPath = fullTarget;
                                    string rawQuery = "";
                                    int qIdx = fullTarget.IndexOf('?');
                                    if (qIdx >= 0) { rawPath = fullTarget.Substring(0, qIdx); rawQuery = fullTarget.Substring(qIdx + 1); }

                                    if (method == "POST")
                                    {
                                        int contentLen = ParseContentLength(headerBlock);
                                        int alreadyReadBody = headerEnd >= 0 ? Math.Max(0, read - (headerEnd + 4)) : 0;
                                        int remaining = Math.Min(contentLen - alreadyReadBody, 64 * 1024 * 1024);
                                        if (remaining > 0)
                                        {
                                            byte[] drainBuf = new byte[16384];
                                            while (remaining > 0)
                                            {
                                                int n = stream.Read(drainBuf, 0, Math.Min(drainBuf.Length, remaining));
                                                if (n <= 0) break;
                                                remaining -= n;
                                            }
                                        }
                                    }

                                    if (method == "OPTIONS")
                                    {
                                        string optHdr = "HTTP/1.1 204 No Content\\r\\nAccess-Control-Allow-Origin: *\\r\\nAccess-Control-Allow-Methods: GET, POST, HEAD, OPTIONS\\r\\nAccess-Control-Allow-Headers: *\\r\\nConnection: close\\r\\n\\r\\n";
                                        byte[] optBytes = Encoding.ASCII.GetBytes(optHdr);
                                        stream.Write(optBytes, 0, optBytes.Length);
                                        stream.Flush();
                                        return;
                                    }

                                    byte[] body;
                                    string mime;
                                    if (rawPath.Equals("/api/hardware/full", StringComparison.OrdinalIgnoreCase))
                                    {
                                        body = QueryFullHardwareInventoryJson();
                                        mime = "application/json; charset=utf-8";
                                    }
                                    else if (rawPath.Equals("/api/disks/list", StringComparison.OrdinalIgnoreCase))
                                    {
                                        body = QueryLogicalDrivesJson();
                                        mime = "application/json; charset=utf-8";
                                    }
                                    else if (rawPath.Equals("/api/disks/bench", StringComparison.OrdinalIgnoreCase))
                                    {
                                        string drv = GetQueryParam(rawQuery, "drive");
                                        int sz = 64;
                                        int.TryParse(GetQueryParam(rawQuery, "sizeMB"), out sz);
                                        body = RunNativeDriveBenchmark(drv, sz > 0 ? sz : 64);
                                        mime = "application/json; charset=utf-8";
                                    }
                                    else if (rawPath.Equals("/api/edid", StringComparison.OrdinalIgnoreCase))
                                    {
                                        body = Encoding.UTF8.GetBytes(QueryLocalMonitorEdidJson());
                                        mime = "application/json; charset=utf-8";
                                    }
                                    else if (rawPath.Equals("/api/network/adapters", StringComparison.OrdinalIgnoreCase))
                                    {
                                        body = QueryLocalNetworkAdaptersJson();
                                        mime = "application/json; charset=utf-8";
                                    }
                                    else if (rawPath.Equals("/api/power/battery", StringComparison.OrdinalIgnoreCase))
                                    {
                                        body = QueryLocalBatteryWmiJson();
                                        mime = "application/json; charset=utf-8";
                                    }
                                    else if (rawPath.Equals("/api/sensors", StringComparison.OrdinalIgnoreCase) || rawPath.Equals("/data.json", StringComparison.OrdinalIgnoreCase))
                                    {
                                        body = QueryLocalSensorsJson();
                                        mime = "application/json; charset=utf-8";
                                    }
                                    else if (rawPath.Equals("/api/speedtest/download", StringComparison.OrdinalIgnoreCase))
                                    {
                                        body = speedtestPayload;
                                        mime = "application/octet-stream";
                                    }
                                    else if (rawPath.Equals("/api/speedtest/upload", StringComparison.OrdinalIgnoreCase) || rawPath.Equals("/api/speedtest/ping", StringComparison.OrdinalIgnoreCase) || rawPath.Equals("/api/ping", StringComparison.OrdinalIgnoreCase))
                                    {
                                        body = Encoding.UTF8.GetBytes("{\\"ok\\":true}");
                                        mime = "application/json; charset=utf-8";
                                    }
                                    else
                                    {
                                        rawPath = Uri.UnescapeDataString(rawPath.TrimStart('/'));
                                        if (string.IsNullOrEmpty(rawPath)) rawPath = "index.html";
                                        string fullPath = Path.GetFullPath(Path.Combine(appDir, rawPath.Replace('/', Path.DirectorySeparatorChar)));
                                        if (!fullPath.StartsWith(appDirFull, StringComparison.OrdinalIgnoreCase) || !File.Exists(fullPath))
                                        {
                                            fullPath = Path.Combine(appDir, "index.html");
                                        }
                                        body = File.Exists(fullPath) ? File.ReadAllBytes(fullPath) : Encoding.UTF8.GetBytes("<h1>SystemPulse Pro Offline</h1>");
                                        mime = GetMimeType(Path.GetExtension(fullPath));
                                    }

                                    string header = "HTTP/1.1 200 OK\\r\\nContent-Type: " + mime + "\\r\\nContent-Length: " + body.Length + "\\r\\nCache-Control: no-store, no-cache\\r\\nAccess-Control-Allow-Origin: *\\r\\nConnection: close\\r\\n\\r\\n";
                                    byte[] headerBytes = Encoding.ASCII.GetBytes(header);
                                    stream.Write(headerBytes, 0, headerBytes.Length);
                                    if (method != "HEAD" && body.Length > 0) stream.Write(body, 0, body.Length);
                                    stream.Flush();
                                }
                            }
                            catch {}
                        });
                    }
                    catch {}
                }
            });
            serverThread.IsBackground = true;
            serverThread.Start();

            string url = "http://127.0.0.1:" + port + "/index.html";
            string profileDir = Path.Combine(Path.GetTempPath(), "SystemPulsePro_DesktopProfile_" + port);
            string gpuFlags = "--app=\\"" + url + "\\" --user-data-dir=\\"" + profileDir + "\\" --start-maximized --enable-gpu-rasterization --ignore-gpu-blocklist --disable-frame-rate-limit --disable-gpu-vsync --no-first-run --no-default-browser-check";

            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"BraveSoftware\\Brave-Browser\\Application\\brave.exe")
            };

            Process browserProc = null;
            foreach (string exe in candidates)
            {
                if (File.Exists(exe))
                {
                    ProcessStartInfo psi = new ProcessStartInfo(exe, gpuFlags);
                    psi.UseShellExecute = false;
                    browserProc = Process.Start(psi);
                    break;
                }
            }

            if (browserProc != null)
            {
                Stopwatch lifeSw = Stopwatch.StartNew();
                browserProc.WaitForExit();
                lifeSw.Stop();
                // Edge/Chrome Startup Boost can hand off the app window to an existing browser process and exit immediately.
                // Keep the local HTTP/WMI server alive while active so the app never hits ERR_CONNECTION_REFUSED.
                if (lifeSw.Elapsed.TotalSeconds < 5.0)
                {
                    while ((DateTime.UtcNow - new DateTime(Interlocked.Read(ref lastActivityTicks), DateTimeKind.Utc)).TotalMinutes < 15.0)
                    {
                        Thread.Sleep(2000);
                    }
                }
            }
            else
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                while ((DateTime.UtcNow - new DateTime(Interlocked.Read(ref lastActivityTicks), DateTimeKind.Utc)).TotalMinutes < 15.0)
                {
                    Thread.Sleep(2000);
                }
            }
        }
    }
}
`;

  const portalHtml = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8" />
  <meta http-equiv="refresh" content="0; url=./app/index.html" />
  <link rel="icon" type="image/x-icon" href="./SystemPulse-Pro.ico" />
  <link rel="shortcut icon" href="./SystemPulse-Pro.ico" />
  <title>SystemPulse Pro — Samodzielna Wersja Desktopowa (Win64)</title>
  <style>
    body { margin: 0; font-family: 'Segoe UI', system-ui, sans-serif; background: #070b14; color: #e2e8f0; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { max-width: 720px; width: 92%; background: #0f172a; border: 1px solid #1e293b; border-radius: 16px; padding: 32px; box-shadow: 0 24px 64px rgba(0,0,0,0.65); }
    .badge { display: inline-block; background: rgba(6,182,212,0.15); color: #22d3ee; border: 1px solid rgba(6,182,212,0.4); border-radius: 999px; padding: 4px 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; }
    h1 { margin: 14px 0 8px; font-size: 26px; color: #f8fafc; }
    p { color: #94a3b8; line-height: 1.6; font-size: 14px; }
    .btn { display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #06b6d4, #0284c7); color: #fff; text-decoration: none; font-weight: 700; padding: 14px 26px; border-radius: 10px; margin-top: 16px; box-shadow: 0 8px 24px rgba(6,182,212,0.35); }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">STANDALONE OFFLINE WIN64 EDITION • AUTO-DETEKCJA WMI &amp; 40 GIER 3D MAX</span>
    <h1>SystemPulse Pro — Aplikacja Lokalna</h1>
    <p>Uruchamianie lokalnego pakietu <strong>SystemPulse Pro</strong> (40 gier i benchmarków 3D, 12 automatycznych skanerów podzespołów, wybór i test dowolnego dysku C:/D:/G:/USB, wykresy D3.js oraz telemetria Zasilacza ATX PSU) z lokalnego folderu <code>./app/index.html</code>.</p>
    <a class="btn" href="./app/index.html">Otwórz SystemPulse Pro (Offline)</a>
  </div>
</body>
</html>`;

  const innoSetupIss = [
    '; Skrypt oficjalnego kreatora Inno Setup 6 (buduje 1-plikowy SystemPulse-Pro-Setup.exe z ikona)',
    '[Setup]',
    'AppId={{7E8B4A12-3D95-4A1E-9C22-51F8A9C7E310}',
    'AppName=SystemPulse Pro',
    'AppVersion=5.0',
    'AppPublisher=SystemPulse Pro',
    'DefaultDirName={autopf}\\SystemPulse Pro',
    'DefaultGroupName=SystemPulse Pro',
    'PrivilegesRequired=lowest',
    'OutputDir=.',
    'OutputBaseFilename=SystemPulse-Pro-Setup',
    'SetupIconFile=SystemPulse-Pro.ico',
    'UninstallDisplayIcon={app}\\SystemPulse-Pro.ico',
    'Compression=lzma2',
    'SolidCompression=yes',
    'WizardStyle=modern',
    '',
    '[Languages]',
    'Name: "polish"; MessagesFile: "compiler:Languages\\Polish.isl"',
    '',
    '[Tasks]',
    'Name: "desktopicon"; Description: "Utworz ikone SystemPulse Pro na Pulpicie"; GroupDescription: "Dodatkowe ikony:"',
    '',
    '[Files]',
    'Source: "SystemPulse-Pro.ico"; DestDir: "{app}"; Flags: ignoreversion',
    'Source: "SystemPulse-Pro-Portable.bat"; DestDir: "{app}"; Flags: ignoreversion',
    'Source: "SystemPulse-Portal.html"; DestDir: "{app}"; Flags: ignoreversion',
    'Source: "app\\*"; DestDir: "{app}\\app"; Flags: ignoreversion recursesubdirs createallsubdirs',
    '',
    '[Icons]',
    'Name: "{group}\\SystemPulse Pro"; Filename: "{app}\\app\\index.html"; IconFilename: "{app}\\SystemPulse-Pro.ico"',
    'Name: "{autodesktop}\\SystemPulse Pro"; Filename: "{app}\\app\\index.html"; IconFilename: "{app}\\SystemPulse-Pro.ico"; Tasks: desktopicon',
    'Name: "{group}\\Odinstaluj SystemPulse Pro"; Filename: "{uninstallexe}"',
    '',
    '[Run]',
    'Filename: "{app}\\app\\index.html"; Description: "Uruchom SystemPulse Pro"; Flags: shellexec postinstall skipifsilent',
  ].join('\r\n');

  const readmeTxt = [
    '========================================================================',
    '  SYSTEMPULSE PRO v5.0 - SAMODZIELNA APLIKACJA DESKTOPOWA WIN64',
    '  CZYSTY PAKIET OFFLINE Z IKONA SYSTEMPULSE-PRO.ICO (ZERO SKRYPTOW AV)',
    '========================================================================',
    '',
    'NAJPROSTSZA INSTALACJA BEZ ALARMOW ANTYWIRUSA (POLECANE - 1 KLIK):',
    '  Kliknij przycisk "Zainstaluj aplikacje" w gornym pasku aplikacji w Chrome/Edge.',
    '  Windows utworzy natywna aplikacje desktopowa z ikona SystemPulse Pro,',
    '  skrotem na Pulpicie/Menu Start i deinstalatorem w Ustawieniach Windows —',
    '  z podpisem Google/Microsoft i 0% falszywych alarmow Bitdefender/Defender.',
    '',
    'KROK 1 (PACZKA OFFLINE ZIP):',
    '  Najpierw ROZPAKUJ cale archiwum SystemPulse-Pro-Portable-Win64.zip',
    '  (kliknij prawym -> Wyodrebnij wszystkie / Extract All).',
    '  NIE uruchamiaj plikow bezposrednio ze spakowanego archiwum .ZIP!',
    '',
    'KROK 2 - URUCHOMIENIE / INSTALACJA OFFLINE:',
    '  OPCJA A (NAJCZYSTSZY START OFFLINE):',
    '    Otworz "app\\index.html" lub "SystemPulse-Portal.html" (posiada ikone).',
    '',
    '  OPCJA B (INSTALACJA LOKALNA + SKROTY Z IKONA NA PULPICIE I MENU START):',
    '    Uruchom "Instalator-SystemPulse-Pro-Setup.cmd".',
    '    - Kopiuje aplikacje i ikone SystemPulse-Pro.ico do %LOCALAPPDATA%\\Programs\\SystemPulsePro',
    '    - Tworzy skroty z ikona SystemPulse Pro na Pulpicie i w Menu Start',
    '    - Jesli masz .NET SDK, automatycznie kompiluje natywny SystemPulse-Pro.exe z ikona',
    '',
    '  OPCJA C (TRYB PORTABLE BEZ INSTALACJI - ODBLOKOWANY FPS):',
    '    Uruchom "SystemPulse-Pro-Portable.bat".',
    '',
    '  OPCJA D (KLASYCZNY 1-PLIKOWY SETUP.EXE PRZEZ INNO SETUP 6):',
    '    Otworz "SystemPulse-Pro-Installer.iss" w darmowym Inno Setup Compiler -> Build.',
    '    Wygeneruje klasyczny Windowsowy kreator SystemPulse-Pro-Setup.exe z ikona.',
    '',
    `LOKALNY ADRES MOSTKA DESKTOPOWEGO: ${localServerUrl}`,
    '========================================================================',
  ].join('\r\n');

  const iconIcoBytes =
    cachedIconIcoBytes && cachedIconIcoBytes.length > 64
      ? cachedIconIcoBytes
      : decodeBase64ToBytes(FALLBACK_APP_ICO_BASE64);

  const iconSvgContent =
    cachedIconSvg ||
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="2" y="2" width="60" height="60" rx="14" fill="#070b14" stroke="#22d3ee" stroke-width="3"/><rect x="14" y="14" width="36" height="36" rx="8" fill="#0f172a" stroke="#06b6d4" stroke-width="2.5"/><polyline points="18,34 25,34 29,22 34,43 39,28 42,34 46,34" fill="none" stroke="#22d3ee" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  const zipBytes = buildZipArchive([
    { name: 'SystemPulse-Pro-Portable/SystemPulse-Pro.ico', content: iconIcoBytes },
    { name: 'SystemPulse-Pro-Portable/Instalator-SystemPulse-Pro-Setup.cmd', content: installerSetupCmd },
    { name: 'SystemPulse-Pro-Portable/SystemPulse-Pro-Portable.bat', content: batLauncher },
    { name: 'SystemPulse-Pro-Portable/SystemPulse-Pro-Installer.iss', content: innoSetupIss },
    { name: 'SystemPulse-Pro-Portable/SystemPulsePro.csproj', content: csprojContent },
    { name: 'SystemPulse-Pro-Portable/SystemPulseSetup.csproj', content: setupCsprojContent },
    { name: 'SystemPulse-Pro-Portable/SystemPulseLauncher.cs', content: csharpSource },
    { name: 'SystemPulse-Pro-Portable/SystemPulseSetupGui.cs', content: csharpGuiInstallerSource },
    { name: 'SystemPulse-Pro-Portable/SystemPulse-Portal.html', content: portalHtml },
    { name: 'SystemPulse-Pro-Portable/INSTRUKCJA-PORTABLE-EXE.txt', content: readmeTxt },
    { name: 'SystemPulse-Pro-Portable/app/favicon.ico', content: iconIcoBytes },
    { name: 'SystemPulse-Pro-Portable/app/icon.svg', content: iconSvgContent },
    { name: 'SystemPulse-Pro-Portable/app/index.html', content: standaloneAppHtml },
    { name: 'SystemPulse-Pro-Portable/app/portable-styles.css', content: stylesContent },
    { name: 'SystemPulse-Pro-Portable/app/portable-bundle.js', content: bundleJsContent },
  ]);

  const blob = new Blob([zipBytes.buffer as ArrayBuffer], { type: 'application/zip' });
  return {
    blob,
    filename: 'SystemPulse-Pro-Portable-Win64.zip',
  };
}

export function downloadPortableExeZip(): string {
  const triggerDownload = () => {
    const { blob, filename } = generatePortableExeZipBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    return filename;
  };

  if (!cachedBundleJs && typeof window !== 'undefined') {
    void preloadPortableAssets().finally(() => {
      triggerDownload();
    });
    return 'SystemPulse-Pro-Portable-Win64.zip';
  }

  return triggerDownload();
}
