import { randomRange } from '@/engine/utils/random';
import type { PartIds } from '@/shared/serverTypes';

// Минимальное время, которое должно пройти с начала рисования, чтобы его можно было считать полноценным.
// Если пользователь нарисовал фоторобот быстрее, то имеет смысл добавить к задержке перед следующим посетителем
// недостающие секунды, чтобы не давать игроку слишком лёгкую игру.
const MINIMUM_DRAW_TIME_SEC = 3;

const FIRST_VISITOR_SPAWN_DELAY_SEC = 0.3;

/**
 * Параметры сложности + состояние сессии.
 */
export class Balance {
  public day = 1;
  public paperCount = 0;
  public dayTimeRemainingSec = 0;

  private currentDrawingTimeMs = 0;
  private firstVisitorSpawned = false;

  private currentDailyQuota = 0;

  /** Сколько фотороботов надо сдать за день */
  public getDailyQuota(): number {
    // TODO: формула от day. Или свитчём или ещё как-то
    return 3;
  }

  public getDayDurationSec(): number {
    // TODO: сколько длится
    return 120; // 2 минуты
  }

  public getVisitorStaySec(): number {
    // TODO: уменьшать с ростом day (через сколько времени посетитель уйдёт с камеры)
    return randomRange(60, 120); // от 60 до 120 секунд
  }

  public getMinimumDrawSec(): number {
    // TODO: минимальное время, за которое пользователь должен нарисовать фоторобот. Если он сделал быстрее, имеет смысл добавлять это время к задержке перед следующими посетителем.
    return MINIMUM_DRAW_TIME_SEC;
  }

  public getVisitorSpawnDelaySec(): number {
    // TODO: задержка между появлением посетителя
    let delay = FIRST_VISITOR_SPAWN_DELAY_SEC;

    // Возможно, имеет смысл самого первого в день давать без задержки
    // а дальше уже как-то настраивать. Главное чтобы билось с квотой)
    if (!this.firstVisitorSpawned) {
      this.firstVisitorSpawned = true;
      delay = 0;
    }

    const fine = Math.max(0, this.getMinimumDrawSec() - this.currentDrawingTimeMs / 1000);

    return delay + fine;
  }

  /** Разброс для угадывания: 0 = все варианты идентичны (нерешаемо!), 1 = все разные */
  public getGuessSpread(): number {
    // TODO: растёт с day → сложнее угадывать (варианты ближе друг к другу)
    // Тут ещё нужно подумать над логикой. Возможно делать разброс по разным частям лица. Например при сложности 0.8 - всегда будут одинаковые глаза и рот.
    // И это явно нужно привязать к текущему дню.
    return 0.6;
  }

  /** Доступные на этом дне скины для каждого паттерна */
  public getVisitorSkin(): PartIds {
    const rand = (max: number) => Math.floor(Math.random() * max) + 1;

    const skin: PartIds = {
      head: rand(5),
      body: rand(6),
      nose: rand(9),
      ear: rand(9),
      mouth: rand(7),
      brow: rand(9),
      eye: rand(6),
    };

    const optionalParts: Array<[keyof PartIds, number]> = [
      ['hat', 4],
      ['accessories', 6],
      ['hair', 9],
      ['beard', 5],
      ['scar', 6],
    ];

    const count = Math.floor(Math.random() * 5) + 1;
    const shuffled = optionalParts.sort(() => Math.random() - 0.5);

    for (let i = 0; i < count; i++) {
      const [key, max] = shuffled[i];
      skin[key] = rand(max);
    }

    return skin;
  }

  public getStartingPaperCount(): number {
    // Отдаём стартовое значение бумаги. Бумага даётся только при старте игры!!!!
    return 1;
  }

  public getRewardForGuessing(correct: boolean): number {
    // TODO: нужно подумать что именно мы даём как награду
    return correct ? 2 : 0; // TODO: формула от day. Или свитчём или ещё как-то
  }

  public visitorServed(): void {
    this.currentDailyQuota++;
  }

  public getCurrentPoints(): number {
    return this.currentDailyQuota;
  }

  public startDay(): void {
    this.dayTimeRemainingSec = this.getDayDurationSec();
    this.firstVisitorSpawned = false;
    this.paperCount = this.getStartingPaperCount();
  }

  public drawAccepted(drawTimeMs: number): void {
    this.currentDrawingTimeMs = drawTimeMs;
  }

  public isDayOver(): boolean {
    return this.dayTimeRemainingSec <= 0;
  }

  public isQuotaMet(): boolean {
    return this.currentDailyQuota >= this.getDailyQuota();
  }

  public reset(): void {
    this.day = 1;
    this.dayTimeRemainingSec = 0;
    this.firstVisitorSpawned = false;
    this.currentDailyQuota = 0;
  }
}
