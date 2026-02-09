/**
 * RateLimiter
 *
 * Controla limites de envio: 50/hora, 200/dia.
 * Gera delays aleatórios e pausas ocasionais para evitar detecção.
 */

const LIMIT_PER_HOUR = 50;
const LIMIT_PER_DAY = 200;
const DELAY_MIN_MS = 2000;
const DELAY_MAX_MS = 11000;
const RANDOM_PAUSE_INTERVAL = 10;
const RANDOM_PAUSE_CHANCE_MIN = 0.1;
const RANDOM_PAUSE_CHANCE_MAX = 0.3;

export interface CanSendResult {
  allowed: boolean;
  reason?: string;
  waitMs?: number;
}

export interface RateLimiterStats {
  sentToday: number;
  sentThisHour: number;
}

export class RateLimiter {
  private hourlyCounts = new Map<number, number>();
  private dailyCount = 0;
  private dailyCountDate = this.getDateKey(new Date());
  private totalSentSinceCreation = 0;

  private getDateKey(d: Date): number {
    const copy = new Date(d);
    copy.setHours(0, 0, 0, 0);
    return copy.getTime();
  }

  private getHourKey(d: Date): number {
    const copy = new Date(d);
    copy.setMinutes(0, 0, 0);
    return copy.getTime();
  }

  private maybeResetDaily(): void {
    const now = new Date();
    const today = this.getDateKey(now);
    if (today !== this.dailyCountDate) {
      this.dailyCount = 0;
      this.dailyCountDate = today;
      this.hourlyCounts.clear();
    }
  }

  private cleanupOldHours(): void {
    const now = new Date();
    const currentHour = this.getHourKey(now);
    for (const key of this.hourlyCounts.keys()) {
      if (key < currentHour) {
        this.hourlyCounts.delete(key);
      }
    }
  }

  canSend(): CanSendResult {
    this.maybeResetDaily();
    this.cleanupOldHours();

    const now = new Date();
    const hourKey = this.getHourKey(now);
    const hourCount = this.hourlyCounts.get(hourKey) ?? 0;
    const dayCount = this.dailyCount;

    if (dayCount >= LIMIT_PER_DAY) {
      const midnight = new Date(now);
      midnight.setDate(midnight.getDate() + 1);
      midnight.setHours(0, 0, 0, 0);
      return {
        allowed: false,
        reason: 'limite diário',
        waitMs: midnight.getTime() - now.getTime(),
      };
    }

    if (hourCount >= LIMIT_PER_HOUR) {
      const nextHour = new Date(hourKey);
      nextHour.setHours(nextHour.getHours() + 1);
      return {
        allowed: false,
        reason: 'limite por hora',
        waitMs: nextHour.getTime() - now.getTime(),
      };
    }

    return { allowed: true };
  }

  recordSent(): void {
    this.maybeResetDaily();

    const now = new Date();
    const hourKey = this.getHourKey(now);
    const current = this.hourlyCounts.get(hourKey) ?? 0;
    this.hourlyCounts.set(hourKey, current + 1);
    this.dailyCount += 1;
    this.totalSentSinceCreation += 1;
  }

  getDelay(): number {
    const range = DELAY_MAX_MS - DELAY_MIN_MS + 1;
    return Math.floor(Math.random() * range) + DELAY_MIN_MS;
  }

  shouldRandomPause(): boolean {
    if (this.totalSentSinceCreation === 0) return false;
    if (this.totalSentSinceCreation % RANDOM_PAUSE_INTERVAL !== 0) return false;

    const chance = RANDOM_PAUSE_CHANCE_MIN + Math.random() * (RANDOM_PAUSE_CHANCE_MAX - RANDOM_PAUSE_CHANCE_MIN);
    return Math.random() < chance;
  }

  resetDailyCounters(): void {
    this.dailyCount = 0;
    this.dailyCountDate = this.getDateKey(new Date());
    this.hourlyCounts.clear();
  }

  getStats(): RateLimiterStats {
    this.maybeResetDaily();
    this.cleanupOldHours();

    const now = new Date();
    const hourKey = this.getHourKey(now);
    const sentThisHour = this.hourlyCounts.get(hourKey) ?? 0;

    return {
      sentToday: this.dailyCount,
      sentThisHour,
    };
  }
}
