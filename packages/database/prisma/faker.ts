/**
 * Deterministic pseudo-random utilities for the seed — stable output across runs.
 */
export interface SeededRandom {
  next(): number;
  int(minInclusive: number, maxExclusive: number): number;
  pick<T>(items: readonly T[]): T;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSeededRandom(seed: number): SeededRandom {
  const base = mulberry32(seed);
  return {
    next: base,
    int(minInclusive: number, maxExclusive: number): number {
      return minInclusive + Math.floor(base() * (maxExclusive - minInclusive));
    },
    pick<T>(items: readonly T[]): T {
      return items[Math.min(items.length - 1, Math.floor(base() * items.length))] as T;
    },
  };
}
