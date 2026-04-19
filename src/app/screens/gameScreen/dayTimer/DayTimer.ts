import { Container } from 'pixi.js';

/**
 * Визуализация часов сверху
 */
export class DayTimer extends Container {
  private remainingMs = 0;
  private totalMs = 0;
  private blinking = false;

  constructor() {
    super();
    // TODO: создать визуал часов (стрелки/цифры) и календаря (??)
  }

  public startDay(durationMs: number, _dayNumber: number): void {
    this.totalMs = durationMs;
    this.remainingMs = durationMs;
    this.blinking = false;
    // TODO: обновить календарь до dayNumber
    // TODO: сбросить визуальное состояние мигания
  }

  public update(deltaMs: number): void {
    if (this.remainingMs <= 0) return;
    this.remainingMs = Math.max(0, this.remainingMs - deltaMs);

    // Мигать в последние 15% времени
    const shouldBlink = this.remainingMs / this.totalMs < 0.15;
    if (shouldBlink && !this.blinking) {
      this.blinking = true;
      // TODO: запустить gsap-анимацию мигания
    }

    // TODO: обновить стрелки/цифры часов
  }

  public getRemainingMs(): number {
    return this.remainingMs;
  }

  public advanceCalendar(_newDay: number): void {
    // TODO: переключение визуализации дня (но может быть его не будет)
  }
}
