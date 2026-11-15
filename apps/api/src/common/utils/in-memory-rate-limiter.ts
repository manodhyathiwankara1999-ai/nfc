import { Injectable } from '@nestjs/common';

interface Counter {
  count: number;
  expiresAt: number;
}

@Injectable()
export class InMemoryRateLimiter {
  private readonly counters = new Map<string, Counter>();
  private readonly blocks = new Map<string, number>();
  private operations = 0;

  increment(key: string, windowMs: number): number {
    const now = Date.now();
    const current = this.counters.get(key);
    const counter =
      current && current.expiresAt > now ? current : { count: 0, expiresAt: now + windowMs };
    counter.count += 1;
    this.counters.set(key, counter);
    this.prune(now);
    return counter.count;
  }

  isBlocked(key: string): boolean {
    const expiresAt = this.blocks.get(key);
    if (expiresAt === undefined) return false;
    if (expiresAt <= Date.now()) {
      this.blocks.delete(key);
      return false;
    }
    return true;
  }

  block(key: string, durationMs: number): void {
    this.blocks.set(key, Date.now() + durationMs);
  }

  clear(key: string): void {
    this.counters.delete(key);
    this.blocks.delete(key);
  }

  private prune(now: number): void {
    this.operations += 1;
    if (this.operations % 256 !== 0) return;
    for (const [key, counter] of this.counters) {
      if (counter.expiresAt <= now) this.counters.delete(key);
    }
    for (const [key, expiresAt] of this.blocks) {
      if (expiresAt <= now) this.blocks.delete(key);
    }
  }
}
