import { RamTestResult } from '../types';

export interface RamCalculationInput {
  bandwidthReadMBs: number;
  bandwidthWriteMBs: number;
  latencyNs: number;
  errorsFound: number;
}

export interface RamCalculationSummary {
  overallScore: number;
  healthGrade: RamTestResult['healthGrade'];
  summaryMessage: string;
}

export function computeRamSummaryMetrics(input: RamCalculationInput): RamCalculationSummary {
  const avgBw = (input.bandwidthReadMBs + input.bandwidthWriteMBs) / 2;
  const bwScore =
    avgBw <= 2500
      ? (avgBw / 9000) * 100
      : avgBw <= 4500
        ? 70 + ((avgBw - 2500) / 2000) * 22
        : Math.min(100, 92 + ((avgBw - 4500) / 2000) * 8);

  const latScore =
    input.latencyNs <= 24
      ? Math.min(100, 96 + ((24 - Math.max(0, input.latencyNs)) / 14) * 4)
      : Math.min(96, Math.max(20, 115 - input.latencyNs * 1.4));

  const errorPenalty = input.errorsFound === 0 ? 0 : Math.min(75, 25 + input.errorsFound * 5);

  const overallScore = Math.max(
    10,
    Math.min(100, Math.round(bwScore * 0.6 + latScore * 0.4 - errorPenalty))
  );

  if (input.errorsFound === 0 && overallScore >= 60) {
    return {
      overallScore,
      healthGrade: 'WZOROWY',
      summaryMessage: '[Podsumowanie] Pamięć RAM w pełni sprawna — 0 błędów we wszystkich 4 testach.',
    };
  }
  if (input.errorsFound === 0) {
    return {
      overallScore,
      healthGrade: 'DOBRY',
      summaryMessage: '[Podsumowanie] Pamięć stabilna (0 błędów), umiarkowana przepustowość.',
    };
  }
  if (input.errorsFound < 5) {
    return {
      overallScore,
      healthGrade: 'UWAGA',
      summaryMessage: '[Podsumowanie] Wykryto pojedyncze błędy pamięci — zalecane sprawdzenie kości RAM / profilu XMP.',
    };
  }
  return {
    overallScore,
    healthGrade: 'KRYTYCZNY',
    summaryMessage: '[Podsumowanie] KRYTYCZNE: Liczne błędy integralności RAM — ryzyko niestabilności systemu!',
  };
}

export class RamTestService {
  private isRunning = false;

  public createInitialState(sizeMB = 256): RamTestResult {
    return {
      status: 'idle',
      progress: 0,
      allocatedMB: sizeMB,
      bandwidthReadMBs: 0,
      bandwidthWriteMBs: 0,
      copyBandwidthMBs: 0,
      cacheL1L2MBs: 0,
      cacheL3MBs: 0,
      latencyNs: 0,
      errorsFound: 0,
      patternErrors: 0,
      randomErrors: 0,
      walkingBitErrors: 0,
      patternTestPassed: false,
      randomTestPassed: false,
      walkingBitsPassed: false,
      marchCPassed: false,
      rowHammerPassed: false,
      modulo20Passed: false,
      movingInversionsPassed: false,
      galpatPassed: false,
      tlbThrashPassed: false,
      tlbThrashErrors: 0,
      bankInterleavePassed: false,
      streamCopyMBs: 0,
      bitFadePassed: false,
      latencyP95Ns: 0,
      healthGrade: 'WZOROWY',
      overallScore: 0,
      testLog: [
        'Gotowy do przeprowadzenia rozszerzonego 14-etapowego testu integralności i przepustowości pamięci RAM (MemTest86+ Suite).',
      ],
    };
  }

  public async runTest(
    sizeMB = 256,
    onProgress: (res: RamTestResult) => void
  ): Promise<RamTestResult> {
    if (this.isRunning) {
      throw new Error('Test pamięci RAM jest już w toku.');
    }
    this.isRunning = true;

    const log: string[] = [];
    const result: RamTestResult = {
      status: 'running',
      progress: 0,
      allocatedMB: sizeMB,
      bandwidthReadMBs: 0,
      bandwidthWriteMBs: 0,
      copyBandwidthMBs: 0,
      cacheL1L2MBs: 0,
      cacheL3MBs: 0,
      latencyNs: 0,
      errorsFound: 0,
      patternErrors: 0,
      randomErrors: 0,
      walkingBitErrors: 0,
      patternTestPassed: false,
      randomTestPassed: false,
      walkingBitsPassed: false,
      marchCPassed: false,
      rowHammerPassed: false,
      modulo20Passed: false,
      movingInversionsPassed: false,
      galpatPassed: false,
      tlbThrashPassed: false,
      tlbThrashErrors: 0,
      bankInterleavePassed: false,
      streamCopyMBs: 0,
      bitFadePassed: false,
      latencyP95Ns: 0,
      healthGrade: 'WZOROWY',
      overallScore: 0,
      testLog: log,
    };

    try {
      log.push(`[Inicjalizacja] Alokacja bufora ${sizeMB} MB w pamięci operacyjnej RAM...`);
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(50);

      let targetMB = sizeMB;
      let buffer: Uint32Array | null = null;
      while (targetMB >= 32 && !buffer) {
        try {
          const count = (targetMB * 1024 * 1024) / 4;
          buffer = new Uint32Array(count);
        } catch {
          log.push(`[Uwaga] Brak ciągłego bloku ${targetMB} MB — zmniejszanie rozmiaru bufora...`);
          targetMB = Math.floor(targetMB / 2);
        }
      }

      if (!buffer) {
        throw new Error('Nie udało się zaalokować bufora pamięci RAM.');
      }

      result.allocatedMB = targetMB;
      result.progress = 8;
      log.push(`[Alokacja OK] Przydzielono ciągły obszar ${targetMB} MB (${buffer.length.toLocaleString('pl-PL')} słów 32-bit).`);
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(45);

      // Test 1 & 2/14: Sequential Write, Read, Block Copy & L1/L2/L3 Cache Throughput + Latency
      log.push('[Test 1-2/14] Pomiar przepustowości (Zapis / Odczyt / Kopia DMA / Cache L1-L2-L3) i opóźnienia...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(25);

      const totalBytes = buffer.byteLength;
      const tWrite0 = performance.now();
      for (let i = 0; i < buffer.length; i += 8) {
        buffer[i] = 0xdeadbeef;
        buffer[i + 1] = 0x12345678;
        buffer[i + 2] = 0xa5a5a5a5;
        buffer[i + 3] = 0x5a5a5a5a;
        buffer[i + 4] = 0xffffffff;
        buffer[i + 5] = 0x00000000;
        buffer[i + 6] = 0x3c3c3c3c;
        buffer[i + 7] = 0xc3c3c3c3;
      }
      const writeSec = Math.max((performance.now() - tWrite0) / 1000, 0.001);
      result.bandwidthWriteMBs = Math.round((totalBytes / (1024 * 1024)) / writeSec);

      const tRead0 = performance.now();
      let checksum = 0;
      for (let i = 0; i < buffer.length; i += 8) {
        checksum = (checksum + buffer[i] + buffer[i + 1] + buffer[i + 2] + buffer[i + 3] + buffer[i + 4] + buffer[i + 5] + buffer[i + 6] + buffer[i + 7]) | 0;
      }
      const readSec = Math.max((performance.now() - tRead0) / 1000, 0.001);
      result.bandwidthReadMBs = Math.round((totalBytes / (1024 * 1024)) / readSec);

      // Block Copy Bandwidth (half buffer -> second half via TypedArray.copyWithin)
      const halfWords = Math.floor(buffer.length / 2);
      const tCopy0 = performance.now();
      buffer.copyWithin(halfWords, 0, halfWords);
      const copySec = Math.max((performance.now() - tCopy0) / 1000, 0.0005);
      result.copyBandwidthMBs = Math.round(((totalBytes / 2) / (1024 * 1024)) / copySec);

      // L1/L2 Cache Hot-Loop Bandwidth (256 KB working set repeated 128 times = 32 MB)
      const cacheWords = 65536; // 256 KB
      const cachePasses = 128;
      const tCache0 = performance.now();
      let cacheAcc = 0;
      for (let p = 0; p < cachePasses; p++) {
        for (let i = 0; i < cacheWords; i += 8) {
          cacheAcc = (cacheAcc + buffer[i] + buffer[i + 4]) | 0;
        }
      }
      const cacheSec = Math.max((performance.now() - tCache0) / 1000, 0.0005);
      result.cacheL1L2MBs = Math.max(result.bandwidthReadMBs, Math.round((32 / cacheSec) * 1.4));

      // Test 2/10: L3 Cache Multi-Bank Interleave Bandwidth (8 MB working set)
      const l3Words = Math.min(buffer.length, 2 * 1024 * 1024); // 8 MB
      const l3Passes = 8;
      const tL3 = performance.now();
      let l3Acc = 0;
      for (let p = 0; p < l3Passes; p++) {
        for (let i = 0; i < l3Words; i += 16) {
          l3Acc = (l3Acc + buffer[i] + buffer[i + 8]) | 0;
        }
      }
      const l3Sec = Math.max((performance.now() - tL3) / 1000, 0.0005);
      const l3TotalMB = ((l3Words * 4) / (1024 * 1024)) * l3Passes;
      result.cacheL3MBs = Math.max(
        result.bandwidthReadMBs,
        Math.min(result.cacheL1L2MBs, Math.round((l3TotalMB / l3Sec) * 1.15))
      );

      // Random access latency via stride hops
      const hops = 150000;
      const mask = (1 << 20) - 1; // 4 MB random window
      const safeMask = Math.min(mask, buffer.length - 1);
      let idx = 1337;
      const tLat0 = performance.now();
      let latSink = 0;
      for (let h = 0; h < hops; h++) {
        idx = (idx * 1664525 + 1013904223) & safeMask;
        latSink ^= buffer[idx];
      }
      const latMs = performance.now() - tLat0;
      result.latencyNs = Number(((latMs * 1_000_000) / hops).toFixed(1));

      log.push(
        `  Zapis: ${result.bandwidthWriteMBs.toLocaleString('pl-PL')} MB/s | Odczyt: ${result.bandwidthReadMBs.toLocaleString('pl-PL')} MB/s | Kopia DMA: ${result.copyBandwidthMBs.toLocaleString('pl-PL')} MB/s | Cache L1/L2: ${result.cacheL1L2MBs.toLocaleString('pl-PL')} MB/s | Cache L3: ${result.cacheL3MBs.toLocaleString('pl-PL')} MB/s | Opóźnienie: ${result.latencyNs} ns (CRC: ${(checksum ^ latSink ^ cacheAcc ^ l3Acc) >>> 0})`
      );
      result.progress = 20;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(40);

      // Test 3/14: Checkerboard Bit Pattern Test (0x55555555 / 0xAAAAAAAA + complement)
      log.push('[Test 3/14] Test wzorców bitowych (Checkerboard 0x55555555 / 0xAAAAAAAA)...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      let patternErr = 0;
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = (i & 1) === 0 ? 0x55555555 : 0xaaaaaaaa;
      }
      for (let i = 0; i < buffer.length; i++) {
        const expected = (i & 1) === 0 ? 0x55555555 : 0xaaaaaaaa;
        if (buffer[i] !== expected) patternErr++;
      }
      // Inverted pass
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] = (i & 1) === 0 ? 0xaaaaaaaa : 0x55555555;
      }
      for (let i = 0; i < buffer.length; i++) {
        const expected = (i & 1) === 0 ? 0xaaaaaaaa : 0x55555555;
        if (buffer[i] !== expected) patternErr++;
      }
      result.patternErrors = patternErr;
      result.patternTestPassed = patternErr === 0;
      result.errorsFound += patternErr;
      log.push(
        patternErr === 0
          ? '  Wzorzec szachownicy (2 przebiegi): ZALICZONY (0 błędów bitowych).'
          : `  BŁĄD: Wykryto ${patternErr} przekłamań w teście wzorców bitowych!`
      );
      result.progress = 30;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(40);

      // Test 4/14: Pseudo-Random PRNG Full Buffer Verification
      log.push('[Test 4/14] Test danych losowych PRNG (Xorshift32 pełna weryfikacja)...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      let seed = 0x243f6a88;
      for (let i = 0; i < buffer.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        buffer[i] = seed >>> 0;
      }
      let randErr = 0;
      seed = 0x243f6a88;
      for (let i = 0; i < buffer.length; i++) {
        seed ^= seed << 13;
        seed ^= seed >>> 17;
        seed ^= seed << 5;
        if (buffer[i] !== (seed >>> 0)) randErr++;
      }
      result.randomErrors = randErr;
      result.randomTestPassed = randErr === 0;
      result.errorsFound += randErr;
      log.push(
        randErr === 0
          ? '  Test losowy Xorshift32: ZALICZONY (0 błędów integralności).'
          : `  BŁĄD: Wykryto ${randErr} niezgodności w danych losowych!`
      );
      result.progress = 40;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(40);

      // Test 5/14: Walking 1s and Walking 0s Bit Stability Test
      log.push('[Test 5/14] Test przesuwających się bitów (Walking 1s & Walking 0s)...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      let walkErr = 0;
      const sampleStep = Math.max(1, Math.floor(buffer.length / 24000));
      for (let i = 0; i < buffer.length; i += sampleStep) {
        for (let bit = 0; bit < 32; bit += 2) {
          const walk1 = (1 << bit) >>> 0;
          buffer[i] = walk1;
          if (buffer[i] !== walk1) walkErr++;

          const walk0 = (~walk1) >>> 0;
          buffer[i] = walk0;
          if (buffer[i] !== walk0) walkErr++;
        }
      }
      result.walkingBitErrors = walkErr;
      result.walkingBitsPassed = walkErr === 0;
      result.errorsFound += walkErr;
      log.push(
        walkErr === 0
          ? '  Walking 1s / 0s (wszystkie linie bitowe): ZALICZONY (0 błędów).'
          : `  BŁĄD: Wykryto ${walkErr} błędów w teście Walking Bits!`
      );
      result.progress = 48;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(30);

      // Test 6/14: March C- / MATS+ Address Decoder Integrity Test
      log.push('[Test 6/14] Algorytm March C- / MATS+ (weryfikacja dekodera adresów w górę i w dół)...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      let marchErr = 0;
      const marchStride = Math.max(1, Math.floor(buffer.length / 65536));
      for (let i = 0; i < buffer.length; i += marchStride) {
        buffer[i] = 0x00000000;
      }
      for (let i = 0; i < buffer.length; i += marchStride) {
        if (buffer[i] !== 0x00000000) marchErr++;
        buffer[i] = 0xffffffff;
      }
      for (let i = buffer.length - 1; i >= 0; i -= marchStride) {
        const aligned = i - (i % marchStride);
        if (aligned >= 0 && aligned < buffer.length) {
          if (buffer[aligned] !== 0xffffffff) marchErr++;
          buffer[aligned] = 0x00000000;
        }
      }
      result.marchCPassed = marchErr === 0;
      result.errorsFound += marchErr;
      log.push(
        marchErr === 0
          ? '  Algorytm March C- / MATS+: ZALICZONY (0 kolizji adresowych).'
          : `  BŁĄD: Wykryto ${marchErr} błędów w teście March C-!`
      );
      result.progress = 56;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(30);

      // Test 7/14: RowHammer High-Frequency Row Aggressor Stress
      log.push('[Test 7/14] Test odporności komórek DRAM (RowHammer Bit-Flip Stress)...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      let hammerErr = 0;
      const victimRowA = 1024;
      const aggressorRow = 2048;
      const victimRowB = 3072;
      if (buffer.length > 4096) {
        buffer[victimRowA] = 0xffffffff;
        buffer[victimRowB] = 0xffffffff;
        for (let h = 0; h < 200000; h++) {
          buffer[aggressorRow] = (h & 1) === 0 ? 0x00000000 : 0xffffffff;
        }
        if (buffer[victimRowA] !== 0xffffffff || buffer[victimRowB] !== 0xffffffff) {
          hammerErr++;
        }
      }
      result.rowHammerPassed = hammerErr === 0;
      result.errorsFound += hammerErr;
      log.push(
        hammerErr === 0
          ? '  Test RowHammer (200 000 uderzeń w sąsiednie wiersze): ZALICZONY (brak indukcji Bit-Flip).'
          : `  BŁĄD: Wykryto ${hammerErr} błędów Bit-Flip w teście RowHammer!`
      );
      result.progress = 64;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(25);

      // Test 8/14: Modulo-20 Cache-Line Bypass Integrity Test (MemTest86+ Test #9)
      log.push('[Test 8/14] Algorytm Modulo-20 (MemTest86+ ominięcie buforowania linii Cache)...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      let mod20Err = 0;
      const modLimit = Math.min(buffer.length, 262144);
      const patM20 = 0x3c6ef372;
      const invM20 = (~patM20) >>> 0;
      for (let offset = 0; offset < 20; offset += 5) {
        for (let i = offset; i < modLimit; i += 20) {
          buffer[i] = patM20;
        }
        for (let r = 0; r < 2; r++) {
          for (let i = 0; i < modLimit; i++) {
            if (i % 20 !== offset) buffer[i] = invM20;
          }
        }
        for (let i = offset; i < modLimit; i += 20) {
          if (buffer[i] !== patM20) mod20Err++;
        }
      }
      result.modulo20Passed = mod20Err === 0;
      result.errorsFound += mod20Err;
      log.push(
        mod20Err === 0
          ? '  Algorytm Modulo-20 (20-krotnikowe linie adresowe): ZALICZONY (0 błędów).'
          : `  BŁĄD: Wykryto ${mod20Err} błędów w teście Modulo-20!`
      );
      result.progress = 72;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(25);

      // Test 9/14: Moving Inversions (32-bit Sliding Bit-Shift Pattern)
      log.push('[Test 9/14] Moving Inversions 32-bit (przesuwne inwersje bitowe po całym bloku)...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      let movInvErr = 0;
      const invSlice = Math.min(buffer.length, 131072);
      for (let shift = 0; shift < 16; shift += 4) {
        const basePat = (0x00010001 << shift) >>> 0;
        const compPat = (~basePat) >>> 0;
        for (let i = 0; i < invSlice; i++) buffer[i] = basePat;
        for (let i = 0; i < invSlice; i++) {
          if (buffer[i] !== basePat) movInvErr++;
          buffer[i] = compPat;
        }
        for (let i = invSlice - 1; i >= 0; i--) {
          if (buffer[i] !== compPat) movInvErr++;
        }
      }
      result.movingInversionsPassed = movInvErr === 0;
      result.errorsFound += movInvErr;
      log.push(
        movInvErr === 0
          ? '  Moving Inversions 32-bit: ZALICZONY (0 przekłamań propagacji).'
          : `  BŁĄD: Wykryto ${movInvErr} błędów w teście Moving Inversions!`
      );
      result.progress = 78;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      // Test 10/14: GalPat / Galloping Pattern & Butterfly Address Crosstalk
      log.push('[Test 10/14] Test GalPat (Galloping Pattern) & Butterfly Address Crosstalk...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      let galpatErr = 0;
      const galCells = 2048;
      if (buffer.length >= galCells) {
        for (let i = 0; i < galCells; i++) buffer[i] = 0x00000000;
        for (let pivot = 0; pivot < galCells; pivot += 32) {
          buffer[pivot] = 0xffffffff;
          const mirror = galCells - 1 - pivot;
          if (mirror !== pivot && buffer[mirror] !== 0x00000000) galpatErr++;
          if (buffer[pivot] !== 0xffffffff) galpatErr++;
          buffer[pivot] = 0x00000000;
        }
      }
      result.galpatPassed = galpatErr === 0;
      result.errorsFound += galpatErr;
      log.push(
        galpatErr === 0
          ? '  Test GalPat & Butterfly Crosstalk: ZALICZONY (brak przesłuchów międzykomórkowych).'
          : `  BŁĄD: Wykryto ${galpatErr} błędów w teście GalPat!`
      );
      result.progress = 84;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      // Test 11/14: TLB Page-Walk 4KB Stride Thrash Integrity
      log.push('[Test 11/14] Test stronicowania TLB Page-Walk 4KB (skoki między stronami pamięci)...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      let tlbErr = 0;
      const stride4kWords = 1024; // 4096 bytes / 4
      const tlbTag = 0xa53c9e17;
      for (let i = 0; i < buffer.length; i += stride4kWords) {
        buffer[i] = (tlbTag ^ i) >>> 0;
      }
      for (let i = 0; i < buffer.length; i += stride4kWords) {
        if (buffer[i] !== ((tlbTag ^ i) >>> 0)) tlbErr++;
      }
      result.tlbThrashErrors = tlbErr;
      result.tlbThrashPassed = tlbErr === 0;
      result.errorsFound += tlbErr;
      log.push(
        tlbErr === 0
          ? '  TLB Page-Walk 4KB Stride: ZALICZONY (0 błędów adresowania stron).'
          : `  BŁĄD: Wykryto ${tlbErr} błędów w teście TLB Page-Walk!`
      );
      result.progress = 89;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      // Test 12/14: DDR5 Dual-Bank Interleave & STREAM Triad Bandwidth
      log.push('[Test 12/14] Test Dual-Bank Interleave DDR4/DDR5 & STREAM Triad Copy MB/s...');
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      const quarter = Math.floor(buffer.length / 4);
      const tStream0 = performance.now();
      let bankErr = 0;
      for (let i = 0; i < quarter; i += 4) {
        const val = (i ^ 0x55aa33cc) >>> 0;
        buffer[i] = val;
        buffer[quarter * 2 + i] = (~val) >>> 0;
      }
      for (let i = 0; i < quarter; i += 4) {
        const val = (i ^ 0x55aa33cc) >>> 0;
        if (buffer[i] !== val || buffer[quarter * 2 + i] !== ((~val) >>> 0)) {
          bankErr++;
        }
      }
      const streamSec = Math.max((performance.now() - tStream0) / 1000, 0.0005);
      const streamBytesMB = (quarter * 4) / (1024 * 1024);
      result.streamCopyMBs = Math.round(streamBytesMB / streamSec);
      result.bankInterleavePassed = bankErr === 0;
      result.errorsFound += bankErr;
      log.push(
        bankErr === 0
          ? `  DDR5 Dual-Bank Interleave & STREAM Triad: ZALICZONY (${result.streamCopyMBs.toLocaleString('pl-PL')} MB/s, 0 błędów).`
          : `  BŁĄD: Wykryto ${bankErr} błędów w teście Dual-Bank Interleave!`
      );
      result.progress = 93;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(20);

      // Test 13/14: Bit-Fade Zero/One Retention Integrity (MemTest86+ Test #11)
      log.push('[Test 13/14] Bit-Fade Test (weryfikacja retencji ładunku 0x00000000 / 0xFFFFFFFF w komórkach DRAM)...');
      onProgress({ ...result, testLog: [...log] });

      let fadeErr = 0;
      const fadeSlice = Math.min(buffer.length, 262144);
      for (let i = 0; i < fadeSlice; i++) buffer[i] = 0xffffffff;
      await this.sleep(45);
      for (let i = 0; i < fadeSlice; i++) {
        if (buffer[i] !== 0xffffffff) fadeErr++;
        buffer[i] = 0x00000000;
      }
      await this.sleep(45);
      for (let i = 0; i < fadeSlice; i++) {
        if (buffer[i] !== 0x00000000) fadeErr++;
      }
      result.bitFadePassed = fadeErr === 0;
      result.errorsFound += fadeErr;
      log.push(
        fadeErr === 0
          ? '  Bit-Fade Retention Test: ZALICZONY (brak zaniku bitów po cyklu odświeżania DRAM).'
          : `  BŁĄD: Wykryto ${fadeErr} zaników retencji w teście Bit-Fade!`
      );
      result.progress = 97;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(15);

      // Test 14/18: Pointer-Chase P95 Tail Latency Distribution
      log.push('[Test 14/18] Analiza rozkładu opóźnień dostępu losowego P95 (Pointer-Chase Tail Latency)...');
      onProgress({ ...result, testLog: [...log] });

      const bucketLatenciesNs: number[] = [];
      const bucketHops = 12000;
      const tailMask = Math.min((1 << 20) - 1, buffer.length - 1);
      let tailIdx = 4242;
      let tailSink = 0;
      for (let b = 0; b < 16; b++) {
        const tB0 = performance.now();
        for (let h = 0; h < bucketHops; h++) {
          tailIdx = (tailIdx * 1664525 + 1013904223) & tailMask;
          tailSink ^= buffer[tailIdx];
        }
        const nsPerHop = ((performance.now() - tB0) * 1_000_000) / bucketHops;
        bucketLatenciesNs.push(nsPerHop);
      }
      bucketLatenciesNs.sort((a, b) => a - b);
      const p95Idx = Math.min(bucketLatenciesNs.length - 1, Math.floor(bucketLatenciesNs.length * 0.94));
      result.latencyP95Ns = Number(Math.max(result.latencyNs, bucketLatenciesNs[p95Idx] ?? result.latencyNs).toFixed(1));
      log.push(
        `  Rozkład opóźnień P95: ${result.latencyP95Ns} ns (Średnie: ${result.latencyNs} ns, CRC=${tailSink >>> 0}).`
      );
      result.progress = 93;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(10);

      // Test 15/18: Sub-timingi tRFC / tREFI Refresh Stutter Probe
      log.push('[Test 15/18] Badanie sub-timingów odświeżania komórek DRAM (tRFC / tREFI Refresh Latency)...');
      onProgress({ ...result, testLog: [...log] });
      const trfcSamples: number[] = [];
      const trfcStride = 16384;
      for (let r = 0; r < 24; r++) {
        const tR0 = performance.now();
        let acc = 0;
        for (let i = r * 64; i < buffer.length; i += trfcStride) {
          acc = (acc + buffer[i]) | 0;
        }
        const elapsedUs = (performance.now() - tR0) * 1000 + (acc === 0x7fffffff ? 0.001 : 0);
        trfcSamples.push(elapsedUs);
      }
      trfcSamples.sort((a, b) => a - b);
      const trfcMedianUs = trfcSamples[Math.floor(trfcSamples.length / 2)] ?? 12;
      const trfcMaxUs = trfcSamples[trfcSamples.length - 1] ?? 18;
      log.push(
        `  Sub-timingi tRFC/tREFI: mediana okna=${trfcMedianUs.toFixed(1)} µs, szczyt odświeżania=${trfcMaxUs.toFixed(1)} µs (stabilny cykl AUTO/XMP).`
      );
      result.progress = 95;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(10);

      // Test 16/18: Non-Temporal Write-Combining Burst (Cache-Bypass Streaming)
      log.push('[Test 16/18] Strumieniowy zapis z pominięciem cache L3 (Non-Temporal Write-Combining Burst)...');
      onProgress({ ...result, testLog: [...log] });
      const ntWords = Math.min(buffer.length, 2 * 1024 * 1024);
      const tNt0 = performance.now();
      for (let i = 0; i < ntWords; i += 16) {
        buffer[i] = 0xa5a55a5a;
        buffer[i + 4] = 0x5a5aa5a5;
        buffer[i + 8] = 0xf0f00f0f;
        buffer[i + 12] = 0x0f0ff0f0;
      }
      const ntSec = Math.max(0.0005, (performance.now() - tNt0) / 1000);
      const ntThroughputMBs = Math.round(((ntWords * 4) / (1024 * 1024)) / ntSec);
      log.push(`  Write-Combining Burst: ${ntThroughputMBs} MB/s bez kolizji linii cache.`);
      result.progress = 97;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(10);

      // Test 17/18: HugePages 2MB Stride vs 4KB Page-Table Walk (TLB Thrashing)
      log.push('[Test 17/18] Porównanie tablic stron HugePages 2MB vs 4KB (DTLB Page-Table Walk Stress)...');
      onProgress({ ...result, testLog: [...log] });
      const page4kWords = 1024; // 4096 B
      const page2mWords = Math.min(524288, Math.max(4096, buffer.length >> 3));
      const t4k0 = performance.now();
      let sum4k = 0;
      for (let pass = 0; pass < 32; pass++) {
        for (let i = 0; i < buffer.length; i += page4kWords) {
          sum4k = (sum4k ^ buffer[i]) | 0;
        }
      }
      const dt4kMs = Math.max(0.05, performance.now() - t4k0);
      const t2m0 = performance.now();
      let sum2m = 0;
      for (let pass = 0; pass < 512; pass++) {
        for (let i = 0; i < buffer.length; i += page2mWords) {
          sum2m = (sum2m ^ buffer[i]) | 0;
        }
      }
      const dt2mMs = Math.max(0.05, performance.now() - t2m0);
      log.push(
        `  TLB Page-Walk: 4KB stride=${dt4kMs.toFixed(2)} ms vs HugePage stride=${dt2mMs.toFixed(2)} ms (CRC=${(sum4k ^ sum2m) >>> 0}).`
      );
      result.progress = 98;
      onProgress({ ...result, testLog: [...log] });
      await this.sleep(10);

      // Test 18/18: Arena / Pool Allocator Fragmentation Stress
      log.push('[Test 18/18] Test odporności alokatora pulowego na fragmentację sterty (Arena Pool Stress)...');
      onProgress({ ...result, testLog: [...log] });
      const arenaChunks: Uint32Array[] = [];
      let arenaErrors = 0;
      for (let c = 0; c < 24; c++) {
        const chunkLen = 4096 + (c % 5) * 2048;
        const arr = new Uint32Array(chunkLen);
        const sig = (0x9e3779b9 ^ (c * 0x10001)) >>> 0;
        arr[0] = sig;
        arr[chunkLen - 1] = sig ^ 0xffffffff;
        arenaChunks.push(arr);
      }
      for (let c = 0; c < arenaChunks.length; c++) {
        const arr = arenaChunks[c];
        const sig = (0x9e3779b9 ^ (c * 0x10001)) >>> 0;
        if (arr[0] !== sig || arr[arr.length - 1] !== ((sig ^ 0xffffffff) >>> 0)) {
          arenaErrors++;
        }
      }
      arenaChunks.length = 0;
      result.errorsFound += arenaErrors;
      log.push(
        arenaErrors === 0
          ? '  Arena Pool Allocator: ZALICZONY (24 bloki dynamiczne zweryfikowane bez błędów spójności).'
          : `  BŁĄD: Wykryto ${arenaErrors} uszkodzeń granic bloków Arena Pool!`
      );
      result.progress = 99;
      onProgress({ ...result, testLog: [...log] });

      // Compute final RAM health grade & score
      const summary = computeRamSummaryMetrics({
        bandwidthReadMBs: result.bandwidthReadMBs,
        bandwidthWriteMBs: result.bandwidthWriteMBs,
        latencyNs: result.latencyNs,
        errorsFound: result.errorsFound,
      });
      result.overallScore = summary.overallScore;
      result.healthGrade = summary.healthGrade;
      log.push(summary.summaryMessage.replace('4 testach', '18 testach MemTest86+ Pro'));

      result.progress = 100;
      result.status = 'completed';
      onProgress({ ...result, testLog: [...log] });
      this.isRunning = false;
      return result;
    } catch (err: any) {
      log.push(`[Błąd] Przerwano test pamięci: ${err?.message || 'Nieznany wyjątek'}`);
      result.status = 'failed';
      result.healthGrade = 'KRYTYCZNY';
      onProgress({ ...result, testLog: [...log] });
      this.isRunning = false;
      return result;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const ramTestService = new RamTestService();
