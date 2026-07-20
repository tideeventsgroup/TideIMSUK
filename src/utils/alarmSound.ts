/**
 * Synthesized siren via Web Audio API — no audio asset to ship or license,
 * and it works the instant the tab has had any prior user interaction
 * (autoplay policies block it otherwise; we swallow that failure since a
 * silent miss is better than a crash for a best-effort alert sound).
 */
export function playAlarmSound() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;
    const pulseCount = 3;
    const pulseDuration = 0.5;
    const gap = 0.15;

    for (let i = 0; i < pulseCount; i++) {
      const start = now + i * (pulseDuration + gap);
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'sawtooth';
      oscillator.frequency.setValueAtTime(880, start);
      oscillator.frequency.linearRampToValueAtTime(1320, start + pulseDuration / 2);
      oscillator.frequency.linearRampToValueAtTime(880, start + pulseDuration);
      gainNode.gain.setValueAtTime(0, start);
      gainNode.gain.linearRampToValueAtTime(0.35, start + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, start + pulseDuration);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + pulseDuration);
    }

    const totalDuration = pulseCount * (pulseDuration + gap);
    setTimeout(() => ctx.close(), (totalDuration + 0.2) * 1000);
  } catch {
    // Autoplay blocked or Web Audio unsupported — best-effort only.
  }
}
