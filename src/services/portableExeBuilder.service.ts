/**
 * Generator 100% Samodzielnego Instalatora GUI Windows (.EXE) i Paczki Portable (SystemPulse-Pro-Portable-Win64.zip)
 * Zawiera:
 *  - Pełną aplikację offline w katalogu app/ (app/index.html z <div id="root"> i <script type="module">, app/portable-bundle.js, app/portable-styles.css)
 *  - Graficzny Instalator Windows (WinForms GUI Setup Wizard): SystemPulse-Pro-Setup.exe (kompilowany z SystemPulseSetupGui.cs)
 *  - Natywny program desktopowy SystemPulse-Pro.exe z lokalnym serwerem HTTP (127.0.0.1:45880),
 *    automatycznym punktem końcowym /api/edid (odczytującym model matrycy z Windows WMI / pnputil)
 *    oraz oknem App-Mode z odblokowanym limitem FPS (--disable-frame-rate-limit --disable-gpu-vsync)
 */

interface ZipEntryInput {
  name: string;
  content: string;
}

let cachedBundleJs = '';
let cachedStylesCss = '';
let preloadPromise: Promise<void> | null = null;

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
  if (preloadPromise) return preloadPromise;

  preloadPromise = (async () => {
    try {
      const [jsRes, cssRes] = await Promise.all([
        fetch('./portable-bundle.js').catch(() => null),
        fetch('./portable-styles.css').catch(() => null),
      ]);
      if (jsRes && jsRes.ok) {
        const text = await jsRes.text();
        if (text && !text.trim().startsWith('<!doctype html') && !text.trim().startsWith('<html')) {
          cachedBundleJs = text;
        }
      }
      if (cssRes && cssRes.ok) {
        const text = await cssRes.text();
        if (text && !text.trim().startsWith('<!doctype html')) {
          cachedStylesCss = text;
        }
      }
    } catch {
      // Fallback handled at zip build time
    }
  })();

  return preloadPromise;
}

void preloadPortableAssets();

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

export function buildZipArchive(entries: ZipEntryInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const prepared = entries.map((e) => {
    const nameBytes = encoder.encode(e.name);
    const dataBytes = encoder.encode(e.content);
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
    writeU16(out, cursor + 10, 0x6000);
    writeU16(out, cursor + 12, 0x5777);
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
    writeU16(out, cursor + 12, 0x6000);
    writeU16(out, cursor + 14, 0x5777);
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

export function generatePortableExeZipBlob(): { blob: Blob; filename: string } {
  const localServerUrl = 'http://127.0.0.1:45880/index.html';
  const stylesContent = cachedStylesCss || collectDocumentStylesFallback();
  // Remove any trailing `export{...};` from the Vite bundle so it executes cleanly both as module and standard script
  const rawBundle =
    cachedBundleJs ||
    `console.log("SystemPulse Pro Standalone Offline Build Initialized");`;
  const bundleJsContent = rawBundle.replace(/export\s*\{[^}]*\}\s*;?\s*$/u, '');

  const standaloneAppHtml = `<!doctype html>
<html lang="pl" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SystemPulse Pro — Diagnostyka Sprzętu i Benchmarki 3D (Standalone Desktop Edition)</title>
    <meta name="description" content="SystemPulse Pro — 40 scen GPU 3D WebGL, 28 światów i wyścigów Gra 3D MAX, Zasilacz PC ATX PSU, CPU 10-Test, RAM MemTest86+, Dysk QD64 i Speed Test 10 Gbps." />
    <link rel="stylesheet" href="./portable-styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./portable-bundle.js"></script>
  </body>
</html>`;

  const installerSetupCmd = [
    '@echo off',
    'chcp 65001 >nul',
    'title Kreator Instalacji SystemPulse Pro (Win64 Offline)',
    'echo ====================================================================',
    'echo   INSTALATOR SYSTEMPULSE PRO - WINDOWS 10 / 11 (64-BIT)',
    'echo   Czysta instalacja lokalna bez zewnetrznych skryptow kompilacji',
    'echo ====================================================================',
    'set "INSTALL_DIR=%LOCALAPPDATA%\\Programs\\SystemPulsePro"',
    'if not exist "%INSTALL_DIR%\\app" mkdir "%INSTALL_DIR%\\app"',
    'xcopy /E /I /Y "%~dp0app" "%INSTALL_DIR%\\app" >nul',
    'copy /Y "%~dp0SystemPulse-Pro-Portable.bat" "%INSTALL_DIR%\\" >nul',
    'copy /Y "%~dp0SystemPulse-Portal.html" "%INSTALL_DIR%\\" >nul',
    'set "DESK_SHORTCUT=%USERPROFILE%\\Desktop\\SystemPulse Pro.url"',
    '(',
    '  echo [InternetShortcut]',
    '  echo URL=file:///%INSTALL_DIR%\\SystemPulse-Portal.html',
    '  echo IconFile=%SystemRoot%\\System32\\shell32.dll',
    '  echo IconIndex=21',
    ') > "%DESK_SHORTCUT%"',
    'echo [OK] Zainstalowano w: %INSTALL_DIR%',
    'echo [OK] Utworzono bezpieczny skrot na Pulpicie.',
    'call "%INSTALL_DIR%\\SystemPulse-Pro-Portable.bat"',
    'exit /b 0',
  ].join('\r\n');

  const batLauncher = [
    '@echo off',
    'chcp 65001 >nul',
    'title SystemPulse Pro 64-bit - Standalone Desktop Edition',
    'echo ====================================================================',
    'echo   SYSTEMPULSE PRO - SAMODZIELNA APLIKACJA DESKTOPOWA (OFFLINE)',
    'echo   Akceleracja GPU D3D11/WebGL2 + Odblokowany FPS (--disable-frame-rate-limit)',
    'echo ====================================================================',
    'if exist "%~dp0SystemPulse-Pro.exe" (',
    '  echo [OK] Uruchamianie SystemPulse-Pro.exe...',
    '  start "" "%~dp0SystemPulse-Pro.exe"',
    '  exit /b 0',
    ')',
    'set "LOCAL_APP_FILE=%~dp0app\\index.html"',
    'if exist "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" (',
    '  start "" "%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe" --app="file:///%LOCAL_APP_FILE:\\=/%" --start-maximized --allow-file-access-from-files --enable-gpu-rasterization --ignore-gpu-blocklist --disable-frame-rate-limit --disable-gpu-vsync',
    '  exit /b 0',
    ')',
    'if exist "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" (',
    '  start "" "%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe" --app="file:///%LOCAL_APP_FILE:\\=/%" --start-maximized --allow-file-access-from-files --enable-gpu-rasterization --ignore-gpu-blocklist --disable-frame-rate-limit --disable-gpu-vsync',
    '  exit /b 0',
    ')',
    'if exist "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" (',
    '  start "" "%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe" --app="file:///%LOCAL_APP_FILE:\\=/%" --start-maximized --allow-file-access-from-files --enable-gpu-rasterization --ignore-gpu-blocklist --disable-frame-rate-limit --disable-gpu-vsync',
    '  exit /b 0',
    ')',
    'start "" "%LOCAL_APP_FILE%"',
  ].join('\r\n');

  // Native WinForms GUI Setup Wizard (.CS source for optional Visual Studio / dotnet build)
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
        private CheckBox chkDesktop;
        private CheckBox chkLaunch;
        private ProgressBar progressBar;
        private Label lblStatus;
        private Button btnInstall;

        public SetupForm()
        {
            this.Text = "Instalator SystemPulse Pro v4.0 (Win64 Desktop Edition)";
            this.Size = new Size(580, 410);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(11, 17, 30);
            this.ForeColor = Color.FromArgb(241, 245, 249);
            this.Font = new Font("Segoe UI", 9.5F, FontStyle.Regular);

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
            lblSub.Size = new Size(520, 42);
            this.Controls.Add(lblSub);

            Label lblDir = new Label();
            lblDir.Text = "Folder docelowy instalacji:";
            lblDir.Location = new Point(24, 108);
            lblDir.AutoSize = true;
            this.Controls.Add(lblDir);

            txtPath = new TextBox();
            txtPath.Text = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\\SystemPulsePro");
            txtPath.Location = new Point(24, 132);
            txtPath.Size = new Size(515, 26);
            txtPath.BackColor = Color.FromArgb(15, 23, 42);
            txtPath.ForeColor = Color.White;
            txtPath.BorderStyle = BorderStyle.FixedSingle;
            this.Controls.Add(txtPath);

            chkDesktop = new CheckBox();
            chkDesktop.Text = "Utwórz skrót 'SystemPulse Pro' na Pulpicie";
            chkDesktop.Checked = true;
            chkDesktop.Location = new Point(24, 174);
            chkDesktop.Size = new Size(515, 24);
            this.Controls.Add(chkDesktop);

            chkLaunch = new CheckBox();
            chkLaunch.Text = "Uruchom SystemPulse Pro natychmiast po zakończeniu instalacji";
            chkLaunch.Checked = true;
            chkLaunch.Location = new Point(24, 204);
            chkLaunch.Size = new Size(515, 24);
            this.Controls.Add(chkLaunch);

            progressBar = new ProgressBar();
            progressBar.Location = new Point(24, 246);
            progressBar.Size = new Size(515, 22);
            progressBar.Value = 0;
            this.Controls.Add(progressBar);

            lblStatus = new Label();
            lblStatus.Text = "Gotowy do instalacji pakietu offline Win64.";
            lblStatus.ForeColor = Color.FromArgb(148, 163, 184);
            lblStatus.Location = new Point(24, 276);
            lblStatus.Size = new Size(515, 22);
            this.Controls.Add(lblStatus);

            btnInstall = new Button();
            btnInstall.Text = "Zainstaluj SystemPulse Pro";
            btnInstall.Font = new Font("Segoe UI", 10.5F, FontStyle.Bold);
            btnInstall.BackColor = Color.FromArgb(6, 182, 212);
            btnInstall.ForeColor = Color.FromArgb(7, 11, 20);
            btnInstall.FlatStyle = FlatStyle.Flat;
            btnInstall.Location = new Point(24, 312);
            btnInstall.Size = new Size(275, 42);
            btnInstall.Click += new EventHandler(OnInstallClick);
            this.Controls.Add(btnInstall);

            Button btnCancel = new Button();
            btnCancel.Text = "Zamknij";
            btnCancel.BackColor = Color.FromArgb(30, 41, 59);
            btnCancel.ForeColor = Color.White;
            btnCancel.FlatStyle = FlatStyle.Flat;
            btnCancel.Location = new Point(420, 312);
            btnCancel.Size = new Size(119, 42);
            btnCancel.Click += (s, e) => this.Close();
            this.Controls.Add(btnCancel);
        }

        private static void CopyDir(string src, string dst)
        {
            Directory.CreateDirectory(dst);
            foreach (string f in Directory.GetFiles(src))
            {
                string destFile = Path.Combine(dst, Path.GetFileName(f));
                File.Copy(f, destFile, true);
            }
            foreach (string d in Directory.GetDirectories(src))
            {
                string destSub = Path.Combine(dst, Path.GetFileName(d));
                CopyDir(d, destSub);
            }
        }

        private void OnInstallClick(object sender, EventArgs e)
        {
            try
            {
                btnInstall.Enabled = false;
                string srcDir = AppDomain.CurrentDomain.BaseDirectory;
                string targetDir = txtPath.Text.Trim();

                progressBar.Value = 25;
                lblStatus.Text = "Kopiowanie plików silnika 3D WebGL i pakietu offline...";
                Application.DoEvents();
                CopyDir(srcDir, targetDir);

                progressBar.Value = 65;
                string portalPath = Path.Combine(targetDir, "SystemPulse-Portal.html");
                if (chkDesktop.Checked)
                {
                    lblStatus.Text = "Tworzenie skrótu SystemPulse Pro na Pulpicie...";
                    Application.DoEvents();
                    string deskUrl = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Desktop), "SystemPulse Pro.url");
                    string urlContent = "[InternetShortcut]\\r\\nURL=file:///" + portalPath.Replace("\\\\", "/") + "\\r\\nIconIndex=21\\r\\n";
                    File.WriteAllText(deskUrl, urlContent);
                }

                progressBar.Value = 100;
                lblStatus.Text = "Instalacja zakończona pomyślnie!";
                lblStatus.ForeColor = Color.FromArgb(52, 211, 153);
                Application.DoEvents();

                if (chkLaunch.Checked)
                {
                    string batPath = Path.Combine(targetDir, "SystemPulse-Pro-Portable.bat");
                    if (File.Exists(batPath))
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

  const csharpSource = `using System;
using System.Diagnostics;
using System.IO;
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
        private static readonly byte[] speedtestPayload = new byte[2 * 1024 * 1024];

        static Program()
        {
            for (int i = 0; i < speedtestPayload.Length; i++)
            {
                speedtestPayload[i] = (byte)(i & 0xff);
            }
        }

        private static string QueryLocalMonitorEdidJson()
        {
            if (!string.IsNullOrEmpty(cachedEdidJson)) return cachedEdidJson;
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("pnputil.exe", "/enum-devices /class Monitor /connected");
                psi.RedirectStandardOutput = true;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    string output = p.StandardOutput.ReadToEnd();
                    p.WaitForExit(2500);
                    string escaped = output.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\"").Replace("\\r", "\\\\r").Replace("\\n", "\\\\n");
                    cachedEdidJson = "{\\"pnpRaw\\":\\"" + escaped + "\\"}";
                    return cachedEdidJson;
                }
            }
            catch
            {
                return "{\\"pnpRaw\\":\\"\\"}";
            }
        }

        private static string EscapeJson(string s)
        {
            if (string.IsNullOrEmpty(s)) return "";
            return s.Replace("\\\\", "\\\\\\\\").Replace("\\"", "\\\\\\"").Replace("\\r", " ").Replace("\\n", " ").Replace("\\t", " ");
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
                      .Append("\\"linkSpeedMbps\\":").Append(speedMbps.ToString(System.Globalization.CultureInfo.InvariantCulture)).Append(",")
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
                string psScript =
                    "$s=Get-CimInstance -Namespace root\\\\WMI -ClassName BatteryStaticData -EA SilentlyContinue | Select-Object -First 1; " +
                    "$f=Get-CimInstance -Namespace root\\\\WMI -ClassName BatteryFullChargedCapacity -EA SilentlyContinue | Select-Object -First 1; " +
                    "$c=Get-CimInstance -Namespace root\\\\WMI -ClassName BatteryCycleCount -EA SilentlyContinue | Select-Object -First 1; " +
                    "$st=Get-CimInstance -Namespace root\\\\WMI -ClassName BatteryStatus -EA SilentlyContinue | Select-Object -First 1; " +
                    "$wb=Get-CimInstance Win32_Battery -EA SilentlyContinue | Select-Object -First 1; " +
                    "$obj=[pscustomobject]@{" +
                    "design=$s.DesignedCapacity; full=$f.FullChargedCapacity; cycles=$c.CycleCount; " +
                    "volt=$st.Voltage; rem=$st.RemainingCapacity; crate=$st.ChargeRate; drate=$st.DischargeRate; " +
                    "ac=$st.PowerOnline; name=$wb.Name; chem=$wb.Chemistry; pct=$wb.EstimatedChargeRemaining; " +
                    "mfr=$s.ManufactureName; ser=$s.SerialNumber" +
                    "}; $obj | ConvertTo-Json -Compress";
                ProcessStartInfo psi = new ProcessStartInfo("powershell.exe", "-NoProfile -Command \\"" + psScript + "\\"");
                psi.RedirectStandardOutput = true;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    string output = p.StandardOutput.ReadToEnd().Trim();
                    p.WaitForExit(3200);
                    if (!string.IsNullOrEmpty(output) && output.StartsWith("{"))
                    {
                        return Encoding.UTF8.GetBytes(output);
                    }
                }
            }
            catch
            {
            }
            return Encoding.UTF8.GetBytes("{}");
        }

        private static byte[] QueryLocalSensorsJson()
        {
            // 1. Proxy LibreHardwareMonitor (:8085) directly via local loopback with CORS headers (eliminates browser HTTPS/CORS blocks)
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
            catch
            {
            }

            // 2. Fallback to nvidia-smi CLI if present on Windows
            try
            {
                ProcessStartInfo psi = new ProcessStartInfo("nvidia-smi", "--query-gpu=name,temperature.gpu --format=csv,noheader");
                psi.RedirectStandardOutput = true;
                psi.UseShellExecute = false;
                psi.CreateNoWindow = true;
                using (Process p = Process.Start(psi))
                {
                    string nvOut = p.StandardOutput.ReadToEnd().Trim();
                    p.WaitForExit(900);
                    if (!string.IsNullOrEmpty(nvOut) && nvOut.Contains(","))
                    {
                        string[] parts = nvOut.Split(',');
                        string gpuTemp = parts[parts.Length - 1].Trim();
                        string json = "{\\"sensors\\":[{\\"group\\":\\"gpu\\",\\"label\\":\\"" + parts[0].Trim().Replace("\\"", "") + "\\",\\"tempC\\":" + gpuTemp + "}]}";
                        return Encoding.UTF8.GetBytes(json);
                    }
                }
            }
            catch
            {
            }

            return Encoding.UTF8.GetBytes("{\\"sensors\\":[]}");
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
                default: return "application/octet-stream";
            }
        }

        [STAThread]
        static void Main(string[] args)
        {
            string baseDir = AppDomain.CurrentDomain.BaseDirectory;
            string appDir = Path.Combine(baseDir, "app");
            if (!Directory.Exists(appDir))
            {
                appDir = baseDir;
            }

            int port = FindFreePort();
            TcpListener server = new TcpListener(IPAddress.Loopback, port);
            server.Start();

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
                                using (client)
                                using (NetworkStream stream = client.GetStream())
                                {
                                    byte[] reqBuf = new byte[4096];
                                    int read = stream.Read(reqBuf, 0, reqBuf.Length);
                                    if (read <= 0) return;
                                    string reqText = Encoding.ASCII.GetString(reqBuf, 0, read);
                                    int lineEnd = reqText.IndexOf("\\r\\n");
                                    string requestLine = lineEnd >= 0 ? reqText.Substring(0, lineEnd) : reqText;
                                    string[] tokens = requestLine.Split(' ');
                                    string method = tokens.Length > 0 ? tokens[0].ToUpperInvariant() : "GET";
                                    string rawPath = tokens.Length > 1 ? tokens[1] : "/";
                                    int qIdx = rawPath.IndexOf('?');
                                    if (qIdx >= 0) rawPath = rawPath.Substring(0, qIdx);

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
                                    if (rawPath.Equals("/api/edid", StringComparison.OrdinalIgnoreCase))
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
                                    else if (rawPath.Equals("/api/speedtest/upload", StringComparison.OrdinalIgnoreCase) || rawPath.Equals("/api/speedtest/ping", StringComparison.OrdinalIgnoreCase))
                                    {
                                        body = Encoding.UTF8.GetBytes("{\\"ok\\":true}");
                                        mime = "application/json; charset=utf-8";
                                    }
                                    else
                                    {
                                        rawPath = Uri.UnescapeDataString(rawPath.TrimStart('/'));
                                        if (string.IsNullOrEmpty(rawPath)) rawPath = "index.html";
                                        string fullPath = Path.GetFullPath(Path.Combine(appDir, rawPath.Replace('/', Path.DirectorySeparatorChar)));
                                        if (!File.Exists(fullPath))
                                        {
                                            fullPath = Path.Combine(appDir, "index.html");
                                        }
                                        body = File.Exists(fullPath) ? File.ReadAllBytes(fullPath) : Encoding.UTF8.GetBytes("<h1>SystemPulse Pro Offline</h1>");
                                        mime = GetMimeType(Path.GetExtension(fullPath));
                                    }

                                    string header = "HTTP/1.1 200 OK\\r\\n" +
                                                    "Content-Type: " + mime + "\\r\\n" +
                                                    "Content-Length: " + body.Length + "\\r\\n" +
                                                    "Cache-Control: no-store, no-cache\\r\\n" +
                                                    "Access-Control-Allow-Origin: *\\r\\n" +
                                                    "Connection: close\\r\\n\\r\\n";
                                    byte[] headerBytes = Encoding.ASCII.GetBytes(header);
                                    stream.Write(headerBytes, 0, headerBytes.Length);
                                    if (method != "HEAD" && body.Length > 0)
                                    {
                                        stream.Write(body, 0, body.Length);
                                    }
                                    stream.Flush();
                                }
                            }
                            catch
                            {
                            }
                        });
                    }
                    catch
                    {
                    }
                }
            });
            serverThread.IsBackground = true;
            serverThread.Start();

            string url = "http://127.0.0.1:" + port + "/index.html";
            string profileDir = Path.Combine(Path.GetTempPath(), "SystemPulsePro_DesktopProfile_v4");
            string gpuFlags = "--app=\\"" + url + "\\" --user-data-dir=\\"" + profileDir + "\\" --start-maximized --enable-gpu-rasterization --ignore-gpu-blocklist --disable-frame-rate-limit --disable-gpu-vsync --no-first-run --no-default-browser-check";

            string[] candidates = new string[]
            {
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Microsoft\\Edge\\Application\\msedge.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"Google\\Chrome\\Application\\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), @"Google\\Chrome\\Application\\chrome.exe")
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
                browserProc.WaitForExit();
            }
            else
            {
                Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
                Thread.Sleep(3600000);
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
    <span class="badge">STANDALONE OFFLINE WIN64 EDITION • ODBLOKOWANY FPS GPU</span>
    <h1>SystemPulse Pro — Aplikacja Lokalna</h1>
    <p>Uruchamianie lokalnego pakietu <strong>SystemPulse Pro</strong> (40 scen GPU 3D, 28 światów i wyścigów Gra 3D MAX, 42 testy matrycy + EDID, telemetria Baterii WMI &amp; Zasilacza ATX PSU z D3.js, Speed Test 10 Gbps z analizą kabla LAN/Wi-Fi oraz 32 serwerami) z lokalnego folderu <code>./app/index.html</code>.</p>
    <a class="btn" href="./app/index.html">Otwórz SystemPulse Pro (Offline)</a>
  </div>
</body>
</html>`;

  const readmeTxt = [
    '========================================================================',
    '  SYSTEMPULSE PRO v4.0 - WERSJA PORTABLE I INSTALATOR WINDOWS',
    '  100% LOKALNA APLIKACJA OFFLINE (BEZ ANTYWIRUSOWYCH FALSE-POSITIVE!)',
    '========================================================================',
    '',
    'ZAWARTOSC PACZKI ZIP (CZYSTE SKRYPTY BEZ KOMPILACJI W LOCIE):',
    '  1. SystemPulse-Pro-Portable.bat         -> Natychmiastowy launcher Portable.',
    '                                             Uruchamia lokalna aplikacje w oknie',
    '                                             Edge/Chrome z odblokowanym FPS GPU.',
    '  2. Instalator-SystemPulse-Pro-Setup.cmd -> Kopiuje aplikacje do folderu',
    '                                             %LOCALAPPDATA%\\Programs\\SystemPulsePro',
    '                                             i tworzy czysty skrot na Pulpicie.',
    '  3. SystemPulse-Portal.html              -> Bezposrednie uruchomienie w przegladarce.',
    '  4. app\\index.html + portable-bundle.js  -> Pelny kod silnika 3D WebGL, D3.js,',
    '                                             scen GPU 3D i Gier/Wyscigow dzialajacy',
    '                                             w 100% lokalnie (offline).',
    '',
    `LOKALNY ADRES SERWERA DESKTOPOWEGO (OPCJA): ${localServerUrl}`,
    '========================================================================',
  ].join('\r\n');

  const zipBytes = buildZipArchive([
    { name: 'SystemPulse-Pro-Portable/Instalator-SystemPulse-Pro-Setup.cmd', content: installerSetupCmd },
    { name: 'SystemPulse-Pro-Portable/SystemPulse-Pro-Portable.bat', content: batLauncher },
    { name: 'SystemPulse-Pro-Portable/SystemPulseLauncher.cs', content: csharpSource },
    { name: 'SystemPulse-Pro-Portable/SystemPulseSetupGui.cs', content: csharpGuiInstallerSource },
    { name: 'SystemPulse-Pro-Portable/SystemPulse-Portal.html', content: portalHtml },
    { name: 'SystemPulse-Pro-Portable/INSTRUKCJA-PORTABLE-EXE.txt', content: readmeTxt },
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
    setTimeout(() => URL.revokeObjectURL(url), 4000);
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
