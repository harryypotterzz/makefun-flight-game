// Tiny synthesised sound: no audio files, everything is an oscillator through a
// gain node, started on the first user gesture. Engine hum follows the throttle;
// rings chime, landings jingle, crashes thud. M mutes.

export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = false;

  function ensure() {
    if (context !== null) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 70;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(context.destination);
      engineOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(frequency, duration, type, volume) {
    if (!ensure() || muted) return;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start();
    osc.stop(context.currentTime + duration);
  }

  return {
    /** Call on any user gesture so the browser lets sound start. */
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume();
    },
    /** Continuous engine hum: throttle 0..1, silent when parked. */
    engine(throttle, flying) {
      if (!ensure()) return;
      const target = muted || !flying ? 0 : 0.015 + 0.05 * throttle;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(60 + 90 * throttle, context.currentTime, 0.1);
    },
    ring() {
      blip(880, 0.18, 'sine', 0.12);
      setTimeout(() => blip(1318, 0.25, 'sine', 0.1), 70);
    },
    land() {
      [523, 659, 784].forEach((frequency, index) => {
        setTimeout(() => blip(frequency, 0.22, 'triangle', 0.12), index * 90);
      });
    },
    crash() {
      blip(90, 0.4, 'sawtooth', 0.2);
    },
    toggleMute() {
      muted = !muted;
      if (engineGain) engineGain.gain.value = 0;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
