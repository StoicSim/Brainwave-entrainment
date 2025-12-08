import FFT from 'fft.js';

class EEGProcessor {
  constructor(sampleRate = 512, windowSize = 512) {
    this.sampleRate = sampleRate;
    this.windowSize = windowSize;
    this.buffer = [];
    this.fft = new FFT(windowSize);
    this.overlap = 0.5; 
  }

  /**
   * Add a raw EEG sample to the buffer
   */
  addSample(rawEEG) {
    this.buffer.push(rawEEG);
    
    // When buffer is full, process it
    if (this.buffer.length >= this.windowSize) {
      const window = this.buffer.slice(0, this.windowSize);
      const psdResult = this.computePSD(window);
      
      // Slide window with overlap
      const slideAmount = Math.floor(this.windowSize * this.overlap);
      this.buffer = this.buffer.slice(slideAmount);
      
      return psdResult;
    }
    
    return null;
  }

  /**
   * Remove DC offset (mean) from signal
   */
  detrend(signal) {
    const mean = signal.reduce((a, b) => a + b, 0) / signal.length;
    return signal.map(x => x - mean);
  }

  /**
   * Simple notch filter to remove line noise (50 or 60 Hz)
   * ADD THIS NEW METHOD
   */
  notchFilter(signal, notchFreq = 50, sampleRate = 512, bandwidth = 2) {
    // Simple moving average notch filter
    const filtered = [...signal];
    const period = Math.round(sampleRate / notchFreq);
    
    for (let i = period; i < signal.length; i++) {
      // Subtract the periodic component
      filtered[i] = signal[i] - signal[i - period];
    }
    
    return filtered;
  }

  /**
   * Simple bandpass filter
   * ADD THIS NEW METHOD
   */
  bandpassFilter(signal, lowFreq = 0.5, highFreq = 50) {
    // This is a simplified version - consider using a proper filter library
    let processed = this.detrend(signal);
    
    // High-pass: remove very low frequencies
    const mean = processed.reduce((a, b) => a + b, 0) / processed.length;
    processed = processed.map(x => x - mean);
    
    return processed;
  }

  /**
   * Apply Hamming window to reduce spectral leakage
   */
  applyHammingWindow(signal) {
    const N = signal.length;
    return signal.map((x, n) => {
      const window = 0.54 - 0.46 * Math.cos(2 * Math.PI * n / (N - 1));
      return x * window;
    });
  }

  /**
   * Compute Power Spectral Density
   * UPDATE THIS METHOD
   */
  computePSD(signal) {
      console.log('Input signal range:', Math.min(...signal), 'to', Math.max(...signal));

    const N = signal.length;
    
    // Preprocess signal with filters
    let processed = this.detrend(signal);
      console.log('After detrend:', Math.min(...processed), 'to', Math.max(...processed));

    processed = this.notchFilter(processed, 50, this.sampleRate); // Remove 50Hz line noise
    processed = this.applyHammingWindow(processed);
      console.log('After window:', Math.min(...processed), 'to', Math.max(...processed));

    
    // Prepare input for FFT (real + imaginary parts)
    const input = new Array(N * 2);
    for (let i = 0; i < N; i++) {
      input[i * 2] = processed[i];     // Real part
      input[i * 2 + 1] = 0;            // Imaginary part
    }
    
    // Compute FFT
    const output = new Array(N * 2);
    this.fft.transform(output, input);
    
    // Calculate Power Spectral Density and frequencies
    const psd = [];
    const frequencies = [];
    
    // Only take first half (positive frequencies)
    for (let i = 0; i < N / 2; i++) {
      const real = output[i * 2];
      const imag = output[i * 2 + 1];
      
      // Power = (real² + imag²) / N² for proper scaling
      const power = (real * real + imag * imag) / (N * N);
      
      psd.push(power);
      frequencies.push(i * this.sampleRate / N);
    }
    
    return {
      frequencies,
      psd,
      bandPowers: this.extractBandPowers(frequencies, psd),
    };
  }

  /**
   * Extract power in specific frequency bands
   */
  extractBandPowers(frequencies, psd) {
    const bands = {
      Delta: { range: [0.5, 4], power: 0 },
      Theta: { range: [4, 8], power: 0 },
      AlphaLow: { range: [8, 10], power: 0 },
      AlphaHigh: { range: [10, 13], power: 0 },
      BetaLow: { range: [13, 17], power: 0 },
      BetaHigh: { range: [17, 30], power: 0 },
      GammaLow: { range: [30, 40], power: 0 },
      GammaHigh: { range: [40, 50], power: 0 },
    };
    
    for (const [bandName, band] of Object.entries(bands)) {
      const [low, high] = band.range;
      
      // Sum power in frequency range
      for (let i = 0; i < frequencies.length; i++) {
        if (frequencies[i] >= low && frequencies[i] <= high) {
          band.power += psd[i];
        }
      }
      
      // Normalize by number of frequency bins
      const numBins = frequencies.filter(f => f >= low && f <= high).length;
      if (numBins > 0) {
        band.power = band.power / numBins;
      }
    }
    
    return bands;
  }

  /**
   * Find Individual Alpha Frequency (peak in 8-13 Hz range)
   */
  findIAF(frequencies, psd) {
    const alphaRange = [8, 13];
    let maxPower = 0;
    let iaf = 10; // Default
    
    for (let i = 0; i < frequencies.length; i++) {
      const freq = frequencies[i];
      
      if (freq >= alphaRange[0] && freq <= alphaRange[1]) {
        if (psd[i] > maxPower) {
          maxPower = psd[i];
          iaf = freq;
        }
      }
    }
    
    return {
      frequency: iaf,
      power: maxPower,
    };
  }

  /**
   * Reset the buffer
   */
  reset() {
    this.buffer = [];
  }

  /**
   * Get current buffer size
   */
  getBufferSize() {
    return this.buffer.length;
  }
}

export default EEGProcessor;