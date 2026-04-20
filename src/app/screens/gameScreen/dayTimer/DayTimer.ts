import { Container, Text } from 'pixi.js';
import { TIMER_SLOTS, TimerController } from './TimerController';

/**
 * Визуализация часов сверху и календаря
 */
export class DayTimer extends Container {
  private remainingSec = 0;
  private totalSec = 0;
  private blinking = false;

  private timerSpine: TimerController;

  private calendarContainer: Container;
  private dayLabel: Text;
  private dayNumber: Text;

  private scoreContainer: Container;
  private quotaLabel: Text;
  private scoreNumber: Text;

  constructor() {
    super();

    this.timerSpine = new TimerController();
    this.timerSpine.label = 'day_timer_spine';

    this.calendarContainer = new Container();

    const labelStyle = { fill: 0x000000, fontSize: 54, fontFamily: 'ProtestRiot-Regular' };
    const numberStyle = { fill: 0x000000, fontSize: 82, fontFamily: 'ProtestRiot-Regular' };

    this.dayLabel = new Text({ text: 'DAY', style: labelStyle });
    this.dayLabel.anchor.set(0.5, 0);
    this.dayLabel.x = 0;
    this.dayLabel.y = 0;

    this.dayNumber = new Text({ text: '1', style: numberStyle });
    this.dayNumber.anchor.set(0.5, 0);
    this.dayNumber.x = 0;
    this.dayNumber.y = this.dayLabel.height;

    this.calendarContainer.addChild(this.dayLabel, this.dayNumber);
    this.calendarContainer.label = 'calendar_container';

    this.scoreContainer = new Container();

    const quotaStyle = { fill: 0xcc9b56, fontSize: 54, fontFamily: 'VT323-Regular' };
    const scoreStyle = { fill: 0xcc9b56, fontSize: 82, fontFamily: 'DigitalNumbers-Regular' };

    this.quotaLabel = new Text({ text: 'QUOTA:', style: quotaStyle });
    this.quotaLabel.anchor.set(0.5, 0);
    this.quotaLabel.x = 0;
    this.quotaLabel.y = 0;

    this.scoreNumber = new Text({ text: '0', style: scoreStyle });
    this.scoreNumber.anchor.set(0.5, 0);
    this.scoreNumber.x = 0;
    this.scoreNumber.y = this.quotaLabel.height;

    this.scoreContainer.addChild(this.quotaLabel, this.scoreNumber);
    this.scoreContainer.label = 'score_container';

    this.timerSpine.addToSlot(TIMER_SLOTS.TARGET_QUOTE, this.scoreContainer);
  }

  public getTextContainer(): Container {
    return this.calendarContainer;
  }

  public getScoreContainer(): Container {
    return this.scoreContainer;
  }

  public setScore(score: number): void {
    this.scoreNumber.text = String(score);
  }

  public startDay(durationSec: number, dayNumber: number, quota: number): void {
    this.totalSec = durationSec;
    this.remainingSec = durationSec;
    this.blinking = false;

    this.timerSpine.setTime(0);
    this.timerSpine.playOn();
    this.dayNumber.text = String(dayNumber);
    this.setScore(quota);
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
