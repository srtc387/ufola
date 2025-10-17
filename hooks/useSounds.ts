import { useCallback, useRef, useEffect } from 'react';

export type SoundType = 'score' | 'coin' | 'trap' | 'crash' | 'flap' | 'lifeUp' | 'levelComplete' | 'pause' | 'victory';

// A simple hook to manage game sounds using the Web Audio API.
export const useSounds = ({ isMuted }: { isMuted: boolean }) => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const sfxGainNodeRef = useRef<GainNode | null>(null);
  const musicGainNodeRef = useRef<GainNode | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Initialize AudioContext on the first user interaction.
    const initializeAudio = () => {
      if (!audioContextRef.current) {
        try {
            const context = new (window.AudioContext || (window as any).webkitAudioContext)();
            audioContextRef.current = context;
            sfxGainNodeRef.current = context.createGain();
            sfxGainNodeRef.current.connect(context.destination);
            musicGainNodeRef.current = context.createGain();
            musicGainNodeRef.current.connect(context.destination);
        } catch (e) {
            console.error("Web Audio API is not supported in this browser");
        }
      }
    };
    
    initializeAudio();
  }, []);

  useEffect(() => {
    const sfxGain = sfxGainNodeRef.current?.gain;
    const musicGain = musicGainNodeRef.current?.gain;
    const now = audioContextRef.current?.currentTime;

    if (now === undefined) return;

    if (isMuted) {
        sfxGain?.setTargetAtTime(0, now, 0.01);
        musicGain?.setTargetAtTime(0, now, 0.01);
    } else {
        sfxGain?.setTargetAtTime(1, now, 0.01);
        musicGain?.setTargetAtTime(0.3, now, 0.01); // Music is quieter
    }
  }, [isMuted]);

  const playSound = useCallback((type: SoundType) => {
    const context = audioContextRef.current;
    if (!context || !sfxGainNodeRef.current) return;
    
    // Resume context if it's suspended (common in browsers before user interaction)
    if (context.state === 'suspended') {
        context.resume();
    }
    
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(sfxGainNodeRef.current);

    const now = context.currentTime;

    switch (type) {
      case 'flap':
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(400, now);
        oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.05);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;
      case 'score':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, now);
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;
      case 'coin':
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(880, now);
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;
      case 'trap':
         oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(440, now);
        oscillator.frequency.exponentialRampToValueAtTime(220, now + 0.2);
        gainNode.gain.setValueAtTime(0.4, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;
      case 'crash':
        oscillator.type = 'sawtooth';
        oscillator.frequency.setValueAtTime(200, now);
        oscillator.frequency.exponentialRampToValueAtTime(50, now + 0.5);
        gainNode.gain.setValueAtTime(0.5, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        oscillator.start(now);
        oscillator.stop(now + 0.5);
        break;
      case 'lifeUp':
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(523.25, now); // C5
        oscillator.frequency.linearRampToValueAtTime(1046.50, now + 0.2); // C6
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        oscillator.start(now);
        oscillator.stop(now + 0.2);
        break;
      case 'levelComplete':
        oscillator.type = 'triangle';
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, i) => {
            oscillator.frequency.setValueAtTime(freq, now + i * 0.1);
        });
        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        oscillator.start(now);
        oscillator.stop(now + 0.4);
        break;
      case 'pause':
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(300, now);
        oscillator.frequency.exponentialRampToValueAtTime(200, now + 0.1);
        gainNode.gain.setValueAtTime(0.2, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        break;
      case 'victory':
        oscillator.type = 'triangle';
        const victoryNotes = [523.25, 783.99, 1046.50, 1318.51]; // C5, G5, C6, E6
        gainNode.gain.setValueAtTime(0.4, now);
        victoryNotes.forEach((freq, i) => {
            oscillator.frequency.setValueAtTime(freq, now + i * 0.15);
        });
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
        oscillator.start(now);
        oscillator.stop(now + 0.7);
        break;
    }
  }, []);

  const stopMusic = useCallback(() => {
    if (musicSourceRef.current) {
      try {
        musicSourceRef.current.stop();
      } catch (e) {
        // Can throw an error if already stopped, safe to ignore.
      }
      musicSourceRef.current.disconnect();
      musicSourceRef.current = null;
    }
  }, []);

  const playMusic = useCallback((level: number) => {
    const context = audioContextRef.current;
    if (!context || !musicGainNodeRef.current || musicSourceRef.current) return;

    if (context.state === 'suspended') {
        context.resume();
    }
    
    const tempo = 140;
    const noteDuration = 60 / tempo / 2; // eigth notes
    const baseArp = [261.63, 329.63, 392.00, 523.25, 392.00, 329.63]; // C4, E4, G4, C5, G4, E4
    
    // Raise pitch by a semitone for each level
    const semitoneRatio = Math.pow(2, 1 / 12);
    const transpositionFactor = Math.pow(semitoneRatio, level - 1);
    const arp = baseArp.map(freq => freq * transpositionFactor);

    const loopDuration = arp.length * noteDuration;
    const sampleRate = context.sampleRate;
    const bufferSize = Math.floor(sampleRate * loopDuration);
    const buffer = context.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    
    let cursor = 0;
    for (const freq of arp) {
        const noteSamples = Math.floor(sampleRate * noteDuration);
        for(let i=0; i < noteSamples; i++) {
            if (cursor + i >= bufferSize) break;
            const time = i / sampleRate;
            // simple decay envelope on a sine wave for a pluck sound
            const envelope = Math.max(0, 1 - (i / noteSamples)) ** 2;
            data[cursor + i] = Math.sin(2 * Math.PI * freq * time) * envelope * 0.8;
        }
        cursor += noteSamples;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(musicGainNodeRef.current);
    source.start();
    musicSourceRef.current = source;
  }, []);

  return { playSound, playMusic, stopMusic };
};