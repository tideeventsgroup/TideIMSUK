/**
 * Synthesized siren via Web Audio API — no audio asset to ship or license,
 * and it works the instant the tab has had any prior user interaction
 * (autoplay policies block it otherwise; we swallow that failure since a
 * silent miss is better than a crash for a best-effort alert sound).
 *
 * A continuous frequency "wail" (not discrete beeps) — sweeps between a low
 * and high tone a few times, closer to an actual emergency siren than a
 * notification chime. Only reachable while the app has an open tab (see
 * AlarmListener.tsx); a service worker has no audio API at all when the app
 * is fully closed, so this can never play from a closed tab — that's a
 * platform restriction, not something more code fixes. The push
 * notification's vibration pattern (src/sw.ts) and the OS's own default
 * notification sound are the only audible alert in that case.
 */
export function playAlarmSound() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const now = ctx.currentTime;

    const lowHz = 600;
    const highHz = 1200;
    const sweepDuration = 1.1; // one leg of the wail (low->high or high->low)
    const cycles = 3; // 3 full low-high-low wails
    const totalDuration = cycles * sweepDuration * 2;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.type = 'sawtooth';

    oscillator.frequency.setValueAtTime(lowHz, now);
    for (let i = 0; i < cycles * 2; i++) {
      const target = i % 2 === 0 ? highHz : lowHz;
      oscillator.frequency.linearRampToValueAtTime(target, now + (i + 1) * sweepDuration);
    }

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.35, now + 0.08);
    gainNode.gain.setValueAtTime(0.35, now + totalDuration - 0.15);
    gainNode.gain.linearRampToValueAtTime(0, now + totalDuration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + totalDuration);

    setTimeout(() => ctx.close(), (totalDuration + 0.2) * 1000);
  } catch {
    // Autoplay blocked or Web Audio unsupported — best-effort only.
  }
}
