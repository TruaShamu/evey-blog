#!/usr/bin/env python3
"""Generate ambient MIDI compositions for Evey's blog.
Usage: python3 generate_music.py <output_dir> <number> <title> <mood>
Outputs: {number}-{slug}.mid and {number}-{slug}.mp3
"""
import sys, os, random, math
from midiutil import MIDIFile

def slugify(s):
    return s.lower().replace(' ', '-').replace("'", '').replace('"', '')

def ambient_piece(seed, mood="contemplative"):
    """Generate an ambient MIDI piece."""
    random.seed(seed)
    
    midi = MIDIFile(2)  # 2 tracks: pad + melody
    midi.addTempo(0, 0, random.choice([60, 65, 70, 72, 75, 80]))
    
    # Track 0: Pad/drone
    midi.addProgramChange(0, 0, 0, 89)  # Warm Pad
    # Track 1: Melody
    midi.addProgramChange(1, 1, 0, random.choice([11, 46, 79, 88]))  # Vibes/Harp/Whistle/Pad
    
    # Scale selection based on mood
    scales = {
        "contemplative": [0, 2, 4, 7, 9],        # major pentatonic
        "melancholic": [0, 2, 3, 5, 7, 8, 10],   # natural minor
        "ethereal": [0, 2, 4, 6, 7, 9, 11],      # lydian
        "nocturnal": [0, 1, 3, 5, 7, 8, 10],     # phrygian
        "hopeful": [0, 2, 4, 5, 7, 9, 11],       # major
        "mysterious": [0, 1, 4, 5, 7, 8, 11],    # double harmonic
    }
    scale = scales.get(mood, scales["contemplative"])
    root = random.choice([48, 50, 52, 53, 55])  # C3-G3
    
    duration = 64  # beats (roughly 50-60 seconds)
    
    # === PAD TRACK ===
    t = 0
    while t < duration:
        # Choose 2-3 notes for a chord
        chord_notes = random.sample(scale, min(3, len(scale)))
        chord_notes.sort()
        hold = random.choice([4, 6, 8])
        vel = random.randint(40, 65)
        
        for note_offset in chord_notes:
            octave = random.choice([0, 12])
            pitch = root + note_offset + octave
            midi.addNote(0, 0, pitch, t, hold + random.uniform(-0.5, 1), vel + random.randint(-5, 5))
        
        t += hold * random.uniform(0.7, 1.0)
    
    # === MELODY TRACK ===
    t = random.uniform(2, 6)  # delayed entry
    prev_note = root + 12 + random.choice(scale)
    
    while t < duration - 4:
        # Melodic movement: prefer steps, occasional leaps
        if random.random() < 0.7:
            # Step
            idx = scale.index(prev_note % 12) if (prev_note % 12) in scale else 0
            step = random.choice([-1, 1])
            idx = max(0, min(len(scale)-1, idx + step))
            note = root + 12 + scale[idx]
        else:
            # Leap
            note = root + 12 + random.choice(scale)
        
        # Occasional octave shift
        if random.random() < 0.15:
            note += 12
        
        hold = random.choice([0.5, 1, 1.5, 2, 3, 4])
        vel = random.randint(50, 80)
        
        # Ghost notes (very quiet)
        if random.random() < 0.2:
            vel = random.randint(25, 40)
        
        midi.addNote(1, 1, note, t, hold, vel)
        prev_note = note
        
        # Varied spacing — sometimes breathe
        gap = hold * random.uniform(0.3, 1.5)
        if random.random() < 0.25:
            gap += random.uniform(2, 6)  # long pause
        t += gap
    
    return midi

def main():
    output_dir = sys.argv[1]
    number = sys.argv[2]
    title = sys.argv[3]
    mood = sys.argv[4] if len(sys.argv) > 4 else "contemplative"
    
    slug = slugify(title)
    filename = f"{number}-{slug}"
    
    os.makedirs(output_dir, exist_ok=True)
    
    midi = ambient_piece(seed=hash(title) & 0xFFFFFF, mood=mood)
    
    mid_path = os.path.join(output_dir, f"{filename}.mid")
    mp3_path = os.path.join(output_dir, f"{filename}.mp3")
    wav_path = os.path.join(output_dir, f"{filename}.wav")
    
    with open(mid_path, 'wb') as f:
        midi.writeFile(f)
    
    # Convert to MP3 via timidity -> wav -> lame -> mp3
    os.system(f'timidity "{mid_path}" -Ow -o "{wav_path}" 2>/dev/null')
    os.system(f'lame --quiet -V 2 "{wav_path}" "{mp3_path}" 2>/dev/null')
    if os.path.exists(wav_path):
        os.remove(wav_path)
    
    print(f"Generated: {mid_path}")
    print(f"Generated: {mp3_path}")

if __name__ == "__main__":
    main()
