import { Container } from 'pixi.js';
import { TimerController } from './TimerController';

/**
 * Визуализация часов сверху
 */
export class DayTimer extends Container {
  private remainingSec = 0;
  private totalSec = 0;
  private blinking = false;

  private timerSpine: TimerController;

  constructor() {
    super();
    // TODO: создать визуал часов (стрелки/цифры) и календаря (??)

    this.timerSpine = new TimerController();
  }

  public startDay(durationSec: number, _dayNumber: number): void {
    this.totalSec = durationSec;
    this.remainingSec = durationSec;
    this.blinking = false;

    this.timerSpine.setTime(0);
    this.timerSpine.playOn();
    // TODO: обновить календарь до dayNumber
    // TODO: сбросить визуальное состояние мигания
  }

  public update(dt: number): void {
    if (this.remainingSec <= 0) return;
    this.remainingSec = Math.max(0, this.remainingSec - dt);

    // Мигать в последние 15% времени
    const shouldBlink = this.remainingSec / this.totalSec < 0.15;
    if (shouldBlink && !this.blinking) {
      this.blinking = true;
      this.timerSpine.playAlert();
    }

    // TODO: обновить стрелки/цифры часов
    this.timerSpine.setTime(1 - this.remainingSec / this.totalSec);
    this.timerSpine.update(dt);
  }

  public getRemainingSec(): number {
    return this.remainingSec;
  }

  public advanceCalendar(_newDay: number): void {
    // TODO: переключение визуализации дня (но может быть его не будет)
  }

  public getTimerSpine(): TimerController {
    return this.timerSpine;
  }
}
