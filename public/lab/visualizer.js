// ✧ Audio Visualizer — p5.js + Tone.js ✧

// ─── Color Palettes ───
const palettes = {
  evey:   { bg: [10,10,15], colors: [[180,160,255],[130,100,230],[100,180,255],[220,200,255],[80,60,180]] },
  sakura: { bg: [15,8,12],  colors: [[255,150,180],[255,100,150],[255,200,210],[230,130,170],[180,80,120]] },
  ocean:  { bg: [5,10,18],  colors: [[60,180,255],[30,140,220],[100,220,255],[20,100,180],[80,200,240]] },
  fire:   { bg: [15,8,5],   colors: [[255,120,30],[255,80,20],[255,180,60],[255,50,10],[255,200,100]] },
  matrix: { bg: [5,12,5],   colors: [[30,255,80],[20,200,60],[60,255,120],[15,150,40],[80,255,160]] },
  rainbow:{ bg: [10,10,15], colors: [[255,80,80],[255,180,50],[80,255,120],[80,180,255],[200,100,255]] }
};

// ─── State ───
let fft, waveform, analyzer, player, mic, liveSynth;
let p5Instance = null;
let isRunning = false;
let currentMode = 'bloom';
let currentPalette = 'evey';
let synthNoteOn = false;

// Particle system (shared across modes)
let particles = [];

class Particle {
  constructor(p, x, y, vx, vy, size, col, life) {
    this.p = p; this.x = x; this.y = y;
    this.vx = vx; this.vy = vy;
    this.size = size; this.col = col;
    this.life = life; this.maxLife = life;
  }
  update() {
    this.x += this.vx; this.y += this.vy;
    this.vy += 0.02; // slight gravity
    this.life--;
    this.vx *= 0.99;
  }
  draw() {
    const alpha = (this.life / this.maxLife) * 200;
    const p = this.p;
    p.noStroke();
    p.fill(this.col[0], this.col[1], this.col[2], alpha);
    p.ellipse(this.x, this.y, this.size * (this.life / this.maxLife));
  }
  isDead() { return this.life <= 0; }
}

// ─── Visualizer Control ───
const vizControl = {
  async start() {
    await Tone.start();
    const source = document.getElementById('viz-source').value;
    currentMode = document.getElementById('viz-mode').value;
    currentPalette = document.getElementById('viz-palette').value;

    // Clean up previous
    this.stop();

    // Create analyzers
    fft = new Tone.FFT(256);
    waveform = new Tone.Waveform(256);

    // Connect source
    if (source === 'composition') {
      const track = document.getElementById('viz-track').value;
      player = new Tone.Player(track).toDestination();
      player.connect(fft);
      player.connect(waveform);
      await Tone.loaded();
      player.start();
      document.getElementById('viz-status').textContent = `playing: ${track.split('/').pop().replace('.mp3', '')}`;
    } else if (source === 'mic') {
      mic = new Tone.UserMedia();
      await mic.open();
      mic.connect(fft);
      mic.connect(waveform);
      document.getElementById('viz-status').textContent = 'listening to microphone...';
    } else if (source === 'synth') {
      const wave = document.getElementById('synth-wave').value;
      liveSynth = new Tone.Synth({
        oscillator: { type: wave },
        envelope: { attack: 0.1, decay: 0.3, sustain: 0.6, release: 0.8 },
        volume: -6
      }).toDestination();
      liveSynth.connect(fft);
      liveSynth.connect(waveform);
      document.getElementById('viz-status').textContent = 'synth ready — click canvas to play';
    }

    isRunning = true;
    particles = [];

    // Create p5 sketch
    if (p5Instance) p5Instance.remove();
    p5Instance = new p5(sketch, document.getElementById('viz-canvas-container'));

    document.getElementById('viz-start').textContent = '● live';
    document.getElementById('viz-start').style.color = '#4ade80';
  },

  stop() {
    isRunning = false;
    if (player) { player.stop(); player.dispose(); player = null; }
    if (mic) { mic.close(); mic.dispose(); mic = null; }
    if (liveSynth) { liveSynth.dispose(); liveSynth = null; }
    if (fft) { fft.dispose(); fft = null; }
    if (waveform) { waveform.dispose(); waveform = null; }
    synthNoteOn = false;
    document.getElementById('viz-status').textContent = 'stopped';
    document.getElementById('viz-start').textContent = '▶ start';
    document.getElementById('viz-start').style.color = '';
    document.getElementById('viz-fps').textContent = '';
  },

  updateSynth() {
    if (!liveSynth) return;
    const wave = document.getElementById('synth-wave').value;
    liveSynth.oscillator.type = wave;
  },

  screenshot() {
    if (p5Instance) p5Instance.saveCanvas('evey-visualizer', 'png');
  }
};

// Source selector: show/hide synth controls
document.getElementById('viz-source').addEventListener('change', (e) => {
  document.getElementById('synth-controls').style.display = e.target.value === 'synth' ? 'flex' : 'none';
  document.getElementById('comp-select-group').style.display = e.target.value === 'composition' ? 'flex' : 'none';
});

// Live mode/palette switching
document.getElementById('viz-mode').addEventListener('change', (e) => { currentMode = e.target.value; particles = []; });
document.getElementById('viz-palette').addEventListener('change', (e) => { currentPalette = e.target.value; });

// ─── p5 Sketch ───
function sketch(p) {
  let w, h;
  // Terrain state
  let terrainOffset = 0;

  p.setup = function() {
    const container = document.getElementById('viz-canvas-container');
    w = container.offsetWidth;
    h = container.offsetHeight;
    p.createCanvas(w, h);
    p.colorMode(p.RGB, 255);
    p.textFont('monospace');
  };

  p.draw = function() {
    if (!isRunning || !fft || !waveform) return;

    const pal = palettes[currentPalette];
    const fftData = fft.getValue(); // dB values (-100 to 0)
    const waveData = waveform.getValue(); // -1 to 1

    // Normalize FFT to 0-1
    const fftNorm = fftData.map(v => Math.max(0, (v + 100) / 100));
    const energy = fftNorm.reduce((a, b) => a + b, 0) / fftNorm.length;

    // Draw based on mode
    switch (currentMode) {
      case 'bloom': drawBloom(p, w, h, pal, waveData, fftNorm, energy); break;
      case 'aurora': drawAurora(p, w, h, pal, fftNorm, energy); break;
      case 'particles': drawParticles(p, w, h, pal, fftNorm, energy); break;
      case 'rings': drawRings(p, w, h, pal, fftNorm, energy); break;
      case 'terrain': drawTerrain(p, w, h, pal, fftNorm, energy); terrainOffset += 0.03; break;
      case 'kaleidoscope': drawKaleidoscope(p, w, h, pal, waveData, fftNorm, energy); break;
    }

    // FPS counter
    if (p.frameCount % 30 === 0) {
      document.getElementById('viz-fps').textContent = `${Math.round(p.frameRate())} fps`;
    }
  };

  p.mousePressed = function() {
    if (!liveSynth) return;
    if (p.mouseX < 0 || p.mouseX > w || p.mouseY < 0 || p.mouseY > h) return;
    const note = document.getElementById('synth-note').value;
    if (synthNoteOn) {
      liveSynth.triggerRelease();
      synthNoteOn = false;
    } else {
      liveSynth.triggerAttack(note);
      synthNoteOn = true;
    }
  };

  p.windowResized = function() {
    const container = document.getElementById('viz-canvas-container');
    w = container.offsetWidth;
    h = container.offsetHeight;
    p.resizeCanvas(w, h);
  };

  // ═══════════════════════════════════════════
  // MODE 1: Waveform Bloom
  // ═══════════════════════════════════════════
  function drawBloom(p, w, h, pal, waveData, fftNorm, energy) {
    p.background(pal.bg[0], pal.bg[1], pal.bg[2], 25);

    const cx = w / 2, cy = h / 2;
    const baseRadius = Math.min(w, h) * 0.2;
    const layers = 5;

    for (let layer = 0; layer < layers; layer++) {
      const col = pal.colors[layer % pal.colors.length];
      const layerEnergy = fftNorm[Math.floor(layer * fftNorm.length / layers)] || 0;
      const radius = baseRadius + layer * 30 + layerEnergy * 100;

      p.push();
      p.translate(cx, cy);
      p.rotate(p.frameCount * 0.003 * (layer % 2 === 0 ? 1 : -1));
      p.noFill();
      p.strokeWeight(1.5 + energy * 3);
      p.stroke(col[0], col[1], col[2], 120 - layer * 15);

      p.beginShape();
      for (let i = 0; i < waveData.length; i++) {
        const angle = (i / waveData.length) * p.TWO_PI;
        const r = radius + waveData[i] * (60 + energy * 80);
        const x = Math.cos(angle) * r;
        const y = Math.sin(angle) * r;
        p.curveVertex(x, y);
      }
      p.endShape(p.CLOSE);
      p.pop();
    }

    // Center glow
    const glowSize = 20 + energy * 80;
    const col = pal.colors[0];
    for (let i = 3; i > 0; i--) {
      p.noStroke();
      p.fill(col[0], col[1], col[2], 10 * i);
      p.ellipse(cx, cy, glowSize * i, glowSize * i);
    }
  }

  // ═══════════════════════════════════════════
  // MODE 2: FFT Aurora
  // ═══════════════════════════════════════════
  function drawAurora(p, w, h, pal, fftNorm, energy) {
    p.background(pal.bg[0], pal.bg[1], pal.bg[2], 30);

    const bands = 64;
    const bandW = w / bands;

    for (let i = 0; i < bands; i++) {
      const val = fftNorm[Math.floor(i * fftNorm.length / bands)] || 0;
      const colIdx = Math.floor((i / bands) * pal.colors.length);
      const col = pal.colors[Math.min(colIdx, pal.colors.length - 1)];
      const barH = val * h * 0.8;

      // Gradient bars from bottom
      for (let y = h; y > h - barH; y -= 4) {
        const alpha = ((h - y) / barH) * 150 * val;
        const drift = Math.sin(p.frameCount * 0.02 + i * 0.2) * 10;
        p.noStroke();
        p.fill(col[0], col[1], col[2], alpha);
        p.rect(i * bandW + drift, y, bandW - 1, 3);
      }

      // Top wisp
      if (val > 0.3) {
        const wispY = h - barH + Math.sin(p.frameCount * 0.05 + i) * 20;
        const wispAlpha = (val - 0.3) * 200;
        p.fill(col[0], col[1], col[2], wispAlpha);
        p.ellipse(i * bandW + bandW / 2, wispY, bandW * 2 + val * 20, 8);
      }
    }

    // Horizon line glow
    p.noStroke();
    for (let i = 0; i < 3; i++) {
      p.fill(pal.colors[0][0], pal.colors[0][1], pal.colors[0][2], 15 - i * 4);
      p.rect(0, h - 2 - i * 6, w, 4 + i * 4);
    }
  }

  // ═══════════════════════════════════════════
  // MODE 3: Particle Field
  // ═══════════════════════════════════════════
  function drawParticles(p, w, h, pal, fftNorm, energy) {
    p.background(pal.bg[0], pal.bg[1], pal.bg[2], 40);

    // Spawn particles from frequency bands
    const spawnRate = Math.floor(energy * 15) + 1;
    for (let s = 0; s < spawnRate; s++) {
      const band = Math.floor(Math.random() * fftNorm.length);
      const val = fftNorm[band];
      if (val < 0.15) continue;

      const col = pal.colors[Math.floor(Math.random() * pal.colors.length)];
      const x = (band / fftNorm.length) * w;
      const y = h * 0.6;
      const angle = -p.HALF_PI + (Math.random() - 0.5) * 1.5;
      const speed = val * 5 + 1;
      const size = val * 15 + 3;
      const life = 60 + Math.floor(val * 120);

      particles.push(new Particle(p, x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, size, col, life));
    }

    // Update & draw
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw();
      if (particles[i].isDead()) particles.splice(i, 1);
    }

    // Limit particles
    if (particles.length > 800) particles.splice(0, particles.length - 800);

    // Ground reflection
    p.noStroke();
    p.fill(pal.colors[0][0], pal.colors[0][1], pal.colors[0][2], 8);
    p.rect(0, h * 0.6, w, 2);
  }

  // ═══════════════════════════════════════════
  // MODE 4: Frequency Rings
  // ═══════════════════════════════════════════
  function drawRings(p, w, h, pal, fftNorm, energy) {
    p.background(pal.bg[0], pal.bg[1], pal.bg[2], 20);

    const cx = w / 2, cy = h / 2;
    const maxRadius = Math.min(w, h) * 0.45;
    const numRings = 16;

    for (let r = 0; r < numRings; r++) {
      const bandIdx = Math.floor(r * fftNorm.length / numRings);
      const val = fftNorm[bandIdx] || 0;
      const radius = (r / numRings) * maxRadius + val * 40;
      const col = pal.colors[r % pal.colors.length];
      const alpha = 40 + val * 160;

      p.push();
      p.translate(cx, cy);
      p.rotate(p.frameCount * 0.005 * (r % 2 === 0 ? 1 : -1));

      p.noFill();
      p.strokeWeight(1 + val * 4);
      p.stroke(col[0], col[1], col[2], alpha);

      // Draw ring with wobble
      p.beginShape();
      const segments = 60;
      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * p.TWO_PI;
        const wobble = Math.sin(angle * 3 + p.frameCount * 0.05 + r) * val * 15;
        const rx = Math.cos(angle) * (radius + wobble);
        const ry = Math.sin(angle) * (radius + wobble);
        p.vertex(rx, ry);
      }
      p.endShape(p.CLOSE);

      // Dots on ring at high energy points
      if (val > 0.4) {
        p.noStroke();
        p.fill(col[0], col[1], col[2], 200);
        const numDots = Math.floor(val * 8);
        for (let d = 0; d < numDots; d++) {
          const angle = (d / numDots) * p.TWO_PI + p.frameCount * 0.01;
          const dx = Math.cos(angle) * radius;
          const dy = Math.sin(angle) * radius;
          p.ellipse(dx, dy, 3 + val * 4);
        }
      }
      p.pop();
    }
  }

  // ═══════════════════════════════════════════
  // MODE 5: Audio Terrain
  // ═══════════════════════════════════════════
  function drawTerrain(p, w, h, pal, fftNorm, energy) {
    p.background(pal.bg[0], pal.bg[1], pal.bg[2]);

    const rows = 30;
    const cols = fftNorm.length;
    const rowSpacing = h / (rows + 5);
    const colSpacing = w / cols;

    for (let row = 0; row < rows; row++) {
      const y = row * rowSpacing + h * 0.15;
      const depth = row / rows;
      const col = pal.colors[Math.floor(depth * (pal.colors.length - 1))];
      const alpha = 40 + depth * 160;

      p.noFill();
      p.strokeWeight(0.8 + depth * 1.5);
      p.stroke(col[0], col[1], col[2], alpha);

      p.beginShape();
      for (let c = 0; c < cols; c++) {
        const x = c * colSpacing;
        const fftIdx = c;
        const val = fftNorm[fftIdx] || 0;
        const noiseVal = p.noise(c * 0.1, row * 0.2 + terrainOffset);
        const elevation = val * 60 * depth + noiseVal * 20 * depth;
        p.vertex(x, y - elevation);
      }
      p.endShape();
    }

    // Horizon glow
    p.noStroke();
    const gc = pal.colors[0];
    for (let i = 0; i < 5; i++) {
      p.fill(gc[0], gc[1], gc[2], 8 - i);
      p.ellipse(w / 2, h * 0.1, w * 0.6 + energy * 100, 30 + i * 15);
    }
  }

  // ═══════════════════════════════════════════
  // MODE 6: Kaleidoscope (Sacred Geometry)
  // ═══════════════════════════════════════════
  // Persistent state for kaleidoscope
  let kParticles = [];
  let kHistory = []; // trailing waveform history for depth
  const K_HISTORY_LEN = 12;

  function drawKaleidoscope(p, w, h, pal, waveData, fftNorm, energy) {
    // Very slow fade for gorgeous trails
    p.background(pal.bg[0], pal.bg[1], pal.bg[2], 12 + (1 - energy) * 10);

    const cx = w / 2, cy = h / 2;
    const segments = 12;
    const angleStep = p.TWO_PI / segments;
    const maxR = Math.min(w, h) * 0.44;
    const t = p.frameCount * 0.008; // slow master clock

    // Store waveform history for layered depth
    kHistory.unshift(waveData.slice());
    if (kHistory.length > K_HISTORY_LEN) kHistory.pop();

    // Split FFT into bass/mid/high bands
    const third = Math.floor(fftNorm.length / 3);
    const bass = fftNorm.slice(0, third).reduce((a,b) => a+b, 0) / third;
    const mid = fftNorm.slice(third, third*2).reduce((a,b) => a+b, 0) / third;
    const high = fftNorm.slice(third*2).reduce((a,b) => a+b, 0) / third;

    p.push();
    p.translate(cx, cy);

    // ── Layer 0: Background sacred geometry grid ──
    // Slowly rotating hexagonal grid that breathes with bass
    p.push();
    p.rotate(t * 0.3);
    const gridCol = pal.colors[4 % pal.colors.length];
    p.noFill();
    p.strokeWeight(0.5);
    p.stroke(gridCol[0], gridCol[1], gridCol[2], 15 + bass * 30);
    for (let ring = 1; ring <= 6; ring++) {
      const r = ring * maxR / 6 * (0.8 + bass * 0.4);
      // Hexagons
      p.beginShape();
      for (let v = 0; v <= 6; v++) {
        const a = v * p.TWO_PI / 6;
        p.vertex(Math.cos(a) * r, Math.sin(a) * r);
      }
      p.endShape(p.CLOSE);
      // Connecting lines to next ring
      if (ring < 6) {
        for (let v = 0; v < 6; v++) {
          const a = v * p.TWO_PI / 6;
          const r2 = (ring + 1) * maxR / 6 * (0.8 + bass * 0.4);
          p.line(Math.cos(a) * r, Math.sin(a) * r, Math.cos(a) * r2, Math.sin(a) * r2);
        }
      }
    }
    p.pop();

    // ── Layer 1: Mandala rings — FFT frequency bands as concentric ornate rings ──
    const numRings = 8;
    for (let ri = 0; ri < numRings; ri++) {
      const bandIdx = Math.floor(ri * fftNorm.length / numRings);
      const val = fftNorm[bandIdx] || 0;
      const baseR = (ri + 1) * maxR / (numRings + 1);
      const r = baseR + val * 25;
      const col = pal.colors[ri % pal.colors.length];
      const alpha = 30 + val * 120;
      const dotCount = 6 + ri * 4; // more dots on outer rings
      const rotDir = ri % 2 === 0 ? 1 : -1;

      p.push();
      p.rotate(t * (0.5 + ri * 0.15) * rotDir);

      // Ornate ring: alternating petals and dots
      p.noFill();
      p.strokeWeight(0.8 + val * 2.5);
      p.stroke(col[0], col[1], col[2], alpha);

      // Petal ring
      p.beginShape();
      const petalCount = dotCount;
      const pts = petalCount * 4;
      for (let i = 0; i <= pts; i++) {
        const a = (i / pts) * p.TWO_PI;
        const petalPhase = Math.sin(a * petalCount);
        const petalR = r + petalPhase * (8 + val * 20);
        p.curveVertex(Math.cos(a) * petalR, Math.sin(a) * petalR);
      }
      p.endShape(p.CLOSE);

      // Gemstone dots at petal peaks
      if (val > 0.15) {
        p.noStroke();
        for (let d = 0; d < dotCount; d++) {
          const a = (d / dotCount) * p.TWO_PI;
          const dr = r + 8 + val * 20;
          const dx = Math.cos(a) * dr;
          const dy = Math.sin(a) * dr;
          const dotSize = 2 + val * 5;
          // Glowing dot: two layers
          p.fill(col[0], col[1], col[2], alpha * 0.3);
          p.ellipse(dx, dy, dotSize * 3);
          p.fill(col[0], col[1], col[2], alpha);
          p.ellipse(dx, dy, dotSize);
        }
      }
      p.pop();
    }

    // ── Layer 2: Mirrored waveform petals with history trails ──
    for (let hi = Math.min(kHistory.length - 1, K_HISTORY_LEN - 1); hi >= 0; hi--) {
      const wave = kHistory[hi];
      if (!wave) continue;
      const age = hi / K_HISTORY_LEN; // 0 = newest, 1 = oldest
      const trailAlpha = (1 - age) * 0.8;

      for (let seg = 0; seg < segments; seg++) {
        p.push();
        p.rotate(seg * angleStep + t * 0.2);
        if (seg % 2 === 1) p.scale(1, -1);

        const col = pal.colors[(seg + hi) % pal.colors.length];
        p.noFill();
        p.strokeWeight(0.6 + (1 - age) * (1 + energy * 1.5));
        p.stroke(col[0], col[1], col[2], trailAlpha * (50 + energy * 60));

        p.beginShape();
        const step = 2; // skip samples for smoother curves
        for (let i = 0; i < wave.length / 2; i += step) {
          const norm = i / (wave.length / 2);
          const r = 20 + norm * maxR * 0.85;
          const a = norm * angleStep * 0.9;
          const waveOff = wave[i] * (20 + energy * 45) * (1 - age * 0.6);
          const fftMod = (fftNorm[Math.floor(norm * fftNorm.length)] || 0) * 15;
          const spiralR = r + waveOff + fftMod;
          p.curveVertex(Math.cos(a) * spiralR, Math.sin(a) * spiralR);
        }
        p.endShape();
        p.pop();
      }
    }

    // ── Layer 3: Frequency-reactive particle sparks along symmetry axes ──
    // Spawn particles on beats (bass > threshold)
    if (bass > 0.35) {
      const spawnCount = Math.floor(bass * 6);
      for (let s = 0; s < spawnCount; s++) {
        const seg = Math.floor(Math.random() * segments);
        const a = seg * angleStep + t * 0.2;
        const r = 30 + Math.random() * maxR * 0.7;
        const col = pal.colors[Math.floor(Math.random() * pal.colors.length)];
        const speed = 0.3 + bass * 2;
        const outward = Math.random() > 0.3 ? 1 : -0.5; // mostly outward
        kParticles.push({
          x: Math.cos(a) * r,
          y: Math.sin(a) * r,
          vx: Math.cos(a) * speed * outward + (Math.random() - 0.5) * 0.5,
          vy: Math.sin(a) * speed * outward + (Math.random() - 0.5) * 0.5,
          size: 2 + Math.random() * 4 + high * 5,
          col: col,
          life: 40 + Math.floor(Math.random() * 60),
          maxLife: 40 + Math.floor(Math.random() * 60)
        });
      }
    }

    // Spawn gentle ambient particles on mid frequencies
    if (mid > 0.2 && p.frameCount % 3 === 0) {
      const a = Math.random() * p.TWO_PI;
      const r = maxR * 0.3 + Math.random() * maxR * 0.5;
      const col = pal.colors[Math.floor(Math.random() * pal.colors.length)];
      kParticles.push({
        x: Math.cos(a) * r,
        y: Math.sin(a) * r,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: 1.5 + mid * 3,
        col: col,
        life: 80 + Math.floor(Math.random() * 80),
        maxLife: 80 + Math.floor(Math.random() * 80)
      });
    }

    // Update & draw particles
    p.noStroke();
    for (let i = kParticles.length - 1; i >= 0; i--) {
      const pt = kParticles[i];
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.vx *= 0.98;
      pt.vy *= 0.98;
      pt.life--;

      const alpha = (pt.life / pt.maxLife);
      const sz = pt.size * alpha;

      // Outer glow
      p.fill(pt.col[0], pt.col[1], pt.col[2], alpha * 25);
      p.ellipse(pt.x, pt.y, sz * 4);
      // Core
      p.fill(pt.col[0], pt.col[1], pt.col[2], alpha * 180);
      p.ellipse(pt.x, pt.y, sz);
      // Hot center
      p.fill(255, 255, 255, alpha * 100);
      p.ellipse(pt.x, pt.y, sz * 0.3);

      if (pt.life <= 0) kParticles.splice(i, 1);
    }
    if (kParticles.length > 500) kParticles.splice(0, kParticles.length - 500);

    // ── Layer 4: Breathing central mandala core ──
    const breathe = Math.sin(t * 2) * 0.3 + 0.7; // slow breath
    const coreSize = 15 + energy * 40 + bass * 30;

    // Outer glow rings
    for (let g = 5; g > 0; g--) {
      const gc = pal.colors[g % pal.colors.length];
      p.fill(gc[0], gc[1], gc[2], (6 - g) * 3 + energy * 8);
      p.ellipse(0, 0, coreSize * g * breathe * 1.8);
    }

    // Inner rotating star
    p.push();
    p.rotate(-t * 1.5);
    const starPoints = 6;
    const innerR = coreSize * 0.3;
    const outerR = coreSize * 0.7 * breathe;
    const cc = pal.colors[0];
    p.fill(cc[0], cc[1], cc[2], 60 + energy * 80);
    p.noStroke();
    p.beginShape();
    for (let i = 0; i < starPoints * 2; i++) {
      const a = (i / (starPoints * 2)) * p.TWO_PI;
      const r = i % 2 === 0 ? outerR : innerR;
      p.vertex(Math.cos(a) * r, Math.sin(a) * r);
    }
    p.endShape(p.CLOSE);
    p.pop();

    // Central bright dot
    p.fill(255, 255, 255, 80 + energy * 120);
    p.ellipse(0, 0, 4 + energy * 8);

    // ── Layer 5: Thin golden-ratio spiral lines (subtle, always present) ──
    const phi = (1 + Math.sqrt(5)) / 2;
    p.noFill();
    p.strokeWeight(0.4);
    for (let s = 0; s < 2; s++) {
      const sc = pal.colors[(s + 2) % pal.colors.length];
      p.stroke(sc[0], sc[1], sc[2], 20 + energy * 25);
      p.beginShape();
      for (let i = 0; i < 200; i++) {
        const a = i * phi * 0.1 + t * (s === 0 ? 1 : -1);
        const r = i * maxR / 200 * (0.8 + energy * 0.2);
        p.curveVertex(Math.cos(a) * r, Math.sin(a) * r);
      }
      p.endShape();
    }

    p.pop();
  }
}

console.log('✧ Visualizer loaded! ✧');
