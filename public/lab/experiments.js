// ✧ Experimental Music Lab — All Prototypes ✧

// ============================================================
// 1. MARKOV CHAIN MELODY GENERATOR
// ============================================================
const markov = (() => {
  let melody = [];
  let part = null;
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.5 }
  }).toDestination();

  // Training data per style (scale degrees as MIDI offsets from root)
  const styles = {
    folk: {
      scale: [0, 2, 4, 7, 9], // pentatonic
      training: [0,2,4,2,0,4,7,4,2,0,9,7,4,2,4,7,9,7,4,2,0,0,2,4,7,9,9,7,4,2,0,4,7,9,7,4,0,2,0]
    },
    jazz: {
      scale: [0,1,2,3,4,5,6,7,8,9,10,11],
      training: [0,4,7,11,10,7,3,5,9,0,2,5,7,11,0,3,7,10,9,5,2,0,11,7,4,0,5,9,7,3,0,2,7,11,10,5,0]
    },
    classical: {
      scale: [0, 2, 4, 5, 7, 9, 11], // major
      training: [0,2,4,5,7,5,4,2,0,7,5,4,2,4,5,7,9,11,9,7,5,4,2,0,0,4,7,5,2,0,11,0,2,4,7,9,7,5,4,2,0]
    },
    blues: {
      scale: [0, 3, 5, 6, 7, 10], // blues
      training: [0,3,5,6,5,3,0,7,5,3,0,10,7,5,3,5,6,7,10,7,6,5,3,0,0,3,5,7,10,7,5,3,0,6,5,3,0]
    }
  };

  let currentStyle = 'folk';

  function buildMatrix(training, order) {
    const matrix = {};
    for (let i = 0; i < training.length - order; i++) {
      const key = training.slice(i, i + order).join(',');
      const next = training[i + order];
      if (!matrix[key]) matrix[key] = {};
      matrix[key][next] = (matrix[key][next] || 0) + 1;
    }
    // Normalize
    for (const key in matrix) {
      const total = Object.values(matrix[key]).reduce((a, b) => a + b, 0);
      for (const n in matrix[key]) matrix[key][n] /= total;
    }
    return matrix;
  }

  function weightedPick(dist) {
    let r = Math.random(), sum = 0;
    for (const [val, prob] of Object.entries(dist)) {
      sum += prob;
      if (r <= sum) return parseInt(val);
    }
    return parseInt(Object.keys(dist)[0]);
  }

  return {
    setStyle(s) { currentStyle = s; },
    generate() {
      const order = parseInt(document.getElementById('markov-order').value);
      const len = parseInt(document.getElementById('markov-len').value);
      const style = styles[currentStyle];
      const matrix = buildMatrix(style.training, order);

      melody = style.training.slice(0, order);
      for (let i = 0; i < len; i++) {
        const key = melody.slice(-order).join(',');
        if (matrix[key]) {
          melody.push(weightedPick(matrix[key]));
        } else {
          melody.push(style.scale[Math.floor(Math.random() * style.scale.length)]);
        }
      }
      drawMarkov();
      document.getElementById('markov-status').textContent =
        `Generated ${melody.length} notes in ${currentStyle} style (order ${order})`;
    },
    play() {
      if (!melody.length) this.generate();
      Tone.start();
      this.stop();
      const baseNote = 60;
      let i = 0;
      part = new Tone.Loop(time => {
        if (i >= melody.length) { this.stop(); return; }
        const midi = baseNote + melody[i];
        synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), '8n', time);
        highlightMarkovNote(i);
        i++;
      }, '8n').start(0);
      Tone.Transport.bpm.value = 140;
      Tone.Transport.start();
    },
    stop() {
      if (part) { part.stop(); part.dispose(); part = null; }
      Tone.Transport.stop();
    }
  };

  function drawMarkov() {
    const c = document.getElementById('markov-viz');
    const ctx = c.getContext('2d');
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, c.width, c.height);
    const w = c.width / melody.length;
    melody.forEach((note, i) => {
      const y = c.height - (note / 12) * c.height * 0.8 - c.height * 0.1;
      ctx.fillStyle = `hsl(${(note * 30) % 360}, 70%, 60%)`;
      ctx.beginPath();
      ctx.arc(i * w + w / 2, y, 3, 0, Math.PI * 2);
      ctx.fill();
      if (i > 0) {
        const py = c.height - (melody[i - 1] / 12) * c.height * 0.8 - c.height * 0.1;
        ctx.strokeStyle = `hsla(${(note * 30) % 360}, 70%, 60%, 0.3)`;
        ctx.beginPath();
        ctx.moveTo((i - 1) * w + w / 2, py);
        ctx.lineTo(i * w + w / 2, y);
        ctx.stroke();
      }
    });
  }

  function highlightMarkovNote(idx) {
    const c = document.getElementById('markov-viz');
    const ctx = c.getContext('2d');
    drawMarkov();
    const w = c.width / melody.length;
    const y = c.height - (melody[idx] / 12) * c.height * 0.8 - c.height * 0.1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(idx * w + w / 2, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
})();

// ============================================================
// 2. L-SYSTEM FRACTAL COMPOSER
// ============================================================
const lsys = (() => {
  let sequence = [];
  let part = null;
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.4 }
  }).toDestination();

  const presets = {
    algae: { axiom: 'A', rules: { A: 'AB', B: 'A' }, map: { A: 0, B: 7 } },
    fibonacci: { axiom: 'A', rules: { A: 'B', B: 'AB' }, map: { A: 0, B: 5 } },
    dragon: { axiom: 'FX', rules: { X: 'X+YF+', Y: '-FX-Y' }, map: { F: 0, X: 4, Y: 7, '+': 2, '-': -2 } },
    plant: { axiom: 'X', rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }, map: { F: 0, X: 3, '[': -5, ']': 5, '+': 2, '-': -1 } }
  };
  let currentPreset = 'algae';

  function expand(axiom, rules, n) {
    let str = axiom;
    for (let i = 0; i < n; i++) {
      str = str.split('').map(c => rules[c] || c).join('');
    }
    return str;
  }

  return {
    setPreset(p) { currentPreset = p; },
    generate() {
      const n = parseInt(document.getElementById('lsys-iter').value);
      const preset = presets[currentPreset];
      const str = expand(preset.axiom, preset.rules, n);
      // Map to notes
      let pitch = 60;
      const stack = [];
      sequence = [];
      for (const ch of str) {
        if (ch === '[') { stack.push(pitch); continue; }
        if (ch === ']') { pitch = stack.pop() || 60; continue; }
        const offset = preset.map[ch];
        if (offset !== undefined) {
          pitch += offset;
          pitch = Math.max(36, Math.min(96, pitch)); // clamp
          sequence.push(pitch);
        }
      }
      // Limit length for playability
      if (sequence.length > 200) sequence = sequence.slice(0, 200);
      drawLsys();
      document.getElementById('lsys-status').textContent =
        `L-system "${currentPreset}" expanded to ${str.length} symbols → ${sequence.length} notes`;
    },
    play() {
      if (!sequence.length) this.generate();
      Tone.start();
      this.stop();
      let i = 0;
      part = new Tone.Loop(time => {
        if (i >= sequence.length) { this.stop(); return; }
        synth.triggerAttackRelease(Tone.Frequency(sequence[i], 'midi').toNote(), '16n', time);
        i++;
      }, '16n').start(0);
      Tone.Transport.bpm.value = 160;
      Tone.Transport.start();
    },
    stop() {
      if (part) { part.stop(); part.dispose(); part = null; }
      Tone.Transport.stop();
    }
  };

  function drawLsys() {
    const c = document.getElementById('lsys-viz');
    const ctx = c.getContext('2d');
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, c.width, c.height);
    if (!sequence.length) return;
    const min = Math.min(...sequence), max = Math.max(...sequence);
    const range = max - min || 1;
    const w = c.width / sequence.length;
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
    ctx.beginPath();
    sequence.forEach((note, i) => {
      const x = i * w + w / 2;
      const y = c.height - ((note - min) / range) * c.height * 0.8 - c.height * 0.1;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    sequence.forEach((note, i) => {
      const x = i * w + w / 2;
      const y = c.height - ((note - min) / range) * c.height * 0.8 - c.height * 0.1;
      ctx.fillStyle = `hsl(${((note - min) / range) * 200 + 180}, 70%, 60%)`;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }
})();

// ============================================================
// 3. CELLULAR AUTOMATA SOUNDSCAPE
// ============================================================
const ca = (() => {
  let grid = [];
  let part = null;
  const synths = [];
  const reverb = new Tone.Reverb({ decay: 3, wet: 0.4 }).toDestination();

  function evolve(rule, cells, generations) {
    const bits = rule.toString(2).padStart(8, '0').split('').map(Number);
    const results = [cells.slice()];
    for (let g = 0; g < generations; g++) {
      const next = new Array(cells.length);
      for (let i = 0; i < cells.length; i++) {
        const l = cells[(i - 1 + cells.length) % cells.length];
        const c = cells[i];
        const r = cells[(i + 1) % cells.length];
        next[i] = bits[7 - (l * 4 + c * 2 + r)];
      }
      cells = next;
      results.push(cells.slice());
    }
    return results;
  }

  function drawCA() {
    const c = document.getElementById('ca-viz');
    const ctx = c.getContext('2d');
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, c.width, c.height);
    if (!grid.length) return;
    const cellW = c.width / grid[0].length;
    const cellH = c.height / grid.length;
    grid.forEach((row, y) => {
      row.forEach((val, x) => {
        if (val) {
          ctx.fillStyle = `hsl(${(x / row.length) * 300 + 200}, 70%, ${50 + y}%)`;
          ctx.fillRect(x * cellW, y * cellH, cellW - 1, cellH - 1);
        }
      });
    });
  }

  // Dorian scale for interesting minor color
  const scaleNotes = [48, 50, 51, 53, 55, 57, 58, 60, 62, 63, 65, 67, 69, 70, 72, 74];

  return {
    generate() {
      const rule = parseInt(document.getElementById('ca-rule').value);
      const nCells = parseInt(document.getElementById('ca-cells').value);
      const init = new Array(nCells).fill(0);
      init[Math.floor(nCells / 2)] = 1; // single seed
      grid = evolve(rule, init, 32);
      drawCA();
      document.getElementById('ca-status').textContent =
        `Rule ${rule}, ${nCells} cells × ${grid.length} generations`;
    },
    play() {
      if (!grid.length) this.generate();
      Tone.start();
      this.stop();
      // Create synths for each cell
      const nCells = grid[0].length;
      for (let i = synths.length; i < nCells; i++) {
        synths.push(new Tone.Synth({
          oscillator: { type: 'sine' },
          envelope: { attack: 0.05, decay: 0.2, sustain: 0.1, release: 0.3 },
          volume: -12
        }).connect(reverb));
      }
      let row = 0;
      const bpm = parseInt(document.getElementById('ca-bpm').value);
      part = new Tone.Loop(time => {
        if (row >= grid.length) { this.stop(); return; }
        grid[row].forEach((val, i) => {
          if (val && i < synths.length) {
            const note = scaleNotes[i % scaleNotes.length];
            synths[i].triggerAttackRelease(Tone.Frequency(note, 'midi').toNote(), '8n', time);
          }
        });
        // Highlight row on canvas
        const c = document.getElementById('ca-viz');
        const ctx = c.getContext('2d');
        const cellH = c.height / grid.length;
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(0, row * cellH, c.width, cellH);
        row++;
      }, '8n').start(0);
      Tone.Transport.bpm.value = bpm;
      Tone.Transport.start();
    },
    stop() {
      if (part) { part.stop(); part.dispose(); part = null; }
      Tone.Transport.stop();
    }
  };
})();

// ============================================================
// 4. EUCLIDEAN RHYTHMS & POLYRHYTHMS
// ============================================================
const euclid = (() => {
  let parts = [];
  const kick = new Tone.MembraneSynth({ volume: -6 }).toDestination();
  const hat = new Tone.MetalSynth({ volume: -12, frequency: 200, envelope: { attack: 0.001, decay: 0.1, release: 0.05 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination();
  const clap = new Tone.NoiseSynth({ volume: -10, noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.1 } }).toDestination();

  function bjorklund(pulses, steps) {
    if (pulses >= steps) return new Array(steps).fill(1);
    if (pulses === 0) return new Array(steps).fill(0);
    let front = Array.from({ length: pulses }, () => [1]);
    let back = Array.from({ length: steps - pulses }, () => [0]);
    while (back.length > 1) {
      const newFront = [];
      const min = Math.min(front.length, back.length);
      for (let i = 0; i < min; i++) {
        newFront.push([...front[i], ...back[i]]);
      }
      const leftover = front.length > min
        ? front.slice(min)
        : back.slice(min);
      front = newFront;
      back = leftover;
    }
    return [...front, ...back].flat();
  }

  function drawEuclid() {
    const c = document.getElementById('euclid-viz');
    const ctx = c.getContext('2d');
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, c.width, c.height);

    const layers = [
      { p: parseInt(document.getElementById('eu-p1').value), s: parseInt(document.getElementById('eu-s1').value), color: '#ff6b9d', label: 'Kick' },
      { p: parseInt(document.getElementById('eu-p2').value), s: parseInt(document.getElementById('eu-s2').value), color: '#60a5fa', label: 'Hat' },
      { p: parseInt(document.getElementById('eu-p3').value), s: parseInt(document.getElementById('eu-s3').value), color: '#c084fc', label: 'Clap' }
    ];

    layers.forEach((layer, li) => {
      const pattern = bjorklund(layer.p, layer.s);
      const cy = (li + 1) * c.height / 4;
      const radius = Math.min(c.height / 5, 60);

      // Draw circle
      ctx.strokeStyle = layer.color + '44';
      ctx.beginPath();
      ctx.arc(c.width / 2, cy, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw pattern text
      ctx.fillStyle = layer.color;
      ctx.font = '11px monospace';
      ctx.fillText(`${layer.label}: E(${layer.p},${layer.s}) = [${pattern.join('')}]`, 10, cy - radius + 5);

      // Draw dots
      pattern.forEach((v, i) => {
        const angle = (i / layer.s) * Math.PI * 2 - Math.PI / 2;
        const x = c.width / 2 + Math.cos(angle) * radius;
        const y = cy + Math.sin(angle) * radius;
        ctx.fillStyle = v ? layer.color : layer.color + '33';
        ctx.beginPath();
        ctx.arc(x, y, v ? 6 : 3, 0, Math.PI * 2);
        ctx.fill();
      });
    });
  }

  return {
    update() { drawEuclid(); },
    setBPM(bpm) { Tone.Transport.bpm.value = parseInt(bpm); },
    play() {
      Tone.start();
      this.stop();
      const bpm = parseInt(document.getElementById('euclid-bpm').value);
      Tone.Transport.bpm.value = bpm;

      const layers = [
        { p: parseInt(document.getElementById('eu-p1').value), s: parseInt(document.getElementById('eu-s1').value), play: (t) => kick.triggerAttackRelease('C1', '8n', t) },
        { p: parseInt(document.getElementById('eu-p2').value), s: parseInt(document.getElementById('eu-s2').value), play: (t) => hat.triggerAttackRelease('16n', t) },
        { p: parseInt(document.getElementById('eu-p3').value), s: parseInt(document.getElementById('eu-s3').value), play: (t) => clap.triggerAttackRelease('16n', t) },
      ];

      layers.forEach((layer, li) => {
        const pattern = bjorklund(layer.p, layer.s);
        let step = 0;
        const p = new Tone.Loop(time => {
          if (pattern[step % pattern.length]) {
            layer.play(time);
          }
          step++;
        }, `${layer.s}n`);
        // Adjust subdivision timing
        p.interval = Tone.Time('1m').toSeconds() / layer.s;
        p.start(0);
        parts.push(p);
      });

      Tone.Transport.start();
      drawEuclid();
      document.getElementById('euclid-status').textContent = 'Playing polyrhythmic pattern...';
    },
    stop() {
      parts.forEach(p => { p.stop(); p.dispose(); });
      parts = [];
      Tone.Transport.stop();
      document.getElementById('euclid-status').textContent = '';
    }
  };
})();

// ============================================================
// 5. MICROTONAL EXPLORER
// ============================================================
const micro = (() => {
  let baseFreq = 261.63;
  let currentTuning = '12tet';
  let part = null;
  const synth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'sine' },
    envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.8 },
    volume: -6
  }).toDestination();

  const tunings = {
    '12tet': { name: '12-TET', notes: n => Array.from({ length: 13 }, (_, i) => baseFreq * Math.pow(2, i / 12)) },
    '19tet': { name: '19-TET', notes: n => Array.from({ length: 20 }, (_, i) => baseFreq * Math.pow(2, i / 19)) },
    '24tet': { name: '24-TET', notes: n => Array.from({ length: 25 }, (_, i) => baseFreq * Math.pow(2, i / 24)) },
    '31tet': { name: '31-TET', notes: n => Array.from({ length: 32 }, (_, i) => baseFreq * Math.pow(2, i / 31)) },
    '53tet': { name: '53-TET', notes: n => Array.from({ length: 54 }, (_, i) => baseFreq * Math.pow(2, i / 53)) },
    'ji': {
      name: 'Just Intonation',
      notes: () => [1, 9/8, 5/4, 4/3, 3/2, 5/3, 15/8, 2].map(r => baseFreq * r)
    },
    'bp': {
      name: 'Bohlen-Pierce (13ed3)',
      notes: () => Array.from({ length: 14 }, (_, i) => baseFreq * Math.pow(3, i / 13))
    },
    'pythagorean': {
      name: 'Pythagorean',
      notes: () => [1, 9/8, 81/64, 4/3, 3/2, 27/16, 243/128, 2].map(r => baseFreq * r)
    }
  };

  function getScaleFreqs() {
    return tunings[currentTuning].notes();
  }

  function drawMicro(freqs, highlight = -1) {
    const c = document.getElementById('micro-viz');
    const ctx = c.getContext('2d');
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, c.width, c.height);

    // Draw frequency bars
    const maxF = Math.max(...freqs);
    const barW = (c.width - 40) / freqs.length;
    freqs.forEach((f, i) => {
      const h = (f / maxF) * c.height * 0.7;
      const x = 20 + i * barW;
      const y = c.height - h - 20;
      ctx.fillStyle = i === highlight ? '#fff' : `hsl(${(i / freqs.length) * 300}, 70%, 55%)`;
      ctx.fillRect(x, y, barW - 2, h);
      // Label
      ctx.fillStyle = '#888';
      ctx.font = '9px monospace';
      ctx.save();
      ctx.translate(x + barW / 2, c.height - 5);
      ctx.rotate(-0.5);
      ctx.fillText(`${f.toFixed(1)}`, 0, 0);
      ctx.restore();
    });

    // Cents from base
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.fillText(`${tunings[currentTuning].name} — ${freqs.length} notes — Base: ${baseFreq.toFixed(2)} Hz`, 20, 15);
  }

  return {
    setTuning(t) { currentTuning = t; drawMicro(getScaleFreqs()); },
    setBase(f) { baseFreq = parseFloat(f); drawMicro(getScaleFreqs()); },
    playScale() {
      Tone.start();
      this.stop();
      const freqs = getScaleFreqs();
      drawMicro(freqs);
      let i = 0;
      part = new Tone.Loop(time => {
        if (i >= freqs.length) { this.stop(); return; }
        synth.triggerAttackRelease(freqs[i], '4n', time);
        drawMicro(freqs, i);
        document.getElementById('micro-status').textContent =
          `Note ${i + 1}/${freqs.length}: ${freqs[i].toFixed(2)} Hz (${(1200 * Math.log2(freqs[i] / baseFreq)).toFixed(1)} cents)`;
        i++;
      }, '4n').start(0);
      Tone.Transport.bpm.value = 100;
      Tone.Transport.start();
    },
    playComparison() {
      Tone.start();
      this.stop();
      const freqs = getScaleFreqs();
      const tet12 = tunings['12tet'].notes();
      const combined = [];
      const maxLen = Math.min(freqs.length, tet12.length);
      for (let i = 0; i < maxLen; i++) {
        combined.push({ freq: freqs[i], type: 'current' });
        combined.push({ freq: tet12[i], type: '12tet' });
      }
      let i = 0;
      part = new Tone.Loop(time => {
        if (i >= combined.length) { this.stop(); return; }
        synth.triggerAttackRelease(combined[i].freq, '8n', time);
        const label = combined[i].type === 'current' ? currentTuning : '12-TET';
        document.getElementById('micro-status').textContent =
          `${label}: ${combined[i].freq.toFixed(2)} Hz`;
        i++;
      }, '4n').start(0);
      Tone.Transport.bpm.value = 120;
      Tone.Transport.start();
    },
    playChord() {
      Tone.start();
      const freqs = getScaleFreqs();
      // Play root, "third", "fifth" equivalent
      const indices = currentTuning === 'bp'
        ? [0, 3, 6] // BP triad
        : currentTuning.includes('tet')
          ? [0, Math.floor(freqs.length * 4 / 12), Math.floor(freqs.length * 7 / 12)]
          : [0, 2, 4]; // JI/pyth: 1, 5/4, 3/2
      const chord = indices.filter(i => i < freqs.length).map(i => freqs[i]);
      chord.forEach(f => synth.triggerAttackRelease(f, '2n'));
      document.getElementById('micro-status').textContent =
        `Chord: ${chord.map(f => f.toFixed(1) + ' Hz').join(', ')}`;
      drawMicro(getScaleFreqs());
    },
    stop() {
      if (part) { part.stop(); part.dispose(); part = null; }
      Tone.Transport.stop();
      document.getElementById('micro-status').textContent = '';
    }
  };
})();

// Init microtonal viz
setTimeout(() => micro.setTuning('12tet'), 100);

// ============================================================
// 6. INTERACTIVE SOUND CANVAS
// ============================================================
const interactive = (() => {
  let enabled = false;
  let synthType = 'fm';
  let scaleType = 'pentatonic';
  let currentSynth = null;
  const filter = new Tone.Filter(2000, 'lowpass').toDestination();
  const delay = new Tone.FeedbackDelay('8n', 0.3).connect(filter);

  const scales = {
    chromatic: [0,1,2,3,4,5,6,7,8,9,10,11],
    pentatonic: [0,2,4,7,9],
    whole: [0,2,4,6,8,10],
    blues: [0,3,5,6,7,10]
  };

  function createSynth(type) {
    if (currentSynth) currentSynth.dispose();
    const opts = { volume: -10 };
    switch (type) {
      case 'fm': currentSynth = new Tone.FMSynth(opts).connect(delay); break;
      case 'am': currentSynth = new Tone.AMSynth(opts).connect(delay); break;
      case 'fat': currentSynth = new Tone.Synth({ ...opts, oscillator: { type: 'fatsawtooth', count: 3, spread: 30 } }).connect(delay); break;
      case 'pluck': currentSynth = new Tone.PluckSynth({ ...opts, attackNoise: 1, resonance: 0.95 }).connect(delay); break;
    }
  }

  function quantize(midi) {
    const scale = scales[scaleType];
    const octave = Math.floor(midi / 12) * 12;
    const note = midi % 12;
    let closest = scale[0];
    let minDist = 99;
    for (const s of scale) {
      if (Math.abs(note - s) < minDist) {
        minDist = Math.abs(note - s);
        closest = s;
      }
    }
    return octave + closest;
  }

  const canvas = document.getElementById('sound-canvas');
  const cursor = document.getElementById('sound-cursor');
  let isDown = false;
  let lastNote = null;

  function handleMove(x, y) {
    if (!enabled) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (x - rect.left) / rect.width;
    const ny = (y - rect.top) / rect.height;

    cursor.style.left = (x - rect.left) + 'px';
    cursor.style.top = (y - rect.top) + 'px';

    // X → pitch (C3 to C6)
    const rawMidi = Math.floor(48 + nx * 36);
    const midi = quantize(rawMidi);
    // Y → filter cutoff
    const cutoff = 200 + (1 - ny) * 8000;
    filter.frequency.rampTo(cutoff, 0.05);

    if (isDown && midi !== lastNote) {
      if (currentSynth instanceof Tone.PluckSynth) {
        currentSynth.triggerAttack(Tone.Frequency(midi, 'midi').toNote());
      } else {
        currentSynth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), '16n');
      }
      lastNote = midi;
    }

    document.getElementById('interact-status').textContent =
      `Note: ${Tone.Frequency(midi, 'midi').toNote()} | Filter: ${cutoff.toFixed(0)} Hz | Pos: (${nx.toFixed(2)}, ${ny.toFixed(2)})`;
  }

  canvas.addEventListener('mousedown', (e) => { isDown = true; handleMove(e.clientX, e.clientY); });
  canvas.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
  canvas.addEventListener('mouseup', () => { isDown = false; lastNote = null; });
  canvas.addEventListener('mouseleave', () => { isDown = false; lastNote = null; });

  // Touch
  canvas.addEventListener('touchstart', (e) => { e.preventDefault(); isDown = true; handleMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  canvas.addEventListener('touchmove', (e) => { e.preventDefault(); handleMove(e.touches[0].clientX, e.touches[0].clientY); }, { passive: false });
  canvas.addEventListener('touchend', () => { isDown = false; lastNote = null; });

  return {
    toggle() {
      Tone.start();
      enabled = !enabled;
      const btn = document.getElementById('interact-toggle');
      btn.textContent = enabled ? '🔇 Disable Sound' : '🔊 Enable Sound';
      btn.classList.toggle('active', enabled);
      if (enabled && !currentSynth) createSynth(synthType);
    },
    setSynth(type) { synthType = type; createSynth(type); },
    setScale(s) { scaleType = s; }
  };
})();

// ============================================================
// 7. DATA SONIFICATION
// ============================================================
const sonify = (() => {
  let data = [];
  let timeout = null;
  const synth = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.15, sustain: 0.1, release: 0.3 },
    volume: -8
  }).toDestination();

  const generators = {
    fibonacci: (n) => {
      const fib = [1, 1];
      for (let i = 2; i < n; i++) fib.push(fib[i-1] + fib[i-2]);
      return fib;
    },
    primes: (n) => {
      const primes = [];
      for (let num = 2; primes.length < n; num++) {
        if (primes.every(p => num % p !== 0)) primes.push(num);
      }
      return primes;
    },
    pi: (n) => {
      const digits = '31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679';
      return digits.slice(0, n).split('').map(Number);
    },
    collatz: (n) => {
      const seq = [27];
      let x = 27;
      for (let i = 0; i < n - 1 && x > 1; i++) {
        x = x % 2 === 0 ? x / 2 : 3 * x + 1;
        seq.push(x);
      }
      return seq;
    },
    logistic: (n) => {
      const r = 3.99; // chaotic regime
      const seq = [0.1];
      for (let i = 1; i < n; i++) {
        const prev = seq[i - 1];
        seq.push(r * prev * (1 - prev));
      }
      return seq;
    },
    sine: (n) => Array.from({ length: n }, (_, i) => Math.sin(i * 0.3) * 0.5 + 0.5)
  };

  function normalize(arr) {
    const min = Math.min(...arr), max = Math.max(...arr);
    const range = max - min || 1;
    return arr.map(v => (v - min) / range);
  }

  function drawSonify(highlight = -1) {
    const c = document.getElementById('sonify-viz');
    const ctx = c.getContext('2d');
    c.width = c.offsetWidth; c.height = c.offsetHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, 0, c.width, c.height);
    if (!data.length) return;
    const norm = normalize(data);
    const barW = c.width / data.length;
    norm.forEach((v, i) => {
      const h = v * c.height * 0.8;
      const x = i * barW;
      const y = c.height - h - 10;
      ctx.fillStyle = i === highlight
        ? '#fff'
        : `hsl(${v * 270}, 70%, 55%)`;
      ctx.fillRect(x, y, barW - 1, h);
    });
  }

  return {
    setData(type) {
      const n = parseInt(document.getElementById('sonify-points').value);
      data = generators[type](n);
      drawSonify();
      document.getElementById('sonify-status').textContent =
        `${type}: ${data.length} data points, range [${Math.min(...data).toFixed(2)}, ${Math.max(...data).toFixed(2)}]`;
    },
    play() {
      Tone.start();
      this.stop();
      if (!data.length) this.setData(document.getElementById('sonify-data').value);
      const norm = normalize(data);
      const speed = parseInt(document.getElementById('sonify-speed').value);
      let i = 0;

      const step = () => {
        if (i >= norm.length) { this.stop(); return; }
        // Map normalized value to MIDI range C3-C6
        const midi = Math.round(48 + norm[i] * 36);
        const vol = -20 + norm[i] * 15;
        synth.volume.value = vol;
        synth.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), speed / 1000);
        drawSonify(i);
        document.getElementById('sonify-status').textContent =
          `[${i + 1}/${data.length}] Value: ${data[i].toFixed(4)} → ${Tone.Frequency(midi, 'midi').toNote()}`;
        i++;
        timeout = setTimeout(step, speed);
      };
      step();
    },
    stop() {
      if (timeout) { clearTimeout(timeout); timeout = null; }
      document.getElementById('sonify-status').textContent = '';
    }
  };
})();

// Init default sonification
setTimeout(() => sonify.setData('fibonacci'), 200);

console.log('✧ Experimental Music Lab loaded! ✧');
