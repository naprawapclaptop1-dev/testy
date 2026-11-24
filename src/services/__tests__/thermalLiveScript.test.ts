import { describe, expect, it } from 'vitest';
import { buildWindowsLiveSensorBatContent } from '../thermalMonitor.service';

describe('Windows Live Sensor .bat Script Generator', () => {
  it('generates a 100% pure native CMD bridge without powershell.exe or ExecutionPolicy Bypass', () => {
    const bat = buildWindowsLiveSensorBatContent();

    // Must NOT spawn powershell.exe, use -ExecutionPolicy Bypass, or broken CMD multiline carets
    expect(bat).not.toContain('powershell');
    expect(bat).not.toContain('ExecutionPolicy');
    expect(bat).not.toContain('-Command ^');

    // Must switch to the script folder safely (handles filenames with spaces/(3))
    expect(bat).toContain('cd /d "%~dp0"');
    expect(bat).toContain('curl.exe');
    expect(bat).toContain('http://localhost:8085/data.json');
    expect(bat).toContain('nvidia-smi');
    expect(bat).toContain('timeout /t 2 /nobreak');
    expect(bat).toContain('goto loop');
  });
});
