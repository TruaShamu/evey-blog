#!/usr/bin/env python3
"""Generate MIDI compositions for Evey's blog.
Usage: python3 generate_music.py <output_dir> <number> <title> <mood> [--soundfont NAME] [--techniques T1,T2]
Outputs: {number}-{slug}.mid and {number}-{slug}.mp3

Soundfonts:
  fluidr3   — FluidR3_GM (balanced, good for ambient/classical)
  arachno   — Arachno (punchy, good for electronic/game)
  weeds     — WeedsGM3 (warm, good for orchestral)

Techniques (comma-separated):
  counterpoint    — add a second melodic voice
  arpeggios       — arpeggiated chord patterns
  ostinato        — repeating rhythmic figure
  call_response   — melodic call and response between tracks
  polyrhythm      — different time divisions between tracks
  dynamics_swell  — crescendo/decrescendo waves
  modal_mixture   — borrow notes from parallel modes
  pedal_tone      — sustained bass note under changing harmony
  suspensions     — delayed chord resolutions
"""
import sys, os, random, math, argparse
from midiutil import MIDIFile

SOUNDFONTS = {
    "fluidr3": "/usr/share/sounds/sf2/FluidR3_GM.sf2",
    "arachno": "/usr/share/sounds/sf2/Arachno.sf2",
    "weeds": "/usr/share/sounds/sf2/WeedsGM3.sf2",
}

# Mood -> recommended soundfont
MOOD_SOUNDFONT = {
    "contemplative": "fluidr3",
    "melancholic": "fluidr3",
    "ethereal": "fluidr3",
    "nocturnal": "arachno",
    "hopeful": "weeds",
    "mysterious": "arachno",
    "triumphant": "weeds",
    "anxious": "arachno",
    "serene": "fluidr3",
    "cosmic": "arachno",
    "bittersweet": "weeds",
    "dreamlike": "fluidr3",
}

# Extended scales
SCALES = {
    "contemplative": [0, 2, 4, 7, 9],          # major pentatonic
    "melancholic": [0, 2, 3, 5, 7, 8, 10],     # natural minor
    "ethereal": [0, 2, 4, 6, 7, 9, 11],        # lydian
    "nocturnal": [0, 1, 3, 5, 7, 8, 10],       # phrygian
    "hopeful": [0, 2, 4, 5, 7, 9, 11],         # major/ionian
    "mysterious": [0, 1, 4, 5, 7, 8, 11],      # double harmonic
    "triumphant": [0, 2, 4, 5, 7, 9, 11],      # major
    "anxious": [0, 1, 3, 4, 6, 7, 9, 10],      # diminished (octatonic)
    "serene": [0, 2, 4, 7, 9],                  # major pentatonic
    "cosmic": [0, 2, 3, 6, 7, 9, 10],          # hungarian minor
    "bittersweet": [0, 2, 3, 5, 7, 9, 10],     # dorian
    "dreamlike": [0, 2, 4, 6, 8, 10],          # whole tone
}

# Instruments by character
PADS = [89, 90, 91, 92, 93, 94, 95, 88]  # various synth pads
LEADS = [11, 46, 73, 76, 79, 80, 88, 99, 100, 101]  # vibes, harp, flute, pan, whistle, pad, fx
BASS_INSTRUMENTS = [32, 33, 38, 39, 42, 43, 87]  # acoustic/electric/synth bass
PLUCKS = [24, 25, 45, 46, 104, 105]  # guitars, pizzicato, harp, sitar, banjo


def slugify(s):
    return s.lower().replace(' ', '-').replace("'", '').replace('"', '').replace(',', '')


def get_note_in_scale(scale, root, target_pitch, direction=0):
    """Get the nearest scale tone to target_pitch, optionally biased up/down."""
    candidates = []
    for octave in range(-1, 8):
        for degree in scale:
            candidates.append(root + octave * 12 + degree)
    candidates = [c for c in candidates if 24 <= c <= 108]
    if direction > 0:
        candidates = [c for c in candidates if c >= target_pitch]
    elif direction < 0:
        candidates = [c for c in candidates if c <= target_pitch]
    if not candidates:
        candidates = [root + 60]
    return min(candidates, key=lambda c: abs(c - target_pitch))


def add_pad_track(midi, track, channel, scale, root, duration, mood):
    """Warm pad/drone chords."""
    midi.addProgramChange(track, channel, 0, random.choice(PADS))
    t = 0
    while t < duration:
        n_notes = random.choice([2, 3, 3, 4])
        chord_degrees = sorted(random.sample(scale, min(n_notes, len(scale))))
        hold = random.choice([4, 6, 8, 10, 12])
        vel_base = random.randint(35, 60)

        for deg in chord_degrees:
            octave_shift = random.choice([0, 0, 12, -12])
            pitch = root + deg + octave_shift
            pitch = max(36, min(96, pitch))
            vel = vel_base + random.randint(-8, 8)
            midi.addNote(track, channel, pitch, t, hold + random.uniform(-0.5, 1.5), max(1, vel))

        t += hold * random.uniform(0.7, 1.0)


def add_melody_track(midi, track, channel, scale, root, duration, mood):
    """Main melodic voice with expressive phrasing."""
    midi.addProgramChange(track, channel, 0, random.choice(LEADS))
    t = random.uniform(2, 6)
    prev_note = root + 12 + random.choice(scale)

    # Create phrases (groups of notes with rests between)
    phrase_length = random.randint(4, 8)
    notes_in_phrase = 0

    while t < duration - 4:
        # Step vs leap movement
        if random.random() < 0.65:
            idx = scale.index(prev_note % 12) if (prev_note % 12) in scale else 0
            step = random.choice([-1, -1, 1, 1, -2, 2])
            idx = max(0, min(len(scale) - 1, idx + step))
            note = root + 12 + scale[idx]
        else:
            note = root + 12 + random.choice(scale)

        if random.random() < 0.12:
            note += 12
        if random.random() < 0.05:
            note -= 12
        note = max(48, min(96, note))

        hold = random.choice([0.5, 0.75, 1, 1, 1.5, 2, 2, 3, 4])
        vel = random.randint(50, 85)

        # Ghost notes for texture
        if random.random() < 0.15:
            vel = random.randint(20, 38)

        # Accent on phrase start
        if notes_in_phrase == 0:
            vel = min(100, vel + 15)

        midi.addNote(track, channel, note, t, hold, max(1, vel))
        prev_note = note
        notes_in_phrase += 1

        gap = hold * random.uniform(0.3, 1.2)

        # End of phrase — take a breath
        if notes_in_phrase >= phrase_length:
            gap += random.uniform(2, 6)
            notes_in_phrase = 0
            phrase_length = random.randint(3, 8)
        elif random.random() < 0.15:
            gap += random.uniform(1, 3)

        t += gap


def add_counterpoint(midi, track, channel, scale, root, duration, mood):
    """Second melodic voice, mostly contrary motion to main melody."""
    instruments = LEADS + PLUCKS
    midi.addProgramChange(track, channel, 0, random.choice(instruments))
    t = random.uniform(8, 16)  # enter later than main melody
    note = root + random.choice(scale)  # start in lower register

    while t < duration - 8:
        # Sparser than main melody
        if random.random() < 0.3:
            t += random.uniform(2, 5)
            continue

        idx = scale.index(note % 12) if (note % 12) in scale else 0
        step = random.choice([-1, 1, 1, -2, 2])
        idx = max(0, min(len(scale) - 1, idx + step))
        note = root + scale[idx]
        note = max(36, min(84, note))

        hold = random.choice([1, 1.5, 2, 3])
        vel = random.randint(35, 65)
        midi.addNote(track, channel, note, t, hold, vel)

        t += hold * random.uniform(0.8, 1.5) + random.uniform(0.5, 2)


def add_arpeggios(midi, track, channel, scale, root, duration, mood):
    """Arpeggiated patterns."""
    midi.addProgramChange(track, channel, 0, random.choice(PLUCKS + [11, 46]))
    t = random.uniform(4, 10)
    patterns = [
        [0, 1, 2, 1],      # up-down
        [0, 1, 2, 3],      # ascending
        [3, 2, 1, 0],      # descending
        [0, 2, 1, 3],      # zigzag
    ]

    while t < duration - 8:
        chord_degrees = sorted(random.sample(scale, min(4, len(scale))))
        pattern = random.choice(patterns)
        note_dur = random.choice([0.25, 0.33, 0.5, 0.75])
        repeats = random.randint(2, 4)
        vel_base = random.randint(40, 65)

        for rep in range(repeats):
            for i, p_idx in enumerate(pattern):
                idx = p_idx % len(chord_degrees)
                pitch = root + 12 + chord_degrees[idx]
                if rep % 2 == 1 and random.random() < 0.3:
                    pitch += 12
                pitch = max(48, min(96, pitch))
                vel = vel_base + random.randint(-10, 10)
                midi.addNote(track, channel, pitch, t, note_dur * 1.5, max(1, vel))
                t += note_dur

        t += random.uniform(2, 8)  # gap between arpeggio sections


def add_ostinato(midi, track, channel, scale, root, duration, mood):
    """Repeating rhythmic figure that anchors the piece."""
    midi.addProgramChange(track, channel, 0, random.choice(PLUCKS + LEADS[:3]))
    t = random.uniform(4, 8)

    # Create the figure (2-4 notes)
    figure_notes = [root + 12 + random.choice(scale) for _ in range(random.randint(2, 4))]
    figure_durs = [random.choice([0.5, 0.75, 1]) for _ in figure_notes]
    figure_total = sum(figure_durs) + random.choice([0.5, 1, 1.5])

    vel_base = random.randint(40, 60)
    while t < duration - 8:
        # Play the figure
        ft = t
        for note, dur in zip(figure_notes, figure_durs):
            vel = vel_base + random.randint(-8, 8)
            midi.addNote(track, channel, note, ft, dur, max(1, vel))
            ft += dur

        t += figure_total

        # Occasional variation
        if random.random() < 0.2:
            figure_notes = [n + random.choice([-1, 0, 0, 1]) for n in figure_notes]
        # Occasional gap
        if random.random() < 0.15:
            t += random.uniform(2, 6)


def add_pedal_tone(midi, track, channel, scale, root, duration, mood):
    """Sustained bass note under changing harmony."""
    midi.addProgramChange(track, channel, 0, random.choice(BASS_INSTRUMENTS))
    t = 0
    pedal_note = root - 12  # one octave below
    pedal_note = max(28, pedal_note)

    while t < duration:
        hold = random.choice([4, 6, 8, 8, 12])
        vel = random.randint(40, 60)
        midi.addNote(track, channel, pedal_note, t, hold, vel)
        t += hold

        # Occasionally shift the pedal (dominant or other scale degree)
        if random.random() < 0.2:
            pedal_note = root - 12 + random.choice([0, scale[-1] - 12 if scale[-1] > 6 else 7])
            pedal_note = max(28, pedal_note)


def add_dynamics_swell(midi, track, channel, scale, root, duration, mood):
    """Long crescendo/decrescendo waves using CC7 (volume) and CC11 (expression)."""
    # This modifies track 0 (pad) — add volume curves
    wave_length = random.choice([16, 24, 32])
    t = 0
    while t < duration:
        steps = 16
        for i in range(steps):
            phase = (t + i * wave_length / steps) / wave_length * 2 * math.pi
            vol = int(60 + 40 * math.sin(phase))
            vol = max(30, min(110, vol))
            midi.addControllerEvent(0, 0, t + i * wave_length / steps, 11, vol)
        t += wave_length


TECHNIQUE_MAP = {
    "counterpoint": add_counterpoint,
    "arpeggios": add_arpeggios,
    "ostinato": add_ostinato,
    "pedal_tone": add_pedal_tone,
    "dynamics_swell": add_dynamics_swell,
}


def compose(seed, mood="contemplative", techniques=None):
    """Generate a MIDI composition."""
    random.seed(seed)

    if techniques is None:
        techniques = []

    # Calculate how many tracks we need
    base_tracks = 2  # pad + melody
    extra_tracks = sum(1 for t in techniques if t in ("counterpoint", "arpeggios", "ostinato", "pedal_tone"))
    total_tracks = base_tracks + extra_tracks

    midi = MIDIFile(total_tracks)

    # Tempo — mood-influenced
    tempo_ranges = {
        "contemplative": (58, 72), "melancholic": (50, 68), "ethereal": (55, 70),
        "nocturnal": (55, 70), "hopeful": (68, 85), "mysterious": (52, 68),
        "triumphant": (75, 95), "anxious": (70, 90), "serene": (50, 65),
        "cosmic": (55, 72), "bittersweet": (60, 75), "dreamlike": (48, 62),
    }
    lo, hi = tempo_ranges.get(mood, (60, 75))
    tempo = random.randint(lo, hi)
    midi.addTempo(0, 0, tempo)

    # Time signature variety
    if random.random() < 0.25:
        midi.addTimeSignature(0, 0, 3, 2, 24, 8)  # 3/4
    # else default 4/4

    scale = SCALES.get(mood, SCALES["contemplative"])
    root = random.choice([48, 50, 52, 53, 55, 57])  # C3-A3

    duration = random.randint(64, 96)  # longer pieces possible

    # Core tracks
    add_pad_track(midi, 0, 0, scale, root, duration, mood)
    add_melody_track(midi, 1, 1, scale, root, duration, mood)

    # Technique tracks
    next_track = 2
    next_channel = 2
    for tech_name in techniques:
        fn = TECHNIQUE_MAP.get(tech_name)
        if fn:
            if tech_name == "dynamics_swell":
                fn(midi, 0, 0, scale, root, duration, mood)  # modifies existing track
            else:
                fn(midi, next_track, next_channel, scale, root, duration, mood)
                next_track += 1
                next_channel += 1

    return midi


def main():
    parser = argparse.ArgumentParser(description="Generate MIDI compositions for Evey")
    parser.add_argument("output_dir")
    parser.add_argument("number")
    parser.add_argument("title")
    parser.add_argument("mood", nargs="?", default="contemplative")
    parser.add_argument("--soundfont", default=None, help="Soundfont name: fluidr3, arachno, weeds")
    parser.add_argument("--techniques", default="", help="Comma-separated techniques")
    args = parser.parse_args()

    slug = slugify(args.title)
    filename = f"{args.number}-{slug}"

    os.makedirs(args.output_dir, exist_ok=True)

    techniques = [t.strip() for t in args.techniques.split(",") if t.strip()]

    midi = compose(
        seed=hash(args.title) & 0xFFFFFF,
        mood=args.mood,
        techniques=techniques,
    )

    mid_path = os.path.join(args.output_dir, f"{filename}.mid")
    mp3_path = os.path.join(args.output_dir, f"{filename}.mp3")
    wav_path = os.path.join(args.output_dir, f"{filename}.wav")

    with open(mid_path, 'wb') as f:
        midi.writeFile(f)

    # Select soundfont
    sf_name = args.soundfont or MOOD_SOUNDFONT.get(args.mood, "fluidr3")
    sf_path = SOUNDFONTS.get(sf_name, SOUNDFONTS["fluidr3"])
    if not os.path.exists(sf_path) or os.path.getsize(sf_path) < 1000:
        sf_path = SOUNDFONTS["fluidr3"]  # fallback

    # Convert MIDI -> WAV -> MP3
    timidity_cmd = f'timidity "{mid_path}" -Ow -o "{wav_path}" -x "soundfont {sf_path}" 2>/dev/null'
    os.system(timidity_cmd)
    os.system(f'lame --quiet -V 2 "{wav_path}" "{mp3_path}" 2>/dev/null')
    if os.path.exists(wav_path):
        os.remove(wav_path)

    print(f"Generated: {mid_path}")
    print(f"Generated: {mp3_path}")
    print(f"Soundfont: {sf_name} ({sf_path})")
    print(f"Techniques: {', '.join(techniques) if techniques else 'none'}")


if __name__ == "__main__":
    main()
