/**
 * Simulation clock: owns sim-time, play state, and the speed multiplier
 * (sim-seconds per real-second; 86400 = one sim-day per real second).
 * Pure state — advanced explicitly from frame deltas, no wall-clock reads.
 */
export class SimClock {
  private simMs: number;
  private playing = true;
  private speedValue: number;

  constructor(startMs: number, speed = 86_400) {
    this.simMs = startMs;
    this.speedValue = speed;
  }

  /** Advance by a real-time frame delta (ms). No-op while paused. */
  tick(realDeltaMs: number): void {
    if (this.playing) {
      this.simMs += realDeltaMs * this.speedValue;
    }
  }

  now(): number {
    return this.simMs;
  }

  jump(simMs: number): void {
    this.simMs = simMs;
  }

  play(): void {
    this.playing = true;
  }

  pause(): void {
    this.playing = false;
  }

  toggle(): void {
    this.playing = !this.playing;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  get speed(): number {
    return this.speedValue;
  }

  set speed(multiplier: number) {
    this.speedValue = multiplier;
  }
}
