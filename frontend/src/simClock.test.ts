import { describe, expect, it } from "vitest";
import { SimClock } from "./simClock";

const T0 = 1_767_225_600_000; // 2026-01-01T00:00:00Z

describe("SimClock", () => {
  it("advances sim-time by delta × speed while playing", () => {
    const clock = new SimClock(T0, 86_400);
    clock.tick(1000); // one real second at one day per second
    expect(clock.now()).toBe(T0 + 86_400_000);
  });

  it("does not advance while paused, resumes cleanly", () => {
    const clock = new SimClock(T0, 3600);
    clock.pause();
    clock.tick(5000);
    expect(clock.now()).toBe(T0);
    clock.play();
    clock.tick(1000);
    expect(clock.now()).toBe(T0 + 3_600_000);
  });

  it("applies speed changes to subsequent ticks only", () => {
    const clock = new SimClock(T0, 1);
    clock.tick(1000);
    clock.speed = 60;
    clock.tick(1000);
    expect(clock.now()).toBe(T0 + 1000 + 60_000);
  });

  it("runs backwards with a negative speed", () => {
    const clock = new SimClock(T0, -86_400);
    clock.tick(1000);
    expect(clock.now()).toBe(T0 - 86_400_000);
  });

  it("jump sets sim-time exactly", () => {
    const clock = new SimClock(T0);
    clock.jump(42);
    expect(clock.now()).toBe(42);
  });

  it("accumulates no drift across many uneven frame deltas", () => {
    const clock = new SimClock(0, 86_400);
    const deltas = [16.7, 16.6, 33.4, 8.1, 16.7, 100.0, 16.6];
    const total = deltas.reduce((a, b) => a + b, 0);
    const repeats = 1000;
    for (let i = 0; i < repeats; i++) {
      for (const d of deltas) clock.tick(d);
    }
    expect(clock.now()).toBeCloseTo(total * repeats * 86_400, 3);
  });
});
